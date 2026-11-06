# Leftover chat branches clear themselves

**Tried 2026-10-01, reversed the same day.** A development chat saw three
`claude/…` branches on GitHub beside main, explained that nothing removed them,
and wrote a sweep script plus a weekly heartbeat step to delete them. Wrong on
both counts:

- **They are already cleared.** DEP-011, *"A branch is cleared once its work is
  in main, on the remote and on every machine."*: `.github/workflows/merge-sessions.yml`
  runs daily and deletes a chat branch once it is merged and untouched for an
  hour (seven days until 2026-10-16, when chats began saving to main first); the
  session-start hook `.claude/hooks/session/prune-branches.mjs` clears this
  machine's. A merged chat branch on GitHub while Actions do not run is
  expected, not clutter, and loses nothing.
- **The script went around the history guard.** The guard refuses `git push
  --delete` typed at the prompt, but a script runs as one line it cannot see
  into. `ux/scripts/check-git-bypass.mjs` now refuses such a script at commit.
- **A cloud session cannot delete a remote branch anyway.** Its git proxy
  answers 403, an organisation policy: report it, never route around it.

**Except a branch whose work reached main as copies** (2026-10-01). A chat
cherry-picked its branch's commits onto main to avoid a merge, then another
chat changed the same lines. The workflow's merge of the old branch conflicted,
so it never counted as merged, never cleared, and every session start warned
that it "never reached main". Once its content is confirmed on main, record it
as merged without changing a file, in the folder holding main (never on a
new branch, which would never land): `git merge -s ours -m "merge: a branch
already in main" origin/<branch>`, then `git push origin main`. The sync and
the workflow then clear it like any other.

**Before building any housekeeping, search the specs for the rule it would
serve** (`grep -rn "branch" dev/specs/`): the row usually names what already does it.

**On demand, there is one sanctioned pass** (2026-10-04): the `git-reconcile`
skill (WKB-015) catches main up, clears this machine's finished branches with
the same safe deletes as the session-start hook (`.claude/hooks/lib/branches.mjs`),
and lists the rest. It deletes nothing on GitHub; that stays the workflow's.

**Since 2026-10-15 the sessions do it themselves.** The workflow stopped running
on 2026-10-13 (Actions), and 22 branches piled up. `reconcile()` now runs at
every session start and turn end: it merges chat branches and rescues from main or a
chat into main, and retires idle heartbeat and detached-rescue branches into
main's history (an ours-merge naming the branch and tip), so the
workflow, whenever it runs, only has deletes left. A retired branch reads as
merged: reach its work by cherry-picking the tip named in its
`chore(git): retire` commit, never by merging it again.
