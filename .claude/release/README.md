# .claude/release/

How this copy of the harness receives new versions. A release is approved by its
developer, signed, and pulled in by this copy only after its own checks pass and
its person types the approval phrase. The updater is
[`../hooks/lib/update/update.mjs`](../hooks/lib/update/update.mjs); the steps the
agent follows are in the `set-up` skill's [`update.md`](../skills/set-up/update.md).

| File | What it holds |
|---|---|
| `source.json` | A placeholder: the release repository's address names its owner, so it is pinned in the record, at `data/core/setup/release-source.json` (A-155). Read through `../hooks/lib/release-source.mjs`, the record's file first and this one after it, for a copy pinned here before the move |
| `release-key.pub` | The developer's public release key; every release's signature is checked against it, and no release may change it |
| `installed.json` | The release installed now, with every file's fingerprint; written by the updater, never shipped |
| `update-log.jsonl` | Every update applied, held back, rolled back or undone, one line each; written by the updater, never shipped |
