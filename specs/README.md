# Specifications

The binding design specs for this repository. Together they are the whole design: what must be true of this system, how it should be built, and where each part of it lives.

One file per area. A spec says what must hold and why it would fail — never how today's code happens to do it.

> 🔒 **An agent may not edit this folder.** The prohibition covers every file in it except `REVIEW.md`, which is the review queue and not a spec, and extends to any alteration — rewording, reformatting, renaming and moving included — admitting no exception for a change the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](REVIEW.md) with its reasoning and leaves the entry for a person to clear, never treating its own entry as settled. Until a person applies a change, these files are complied with as written; where they and the repository diverge, the repository is wrong.

---

## The specifications

**Four folders, by the question each answers.** A folder holds several files or it is not a folder; `PRODUCT.md` and `ARCHITECTURE.md` are read before any of them.

| Folder | Holds |
| --- | --- |
| `interaction/` | How it behaves toward her — the safety floor, how it talks, what it remembers, what it may say. |
| `data/` | The record itself — how it changes, who may open it, and the fabricated one that stands in for it. |
| `system/` | The machinery around it — the layout, what a session loads, what holds the agent to its rules, upkeep, where it runs, and the developer's experience. |
| `ux/` | What she reads the record through, with one file per view in `ux/tabs/`. |

| File                                                   | Covers                                                           | IDs            |
| ------------------------------------------------------ | ---------------------------------------------------------------- | -------------- |
| [`PRODUCT.md`](PRODUCT.md) | What the product is for — the outcomes every other register delivers. | `PRD-001··011` |
| [`system/ARCHITECTURE.md`](system/ARCHITECTURE.md)                   | Folder layout, boundaries, the record store.        | `ARC-001··014` |
| [`interaction/safety.md`](interaction/safety.md)       | The safety floor, and what holds in a crisis.                    | `SAF-001··015` |
| [`interaction/conduct.md`](interaction/conduct.md)     | How it talks to her — what it optimises for and what it refuses. | `CON-001··011` |
| [`interaction/memory.md`](interaction/memory.md)       | What is recorded, in whose words, and what is never inferred.    | `MEM-001··014` |
| [`interaction/knowledge.md`](interaction/knowledge.md) | The non-personal evidence base — what it may hold, and what travels with a claim. | `KNW-001··005` |
| [`data/record.md`](data/record.md) | How the record changes — what may restructure it, and how it stays findable. | `DAT-001··003` |
| [`data/access.md`](data/access.md)         | Who can open the record, and how access is granted and revoked.  | `PRV-001··005` |
| [`data/sample.md`](data/sample.md)                     | The fabricated record, and reading one record in place of another. | `SMP-001··007` |
| [`system/context.md`](system/context.md) | What every session loads, and what that load may cost. | `CTX-001··002` |
| [`system/safeguards.md`](system/safeguards.md) | What holds the agent to its rules when a rule is in its way. | `SFG-001··009` |
| [`system/skills.md`](system/skills.md) | The harness's procedures — how a skill or command is kept, and what starts it. | `SKL-001··006` |
| [`system/maintenance.md`](system/maintenance.md) | The unattended maintenance run — when it fires, what it owes.    | `MNT-001··009` |
| [`system/deployment.md`](system/deployment.md) | Where the system runs, how she reaches it, and where the record is kept. | `DEP-001··010` |
| [`system/dev.md`](system/dev.md) | The developer's experience while agents do the work — in force in development mode only. | `DEV-001··009` |
| [`ux/purpose.md`](ux/purpose.md)         | The read surface over the record.                                | `DSH-001··002` |
| [`ux/perimeter.md`](ux/perimeter.md)         | The surface's perimeter — what it exposes and what it may send.  | `DPV-001··008` |
| [`ux/design.md`](ux/design.md)           | How the surface looks and behaves — chrome, typography, scrolling.  | `DES-001··006` |
| [`REFERENCES.md`](REFERENCES.md)                       | Works corroborating a claim in any register. Reference, not spec. | — |
| [`REVIEW.md`](REVIEW.md) | Findings whose fix lands in this folder. The queue, not a spec: written by the agent. | — |

