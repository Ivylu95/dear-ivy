# Repair: saves, sessions and services

**Read when** something has stopped saving, a save or a branch is stuck, something said seems forgotten, a session or a service failed, or the copy moves (`SKILL.md` § 3). A refused push, messages, and privacy or secrets have their own files (`SKILL.md` § 3); her answer is [`her-side.md`](her-side.md)'s.

A fault is never guessed at. Start from the doctor and name the part the symptom points at. Run the test that separates it from its neighbour, fix, and run the doctor again. A repair is done when the part reads ✅, not when the fix was made.

## Symptom to part

| What is seen | Part | What separates it from its neighbour |
|---|---|---|
| A commit on a session's own branch, nothing on main | App + write (`carry`) | Actions shows a **failed** `merge-sessions` run. No run at all is the GitHub App instead, unless the month's Actions minutes are spent (below) |
| No commit at all from a conversation | The GitHub App, then the hooks | A session that cloned but could not push says so in its transcript |
| *"Something I said isn't there"* | `carry`, then the session | No stranded branch and no failed `merge-sessions` run that day leave four causes: a session reclaimed before its turn ended and pushed (nothing to recover; the session list or its transcript shows it), a later session that missed what was saved, something she asked to keep out, or a crisis turn, which files nothing (`CLAUDE.md`): no setup note for it, and nothing said about why. In a development chat, commits that day prove only that something saved |
| No Actions run at all this month, or runs that never start | Actions minutes | The doctor's minutes reading (`--fetch`), or the account's billing page: the month's free minutes spent stops `merge-sessions` and the backup until the month turns. A spending limit is the account owner's choice; never the GitHub App |
| *"New computer"*, *"I've moved country"* | Move | **In her chat: one plain line, no steps or setup words**: the emergency numbers here are for where she was, so in an emergency she uses the local one, never a number given from memory; and a setup note for its numbers and her timezone. In a development chat, `remove-move-retire.md`. A trip is not a move: nothing noted, her timezone unchanged, and the one line says so and that a reminder she sets while away can take that place's time; being away is covered by `CLAUDE.md`'s crisis block |
| Nothing works today | A service | Outside the copy (GitHub, Anthropic, Telegram): where to see it, their status pages (Telegram has none); change nothing, offer to check again. A failed `--fetch` can be the outage |
| A cloud run refused at its first commit | `history` | The gate names commits missing from a shallow clone |

## Saves stuck on a branch

Read `.claude/memory/unpushed-saves-may-already-be-safe.md` first. Its reset recipe is the developer's to run by hand, never the agent's (`SKILL.md`'s Must hold: never forced). The doctor sorts branches main lacks:

- **`carry`: a session branch, or a rescue saved from main or a session** (`rescue/main-*`, `rescue/claude-*`). These are `merge-sessions`' to carry. A push carries a session branch. For a stuck one, read its run's log first: `403` or *denied* is the Actions write permission, `CONFLICT` a merge to hand over. The workflow's sweep, which runs on every run including one started by hand, carries the two rescue kinds. If it has not, merge by hand, only in a clean checkout of main level with origin's main. If this one is dirty, detached or mid-merge, use a fresh worktree from origin's main in the session's scratchpad, never `temp/`. Fetch, merge the branch into main with a merge commit (`git merge --no-ff`), and push. **On a port's new-copy route, any conflict gets `git merge --abort`, no side picked. The import carries the branch** (`port.md`). Otherwise, a conflict in `PUSH_FAILED.md` takes main's side. One inside her record only is settled by merging and keeping both sides, as `CLAUDE.md` says. Any other gets `git merge --abort`, then goes to the developer. A session branch is **not** carried by starting the workflow by hand: its merge step runs on a push.
- **`rescue`: a rescue from a detached or development checkout that touches the record.** Never merged without a person looking: it may hold harness work, or a save that main has since overwritten. Show its shape (`git log --oneline origin/main..<branch>`, `git diff --stat origin/main...<branch> -- data/`) and whether main changed those files after it. The developer decides with her, both read by her on her machine. Never drop a save for main's side on a guess.
- **`leftovers`: branches main lacks with no record change.** Nothing of hers is at stake. They may hold harness work; branch tidying is `git-reconcile`'s, and nothing is deleted without a look.

## Other fixes the agent makes

Each one, then the doctor again; a fix only a person can make is `running.md`'s.

- **Shallow history**: `git fetch --unshallow origin`.
- **The commit gate unset**: `git config core.hooksPath .claude/hooks/git`.
