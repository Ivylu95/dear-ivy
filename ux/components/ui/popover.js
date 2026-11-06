'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

// A floating panel's placement and focus, written once (DES-001 design 3). The
// look is the shared .popover class (globals.css); these are what a panel does.
// The settings menu (shell/Theme.jsx) wears all three; the spec map's detail
// panel (dev/ui SpecGraph.jsx) takes its height from usePlaced, and is laid out
// by its stylesheet beside the map or as a sheet on a phone.

/** What a keyboard can land on inside a panel, in document order. */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/**
 * Run `place` before paint, and again on every resize of the window. Measured,
 * not guessed: what a panel is placed against changes width on hover, on pin and
 * at the breakpoint. `place` is read fresh at each call, so it may close over
 * this render's state; the listener is added once.
 */
export function usePlaced(place) {
  const latest = useRef(place);
  useLayoutEffect(() => {
    latest.current = place;
  });
  useLayoutEffect(() => {
    const run = () => latest.current();
    run();
    window.addEventListener('resize', run);
    return () => window.removeEventListener('resize', run);
  }, []);
}

/**
 * Into the panel once it has a place on screen (`ready`). Portalled to the end
 * of <body>, it was otherwise a whole page of Tab presses away from the button
 * that opened it. Once only: re-placing it on resize must not pull focus back
 * from a control further down.
 */
export function useFocusFirst(panelRef, ready) {
  const focused = useRef(false);
  useEffect(() => {
    if (!ready || focused.current) return;
    focused.current = true;
    panelRef.current?.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
  }, [panelRef, ready]);
}

/**
 * How a panel opened from a button closes: Escape, Tab off either end, a press
 * outside both boxes, or focus moving somewhere else. `onClose({ restoreFocus })`
 * says whether focus goes back to the button.
 */
export function useDismiss(panelRef, anchorRef, onClose) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose({ restoreFocus: true });
      // Tab off either end of the panel goes back to the button that opened
      // it. The panel is last in <body>, so the next stop either way was the
      // far end of the page, or the browser's own chrome.
      if (e.key === 'Tab' && panelRef.current?.contains(document.activeElement)) {
        const stops = [...panelRef.current.querySelectorAll(FOCUSABLE)];
        const edge = e.shiftKey ? stops[0] : stops.at(-1);
        if (document.activeElement === edge) {
          e.preventDefault();
          onClose({ restoreFocus: true });
        }
      }
    };
    // pointerdown rather than click: a click listener fires after the trigger's
    // own handler has already re-opened the panel, which reads as a dead toggle.
    //
    // Measured against the two boxes, NOT against the event's target.
    //
    // A target is a claim about which node was under the pointer, and it is only
    // as good as what else is on the page at the time. A view transition puts a
    // picture of the old surface in the top layer over everything, and a press
    // on a pseudo-element is reported against the element it belongs to — the
    // document root. So pressing Light, then Dark, inside the length of one
    // sweep sent a pointerdown whose target was <html>: not in the panel, not in
    // the trigger, so the panel closed itself while the pointer was sitting
    // squarely on one of its own buttons.
    //
    // Coordinates cannot be retargeted. Whatever is drawn over the panel, the
    // question "was this press inside that rectangle" has the same answer, so
    // this is not a patch for one overlay — it is the check the panel wanted in
    // the first place. Both boxes are read fresh on each press because the rail
    // changes width and the panel is placed from it.
    const within = (el, e) => {
      const r = el?.getBoundingClientRect();
      if (!r) return false;
      return (
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      );
    };

    const onDown = (e) => {
      if (within(panelRef.current, e) || within(anchorRef.current, e)) return;
      onClose({ restoreFocus: false });
    };
    // Focus leaving for somewhere else closes it, as a press outside does. The
    // panel is portalled to the end of <body>, so a keyboard that tabbed on from
    // it would otherwise leave it open over a page it had moved past. A move to
    // the document itself (a view transition, a click on nothing) is not a
    // destination, and is left to the pointer check above.
    const onFocus = (e) => {
      const to = e.target;
      if (!(to instanceof Element) || to === document.body || to === document.documentElement) return;
      if (panelRef.current?.contains(to) || anchorRef.current?.contains(to)) return;
      onClose({ restoreFocus: false });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [panelRef, anchorRef, onClose]);
}
