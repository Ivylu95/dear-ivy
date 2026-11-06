# Import manifest

What was brought into the record, from where, and where each piece went. Written
by the import stage of the `set-up` skill; kept afterwards as the only record of where
imported material came from.

| | |
|---|---|
| **Started** | YYYY-MM-DD |
| **Source** | Kind of source, and where it was read from |
| **Raw copy** | `archive/YYYY-MM-DD_import-<label>/` |
| **Status** | inventoried · copied · mapped · validated · written · proven · learned |

## Inventory

Every path in the source, from `.claude/skills/set-up/scripts/inventory.mjs`, plus the four hand rows
below, owed even when nothing was found. Class is `personal`, `mixed`, `unsure`,
`harness` or `secret`; unsure counts as personal, and a secret is never copied.

| Path | Origin | Class |
|---|---|---|
| agent-memory | hand | |
| git:messages | hand | |
| git:edits | hand | |
| git:stash | hand | |

## Map

One row per destination: a source file that splits four ways has four rows.
`Reason` replaces a destination only for a personal path left in the archive
alone — say why. Tick `Done` when the write is committed.

| Path | Destination | Reason | Done |
|---|---|---|---|
| | | | |

## Conflicts

Where the source and the record disagreed. Both are kept, dated.

| Record said | Source said | Kept as |
|---|---|---|
| | | |

## Lessons

Written the moment something doesn't work, looks wrong, or the developer
corrects a step, and committed and pushed at once — a session can end without
warning. Specifics belong here; step 7 turns each into a general case in the
skill's `cases.md`. Status is `open` until then, `learned` after. An `open` row
left by a dead session is learned first next run.

| Date | What happened | Done instead | Developer's words, if a correction | Status |
|---|---|---|---|---|
| | | | | open |
