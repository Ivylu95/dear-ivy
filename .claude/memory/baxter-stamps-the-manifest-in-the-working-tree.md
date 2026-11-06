# BAXTER no longer stamps the manifest; a run may still be mid-way

**Seen 2026-10-07, fixed 2026-10-08.** BAXTER's master sweep used to rewrite
`.claude/heartbeats.json` in the developer's checkout after each run, with
`last_run`, `last_result` and `last_error` on its entry, uncommitted. It wrote
back the whole manifest **as it read it when the sweep started**, so:

- **An edit pulled while a heartbeat ran was reverted.** On 2026-10-08 the
  renamed `orchestrator` entry went back to the old `baxter-sweep`, pointing
  at a deleted prompt, and every tick after that ran nothing for hours while
  reporting success ("Clean.").
- **The stamp blocked every pull** ("Your local changes … would be
  overwritten").

The fix is BAXTER's (its commit 695de50): dear-me is `"stamp_manifest": false`
in BAXTER's config/repos.json, so the sweep never writes this file and keeps
the run in its own state/heartbeat-runstate.json. So:

- **This file changed in the working tree means something else wrote it.** Do
  not re-add stamp fields, and never set `stamp_manifest` back without
  reading this note.
- **To see BAXTER's last run** of dear-me, read
  state/heartbeat-runstate.json in the BAXTER folder (key
  dear-me/orchestrator), and its log temp/heartbeat-sweep.log.
- **Judge a run by what it did, not by exit 0**: a run that read a missing
  prompt still exited 0.

**A run may be going on while you land.** Before landing anything that moves
or reshapes the job list, read `.claude/jobs/` on origin/main: anything
`running`, wait for its finish commit first, or its `finish` has no entry to
record on (2026-10-07: a layout change was ready while a run was half-way
through four jobs).

**"Every 30 minutes" fires about hourly.** BAXTER stamps a run with the
sweep's start time and the next tick lands a second or two short of 30
minutes, so every other tick finds the trigger not yet due. A job meant to run
hourly says `every: 50 minutes` (as the spec-health job did, until it was
deleted on 2026-10-20), not `1 hour`,
which would slip to every two hours.
