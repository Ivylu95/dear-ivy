'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getDrawerOpen, setDrawerOpen, subscribeDrawer } from '@/lib/sidebar';
import { VIEW_ICON, VIEW_LABEL, viewForPath } from '@/lib/views';
import { Icon } from '@/components/ui/icons';

// The mobile half of the rail. Below the breakpoint a 64px hover-peeking column
// is useless — there is no hover, and width is the scarce thing — so the rail
// becomes an off-canvas drawer and this bar carries the control that opens it.
// Both elements are display:none above the breakpoint; the desktop layout has no
// header by design and does not grow one.
export function MobileNav() {
  // The drawer's state is a class on <html> that lib/sidebar.js owns, so it is
  // read as an external store rather than copied into state after mount. Shut on
  // the server, which cannot see the class.
  const open = useSyncExternalStore(subscribeDrawer, getDrawerOpen, () => false);
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const burgerRef = useRef(null);
  const wasOpen = useRef(false);

  // Open, the drawer is the only thing a keyboard should reach: focus moves
  // into it, and the page and rail behind the scrim go inert, so Tab cannot
  // wander off into content the scrim is covering. Shut, they come back, and
  // focus returns to the button if it was inside the drawer (Escape, or a link
  // that closed it), rather than being stranded on a hidden element.
  useEffect(() => {
    // The page, the rail, and the two resize seams between them: each seam is
    // a focusable separator, and left out it was where Tab escaped to.
    const behind = [
      document.getElementById('main'),
      ...document.querySelectorAll('.rail, .nav-seam, .rail-seam'),
    ].filter(Boolean);
    const drawer = document.getElementById('sidebar');
    if (open) {
      behind.forEach((el) => (el.inert = true));
      drawer?.querySelector('a[href], button:not([disabled])')?.focus();
    } else {
      behind.forEach((el) => (el.inert = false));
      if (wasOpen.current && drawer?.contains(document.activeElement)) burgerRef.current?.focus();
    }
    wasOpen.current = open;
    // Never leave the page inert behind an unmounted drawer.
    return () => behind.forEach((el) => (el.inert = false));
  }, [open]);

  // Shut the drawer on Escape, and again whenever the viewport grows past the
  // breakpoint: the class would otherwise sit on <html> unnoticed and re-open the
  // drawer the next time the window narrowed.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && getDrawerOpen()) setDrawerOpen(false);
    };
    const wide = window.matchMedia('(min-width: 901px)');
    const onWiden = () => {
      if (wide.matches && getDrawerOpen()) setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    wide.addEventListener('change', onWiden);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener('change', onWiden);
    };
  }, []);

  return (
    <>
      <header className="mobile-header">
        <button
          ref={burgerRef}
          type="button"
          className="nav-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-controls="sidebar"
          aria-expanded={open}
          onClick={() => setDrawerOpen(!getDrawerOpen())}
        >
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
        {/* Where you are, not what the app is called. The name is the one fact she
            already has; the tab she is in is the one the drawer hides the moment
            it shuts. aria-hidden because it is a label, not a control, and the h1
            on the page below already names the view to a screen reader. */}
        {view && (
          <div className="mobile-header-view" aria-hidden="true">
            <Icon name={VIEW_ICON[view]} size={17} className="mobile-header-view-icon" />
            <span className="mobile-header-view-name">{VIEW_LABEL[view]}</span>
          </div>
        )}
      </header>
      {/* Tap anywhere off the drawer to dismiss it. aria-hidden because the button
          above already exposes the same action to assistive tech. */}
      <div className="nav-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
    </>
  );
}
