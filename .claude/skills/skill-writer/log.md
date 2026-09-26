# skill-writer log

What this skill was grounded on, and when it is next checked (`SKL-004`,
`SKL-005`). Findings are not kept in full — a fresh search recovers them, and a
pile of them biases the next run toward confirming itself. What is kept is what
a search never returns: the dates, the scenarios, what was tried and reverted,
and a prediction for the next run to grade.

## Status

| | |
|---|---|
| **Last run** | 2026-09-21 |
| **Next due** | 2027-03-21 (6 months) |
| **Interval** | 6 months, or whenever a rule in the skill is disputed on its own grounds |

## Scenarios

The requests the skill was tested against, written before it was drafted.
Tested cold by a subagent given only `SKILL.md`.

| # | Request | Without the skill | With the draft |
|---|---|---|---|
| 1 | A new skill that summarises her journal every Sunday | A skill written from memory, no search, no test, no log | Round 1: steps right; missed that "every Sunday" is not a skill's to do. Fixed with the clock gate. Round 2: gate stops it; asked who takes the clock work, and whether a skill reading her record needs its own safety rules — both answered in the draft |
| 2 | A typo in another skill's description | — | Round 1: correctly declined, to `harness-writer` |
| 3 | About to use a skill whose log is overdue | Used as written, staleness never noticed | Round 1: would block the task behind a research cycle, and never moved Status on. Fixed: never blocks, re-tests, stamps Status. Round 2: "say once it is overdue" could mean talking to her about the system. Fixed: in her session nothing is said, a finding goes to a developer. Round 3: both paths walked correctly; stamp now sets Last run and clears the overdue finding |

## Runs

One line each. A run that found nothing is still recorded.

| Date | Grounded on | What it changed |
|---|---|---|
| 2026-09-21 | Anthropic, *Skill authoring best practices* (platform.claude.com, read in full) — concise, third-person description of what and when, body under 500 lines, references one level deep, evaluations before documentation; **it also says a "writing skills" skill is not needed for the format**, which is why this skill carries no format lessons. Claude Code, *Skills* (code.claude.com) — frontmatter fields, description plus `when_to_use` capped at 1,536 characters, loaded content stays in context across turns; stops applying outside Claude Code. mgechev, *skills-best-practices* (GitHub, practitioner, secondary) — negative triggers in descriptions, LLM-driven validation; one author's practice, not measured. | Skill created. Cold test round 1 found six gaps and round 2 six more, all fixed before commit; round 3 walked every path correctly, with two small fixes — the clock gate, the data/ exception named, terms defined, IDs cited with statements, re-grounding made non-blocking with a re-test and a Status stamp, and this log written. **Departure from `SKL-005`'s design:** the design says a skill re-searches before it is used; this skill finishes the task in hand first, because a save waiting behind a research cycle is the worse failure. |

## Tried and reverted

| Date | Rule | Why it was reverted | What would reopen it |
|---|---|---|---|

## Prediction

The next run grades this **before** writing its own.

| Left on | Claim | How to falsify | Outcome |
|---|---|---|---|
| 2026-09-21 | By the next run, fewer than half of the other skills will have a log, because nothing opens a skill's log unless that skill is loaded for a rewrite — the gap the "Where this falls short" section names. | Count `log.md` files beside `SKILL.md` in `.claude/skills/`; half or more falsifies it | |
