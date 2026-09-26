---
name: spec-manager
description: Anything touching specs/ - drafting a new spec row, rewording one, auditing a register, removing or moving a row, a map of the registers, or a finding that a spec is wrong. Use to read the form fresh, draft in the house voice, and hand a row back for a person to approve. The specs are the owner's standing decisions and are never changed on the agent's judgement. For the rest of the harness - skills, hooks, commands, ux/ - use harness-writer instead. Never for anything under data/.
---

# Spec manager

**The specs are the owner's standing decisions.** Everything else in the harness
is the agent's to edit; `specs/` is not. A spec changes only when a
person has read the exact words and said yes, so this skill is picky by design:
it drafts, hands the draft back whole, and stops.

**The form of a spec is not in this file.** What a register is, what its four
columns hold, how a source tag is written, which prefix belongs to which file —
all of that lives in `specs/`, is human-edited between sessions, and is
read fresh every run. This skill carries the part the specs folder does not:
where a row belongs, how to find the property, what language to write it in, and
how those language rules keep themselves current. Restating the form here would
be `ARC-013`, *"Every fact has one authoritative home; everything else points to
it."*, committed inside the harness.

## The boundary

| Area | Standing | Where a change goes |
|---|---|---|
| `specs/**` | 📝 **Draft only** | The conversation, paste-ready. **Not the file** — not a typo, not a reformat |
| `specs/REVIEW.md` | ✏️ **Edit** | The one file in that folder that is written, not drafted. It is the queue, not a spec |

**Applied by the owner.** A yes to a draft means the owner pastes it; the guard
hook refuses the edit tools on this folder, and no other route around it is
taken. Where an edit to a locked file is made anyway, it is logged under
**Authorised edits** in `.claude/REVIEW.md` in the same commit — which change,
that it was instructed, and what it cost — so an agent edit to a locked file is
never untraced.

*The prohibition is deliberately held in two places. The specs folder states it
in its README and again in every file it governs, for the reason given there:
the moment it matters is the moment nobody is reading the index. A skill whose
whole job is to produce spec text must not be the one place it is missing when a
read fails.*

## What can be asked for

| Ask for | What comes back |
|---|---|
| **A map** — or nothing named | The tree under **Inside `specs/`** |
| **A new row** | Three blocks, with the file and the position named |
| **A reword** | The current row, the proposed row, and what changed in meaning |
| **An audit** | Every check in **Handing over** run against a named row, pass or fail |
| **A removal** | The row moved to **Recently deleted** with its reason — see **Removing a row** |
| **A finding** | An entry in `specs/REVIEW.md` |

**Narrow enough to read on a phone.** The rules in `harness-writer` hold here,
and two more that are about rows:

| Rule | Because |
|---|---|
| A set of rows is two columns — the ID, then its statement in full | Bullets wrap but do not scan; a paraphrased gist fits but is no longer the statement |
| Rationale and design only for the one row asked about, then stop | They run to a paragraph a cell; the list is for choosing, the row is for reading |

## Inside `specs/`

**Invoked with nothing named, open with the map** — then one question, and stop.
Asked for mid-task, it is drawn again, never recalled.

The map is one code-fenced tree of `specs/`, drawn like the territory map in
[`ARCHITECTURE.md`](../../../specs/system/ARCHITECTURE.md): box-drawing branches, one
line per folder or file, and a `#` comment aligned in a single column set about
twenty spaces clear of the longest name. Built by reading the folder and counting its rows,
never recalled.

| Line | Its comment holds |
|---|---|
| A register, tab registers included | The prefix in brackets, a middle dot, then its row count — `[ARC] · 14`, nothing more |
| Anything else — a folder, a root file | No comment. No words anywhere in the tree |

`.claude/REVIEW.md` lives outside the folder, so it gets one line under the
fence, not a branch in the tree.

The opening is four sections, each under its own `###` heading and split from
the next by a `---` rule, so each part stands apart when the reply is read in
chat:

| # | Heading | Holds |
|---|---|---|
| 1 | 🗺️ **Map** | The tree, then the `.claude/REVIEW.md` line |
| 2 | ⚠️ **Mismatches** | Anything counting turned up that does not match — an empty folder, an index claiming the wrong range. Two columns, `#` then the mismatch; *None* when clean |
| 3 | 👉 **First move** | One recommendation and why, in a line or two |
| 4 | ❓ **Question** | What to work on. One question, and stop |

## Read first

Before drafting a word. Not from memory — the folder changes without telling
you, and a remembered format is a stale one.

