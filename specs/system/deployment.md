# Deployment [DEP]

The binding deployment specification for this system: where each part of it runs, how she reaches it, and where the record is kept so that no one loss takes it.

> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, rewording, reformatting, renaming and moving included, and admits no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, this file is complied with as written; where it and the repository diverge, the repository is wrong.

---

## Purpose and Scope

The provisions below fix this specification's purpose and the reach of its authority — how this file is to be read, obeyed, and bounded. The register further down governs where the system runs instead.

| # | Provision | What it means |
| --- | --- | --- |
| 1 | **This specification is the single source of truth for where the system runs.** | Code shows what a session loads and commit history shows what was pushed; neither says which machine is meant to be disposable and where the record is meant to last. This file states both, so a person learns what losing a phone costs and an agent knows what it may leave behind. The reading rules, the binding rule and the approval gate in [`README.md`](../README.md) apply unchanged. |
| 2 | **This specification governs place and the save, never access.** | Where the record is kept and how a write gets there — saved as soon as it is written, loud when it fails, waiting on no one — are both here, DEP-005··007; DEP-005 and DEP-006 were architecture rows until 2026-09-21; who may open the record is [`../data/access.md`](../data/access.md)'s; whether the read surface is hosted is [`../ux/perimeter.md`](../ux/perimeter.md)'s. This file owns the rest of the deployment: the client, the session's machine, and the places the record is kept. Where two appear to bind the same question, the more specific governs, and the overlap is raised rather than settled quietly. |
| 3 | **This specification binds where it speaks, and silence is not permission.** | Compliance is mandatory: an agent chooses how to satisfy a row, never whether to. A new place for a session to run, or a new copy of the record, that no row anticipated is a gap raised before it is used. |

---

## Where it runs

```
 her phone ──► the client ──► a session machine ──► the repository
 (carried)     (the app)      (reclaimed, scratch)   (kept: first place)
                                                          │
                                         pulled on a schedule
                                                          ▼
                                                   her own machine
                                                   (kept: second place,
                                                    and the read surface,
                                                    local only)
```

> 🧭 **This is the owner's design, not a snapshot of any machine.** It names roles, not products; the products are in the design column, where they can change without the drawing being wrong.

---

## Specifications Register

The normative part of this file. Each row is one thing that must be true of where the system runs; how a row is read is in [`README.md`](../README.md).

> ⚠️ **When referencing:** always cite a row by **both** its ID and its spec statement — IDs shift, specs get removed, and ordering isn't guaranteed.

| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |
| --- | --- | --- | --- |
| **DEP-001** | The record outlives the loss of any one place it is kept. | Every place the record sits can be lost without notice — the machine a session runs on and the phone the owner holds are reclaimed, and a host is one account with one provider, gone with a lost login, a closed account or an outage, on a night when the owner cannot wait for support to answer. A record that lives in one place is lost the day that place is. Compliance is judged by taking away any one place — the host included — and opening the record, as of the last session, from what is left. | Host a private, single-member repository on the person's own GitHub account, and keep a clone on the person's own computer that pulls on a schedule, so the second copy stays current without the person doing anything; treat every other checkout as scratch, and encrypt that computer's disk. GitHub is the owner's choice, and the safer one: the person's computer alone is more private, but would fail this row the day it was lost. Falls short in two places: the local copy is only as fresh as its last pull, so a session since then is missing until the computer next wakes; and a copy on a laptop can be stolen, which disk encryption covers only while it is off. |
| **DEP-002** | Reaching it takes nothing but a device she already carries. | She only ever has to talk. A step between her and the space — an install, a sync, a terminal — is paid on the bad night as well as the good one, and on the bad night it is the step not taken. Compliance is judged by whether a signed-in phone reaches a working session with nothing else set up. | Reach it through the Claude app on the person's phone, signed in to the person's own Claude account and connected to the person's own GitHub, which opens a session on a cloud machine against the repository — set up once, with help, and never again. Falls short with no network, where there is no session at all; when the plan's usage limit is reached, which stops the session too; and where a cloud session offers less than a local one: nothing speaks before the person's first message, and its slash menu leaves out the project's own skills, which still load and answer when named in full. |
| **DEP-003** | Every safeguard works the same on every device she uses. | The crisis response and the save were built and tested at a computer, and she mostly uses it from her phone, whose session runs on a machine nobody set up by hand. A safeguard that works only where it was tested is not one she can rely on. Compliance is judged by opening a session from the phone, raising a crisis and making a write, and seeing the crisis response fire and the write reach the host. | Keep every safeguard in the repository — instructions, hooks and settings — so each session receives the same set wherever it runs, and leave none in one computer's own configuration; for each, say whether code enforces it or it relies on the model following an instruction, as **SFG-002** asks. Falls short wherever a safeguard is only an instruction: every device receives it, none enforces it, and the model can still miss it. |
| **DEP-004** | Any change to how it works reaches her next session without her doing anything. | If a change waited for her to install or update something, it would wait for her — and a fix to the crisis response that waits is a fix she does not have on the night she needs it. Compliance is judged by pushing a change, opening a new session from the phone, and finding the change there with nothing done on her side. | Keep every instruction, skill and setting in the developer's harness repository, pulled into the person's repository by the update DEP-009 describes, "The harness reaches the record's repository without anyone gaining access to the record.", and start every session from a fresh copy of the main branch, which the phone's cloud session does by itself. Falls short for a session left open from before the change, which runs the old version until it next starts, and for a pull that failed, which leaves the person on the old version until it is noticed. |
| **DEP-005** | Anything written to the record is saved off the machine as soon as it is written. | The machine is reclaimed without warning when the person goes quiet, and the session may never reach an end, so a save that waits for the close is a save the one abrupt ending skips. The test: end a session mid-turn, and everything written before that turn is on the remote. | A hook commits and pushes to the repository’s remote after every turn, not a decision the agent makes — `.claude/hooks/record/save-record.mjs`, backed by the instruction in `.claude/CLAUDE.md`; the remote is the host DEP-001 names, and any git remote serves. The limit: with no remote there is nowhere to push, and the hook is parked today, so saving rests on the instruction alone. |
| **DEP-006** | A failure to save is never silent. | A save that fails without saying so is the one failure the person cannot see: the session carries on as if the record were safe, and the loss surfaces only when something is looked for and missing. A warning written on the failing machine dies with it, so the check that matters is one made from somewhere else. The test: break the push, discard the machine, and the next session says so. | Two detectors, one independent of the failing machine: the save hook writes a marker when a push fails, and the next session start compares the local and remote records afresh. The limit: the second detector waits for the next session, which may be days later, and both hooks are parked today. |
| **DEP-007** | Saving never waits on anyone’s approval. | A person who must approve a diff to save a journal entry will not save journal entries, and every gate in the save path trades a real loss of record for a theoretical gain in safety. The test: nothing between a write and the push asks the person anything. | Commits go straight to the default branch, never through a pull request, as `.claude/CLAUDE.md` instructs, and every git command the save runs is pre-allowed in `.claude/settings.json`. The limit: an unreviewed push carries a mistaken write to the remote as readily as a correct one; the history DEP-005 keeps and DAT-003 are what make it recoverable. |
| **DEP-008** | Each change to the record can be found and undone on its own. | A change bundled with others can only be reverted with them. One change per commit makes the history the sequence of what happened, so a mistaken write is undone without disturbing its neighbours. Compliance is judged by whether any single change reverts cleanly alone. | One commit per change, its message naming the file touched and never its content. Falls short where one change spans files — a person’s file and the timeline line pointing at it — which land together, because reverting either half alone would orphan the other. |
| **DEP-009** | The harness reaches the record's repository without anyone gaining access to the record. | DEP-004 needs the developer's changes to reach the person; PRV-001 lets only the person open the record. Pushing into the person's repository takes membership, so the two rows collide unless changes travel toward the record and never the other way. Compliance is judged with the developer holding no access to the record: a harness change the developer pushes is in the person's next session. | Keep the harness in a repository of the developer's with nothing personal in it, and have the person's repository pull it — at session start and on a daily schedule — replacing every harness path except the local layer, and committing to the default branch. The pull reads the developer's repository; nothing reads the person's. Falls short in that a failed pull stops updates silently unless the next session checks, and in that the harness repository, if public, shows anyone how the system works, though never what it holds. |
| **DEP-010** | A change made for the person survives every update to the harness. | A change the person asked for once and lost to an update is a request they must make again, and being remembered is the service. An update that silently erases what was made for one person teaches that person that asking is pointless. Compliance is judged by making a change for the person, pushing a harness update, and finding the change still in force. | A local layer the update never writes — skills whose names mark them local, and everything in the record — excluded by name from the paths the pull replaces. Falls short in that an update can make a local change redundant or contradict it, and nobody sees both sides at once: the developer cannot read the local layer, and the person does not read the update. |

> 📚 **No row above carries a source tag, and that is a value rather than an omission.** These registers govern one person's private record; where no published work genuinely addresses a row it stays bare, and reaching for a large name to decorate one is the failure mode — see **Source tags** in [`README.md`](../README.md). The works cited elsewhere in these specs, and the boundary past which each stops applying, are in [`REFERENCES.md`](../REFERENCES.md).

---

## Unwritten

- What a session may do with no network, given that the record is only reachable through one.
- Which differences between a cloud session and a local one are tolerable, and which break **DEP-003**.

---

## Recently deleted

Rows removed from this file on the owner's instruction, kept word for word with the date and the reason. Only the owner deletes one for good. Old numbers are written plainly, never as live IDs.

| WAS | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION | REMOVED | REASON |
| --- | --- | --- | --- | --- | --- |
| was 005 | No copy of the record exists that she did not choose. | A copy made by a tool nobody pointed at the record — a folder sync, a cloud backup of the whole disk — sits with a provider she never agreed to, where she cannot see it or delete it, and privacy that rests on who can open the repository ends at that provider's door. A sync service also rewrites files the repository is writing, and a repository synced mid-write can corrupt. Compliance is judged by listing every place a copy of the record exists and finding each one named in **DEP-001**'s design. | Keep every checkout outside any folder a sync service watches — OneDrive, Dropbox, iCloud Drive — and out of any whole-disk backup that uploads. Falls short where such a service is switched on later, or backs up the whole disk by default: nothing watches for a new copy appearing, so the check is by hand, whenever a device or a setting changes. | 2026-09-21 | Sync folders are accepted on her computer. Commits to GitHub make the working copy recoverable, so a synced copy costs privacy only, and she has chosen that. |
