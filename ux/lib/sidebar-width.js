import { paneWidth } from '@/lib/pane-width';

// How wide the navigation column is. See lib/pane-width.js for the mechanism;
// what is decided here is the range.
//
// The floor is set by the longest thing the column must hold whole, which is not
// a nav label — those are short — but the group headings above them and the
// account line at the foot, both of which are set in tracked capitals and run
// wider than they look. Below it the column does not become compact, it becomes
// a list of clipped words, and the collapsed rail is already the control for a
// reader who wants the space back.
//
// The ceiling is where the column stops paying for itself: the labels are short
// and fixed, so past this the extra width is empty panel taken from the record
// beside it. Kept tight for the same reason the other two are — three columns
// that can each grow are three ways to squeeze the thing being read.
export const SIDEBAR_WIDTH = paneWidth({
  key: 'dear-sidebar-width',
  var: '--sidebar-w',
  min: 232,
  max: 296,
});

export const SIDEBAR_WIDTH_INIT_SCRIPT = SIDEBAR_WIDTH.initScript;
