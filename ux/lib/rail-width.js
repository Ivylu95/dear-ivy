import { paneWidth } from '@/lib/pane-width';

// How wide the contents rail is. See lib/pane-width.js for the mechanism; what
// is decided here is the range.
//
// The floor is where a section heading still mostly fits on one line: these are
// titles written for a document, not labels written for a rail.
//
// The ceiling is tight, because this column earns its width faster than the
// others: it holds one column of short text and nothing else, so past roughly
// this point it is empty margin with a few words in it — and every pixel of it
// comes off the document it indexes.
export const RAIL_WIDTH = paneWidth({
  key: 'dear-rail-width',
  var: '--rail-w',
  min: 200,
  max: 300,
});

export const RAIL_WIDTH_INIT_SCRIPT = RAIL_WIDTH.initScript;
