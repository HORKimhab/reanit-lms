---
name: task-runner
description: Build TODO.md tasks by ID and commit. Use when the prompt is "init <ID>[, <ID> to <ID>]", "init <ID> onward [max N]" or "next task".
---

**Modes**
- `init REPO-01, WEB-01 to WEB-02`: build the listed tasks, then make **one** commit.
- `init WEB-03 onward [max N]`: start at WEB-03 and go through TODO.md in order, making **one commit per task**. Stop at a ⚠ task, an unfixable failure, `max N` tasks, or an empty TODO.
- `next task`: build the task under `## Now`.

**Steps per task**
1. **Resolve the IDs.** Expand `X-01 to X-03` into X-01, X-02, X-03, kept in TODO.md order. For each `Needs <ID>` still open, add that ID first.
2. **⚠ tasks.** Stop and ask the user for the decision.
3. **Build.** Do exactly what the TODO line says, nothing extra and no plan step. Follow `project-structure` for file placement.
4. **Verify.** Run whichever of `pnpm build`, `pnpm lint`, `pnpm typecheck` exist. If they fail, fix them. If they still fail, report the output and **don't commit**.
5. **Update TODO.md.** Delete the finished line and move the next open task under `## Now`.
6. **Commit** code + TODO.md, using the git config identity only (no `--author`, no trailer):
   - Subject: `feat: init <IDs as the user wrote them>`. Include any dependency IDs that were added. In onward mode it's `feat: init <ID>` for each task.
   - Use `feat: :sparkles: init …` only when the user writes `:sparkles:`.

**Report:** one line per task, the commit hashes, why it stopped, and the next task in `## Now`.
