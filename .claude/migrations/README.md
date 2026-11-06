# .claude/migrations/

How a record moves to a new shape when a release changes how it is read
(PRD-008 design 2): nothing is asked of her again, and nothing is deleted.

- **`formats.json`** names each record format: its files, relative to the
  record folder; the harness files that read that shape (`readers`); and its
  `version`, starting at 1.
- **A migration** is one script here, `NNN-<format>-v<N>.mjs`: a three-digit
  number setting the order every copy runs it in, the format it changes, and the
  version it brings it to. It exports `migrate(text, { path })`, returning the
  file's new text, or `null` when the file is already in the new shape. It must
  be idempotent: on its own output it returns `null`. It reads and writes nothing
  itself; it is given one file's text and returns text.
- **At a session start**, `.claude/hooks/session/session-brief.mjs` runs every
  migration the record's ledger does not hold yet, in number order
  (`.claude/hooks/lib/migrations.mjs`). The ledger is ran.json in a migrations
  folder inside the record's archive, and each file a migration changes is
  copied into that same folder first. A script that throws, or whose result it
  would change again, stops the run: nothing of it is written, the developer is
  told, and the next session tries again.
- **A release** (`dev/skills/release/release.mjs prepare`) refuses a change to
  any reader unless the format's version went up and a migration brings it to
  each new version, or the developer declares the shape unchanged with
  `--same-format <format>`.

The profile's move from its old flat shape predates this folder and stays in
`.claude/hooks/lib/profile.mjs`; a later change to the profile's shape comes here.
