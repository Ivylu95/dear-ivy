# modules/

Layers on the harness, one folder per area of life. A module is
self-contained: its skills, its blank shapes, its evidence and the rows it adds
to the router all live in its own folder, and everything it keeps about her
lives in its own folder of the record, `data/<module>/`. Drop a folder in,
run `npm run modules`, and it enriches the whole harness; take it out, and
nothing else has to change.

`core/` is the one that is always on. The rest are optional.

## A module has

| Part | Holds |
|---|---|
| `module.json` | What the harness reads: its data folder, blank shapes, router rows and views (below) |
| `<module>/.claude-plugin/plugin.json` | Makes it a Claude Code plugin, so its skills load from inside the module. Needs `name` (the folder's) and a `description` |
| `<module>/skills/<skill>/SKILL.md` | One per session shape, loaded as `<module>:<skill>`. Prose, like any skill |
| `<module>/templates/` | Blank shapes only, never her content |
| `<module>/scripts/` | Optional. Scripts its skills run on its own data folder, each with its test, listed in `ux/lib/checks.mjs` |
| `<module>/knowledge/practices.md` | Cited evidence for this area. Core's folder also holds the subject list and the research log |
| `<module>/README.md` | What it covers, and where each blank shape lands |

## module.json

| Key | Means |
|---|---|
| `data` | Its folder in the record, `data/<data>/`. Defaults to the module's name |
| `standing` | Template → path under `data/<data>/`. Files every record starts with |
| `growing` | Folders under `data/<data>/` that fill one file per entry |
| `router` | Rows for the session router: `she`, `skill`, and `must`, what holds even if the skill never loads |
| `views` | Dashboard routes it owns, `{ "/route": "Label" }` |
| `root` | **core only.** Templates for the record's root, which is the harness's |

A record folder no module owns that holds a file fails `npm run modules -- --check`
(`strayFolders`): after a module or its folder is renamed, a chat still on the old
code can write blank copies back at the old name. Move them into the module's
folder, or into the record's archive folder, and say so in that record's
`README.md`.

One reader, `.claude/hooks/lib/modules.mjs`, serves every consumer: the
blank-record build, the dashboard, the link and sample checks, and the loader.

## Adding one

1. Make the folder with the parts above. Copy `therapy/` for the shape.
2. `npm run modules` (from `ux/`). It regenerates `.claude-plugin/marketplace.json`,
   which lists every plugin module, and `.claude/modules.md`, the router rows
   CLAUDE.md imports.
3. It then names the one line `.claude/settings.json` needs:
   `"<module>@dear-modules": true` under `enabledPlugins`. Claude Code loads a
   plugin only once it is enabled there. That file is the developer's to edit.
4. A dashboard view also needs its page under `ux/app/` and a line in
   `VIEW_MODULE` in `ux/lib/views.js`: Next.js finds routes only there.
   `npm run check` fails until the manifest and `VIEW_MODULE` agree.
5. Next session, its skills load. `npm run check` holds all of it.

## Rules

- **Nothing personal.** Her record is `data/`; a module only shapes it.
- **Never the safety floor.** Crisis handling, the safety plan and the profile
  belong to the harness. A module carries no hooks and no always-loaded
  instructions: a plugin cannot add to CLAUDE.md, and a module that could
  would be a second safety surface nobody reviews.
- **Its data, its folder.** A module writes only under `data/<module>/`. The
  shared things, like people, the timeline and the calendar, are core's; a
  module adds to them (one timeline line, a section in a person's file) and
  never keeps its own copy.
- **Nothing generated at runtime.** A module's skills are written, reviewed and
  committed like any other. The agent follows them; it does not write its own.
- **Record paths are stable.** A module never renames a `data/` path without
  shipping a migration in the same change.

## Why core is not a plugin

core's skills stay in `.claude/skills/`, loaded without any plugin. The
everyday session and first contact must not depend on a
marketplace being trusted or a plugin being enabled. core owns the blank shape
of `data/core/` and, alone, the record's root.

## Modules

| Module | Covers | Data |
|---|---|---|
| `core/` | The blank record and every core skill's blank shapes. Always on | `data/core/`, and the root |
| [`fitness/`](fitness/README.md) | What she eats, drinks and takes: the daily log and her supplements | `data/fitness/` |
| [`therapy/`](therapy/README.md) | Appointments and the work she does with her therapist | `data/therapy/` |
