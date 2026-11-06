# Unpushed record saves may already be safe

**Hit 2026-10-03.** Local main showed three `record: session update` commits
ahead of origin/main, and a development reply called them unsaved and asked to
push them. They were already off the machine: the save hook (DEP-005) had put
each on a `rescue/main-<time>` branch, and `PUSH_FAILED.md` marked it (DEP-006).
Before raising one, run `git branch -r --contains <commit>`.

The real fault was elsewhere: `merge-sessions.yml` triggered only on
`claude/**`, so no rescue branch ever reached main. Fixed the same day
(5eb9b1b): a rescue branch saved from main or a `claude/` branch is merged on
push, and every run sweeps any still outside main. One saved from a
development branch or a detached checkout is never merged automatically: it
may hold unfinished harness work, so it waits for a person.

**A rescue push can trigger nothing.** GitHub runs the workflow file as it
stands on the pushed branch. A rescue branch cut from a local main older than
the fix carries the old trigger list, so its push starts no run; the sweep on
the next push to main, or the daily run, carries it in instead (seen
2026-10-03: three rescues waited about an hour). Hours, not loss.

This sweep merges; it never deletes. Deleting stays with the cleanup step,
only once a branch is in main (`leftover-chat-branches-clear-themselves.md`).

A rescue branch with **no history in common with main** fails every run.
Look at its shape before anything else (file counts per top-level folder,
`git diff --stat` against main at the branch's time), never its content. The
two found on 2026-10-03 held the record as it already was on main, plus a
push-failure log.

**A paused rebase keeps the checkout detached, and every save then fails.**
Seen 2026-10-04 to 10-05: a rebase left half-done in the shared tree (the
history guard refuses `git rebase` to agents, `--continue` and `--quit`
included) kept HEAD detached for a day. Each save committed only a fresh
`PUSH_FAILED.md`, failed to push, and cut another `rescue/detached-…` branch,
three in one night, all holding nothing but the marker. Only the developer can
clear it, and `git rebase --quit` alone is not enough: on 2026-10-05
`git switch main` then refused over the edited marker, and the local `main`
had diverged from origin (one commit main already held under another hash).
What worked, after checking that the detached commits touched only the marker,
that local `main` held nothing origin lacked, and that `git status --porcelain`
listed nothing but the marker (anything else is a chat's unsaved work, her
record's words included, which both commands below throw away: commit it first,
or wait for her chat's save; round 42 of the git sync review): copy the marker to
`data\archive\<date>_push-failed.md`, then `git switch -f main` and
`git reset --hard origin/main`, in PowerShell, by the developer. When merging
such a tree into main, take main's side of `PUSH_FAILED.md`; keeping the local
marker resurrects the warning for every session.
