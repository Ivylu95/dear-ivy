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
import { Reading } from '@/components/ui/Reading';

// One row of the left rail that goes somewhere: a nav row, About, the profile
// chip. Written once because all three must agree on the same four things.
//
//   lit    while the app is at `href`, and the moment it is clicked — every row
//          reads the one channel in lib/route-pending.js, so two rows are never
//          lit at once. `active` overrides it where the caller decides (Nav
//          picks one row among many).
//   away   rendered in the admin app (WKB-002), where `href` is the dashboard's:
//          a plain link that leaves this app, never lit here, because a
//          client-side navigation cannot cross from one Next app into another.
//   drawer picking a row from the mobile drawer dismisses it; on desktop there
//          is none open and this is a no-op.
//   slow   <Reading /> inside it, only ever seen if the read is genuinely slow.
export function NavLink({ href, away = false, active, className, children }) {
  const pathname = usePathname();
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const lit = !away && (active ?? Boolean(routeFor(pathname)?.startsWith(href)));
  const To = away ? 'a' : Link;

  return (
    <To
      href={href}
      className={className}
      data-active={lit ? 'true' : undefined}
      aria-current={lit ? 'page' : undefined}
      onClick={() => {
        if (!away) setPendingRoute(href, pathname);
        setDrawerOpen(false);
      }}
    >
      {children}
      <Reading />
    </To>
  );
}
