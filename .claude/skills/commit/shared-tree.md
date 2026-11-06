# When the working tree is shared

Read when another session's work is staged or in a file you changed, after a refused commit, after a Transcript edit, or before one change across many files. `SKILL.md`'s four steps hold on every commit; this is the rest.

A commit takes whatever is staged, another session's half-finished work
included, and nothing warns you: the other session finds its change committed
under your message, or undone by it.

**Leave other sessions' edits alone:** stashing them moves work that is not yours.

Why `SKILL.md`'s steps: `git add -A` or `.` takes the whole tree. `git commit --
<your paths>` leaves what another session staged as it was; unstaging theirs
changes their state. Your own earlier staging counts: a `git rm` stages at once,
and a later plain `git commit` carried it into an unrelated spec commit, which
then could not build alone (2026-10-07, a61329d). A pushed wrong commit is
undone only by another. A failing file of theirs may be mid-change.

| Rule | Because |
|---|---|
| A subagent that edits or commits works in its own worktree (`DEV-017` design 6); one that finds itself in a checkout others are working in hands its files back by name for its chat to commit. Claude Code refuses such a commit (`guard-agent-own-copy.mjs`); her saves never are | On 3 Nov two agents in one checkout collided three ways (a live index lock, a blocked pull, stray merge copies); five, each in its own worktree, never did |
| A file that also holds someone else's uncommitted edit: stage only your lines, then commit the index | `git commit -- <path>` would take the whole file, their edit included |
| After a commit the gate refused, `git diff --cached --name-only` again before the next one | A refused commit leaves its files staged for the next to take (2026-09-30, a hook change on a spec commit; 2026-10-03, a scripted loop that read neither this nor the gate). The gate now refuses that next commit once, naming the files (PRC-001); in a loop, stop at the first refusal |
| After any edit to the Transcript (sorting an entry included), run `node ux/scripts/dialogue.mjs build` and stage `dev/dialogue/agreements.md` with it; and read the gate's whole output when it refuses, never its tail | `agreements.md` counts the remarks, and the recording hook appends one each message without rebuilding it, so every Transcript commit finds it stale; a filtered tail hides the reason (2026-10-29: two refusals on a stale file, six reruns on causes a `tail` cut off) |
| One mechanical change applied the same way across many files (a format conversion, a rename) is one commit, unless the developer asks for more | Each commit runs the whole gate, about a minute: thirty one-file commits of one conversion took half an hour (2026-10-03). One commit still reverts alone; a slip in one file is fixed forward |

**Staging only your lines:** In a scratch folder, put the file as it is at `HEAD` at
`a/<its path>`, and a copy with only your change at `b/<its path>`. Run `git diff
--no-index --no-prefix a/<its path> b/<its path>` from there. Then `git apply --cached`
the result in the repository. With `--no-prefix`, git adds no prefix of its own, so
the patch names the real path.

**If that file's edits are interleaved with theirs, or another session has also
staged files, stop and say so rather than guess.**
