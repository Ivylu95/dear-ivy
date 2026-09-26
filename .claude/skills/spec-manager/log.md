# Spec-manager log

The currency ledger for the **Language** table in [`SKILL.md`](SKILL.md) — the
one rule table here that goes stale while still reading as plausible. It was the
harness-writer log until the two skills split on 2026-09-21; rows above that
date cover the stance and maps too, which now live in `harness-writer`. Findings and citations are not kept here; those are recoverable
by searching again, and a pile of them biases the next run toward confirming
itself. What is kept is what a fresh search will never return: when this was
last checked, what was tried and reverted, and the prediction each run leaves
behind for the next one to grade.

Not the same ledger as `knowledge/log.md`. That one tracks research
currency for what the assistant says **to her**; this one tracks how this skill
guides and writes. `ARC-013`, *"Every fact has one authoritative home; everything else points to it."*

## Status

| | |
|---|---|
| **Last run** | 2026-09-21 |
| **Next due** | 2027-03-21 (6 months) |
| **Interval** | 6 months, or whenever a rule is disputed on its own grounds |
| **Lengthening the interval** | Only where the last prediction was **graded and held**. Two quiet runs are not evidence the file is stable — they are equally evidence the check stopped detecting, and those two look identical from inside. |

## Runs

One line each. A run that found nothing is still recorded; a skipped run and a
clean run must not look alike. Past twelve rows, consolidate to one line per
year and keep the reversals in full — they are the part that cannot be
re-derived.

| Date | Outcome | What changed in `SKILL.md` |
|---|---|---|
| 2026-09-21 | First run, prompted by a live dispute over `ARC-003`'s register — whether a spec statement should read as law or as plain English. Grounded on INCOSE's *Guide to Writing Requirements* (v4 summary sheet returned 403; rules read from a secondary explainer and cross-checked against the Jama and Visure summaries — **the primary is unread and the rule numbers rest on secondaries**) and on plain-language legal-drafting research. Found the decisive claim: plain drafting is as accurate as legalese and often more precise, so Latinate vocabulary costs readability and returns nothing. Found that **three of the seven applicable INCOSE rules do not transfer** — active voice (R2), avoid negation (R16), avoid absolutes (R26) — because a register row is an invariant over a repository, not a behaviour of a system. Those three are the ones an agent reaches for first. | Skill created. **Language** table written with the transfer/no-transfer column, which is the finding that matters. House-voice exemplars taken from the existing `ARC` register rather than invented. |
| 2026-09-21 | Scope widened from the specs folder to the whole harness, and the skill renamed `spec-writer` → `harness-writer`. Grounded fresh on the prompt and lifecycle layers via `/manage-harness`. The decisive finding on persona: expert personas **do not** improve factual accuracy and can depress it — measured across six models on GPQA Diamond and MMLU-Pro, with nine significant negative differences and none reliably positive — while improving human-preference alignment, the same prompt with opposite signs. Role injection also measurably **reduces clarity**, which is the wrong trade for an opening map. Two further findings changed the shape: current models over-trigger on aggressive prompt language, so no new emphasis was added; and skill-authoring guidance says plainly to avoid offering too many options, which the eleven-row map was doing. On the lifecycle side, self-grading endorses wrong output at a rate high enough that a run must not score its own change. | **Stance** section added — behavioural rules and a routing rule (*stance governs the conversation, procedure governs the file*), deliberately **not** an identity paragraph and carrying **no expertise claim**. **Opening** gained a named default, an explicit stop-and-wait, and a re-openable map. **Keeping itself current** widened from the Language table to the whole file, and gained: grade the prediction first, amend row by row, nothing grades its own output, improvement is not assumed monotone, and the write boundary named as the mutability gate it already was. |
| 2026-09-21 | Renamed `harness-writer` → `spec-manager` on the owner's instruction, with its `/` command. Name only: scope, rules and tables unchanged, and no re-ground. | Nothing |
| 2026-09-21 | Split in two on the owner's instruction: `harness-writer` returns for the harness the agent edits directly, and `spec-manager` keeps only the specs — read first, drafting, language, handing over, removal, and this ledger. The **Language** table moved unchanged, so no re-ground. | Scope narrowed to `specs/`; applying a spec now requires the owner's word in-session, logged under Authorised edits |
| 2026-09-21 | Audit via `/manage-harness` on the prompt, loop and lifecycle layers — not a re-ground, so the Language table was not re-searched and no prediction is due. INCOSE GtWR v4 (2023) rule numbers R2, R5, R7, R16, R18, R26 confirmed by agreeing secondaries; the primary still returns 403. Findings raised in conversation and approved. | A yes to a draft now means the owner applies it, and removals are drafted the same way; the Propose step points at `.claude/REVIEW.md`; R16 glossed as "state the positive"; a pointer to real drafted rows as the example. **Keeping itself current** now re-grounds the Language table only — narrowed from the whole file by the split |