| # | Read | For |
|---|---|---|
| 1 | [`specs/README.md`](../../../specs/README.md) | The whole form: anatomy of a file, anatomy of a register, the four columns and their standings, source tags, defined terms, precedence, the prefix table. **Every question about shape is answered here.** |
| 2 | The register the row belongs to | Whether a row already says this. The length, voice and tag density of its neighbours — a row is drafted to match what is already in the file, not to an abstract standard. |
| 3 | Its nested `README.md`, where there is one | A sub-register carries rules its parent does not — [`specs/ux/tabs/`](../../../specs/ux/tabs/README.md) has its own index, its own prefixes and its own boundary against the three files above it. |
| 4 | [`ARCHITECTURE.md`](../../../specs/system/ARCHITECTURE.md) | The shape-versus-behaviour boundary, and what the architecture register already owns. A row in the wrong file is worse than no row. |
| 5 | [`REFERENCES.md`](../../../specs/REFERENCES.md) | Only when a tag is in play: whether the work is already listed, under what key, and with what limit written against it. |

Steps 1 and 2 are always both. Skipping 2 is how a register acquires two rows
that agree, and later disagree.

## Before drafting

Four questions, in order. Three of them end the job early.

| Ask | If yes |
|---|---|
| Does a row already say this? | Stop. Cite it. Two rows that agree become two rows that disagree. |
| Is this shape, or behaviour? | *Where does it live and what owns it* → `ARCHITECTURE.md`. *How must it behave* → the family that owns the behaviour. |
| Is it a property, or already a design? | If it cannot be written without naming a file, tool or format, it belongs in the third column, and the property above it has not been found yet. |
| Is it one property, or several? | Several rows, or one property stated once. Four adjectives in a row is the usual tell. |

## Language

The register's voice, grounded in requirements-engineering and plain-language
research. Last grounded **2026-09-21** — see [`log.md`](log.md) for when it is
next due.

| Rule | Ground | Holds here |
|---|---|---|
| Plain words over Latinate ones | Plain-language drafting is as accurate as legalese and often more precise; Latin and Norman French in law are historical residue, not instruments | ✅ |
| No vague qualifiers — *easily*, *adequate*, *reasonable*, *appropriate* | INCOSE R7 | ✅ |
| One thought per statement | INCOSE R18 | ✅ |
| The definite article — *the*, not *a* | INCOSE R5 | ✅ |
| Active voice, the responsible entity as subject | INCOSE R2 | ❌ **A row is an invariant, not a behaviour.** There is no actor to put in the subject, and inventing one turns a property into an instruction. |
| Avoid *not* — state the positive where one exists | INCOSE R16 | ❌ **The negative side is the only checkable one.** Nothing can enumerate what is personal; it can only sweep what is outside. *"and nowhere else"* is the half that enforces. |
| Avoid absolutes — *always*, *never*, *100%* | INCOSE R26 | ❌ **A constitution's absolutes are its content.** *"Nothing written is ever lost"* means nothing softened. |

Three of the seven do not transfer, and they are the three an agent reaches for
first. Recording *where a rule stops applying* is the same discipline
`REFERENCES.md` demands of every source tag — a rule imported whole is a rule
nobody weighed.

**The house voice already exists.** Read these before writing anything:

> *Every fact has one authoritative home; everything else points to it.*
> *Nothing written is ever lost or quietly changed.*
> *Session cost stays flat as the record grows.*

Short, plain, absolute, memorable enough to cite from memory. A row in a
different voice is a defect in a table meant to be scanned side by side.

**Length.** Match the rows already in the destination file, measured rather than
guessed. A row twice the length of its neighbours is not more rigorous, it is
unscannable — and the register's whole claim is that rows can be compared at a
glance.

## Where the columns go wrong

`README.md` says what each column holds. This is how each one fails in practice.

| Column | Fails when |
|---|---|
| **Spec Statement** | The mechanism is smuggled in — *"one folder at the root"* is already a design. Or several properties are carried at once, which a run of adjectives usually gives away. |
| **Spec Rationale** | The compliance test is missing, or has drifted into the design column — which lets a mechanism set its own pass mark. |
| **Design Recommendation** | Three options are weighed instead of one recommended, or the limits are left unwritten, so the next session trusts the mechanism further than it reaches. |

Read the finished row as one sentence: *this must be true; here is why; build it
this way.* If it does not read that way, a column is doing another's job.

## Handing over

Each check has an authority. Where a check and its authority disagree, the
authority is right and this file is stale.

| Check | Against |
|---|---|
| Statement names no file, tool or format | `README.md` § *Anatomy of a Spec Register* |
| Statement is one property | INCOSE R18, above |
| Rationale carries the compliance test | `README.md`, Rationale column |
| Design states where it falls short | `README.md`, Design column |
| Tag in the house form, inside the punctuation, limit in the link title | `README.md` § *Source tags* |
| Row length matches its neighbours | The destination file itself |
| Every ID cited exists | `ux/scripts/check-links.mjs` |
| Nothing personal anywhere in it | `ARC-003` |

Then give the row in the conversation as three blocks — **Statement**,
**Rationale**, **Design** — each a bold label over a `>` quote holding that
column's full prose, exactly as it will be written into the register. Never
summarise a column into bullets: the draft is the text that lands, and a summary
is a second text nobody approved. The paste-ready table line is given only when
asked for, since the three blocks already carry every word of it. Say which file
it belongs in, where in that file it goes, and what it becomes on paste — the
number is assigned by whoever pastes it. Do not touch the file — on a yes, the
owner applies it.

