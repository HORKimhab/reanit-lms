# Quality rules

Every task's code must follow every rule here before it is committed. Lint, `pnpm test`, `pnpm knip` and `pnpm dup` enforce most of them. The rest are checked in step 4 (Refactor).

# Design
- **Reuse before writing.** Search `packages/ui`, `packages/core` and the app for an existing helper, component, hook or type before adding one. Extend it instead of creating a near-copy.
- **Put code where it belongs** (see `project-structure`). Business rules go in `packages/core`, which is pure and has no Next/Prisma/BullMQ imports. Data access goes only through the tenant client. Side effects go out as outbox events to the worker.
- **Single responsibility.** One reason to change per function, component and module. Split anything that both fetches and renders, or both validates and saves.
- **Depend on interfaces at boundaries.** Payment, video, email, storage and clock go behind an interface in `core`, which gets injected and faked in tests. Never call a vendor SDK from domain logic.
- **Pure where possible.** Compute in pure functions and keep I/O at the edges. Return values instead of mutating arguments.
- **Server first (Next.js).** Server Components by default, `"use client"` only for interactivity, and push it as far down the tree as possible.
- **Validate at the edge.** Parse every request body, form, webhook and env var with a schema (zod) and use the typed result after that.
- **Errors.** Throw typed errors from `core`, map them to HTTP/UI responses in `apps`. Never swallow an error or catch just to log it.
- **No premature patterns.** Add an abstraction only when a second real use exists. Three similar lines are better than a wrong abstraction.

# Clean code
- No dead code: no unused exports, files, deps, params or variables, no commented-out code, no unreachable branches. Delete instead of keeping "just in case".
- No duplicate code: a block repeated twice becomes a shared function or component.
- No `any`, no non-null `!` without a comment saying why it's safe, no `@ts-ignore`. Use `@ts-expect-error` with a reason only when unavoidable.
- No `eslint-disable` without a reason on the same line.
- No `console.log`, no leftover `TODO`/`FIXME` (add a TODO.md task instead), no magic numbers or strings (use named constants).
- Names say what something is or does. Booleans read as `is`/`has`/`can`. No abbreviations except well-known ones (`id`, `url`).
- UI text comes from `messages/en.json` + `km.json`, never hardcoded. Dates, numbers and money go through the locale formatters.
- UI is accessible: semantic elements, labels on inputs, alt text, keyboard reachable, visible focus.

# JSDoc
Every function gets a full JSDoc block, exported or internal: declarations, arrow functions and function expressions assigned to a name, class methods, React components, hooks, server actions and route handlers. The only exception is an anonymous inline callback passed straight to another call, such as `.map((lesson) => lesson.id)`.

Each block has:
- A one-line summary of what it does and why, not a restatement of the name.
- `@param` for every parameter, including destructured props (`@param props.title`). No `{type}` braces, because TypeScript holds the types.
- `@returns` unless it returns `void`. Components describe what they render.
- `@throws` for every error it can throw.
- `@example` on everything exported from a package `index.ts` or `packages/ui`.

Types and interfaces that are exported also get a one-line JSDoc, with a comment on each non-obvious field.

# Tests
Every task adds tests for the behaviour it introduces or changes. Vitest + Testing Library for unit and component tests, Playwright for E2E.
- **Place:** next to the source as `<name>.test.ts(x)`. E2E goes in `apps/web/e2e/`.
- **Cover:** the happy path, edge cases (empty, boundary, locale `km`) and every error branch. For money: currency and rounding. For tenant code: data from another school is never returned.
- **Test behaviour, not implementation.** Query the UI by role and label, as a user would. Don't assert on internal state, private functions or CSS classes. No snapshot-only tests.
- **Arrange / Act / Assert**, one behaviour per test, named `it("<does what> when <condition>")`.
- **Mock only at boundaries** (network, vendor SDKs, clock, random). Never mock the module under test.
- **Deterministic:** no real timers, no real network, no order dependence.
- A task with no testable behaviour (pure config such as docker-compose) says so in the run report and explains how it was verified instead.
