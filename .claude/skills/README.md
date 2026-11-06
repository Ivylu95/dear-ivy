# Skills

One skill per session type, loaded only when its description matches. The router
is the table in `CLAUDE.md`. **Crisis is not a skill and never becomes
one** — a dispatch decision can miss, and the safety floor must not depend on it.

## Folders

One folder per skill, its procedure in `SKILL.md`. When each fires is its
description there; for the session types, the router table in `CLAUDE.md`.

| Folder | Kind |
|---|---|
| [`a-person/`](a-person/SKILL.md) | Session: someone in her life |
| [`bright-spots/`](bright-spots/SKILL.md) | Session: a good day |
| [`commit/`](commit/SKILL.md) | Harness: writing a commit |
| [`first-contact/`](first-contact/SKILL.md) | Session: owed profile questions, or a first conversation |
| [`journal/`](journal/SKILL.md) | Session: writing something down |
| [`look-it-up/`](look-it-up/SKILL.md) | Session: a question that turns on evidence |
| [`looking-back/`](looking-back/SKILL.md) | Session: a review of the last few months |
| [`pattern-work/`](pattern-work/SKILL.md) | Session: a recurring loop |
| [`policy-review/`](policy-review/SKILL.md) | Harness: reviewing the policies |
| [`reminders/`](reminders/SKILL.md) | Session: a reminder she asks for, sent to her Telegram at that time |
| [`see-it/`](see-it/SKILL.md) | Session and harness: something she asks to see drawn — a diagram, timeline or map — in her chat, by default; the developer's diagrams, published pages with the vetted logos, only in development mode. The logo set, template and build ship with it; its tests and log are in `dev/skills/see-it/` |
| [`set-up/`](set-up/SKILL.md) | Session and harness: the whole life of a copy — start, import, check, update, repair, move, retire; its development half in `dev/skills/set-up/` |
| [`something-happened/`](something-happened/SKILL.md) | Session: an event |
| [`supplements/`](supplements/SKILL.md) | Session: her supplement list, shown as one table |
| [`therapy:appointment`](../../modules/therapy/skills/appointment/SKILL.md) | Session: after an appointment. Loaded from inside the therapy module, as a plugin |

The developer's own procedures (building the harness, writing skills, the end-of-session review, the safety eval, the sample record, git reconcile) live in `dev/skills/`, reached from development mode, and never ship. Each keeps a folder here named for it with dev- in front: a pointer the developer types as /dev- and the skill's name, which the agent cannot start and no release carries.

**Blank shapes live in `modules/`, never here.** A core skill's templates are in
`modules/core/templates/<skill>/`, one folder per skill that fills them; a
module's are in its own `modules/<name>/templates/`. Copy into `data/` when a
new file is needed — never edit a template with her content.

| Blank shape | Copy to |
|---|---|
| `modules/core/templates/a-person/person.md` | `data/core/people/<firstname>.md` |
| `modules/core/templates/pattern-work/pattern.md` | a new heading in `data/core/me/patterns.md` |
| `modules/core/templates/journal/journal.md` | `data/core/journal/YYYY-MM-DD.md` |
| `modules/fitness/templates/supplements.md` | `data/fitness/supplements.md` (fitness module) |
| `modules/core/templates/reminders/reminders.json` | `data/core/calendar/` as `reminders.json` |
| `modules/core/templates/first-contact/PROFILE.yaml` | `data/PROFILE.yaml` |
| `modules/core/templates/first-contact/now.md` | `data/core/state/now.md` |
| `modules/core/templates/first-contact/safety_plan.md` | `data/safety/safety_plan.md` |
| `modules/core/templates/import-data/manifest.md` | `data/core/state/imports/YYYY-MM-DD_<label>.md` |
| `modules/core/templates/look-it-up/practices.md` | `modules/core/knowledge/<subject>/practices.md` — harness, not her record |
| `modules/core/templates/skill-writer/log.md` | `.claude/skills/<skill>/log.md` — harness, not her record |
| `modules/core/templates/blank-record/` | the whole of a new `data/` — see [`modules/README.md`](../../modules/README.md) |

The three under `first-contact/` are the standing files that must exist before a
session can run at all; it is the only session type that creates them, and
`modules/core/module.json` names them so the sandbox and a missing-file rebuild
have them too.

Upkeep (`dev/specs/system/maintenance.md`, **MNT-001**) uses the same shapes
to rebuild a `data/` file that has gone missing — a shape is reachable from here
whether or not its skill ever loaded.
