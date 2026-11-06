---
emoji: 🧯
runs: local
gate: dev
every: 30 days
governs: DAT-003 in dev/specs/data/record.md (design 5)
---
# Heartbeat: restore drill

An unattended run, with no one present. Her record is saved to GitHub every turn, and
nothing else proves the saved copy comes back whole: this does, once a month, the way a
new device would get it (`DAT-003`, *"Nothing in the record is lost or changed without
trace"*, design 5). It is the owner's yes of 2026-10-29 (T-362).

1. In your checkout, run `node ux/scripts/restore-drill.mjs`. It clones the repository
   fresh from GitHub into the system's temp folder, checks the record it gets (every
   standing file each module names, every link in the record's index, the timeline in
   date order with each pointer resolving, the profile's rules, the schedule files
   reading), and removes the clone. It names a folder and a count, never a file and
   never anything she wrote.
2. Whole: nothing to land. Not whole: this run cannot fix it, since a fault is mended in
   a session, where the record's own rules apply, so it is not dropped either: one plain
   question for the developer, under `For you:` in the reply, for all of this run's
   faults together (`Restore drill: <the lines as printed>; mend them in a session?`),
   which the orchestrator puts on `dev/for-you.md` unless it is already there (A-152).
   Never open, read or mend her record here. Exit 2 (no clone): the run failed; say what
   it printed.
3. Reply with the drill's lines as printed. Never a file name under `data/`, never a
   word from the record.

Never touching `data/`, never in one of her conversations, nothing personal in a commit,
a question or the reply.
