# Fitness module

What she eats, drinks and takes, and how she trains and recovers, in one place:
a daily food log read from photos and labels, her supplement list with brands
and labels, her sets and lifts, and her sleep, soreness and energy. A record, never advice. Nothing personal lives here — her record is
`data/` and only `data/`.

A Claude Code plugin ([`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)):
its skills load from [`skills/`](skills/), namespaced `fitness:<skill>`. Its
data lives in `data/fitness/` and nowhere else.

## Skills

| She... | Skill |
|---|---|
| says what she ate, drank or took, or asks how her day looks | [`fitness:log`](skills/log/SKILL.md) |
| asks to see or change her supplements | [`fitness:supplements`](skills/supplements/SKILL.md) |
| tells you about a set, a lift or a session, or gives her bodyweight | [`fitness:training`](skills/training/SKILL.md) |
| says how she slept, how sore she is or her energy | [`fitness:recovery`](skills/recovery/SKILL.md) |

The router rows, with what must hold even if a skill never loads, are declared
in [`module.json`](module.json) and generated into `.claude/modules.md`.

## Blank shapes

Never written to with her content. [`module.json`](module.json) is the
authority on where each lands.

| Template | Copy to |
|---|---|
| [`templates/nutrition-readme.md`](templates/nutrition-readme.md) | Standing — `data/fitness/README.md` |
| [`templates/supplements.md`](templates/supplements.md) | Standing — `data/fitness/supplements.md` |
| [`templates/usual_meals.md`](templates/usual_meals.md) | Standing — `data/fitness/usual_meals.md` |
| [`templates/training.md`](templates/training.md) | Standing — `data/fitness/training.md`: sets, machines, bodyweight, recovery |
| [`templates/day.md`](templates/day.md) | `data/fitness/days/YYYY-MM-DD.md`, the first time something is logged that day |

## Script

[`scripts/fitness.mjs`](scripts/fitness.mjs) reads `data/fitness/training.md`:
`check` names an unreadable row, `summary` gives each lift's estimated best,
bodyweight and the week's recovery, `owed` lists sets whose reps were not given.
Its test is [`scripts/test-fitness.mjs`](scripts/test-fitness.mjs).

## Evidence

[`knowledge/practices.md`](knowledge/practices.md) — daily needs and upper
limits, and why every figure carries its source.

## What stays in core

The crisis floor, and the rule that her clinicians outrank this system, are in
`CLAUDE.md`. Everything else this module keeps, food and training alike, lives
in `data/fitness/`. Until 6 Nov 2026 the module was called nutrition and the
training log sat in the core folder.
