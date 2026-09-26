// A column whose width belongs to the reader, and where that width survives.
//
// Two panes use this — the harness index and the app's own navigation — and they
// differ only in four values: which property the stylesheet reads, what key the
// browser remembers it under, and the two ends of the range. Everything else is
// identical, so it is written once here and configured twice.
//
// ── One home per number ─────────────────────────────────────────────────────
//
// The DEFAULT is not here. It is the custom property's value on `:root` in
// globals.css, because a default width is a design decision and design decisions
// live in the stylesheet. Everything on this side reads the property rather than
// carrying its own copy, so there is no second number to find when it changes.
//
// The BOUNDS are here, because nothing in CSS needs them: they exist to clamp a
// number arriving from a drag or from storage, and both of those are script.
//
// ── Why a blocking script ───────────────────────────────────────────────────
//
// The same reason the theme and the sidebar have one. Restoring in an effect
// runs AFTER first paint, so a reader who widened a column would watch it render
// at the default and jump. The init script sets the property before anything is
// painted.
//
// Remembered per browser, under the same `dear-` prefix the theme and the
// sidebar use. Nothing about it reaches `data/`.

/**
 * @param {object} config
 * @param {string} config.key   localStorage key, `dear-` prefixed.
 * @param {string} config.var   The custom property the stylesheet reads.
 * @param {number} config.min   Narrowest the column may be dragged.
 * @param {number} config.max   Widest.
 * @param {number} [config.step] What one arrow key is worth. Large enough that
 *   holding a key crosses the range in a second or two, small enough to land on
 *   a width you meant.
 */
export function paneWidth({ key, var: cssVar, min, max, step = 16 }) {
  /** The width now, in px, from the property the layout is actually reading. */
  const currentWidth = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
    const px = Number.parseInt(raw, 10);
    return Number.isFinite(px) ? px : min;
  };

  /** A width clamped to the bounds, rounded to a whole pixel. */
  const clampWidth = (px) => Math.round(Math.min(max, Math.max(min, px)));

  // Clamped here too, not just on the drag: a stored value is a number from the
  // last release of this app, or from a hand-edited devtools field, and neither
  // is owed the benefit of the doubt. NaN — nothing stored, or nothing parseable
  // — falls through the `if` and leaves the stylesheet's default standing.
  const initScript =
    `try{var w=Math.round(Math.min(${max},Math.max(${min},` +
    `parseInt(localStorage.getItem('${key}'),10))));` +
    `if(w)document.documentElement.style.setProperty('${cssVar}',w+'px')}catch(e){}`;

  return { KEY: key, VAR: cssVar, MIN_W: min, MAX_W: max, STEP: step, currentWidth, clampWidth, initScript };
}
