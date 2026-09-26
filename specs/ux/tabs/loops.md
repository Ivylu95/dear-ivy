# Open Loops [LPS]

The binding specification for the view over threads left hanging: what it shows, what it will never ask of her, and why nothing on it can be ticked.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

| #   | Provision                                                       | What it means                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **This specification is the single source of truth for what this view asks of her, which is nothing.** | It is the view that looks most like a task list, and a task list is the one thing this record has promised never to become. The promise has to be written where the feature would be proposed. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply unchanged. |
| 2   | **It governs the view, never what lands in the list.** | What becomes an open loop, and that anything meant for a clinician is kept verbatim, is [`../../interaction/memory.md`](../../interaction/memory.md) (`MEM`). Whether the surface may write at all is [`purpose.md`](../purpose.md) (`DSH-001`).                                             |
| 3   | **It binds where it speaks and defers where it is silent.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Silence confers no authority to invent a requirement and attribute it here.                                                                                                                         |

---

## Specifications Register

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **LPS-001** | Nothing on this view can be marked done by the person reading it. | A checkbox she can tick is a filing job wearing a friendly hat. It converts the record from something kept for her into something she maintains, and the moment she forgets to tick one the record is wrong and it is her fault — which inverts the whole arrangement. These are settled in conversation, by the thing that wrote them. The test: no control on this view mutates anything, and the page says so rather than leaving her to try. | Render the state as a read-only mark and state in words that there is nothing to tick. It works because the absence is explained rather than merely present — an unexplained absence reads as a missing feature, and the next session adds it. Its limit: this is an instance of the surface-wide read-only rule and does not weaken it anywhere else. |
| **LPS-002** | The view states what is outstanding and never what is overdue. | Outstanding is a fact about the list; overdue is a judgement about her. A thread that has sat for four months is usually the one that was too hard to say, and a page that flags it as late has taken the single most delicate item in the record and put a deadline on it. The test: no item carries an age, a due date, a flag or an ordering that implies lateness. | Count only what is open, per group, and order outstanding items above settled ones without reference to time. It works because the ordering is by state rather than by age, so nothing has to be suppressed. Its limit: a group the record itself names for coldness is the record's language, not the view's — **LPS-003** governs it. |
| **LPS-003** | A thread the record has set aside is shown, not hidden. | Quietly dropping a cold thread from the view is a small deletion of exactly the kind this record does not do, and it deletes the most informative item in the list: six months untouched is information. Hiding it also makes the view disagree with the file it renders, which is how a reader stops trusting either. The test: every group the record holds appears on this view, including any it marks as gone quiet. | Render the record's own grouping unchanged, with its own headings. It works because the view then has no opinion to be wrong about. Its limit: this row requires the group to be *shown*, not given equal prominence — ordering remains the record's. |
| **LPS-004** | Items kept for a clinician are reachable from where she will look for them, not only from here. | The list exists so that something said once is available at the moment it is needed, and the moment it is needed is walking into a room — not while browsing a tab named after a filing concept. A view that is the sole home of that content has kept it perfectly and delivered it nowhere. The test: an outstanding item for the next appointment is visible from the home view and from the appointments view without opening this one. | Let other views lift the outstanding items of that group and link back here for the whole list. It works because the list stays single-sourced and the lifts are views onto it rather than copies. Its limit: a lift shows only what is outstanding, so this view remains the only place the settled ones are read. |
| **LPS-005** | A group with prose rather than items renders the prose. | Not every section of this list is a list. Some hold a paragraph the record wrote about the state of something, and a view that can only render items will show such a group as empty — which reports the opposite of what is there. The test: a group containing only prose renders that prose, and is not reported as having nothing in it. | Detect whether a group parsed into items and fall back to its rendered content otherwise. It works because the fallback is the raw source rather than a message about it, so nothing is lost in the degraded case. Its limit: a group holding both is rendered by whichever path matched, which is a parser question rather than a view one. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether a settled item is ever removed from the view, and where it goes if so.
- Whether the view distinguishes a thread she closed from one that stopped mattering.
- What the view does with a group that has neither items nor prose.
