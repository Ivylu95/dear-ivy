// Whether the rail's facts block is folded away, remembered across navigations.
//
// ── Why this is stored at all ───────────────────────────────────────────────
//
// The rail is rebuilt on every route: the harness is read as a series of files,
// and each click remounts the column. A fold held in component state would
// therefore come back open on the next file, so the control would read as not
// having worked — you would be closing the same block over and over.
//
// It is also the right thing to remember. Someone who does not want a line count
// in their margin does not want it on this file; they do not want it at all.
//
// Modelled on lib/sidebar.js, which solves the same problem for the left rail,
// and deliberately not on a context: the rail slot is a parallel route, so a
// provider would have to wrap the whole layout to reach it.
const KEY = 'dear-rail-facts';
const EVENT = 'dear-rail-facts-change';
const FOLDED = 'folded';

// Open unless told otherwise. A block that hides itself before anyone has asked
// is a block whose absence has to be explained.
export function getFolded() {
  try {
    return localStorage.getItem(KEY) === FOLDED;
  } catch {
    // Private mode, or storage blocked. Open is the safe answer: the facts are
    // small, and showing them to someone who folded them once is a smaller
    // failure than hiding them from someone who never did.
    return false;
  }
}

export function setFolded(folded) {
  try {
    if (folded) localStorage.setItem(KEY, FOLDED);
    else localStorage.removeItem(KEY);
  } catch {
    // Not persisting is still better than not folding at all.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: folded }));
}

// One channel, so two facts blocks on one page — the code view renders one
// beside its contents list — fold and unfold together rather than disagreeing.
export function subscribeFolded(handler) {
  const onChange = (event) => handler(event.detail);
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// The value the server renders with. Always open: the markup a crawler or a
// no-JS reader gets should contain the facts, and the fold is applied on mount.
export const serverFolded = () => false;
