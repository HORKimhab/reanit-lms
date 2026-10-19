---
name: project-structure
description: Reanit LMS folder map and where new code belongs. Use when creating/moving files, adding a package, feature, API module, migration or worker job.
---

# Layout

```
apps/web        Next.js: school sites, dashboard, player (calls apps/api)
apps/api        NestJS on Fastify: REST API, one Nest module per domain module
apps/worker     BullMQ jobs: email, webhooks, video, certificates, stats
packages/db     @reanit/db: Prisma schema, migrations, RLS, tenant client
packages/core   @reanit/core: pure domain logic, one folder per module
packages/api-client @reanit/api-client: typed apps/api client from openapi.json (`pnpm openapi` regenerates)
packages/ui     @reanit/ui: shared shadcn components
packages/email  @reanit/email: React Email templates
packages/config @reanit/config: eslint/tsconfig/tailwind presets
infra/          docker-compose (Postgres, Redis, Mailpit)
```

Modules: auth · schools · catalog · commerce · learning · media · notifications · analytics

# Where it goes

| Adding | Place |
|---|---|
| Business rule | `packages/core/<module>/`, no Next/Nest/Prisma/BullMQ imports |
| Table / column / RLS | `packages/db` |
| Page / server action | `apps/web` |
| API endpoint, guard, Nest module | `apps/api/src/<module>/` (controller + module); shared infrastructure in `apps/api/src/<db\|redis\|config\|context\|logging\|http>/`. Request bodies: `class X extends createZodDto(coreSchema) {}`. A new core error gets its status in `apps/api/src/http/problem.ts`. Every route needs a session unless marked `@Public()`; read the user with `@CurrentUser()`. Request state goes through `ClsService<RequestContext>`, never REQUEST-scoped providers |
| Email, webhook, async work | `apps/worker`, triggered by an outbox event |
| Shared component | `packages/ui`. Single-use components stay in `apps/web`. |
| Script | `scripts/`, run with `pnpm tsx` |
| Test | Unit/component: next to the source as `<name>.test.ts(x)`. Integration (real Postgres): `packages/db/test/<name>.int.test.ts`. E2E: `apps/web/e2e/<flow>.spec.ts`. Shared helpers: the package's `src/test/`. Thin pages and layouts get no test; see `task-runner/quality.md` → Tests. |
| Claude skill / command | `.claude/skills/<name>/SKILL.md`. Its `description` lists every prompt form. Document it in README §10. |
| Claude hook / status line | Script in `.claude/hooks/` or `.claude/`, registered in `.claude/settings.json`. Document it in README §10. |

Imports flow `apps → core → db`. Packages never import from apps. Use a module's `index.ts` only, never its internals.

Deps: `pnpm --filter <pkg> add <dep>`. Internal deps use `workspace:*`. Shared versions go in `catalog:`.

Undecided (README §8): video, payment provider, ORM, hosting. Keep these behind an interface in `core`, and ask the user before choosing one.

Adding a feature or migration? Read `checklist.md`. More detail: README §2 architecture, §4 data model, §9 pnpm.
