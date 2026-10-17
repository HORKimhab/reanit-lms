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
              │  API layer     │  │  Background workers │
              │  (route        │  │  (BullMQ)           │
              │  handlers /    │  │  email, video jobs, │
              │  tRPC)         │  │  certificates,      │
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

1. **Modular monolith first.** All code lives in one TypeScript codebase with strict module boundaries: `auth`, `schools`, `catalog`, `commerce`, `learning`, `media`, `notifications`, `analytics`. A module becomes its own service only when load or team size forces it.
2. **Multi-tenancy.** All schools share one Postgres database, and every tenant table carries a `school_id`. Isolation is enforced by **Postgres Row-Level Security** and a tenant-scoped data-access layer. Middleware works out the tenant from the subdomain or custom domain, and that lookup is cached in Redis. Very large tenants can be moved to separate shards later.
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
| API | Next.js route handlers / tRPC, with NestJS as an option if the API splits out | Type-safe client–server calls |
| Database | PostgreSQL + Prisma | Relational data, RLS, mature tooling |
| Cache / queue | Redis + BullMQ | Background jobs, rate limiting, caching |
| Auth | Better Auth or Auth.js (email/password, Google, magic link) | Supports tenant-aware student accounts |
| Video | Mux or Cloudflare Stream | HLS, signed playback, viewing analytics |
| Files | S3 / Cloudflare R2 with presigned uploads | Cheap storage; uploads go straight from the browser |
| Payments | Stripe, Stripe Connect, Stripe Tax | Payouts, subscriptions, VAT |
| Email | Resend or AWS SES, with React Email templates | Transactional and marketing email |
| Search | Postgres full-text search, moving to Meilisearch later | Course discovery |
| Observability | Sentry, OpenTelemetry, PostHog | Errors, traces, product analytics |
| Infra | Docker. Web on Vercel, workers on Fly/Railway/ECS, or everything on AWS with Terraform | Start simple without closing off a migration path |
| CI/CD | GitHub Actions: lint, typecheck, test, preview deploys | |

---

## 4. Data model

```
User ─┬─< Membership >─ School ──< Domain
      │                   │
      │                   ├──< Course ──< Section ──< Lesson ──< Attachment
      │                   │       │                      │
      │                   │       ├──< Price  (one-time | subscription | payment plan)
      │                   │       ├──< Coupon
      │                   │       └──< Quiz ──< Question
      │                   ├──< Bundle >──< Course
      │                   └──< Order ──< OrderItem
      │
      ├──< Enrollment      (user, course, source, expires_at)
      ├──< LessonProgress  (enrollment, lesson, completed_at, video_position)
      ├──< QuizAttempt
      ├──< Certificate
      └──< Comment         (lesson, parent_id)
```

- Every tenant-owned table has a `school_id` column with an RLS policy on it.
- `Membership.role` is one of `owner | admin | instructor | student`.
- Prices are stored as integer minor units (cents) together with an ISO currency code.

---

## 5. Scaling, security and quality

**Performance**
- App servers keep no state and scale horizontally behind a load balancer.
- A read replica serves dashboards and analytics. Dashboards read from **pre-aggregated stats tables** (daily sales, completions) instead of counting live rows.
- The player sends a video-progress heartbeat about every 15 s. These writes are buffered in Redis and flushed to Postgres in batches.

**Reliability**
- Payment and enrollment operations use idempotency keys.
- Events are published through the outbox pattern, with retries and a dead-letter queue for failed jobs.

**Security**
- Row-Level Security on all tenant tables, signed video URLs, and rate limiting on auth and checkout.
- An audit log of admin and instructor actions.
- GDPR data export and deletion.
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
│  └─ worker/       # BullMQ consumers: email, webhooks, certificates, stats
├─ packages/
│  ├─ db/           # Prisma schema, migrations, tenant-scoped client
│  ├─ core/         # Framework-free domain logic (commerce, learning, schools)
│  ├─ ui/           # Shared UI components (shadcn)
│  ├─ email/        # React Email templates
│  └─ config/       # Shared eslint, tsconfig and tailwind presets
├─ infra/           # docker-compose (Postgres, Redis, Mailpit); Terraform later
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
| 1 | 🟡 Backend framework | Next.js route handlers / tRPC · NestJS · Laravel · Go · Django | Current default: TypeScript with Next.js |
| 2 | 🟡 Video provider | Mux · Cloudflare Stream | Mux has the better developer experience; Cloudflare is cheaper at scale |
| 3 | 🟡 Payment providers | Stripe Connect · ABA PayWay / KHQR · PayPal | Stripe payouts may not be available in Cambodia, so a local gateway may be needed |
| 4 | 🟡 Hosting | Vercel + Fly/Railway · AWS (ECS + RDS) | Start on managed hosting and move to AWS as cost and scale require |
| 5 | 🟡 ORM | Prisma · Drizzle | Prisma is the default; Drizzle gives finer control over RLS and SQL |
| 6 | ✅ Package manager / runtime | **Decided:** pnpm + Node.js 24 LTS | Chosen over Bun for strict dependencies and maturity. See [pnpm usage](#pnpm-usage) |

---

## 9. Local development

_Not set up yet; this section will be filled in by Milestone 1._ The planned flow:

```bash
corepack enable          # one-time: provides the pinned pnpm version
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

### pnpm usage

**Do**
- Pin pnpm in the root `package.json` (`"packageManager": "pnpm@10.x.y"`) and get it through **Corepack** (`corepack enable`), so everyone and CI use the same version.
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

## License

See [LICENSE](LICENSE).
