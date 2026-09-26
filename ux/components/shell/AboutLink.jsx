'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import {
  getPendingRoute,
  routeFor,
  serverPendingRoute,
  setPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';
import { setDrawerOpen } from '@/lib/sidebar';
import { VIEW_ICON, VIEW_LABEL } from '@/lib/views';
import { Icon } from '@/components/ui/icons';
import { Reading } from '@/components/ui/Reading';

// What this app is and what it will not do, at the foot of the rail rather than
// in the list of views above.
//
// It was a tab, and being a tab made a claim about it that is not true: the rows
// above are her record — what happened, who with, what she is working on — and
// this is the app explaining itself. A page about the software sitting in the
// same list as a page about her life is the tenth row on a list read on bad
// nights, and it is the one row there that is never the reason she opened this.
//
// So it sits with Settings, which is the other thing here that is about the
// machine rather than about her. Last, quietest, and still one click from
// anywhere.
export function AboutLink() {
  const pathname = usePathname();
  // Lit the moment it is clicked, and the nav above goes dark in the same frame
  // — both read the one channel. See lib/route-pending.js.
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const active = routeFor(pathname)?.startsWith('/about');

  return (
    <Link
      href="/about"
      className="foot-link"
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        setPendingRoute('/about', pathname);
        // Picking it from the mobile drawer dismisses the drawer, the same as
        // any nav row; on desktop there is none open and this is a no-op.
        setDrawerOpen(false);
      }}
    >
      <Icon name={VIEW_ICON['/about']} size={16} className="settings-icon" />
      {/* Fades out with every other open-rail-only element, so the collapsed
          rail keeps the glyph and loses only the word. */}
      <span className="foot-link-label">{VIEW_LABEL['/about']}</span>
      <Reading />
    </Link>
  );
}
