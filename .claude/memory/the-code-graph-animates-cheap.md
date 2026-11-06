# The code graph animates cheap and draws crisp at rest

**Carried over 2026-10-08** with the code map, from an earlier admin app's File
Tree, where both faults were hit and fixed before the port.

- **The cheap draw path keys off motion, not the pointer.** In the earlier admin app's graph,
  dragging was smooth but the cloud lagged when it moved on its own (the settle
  when a scope opens, the drift after a drag is let go), because the flat, 1x,
  label-free path ran only while a pointer was down. In
  `dev/ui/components/codemap/Graph.jsx` it runs whenever the layout is moving
  (`alpha > 0.01`, the same threshold that keeps the loop ticking), so the last,
  still frame is the only one that pays for orbs and names. A change that gates
  `lite` on dragging alone brings the lag back.
- **Orbs are stamped from one sprite per colour**, never a radial gradient per
  node per frame; the marching edges of a hovered file repaint every frame.
- **The history walk never blocks the page.** Up to sixty `git ls-tree` runs
  cost seconds on Windows, so the page hands the trends chart a promise and
  arrives without it (`dev/ui/app/(admin)/codemap/page.jsx`). Awaiting it
  before render made the earlier admin app's tab slow to open for a view most visits never
  show.
- **History is kept per commit, and sampled at a fixed stride** (2026-10-08,
  `dev/ui/lib/code-map-history.js`). Spreading sixty samples evenly moved every
  sample on every commit, and this repository commits many times an hour, so
  each new HEAD re-ran the whole walk (~6 s). A power-of-two stride keeps the
  same commits sampled, each commit's tree counts are kept by hash, and the log
  is read only from the last HEAD forward: ~0.3 s after a commit.
- **Measure clicks in a production build, against a blank-page control**
  (2026-10-08). Under `next dev` a click read 80-400 ms and React's Profiler
  blamed the rail, treemap and overview; built, the same clicks land in two
  frames (~35 ms) and the graph holds ~18 ms frames dragging. Three traps on
  the way: the Chrome tab the agent drives can be hidden, which throttles
  timers to once a second and stops `requestAnimationFrame` (use a
  MessageChannel tick, or headless Chrome); a minimised window lays the
  treemap out at zero width; and this machine stalls 0.3-4 s at random, so a
  lone spike means nothing until a blank page in the same browser is shown
  not to have it. The preview is `photograph-a-view-without-the-login.md`'s
  recipe, built and started rather than run under `next dev`.
