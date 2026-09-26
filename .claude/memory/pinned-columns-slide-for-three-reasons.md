# A pinned column slides for three reasons

_2026-09-21_

Both index columns in the dashboard are supposed to hold still while the
document beside them scrolls — the harness tree and the review queue on the left
of the split, the contents rail on the right. Between them they were fixed six
times in one session, and every failure looked the same to the reader: the
masthead, the gloss and the filter sliding a little and coming back.

They were three different bugs. If you are midway through moving a `top` offset
by a few pixels to make one of them stop, stop and read the list first —
**measure the drift, then pick the cause from the number.**

## 1. The pin line has to be the pixel the element already sits on

`top` is measured from the scrollport's edge. The element's resting place is
wherever the content above it puts it. If those differ by N, the column travels
N before it pins — which reads as a column that scrolls a little and then
decides not to.

So the two are stated from the same token, never as two literals that happen to
agree today: `.harness-aside` pinned at `calc(var(--sample-bar) + var(--page-top))`
because `--page-top` is exactly the air above it.

## 2. Nothing may lie between the scrollport's edge and the pin line

Padding on the scrolling box pushes every pin line down by that much, and the
band it opens above a pinned heading is not empty — it is the block scrolling
**through** it, in full view. `Lines 80` sat above a pinned `THIS FILE` in a 46px
strip while the rest of the table ran under it.

Taking the padding away only moves the problem: the heading then pins flush to
the top of the column, which is 46px above where it rests, and you are back to
cause 1.

**The air goes outside the scroller.** A margin on the scrolling box, so the box
simply begins lower — `--rail-air` on `.rail-sticky` in
[`ux/app/globals.css`](../../ux/app/globals.css). The same move `.main` makes
onto `.main-inner` one level up, for the same reason.

## 3. A sticky element only travels inside its containing block

Two shapes, and the second is the one nobody sees coming.

**Scroll range with no block under it.** `.main` carried 96px of bottom padding
below the grid, so the last 96px of scroll had no grid beneath it: the column
pinned correctly for the whole scroll, ran out of containing block at the grid's
last pixel, and was carried those 96px off the top of the window. Now
`.main:has(.harness-split)` sets `padding-bottom: 0` and `.harness-panel` carries
that air inside the grid, where it is scroll range the column can stick in.

**A block that is its own box.** Every rail block was a `<section class="rail-card">`,
so a heading's containing block was that section — and a *folded* block is
exactly one heading tall, which leaves the heading nowhere to slide. The
headings below a long open block therefore never reached the bottom edge they
were supposed to pin to. `.rail-card { display: contents }` drops the box and
leaves the children in the column, so every heading can travel the whole rail.

## 4. The containing block is the CONTENT box, and padding shortens it

Found on 2026-09-21, on the section bands in the harness panel rather than on a
column, and it cost a whole session because it looks exactly like causes 2 and 3
and the obvious fix makes it worse.

Two sections with air between them. As `margin-top` on the second, that air
belongs to no containing block at all: the first band is pushed off when its
section's box ends, the second does not reach the pin line until the margin has
passed, and for that distance nothing is pinned and the prose runs at the top of
the column. That much is cause 3, one level down.

The obvious repair is to move the air inside the box above — `padding-bottom` on
the section — and **it is wrong**. A sticky element is constrained to its
containing block, and the containing block of an in-flow element is its parent's
**content box, not its padding box**. Bottom padding on the section therefore
does not lend the band more room to travel; it takes exactly that much away. The
band lifts off the pin line one padding early and rides up the column while the
next one is still below the fold.

Measured, in headless Chrome against the real stylesheet: a band 52.5px tall,
36px of section padding, came off the pin with 76.4px of section left instead of
52.5, and reached −33px — a third of the way out of the column — before the next
band arrived.

**The air has to be content.** It is carried by the section's last child, the
`.doc-body`, as its own bottom padding — `--section-air` plus `--doc-body-end` in
[`ux/app/globals.css`](../../ux/app/globals.css). The section's content then runs
right up to where the next section begins, the two bands tile, and one leaves the
pin line in the frame the next reaches it. The page looks identical either way,
which is what makes this worth writing down.

Verified the same way afterwards: drift 0 across the whole scroll range, and no
scroll position at which the top edge of the column shows bare prose.

## Where a column must not move at all, do not use sticky

The harness index was tuned three times on the numbers above and still slid a
pixel or two under display scaling. Sticky holds still only while three things
agree, and each agreement is one edit away from being wrong.

The cure is to remove the scroll from underneath it. Above the stacking
breakpoint the split is now a **frame**: `.main` stops scrolling for that view,
the grid is the height of the window, and `.harness-panel` is the only box that
moves — see the `@media (min-width: 1361px)` block after `.harness-panel` in
[`ux/app/globals.css`](../../ux/app/globals.css). The index is then a box with
nothing scrolling beneath it, and it cannot slide by a pixel because there is no
pixel to slide by. It is the same arrangement the shell already makes one level
up — one viewport, columns side by side, one of them scrolling.

Two things follow that are easy to miss. The scroll spy in
[`ux/components/shell/RailNav.jsx`](../../ux/components/shell/RailNav.jsx) finds
its scroller by walking up from a section, so it adapted on its own; anything
new that assumes `.main` scrolls will not. And offsets measured from the top of
the **window** — the sample strip, the mobile header — are no longer part of an
offset measured inside the panel, which is why `--sample-bar` and `--header-bar`
are zeroed on `.harness-panel` rather than subtracted in each rule that reads
them.

## Diagnosing the next one

Scroll until it misbehaves, then measure how far the column moved:

| The drift is | The cause is |
|---|---|
| the scroller's top padding | 2 — air inside the scroll box |
| the scroller's bottom padding | 3, first shape — scroll range outside the grid |
| the height of the head itself | 1 — pin line and resting place disagree |
| zero, where movement was wanted | 3, second shape — the box is too short to travel in |
| the containing block's bottom padding | 4 — padding shortens the travel, it does not extend it |
| the gap between two blocks | 4 — the air belongs to neither, put it inside as content |

**Measure it, do not reason about it.** Five fixes were shipped blind on this one
symptom before anything was measured, and three of them were wrong; the fourth
made it worse. Headless Chrome over CDP against the real stylesheet gave the
number in one run. A sticky fault is geometry, and geometry is cheap to read.

**A band that is in the right place and arrives late is not this fault.** If the
heading trails the prose and snaps level when the scroll stops, every measurement
on this page will read 0 and every fix from this page will miss — which is
exactly what happened for six of them. That is a compositing fault: see
[`a-lagging-pinned-band-is-the-scroller.md`](a-lagging-pinned-band-is-the-scroller.md).
Do not reach for `top` offsets for it, and do not reach for `will-change` on the
heading; the hint belongs on the box that scrolls.
