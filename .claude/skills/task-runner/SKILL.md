---
name: task-runner
description: Build TODO.md tasks by ID and commit. Use when the prompt is "init <ID>[, <ID> to <ID>]", "init <ID> onward [max N] [until P%]" or "next task".
---

**Modes**
- `init REPO-01, WEB-01 to WEB-02`: build the listed tasks, then make **one** commit.
- `init WEB-03 onward [max N] [until P%]`: start at WEB-03 and go through TODO.md in order, making **one commit per task**. P defaults to 95.
- `next task`: build the task under `## Now`.

**Before starting**
- Run `git status`. If there are uncommitted changes, a task was cut off earlier: ask the user whether to continue it or discard it.
- Onward mode: write P to `.claude/run.lock`. The usage-guard hook stops Claude mid-task once session usage reaches P.

**Before each onward task, stop if any of these is true:**
`.claude/STOP` exists (delete it) · `.claude/usage.json` is under 10 min old and `five_hour` ≥ P−5 · `max N` tasks done · the next task is ⚠ · TODO is empty.

**Steps per task**
1. **Resolve the IDs.** Expand `X-01 to X-03` into X-01, X-02, X-03, kept in TODO.md order. For each `Needs <ID>` still open, add that ID first.
2. **⚠ tasks.** Stop and ask the user for the decision.
3. **Build.** Do exactly what the TODO line says, nothing extra and no plan step. Follow `project-structure` for file placement.
4. **Verify.** Run whichever of `pnpm build`, `pnpm lint`, `pnpm typecheck` exist. If they fail, fix them. If they still fail, report the output and **don't commit**.
5. **Update TODO.md.** Delete the finished line and move the next open task under `## Now`.
6. **Commit** code + TODO.md, using the git config identity only (no `--author`, no trailer):
   - Subject: `feat: init <IDs as the user wrote them>`. Include any dependency IDs that were added. In onward mode it's `feat: init <ID>` for each task.
   - Use `feat: :sparkles: init …` only when the user writes `:sparkles:`.

**End:** delete `.claude/run.lock`, then report: one line per task, commit hashes, why it stopped, session % and reset time (from `usage.json` `resets_at`), and the next task in `## Now`.
