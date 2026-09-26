// Which blocks of the right rail are folded away, remembered across navigations.
//
// ── Why this is stored at all ───────────────────────────────────────────────
//
// The rail is rebuilt on every route: the harness is read as a series of files,
// and each click remounts the column. A fold held in component state would come
// back open on the next file, so the control would read as not having worked —
// you would be closing the same block over and over.
//
// It is also the right thing to remember. Someone who does not want a line count
// in their margin does not want it on this file; they do not want it at all.
//
// Modelled on lib/sidebar.js, which solves the same problem for the left rail,
// and deliberately not a context: the rail is a parallel route slot, so a
// provider would have to wrap the whole layout to reach it.
//
// ── Keyed, because the blocks are not one thing ─────────────────────────────
//
// Two cards can share a column and mean different things: what is true ABOUT
// this file, and where to go INSIDE it. Someone who folds the facts away has
// said nothing about the contents list, so each key is remembered on its own.
const KEY = (name) => `dear-rail-fold-${name}`;
const EVENT = 'dear-rail-fold-change';
const FOLDED = 'folded';

// Which blocks arrive folded, before anyone has touched them.
//
// The column is a stack now rather than a set of cards with air between them,
// and a stack of four open blocks is a column you scroll to read a margin. So
// one is open and the rest are a row each: the contents list, because it is the
// only one of the four that is a tool rather than a fact — you open a spec to
// get to a rule in it, and the other three answer questions you have not asked
// yet.
//
// Folded is not hidden. Every head keeps its place in the column and its own
// line, and the stack pins them to the bottom edge as the open one fills the
// screen, so what is closed is always in sight. That is the whole argument for
// defaulting this way: nothing is being kept from anyone.
const SHUT = new Set(['facts', 'referenced-by', 'references']);

// Folded if it was left folded, or if it starts that way and has not been
// opened. Absence of a stored value is not "open" for every block any more, so
// the two states have to be told apart: the key is written on BOTH actions, and
// only a block nobody has touched falls through to the default.
export function getFolded(name) {
  try {
    const stored = localStorage.getItem(KEY(name));
    if (stored !== null) return stored === FOLDED;
    return SHUT.has(name);
  } catch {
    // Private mode, or storage blocked. Open is the safe answer: showing a block
    // to someone who folded it once is a smaller failure than hiding one from
    // someone who never did.
    return false;
  }
}

export function setFolded(name, folded) {
  try {
    // Both states are written, where this used to remove the key to mean open.
    // Removing it now means "never touched", which is the block's default — so
    // opening a block that starts shut would have lasted until the next render.
    localStorage.setItem(KEY(name), folded ? FOLDED : 'open');
  } catch {
    // Not persisting is still better than not folding at all.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

export function subscribeFolded(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// What the server renders with: the block's default, because that is what the
// overwhelming majority of loads resolve to once the client has looked.
//
// It was a flat `false` — open — on the argument that the markup should contain
// the thing. That held while every block was open by default and the fold was
// the exception. With three of the four now shut unless someone has said
// otherwise, it would mean every arrival painting a fully open rail and
// collapsing it a frame later, which is the one kind of movement a margin must
// not have.
//
// A reader who has opened a block still gets that single frame in the other
// direction, which is the right way round: it happens to the person who chose
// it, once, rather than to everyone.
export const serverFolded = (name) => SHUT.has(name);
