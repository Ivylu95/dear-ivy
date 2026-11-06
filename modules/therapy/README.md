# Therapy module

The layer for working alongside her care: appointments, what she is working on
with her therapist, and what she means to raise next time. Nothing personal
lives here — her record is `data/` and only `data/`.

A Claude Code plugin ([`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)):
its skills load from [`skills/`](skills/), namespaced `therapy:<skill>`. Its data
lives in `data/therapy/` and nowhere else.

## Skills

| She... | Skill |
|---|---|
| has had an appointment | [`therapy:appointment`](skills/appointment/SKILL.md) |

The router row, with what must hold even if the skill never loads, is declared
in [`module.json`](module.json) and generated into `.claude/modules.md`.

## Blank shapes

Never written to with her content. [`module.json`](module.json) is the
authority on where each lands: `standing` files every record starts with,
`growing` folders that fill one file per entry, both under `data/therapy/`.

| Template | Copy to |
|---|---|
| [`templates/session.md`](templates/session.md) | `data/therapy/sessions/YYYY-MM-DD.md`, after each appointment |
| [`templates/what_im_working_on.md`](templates/what_im_working_on.md) | Standing — see `module.json` |
| [`templates/adhd-readme.md`](templates/adhd-readme.md) | Standing — `data/therapy/adhd/README.md`, see `module.json` |

## Evidence

[`knowledge/practices.md`](knowledge/practices.md) — cited practice behind this
module, same columns and rules as the core base in
[`modules/core/knowledge/`](../core/knowledge/README.md).

## What stays in core

The crisis floor, the safety plan, the person she would call on a bad night,
and the rule that her clinician outranks this system are in
`CLAUDE.md`, loaded every session whether or not this module is. A
module adds depth; it never holds the safety floor.
