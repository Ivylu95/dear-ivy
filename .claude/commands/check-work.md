---
description: Check over the work just done — it runs, it's optimized, no redundancies, follows best practices and this project's rules.
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(npm:*), Bash(node:*)
---

# `/check-work`

Establish scope from `git status --porcelain` and `git diff HEAD` — what actually changed, not what you remember changing. Untracked files aren't in the diff; read them. Report findings worst first, with `path:line`. Don't edit unless asked.

- Ensure the gates pass first — `npm --prefix ux run lint`, `npm --prefix ux run check`, `node .claude/hooks/selftest.mjs`, and `npm --prefix ux run build` if `ux/` changed. There are no tests here; a gate is the only proof, and everything below it is judgement.
- Ensure it actually does what was asked — trace the change end to end, check the edge cases and the error path, not just that it compiles.
- Ensure all code created or amended is optimized — no bottlenecks, no needless work in loops, no repeated reads or sweeps where a lookup exists.
- Ensure there are no redundancies — duplicated logic, a helper that already exists in `ux/lib/`, two ways to do one thing.
- Ensure there is no dead code — unused imports, unreachable branches, commented-out blocks, files left behind by a rename. `npm run lint` does not catch these; no unused-vars rule is configured.
- Ensure nothing is hardcoded that could vary — colours, URLs, names, paths, thresholds belong in `ux/config/`, `ux/theme/`, or `data/profile.yaml`.
- Ensure it follows the conventions already here — server-first, input validated before persistence, small and scoped functions, matching the idiom of the code around it.
- Ensure nothing leaked — nothing personal outside `data/`, no keys, tokens, or `.env` values in any tracked file or commit message.
- Ensure this project's rules hold — nothing deleted (archived instead), new `data/` files listed in `INDEX.md`, `.claude/CLAUDE.md` never edited.
- Ensure nothing strayed — only the files this task needed were touched, and any behaviour change is documented and committed with a Conventional Commit. Nothing here auto-saves: `settings.json` dispatches no hooks.

Flag only what affects correctness, safety, or what was actually asked for. A reviewer told to find gaps will find some in sound work — so if nothing qualifies, say so in one sentence and stop.
