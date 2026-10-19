# TODO: M1 creator to first paid student

Rules: when done, tick it `[x]` in place, never delete or move it · the next task is the first `[ ]` · never reuse an ID · put the ID in the commit message · ⚠ = open decision, ask first.

UI: Teachable-style (white, one brand color per school) + dark mode, ⌘K palette, builder autosave, mobile-first player, branding live preview, KHQR checkout.
i18n: next-intl, `en`/`km`, Kantumruy Pro, locale-aware dates/numbers/currency (USD/KHR). Course content is not translated.

## Foundation
- [x] REPO-01 Monorepo scaffold: turbo, pnpm workspaces, config package, CI. Done when CI passes build + lint.
- [x] WEB-01 apps/web + packages/ui: Next, Tailwind, shadcn, design tokens, dark mode
- [x] WEB-02 i18n: next-intl, en/km, Khmer font, locale switcher, formatters
- [x] WEB-03 Layout shells: school site, student area, dashboard
- [x] REPO-02 Quality tooling: Vitest + Testing Library, eslint-plugin-jsdoc (every function), knip, jscpd; `test`/`knip`/`dup` scripts in turbo and CI. Done when CI runs all of them.
- [x] TEST-00 Backfill WEB-01 to WEB-06: tests, full JSDoc, remove dead/duplicate code. Done when `pnpm test`, `lint`, `knip`, `dup` pass. Needs REPO-02.

## UI with mock data
- [x] WEB-04 School home + course sales page (hero, curriculum, instructor, FAQ, buy)
- [x] WEB-05 Student "My courses"
- [x] WEB-06 Lesson player + progress sidebar
- [x] WEB-07 Dashboard overview + course list
- [x] WEB-08 Course builder: sections/lessons drag-and-drop, autosave
- [x] WEB-09 Students list + school settings (logo, color, live preview)
- [x] TEST-02 Remove page/layout tests that only re-check composed components (keep `notFound()`/`redirect()`/param branch tests); move any logic left in pages into tested components. Done when `pnpm test`, `lint`, `knip`, `dup` pass.

## Move backend to NestJS (`apps/api`)
Decided (README §8): API-01 to API-03 move from `apps/web` server code to NestJS. Every later API-* and WRK-* task is built in `apps/api`. `packages/core` and `packages/db` stay framework-free and are reused as-is.
- [x] NEST-01 Scaffold `apps/api`: NestJS 12 on the Fastify adapter, SWC build, shared eslint/tsconfig/vitest presets, turbo + CI tasks, `GET /health` (Terminus: Postgres + Redis). Env parsed with zod at boot (fail fast). Update README §2/§6/§9, the `project-structure` skill and README §10. Done when CI builds, lints and tests `apps/api`.
- [x] NEST-02 Platform modules: `DbModule` (one `DbClient` provider, closed on shutdown), request context through `nestjs-cls` (request id, user, school; no REQUEST-scoped providers), `nestjs-pino` logs with request id and redacted cookies/passwords, `helmet`, graceful shutdown. Needs NEST-01.
- [x] NEST-03 Edge validation and errors: global zod pipe using the schemas from `@reanit/core` (no duplicate class-validator DTOs), global exception filter mapping core typed errors to RFC 9457 problem+json (e.g. `EmailTakenError` → 409, `CourseNotFoundError` → 404), unknown errors → 500 without internals. Needs NEST-02.
- [x] NEST-04 OpenAPI + typed client: `@nestjs/swagger` spec from the zod schemas, generated client in `packages/api-client` (openapi-typescript + openapi-fetch), CI fails when the committed spec is stale. Needs NEST-03.
- [x] NEST-05 Auth module: `/auth/sign-up`, `/auth/login`, `/auth/magic-link` (request + verify), `/auth/logout`, `/auth/me` over `@reanit/core/auth`; HttpOnly session cookie; global `SessionGuard` with `@Public()` opt-out and `@CurrentUser()`; CSRF protection on mutating routes (Origin check + SameSite=Lax). Moves `apps/web/src/server/auth`. Needs NEST-04.
- [x] NEST-06 Schools module: `POST /schools`, `GET /schools/by-subdomain/:subdomain`, `RolesGuard` with `@Roles("owner","admin","instructor")` resolving the staff school into the request context. Moves `apps/web/src/server/schools`. Needs NEST-05.
- [x] NEST-07 Catalog module: courses CRUD + `PUT /courses/:id/outline` on the tenant client from the request context; public `GET` of published courses by school. Moves `apps/web/src/server/catalog`. Needs NEST-06.
- [x] NEST-08 Web as API client: same-origin `/api/*` rewrite from Next to `apps/api` (no CORS, one cookie domain); server actions and pages call `packages/api-client`, forwarding the session cookie. Remove `@reanit/db` and the server wiring from `apps/web`, and block re-adding it with an eslint `no-restricted-imports` rule. Done when no `apps/web` file imports `@reanit/db`. Needs NEST-07.
- [x] NEST-09 API e2e tests: supertest against the Nest app + Testcontainers Postgres per module (auth, schools, catalog), including the 401/403/404 paths and a cross-school request that must see nothing. Needs NEST-08.
- [x] NEST-10 Run it: `apps/api` Dockerfile (multi-stage, non-root), compose service for local dev, `pnpm dev` starts web + api. Done when sign-up → create school → create course works through the web app. Needs NEST-09.
- [x] NEST-11 Worker on Nest: `apps/worker` as a Nest standalone app (no HTTP) with `@nestjs/bullmq` (decided over plain BullMQ), sharing the env, database and logging modules with `apps/api` through `packages/nest`; shutdown closes connections. Queues and jobs come with WRK-02 (its first queue is what connects to Redis). Done when the worker boots with BullMQ configured from `REDIS_URL` and stops cleanly.

