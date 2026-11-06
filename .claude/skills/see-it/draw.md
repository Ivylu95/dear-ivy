# See it: how to draw a page

Read when a page is drawn, on either route, after that route's part. The rules
a page meets, in the order they come up.

## Contents

- What to draw
- Mermaid
- Layout
- The page
- Logos on the page
- Adding a logo
- Before publishing

## What to draw

- **The mechanism, not its name.** Draw the path a request takes, the boundary
  it crosses, the hop added or removed. A box with a word in it says less than
  the sentence.
- **Comparing two options:** draw both, side by side, with the edge that
  differs marked in the accent colour. Two boxes with nothing joining them is a
  list, not a comparison.
- **Label every arrow** with a verb of one or two words (`writes`, `pushes`,
  `polls hourly`). A legend only when an encoding repeats.
- **Plain labels:** no `§`.
- **One figure, one claim:** a `<figcaption>` saying what the picture shows, and
  the same words in the drawing's `aria-label`.
- **Privacy, the developer's route:** nothing from `data/` but the folder's
  name and its edge. No person's name, date, quote or file under it, in a
  label, a caption or the title (`ARC-004`). **Hers:** only what she named,
  in her words, and nothing naming her in the title or the link.

## Mermaid

For a small flow in the reply: a fenced `mermaid` block, `flowchart TD` on a
phone (top to bottom), `LR` only once wide was chosen for the chat. Use about eight
nodes at most, and keep the labels short. Quote the words `end` and `{}` in a
comment, as Mermaid's syntax reference warns. If the page form needs Mermaid itself, load
`mermaid` from `cdn.jsdelivr.net/npm/` at the exact version in
`dev/skills/see-it/log.md`, never a range.

## Layout

The canvas is a box of fixed size; nodes sit on it at absolute coordinates and
edges are one SVG laid over it, with the same `viewBox`.

| Part | Rule |
|---|---|
| Canvas | Narrow (the default, and on a phone): one column, 340 wide, reading top to bottom. Wide, once it was chosen for the chat: up to 960, reading left to right |
| Node | 132 wide, 100 tall: a 60 tile, the name under it, a short role line in mono under that. `left = centreX − 66` |
| Spacing | Node centres 140 apart in a row; tile tops 140 apart between rows |
| Group | 24 outside its outermost node boxes on each side (`centreX ± 90`); top 60 above the first tile, where its label sits; bottom at least 150 below the last tile top. Nest one level at most, inset 24 |
| Edges | A node is its tile **and** its text. Side to side at tile mid-height; downward from the box bottom (`top + 100`, plus 6) to the next tile top (minus 6); an elbow runs its vertical part in a corridor free of nodes and its horizontal part in the gap between rows. No line crosses a name |
| Edge kinds | `e`: accent, solid, the main flow, one continuous path where it can. `n`: neutral, internal. `n dash`: dev-time or deploy |
| Labels | Above a horizontal line (`y − 8`), right of a vertical one (`x + 10`); the halo in the template keeps them readable over a line |

Before building, list every vertical and elbow segment and ask which node
boxes it passes through. The answer must be none.

## The page

The template already meets the artifact page contract; keep it so:

- Leave out `<html>`, `<head>` and `<body>`. Give it a `<title>` that is a
  name of two to four words, and a one-sentence description when it is published.
- Colours only as the tokens on `:root`, redefined for dark under
  `prefers-color-scheme` (guarded by `:root:not([data-theme="light"])`) and
  under `:root[data-theme="dark"]`; `body` has its own background.
- Everything inline: logos as data URIs by `scripts/build.mjs`, no external image, no
  web font. The templates' own short script for tapping ([`tap.md`](tap.md)), inline; any other
  script only where Mermaid needs one, pinned.
- A 16px side gutter; the canvas inside the `.scroll` box, so a wide drawing
  scrolls inside it and the page never scrolls sideways.
- Text about 11 to 13px at drawn size, on a shared grid; edges carry their
  meaning on the mark.

## Logos on the page

- Tiles are white in both themes, so every logo shows as its brand drew it.
  Never recolour, crop or redraw one.
- A mark with a dark and a light version uses the dark-on-white one on the
  tile. A group label's 14px icon wants the square mark, not a wordmark.
- A generic thing, such as a person, a browser, a phone, a timer or a folder,
  gets a plain line drawing in `currentColor` inside its tile. A product's logo
  never stands in for something else.
- The footer credits the marks to their owners, as the template does.

## Adding a logo

Only when a diagram needs one the set lacks, and in a development session:

1. Find the official file. Try the brand's own press or brand page first. If
   that fails, use svgl's file for it, whose index links the brand page. If
   that fails too, use the project's own repository. Full colour where the brand publishes it; mono only where it
   publishes nothing else. Never Simple Icons or another redraw.
2. Save it unchanged as `logos/<name>.svg` (a PNG-only mark is wrapped
   unchanged in an SVG as a data URI, as GitHub Actions is).
3. Add its row to `logos/SOURCES.md`: name, file, official source, where
   fetched, colour or mono, licence or trademark note, today's date, sha256.
4. Run `node .claude/skills/see-it/scripts/check-logos.mjs`, and commit the logo with its
   row.

## Before publishing

- No line crosses a name or ends inside text; every arrow has a label or is
  the obvious main flow.
- Every logo is visible on its tile, in both themes; nothing sticks out of its
  group or the canvas.
- At 360px wide the page does not scroll sideways, and the narrow canvas reads
  without zooming.
- Title, caption and labels hold nothing from her record on the developer's
  route, and nothing she did not name on hers.
- With no browser to hand, re-read the coordinates against *Layout*, and say
  it was not seen.
