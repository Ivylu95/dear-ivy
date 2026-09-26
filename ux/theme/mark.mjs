// The app's mark, as data rather than as JSX.
//
// It is drawn in two places that cannot share a component: components/ui/icons.jsx
// renders it into the rail and the login card, and scripts/generate-theme.mjs
// writes it into app/icon.svg for the browser tab. A favicon is a file on disk,
// not a React tree, so the second one cannot import the first.
//
// It lived only in the component until the envelope became a pen, at which point
// the tab kept showing an envelope for a week because nothing connected the two.
// The paths live here now, so a change to the drawing reaches both.
//
// ── What it is ─────────────────────────────────────────────────────────────
//
// A pen, and the line it has just written. She talks and it gets written down
// for her; that is the whole product, and the stroke under the nib is the only
// part of it she ever sees.
//
// It was an envelope — the wordmark is a salutation, so the mark was the letter.
// True, but generic: an envelope is the icon for mail everywhere else on her
// machine, and it said what the thing is called rather than what it does.
//
// A feather quill was the obvious alternative and is the one to avoid: at 30px
// it reads as a leaf, and `leaf` is already the glyph this app uses for a file
// that is empty rather than missing.

// Trimmed to the artwork plus half a stroke, so a rendered size is the height of
// the ink rather than of a box with 21% air in it. That air is why the mark once
// out-shouted a wordmark two-thirds its height.
//
// These numbers are the INK's bounds, not the anchor points'. The box was
// { 3.6, 3.9, 25.2, 25.2 } and it clipped its own drawing: 0.71 off the right,
// 0.51 off the top, 0.83 off the bottom. Both of the offenders are curves, and
// a curve leaves its anchors — the pen's cap is an arc whose widest and highest
// points lie between its two endpoints, and the written line's second bezier
// dips below the y its endpoints share. Measured from the endpoints, all three
// were invisible.
//
// So was the bug, at the sizes it was used: at 24px in the login card and 28px
// in the rail, three quarters of a unit is a third of a pixel. It only showed
// when the mark went to 64px on the 404, where the pen's cap came off square.
// If these are ever re-derived, sample the paths — do not read the `d`.
export const MARK_VIEWBOX = { x: 3.3, y: 3.3, w: 26.7, h: 26.7 };

export const MARK_STROKE = 1.8;

export const MARK_PATHS = [
  // The pen.
  { d: 'M24.2 4.9a2.7 2.7 0 0 1 3.8 3.8L14.6 22.1l-5.6 1.8 1.8-5.6L24.2 4.9Z' },
  // The nib split, which is what stops it reading as a pencil.
  { d: 'M21.6 7.5 25.4 11.3' },
  // And the line it has just written. Dimmed, because it is the trace rather
  // than the instrument — and because a second stroke at full weight under a
  // small mark closes up the counter between them.
  { d: 'M4.6 27.4c2.4-2.3 4.8-2.3 7.2 0s4.8 2.3 7.2 0', width: 1.6, opacity: 0.5 },
];
