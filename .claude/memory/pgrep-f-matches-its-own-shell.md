# `pkill -f` and `pgrep -f` match their own shell

**Seen 2026-10-26 to 27.** `pkill -f "runner.mjs E-04"` in a Bash call killed that call's own shell
(exit 144), since the shell's command line holds the same words; the commit after it in the same call
never ran. `until ! pgrep -f "evals.mjs run E-036"; do sleep 5; done` never ended for the same
reason, and held a commit for ten minutes until stopped by hand.

**Seen again 2026-10-30,** by a session that had this note in its memory: `pkill -f "code-upkeep.md 2>/dev/null"` ended its own call, and a watch loop with it.

**Do.** Stop a background job by its task id (TaskStop), or match a pattern the calling command does
not contain: `pgrep -f "[r]unner.mjs"`. Never put a `pkill -f` and the work after it in one call.

**Seen again 2026-11-03,** with this note in memory: `until ! pgrep -f "git commit"; do sleep 2; done`,
run in the background to wait on a slow commit, matched its own shell and ran to its fifteen-minute
limit. To wait on a commit, run the commit itself in the background and wait for its notification.
