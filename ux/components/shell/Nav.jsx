'use client';

import { usePathname } from 'next/navigation';
import { Fragment, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getPendingRoute,
  routeFor,
  serverPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';
import { VIEW_ICON, VIEW_LABEL } from '@/lib/views';
import { Icon } from '@/components/ui/icons';
import { Count } from '@/components/ui';
import { NavLink } from '@/components/shell/NavLink';

// Icons carry the nav once the rail collapses to a 64px column, where a label
// cannot fit. Expanded, they sit left of the label in a fixed gutter, which is
// also what keeps the collapsed and expanded rails optically aligned: the icon
// does not move when the rail opens, only what follows it appears.

// `also` lists the other views a row's tab holds (Calendar, under Timeline):
// the row stays lit on them, since the rail has no row of their own.
const matches = ({ href, also = [] }, pathname) =>
  href === '/' ? pathname === '/' : [href, ...also].some((h) => pathname.startsWith(h));

// `hidden` lists the views whose module is switched off (lib/modules.js); they
// are left out of the rail rather than shown as a tab with nothing behind it.
// `sections` comes from the app: the dashboard's in lib/sections.js, the admin
// app's in dev/ui/lib/sections.js. An item marked `away` lives in the other app
// (WKB-002), a plain link (see NavLink), and `view` names the view whose label
// and icon it carries when its href is not that view's own.
export default function Nav({ sections, counts = {}, hidden = [] }) {
  const ITEMS = sections.flatMap((s) => s.items).filter((i) => !i.away);
  const pathname = usePathname();

  // Optimistic highlight: the marker moves the moment a link is clicked rather
  // than waiting for the server component to stream in.
  //
  // The destination is read from lib/route-pending.js rather than held here,
  // because not every destination is one of these rows. The profile chip at the
  // foot of the rail goes to About me, and while that page was loading this nav
  // still saw the OLD pathname and kept the row you were leaving lit — two
  // places marked at once. Asking the shared channel means a click on anything
  // that announces itself unmarks this list, whether or not the target is here.
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const activeHref = ITEMS.find((i) => matches(i, routeFor(pathname)))?.href;

  // The marker is one element for the whole nav rather than one per item, and its
  // position is measured from the active link — the rows are not a fixed height
  // at every breakpoint, and hard-coding one would drift the moment the padding
  // changed.
  //
  // It does not animate between rows. It used to, and that travel was the one
  // moving thing on screen at the moment a new page was trying to be read: a
  // marker says where you are, and animating it turns that statement into an
  // event, pulling the eye back to the rail you have just finished with. The
  // measurement below still runs on every change, because WHERE it goes is not
  // knowable without it; only the journey is gone.
  //
  // Measuring means it cannot be server-rendered: it appears on hydration rather
  // than in the first paint. That is the trade for it travelling, and the active
  // row is not unmarked in the meantime — aria-current, the heavier weight and
  // the full-strength icon are all in the server HTML.
  const navRef = useRef(null);
  const [markerTop, setMarkerTop] = useState(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const measure = () => {
      const el = nav.querySelector('[data-active="true"]');
      // A number rather than an object, so React's own bailout does the work when
      // the observer fires without the active row having moved. The collapse no
      // longer animates the rail's width (it is a clip, see sidebar.css), so this
      // fires once when the width settles, not on every frame of the motion.
      setMarkerTop(el ? el.offsetTop + el.offsetHeight / 2 : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <nav className="nav" id="sidebar-nav" aria-label="Sections" ref={navRef}>
      {markerTop != null && (
        <span
          className="nav-marker"
          aria-hidden="true"
          style={{ transform: `translateY(${markerTop}px)` }}
        />
      )}
      {sections.map((section, i) => (
        <Fragment key={section.label ?? `top-${i}`}>
          {section.label && (
            <h2 className="nav-section">
              {/* Fades out with every other open-rail-only element. Collapsed, the
                  heading keeps its height and its rule and loses only the words,
                  so nothing reflows during the width animation and the groups stay
                  visibly separated in the 64px column. */}
              <span className="nav-section-label">{section.label}</span>
            </h2>
          )}
          {section.items.filter((item) => !hidden.includes(item.view ?? item.href)).map((item) => {
            const view = item.view ?? item.href;
            const count = counts[view];
            return (
              <NavLink
                key={item.href}
                href={item.href}
                away={item.away}
                active={item.href === activeHref}
                className="nav-item"
              >
                <Icon name={VIEW_ICON[view]} size={16} className="nav-icon" />
                {/* Labels stay laid out at full width and are clipped by the rail's
                    overflow when it is narrow, then faded in as it opens. Nothing
                    is removed from the DOM, so the links keep their accessible
                    names and no text reflows during the width animation. */}
                <span className="nav-label">{VIEW_LABEL[view]}</span>
                {/* A count only ever says how many things are ON FILE — people,
                    open threads. Never how often she wrote, never how long since.
                    getNavCounts() in lib/read/home.js is where that rule is enforced;
                    this just renders what it is given. */}
                {count != null && <Count className="nav-count">{count.value}</Count>}
              </NavLink>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
