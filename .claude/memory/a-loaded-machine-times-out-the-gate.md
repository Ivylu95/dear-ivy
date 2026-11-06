# A loaded machine times out the commit gate

**Seen 2026-10-28 and 29.** The selftest gives each hook test 60 seconds. With two fix agents each
running `npm ci` and the test suites in their own worktrees, the load reached 30 on 4 cores and
`test-reminders`, `test-reminders-edge`, `test-sync` and `test-save-to-main` timed out, refusing every
commit for half an hour. The heartbeat met the same wall the night before: code maintenance's commit was
refused while the dialogue loop's persona run loaded the machine.

**Do.**
- Never raise the limit to get past it: that loosens a check. Make the slow test fast, behaviour
  unchanged: the reminders' edge tests went from 23 s to 6 s once `localParts` stopped asking Intl
  for every minute scanned (proved identical on 784,000 instants across 14 zones).
- Before starting agents that each run the suites, commit what you have; while they run, expect
  your own commits to be refused, and retry once `uptime` shows the load near the core count.
- A heavy job (a persona run) and a job that commits through the gate should not share a sweep's
  peak: the daily loop now runs only the oldest four persona cards (T-340).

**Seen again 2026-11-02.** Paid eval runs started side by side, while fix agents ran the suites,
pushed the load to 20–50 and the selftest timed out; running the evals one after another, with no
background loop polling meanwhile, cleared it. So: **one live eval run at a time** (`check-skills.mjs
--live`, `evals.mjs run`), never alongside an agent running the suites, and one selftest at a time.

**Seen again 2026-11-03, now enforced.** The sweep started its jobs together and three failed on
gate timeouts in one run. The full gate now queues, one at a time on the machine
(`.claude/hooks/lib/gate-queue.mjs`, a lock folder in the system temp folder that every worktree
shares; a dead holder is taken over, a waiter past 40 minutes goes ahead). A slow commit in a busy
sweep is waiting its turn, not stuck.

**A whole eval run outlasts a short tool limit (2026-11-04).** `node ux/scripts/evals.mjs run --all`
takes several minutes under load; run under a 300-second tool limit it was killed partway, leaving
the day's history file with card lines and no run line. Give it the 600-second limit, alone. The
card lines a killed run left are real verdicts (each card is recorded as it finishes): commit them
as they are, never hand-edited, and run again for the run line.

**Two root causes found and fixed (2026-11-05).** A heartbeat claim was refused on an ENOENT,
not a timeout: seven record and git tests copied the live `.claude` folder, two with
`.claude/hooks/state/`, while other tests and sessions changed it, so a copy met a file
removed a moment before. They now copy with `copyTree` (`.claude/hooks/lib/temp-litter.mjs`),
which skips only a vanished file; `.claude/hooks/lib/test-copy-tree.mjs` races a second process
against it, and the old `cpSync` copy fails that race on its first try. And the selftest
started every rule test at once; it now runs a few per core, each test's clock starting when it
does. The full selftest then passed in 2 min 24 s with the save tests that had been timing out.
A test that copies part of the repository uses `copyTree`, never `cpSync` on a live folder.