## Connect to backend
- [x] INFRA-01 docker-compose: Postgres, Redis, Mailpit. Done when all services are healthy.
- [x] DB-01 Prisma core schema, tenant client, RLS. Done when the RLS isolation test passes.
- [x] API-01 Auth: sign-up, login, magic link, sessions
- [x] WEB-10 Login/sign-up screens. Needs API-01.
- [x] API-02 Schools: create school, subdomain middleware
- [x] WEB-11 Create-school onboarding wizard. Needs API-02.
- [x] API-03 Catalog: courses/sections/lessons CRUD
- [x] WEB-12 Connect builder + dashboard course list to the API: list the school's courses, create one, edit title/description/status, delete, outline autosave. Needs API-03. (Sales page split out to WEB-27.)
- [x] WEB-27 School site on the API, then the sales page: resolve the school from its subdomain (default brand color until API-08), sales page from the public catalog. Decided: use what the API has (title, description, curriculum); no price until API-05, instructor block shows the school owner (expose the owner's name from the API), FAQ hidden when empty, no schema change. Needs WEB-12.
- [x] API-04 Media: presigned upload + video. Decided: S3-compatible object storage only for now (R2 in prod, SeaweedFS locally; MinIO no longer publishes free images) behind an `ObjectStorage` port in `@reanit/core`; presigned PUT for uploads, signed GET for playback of plain MP4/PDF; no transcoding yet.
- [x] WEB-13 Video upload in builder. Needs API-04.
- [x] API-05 Checkout + WRK-01 webhook enrollment. Decided: dynamic payment methods — ABA PayWay (KHQR + cards), Bakong KHQR and Stripe behind one `PaymentGateway` port in `@reanit/core/commerce`; a method is offered when its credentials are configured and it supports the course's currency, and the student picks one at checkout. This task: course prices (staff, integer minor units + USD/KHR), the method list on the public course, `POST /checkout` creating a pending order, the Stripe gateway (Checkout Session + signed webhook), and enrollment from a confirmed payment, exactly once (idempotent).
- [x] API-20 ABA PayWay gateway (KHQR + cards): purchase request with its HMAC hash, pushback webhook confirmed through the check-transaction API, enrollment through the same confirmation path. Needs API-05.
- [x] API-21 Bakong KHQR gateway: KHQR made with the official `bakong-khqr` library, payment confirmed by polling Bakong's check-by-md5 API (Bakong has no webhook), enrollment through the same confirmation path. Needs API-05.
- [x] WEB-14 Checkout page: price on the sales page, payment method picker from the course's enabled methods, redirect or KHQR code, then the order's status. Needs API-05.
- [x] API-06 Learning: access check, progress heartbeat
- [x] WEB-15 Connect player. Needs API-06.
- [x] API-07 Dashboard stats (pre-aggregated)
- [x] WEB-16 Connect dashboard. Needs API-07.
- [x] API-08 Students + school settings: list/search students, update logo/color/name
- [x] WEB-17 Connect students list + settings. Needs API-08.

## Ship M1
- [x] WRK-02 Outbox relay + BullMQ worker app, retries, dead-letter queue. Done when a failed job lands in the DLQ.
- [x] API-09 Transactional email: magic link, purchase receipt, welcome to course (packages/email, en/km)
- [x] API-10 Rate limiting on auth and checkout (Redis)
- [x] API-11 Audit log for admin/instructor actions
- [x] WEB-18 Error, empty and loading states; 404/500 pages; SEO meta + OG images for sales page
- [x] TEST-01 Playwright E2E: sign-up → create school → build course → checkout → watch lesson. Done when green in CI.
- [x] OPS-01 Observability: Sentry, OpenTelemetry, PostHog
- [ ] OPS-02 Deploy: staging + prod, wildcard subdomain DNS/TLS, migrations in CI ⚠ hosting
- [ ] OPS-03 Production smoke: first real paid enrollment end to end. Done when M1 is live.

## M2 growth (backlog, refine before starting)
- [x] API-12 Coupons: percent/fixed, expiry, usage limit, applied at checkout
- [x] WEB-19 Coupon management + checkout coupon field. Needs API-12.
- [ ] API-13 Bundles: multiple courses, one price, enroll all on payment
- [ ] WEB-20 Bundle builder + bundle sales page. Needs API-13.
- [ ] API-14 Quizzes: questions, attempts, pass mark
- [ ] WEB-21 Quiz builder + quiz in player. Needs API-14.
- [ ] WRK-03 Certificates: PDF on CourseCompleted, public verify URL
- [ ] WEB-22 Certificate template settings + student download. Needs WRK-03.
- [ ] API-15 Drip content: unlock by days after enrollment or by date
- [ ] WEB-23 Drip settings in builder + locked lessons in player. Needs API-15.
- [ ] API-16 Custom domains: DNS ownership verification, TLS
- [ ] WEB-24 Custom domain settings screen. Needs API-16.
- [ ] API-17 Lesson comments + instructor replies, moderation
- [ ] WEB-25 Comments under lessons + dashboard inbox. Needs API-17.
- [ ] WRK-04 Email notifications: new sale, new comment, course completed, preferences + unsubscribe
- [ ] API-18 Sales analytics: revenue by day/course/currency, refunds, completion funnel
- [ ] WEB-26 Analytics dashboard. Needs API-18.
- [ ] API-19 GDPR: student data export and account deletion
- [ ] API-22 Refunds: staff refund a paid order through its gateway, order → `refunded`, enrollment revoked, daily sales reversed, `OrderRefunded` event, audited
- [ ] WEB-28 Refund button on the order detail + refunded state for the student. Needs API-22, WEB-29.
- [ ] WRK-05 Order expiry: pending orders past their gateway's window are marked `failed` (KHQR expiry, abandoned card/PayWay sessions); gateway `failed` checks mark them too
- [ ] API-23 Order history: student's own orders and receipts; staff list of the school's orders with filters (status, course, date, currency)
- [ ] WEB-29 Student "Purchases" page + dashboard orders list and order detail. Needs API-23.
- [ ] API-24 Team: invite admins/instructors by email, accept invite, change role, remove member; owner can't be removed; audited
- [ ] WEB-30 Team settings screen + invite acceptance page. Needs API-24.
- [ ] API-25 Subscriptions and payment plans: recurring and instalment prices, renewal via gateway, access ends on lapse ⚠ which gateways support recurring

## M3 platform (backlog, refine before starting)
- [ ] API-26 Creator plans: Free / Pro / Business with a per-sale transaction fee, plan limits enforced ⚠ pricing + billing provider
- [ ] API-27 Payouts to creators: balance ledger from paid orders minus fees and refunds, payout schedule ⚠ payout provider (Stripe Connect / bank transfer)
- [ ] WEB-31 Platform admin console: schools, plans, moderation, payouts. Needs API-26, API-27.
