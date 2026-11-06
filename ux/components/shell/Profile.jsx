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
import { VIEW_LABEL } from '@/lib/views';
import { Avatar } from '@/components/me/Avatar';
import { Reading } from '@/components/ui/Reading';

// Who is signed in, and the way into her standing files.
//
// This row used to be an identity and nothing else, with "About me" sitting as a
// tenth row in the nav above. Two things said the same thing in two places: the
// name at the foot of the rail, and a link to the file ABOUT the person whose
// name that is. Folding them together costs nothing — the row was already her —
// and it takes a row out of a list that is read on bad nights.
//
// Her name is the whole of the label. It is the one word here she cannot
// misread, and the rail does not need to caption a row it has room for.
//
// So the chip is the entry point now, and it is the only one. Nothing else in the
// app links to /me, which is why the hover and the active state matter here more
// than they would on a duplicate shortcut: if this does not read as clickable,
// the view has no door.
//
// Signing out is still one row below, in the settings menu, where it cannot be
// hit by accident on the way to this.
export function Profile({ account, avatarStamp }) {
  const pathname = usePathname();
  // Lit the moment it is clicked, and the nav above goes dark in the same frame
  // — both read the one channel, so they cannot disagree about where the app is
  // going. See lib/route-pending.js.
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const active = routeFor(pathname)?.startsWith('/me');
  const name = account.slice(0, 1).toUpperCase() + account.slice(1);

  return (
    <Link
      href="/me"
      className="profile"
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        setPendingRoute('/me', pathname);
        // Picking it from the mobile drawer dismisses the drawer, the same as
        // any nav row; on desktop there is none open and this is a no-op.
        setDrawerOpen(false);
      }}
    >
      <Avatar name={name} stamp={avatarStamp} size={26} className="profile-mark" />
      {/* Her name, and nothing under it. Where the row goes is carried by the
          hover and the active wash, which is how every other row in this rail
          says the same thing; a caption under one of them reads as a second nav
          row rather than as a signpost.

          Sighted readers have that affordance. A screen reader does not, so the
          destination is still in the accessible name — announced as "<her name>, about
          me", which is what the row actually is. */}
      <span className="profile-name">
        {name}
        <span className="sr-only">, {VIEW_LABEL['/me'].toLowerCase()}</span>
      </span>
      <Reading />
    </Link>
  );
}
