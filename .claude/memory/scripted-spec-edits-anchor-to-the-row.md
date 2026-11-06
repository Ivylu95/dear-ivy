# Scripted spec edits anchor to the row

**Hit 2026-10-07**, three times in one session of bulk spec edits.

- **A pattern for row statements matched other text of the same shape.** A
  regex turning `> **Lead.** ` into `> **Lead** – ` also rewrote four of
  `dev/specs/README.md`'s guidance callouts, which open the same way. Find the
  row's heading, then its statement line under `(§) SPEC STATEMENT`, and edit
  that line only; then compare `git diff --stat` with the rows you meant.
- **Cutting a row up to the sources note took what sat between.** A fold that
  removed a register's last row up to the `> 📚` note also removed a `↪️`
  pointer that lived there. Stop a row's section at the next blank-separated
  block that is not part of it, and read the diff of the file's foot.
- **Moving a row's designs moved its claims but not its limits.** Its
  Coverage marks (⚠️ and the note after them) and its own "Falls short" item
  must travel with the designs into the parent, or a partly carried clause
  reads as carried.
- **A retired ID is written plainly**: `Was 003 ·` in Recently deleted, and
  in history a line keeps its number as `WKB-015 (then 037)` so the link
  check still resolves it. `spec:move` now leaves the old backlog's Done lines and
  files named for a date alone (tested in `.claude/hooks/lib/test-spec-edit.mjs`).
- **A row moved to a new register strands the Transcript's citations of it.**
  On 2026-11-03 three conduct rows moved to a new register and took new IDs;
  CLAUDE.md's citations followed, but a Gist written an hour before named the
  old IDs, and the link check refused every commit until it was reworded (and
  once more after a merge dropped the reword). Write an agent-made Gist or
  Became line by what was decided, not by row ID; a move that renumbers greps
  `dev/dialogue/transcript/` for the old IDs and rewords those agent-written
  lines in the same commit, never the quote.

**Seen 2026-11-05, in the Transcript.** A scripted edit to an agreement card asserted its text
appeared once, and failed: a merged card keeps a word-for-word copy of the card it went into, so
the sentence was there twice. The shell went on and committed the rebuilt pages under a message
saying the card was reworded. Anchor an edit to the card's own block (`- **Card A-NNN** ·` up to
the blank line), and run the edit and the commit as one chain (`set -e`, or `&&`), so a failed
edit never reaches a commit.
