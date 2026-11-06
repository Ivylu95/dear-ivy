# Sample record

Invented. Nobody's. It exists so the dashboard can be looked at with a record in
it — a timeline with years in it, people with files, a journal that scrolls, a
safety plan with something under every heading.

**Why it sits at the repository root, beside `data/`.** Because that is what it
is: a second record, the same shape as the first. It used to live inside the app,
which said it was a fixture belonging to the dashboard — and then the dashboard
grew a switch between the two. A fixture the product can switch to is not a
fixture.

**Why it is a whole record rather than a fixture module.** The app reads this
through `ux/lib/data-dir.js` and `ux/lib/content-read.js`, the same two files
that read the real one, with no branch anywhere for "sample mode". A sample that
renders down its own code path proves nothing about the design; this one proves
the parsers, the empty states, the sort orders and the layout all hold on
real-shaped input.

**Look at it:** open the dashboard and use **Settings › Record**. The switch
writes a cookie that the server reads before it renders, so it takes effect on
the next page and nothing restarts. `npm run dev:sample` from `ux/` starts the
dev server with this record already up, which only saves the first click.

**Two rules.**

1. Nothing here is copied from a real record, ever — not a sentence, not a name.
   `ux/scripts/check-privacy.mjs` walks this folder like any other harness file,
   so a name that also appears in `data/core/people/` fails the build. When that
   happens the fix is to rename the person here. Never to add an exclusion.
2. Nothing writes here. It is read-only input, the same as the real record —
   including her photograph, which `ux/lib/avatar.js` binds to `data/` alone no
   matter which record is on screen.

## Folders

| Folder | What it holds |
|---|---|
| [`archive/`](archive/README.md) | Superseded material, never deleted |
| [`core/`](core/README.md) | The core module's part: the timeline, working memory, who she is, people, the journal, the calendar and the photograph |
| [`fitness/`](fitness/README.md) | What she eats, drinks and takes: one file a day, and her supplements |
| [`safety/`](safety/) | The safety plan |
| [`therapy/`](therapy/README.md) | Appointments and the clinical focus |

## Standing files

The standing, undated files. Dated events live in `core/timeline.md`.

## About her

| File | What is in it |
|---|---|
| `core/me/about_me.md` | The basics — work, the flat, the shape of a week. |
| `core/me/what_i_want.md` | What she is working toward. |
| `core/me/what_helps.md` | What has actually worked. Outranks anything general. |
| `core/me/how_to_talk_to_me.md` | Her words, what lands badly, what not to push on. |
| `core/me/nudge.md` | Whether she asked to be told when a check-in waits. Off unless she asked. |
| `core/me/patterns.md` | Loops she has named herself. |

## People

| File | Who |
|---|---|
| `core/people/person-o.md` | Her sister. |
| `core/people/person-w.md` | Closest friend. Climbing, Thursdays. |
| `core/people/person-b.md` | Her manager at the lab. |
| `core/people/person-h.md` | Her therapist. |

## Working files

| File | What is in it |
|---|---|
| `core/state/now.md` | Current snapshot. Read first. |
| `core/state/open_loops.md` | Threads to come back to. |
| `core/state/log.md` | One line per session. |
| `safety/safety_plan.md` | Warning signs, what helps, who to call. |
| `therapy/what_im_working_on.md` | The current clinical focus. |