**Start with `PRODUCT.md`.** It says what the product is for; `ARCHITECTURE.md` says where everything lives; the rest say how each part must behave.

---

## Anatomy of a Spec File

Every spec file has the same seven parts in the same order, so a reader who has read one can find their way around any of them. [`ARCHITECTURE.md`](system/ARCHITECTURE.md) is the worked example; where a file and this description disagree, that file is the shape to copy.

| # | Part | Required | What it is |
|---|---|---|---|
| 1 | `# Name [TAG]` | always | The file's name with its three-letter family prefix, so the heading answers "which register am I citing" without scrolling. |
| 2 | Lede | always | One sentence: what this file binds, and over what. |
| 3 | 🔒 **Edit prohibition** | always | That an agent may not edit the file, and where a finding goes instead. Stated in every file rather than inherited from here, because the moment it matters is the moment nobody is reading the index. |
| 4 | `## Purpose and Scope` | always | A numbered table fixing how the file is read, obeyed and bounded — its authority, the boundary against neighbouring families, and what its silence does *not* permit. Provisions are about **this document**; rows are about **the repository**. A provision is not a row: it carries no ID and cannot be cited. |
| 5 | A territory map | where there is one | A code-fenced diagram of what the file governs, followed by a 🧭 note saying it is the owner's design rather than a snapshot of disk. Written only where the file has a real territory to draw; an invented one is padding. |
| 6 | `## Specifications Register` | always | The normative part — a ⚠️ note on citing, then the table. |
| 7 | 📚 **Sources note** | always | Whether the register's claims carry corroboration, and where the works are listed. |

Anything else — an open question, a list of what is deliberately not specified — goes **below** the register under its own heading, and is reference rather than specification.

---

## Anatomy of a Spec Register

The register *is* the specification: one row is one property the system must hold, so rows can be scanned side by side, compared, and cited by a single ID. Prose grows and drifts, and a requirement buried in a third paragraph is one nobody finds; a row cannot hide anything. Everything around the register exists to say how the register is to be read — never to add a requirement that is not in it.

Each row has four columns, in this order. **The order is load-bearing**: a reader meets the property, then why it must hold, then the mechanism — and a file that puts the mechanism before the reasoning teaches the reader to build first and justify afterwards.

| Column | Standing | What it holds |
|---|---|---|
| **ID** | — | Which row this is: a three-letter prefix naming the file, then three zero-padded digits. Cited with the statement, never alone. |
| **Spec Statement** | `mandatory` | The property that must hold, stated without naming a file, tool or format — if it can't be written without one, it isn't a spec, it's already a design. One property per row. It is what an agent is held to and what a citation points at; without it the row is only advice, and the repository drifts wherever convenience takes it. An agent chooses how to satisfy it, never whether to. |
| **Spec Rationale** | `explanatory` | Why the statement must hold, what its absence would cost, and the test by which compliance is judged. It lets a reader weigh a rule instead of obeying it blindly; without it a statement is met literally and missed in substance, or dropped by whoever no longer remembers its purpose. A rationale is not satisfied or breached; it is read. |
| **Design Recommendation** | `advisory` | The mechanism known to satisfy the statement, why that mechanism satisfies it, and where it falls short — the reasoning concerns the mechanism, never the statement, which is the rationale's. One design, not three options weighed against each other. A design stays in its row, even where another row names the same mechanism: why a mechanism satisfies a statement, and where it falls short, differ from row to row, so only a clause would be shared and the rest would still be written per row. Where a mechanism changes, every row naming it is found by search, and each is redrafted on its own terms. It saves each session from re-deriving a solved problem, and its stated limits stop an agent trusting it further than it reaches. It is the default means, not the only one: an agent may adopt another and records the departure with its reasons. |

Read a row as a sentence: *this must be true; here is why; build it this way.*

The header row is written in capitals — `ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION` — so the four columns are identifiable at a glance in a register whose cells run to a paragraph each.

