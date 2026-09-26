# knowledge/

How the system stays current instead of quietly going stale. Nothing personal
lives here — this folder is about method, not about her.

| File | What it is |
|---|---|
| `log.md` | Thin tracker: when it last ran, and **what was tried and reverted**. |
| `practices.md` | The current distilled evidence base behind the stance `.claude/CLAUDE.md` works from. Every line cited. |

`practices.md` is the cross-cutting stance — the one behind `.claude/CLAUDE.md`
itself. Evidence about a single area of life goes in `<domain>/practices.md`
beside it: same columns, same rule that an uncited line does not belong in it.
**Create a domain folder the first time a session wanted that evidence and
didn't have it**, never in advance — an empty folder is a to-do list, and a run
will fill it with general advice nobody asked for.

## In a session

Read and filed through the [`look-it-up`](../.claude/skills/look-it-up/SKILL.md)
skill, and only when she has asked something her record can't answer. The order
is her record, then a row here, then a search; what a search finds is filed back
as one cited row, so the next session has it. **A row checked more than 12
months ago is re-checked before it is quoted.** A new subject file starts from
`.claude/skills/look-it-up/templates/practices.md`.

## The two evidence columns

| Column | Values |
|---|---|
| **Tier** | `1` guideline, systematic review or meta-analysis · `2` a single trial or cohort study · `3` a professional body's position, expert opinion or a narrative review · `—` nothing located |
| **Read** | `full` the source itself was opened · `record` only its abstract or catalogue record was reachable · `—` not verified |

Both travel with the claim to the moment it is said to her (**KNW-002**).

**There is no archive of past findings, on purpose.** Each run searches fresh
and unprimed; keeping old results would bias it toward re-confirming what it
already believed. `practices.md` holds the current answer; `log.md` holds the
local evidence that searching can't recover.

What a research run must hold to — one change per run, blind-search order,
citation and read-tier discipline, the revert rule, the immutable core:
`specs/system/maintenance.md` (**MNT-003**–**MNT-007**).

**The operating protocol itself is not yet written.** The spec says what must be
true of a run; no file yet says how to run one. Raised in
`data/state/proposals.md` (2026-09-20). Until it exists, a run follows the spec
and logs what it did here.
