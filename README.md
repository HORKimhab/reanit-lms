# Reanit LMS

A multi-tenant online course platform, similar to Teachable. Creators open their own branded **school**, build courses, and sell them to students. The platform takes a fee on each sale.

> **Status:** planning. This README is the working design doc. Sections marked **🟡 Open decision** have not been settled yet.

---

## Table of contents

1. [Product scope](#1-product-scope)
2. [Architecture](#2-architecture)
3. [Tech stack](#3-tech-stack)
4. [Data model](#4-data-model)
5. [Scaling, security and quality](#5-scaling-security-and-quality)
6. [Repository layout](#6-repository-layout)
7. [Roadmap](#7-roadmap)
8. [Open decisions](#8-open-decisions)
9. [Local development](#9-local-development)
10. [Working with Claude Code](#10-working-with-claude-code)

---

## 1. Product scope

### Roles

| Role | What they do |
|---|---|
| **Platform admin** | Manages schools, creator billing plans, moderation and payouts |
| **School owner / instructor** | Builds courses, sets prices, manages students, views sales |
| **Student** | Buys courses, watches lessons, takes quizzes, earns certificates |

### Features by phase

| Phase | Features |
|---|---|
| **MVP** | Sign-up and login · create a school on a subdomain · course builder (sections → lessons with video, text and PDF) · public course sales page · checkout · student player with progress tracking · instructor dashboard |
| **v1: Growth** | Custom domains · coupons · bundles · subscriptions and payment plans · quizzes · certificates · drip content · lesson comments · email notifications · sales analytics |
| **v2: Scale** | Affiliates · coaching and 1:1 booking · digital downloads · communities · page builder for the school site · mobile app · AI features (auto-captions, quiz generation, course outline assistant) · white-label |
| **Platform** | Creator subscription tiers (Free / Pro / Business, each with a transaction fee) · payouts to creators · tax/VAT handling · admin console |

---

## 2. Architecture

```
                 ┌─────────── CDN (Cloudflare) ───────────┐
 *.reanit.com    │  custom domains → tenant resolver      │
 school.com ───► │  static assets, HLS video segments     │
                 └──────────────┬─────────────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │  Next.js web app (stateless)   │  school sites, student player,
                │  SSR/ISR for sales pages       │  creator dashboard
                └───────┬───────────────┬────────┘
                        │               │
              ┌─────────▼──────┐  ┌─────▼───────────────┐
              │  NestJS API    │  │  Background workers │
              │  (apps/api,    │  │  (BullMQ)           │
              │  Fastify,      │  │  email, video jobs, │
              │  REST)         │  │  certificates,      │
              └──┬────┬────┬───┘  │  webhooks, stats    │
                 │    │    │      └──────────┬──────────┘
        ┌────────▼┐ ┌─▼────┐ ┌▼──────────┐   │
        │Postgres │ │Redis │ │ S3 / R2   │◄──┘
        │primary +│ │cache,│ │ uploads   │
        │replica  │ │queue,│ └─────┬─────┘
        └─────────┘ │rate  │       │
                    │limit │  ┌────▼───────────────────┐
                    └──────┘  │ Video: Mux / Cloudflare│
                              │ Stream (transcode, HLS,│
                              │ signed playback)       │
                              └────────────────────────┘
  External services: Stripe (+ Connect), Resend / SES, PostHog, Sentry
```

### Key decisions

1. **Modular monolith first.** All code lives in one TypeScript codebase with strict module boundaries: `auth`, `schools`, `catalog`, `commerce`, `learning`, `media`, `notifications`, `analytics`. Domain logic sits in `packages/core` and data access in `packages/db`; the NestJS API (`apps/api`) exposes them over HTTP with one Nest module per domain module, and the web app is a client of that API. A module becomes its own service only when load or team size forces it.
2. **Multi-tenancy.** All schools share one Postgres database, and every tenant table carries a `school_id`. Isolation is enforced by **Postgres Row-Level Security** and a tenant-scoped data-access layer. Middleware works out the tenant from the subdomain or custom domain; custom domain lookups go through the API and are cached for a minute in the web app. Very large tenants can be moved to separate shards later.
3. **Video is outsourced.** Mux or Cloudflare Stream handles upload, transcoding, adaptive HLS and signed playback URLs, so only enrolled students can stream.
4. **Payments run through Stripe Connect.** Each creator is a connected account and the platform takes an application fee. Webhooks are processed idempotently through a queue. A student is enrolled **only when a confirmed webhook arrives**, never on the client-side redirect.
5. **Cache public pages; keep learning dynamic.** Sales pages and school home pages use ISR behind a CDN, since that is where most traffic lands. The student area and dashboard are rendered dynamically.
6. **Side effects are event-driven.** Domain events (`OrderPaid`, `LessonCompleted`, `CourseCompleted`) are written through an outbox and handled by workers. Workers take care of enrollment, email, certificates, analytics and affiliate commissions, which keeps request handling fast.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript end to end | One language and shared types |
| Monorepo | Turborepo + pnpm workspaces | Apps and packages share code and build caching; strict dependency rules |
| Runtime | Node.js 24 LTS (development and production) | The runtime Next.js, NestJS and the main libraries are built and tested on |
| Web | Next.js (App Router), Tailwind, shadcn/ui | SSR for sales-page SEO; fast UI development |
| API | NestJS on Fastify (`apps/api`), OpenAPI spec + generated typed client | One API for web, mobile and partners; modules, DI and guards that scale with the team |
| Database | PostgreSQL + Prisma | Relational data, RLS, mature tooling |
| Cache / queue | Redis + BullMQ | Background jobs, rate limiting, caching |
| Auth | Better Auth or Auth.js (email/password, Google, magic link) | Supports tenant-aware student accounts |
| Video | S3-compatible storage now (R2), Mux or Cloudflare Stream later | Signed playback today; HLS and viewing analytics come with a video provider |
| Files | S3 / Cloudflare R2 with presigned uploads | Cheap storage; uploads go straight from the browser |
| Payments | Stripe, Stripe Connect, Stripe Tax | Payouts, subscriptions, VAT |
| Email | Resend or AWS SES, with React Email templates | Transactional and marketing email |
| Search | Postgres full-text search, moving to Meilisearch later | Course discovery |
| Observability | Sentry, OpenTelemetry, PostHog | Errors, traces, product analytics |
| Infra | Docker images on DigitalOcean droplets (staging + prod) behind Cloudflare; managed Postgres and Redis | Start simple; the same images can move to managed containers or AWS later |
| CI/CD | GitHub Actions: lint, typecheck, test, preview deploys | |

---

## 4. Data model

```
User ─┬─< Membership >─ School ──o Domain  (one custom domain per school, served once a TXT record verifies it)
      │                   │
      │                   ├──< Course ──< Section ──< Lesson ──< Attachment
      │                   │       │                      │
      │                   │       ├──< Price  (one-time | subscription | payment plan)
      │                   │       ├──< Coupon
      │                   │       └──< Quiz ──< Question
      │                   ├──< Bundle >──< Course
      │                   ├──o CertificateTemplate  (who signs its certificates)
      │                   └──< Order ──< OrderItem
      │
      ├──< Enrollment      (user, course, source, expires_at)
      ├──< LessonProgress  (enrollment, lesson, completed_at, video_position)
      ├──< QuizAttempt
      ├──< Certificate     (one per completed enrollment: name + title as issued, pdf_key; its id is the verify code)
      ├──< Comment         (lesson, parent_id)
      └──< NotificationPreference  (per school: which staff emails, their language, the unsubscribe token)
```

- Every tenant-owned table has a `school_id` column with an RLS policy on it.
- `Membership.role` is one of `owner | admin | instructor | student`. Owners and admins invite admins and instructors by email (`TeamInvite`, 7-day link, only the token hash stored); the invitee accepts signed in with that email. The owner can't be removed or re-roled.
- Prices are stored as integer minor units (cents) together with an ISO currency code.

---

## 5. Scaling, security and quality

**Performance**
- App servers keep no state and scale horizontally behind a load balancer.
- A read replica serves dashboards and analytics. Dashboards read from **pre-aggregated stats tables** (daily sales, completions) instead of counting live rows.
- The player sends a video-progress heartbeat about every 15 s. These writes are buffered in Redis and flushed to Postgres in batches.

**Reliability**
- Payment and enrollment operations use idempotency keys.
- Pending orders past their gateway's payment window (KHQR 15 minutes, Stripe and PayWay 24 hours, offline QR 7 days, plus an hour) are failed by a worker sweep; a gateway that still confirms one later enrolls the student.
- Subscriptions and payment plans (API-25) bill one order per period, with no saved cards: each period is paid by the school's own payment QR image (the default; the student gives their transaction reference and staff confirm or reject it, audited) or by a dynamic Bakong KHQR or ABA PayWay payment. Stripe stays one-time only. A confirmed period extends the enrollment to the period's end plus a 7-day grace; a payment plan's last instalment keeps the course for good. Staff confirmations go through the same idempotent confirmation as gateway webhooks.
- An hourly worker sweep (WRK-06) emails students a link to pay 3 days before a period ends and again on the grace period's last day, once per period each, and marks unpaid subscriptions `lapsed` once the grace passes (`SubscriptionLapsed`). Each email goes through the outbox, so it is retried on its own and never sent twice; a renewal paid meanwhile makes it stale and nothing is sent.
- Creator plans (API-26): Free (10% fee per sale, 3 published courses, no team, no custom domain, no offline QR), Pro ($29 a month or $290 a year, 5%) and Business ($99 a month or $990 a year, 2%). Each order records the platform's fee at the school's plan when it was placed; payouts settle it (API-27). Creators pay the platform period by period through KHQR or PayWay, confirmed like students' payments; an unpaid plan falls back to Free a week after its period ends. Limits only block additions: nothing published or added is removed on a downgrade.
- Payouts (API-27) are manual bank or Bakong transfers (Stripe Connect does not serve Cambodia). A school's balance per currency comes from its orders: gateway sales less the platform fee, payable 7 days after payment; its own QR sales owe only the fee; gateway refunds take the sale back. Payouts are due monthly on the 1st from $10 / 40,000 KHR. Owners save where payouts go; platform admins (`PLATFORM_ADMIN_EMAILS`) list the payouts due and record each transfer, never above the available balance, in the school's audit log. Owners and admins see the balances, next payout and payout history at `/dashboard/payouts` (WEB-34); only the owner edits the payout details.
- Platform admin console (API-28, WEB-31) at `/admin`, for the emails in `PLATFORM_ADMIN_EMAILS` (a 404 for anyone else): every school with its owner, plan in force and status; suspending a school with a reason (its site, catalog, checkout and player answer 404, its staff keep the dashboard) and bringing it back; plan payments made to the platform's own QR (`PLATFORM_PAYMENT_QR_URL`; the owner sends the transfer's reference) to confirm or reject; and the payouts due with recording each transfer. Every change goes in the school's audit log.
- Events are published through the outbox pattern, with retries and a dead-letter queue for failed jobs. Each handler of an event runs as its own job, so one failing never repeats another (a staff email never resends a receipt).

**Observability**
- Sentry gets the errors nobody expected: API 500s, dead-lettered worker jobs, and server and browser errors in the web app. Each is tagged with its OpenTelemetry trace id.
- OpenTelemetry traces go to any OTLP collector. The API and worker preload `dist/instrument.js` (`node --import`) to trace HTTP, Redis and pino, and pino log lines carry the `trace_id`. The web app exports the spans Next.js emits.
- PostHog records pageviews in the browser, with visitors kept anonymous.
- Each is off until its variable is set (`SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `NEXT_PUBLIC_POSTHOG_KEY`; see the `.env.example` files).

**Security**
- Row-Level Security on all tenant tables, signed video URLs, and rate limiting on auth and checkout.
- An audit log of admin and instructor actions.
- GDPR data export (`GET /me/data-export`) and deletion (`DELETE /me`). Deleting erases the person (learning, comments' authorship, settings, sessions, certificate PDFs) but keeps the account's id on paid orders, which schools need for their accounts; staff leave their schools' teams first.
- A custom domain is served only after its DNS ownership is verified.

**Testing**
- Unit tests for domain logic in `packages/core`.
- Integration tests run against a real Postgres (Testcontainers).
- Playwright end-to-end tests cover sign-up, course creation, checkout and the player.

---

## 6. Repository layout

```
reanit-lms/
├─ apps/
│  ├─ web/          # Next.js: marketing site, school sites, dashboard, player
│  ├─ api/          # NestJS (Fastify): REST API over packages/core and packages/db
│  └─ worker/       # Nest standalone app + @nestjs/bullmq: email, webhooks, certificates, stats
├─ packages/
│  ├─ db/           # Prisma schema, migrations, tenant-scoped client
│  ├─ core/         # Framework-free domain logic (commerce, learning, schools)
│  ├─ nest/         # Nest modules apps/api and apps/worker share: env, database, logging, mail, object storage
│  ├─ api-client/   # Typed client for apps/api, generated from the committed openapi.json
│  ├─ ui/           # Shared UI components (shadcn)
│  ├─ email/        # React Email templates, and the certificate PDF's wording (en/km)
│  └─ config/       # Shared eslint, tsconfig and tailwind presets
├─ infra/           # docker-compose for local services; docker/ images; deploy/ staging + prod (DigitalOcean + Cloudflare)
└─ .github/workflows/
```

---

## 7. Roadmap

### Milestone 1: creator to first paid student

Each step is complete when it works end to end.

- [ ] Monorepo scaffold (Turborepo + pnpm workspaces), shared configs, CI pipeline
- [ ] `infra/docker-compose.yml` with Postgres, Redis and Mailpit
- [ ] Prisma schema for the core model and a tenant-scoped client with RLS
- [ ] Auth, school creation and subdomain routing
- [ ] Course builder: sections and lessons, drag-and-drop ordering, video upload
- [ ] Public course sales page
- [ ] Checkout, with enrollment granted from the webhook
- [ ] Student player with progress tracking
- [ ] Instructor dashboard: students, sales, completion rate

### Milestone 2: growth features

Coupons, bundles, quizzes, certificates, drip content, custom domains, email notifications.

### Milestone 3: scale features

Subscriptions and payment plans, affiliates, communities, page builder, analytics, mobile app, AI features.

---

## 8. Open decisions

| # | Question | Options | Notes |
|---|---|---|---|
| 1 | ✅ Backend framework | **Decided:** NestJS (`apps/api`) | Chosen to give mobile and third-party clients one API, and a structure (modules, DI, guards) that scales with the team. `apps/web` becomes an API client. Migration: TODO.md NEST-01 to NEST-10 |
| 2 | ✅ Video provider | **Decided for now:** S3-compatible object storage (R2 in production, SeaweedFS locally) | Presigned uploads and signed MP4/PDF playback behind the `ObjectStorage` port in `@reanit/core/media`; no transcoding yet. Mux or Cloudflare Stream can replace it later behind the same port |
| 3 | ✅ Payment providers | **Decided:** ABA PayWay (KHQR + cards), Bakong KHQR and Stripe, chosen by the student at checkout | One `PaymentGateway` port in `@reanit/core/commerce`; a method is offered when its credentials are set and it takes the course's currency. Enrollment comes only from the gateway's confirmation, once. Refunds go through Stripe's API; KHQR has no refund API and PayWay's needs an extra key, so staff pay those students back by hand and then confirm the refund (API-22). Stripe: API-05; PayWay: API-20; Bakong: API-21 |
| 4 | ✅ Hosting | **Decided:** DigitalOcean droplets (Docker Compose, managed Postgres + Redis, DOCR) behind Cloudflare (DNS, wildcard TLS); files on R2 | One droplet each for staging and production; CI builds the images, migrates, then deploys. Runbook: [infra/deploy/README.md](infra/deploy/README.md) |
| 5 | 🟡 ORM | Prisma · Drizzle | Prisma is the default; Drizzle gives finer control over RLS and SQL |
| 6 | ✅ Package manager / runtime | **Decided:** pnpm + Node.js 24 LTS | Chosen over Bun for strict dependencies and maturity. See [pnpm usage](#pnpm-usage) |
| 7 | ✅ Custom domain TLS | **Decided:** Cloudflare for SaaS (custom hostnames) | Keeps every request behind Cloudflare, so the droplet firewall and Caddy's Origin CA setup stay as they are. Schools prove ownership with a TXT record, then CNAME to the fallback origin; behind the `DomainCertificates` port in `@reanit/core/schools`. API-16 |

---

## 9. Local development

```bash
corepack enable          # one-time: provides the pinned pnpm version
pnpm install
docker compose -f infra/docker-compose.yml up -d --wait   # Postgres, Redis, Mailpit, S3 storage
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm storage:setup         # media bucket + CORS for browser uploads (also run once against R2 per environment)
pnpm dev                 # web on http://localhost:3000, API on http://localhost:4000
curl localhost:4000/health
```

- Mailpit's inbox (magic-link emails) is at http://localhost:8025.
- Lesson videos and PDFs go to the local S3 store (SeaweedFS) on http://localhost:8333; `pnpm storage:setup` creates the `reanit-media` bucket and lets `APP_URL` upload to it.
- The browser reaches the API through the web app: Next rewrites `/api/*` to `API_URL`, so there is one origin and one cookie.
- To run the API as its production image instead of `pnpm dev`'s: `docker compose -f infra/docker-compose.yml --profile api up -d --build --wait` (multi-stage `infra/docker/nest.Dockerfile`, runs as `node`). Stop `pnpm dev`'s API first; both use port 4000.
- Schools are served on subdomains of `ROOT_DOMAIN`, e.g. http://angkor.localhost:3000.
- If something else already uses port 5432, start Postgres on another port (`POSTGRES_PORT=5433 docker compose …`) and change `5432` in `packages/db/.env` and `apps/api/.env` to match.
- Tests start their own Postgres with Testcontainers, so Docker must be running for `pnpm test`.
- End-to-end tests (Playwright, `apps/web/e2e/`): with the compose services up, migrated and `pnpm storage:setup` done, run `pnpm build`, then `pnpm e2e` (first time: `pnpm --filter web exec playwright install chromium`). It starts the built API and web app on ports 4000 and 3000, so stop `pnpm dev` first. The API runs with `FAKE_PAYMENTS=true`: card checkout pays at once, through the same confirmation that enrolls real payments. The API refuses that flag unless `APP_URL` is a localhost address.
- After changing an API route or DTO, run `pnpm openapi`: it rewrites `packages/api-client/openapi.json` and the client types. `pnpm test` fails while the committed spec is stale.

### pnpm usage

**Do**
- Pin pnpm in the root `package.json` (`"packageManager": "pnpm@12.14.0"`) and get it through **Corepack** (`corepack enable`), so everyone and CI use the same version.
- Pin Node with `.nvmrc` and `engines.node` (`>=24`).
- Commit `pnpm-lock.yaml`. CI installs with `pnpm install --frozen-lockfile`.
- Define workspaces in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) and reference internal packages as `"@reanit/core": "workspace:*"`.
- Use **catalogs** in `pnpm-workspace.yaml` to keep shared dependency versions (React, Next.js, TypeScript, Prisma) the same across all packages.
- Use filters to work on one package: `pnpm --filter web dev`, `pnpm --filter @reanit/db db:migrate`.
- Add each dependency to the package that uses it (`pnpm --filter web add zod`). Only tooling goes in the root (`pnpm add -Dw turbo`).
- Use `pnpm dlx` for one-off CLIs, and `tsx` to run TypeScript scripts (`pnpm tsx scripts/seed.ts`).
- Approve packages that need install scripts (Prisma, esbuild, sharp) in `onlyBuiltDependencies`.
- Cache the pnpm store in CI (`pnpm/action-setup` + `actions/setup-node` with `cache: pnpm`).

**Avoid**
- `shamefully-hoist=true` or `node-linker=hoisted`. These turn off pnpm's strict rules and hide missing dependencies.
- Importing a package without declaring it in that package's own `package.json`.
- Mixing package managers. Keep no `package-lock.json`, `yarn.lock` or `bun.lock` in the repo.

---

## 10. Working with Claude Code

Work is tracked in [TODO.md](TODO.md). Each task has an ID such as `REPO-01`, `WEB-03` or `API-01`. The project rules are in [CLAUDE.md](CLAUDE.md), and Claude loads them on every task.

### Skills

| Skill | Purpose |
|---|---|
| `task-runner` | Builds TODO tasks by ID to the rules in [`quality.md`](.claude/skills/task-runner/quality.md), refactors the diff, verifies, updates TODO.md and commits |
| `project-structure` | Folder map (web, api, worker, packages) and where new code goes, including Nest modules; Claude uses it automatically when it creates or moves files |

### task-runner commands

| Prompt | What happens | Commit |
|---|---|---|
| `init REPO-01` | Builds one task | `feat: init REPO-01` |
| `init REPO-01, WEB-01 to WEB-02` | Builds REPO-01, WEB-01 and WEB-02 in order | One commit: `feat: init REPO-01, WEB-01 to WEB-02` |
| `init WEB-03 onward` | Builds tasks in TODO order, starting at WEB-03, until it stops | One commit per task: `feat: init WEB-03`, … |
| `init WEB-03 onward max 5` | Same, but stops after 5 tasks | One commit per task |
| `init WEB-03 onward until 80%` | Same, but stops at 80% session usage instead of 95% | One commit per task |
| `next task` | Builds the first unticked `- [ ]` task in TODO.md, skipping `(Future)` tasks | `feat: init <ID>` |

Add `:sparkles:` to the prompt to get `feat: :sparkles: init …`.

**Behaviour**
- Open dependencies (`Needs <ID>`) are built first and named in the commit.
- Tasks marked ⚠ stop the run and ask for a decision.
- Tasks tagged `(Future)` after the ID are deferred: `next task` and onward runs skip them, and `init <ID>` still builds one. Remove the tag to put it back in line.
- Every task follows [`quality.md`](.claude/skills/task-runner/quality.md): reuse before writing, design patterns that fit the layer, no duplicate or dead code, full JSDoc on every function, and tests for every behaviour it adds.
- Tests cover each task's behaviour, not every file: logic, hooks and interactive components always get tests, while a thin `page.tsx`/`layout.tsx` gets none (only its own `notFound()`/`redirect()` branches do) and user flows get E2E. Unit and component tests sit next to the source (`<name>.test.ts(x)`), integration tests go in `packages/db/test/`, E2E tests in `apps/web/e2e/`, and shared helpers in each package's `src/test/`. Claude runs the touched package's tests while building and checks that every new test fails when its behaviour breaks.
- After building, Claude refactors the task's own diff against those rules. It fixes problems rather than just listing them.
- Build, lint, typecheck, test, knip (dead code) and jscpd (duplicate code) must pass. If they don't, nothing is committed and Claude reports the error. Tests and lint rules are never weakened to make a check pass.
- Finished tasks are ticked `- [x]` in place in TODO.md, never deleted or moved, so TODO.md shows both done and open work. History: `git log --grep WEB-03`.
- An onward run commits after every task, so if it stops for any reason, all finished work is already saved. Continue with `next task`.
- If a run was cut off mid-task, the next run finds the uncommitted work and asks whether to continue or discard it.

### Stopping an onward run

| Stop | How |
|---|---|
| Manual | Create an empty `.claude/STOP` file. The run stops after the current task's commit. |
| Session usage | It doesn't start a new task at 90% or more (P−5), and the usage-guard hook stops it mid-task at 95% (P). |
| Count | `max N` |
| Decision | It reaches a ⚠ task. |

How usage is read: [`.claude/statusline.sh`](.claude/statusline.sh) shows `session X% · ctx Y%` and saves the session % to `.claude/usage.json`. The PreToolUse hook [`.claude/hooks/usage-guard.sh`](.claude/hooks/usage-guard.sh) reads that file only while `.claude/run.lock` exists, so normal chats are never blocked. If the status line doesn't run (for example in an IDE extension) or the data is more than 10 minutes old, the usage check is skipped and the other stops still apply. `usage.json`, `run.lock` and `STOP` are gitignored.

## License

See [LICENSE](LICENSE).
