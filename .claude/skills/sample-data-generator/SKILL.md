---
name: sample-data-generator
description: Building, refreshing or extending the invented record in samples/ - when the dashboard needs something to look at, a new view has nothing in it to show, the sample's dates have fallen into the past, or its shape has drifted from the shape data/ now has. Harness work, asked for by the developer. Never for anything under data/.
---

# Sample data

`samples/` is a second record: invented, nobody's, the same shape as the real
one. The app reads it through `ux/lib/data-dir.js` and `ux/lib/content-read.js`,
the same two files that read hers, with **no branch anywhere for "sample mode"**.
That is the whole reason it is a record and not a fixture module — a preview down
its own code path proves the preview works, not the design.

**The switch is Settings › Record**, in the running app. `npm run dev:sample`
from `ux/` opens on it, which only saves the first click.

The binding design is `specs/data/sample.md`. This skill is how
**SMP-007**, *"A fabricated record is kept current with the real one — in shape,
and in time."*, actually gets done.

## The one rule

**Nothing here is ever copied from a real record.** Not a sentence, not a name,
not a date. `ux/scripts/check-privacy.mjs` walks this folder like any other
harness file, so a name that also appears in `data/people/`, or a line that also
appears in the record, fails the build.

When it fails, the fix is to **rename or rewrite the invention**. Never to add an
exclusion to the check.

## Why this is a skill and not a one-off

Three things pull it out of date, and all three come round again:

1. **The calendar is relative to today.** Every "coming up" row eventually falls
   into the past and the view empties out. A sample frozen in time slowly stops
   being a sample.
2. **A new view arrives with nothing in it.** The sample is what a new surface is
   designed against, so it has to grow a section before the view can be looked at.
3. **The real record's shape moves.** A file added under `data/`, a heading
   renamed, a new field — the sample has to follow, or it stops proving anything.

## Before you write

Read `data/INDEX.md` for the current shape, and the blank shapes each skill owns
(mapped in `.claude/skills/README.md`) for the file formats. The sample must be
**shape-identical and content-disjoint**: same headings, same frontmatter, same
table columns — and not one sentence in common.

## The tree

| Path | Must hold |
|---|---|
| `samples/IS_SAMPLE` | The marker. Its presence is what raises the banner on every page. Never remove it. |
| `samples/profile.yaml` | `name` and `timezone`; the four essentials may stay empty. The name is the invented one, and it is what the shell says. |
| `samples/state/now.md` | Filled. This is read first, every session, and the home view is built from it. |
| `samples/timeline.md` | A tag list, an **Eras** section, and ~20 dated entries oldest first. |
| `samples/INDEX.md` | A row for every standing file that exists. |
| `samples/me/` | All five: `about_me`, `what_i_want`, `what_helps`, `how_to_talk_to_me`, `patterns`. |
| `samples/people/` | One file per person, `<firstname>.md`. Four or more, each with a name that appears in timeline lines. |
| `samples/journal/` | One file per day, `YYYY-MM-DD.md`. Several, spread across months, good days among the bad. |
| `samples/calendar/calendar.md` | Upcoming dates **still in the future**, plus hard and good recurring ones. |
| `samples/therapy/` | `what_im_working_on.md`, and three or more dated sessions under `samples/therapy/sessions/`. |
| `samples/safety/safety_plan.md` | Something real under every heading. |
| `samples/state/` | `log.md` and `open_loops.md` — a session history, and groups with some threads ticked and one gone cold. |
| `samples/archive/` | The archive exists even when empty, with a README in it. |

## Make every view show something

The point of the sample is that no view renders its empty state. Walk them:
Now · Timeline · People · a person's page · Calendar · Journal · About me ·
Therapy · Open loops · Safety plan · About. If one is blank, the sample is
short of whatever feeds it, not the view.

Two that are easy to miss:

- **A person's page shows mentions** — their name has to appear in timeline
  lines, or the section is empty.
- **Open loops has a "Cold" group** — six months untouched is the interesting
  state, so invent one.

## Inventing well

- **One life that hangs together.** Same person across every file; a timeline
  line and the journal entry it points at agree about what happened.
- **Quote her.** Invented words, but written as speech, where they carry feeling.
  Flat summary makes flat views.
- **Good days as diligently as bad ones.** A sample that is only bleak
  misrepresents what the surface is for.
- **Arc, not noise.** The Eras section should be readable as a shape — it is what
  a session reads to orient.

## Traps

- **Pointers keep the `data/` prefix even here** — a timeline line ends
  `-> data/people/<firstname>.md`, never a path into this folder.
  `ux/lib/views.js` turns that prefix into a route, so "correcting" it breaks
  the link.
- **Nothing writes to `samples/`.** It is read-only input. Her photograph in
  particular is bound to `data/` no matter which record is on screen
  (`ux/lib/avatar.js`).
- **Don't touch `data/` on the way past.** This is harness work. If something in
  the real record looks wrong, raise it in `data/state/proposals.md`.

## Verify

1. `npm run check` from `ux/` — privacy, config, links, safety, perimeter.
2. Open the app, **Settings › Record → Sample**, and walk every view.
3. Switch back to the real record and confirm it is unchanged.
