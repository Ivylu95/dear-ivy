# For Review [RVW]

The binding specification for the view over the queue the agent writes and may not act on: what it shows, what a decision here does, and what it can never reach.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

| #   | Provision                                                       | What it means                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **This specification is the single source of truth for the clearing half of the review mechanism.** | The writing half has worked since the first session; the clearing half had no surface, so the queue only grew. A human approval gate nobody can reach is not a gate, it is a backlog — and this file says what the surface that reaches it owes. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply unchanged. |
| 2   | **It governs the view over the queue, never the specifications it concerns.** | A decision recorded here authorises an edit; it does not make one. The prohibition on an agent editing the registers is unchanged by anything in this file, and no row here weakens it.                                                                                                                                                                |
| 3   | **This view can write, and that capability is exceptional.** | The surface is read-only by rule, with one narrow exception spent elsewhere. That this view writes at all is a live specification question recorded in the queue it renders, and the rows below constrain the capability as built rather than sanctioning it — an agent reads them as limits, never as authority.                                       |

---

## Territory

The lifecycle of one finding, and where this view sits in it.

```
    the agent finds something        it may not fix it
              |
    it writes a row                  citing a spec ID, nothing personal
              |
    THIS VIEW                        a person reads, decides, notes why
              |
    the row moves to Decided         appended, never erased
              |
    a person edits the register      a deliberate change, with a message

    ----------------------------------------------------------------
    what this view never touches:  the registers themselves, and
                                   every byte of the record
```

> 🧭 **This is the owner's design for the mechanism, not a snapshot of what runs today.** Where the two differ, the repository is wrong. The gap between the fourth step and the fifth is the approval gate; **RVW-002** exists to keep it open.

---

## Specifications Register

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **RVW-001** | This view can reach exactly one file, and no request can name another. | It is a view with a write behind it, pointed at a ledger that governs the rules of the system — which makes any path it accepts from outside a way to edit something else. The record is the thing that must be unreachable: a queue of findings about specifications has no business being one keystroke from a journal. The test: no input to this view or its write contributes to a path, and the resolved target is fixed before any request is served. | Resolve the single path once at load, through the harness resolver that already refuses anything climbing out of its folder, and take no path from a request thereafter. It works because there is no path parameter to validate rather than a validated one, which is the difference between a check that can be weakened and a capability that does not exist. Its limit: it constrains this view only, and says nothing about the resolver's own correctness. |
| **RVW-002** | A decision recorded here changes nothing in any specification. | The distance between deciding and editing *is* the approval gate. Collapsing it would make this view an editor of the registers, reached through a browser, by whoever holds a session — and the registers are the one thing in this repository deliberately placed beyond the agent's reach. This view shortens the queue; it does not remove the gate. The test: applying every possible decision leaves every register byte-identical. | Write only into the queue file, moving the finding word for word and composing nothing but the date and the outcome. It works because the write has no vocabulary with which to express a specification change. Its limit: it cannot stop a person making the edit afterwards, which is the point — that edit is deliberate, attributed, and carries a message. |
| **RVW-003** | Nothing is removed by being decided. | A decision can be reopened, and a queue that erases what it settles cannot record a reversal — only the absence of the thing that was reversed. It is the record's own rule applied to the machine's ledger, and it matters for the same reason: a history that quietly changes cannot be trusted by the next reader, who is usually a session with no memory of the first decision. The test: the count of findings never decreases, and a reopened item shows that it was decided and undecided rather than appearing new. | Append decided findings to their own section and rewrite the outcome line on a reversal rather than deleting the row. It works because the finding's own text is never the thing edited, so nothing can be lost by an edit going wrong. Its limit: the section grows without bound, which is a reading problem rather than an integrity one. |
| **RVW-004** | The view states what is waiting, not what has been cleared. | This is the only row in the surface that is a queue — everything else is reference, read when a question comes up. It carries a count because the exact failure it was built to fix is a backlog nobody could see the length of, and a count of what is settled measures the wrong thing: it makes the page look productive while the queue grows behind it. The test: the figure the view leads with, and the one shown beside its rail row, are both of what is outstanding. | Count open findings and render settled ones behind their own heading with their own figure. It works because the two numbers are never added together, so neither can flatter the other. This is a count of things on file, not of a person, and so is outside the rule that forbids counting her. |
| **RVW-005** | The queue's own preamble is rendered rather than restated. | The preamble says what a deviation is, what a proposal is, and who clears them — and it is the thing whoever edits the file keeps in step. A second copy written into the view is a second copy to keep in step, and the one that drifts is always the one further from the file. The test: the definitions on this page come from the file, and changing them in the file changes the page. | Render the file's own opening section as content. It works because the view then holds no vocabulary of its own to go stale. Its limit: it inherits the file's formatting, so a preamble written badly renders badly — which is the correct incentive. |
| **RVW-006** | If the queue cannot be found, the view says what that means about everything else on the surface. | A missing queue file is not a missing page; it means the surface is running against a checkout with no harness in it, and therefore that the machine's views do not describe the agent she is actually talking to. Reported as an ordinary empty state, that conclusion is unavailable to the reader and the other three machine views go on looking authoritative. The test: with the file absent, the view says the harness is missing rather than that nothing has been raised. | State the condition, name what could not be read, and say what it implies. It works because the notice carries the inference rather than leaving it to a reader who has no reason to draw it. Its limit: it speaks for this view; the same condition is reported independently by the harness view, which is duplication accepted deliberately because either may be opened first. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether the write this view performs is permitted at all, which is a question for the register above it and is already in the queue this view renders.
- Whether a decision records who made it, given that the record has one reader and the harness may not.
- What the view does when two findings supersede each other, which the queue has already produced.
