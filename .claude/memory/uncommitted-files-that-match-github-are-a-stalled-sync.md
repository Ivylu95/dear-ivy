# Uncommitted files that match GitHub are a stalled sync, not another chat's work

**Hit 2026-10-20 to 10-24.** A development chat saw 24 files changed in the
checkout, the same set for four days, called them another chat's unfinished
work and left them. They were not: 23 were byte for byte GitHub's own copies
from the moment a sync was interrupted (2026-10-20 14:03), written into the
working tree while local main stayed hundreds of commits behind. The cloud's
own end-of-turn check (a git check in the user's home folder, outside this
repository) fires on any uncommitted change, so every turn ended in "There are
uncommitted changes…", and each one drew a whole new reply: the developer saw
the same answer five and six times over.

**Test before naming an owner.** For each changed file:
`git show origin/main:<file> | cmp -s - <file>`, and for the rest the GitHub
commits around the files' shared modification time. Files that match are
already on GitHub; nothing is unsaved.

**Settle it, losing nothing:** `git stash push -m "<why>" -- <each file that
matches>`, then `git merge --ff-only origin/main`. Keep the stash; never drop it.
Never stash the folder whole (`git stash push -u` with no files named): it took
whatever else was uncommitted with it, her record's unsaved words included, onto
this machine only (round 41 of the git sync review). A stash holding record words
no commit has is now named at session start, to be brought back with `git stash
apply`. The
session-start git notice names this case ("an uncommitted edit is in the way");
settle it then, not days later.

**Never answer the end-of-turn check with a full reply.** A check firing on
nothing of the chat's own is settled in tools and answered in one line, or the
developer reads the last reply again. A push left running in the background
wakes the chat once more when it ends; run a short push in the foreground.
