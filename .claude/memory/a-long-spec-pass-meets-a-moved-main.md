# A long spec pass meets a moved main

**Hit 2026-10-05.** An overnight pass rewrote the designs of 298 rows. Another
chat edited about 15 of the same spec files in the meantime, and merging main
afterwards conflicted in 65 hunks. The pass had to be parked on a branch
(`design-pass-2026-10-05`) and merged by hand the next morning.

- **Keep the rewrite as data, and apply it with a script.** The pass kept each
  row's new parts in JSON and applied them with a check that nothing else in
  the row changed. That is what made the conflicts safe to resolve: the same
  script can be run again against the merged files.
- **Fetch and merge main right before applying, not at the start.** Hours of
  agent work leave a wide window. A merge just before the write narrows it to
  minutes.
- **A rewrite of rows can swallow what sits between them.** The parser once
  read a closing `> 📚` note into the file's last row, and the pass rewrote 35
  of them. Compare the whole folder before and after a pass, never only the
  rows (`test-spec-rows.mjs` now holds the case).
- **Subagents writing designs name skills by path.** A new
  `.claude/skills/<name>/` path in a design binds the skill to that row, and
  `check-skills` failed 35 times. Brief them to write "the `name` skill".
  The same check caught it again on 2026-10-05, in a design written by hand.
- **A no-loss check reads main's copy, never the file it just wrote.** On
  2026-10-05 the safety registers' pass was re-run after a fix, and its check
  compared the rewritten rows with themselves: "0 tokens lost", proving
  nothing. Export the originals from the remote main and run the check against
  those every time.
