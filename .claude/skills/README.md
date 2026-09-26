# Skills

One skill per session type, loaded only when its description matches. The router
is the table in `.claude/CLAUDE.md`. **Crisis is not a skill and never becomes
one** — a dispatch decision can miss, and the safety floor must not depend on it.

**Blank shapes live with the skill that fills them.** A template is a file in a
`<skill>/templates/` folder beside a `SKILL.md`: whichever skill writes a kind of
record file owns its shape. Copy into `data/` when a new file is needed — never
edit anything under a `<skill>/templates/` folder with her content.

| Blank shape | Copy to |
|---|---|
| `after-therapy/templates/session.md` | `data/therapy/sessions/YYYY-MM-DD.md` |
| `a-person/templates/person.md` | `data/people/<firstname>.md` |
| `pattern-work/templates/pattern.md` | a new heading in `data/me/patterns.md` |
| `journal/templates/journal.md` | `data/journal/YYYY-MM-DD.md` |
| `first-contact/templates/now.md` | `data/state/now.md` |
| `first-contact/templates/safety_plan.md` | `data/safety/safety_plan.md` |
| `look-it-up/templates/practices.md` | `knowledge/<subject>/practices.md` — harness, not her record |

The two under `first-contact/` are the standing files that must exist before a
session can run at all; it is the only session type that creates them.

Upkeep (`specs/system/maintenance.md`, **MNT-001**) uses the same shapes
to rebuild a `data/` file that has gone missing — a shape is reachable from here
whether or not its skill ever loaded.
