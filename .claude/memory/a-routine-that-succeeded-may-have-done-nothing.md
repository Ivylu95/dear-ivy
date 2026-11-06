# A Routine that "succeeded" may have done nothing

**The trap.** A scheduled Routine created with the `create_trigger` tool starts
its sessions with **no repository attached**: the tool has no way to name one,
and the stored session request shows `"sources": []`. The fired session wakes
with no code, stops in about twenty seconds, and the Routine's `last_run` still
reads `ROUTINE_RUN_STATUS_SUCCEEDED`. That status means the session started and
ended cleanly, never that the work ran.

**Seen 2026-09-29.** The daily heartbeats Routine fired twice (once by hand,
once on schedule). Both runs "succeeded" in 17 to 30 seconds and changed
nothing: every due heartbeat stayed `never` in the tracker (then `.claude/heartbeats.json`).

**Do instead.**
- Judge a scheduled run by what reached main, never by the platform's status:
  for heartbeats, the tracker in `.claude/jobs/` (HBT-008) and a
  `chore(heartbeats)` commit.
- A Routine that must work on this repository is created, or edited to attach
  the repository, from the Routines page on claude.ai. The tool can create the
  schedule and the message; only the page can attach the repo.
- After creating one, fire it once and check the tracker before saying it works.
