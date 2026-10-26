# Deploying Reanit (staging + production)

Each environment is one DigitalOcean droplet running [`compose.yml`](compose.yml): Caddy, web, api and worker
from images in DigitalOcean Container Registry (DOCR). Postgres and Redis are DigitalOcean managed databases,
lesson files go to Cloudflare R2, and Cloudflare serves DNS and public TLS for the root domain, every school
subdomain and every school's verified custom domain (Cloudflare for SaaS).

```
browser ─► Cloudflare (DNS, wildcard + custom hostname edge TLS) ─► droplet: Caddy (Origin CA cert) ─► web ─/api/*─► api
                                                                                    worker ◄─ Redis ─┘
                                                     managed Postgres ◄── api, worker, migrate
```

| | Staging | Production |
|---|---|---|
| Deploys | Every green push to `main` (CI job `deploy-staging`) | **Deploy** workflow, run by hand on a commit already on staging |
| `ROOT_DOMAIN` (example) | `reanit-staging.com` | `reanit.com` |
| GitHub environment | `staging` | `production` (add required reviewers) |

## How a deploy works

[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

1. Builds four images tagged with the commit SHA and pushes them to DOCR: `reanit-api` and `reanit-worker`
   ([`nest.Dockerfile`](../docker/nest.Dockerfile)), `reanit-migrate` ([`migrate.Dockerfile`](../docker/migrate.Dockerfile))
   and `reanit-web:<env>-<sha>` ([`web.Dockerfile`](../docker/web.Dockerfile); per environment, because the browser
   bundle inlines `NEXT_PUBLIC_*`).
2. Copies `compose.yml`, `Caddyfile` and `deploy.sh` to `/opt/reanit` and a 15-minute read-only registry login.
3. Runs [`deploy.sh <sha>`](deploy.sh): pulls, runs `prisma migrate deploy` in the `migrate` container
   (**migrations run in CI, before any new code starts**; a failed migration stops the deploy with the old release
   still serving), then recreates the containers and waits for them to be healthy.

Roll back with `ssh deploy@<host> 'DOCKER_CONFIG=/opt/reanit/.docker /opt/reanit/deploy.sh <older sha>'` (needs a
fresh registry login, so re-running an older Deploy run from GitHub is easier). Migrations are forward-only, so
keep them backward compatible with the release before.

## One-time setup per environment

### 1. DigitalOcean

1. **Container registry** (shared by both environments): `doctl registry create reanit`.
2. **Managed Postgres 17** and **managed Valkey/Redis** in the droplet's region and VPC. Add the droplet as a
   trusted source of both. Set the Redis eviction policy to `noeviction` (BullMQ needs it).
3. **Droplet**: Ubuntu 24.04, same VPC, with [`cloud-init.yml`](cloud-init.yml) as user data (put the deploy key in it).
4. **Cloud firewall** on the droplet: inbound 80 and 443 only from [Cloudflare's ranges](https://www.cloudflare.com/ips/),
   22 from anywhere (key-only; GitHub-hosted runners have no fixed address). Caddy trusts `CF-Connecting-IP`, so
   80/443 must never be open to the internet.

### 2. Cloudflare

1. DNS records, both **proxied**: `A @ → <droplet IP>` and `A * → <droplet IP>`. The free Universal SSL certificate
   covers `example.com` and `*.example.com`, so every school subdomain gets TLS with no per-school step. (A staging
   root of `staging.reanit.com` would put schools two levels deep, which Universal SSL does not cover; that needs
   Advanced Certificate Manager. A separate zone avoids it.)
2. SSL/TLS mode **Full (strict)**, and **Always Use HTTPS** on.
3. **Origin Server → Create certificate** for `example.com, *.example.com`; save it on the droplet as
   `/opt/reanit/certs/origin.pem` and `/opt/reanit/certs/origin-key.pem` (mode 600, owner `deploy`).
4. **R2**: a bucket per environment and an API token for it, then run the bucket CORS setup once from the droplet
   after the first deploy: `docker compose run --rm api node dist/storage-setup.js`.
5. **Custom domains** (optional; the dashboard says they are unavailable until this is done). Schools point a
   domain at the platform with a CNAME, and the API adds each verified one to the zone as a custom hostname, for which
   Cloudflare issues the certificate (the first 100 hostnames are free, then per hostname per month).
   1. **SSL/TLS → Custom Hostnames**: enable Cloudflare for SaaS on the zone.
   2. Add a **proxied** `A customers → <droplet IP>` record and set `customers.example.com` as the **fallback
      origin**; wait until it shows Active. Custom domains CNAME to it. The Origin CA certificate covers it, and
      Caddy answers custom domains with that certificate (`fallback_sni` in the [`Caddyfile`](Caddyfile)).
   3. An API token with **Zone → SSL and Certificates → Edit** on the zone. Set `CLOUDFLARE_API_TOKEN`,
      `CLOUDFLARE_ZONE_ID` and `CUSTOM_DOMAIN_TARGET=customers.example.com` in `api.env`.

### 3. Files on the droplet (`/opt/reanit`, owner `deploy`, mode 600)

| File | Contents |
|---|---|
| `.env` | `REGISTRY=registry.digitalocean.com/reanit`, `DEPLOY_ENV=staging` (or `production`), `ROOT_DOMAIN=<root domain>`. `deploy.sh` adds `IMAGE_TAG`. |
| `api.env` | Every variable in [`apps/api/.env.example`](../../apps/api/.env.example) with production values: managed `DATABASE_URL` (`?sslmode=require&uselibpqcompat=true`, since node-postgres otherwise verifies against a CA it lacks) and `REDIS_URL` (`rediss://`), `APP_URL=https://<root domain>`, the R2 `S3_*` values (no `S3_FORCE_PATH_STYLE`), SMTP, payment keys, the Cloudflare custom domain settings (step 2.5), `DEPLOY_ENV`, `SENTRY_DSN`. Set `TRUST_PROXY_HOPS=2` (Caddy, then web). Never `FAKE_PAYMENTS`. |
| `worker.env` | Every variable in [`apps/worker/.env.example`](../../apps/worker/.env.example), same values as the API. |
| `web.env` | `API_URL=http://api:4000`, `ROOT_DOMAIN=<root domain>`, `OTEL_EXPORTER_OTLP_ENDPOINT` if used. |
| `migrate.env` | `DATABASE_URL`: the managed database's owner connection (`doadmin`, `?sslmode=require`), which creates the `reanit_app` role. |

### 4. GitHub

- Environments `staging` and `production`, each with:
  - variables `REGISTRY`, `DEPLOY_HOST` (droplet IP), and optionally `NEXT_PUBLIC_SENTRY_DSN`,
    `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`;
  - secrets `DIGITALOCEAN_ACCESS_TOKEN` (registry read/write), `DEPLOY_SSH_KEY` (private key for the `deploy`
    user) and `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <droplet IP>`).
- Repository variable `DEPLOY_STAGING=true` once staging is ready; until then CI skips the staging deploy.
