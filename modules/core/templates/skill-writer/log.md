# <skill-name> log

What this skill was grounded on, and when it is next checked (`PMM-005`,
`PMM-006`). Findings are not kept in full — a fresh search recovers them, and a
pile of them biases the next run toward confirming itself. What is kept is what
a search never returns: the dates, the scenarios, what was tried and reverted,
and a prediction for the next run to grade.

## Status

| | |
|---|---|
| **Last run** | YYYY-MM-DD |
| **Next due** | YYYY-MM-DD (6 months) |
| **Interval** | 6 months, or whenever a rule in the skill is disputed on its own grounds |
| **Model** | the model id this check ran under, e.g. claude-opus-5-5 |
| **Failed in use** | YYYY-MM-DD · what failed, no personal detail (only once one has; the newest) |

A re-check is due today, whatever Next due says, when the session's model is not
the Model above, when `.claude/skills/practice.md` moved after Last run, or when a
failure in use is recorded after it (the row above, an open case in `cases.md`, or
a failing or stale `evals-results.json`). `.claude/hooks/lib/currency.mjs` shows
it; the skill keeps running. Setting Last run and Model at the re-check clears it.

## Scenarios

The requests the skill was tested against, written before it was drafted.

| # | Request | Without the skill | With the draft |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Runs

One line each. A run that found nothing is still recorded.

| Date | Grounded on | What it changed |
|---|---|---|
| YYYY-MM-DD | Sources checked, each with where it stops applying here | |

## Tried and reverted

| Date | Rule | Why it was reverted | What would reopen it |
|---|---|---|---|

## Prediction

The next run grades this **before** writing its own.

| Left on | Claim | How to falsify | Outcome |
|---|---|---|---|
| YYYY-MM-DD | | | |
