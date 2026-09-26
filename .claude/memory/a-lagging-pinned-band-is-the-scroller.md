# A pinned band that lags is the scroller's fault, not the band's

_2026-09-21_

The symptom, reported from a browser: the prose flowed with the scroll while the
headings lagged about a frame behind it, so they read as bouncing rather than
moving with the page. Paraphrased rather than quoted — a quotation of a person
has no business in this folder, whatever it is about.

The `##` section bands in the harness panel trailed the prose by about a frame
and snapped level whenever the scroll stopped. Everything about where they pinned
was correct; they were simply drawn late.

## What it is not

Six fixes were shipped before anything was measured, and all six were wrong. They
are listed because each one looks right from the code alone.

- **Not geometry.** Drift, pin lines, roofs, containing blocks — that is a
  different fault with its own note, and its measurement says 0 here. See
  [`pinned-columns-slide-for-three-reasons.md`](pinned-columns-slide-for-three-reasons.md).
  A band that is in the right place and arrives late is not a geometry problem,
  and no `top` offset will touch it.
- **Not the grain.** `--grain` is a `url()` data URI, an image rasterised once per
  size and reused, not a `filter:` re-run per paint. See
  [`grain-stays-svg-turbulence.md`](grain-stays-svg-turbulence.md).
- **Not the band's own promotion.** `will-change: transform` on the heading had
  been tried twice. It does not fix this and it is the wrong element.
- **Not dev-mode overhead, not the scroll spy, not stale CSS.** All checked, all
  clear. The spy is passive and rAF-coalesced; a clean production build behaves
  identically.

## What it is

Chrome's layer tree, read over CDP while a band was pinned:

```
div.section-head   w=704 h=53   sticky=true  reasons=Overlap     ×6
#document          ...          scrolls=true reasons=RootScroller,OverflowScrolling
```

Every band had a compositor layer of its own — promoted for **Overlap**, because a
pinned band paints above content that is scrolling underneath it. And
`.harness-panel`, the only box on that screen that actually scrolls, had **no
composited scrolling layer at all**.

That is the whole fault. The prose is moved by a main-thread scroll; each band is
positioned separately by the compositor; the two are a frame apart. The heading
trails the text and catches up when the scroll ends.

## The fix

One line, on the scroller, in the `@media (min-width: 1361px)` frame in
[`ux/app/globals.css`](../../ux/app/globals.css):

```css
.harness-panel { will-change: scroll-position; }
```

**The hint goes on the box that scrolls, never on the thing that pins.** Promoting
the band is the same mistake in mirror image, and it had already been made twice
in this repo before anyone measured which element had the problem.

`scroll-position` rather than `transform` for two reasons: it states the true
thing, and `transform` would make the panel a containing block for anything
`position: fixed` inside it, which is a side effect nobody asked for.

## How to find the next one in ten minutes instead of a day

Reading CSS cannot answer this. A band in the right place that is drawn late is
invisible to any measurement of where things are — that is why six fixes passed
their own verification and none of them helped.

Drive a real browser and read the layer tree:

1. `chrome.exe --headless=new --remote-debugging-port=9222 --user-data-dir=<temp>`
2. Connect to the page's `webSocketDebuggerUrl` from `http://127.0.0.1:9222/json`.
3. `Page.enable`, `DOM.enable`, `Runtime.enable`, navigate, scroll so a band is
   actually pinned — **then** `LayerTree.enable`. Enabling it is what emits
   `LayerTree.layerTreeDidChange`; toggling it off and on again emits nothing, and
   injecting CSS before enabling can suppress it. One browser per variant is
   slower and reliable.
4. For each layer with a `backendNodeId`, `DOM.describeNode` for its class and
   `LayerTree.compositingReasons` for why it exists.

Then ask one question: **does the box that scrolls have a composited scrolling
layer?** If the things pinned over it do and it does not, that is the bug.

The app is behind a login gate, so this was run against a reconstruction of the
panel — the real stylesheet served from the dev server, with the DOM shape copied
out of the harness layout and the doc page it wraps. That was enough to reproduce
it, and is worth rebuilding rather than trying to get a headless browser through
the gate.
