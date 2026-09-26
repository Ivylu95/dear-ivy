'use client';

import { useLinkStatus } from 'next/link';

// The in-flight mark on a link that has been clicked and not yet arrived.
//
// This used to be app/(dashboard)/loading.jsx — a route-level boundary printing
// "Reading…". A boundary there meant every navigation replaced the whole main
// panel the instant it was clicked: the page you were reading collapsed to one
// line of grey text, and the new one then faded in from nothing. Two visual
// states and a blank frame between them, on reads that take about eighty
// milliseconds. The flash WAS the lag — the waiting was never the slow part.
//
// Without that boundary the router holds the page you are on until the next one
// is ready, so a tab change is one clean swap and nothing ever goes blank. What
// is then missing is the honest case the boundary existed for: a read that is
// genuinely slow — a cold start on the hosted deployment — where holding the old
// page with no feedback reads as a dead click.
//
// So the feedback moves onto the link itself, and it is deliberately late. The
// dot is invisible for the first 200ms (see .reading in globals.css), which is
// longer than a local read takes — so a normal tab change never shows it at all,
// and it appears only when there is genuinely something to wait for.
//
// useLinkStatus reads the pending state of the enclosing <Link>, so this has to
// be rendered INSIDE one. It is aria-hidden: the destination is already
// announced by the link, and a screen reader saying "busy" on every row press is
// noise, not information.
export function Reading() {
  const { pending } = useLinkStatus();
  return (
    <span className="reading" data-pending={pending ? 'true' : undefined} aria-hidden="true" />
  );
}
