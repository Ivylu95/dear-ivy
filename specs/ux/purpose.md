# Dashboard Purpose [DSH]

The binding purpose specification for the read surface over the record: what it may do, and what it must never do.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

The provisions below fix this specification's purpose and the reach of its authority — how this file is to be read, obeyed, and bounded. The register further down governs what the surface may do instead.

| #   | Provision                                                             | What it means                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **This specification is the single source of truth for what the surface is.** | Routes show what the surface does and commit history only what was added; neither states what it was meant to be for. This file states both, and an agent treats it as the source of truth whenever it adds anything the surface can do. The reading rules, the binding rule and the approval gate in [`README.md`](../README.md) apply to this file unchanged. |
| 2   | **It governs capability, never location, perimeter or appearance.**   | Where the surface lives in the tree is architectural (`ux/`). What it may send and what may reach it is [`privacy.md`](perimeter.md) (`DPV`). How it looks and behaves is [`design.md`](design.md) (`DES`). What it is *allowed to be* lives here. |
| 3   | **This specification binds where it speaks, and its silences are enumerated.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. This file is knowingly incomplete, and **Unwritten** below names what it still owes — per **MNT-008**, an empty spec gets written retroactively by whatever happens to get built, so the gaps are listed rather than left to be discovered. |

---

## Specifications Register

The normative part of this file. Each row is one thing that must be true of what the surface may do; how a row is read is in [`README.md`](../README.md).

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **DSH-001** | Any viewing surface is read-only. | Write this down where features get proposed. "Just let me edit that one thing here" is reasonable, incremental, and the end of DAT-003. | Render the record at request time from the files themselves. No database, no mutation path, no write route — the absence is the design, not an omission. |
| **DSH-002** | The single exception to DSH-001 is a thing she made rather than said: it is never read back to her as her own account of anything. | The exception is not the danger; the precedent is. DSH-001's real protection was that there was nothing to argue about, and admitting one exception spends it — so the boundary has to be legible in the code as well as here, narrow enough that the next "just this one thing" has to come back and add a row rather than widen a branch. A surface that can write must also say when it could not: a write that silently fails on a read-only host is worse than one that was never offered. | One named path, one route, one module — not a folder, not a pattern, not a general upload. The bytes are validated by what they are rather than by what the upload claims. Append-only like the rest: what is replaced moves to the archive under the date it stopped being current. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../REFERENCES.md).

---

## Unwritten

This specification is incomplete. The surface has routes, navigation, a theme and a login page in `ux/`, and none of that is specified here yet. Per MNT-008, an empty spec gets written retroactively by whatever happens to get built — so these are the questions it still owes an answer to:

- What the surface is **for** — which question it answers that reading the files directly does not.
- Which parts of the record it may render, and whether any part is deliberately not shown.
- What happens when the record is empty, malformed, or mid-write.
- Whether it may ever be reached from a device that is not hers.
