import { paneWidth } from '@/lib/pane-width';

// How wide the review index is, and where that survives.
//
// Its own pane rather than a second user of lib/harness-width.js, though the two
// columns do the same job in the same place. They hold different things: the
// harness index is filenames, which are short and which the reader already knows
// the shape of; this one is a spec ID and the opening clause of a finding, and
// how much of that clause is worth showing is a judgement that belongs to
// whoever is clearing the queue. Sharing the key would mean widening one column
// silently moved the other, which is the kind of coupling nobody goes looking
// for when a width is wrong.
//
// Everything else — why a blocking script rather than an effect, why the default
// lives in the stylesheet and only the bounds live here — is in lib/pane-width.js
// and applies here unchanged.
export const REVIEW_WIDTH = paneWidth({
  key: 'dear-review-width',
  var: '--review-index-w',
  min: 240,
  max: 420,
});

export const REVIEW_WIDTH_INIT_SCRIPT = REVIEW_WIDTH.initScript;
