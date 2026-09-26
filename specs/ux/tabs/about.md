# About [ABT]

The binding specification for the view in which the system explains itself: what it promises, what it refuses, and where it keeps things.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

| #   | Provision                                                   | What it means                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **This specification is the single source of truth for what the surface tells her about itself.** | The promises this system runs on are written in the instruction file, which she does not read. A promise a person cannot read is not one they have been made, and this view is where that is repaired. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply unchanged. |
| 2   | **It governs the contract, not the mechanism.** | How a conversation becomes a record is the workflow view's, specified in [`workflow.md`](workflow.md) (`WKF`). What the instructions actually say is the harness view's, in [`harness.md`](harness.md) (`HRN`). This page says what is promised and what is refused.                              |
| 3   | **It binds where it speaks and defers where it is silent.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Silence confers no authority to invent a requirement and attribute it here.                                                                                                                                    |

---

## Specifications Register

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **ABT-001** | The promises the record is built on are stated here in the second person, in plain words. | They are three: she never files, nothing is ever deleted, and this is not a clinician. Each is a commitment that shapes what she can safely rely on, and each currently lives in a file written for a machine. Stated only there, they are architecture; stated here, they are a promise she can hold the system to — and being able to hold it to one is the difference between trusting it and hoping. The test: each of the three appears on this page, addressed to her, without conditions attached. | Write them as three short paragraphs under one heading, each leading with the promise itself. It works because the reader gets the commitment before the reasoning, so a skim still delivers all three. Its limit: a restatement can drift from the instruction file it mirrors, and nothing mechanical catches that — it is a review question on any change to either. |
| **ABT-002** | The page states what the system refuses to do, not only what it does. | A refusal is the harder thing to discover and the more load-bearing of the two: that it will not count how often she writes, that there is no streak and no score, is the reason the rest is safe to use. Listing only capabilities produces a page that reads as a product tour, and a product tour is where a feature nobody wanted gets justified later by "it was always meant to". The test: the page names at least the refusals the rest of the surface is specified to keep, and states them as limits rather than as boasts. | Set them as prose rather than as tiles. It works because a limit stated as a tile reads as a feature and invites the reader to weigh it as one. Its limit: prose is easier to quietly edit than a list, which is why the refusals are also specified in the views that keep them. |
| **ABT-003** | The page says the surface reads and never writes, and links to how the writing actually happens. | "It reads them; it never writes to them" is the single most important fact about this window, and it raises an obvious question — then who does? A page that makes the claim and leaves the question hanging invites the reader to conclude that nothing writes, which is worse than not making the claim. The test: the read-only claim and a route to the mechanism appear together. | State the claim and link onward to the view that draws the mechanism. It works because the two pages then split the job cleanly: this one is the contract, that one is how it is kept. Its limit: the claim covers the surface, and the surface's single narrow write exception is specified elsewhere — this page does not restate it. |
| **ABT-004** | Where the record keeps things is shown from the record's own map, not restated here. | A second description of the folder layout is a second thing to keep in step, and the copy always loses. It also matters that what she reads is the same map a session uses — a page describing an idealised structure while the record uses another is a page that will mislead her at exactly the moment she goes looking for something. The test: the layout shown on this page is rendered from the record's own index, with its provenance visible. | Render the index file's own content and show its path. It works because a move that updates the index updates this page in the same change, which is already required of any move. Its limit: it inherits whatever the index says, so a stale index is a stale page — an upkeep concern rather than a view one. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether this page should name who can open the record and how that is enforced, or leave it to the perimeter rules.
- Whether the promises are versioned — whether a reader can see that one of them changed, and when.
- Where the line sits between this page and the workflow view, given both describe the system to her.