---

## Source tags

A cell may carry a `[KEY]` tag immediately after a claim, marking that claim as **corroborated** — someone independent, working on a different problem, arrived at the same thing. A tag links to the **work itself**, and every work is listed once in [`REFERENCES.md`](REFERENCES.md): a source rarely belongs to one family, and copied into two files it becomes two entries that drift.

A tag is **evidential and never binding.** It is not a fifth column and not a standing of its own: it cannot make a statement true, cannot outrank a rationale, and changes nothing about precedence. A rationale exists so a reader can *weigh* a rule; a citation that ends the argument has defeated the column it sits in.

Four rules keep it honest.

- **It tags the claim, not the row.** A tag sits against the sentence it supports, which is the one thing a column could not do. The same row often takes different sources for its rationale and its design — the *why* and the *mechanism* are corroborated by different literatures. **Inside the closing punctuation, never after it** — `…or destroy it [GDPR-Art30].`, not `…or destroy it. [GDPR-Art30]`. A tag past the full stop has visibly left the claim it corroborates and attached itself to whatever sentence comes next, which is how a reader ends up asking what it refers to.
- **A key looks the same wherever it appears.** The KEY cell in `REFERENCES.md` is written in the same tag form as a citation, so `ADR` in the reference table and `[[ADR]]` in a register are one object rather than two — a backticked key would render as a *literal*, which is what the neutral mark means, and an identifier that leaves the page is not a literal. The appearance of both is declared once, under **Inline marks** in `ux/app/globals.css`.
- **The key names the work; anything narrower is a locator.** A row is one published work, and a part of it — an article, a clause, a principle — never earns a row of its own: `[[GDPR Art.30]]`, `[[ISO-29148 §5.2]]`, `[[FAIR F4]]`, with `GDPR`, `ISO-29148` and `FAIR` the rows. Everything before the first space is the key. Split into a row per part instead, the *what it says* and *where it does not reach* lines get written two or three times and the copies drift — the failure `ARC-013` names for rows, in a new place. Where the thing actually cited is a **named concept** rather than a document — `REF-MONITOR`, `SHEARING-LAYERS` — the key may name the concept, because a key is read at the citation and `[[REF-MONITOR]]` says what is being invoked where `[[ANDERSON-1972]]` does not; the row then names the work it came from.
- **Untagged is a value.** Most rows carry no tag and should not. These registers govern one person's private record; where no source genuinely addresses a row, it stays bare. Reaching for a large name to decorate a row is the failure mode, not the goal.
- **Every reference states where it does not reach.** The Sources table carries, per key: what the source actually says, and the boundary past which it does not apply here. If that second line cannot be written, there is no source and the tag comes off.
- **Write the tag as `[[KEY]](url "where it stops applying")`.** The doubled bracket puts the brackets in the link text, so the raw file and the rendered page agree and the brackets say which clause is being cited. The link title is mandatory, not decorative: the tag goes to the work, so a reader following it never passes through the limit unless the limit travels with them. Nothing mechanical enforces this — external URLs are exempt from `check-links.mjs`, which is the one place in these registers with no gate behind it.
- **Every reference carries the date it was checked.** Nothing here verifies that an external source still says what was claimed — the link checker reads paths and spec IDs, not meaning. The date is what a reader weighs the claim against.

## IDs

| Prefix | File                       |
| ------ | -------------------------- |
| `PRD`  | `PRODUCT.md`               |
| `ARC`  | `system/ARCHITECTURE.md` — in force          |
| `ARD`  | `system/ARCHITECTURE.md` — drafted, not approved |
| `SAF`  | `interaction/safety.md`    |
| `CON`  | `interaction/conduct.md`   |
| `MEM`  | `interaction/memory.md`    |
| `PRV`  | `data/access.md`     |
| `DSH`  | `ux/purpose.md`     |
| `SMP`  | `data/sample.md`           |
| `DPV`  | `ux/perimeter.md`     |
| `DES`  | `ux/design.md`      |
| `MNT`  | `system/maintenance.md` |
| `DAT`  | `data/record.md`             |
| `CTX`  | `system/context.md`       |
| `KNW`  | `interaction/knowledge.md`   |
| `DEP`  | `system/deployment.md` |
| `SFG`  | `system/safeguards.md`    |
| `SKL`  | `system/skills.md`        |
| `DEV`  | `system/dev.md`               |

