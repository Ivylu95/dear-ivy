import { paneWidth } from '@/lib/pane-width';

// How wide the harness index is, and where that survives.
//
// The index is read at two very different depths: glanced at to find one file,
// and lived in while working through a folder of specs whose names run long.
// 206px is right for the first and cramped for the second, and there is no
// width that is right for both — so the column becomes the reader's rather than
// the stylesheet's.
//
// ── One home per number ─────────────────────────────────────────────────────
//
// The DEFAULT is not here. It is `--harness-index-w` on `:root` in globals.css,
// because the default width is a design decision and design decisions live in
// the stylesheet. Everything on this side reads the property rather than
// carrying its own copy, so there is no second 206 to find when it changes.
//
// The bounds ARE here, because nothing in CSS needs them: they exist to clamp a
// number coming in from a drag or from storage, and both of those are script.
//
// ── Why a blocking script ───────────────────────────────────────────────────
//
// The same reason the theme and the rail have one. Restoring in an effect runs
// AFTER first paint, so a reader who dragged the column to 380px would watch it
// render at 206 and jump — once per full page load, on the one view where the
// column is the point. This sets the property before anything is painted.
//
// Remembered per browser, under the same `dear-` prefix the theme and the
// sidebar use. Nothing about it reaches `data/`.
export const HARNESS_WIDTH = paneWidth({
  key: 'dear-harness-width',
  var: '--harness-index-w',
  min: 240,
  max: 300,
});

export const { KEY: WIDTH_KEY, VAR: WIDTH_VAR, MIN_W, MAX_W, STEP, currentWidth, clampWidth } =
  HARNESS_WIDTH;

export const HARNESS_WIDTH_INIT_SCRIPT = HARNESS_WIDTH.initScript;