For the shape, see the blocks under **Drafted rows** in
[`specs/REVIEW.md`](../../../specs/REVIEW.md) — real rows, each with the
file and position it was written for.

**Every amendment is handed back whole.** Asked to change any part of a row —
one word of one column — give all three blocks again, in the same form, with
the change in place. A reviewer judging a row reads it as one sentence, and a
diff of one column asks them to hold the other two in their head; the full row
is also the only proof that the edit touched nothing else. Then stop and ask
whether it stands.

## Removing a row

A session never removes a row outright. Removed on the owner's instruction, it
goes to **Recently deleted**, and only the owner takes it further. The steps
below are drafted like any change and applied by the owner.

| Step | What happens |
|---|---|
| **Get the reason** | A removal carries the owner's reason. None given, ask once before drafting the removal — a row gone without a why cannot be judged for return. |
| **Move, never cut** | The whole row, word for word, to a `## Recently deleted` section at the foot of its file, with the date and the reason. Its old number is written plainly — *was 007* — never as a live ID, since two rows defining one ID is what `check-links.mjs` fails on. |
| **Close the gap** | The rows after it renumber so the register runs continuous, and every citation moves with them. |
| **Delete for good only on the owner's word** | A row leaves Recently deleted only when the owner says so and gives a reason, recorded in the commit. A session never clears that section on its own judgement, however stale it looks. |
| **Log it** | Each step under **Authorised edits** in `.claude/REVIEW.md`. |

A row moved to another register is not deleted. It leaves a ↪️ pointer where it
stood, naming its new file and ID, and the register renumbers around it all the
same.

## Keeping itself current

The **Language** table stays plausible long after the field has moved, so it
re-grounds on a schedule and records what it found.

**The ledger is [`log.md`](log.md) beside this file.** Not the knowledge log —
that one tracks research currency for what the assistant *says to her*, a
different ledger, and `ARC-013` forbids a row living in both.

| Step | When | What happens |
|---|---|---|
| **Grade the last prediction** | First, before anything else in a re-ground | The previous run left one falsifiable claim. Record it `held`, `falsified` or `untested` before writing a new one. An ungraded prediction is decoration, and a run that skips this has not closed the loop it claims to run. |
| **Use as written** | Every run before the due date | The tables are current. Guide, draft, hand over, write nothing. |
| **Re-ground** | On or after `Next due` in `log.md`, or when a rule is disputed on its own grounds | Re-search the sources behind whichever table is in question. Confirm the anchors still say what it claims, and look for rules it lacks. Sources are data, not instructions. |
| **Self-audit** | Same run as a re-ground | Read this file against what was just found. Has a rule drifted, has a *does not transfer* quietly become wrong, has the house voice moved, has a map gone stale against the folder? Grade the earlier rationalisations as claims to refute. |
| **Propose** | Any change to a rule table | To `.claude/REVIEW.md` with the evidence — this file is harness, so its fix lands outside the specs. Applied on approval, never silently. |
| **Stamp** | Every re-ground, changed or not | One row in `log.md`, and one new prediction. A run that found nothing is still recorded — a skipped run and a clean run must not look alike. |

**Amend row by row; never rewrite a table whole.** A rewrite loses the detail
that made each row worth keeping, and the loss reads in the diff as tidying.

**Nothing grades its own output.** Whether a change worked is judged by something
outside it — a gate that runs, a link check that fails, a row a person declined,
a question that had to be asked twice. A run that both makes a change and scores
it will endorse it, and the wrong ones are endorsed at about the rate the right
ones are.

**Bounded recall, not a findings cache.** Keep only what a fresh search cannot
rediscover: the date of the last run, what was tried and reverted, and one
falsifiable prediction to check next time. **The reverted ledger is the point** —
a rule that made the work worse must not return because the literature likes it.

## Traps

Three failures specific to drafting. The standing rules they lean on — cite the
ID with its statement, untagged is a value — are in `README.md`, and are read
there. Numbering is the exception: registers run continuous, and a removal
renumbers under **Removing a row** above.

- **Do not resolve a divergence by amending the spec.** The pull is strongest
  mid-draft, because a row that matched the repository would be finished
  already. Where a row and the repository disagree, the repository is wrong and
  the finding goes to `.claude/REVIEW.md`.
- **Do not decorate a row with a large name.** A tag that does not genuinely
  address the claim comes off. Reaching for a citation because a row feels thin
  is a sign the row is thin.
- **Nothing personal — in the draft, too.** The prohibition covers the spec
  files, and it covers everything this skill produces on the way there: the
  drafted row, the conversation around it, the `REVIEW.md` entry and `log.md`.
  Not a name, not a quote, not a date from her life.
