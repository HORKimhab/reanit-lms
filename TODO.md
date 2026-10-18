# TODO: M1 creator to first paid student

Rules: when done, tick it `[x]` in place, never delete or move it · the next task is the first `[ ]` · never reuse an ID · put the ID in the commit message · ⚠ = open decision, ask first.

UI: Teachable-style (white, one brand color per school) + dark mode, ⌘K palette, builder autosave, mobile-first player, branding live preview, KHQR checkout.
i18n: next-intl, `en`/`km`, Kantumruy Pro, locale-aware dates/numbers/currency (USD/KHR). Course content is not translated.

## Foundation
- [x] REPO-01 Monorepo scaffold: turbo, pnpm workspaces, config package, CI. Done when CI passes build + lint.
- [x] WEB-01 apps/web + packages/ui: Next, Tailwind, shadcn, design tokens, dark mode
- [x] WEB-02 i18n: next-intl, en/km, Khmer font, locale switcher, formatters
- [x] WEB-03 Layout shells: school site, student area, dashboard

## UI with mock data
- [x] WEB-04 School home + course sales page (hero, curriculum, instructor, FAQ, buy)
- [x] WEB-05 Student "My courses"
- [x] WEB-06 Lesson player + progress sidebar
- [ ] WEB-07 Dashboard overview + course list
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
