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
- [ ] WEB-08 Course builder: sections/lessons drag-and-drop, autosave
- [ ] WEB-09 Students list + school settings (logo, color, live preview)

## Connect to backend
- [ ] INFRA-01 docker-compose: Postgres, Redis, Mailpit. Done when all services are healthy.
- [ ] DB-01 Prisma core schema, tenant client, RLS. Done when the RLS isolation test passes.
- [ ] API-01 Auth: sign-up, login, magic link, sessions
- [ ] WEB-10 Login/sign-up screens. Needs API-01.
- [ ] API-02 Schools: create school, subdomain middleware
- [ ] WEB-11 Create-school onboarding wizard. Needs API-02.
- [ ] API-03 Catalog: courses/sections/lessons CRUD
- [ ] WEB-12 Connect builder + sales page. Needs API-03.
- [ ] API-04 Media: presigned upload + video ⚠ video provider
- [ ] WEB-13 Video upload in builder. Needs API-04.
- [ ] API-05 Checkout + WRK-01 webhook enrollment ⚠ payment provider
- [ ] WEB-14 Checkout page. Needs API-05.
- [ ] API-06 Learning: access check, progress heartbeat
- [ ] WEB-15 Connect player. Needs API-06.
- [ ] API-07 Dashboard stats (pre-aggregated)
- [ ] WEB-16 Connect dashboard. Needs API-07.
- [ ] API-08 Students + school settings: list/search students, update logo/color/name
- [ ] WEB-17 Connect students list + settings. Needs API-08.

## Ship M1
- [ ] WRK-02 Outbox relay + BullMQ worker app, retries, dead-letter queue. Done when a failed job lands in the DLQ.
- [ ] API-09 Transactional email: magic link, purchase receipt, welcome to course (packages/email, en/km)
- [ ] API-10 Rate limiting on auth and checkout (Redis)
- [ ] API-11 Audit log for admin/instructor actions
- [ ] WEB-18 Error, empty and loading states; 404/500 pages; SEO meta + OG images for sales page
- [ ] TEST-01 Playwright E2E: sign-up → create school → build course → checkout → watch lesson. Done when green in CI.
- [ ] OPS-01 Observability: Sentry, OpenTelemetry, PostHog
- [ ] OPS-02 Deploy: staging + prod, wildcard subdomain DNS/TLS, migrations in CI ⚠ hosting
- [ ] OPS-03 Production smoke: first real paid enrollment end to end. Done when M1 is live.

## M2 growth (backlog, refine before starting)
- [ ] API-12 Coupons: percent/fixed, expiry, usage limit, applied at checkout
- [ ] WEB-19 Coupon management + checkout coupon field. Needs API-12.
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
