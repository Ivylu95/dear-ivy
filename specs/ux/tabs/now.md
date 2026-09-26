# Now [NOW]

The binding specification for the surface's home view: the first thing opened, what it may draw together, and the order it owes the reader.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

The provisions below fix this specification's purpose and the reach of its authority. The register further down governs the home view instead.

| #   | Provision                                                                     | What it means                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **This specification is the single source of truth for what the home view is for.** | Every other view has a subject named on the rail; this one has no subject of its own, which makes it the view most easily turned into whatever seemed useful that week. This file states what it is instead. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply to it unchanged.                                |
| 2   | **It governs what this view assembles and in what order, never appearance or reach.** | How it looks is [`design.md`](../design.md) (`DES`); what it may send is [`privacy.md`](../perimeter.md) (`DPV`); whether the surface may write at all is [`purpose.md`](../purpose.md) (`DSH`). What may appear here, and what may never, lives in this file.                                                                                                       |
| 3   | **It binds where it speaks and defers where it is silent.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Silence confers no authority to invent a requirement and attribute it here. Where this file and a view-specific spec under this folder appear to conflict, the more specific file governs its own route and this one governs what is *lifted onto* the home view.               |

---

## Territory

What this view is permitted to draw together, and the order it owes them.

```
    the snapshot          what is current, in the record's own sectioning
        |
    what is ahead         the next few dated things
        |
    what is unsaid        what she meant to raise and has not
        |
    what just happened    the most recent lines of the spine
        |
    the standing things   the current focus, the people on file

    ----------------------------------------------------------------
    never on this page:  any count of her, any interval since,
                         any figure derived from how often she writes
```

> 🧭 **This is the owner's design for the view, not a snapshot of what renders today.** Where the two differ, the repository is wrong. The order is normative; the exact sections are not exhaustive, and a new one is admitted by the rows below rather than by this drawing.

---

## Specifications Register

The normative part of this file. Each row is one thing that must be true of the home view; how a row is read is in [`README.md`](../../README.md).

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **NOW-001** | The home view renders the same read a conversation begins with, in the same order. | It is the only view with no subject of its own, so the question it silently answers is "what matters". Any ordering it invents is a second opinion about her life, arrived at by whoever last edited a layout — and the record already holds a first opinion, written deliberately, by the thing that keeps it. Divergence costs the one property that makes this view trustworthy: that what she reads here is what the next conversation will have read. The test: the sequence of sources on this page matches the retrieval order the instruction file mandates, with no source lifted above another for visual balance. | Read the snapshot, then the spine, then only what those two point at, and render them in that order. It works because the ordering decision is made once, in the record's own rules, and this view inherits rather than repeats it. Its limit is that inheritance is not enforceable by a build gate — a reordering here is a code review question, not a test failure — so the order is written down here to be checked against. |
| **NOW-002** | No view of the record ever states a quantity, frequency or interval describing the person. | The harm is not the number; it is that a number invites a target. Entries this month, days since the last one, sessions held — each turns a record she is free to ignore for six weeks into a thing she is failing at, and the failure mode is silent because the metric looks like neutral information right up to the moment it is read as a score. This is the firmest rule the surface has, and it is stated here because the home view is where such a figure is always proposed first. The test is a sweep: no rendered figure on any view of the record is derived from how much or how often she has written. | Permit counts only of things **on file** — how many people have a file, how many threads are outstanding — and never of her activity. It works because the distinction is checkable at the point the figure is computed rather than at the point it is rendered, so the rule lives beside the data access rather than in a reviewer's memory. It does not reach the machine's own views, where a count of commits or of queued findings describes the repository and not a person. |
| **NOW-003** | Before anything real is on file, the view changes shape rather than showing its sections empty. | A grid of empty panels reads as a broken system; one sentence reads as a record that has not started, which is the truth. The difference decides whether a first opener concludes something is wrong with the software or that nothing has been said yet — and the first conclusion is the one that ends the relationship on day one. The test: with an empty record the page shows no section that has nothing in it, and says plainly what will fill it. | Branch on whether the record holds anything at all, and render a single stated welcome in that case. It works because emptiness is a property of the whole record rather than of each section, so one test at the top replaces a placeholder in every panel. Its limit is the partial case — a record with a snapshot and nothing else — which is not the blank state and is handled per section by **NOW-004**. |
| **NOW-004** | A section with nothing in it is absent, and a section whose source is missing says so. | These are two different facts and collapsing them loses the one that matters. "Nothing has happened yet" is ordinary; "the file this came from could not be read" is a fault, and a view that renders both as a quiet gap hides the fault behind the ordinary case. The cost is a page that looks correct while showing a fraction of the record. The test: with a source deliberately removed the view reports it, and with a source present but empty the view omits the section without comment. | Carry a filled flag beside the content and a separate readable flag, and let the first govern omission and the second govern a stated notice. It works because the two conditions are distinguished where the file is read rather than inferred downstream from an empty string. It does not extend to a source that parses into the wrong shape, which reads as filled and is why the safety view carries its own stronger rule. |
| **NOW-005** | What is due to be said to a clinician appears here, not only where it is filed. | It is kept verbatim so that it can be carried into a room, and a thing kept for that purpose is useless if it is only found by someone who went looking for it. The person who most needs it is the one with an appointment tomorrow who has not thought to open a tab named after a filing concept. The cost of getting this wrong is measured in appointments where the thing that mattered went unsaid again, which is the exact failure the record keeps it against. The test: an outstanding item for the next appointment is visible without leaving the home view. | Lift the outstanding items of that one group onto this page, above the recent history, and link to the full list rather than reproducing it. It works because the group is identified in the record itself rather than by position, so a reordering of that file does not silently empty this section. Its limit: only outstanding items are lifted — a settled one belongs to the history of that list, not to the front page. |
| **NOW-006** | Anything lifted onto this view keeps its provenance and its marking. | This page is a digest of five sources, and a digest is exactly where a quoted line stops looking quoted. Two markings must survive the lift: where the line came from, and whether it is her account or a reading of it. Losing the first turns a record into a screen telling her things; losing the second lets an inference be read back to her as something she said, which is the failure the memory rules exist to prevent. The test: every block on this page can be traced to its source from the page itself, and anything marked as inferred in the record is still marked here. | Render the source path beneath each lifted block and carry the inferred mark through as a visible tag on the entry. It works because both facts travel with the content from the read rather than being reattached by the view. Its limit is prose the record itself has not marked — this view cannot distinguish a reading from an account the record recorded as an account. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether this view may ever show something the record has not been asked for — a prompt, a suggestion, a thing to consider.
- What it does when the snapshot is older than the most recent event on the spine, which is the state after a session that wrote and did not close.
- Whether the section order may vary by what is imminent — a hard anniversary inside a fortnight, an appointment tomorrow.
