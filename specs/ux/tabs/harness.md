# Harness [HRN]

The binding specification for the view over the instructions themselves: everything the agent is told, readable without leaving the surface, and never confusable with the record.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

| #   | Provision                                                     | What it means                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **This specification is the single source of truth for how the instructions are read back.** | The harness decides how every conversation goes, and until it had a view the answer to "what did I tell it to do?" lived entirely with whoever last edited it. An amendment you cannot review first is not traceable in any sense that helps. The reading rules, the binding rule and the approval gate in [`README.md`](../../README.md) apply unchanged. |
| 2   | **It governs a reading of the harness, never the harness itself.** | What the instructions may say is the business of every other register in this folder. How the harness is laid out is architectural. What changed in it is the changes view's, in [`changes.md`](changes.md) (`CHG`); what is argued about it is the review view's, in [`review.md`](review.md) (`RVW`).           |
| 3   | **It binds where it speaks and defers where it is silent.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Silence confers no authority to invent a requirement and attribute it here.                                                                                                                                                      |

---

## Territory

The reach of this view, and the wall on the other side of it.

```
    .claude/                      everything here is readable
      CLAUDE.md                   the always-loaded instruction
      skills/    hooks/           what loads on a match, what runs regardless
      specs/     commands/        the design, and the operator procedures
      knowledge/ REVIEW.md    what was learned, what was argued

    ------------- the resolver refuses to cross -------------

    data/                         unreachable from this view, at any depth,
                                  by any path a request can name
```

> 🧭 **This is the owner's design for the view's reach, not a snapshot of disk.** Where the two differ, the repository is wrong. The named entries are illustrative; the wall is **HRN-002** and is not.

---

## Specifications Register

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **HRN-001** | The view presents the harness in the harness's own order and names it by its own names. | A page about a folder that disagrees with the folder is worse than no page: a reader who cannot map what they see onto what is on disk has to hold two structures in their head, and the one they act on will be the wrong one. Themed groupings are the tempting version of this, and they always need one invented category to hold whatever did not fit. The test: the entries on this view, in order and by name, match the folder. | Render the top of the folder as the folder presents it, adding nothing but a sentence against each entry. It works because there is no mapping to maintain and therefore none to drift. Its limit: it inherits a bad folder layout, which is the correct incentive — the fix belongs in the layout. |
| **HRN-002** | This view cannot render a byte of the record, at any depth, by any path. | It is the one part of the surface that takes a path from the address bar, and the folder it reads sits beside the one holding everything personal. A traversal here is not a leak of a configuration file; it is her journal rendered on a page about the machine, reached by editing a URL. The test: any path that resolves outside the harness folder is refused, including by climbing, by absolute form, and by any encoding of either. | Resolve every path through one function that rejects anything landing outside the folder, and give this view no other way to read a file. It works because the check is at the single point of access rather than at each caller, so a new route inherits it. Its limit: it protects this view's reads and is not a substitute for the surface-wide perimeter. |
| **HRN-003** | Each entry carries a sentence saying what it is for. | The names alone are opaque and opaque in a way the folder cannot repair: two sibling folders can be equally unreadable as names, and which of them holds something that runs unattended is not deducible from either. That sentence is the only thing on this page the folder cannot supply, and it is the whole reason the view is worth more than a file listing. The test: every entry at the top of the folder has a description, and none of them is its own name restated. | Use a hand-written line where one exists and fall back to the entry's own opening paragraph. It works because the fallback degrades to the thing the entry says about itself rather than to silence, so a new area is never undescribed. Its limit: a fallback paragraph written for another purpose can read oddly here, which is a signal to write the line. |
| **HRN-004** | Nothing on this view changes anything. | A page that shows what the agent is told is one step from a page that adjusts it, and the step looks small — a toggle beside a hook, a switch on a skill. Changing the harness is a deliberate edit to a committed file, by a person, with a message saying why; a control here would make it an unattributed change nobody can find later. The test: no control on this view or below it mutates a file. | Render every entry as content, with no control that has an effect. It works because the absence is total rather than conditional, so there is no state in which a control appears. Its limit: this view's own read-only nature does not extend to the review view, which writes to the harness and is specified separately and exceptionally. |
| **HRN-005** | A file is reached from the view by the same path it has on disk. | The value of this view is that it answers a question about a real folder, and an address scheme of its own would break that at exactly the moment someone wants to open the file for real. It also keeps every pointer in the repository live: a reference in a commit message or a finding names a path, and that path should navigate. The test: the address of any file in this view contains the path of that file, and the header of the page states it. | Address files by their path below the folder root and show the path as navigable segments. It works because the address and the disk cannot disagree, and each segment is a way back up. Its limit: it makes the address surface of this view equal to the folder's shape, which is why **HRN-002** is stated as strongly as it is. |
| **HRN-006** | If the harness cannot be read, the view says what that means rather than reporting an empty folder. | An unreadable harness means the surface is describing an agent it cannot see, and a reader given "nothing here" will conclude the folder is empty and move on. It is the same inference the review view owes, and both must make it because either may be opened first. The test: with the folder absent, the view says the harness is missing and what follows from that; with the folder present and genuinely empty, it says that instead. | Distinguish the two conditions at the read and write a notice for each, the missing case stating the consequence. It works because the cause is known where the read happens and unrecoverable afterwards. Its limit: it cannot distinguish a harness that is present but wrong from one that is present and right. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../../REFERENCES.md).

---

## Unwritten

- Whether every file in the harness is renderable, or whether some kinds are shown as files without their contents.
- What the view does with a file large enough that rendering it is the wrong answer.
- Whether the view should say which instructions were actually loaded in the most recent session, rather than only which exist.
