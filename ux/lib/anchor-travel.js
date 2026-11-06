// One trip to an in-page anchor, smooth where the reader has not asked for less
// motion. Shared by the right rail's rows (RailNav.jsx) and the heading anchors
// in the reading column (AnchorLink.jsx), so the two travel the same way
// and there is one place that knows how.

// The nearest ancestor that scrolls, or the window if none does.
//
// `overflow: auto` alone is not enough to answer with: a column that can scroll
// but has nothing to scroll yet still reports auto, and picking it would mean
// listening to an element whose scrollTop never moves. So the box has to both
// allow scrolling and actually overflow.
export function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return window;
}

// Lets the reading column scroll smoothly for one trip to an in-page anchor.
//
// Called from the link's click, before the browser's own fragment navigation, so
// the default does everything it always did (the hash, the history entry, the
// focus move) and only the manner of the scroll changes. base.css makes
// `.main[data-anchor-travel]` smooth, under the reduced-motion guard, so a reader
// who asked for less motion still gets the jump. The attribute comes off when
// the scroll ends, or after a second if there was nowhere to go: a smooth rule
// left standing on the column is what animated Next's scroll-to-top on every tab
// change. The document scroller on a phone is <html>, smooth in CSS already.
const TRAVEL_MAX_MS = 1000;

export function travel(scroller) {
  if (!scroller || scroller === window) return;
  scroller.setAttribute('data-anchor-travel', '');
  // Chromium reads scroll-behavior from the last style pass, so the change has
  // to be flushed before the navigation asks for the scroll (the same flush
  // Next does for <html>).
  scroller.getClientRects();
  let timer = 0;
  const done = () => {
    clearTimeout(timer);
    scroller.removeEventListener('scrollend', done);
    scroller.removeAttribute('data-anchor-travel');
  };
  scroller.addEventListener('scrollend', done);
  timer = setTimeout(done, TRAVEL_MAX_MS);
}
