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
   so a name that also appears in `data/people/` fails the build. When that
   happens the fix is to rename the person here. Never to add an exclusion.
2. Nothing writes here. It is read-only input, the same as the real record —
   including her photograph, which `ux/lib/avatar.js` binds to `data/` alone no
   matter which record is on screen.
