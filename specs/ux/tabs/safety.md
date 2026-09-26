# Safety Plan View [SPL]

The binding specification for the one view in this surface with a job other than being read: what must be reachable on the worst night it will be opened on, and in what order.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

| #   | Provision                                                            | What it means                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **This specification is the single source of truth for how the plan is presented.** | Every other view is specified for a reader who is fine. This one is specified for the state it will actually be opened in, and every row below follows from that rather than from a preference. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply unchanged.                                                    |
| 2   | **It is subordinate to the safety floor, without exception.** | [`../../interaction/safety.md`](../../interaction/safety.md) (`SAF`) governs what happens to a person in a crisis and outranks every row here and every other row in this repository. Where this file and that one appear to conflict, this file is what gives way, and the conflict is a finding to raise rather than a judgement to make in the moment.             |
| 3   | **It binds where it speaks and its silences are not permissions.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Where this file is silent about something that could make the numbers harder to reach, the conservative reading governs — this is the one register in the repository where silence is read against the change rather than for it.                                             |

---

## Territory

The order this view owes, top to bottom, in every state it has.

```
    title                   one line, then one line of subtitle
    ------------------------------------------------------------
    the numbers             FIRST CONTENT. dialable. never scrolled to.
                            three states: parsed / raw / unreadable
    ------------------------------------------------------------
    who it was built with   and when it was last looked at
    her own reasons         lifted above the rest of her plan
    the rest of the plan    in the record's own order
    ------------------------------------------------------------
    the card                paper only. same numbers, same parse.

    never on this page:  a mood check, a risk score, a question about
                         how she is, or any encouragement of the
                         surface's own composition
```

> 🧭 **This is the owner's design for the view, not a snapshot of what renders today.** Where the two differ, the repository is wrong. The order above is normative and is the subject of **SPL-001** and **SPL-004**.

---

## Specifications Register

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **SPL-001** | The means of reaching a person are the first content on the page, in every state it has. | Scrolling past things is exactly what is hard in the state this page is opened in, and every element placed above the numbers is a thing to get past. It is first content rather than first element because a title and a subtitle are not scrolled past — they are the page naming itself, and removing them would make this the one view that does not open like a view. The line being crossed is the fold on the smallest screen, not the pixel above the heading. The test: on a phone, with the largest reading size the surface offers, a number is visible without scrolling. | Render the contact block as the first section under the page head, before her plan and before any section of it. It works because the position is structural rather than a consequence of what happens to be filled — the block is not conditional on the plan existing. Its limit: it constrains order, not size, and a future addition above it is a breach of this row regardless of how small it is. |
| **SPL-002** | Every number on the page can be dialled in one action. | A number to read and remember is a number to get wrong, and a number to copy out is two actions and a keyboard. The design target is one tap with no aim required, because aim is among the things that go first. The test: every rendered number is actionable directly, and its target is large enough to hit without precision at the surface's smallest reading size. | Render each number as a dial link at the surface's number size, stripping spacing from the target while leaving the displayed digits as her plan writes them. It works because what is shown stays legible and what is dialled stays valid, which a single string cannot do. Its limit: a device that cannot place calls falls back to whatever it does with such a link, which is outside the surface's control. |
| **SPL-003** | The numbers come from her record and exist nowhere else in the surface. | A copy in the code is a copy that goes out of date without anyone noticing, and the failure mode is a wrong number on the worst night. This extends to every rendering on the page: a printed card assembled from its own list is a second copy introduced on the one page that cannot have one. The test: exactly one parse of one source feeds every rendering of a number on this view. | Parse once and render every block — screen and paper — from that one result. It works because a divergence becomes impossible rather than unlikely. Its limit: it says nothing about whether the numbers in the record are right, which is a matter for her and her care team. |
| **SPL-004** | Her own words are placed above anything the surface has to say, and the surface adds no encouragement of its own. | What she wrote on a better day is worth more than anything this could compose, and it is worth more precisely because it is hers — a sentence the surface adds is a stranger's voice in the one place she came for her own. It also crowds out: every line of the surface's prose is a line above her reasons. The test: no sentence on this page is reassurance the surface wrote, and her reasons appear before the remainder of her plan. | Lift her reasons and what helps her out of the record's ordering to the top of the plan, and restrict the surface's own text to labels and stated degradations. It works because the reordering happens at the read, so the rail beside the page and the page itself cannot disagree about what is on it or in what order. Its limit: the lift depends on those sections being identifiable in the record. |
| **SPL-005** | A failure to read the plan is stated, never rendered as an absence. | An empty box where the numbers were is indistinguishable from a plan that never had any, and it is the one outcome this page may not produce. The parse has been wrong before; a renamed heading or a reformatted plan must degrade to something that still helps rather than to a clean and empty panel. The test: with the plan deliberately malformed, the page says it could not read it and shows what it has anyway. | Fall back through three states — parsed, her own unparsed words, then a stated total failure naming a local emergency number — and label each. It works because each state is strictly less useful than the last rather than a different design, so no failure lands somewhere unconsidered. Its limit: the final state cannot know which country she is in, so it names the category rather than a number. |
| **SPL-006** | The plan can be taken off the screen. | Paper needs no battery and no password, and the night it is needed is not the afternoon she would think to prepare it — so the offer has to be visible while she is fine. A plan that exists only behind a sign-in on a charged phone has a failure mode that is entirely foreseeable. The test: the page offers a physical copy from its own header, and what it produces is legible without the screen it came from. | Offer printing from the page head, and lay out a wallet-sized card carrying the numbers on its own page. It works because the card and the cupboard door are two different objects doing two different jobs, and the card is the one that works somewhere she did not plan to be. Its limit: the card is offered only when the numbers actually parsed, per **SPL-005**. |
| **SPL-007** | The view never asks her how she is. | A mood check, a risk score or a scale on this page turns the one place she came to for a phone number into a thing that wants something from her first. It is also the point at which the surface would begin forming a clinical opinion, which it has no standing to hold. The test: no control, prompt or question on this view solicits input about her state. | Keep the page to two things — a phone book and a letter from herself — and admit no third. It works because the constraint is stated as an identity rather than as a list of banned widgets, so a novel proposal still has to argue against it. Its limit: it governs this view; what a conversation asks is the safety floor's, and it asks plainly. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether the numbers are reachable from anywhere in the surface other than this view, and whether they should be.
- What the view does when the plan names a person with no way to reach them.
- Whether the page may ever be reachable without a session, on the argument that a sign-in is a barrier on the worst night — and what that would cost against the perimeter rules.