One prefix per file, so an ID says where to look. Numbers run in file order with no gaps. A row that leaves a register moves to a **Recently deleted** section at the foot of its file, with the date and the owner’s reason, its old number written plainly rather than as a live ID; the rows after it renumber, and every citation moves with them. Only the owner deletes a row for good, and gives a reason when they do.

**Cite a row by its ID and its spec statement together** — `ARC-003, "Everything personal lives in one place, nowhere else, and comes away whole."` — in commits, proposals and review items. The ID finds the row; the statement survives a renumber. A citation carrying only a number stops resolving the moment the specs are restructured, and nothing warns you.

**Precedence.** Where two rows conflict, safety wins, then the record's integrity, then everything else. `interaction/safety.md` outranks every other file here.

---

## Defined terms

Used with these meanings in every spec. A definition is not a row: it cannot be true or false of the repository, so it is never given an ID. **A term is listed only where its meaning here departs from the usual one**, and the third column names the usual meaning it departs from. A word used the way software ordinarily uses it is not listed, however often it appears; an entry that cannot fill the third column does not belong.

| Term | Means | Not |
|---|---|---|
| **personal** | Anything particular to her: what she wrote or said, what was written about her, her name, and the people, places and dates in her life — and anything derived from these closely enough to identify one of them, such as a paraphrase or a summary. **This is the only list.** Whatever it does not name is **non-personal**; where it is unclear which side something falls on, it is personal. Test: *would it tell a stranger something about her in particular?* | PII — wider: it needs no name attached to count |
| **the harness** | Everything non-personal: the instructions and guardrails that steer the model, the specs, the evidence base, the human interface layer, and the fabricated record. Test: *would it serve a different person unchanged?* | The agent harness alone — wider: the specs, the dashboard and the evidence base are in it |
| **the human interface layer** | The dashboard she reads the record through, on her own machine. Called *the read surface* in older rows. | UI in general; the app she talks through |
| **saved** | Committed and pushed to the default branch. | Written to disk |
| **the owner** | The developer who decides the specs and keeps the harness. | Whoever owns the record, or the account it is kept in — that is the person it is kept for |

---

## The rules

These govern every file in this folder.

**Binding.** The agent chooses how it works; it does not choose whether to land inside these specs. Whatever it changes, the design described here still holds afterwards.

**Improvements are raised, never applied.** A row that looks wrong, or a better design that presents itself, is flagged as a review item. Rows are not edited, not softened, and a divergence between a spec and the repo is never resolved by amending the spec — the repo is what's wrong. Every change here passes a human approval gate.

**Deviations are recorded, not hidden.** Where the repo departs from a row, it is written to [`.claude/REVIEW.md`](../.claude/REVIEW.md); where a file in this folder does, to [`REVIEW.md`](REVIEW.md). Never into the spec. A spec that quietly narrows itself to match what was built has stopped being a spec.

**Nothing personal.** These are harness files. No names, no quotes, no details of her life — those live only in `data/`.

---

## Adding a spec

A new area gets one file named after it, in the folder whose question it answers — `interaction/`, `data/`, `system/` or `ux/` — and a new view goes in `ux/tabs/`. A folder of its own only where it will hold several files; one file in a folder of its own says twice what the file already says. Then:

1. Add it to the index above, with its prefix and the IDs it owns.
2. Claim a three-letter prefix in the table above. Number its rows from `001`, continuous; a removal renumbers under **IDs** above.
3. Say at the top which of its concerns are architectural and stayed in `ARCHITECTURE.md`, so the boundary between the two is written down rather than inferred.

If a row could sit in two files, ask which question it answers. *Where does it live and what owns it* is architecture. *How must it behave* is everything else.
