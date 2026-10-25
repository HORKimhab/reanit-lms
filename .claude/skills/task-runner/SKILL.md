---
name: task-runner
description: Build TODO.md tasks by ID to the quality.md rules (patterns, no duplicate/dead code, full JSDoc, tests), refactor, verify and commit. Use when the prompt is "init <ID>[, <ID> to <ID>]", "init <ID> onward [max N] [until P%]" or "next task". Skips `(Future)` tasks unless named by ID.
---

**Modes**
- `init REPO-01, WEB-01 to WEB-02`: build the listed tasks, then make **one** commit.
- `init WEB-03 onward [max N] [until P%]`: start at WEB-03 and go through TODO.md in order, making **one commit per task**. P defaults to 95.
- `next task`: build the first unticked `- [ ]` task in TODO.md that is not tagged `(Future)`.
- `(Future)` tasks are deferred: `next task` and onward runs skip them; `init <ID>` with that ID still builds one.

**Before starting**
- Run `git status`. If there are uncommitted changes, a task was cut off earlier: ask the user whether to continue it or discard it.
- Onward mode: write P to `.claude/run.lock`. The usage-guard hook stops Claude mid-task once session usage reaches P.

**Before each onward task, stop if any of these is true:**
`.claude/STOP` exists (delete it) · `.claude/usage.json` is under 10 min old and `five_hour` ≥ P−5 · `max N` tasks done · the next task is ⚠ · no untagged `- [ ]` tasks are left.

**Steps per task**
1. **Resolve the IDs.** Expand `X-01 to X-03` into X-01, X-02, X-03, kept in TODO.md order. For each `Needs <ID>` that is still `- [ ]`, add that ID first. Skip IDs that are already `- [x]` and say so.
2. **⚠ tasks.** Stop and ask the user for the decision.
3. **Build.** Do exactly what the TODO line says, nothing extra and no plan step. Follow `project-structure` for file placement and **every rule in `quality.md`**: reuse before writing, full JSDoc on every function, and tests for every behaviour, written alongside the code. Test flow:
   - Before writing a test, read the package's `src/test/` helpers and a nearby `*.test.tsx` and copy their style.
   - Put each test where `quality.md` → Tests → Place says.
   - While building, run only the touched package's tests (`pnpm --filter <pkg> test`). The full suite runs in Verify.
   - Check that each new test fails when its behaviour breaks.
4. **Refactor.** Read the task's full diff (`git diff` + new files) against `quality.md` and fix every problem you find, don't just note it: merge duplicates into a shared function, delete dead code, move logic to the right layer, apply the right pattern, add missing JSDoc and tests, move setup repeated across test files into `src/test/`, and delete or rewrite tests that can't fail. Keep it to code this task touches. A wider problem elsewhere goes into the report as a suggested TODO task.
5. **Verify.** Run whichever of `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm dup` exist. If they fail, fix them. If they still fail, report the output and **don't commit**. Never skip, delete or weaken a test, lint rule or threshold to make a check pass.
6. **Update TODO.md.** Change the finished task's `- [ ]` to `- [x]` in place. Never delete, move or reorder lines.
7. **Commit** code + TODO.md, using the git config identity only (no `--author`, no trailer):
   - Subject: `feat: init <IDs as the user wrote them>`. Include any dependency IDs that were added. In onward mode it's `feat: init <ID>` for each task.
   - Use `feat: :sparkles: init …` only when the user writes `:sparkles:`.

**End:** delete `.claude/run.lock`, then report: one line per task, the tests added per task (or why there are none), commit hashes, why it stopped, session % and reset time (from `usage.json` `resets_at`), and the next unticked task.