## Tried and reverted ⭐

The reason this file exists. A rule that made the work worse must not be
re-introduced by a later run because the literature likes it — only because new
evidence addresses **why it failed here**. Each row carries what that evidence
would have to look like, so a reversal is a closed question rather than a
forbidden one.

| Date | Rule | Evidence it rested on | Why it was reverted | What would reopen it |
|---|---|---|---|---|
| 2026-09-21 | Legal-register vocabulary in statements — *ascertainable*, *severable*, *without remainder* | Legal drafting convention; the assumption that legalese buys precision | Read as a different author from its sixteen neighbours, in a table whose whole claim is that rows can be compared at a glance. The precision was available in plain words and belonged in the rationale regardless. | A precision a register genuinely needs that plain words cannot carry — a distinction lost in translation, shown in a row, not argued in the abstract. |
| 2026-09-21 | *easily* as a qualifier in a statement | Ordinary speech; it is how the property is described out loud | Unmeasurable, so the rationale could not state a test for it. INCOSE R7. | A measurable reading of the qualifier — a stated threshold that makes it testable. Then it is no longer the qualifier that was reverted. |

## Prediction

Each run leaves one falsifiable claim, and the next run grades it **before**
writing its own. An ungraded prediction is decoration.

| Left on | Claim | How to falsify | Outcome |
|---|---|---|---|
| 2026-09-21 | The three non-transferring INCOSE rules (R2, R16, R26) will still not transfer, because the reason is structural — a register states invariants, not system behaviours — and not a matter of the field's fashion. | Find requirements-engineering guidance written for **invariants, constitutions or policy registers** rather than for system behaviour. If such guidance exists and rules on voice, negation or absolutes, the transfer column is decided by it, not by this reasoning. | *ungraded — due 2027-03-21* |
| 2026-09-21 | The stance will be read as tone and changed on taste rather than on evidence, and the first edit to it will remove the "no expertise claim" constraint as pointless — the constraint most directly supported by measurement and the least intuitive. | Read the stance's edit history at the next re-ground. If it still carries no expertise claim and no aggressive emphasis, this is falsified and the constraint holds without defending. | **Retired 2026-09-21, ungraded** — the stance moved to `harness-writer` in the split, and that skill keeps no ledger. Not held, not falsified: nothing will check it. |

## Standing questions for next run

| Question | Why it is open |
|---|---|
| Is there a primary INCOSE source reachable without a 403? | The rule numbers in the Language table rest on secondary explainers. They agree with each other, which is weak corroboration, not a primary reading. |
| Does ISO/IEC/IEEE 29148's verbal-forms guidance change anything? | It is already cited in `REFERENCES.md` but paywalled, and it was not consulted on language. Its *shall/should/may* split may or may not reach a register written in the indicative. |
| Should length be a stated cap rather than "match your neighbours"? | The current rule is relative, so it drifts upward one row at a time and nothing measures it. `CTX-001` solves the same problem elsewhere with a counted cap. |
| What outside signal grades a guiding turn? | *Nothing grades its own output* is written into the skill, but the conversational half has no error-independent signal yet — a gate runs on a hook, nothing runs on a map. The candidate is whether a question had to be asked twice. |
