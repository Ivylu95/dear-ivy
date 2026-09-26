# Context [CTX]

The binding specification for the agent’s standing context: what every session loads before it reads anything else, and what that load may cost.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

The provisions below fix this specification’s purpose and the reach of its authority — how this file is to be read, obeyed, and bounded. The register further down governs the agent’s standing context instead.

| #   | Provision | What it means |
| --- | --- | --- |
| 1   | **This specification is the single source of truth for the agent’s standing context.** | The instruction file shows what is loaded today, and commit history how it grew; neither states what may be loaded or what it may cost. This file states it, and an agent treats it as the source of truth whenever it adds to what every session loads. The reading rules, the binding rule and the approval gate in [`README.md`](../README.md) apply to this file unchanged. |
| 2   | **It governs what every session loads, never what the instructions say or where they live.** | What the instructions require is the business of the registers they carry out. Where the instruction file lives is architectural — **ARC-008** in [`ARCHITECTURE.md`](ARCHITECTURE.md). What loads only on a match is [`skills.md`](skills.md). CTX-001 and CTX-002 were proposed rows of the architecture register until 2026-09-21, and were redrafted here. |
| 3   | **This specification binds where it speaks and defers where it is silent.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. Silence confers no authority to invent a requirement and attribute it here; where something ought to hold and nothing here provides for it, the omission is a gap and is raised. |

---

## Specifications Register

The normative part of this file. Each row is one thing that must be true of the agent’s standing context; how a row is read is in [`README.md`](../README.md).

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn’t guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **CTX-001** | The always-loaded instructions stay under a measured size limit. | Every line of the always-loaded layer is read in every session, and the longer it grows the less of it is followed; Claude Code’s own guidance targets under 200 lines, because length costs both context and adherence. A cap nobody measures is a wish. The test: the layer’s size is measured on every audit, and it is under the cap. | A cap of 200 lines on `.claude/CLAUDE.md`, counted by a check that runs with the others; growth moves into skills (SKL-002) or linked files, never into the layer. The limit: lines stand in for tokens and for attention, and the file is 266 lines today — over the cap the day it is set. |
| **CTX-002** | What a session reads at the start stays the same size as the record grows. | This fails gradually: nothing breaks, reads just get wider, until a session spends its budget re-reading and has least room when the record holds most. The record is not the only thing growing — the evidence base grows too, and the same bound applies to it. The test: the files and lines read before a session’s first reply are the same for a record of ten entries as for ten thousand. | The retrieval order in `.claude/CLAUDE.md`, loaded every session, is the mechanism; this row is why it exists and how it is tested, and the order is changed there, never restated here. The limit: nothing measures what a session reads, so widening shows up only as slower, vaguer sessions. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person’s private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../README.md). CTX-001’s 200-line figure is Claude Code’s own documented target, a vendor’s guidance rather than independent corroboration. The works cited elsewhere in these specs are in [`REFERENCES.md`](../REFERENCES.md).
