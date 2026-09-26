---
name: harness-writer
description: Changing the harness the agent may edit directly - a skill, a hook, a command, a prompt, settings, the knowledge base, the review queues, or the dashboard in ux/. Use to find which file owns a change, make it, run its gate and commit it. Invoked with no target named, it opens with a map of .claude/ and asks what to work on. Anything inside specs/ goes to spec-manager instead. Harness work, asked for by the developer. Never for anything under data/.
---

# Harness writer

**The harness is everything non-personal** — `.claude/`, `specs/`,
`knowledge/` and `ux/`: the constitution, the specs, the skills, the hooks, the evidence base,
the tooling. It is git-tracked, written for no one's eyes but a developer's, and
changed one traceable change at a time. Her record is `data/`, and nothing in
this skill ever touches it.

**Most of it is the agent's to edit.** Two parts are not: the specs, which are
the owner's standing decisions and belong to [`spec-manager`](../spec-manager/SKILL.md),
and `CLAUDE.md`, which is only ever proposed. Everything else is written
directly — and because it is read beside a dozen neighbours, cited by hand in
commits, and obeyed by sessions that will never read the paragraph explaining
it, it is written in a house style worth holding.

## Stance

This skill guides a developer around their own harness. It prefers the smallest
change that closes the gap, says plainly where a change may not be made, and
gives one recommendation rather than three options weighed against each other.

| It does | It does not |
|---|---|
| Show what can be changed before asking what to change | Ask a question the map would have answered |
| Name a default and say why, leaving the escape hatch open | Lay a menu down and wait |
| Say in one line where a change may not be made, and offer the route that is open | Argue the boundary, or route around it |
| Make the change, run its gate, commit it | Describe the change and stop |
| Carry what the session has already established | Re-ask what has been answered |

**The stance governs the conversation; the procedure governs the file.** A
harness file is judged by whether it is right, never by whether it reads warmly,
and a voice held into the writing costs accuracy where it buys tone. So the file
is written in its own register, not in the guide's.

## Opening

Two ways in, and the first is the common one.

| The request | What happens |
|---|---|
| Names nothing — the skill's name alone | **Open with the map of `.claude/`.** One table, then one question. Change nothing yet. |
| Names an area, a file or a change | Go to that area's row below and work. Offer the map only where the named target turns out to be the wrong file. |

**Every map is built by reading the folder, never recalled and never copied into
this file.** A list restated here is `ARC-013`, *"Every fact has one
authoritative home; everything else points to it."*, a second time, and is stale
the first time an area is added. Read the directory, read each area's own README
where it has one, and count what is there.

The opening table is the whole of `.claude/`, one row per area:

| Column | Holds |
|---|---|
| **Area** | The file or folder, linked |
| **Holds** | What lives there in one clause, taken from its own README and never invented, then its size — rows, skills, hooks or files, whichever that area counts in |
| **Standing** | ✏️ edit · 📝 draft only · 🚫 propose elsewhere, from **The write boundary** below |

Anything empty is named under the table rather than left to be discovered — an
empty tracked file and an empty folder are both findings.

**Name a default.** The map closes with one recommended first move and the reason
for it — the open finding, the stale claim, the file nothing points at — and a
line saying it can be ignored for anything else. Eleven areas and no
recommendation is a menu, and a menu is the thing a guide exists to spare
someone.

**Then one question, and stop.** Which area, and what you want done there. One
question, never a menu of four, and the run ends on it — nothing read further,
nothing drafted ahead.

**The map reopens.** Asked for again mid-task, it is drawn again rather than
recalled, because it is read off disk and the disk has moved.

## The write boundary

The one rule that ends jobs early.

| Area | Standing | Where a change goes |
|---|---|---|
| `specs/**` | 📝 **Draft only** | Load `spec-manager`. Not this skill's to write |
| `.claude/CLAUDE.md` | 🚫 **Propose elsewhere** | `data/state/proposals.md`, with what prompted it. The constitution is never edited by a session |
| `.claude/REVIEW.md`, `specs/REVIEW.md` | ✏️ **Edit** | Written directly. Each finding goes to the queue its fix lands beside |
| `.claude/skills/**` | ✏️ **Edit** | Written directly, then the router table in `CLAUDE.md` proposed in the same breath where a row is needed |
| `.claude/hooks/**` | ✏️ **Edit** | Written directly. `selftest.mjs` runs before it is called done |
| `knowledge/**` | ✏️ **Edit** | Written directly, under that folder's own README |
| `.claude/commands/`, `.claude/prompts/`, `settings.json` | ✏️ **Edit** | Written directly |
| `ux/**` | ✏️ **Edit** | Written directly, under the registers that govern the surface |
| `data/**` | ⛔ **Never, from this skill** | A different session. Harness work never writes her record |

**The boundary is sized to the damage.** The specs and `CLAUDE.md` carry the
constraints everything else is judged against, so they are drafted and proposed;
a skill, a hook or a command is edited directly because it is reverted in one
step. That table is not bureaucracy around the work — it is what makes a
self-editing harness safe to run.

**Every edit is committed and pushed when it is done**, one change per commit,
with nothing personal in the message. The `commit` skill has the form.

## What can be asked for

| Ask for | What comes back |
|---|---|
| **A map** | The area's own table, built by reading it |
| **A skill, hook or command change** | The change made, the gate run, and the commit |
| **A new skill, or a rewrite of one** | `skill-writer` — it researches, tests and logs before anything is committed |
| **A finding** | An entry in whichever `REVIEW.md` the fix lands beside |
| **A constitution change** | A proposal in `data/state/proposals.md` — never an edit |
| **Anything about a spec row** | `spec-manager` |

**Tables carry the output.** A finding is read beside others, and a paragraph of
prose where a table would do is the thing the house format exists to refuse.
Prose is kept for the one thing a table cannot hold — the reasoning behind a
recommendation.

**Narrow enough to read on a phone.** This is answered in a chat window on a
handset as often as at a desk. The handset never wraps a table cell — a cell
wider than the screen is cut off, and a table that overflows there is a table
nobody reads.

| Rule | Because |
|---|---|
| Three columns, four at the outside | A fourth column of prose wraps to unreadable at handset width |
| Never two tables set side by side | It doubles the width to save scrolling, and scrolling is the cheap thing on a phone |
| Short cells — a clause, not a sentence, with links carrying the detail | A cell wrapping to five lines has stopped being scannable, which was the only reason it was a table |
| A long list split into several short tables under their own headings | Two narrow tables read on a handset; one wide one does not |

## Keeping itself current

Nothing here re-grounds on a schedule: the maps are read off disk every time, so
they cannot go stale in this file. What can drift is the write boundary, when an
area is added or moved. **A change to the boundary is made here and in
`spec-manager` in the same commit** where it touches the specs, so the two never
disagree about which of them owns a file.

**Nothing grades its own output.** Whether a change worked is judged by something
outside it — a gate that runs, a link check that fails, a question that had to
be asked twice. A run that both makes a change and scores it will endorse it.
