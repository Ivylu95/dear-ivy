---
emoji: 🩺
runs: local
gate: dev
every: 6 hours
governs: HBT-013
---
# Heartbeat: doctor

An unattended run, with no one present, and **no one approves what it lands**
(HBT-013, *"The sweep mends its own machinery, never its fences"*). It reads the
sweep's recent runs, finds what keeps going wrong, and mends the heartbeat
machinery itself. Its fence is checked by machine:
`node ux/scripts/check-doctor-fence.mjs origin/main HEAD` must pass before you
reply, and the orchestrator's reviewer runs it again.

**Inside the fence**: the job prompts in `.claude/jobs/` (never `README.md`, this
file, or `check-in.md`), `.claude/hooks/lib/heartbeats.mjs`,
`ux/scripts/reminders.mjs`, `ux/scripts/nudge.mjs` and `dev/run-report.mjs`.
**Everything else is the developer's**: the specs, `CLAUDE.md`, the safety core,
the commit gate and every check, her record, and `dev/for-you.md`, which only
the orchestrator writes (A-152).

1. **Read the last day of runs**, and nothing personal:
   `git log --since="24 hours ago" --format="%h %s%n%b" -- .claude/jobs/` (each
   run's summary is the body of its `finish run` commit), and each job's
   record in the jobs' state file, state.json in `.claude/jobs/`.
2. **Find what repeats**: the same job failed twice or more, or is stopped
   (`failures` at its limit); one getting slower run on run; one that should
   have come due and did not; a claim or commit refused for the same reason
   twice; a reminders step that sent nothing while reminders fell due.
3. **Mend what sits inside the fence**: the smallest change that removes the
   cause, one commit per cause with the `commit` skill, citing HBT-013. Add a
   test case beside the code you change where one fits. Never loosen a limit,
   a threshold or a check to get a job through.
4. **Leave the rest**: nothing is kept for later (A-152). A cause outside the
   fence is the developer's to decide, so it becomes one plain question for him,
   under `For you:` in the reply, naming the file and what it needs; the
   orchestrator puts it on `dev/for-you.md`. Anything else you could not mend is
   dropped and named in the reply; the next run finds it again if it still
   repeats. Never a word of her record.
5. **Prove it**: run `node ux/scripts/check-doctor-fence.mjs origin/main HEAD`
   and the tests of anything you changed. If the fence refuses, undo that
   change with a new commit and leave it for the developer instead.
6. **Reply** with: what you found, each mend (hash and summary), and each
   "needs you" line. Nothing found is a good reply: "nothing to mend".

The crisis block in `CLAUDE.md` outranks everything here.
