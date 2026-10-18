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
| `project-structure` | Folder map and where new code goes; Claude uses it automatically when it creates or moves files |

### task-runner commands

| Prompt | What happens | Commit |
|---|---|---|
| `init REPO-01` | Builds one task | `feat: init REPO-01` |
| `init REPO-01, WEB-01 to WEB-02` | Builds REPO-01, WEB-01 and WEB-02 in order | One commit: `feat: init REPO-01, WEB-01 to WEB-02` |
| `init WEB-03 onward` | Builds tasks in TODO order, starting at WEB-03, until it stops | One commit per task: `feat: init WEB-03`, … |
| `init WEB-03 onward max 5` | Same, but stops after 5 tasks | One commit per task |
| `init WEB-03 onward until 80%` | Same, but stops at 80% session usage instead of 95% | One commit per task |
| `next task` | Builds the first unticked `- [ ]` task in TODO.md | `feat: init <ID>` |

Add `:sparkles:` to the prompt to get `feat: :sparkles: init …`.

**Behaviour**
- Open dependencies (`Needs <ID>`) are built first and named in the commit.
- Tasks marked ⚠ stop the run and ask for a decision.
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
