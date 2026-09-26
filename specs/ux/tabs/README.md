# Tab Specifications

One file per tab in the read surface's left rail. Each says what that tab must be true of — what it answers, what it may show, what it must never become — and nothing about how it is built.

> 🔒 **An agent may not edit this folder.** The prohibition covers every file in it except `REVIEW.md`, which is the review queue and not a spec, and extends to any alteration — rewording, reformatting, renaming and moving included — admitting no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](../../REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, these files are complied with as written; where they and the repository diverge, the repository is wrong.

---

## Why a file per tab

The three dashboard specs above this folder govern the surface as a whole: what it may do ([`purpose.md`](../purpose.md)), what may reach it ([`privacy.md`](../perimeter.md)), how it reads ([`design.md`](../design.md)). None of them says what any single view is **for**.

That gap is the one **MNT-008** names — an empty spec gets written retroactively by whatever happens to get built. The views already carry long headers arguing for their own shape; those arguments are commentary on today's code, they live where only someone editing that file will find them, and a rewrite takes them with it. A tab spec is the same argument stated as a property, in the one place a change is checked against.

Each file governs **one route and everything under it**. A detail route — a person's own page, one review entry, one file of the harness — is part of its tab's spec, not a spec of its own; it is the same question answered at a different depth.

---

## The specifications

| Route       | File                             | Rail label   | IDs            |
| ----------- | -------------------------------- | ------------ | -------------- |
| `/`         | [`now.md`](now.md)               | Now          | `NOW-001··006` |
| `/timeline` | [`timeline.md`](timeline.md)     | Timeline     | `TML-001··006` |
| `/journal`  | [`journal.md`](journal.md)       | Journal      | `JRN-001··005` |
| `/people`   | [`people.md`](people.md)         | People       | `PPL-001··005` |
| `/therapy`  | [`therapy.md`](therapy.md)       | Therapy      | `THR-001··005` |
| `/calendar` | [`calendar.md`](calendar.md)     | Calendar     | `CAL-001··005` |
| `/loops`    | [`loops.md`](loops.md)           | Open loops   | `LPS-001··005` |
| `/safety`   | [`safety.md`](safety.md)         | Safety plan  | `SPL-001··007` |
| `/me`       | [`me.md`](me.md)                 | About me     | `ABM-001··005` |
| `/about`    | [`about.md`](about.md)           | About        | `ABT-001··004` |
| `/workflow` | [`workflow.md`](workflow.md)     | Workflow     | `WKF-001··005` |
| `/changes`  | [`changes.md`](changes.md)       | Changes      | `CHG-001··006` |
| `/review`   | [`review.md`](review.md)         | For Review   | `RVW-001··006` |
| `/specs`    | [`specs.md`](specs.md)           | Specs        | `SPC-001··006` |
| `/harness`  | [`harness.md`](harness.md)       | Harness      | `HRN-001··006` |

Fifteen tabs, in rail order. The rail groups them on one axis — **whose the thing is** — and the grouping is not arbitrary decoration: the first nine are the record of a person, the last five are the machine describing itself, and `/` is the way in. A spec that moves a row across that line is changing what the surface claims about ownership, which is a decision for a person and not a layout tweak.

---

## What belongs in a tab spec, and what does not

| Question | Where it is answered |
| --- | --- |
| What does this tab answer that reading the files does not? | Here. |
| What must it never show, count or ask? | Here. |
| What happens when its source is empty, half-written or unreadable? | Here. |
| May the surface write at all? | [`purpose.md`](../purpose.md) — `DSH-001`, `DSH-002`. |
| What may the surface send, and to whom? | [`privacy.md`](../perimeter.md) — `DPV-001··006`. |
| How does a heading, a scrollbar or a code span look? | [`design.md`](../design.md) — `DES-001··006`. |
| Where does the file it reads live, and who owns it? | [`ARCHITECTURE.md`](../../system/ARCHITECTURE.md). |
| What may be written into the record in the first place? | [`../../interaction/memory.md`](../../interaction/memory.md) — `MEM-001··009`. |

A row that could sit in a tab spec **and** in one of the three above belongs above: a property true of every view stated once beats the same property stated fourteen times and drifting in four of them.

---

## Reading a register here

Identical to every other register in this repository — four columns, `ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION`, read as *this must be true; here is why; build it this way*. The anatomy, the standing of each column, and the rules on source tags are in [`../../README.md`](../../README.md) and are not restated per file.

**Cite a row by its ID and its statement together.** The ID finds the row; the statement survives a renumber.

**Precedence is unchanged.** [`../../interaction/safety.md`](../../interaction/safety.md) outranks everything here, including [`safety.md`](safety.md) — that file governs a *view*, the other governs what happens to a person, and where they appear to conflict the view is what gives way.

---

## Unwritten

These fourteen cover the rail. They do not yet cover:

- The shell the tabs sit in — the rail itself, its grouping, the identity chip, the drawer at narrow widths.
- The sign-in view, which is the only route reachable without a session.
- What a tab does mid-write, when a session is appending to the file it is rendering.
- Whether any tab may ever be absent — a rail that changes shape by what is on file, rather than showing every row always.
