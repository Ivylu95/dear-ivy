'use client';

import { useCallback, useEffect, useRef } from 'react';


// A draggable seam between two panes.
//
// One component, two users: the seam between the tree and the document, and the
// one between the navigation and everything else. They differ in where they are
// drawn, what they remember and what they are called, all of which arrive as
// props — the behaviour, the accessibility contract and the drag mechanics are
// the same control in both places and are written once.
//
// ── Nothing here is React state ─────────────────────────────────────────────
//
// The width is one custom property on <html>, which the grid reads, and the
// position this separator reports is one attribute on this node. Both are set
// imperatively. The layout holding the grid is a server component, and threading
// a pixel value through it per drag frame would re-render the whole tree sixty
// times a second to move one column; putting aria-valuenow in state would do the
// same thing for the same frame. Setting a property and an attribute touches two
// strings and lets the compositor do the rest.
//
// Where the width lives, what bounds it, and why it is restored by a blocking
// script rather than an effect: lib/harness-width.js.
export function PaneSeam({ pane, className, label, origin = 'start' }) {
  const { KEY, VAR, MIN_W, MAX_W, STEP, currentWidth, clampWidth } = pane;
  const ref = useRef(null);

  const setWidth = useCallback(
    (px) => {
      const w = clampWidth(px);
      document.documentElement.style.setProperty(VAR, `${w}px`);
      ref.current?.setAttribute('aria-valuenow', String(w));
      try {
        localStorage.setItem(KEY, String(w));
    } catch {
      // A private window, or storage the browser refuses. The drag still works
      // for this session; only the remembering is lost, and that is not worth an
      // error anybody has to see.
      }
    },
    [KEY, VAR, clampWidth],
  );

  // The width is already correct by the time this runs — the blocking script set
  // it before paint. What is not yet correct is what this separator SAYS it is,
  // because the server rendered the attribute without knowing what was stored.
  useEffect(() => {
    ref.current?.setAttribute('aria-valuenow', String(currentWidth()));
  }, [currentWidth]);

  // A drag interrupted by an unmount would otherwise leave the whole page with a
  // resize cursor and no selectable text, with nothing left to clear it.
  useEffect(
    () => () => {
      delete document.body.dataset.resizing;
      delete ref.current?.dataset.dragging;
    },
    [],
  );

  // Pointer events rather than mouse: one path covers mouse, pen and trackpad,
  // and capture means the drag survives the cursor leaving the 6px handle, which
  // it will on the first fast movement.
  const onPointerDown = (event) => {
    const handle = ref.current;
    if (!handle) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    // Two flags, because they answer two questions. The one on <body> is about
    // the whole page — every element keeps the resize cursor and stops selecting
    // text while a drag is in flight, wherever the pointer wanders. The one on
    // this node is about THIS seam: without it, "held" is a global state and
    // every seam on the page lights up when any one of them is taken hold of.
    handle.dataset.dragging = 'true';
    document.body.dataset.resizing = 'true';

    // Measured once, on the way in. The grid's left edge cannot move while its
    // first column is being dragged, and reading it per frame would force a
    // synchronous reflow of the very grid the line above has just resized —
    // sixty forced layouts a second, to learn a number that never changes.
    // Where the column is measured FROM, which is the only thing that differs
    // between the three seams. A pane laid out in flow grows from its own
    // container's left edge; one fixed to the window grows from the window's;
    // and a pane on the RIGHT grows leftward, so its width is the distance from
    // the far edge. Read once on the way in: those edges cannot move while the
    // column beside them is being dragged, and reading them per frame would
    // force a synchronous reflow of the very layout the line above just resized.
    const left = origin === 'start' ? (handle.parentElement?.getBoundingClientRect().left ?? 0) : 0;
    const right = window.innerWidth;

    const move = (e) => setWidth(origin === 'end' ? right - e.clientX : e.clientX - left);
    const done = () => {
      // Capture can be gone already — pointercancel, or the node losing it — and
      // releasing one that is not held throws.
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      delete handle.dataset.dragging;
      delete document.body.dataset.resizing;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', done);
      handle.removeEventListener('pointercancel', done);
      handle.removeEventListener('lostpointercapture', done);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', done);
    handle.addEventListener('pointercancel', done);
    handle.addEventListener('lostpointercapture', done);
  };

  // A drag handle nobody can reach by keyboard is a control half the point of
  // which is missing. Arrow keys nudge, Home and End take it to either stop.
  const onKeyDown = (event) => {
    const from = currentWidth();
    // An arrow moves the SEAM, not the number. On a column anchored to the right
    // edge, dragging left makes it wider — so the key that widens is the key
    // that points at the column, and a reader pressing left watches the seam go
    // left in both places.
    const grow = origin === 'end' ? 'ArrowLeft' : 'ArrowRight';
    const shrink = origin === 'end' ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === shrink) setWidth(from - STEP);
    else if (event.key === grow) setWidth(from + STEP);
    else if (event.key === 'Home') setWidth(MIN_W);
    else if (event.key === 'End') setWidth(MAX_W);
    else return;

    event.preventDefault();
  };

  return (
    // role="separator" with a tab stop is the window-splitter pattern, and a
    // splitter that can be moved has to report where it is — without the three
    // value attributes a screen reader announces a separator and stops, and the
    // arrow keys above have nothing to say for themselves. valuenow is seeded at
    // the minimum and corrected on mount, since the server cannot know it.
    <div
      ref={ref}
      className={className}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_W}
      aria-valuemax={MAX_W}
      aria-valuenow={MIN_W}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="pane-seam-line" aria-hidden="true" />
    </div>
  );
}
