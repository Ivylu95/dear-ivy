// Where the app is going, before it has got there.
//
// Every navigation here lands on a server component that reads her record at
// request time, so there is a real gap between the click and the new page — and
// in that gap `usePathname()` still answers with the page you are leaving. Any
// marker drawn from the pathname alone therefore keeps pointing at the old view
// while you wait, which reads as the click not having registered.
//
// Nav solved that for itself with a piece of local state. That worked only while
// every destination was one of its own rows: the profile chip at the foot of the
// rail is a link to About me, and clicking it left Nav with no idea that the old
// row was about to stop being current — so Timeline stayed lit the whole way to
// About me, and two places were marked at once.
//
// So the intent lives here instead of inside one component, and anything that
// navigates says where it is going. The same channel-and-event shape as
// lib/sidebar.js, for the same reason: it costs one module rather than a client
// wrapper around a server layout.
//
// The record is { href, from } — where we are going, and the path we were on
// when the click happened. `from` is what makes it self-expiring: the moment the
// pathname actually changes, the record no longer matches the page and every
// reader falls back to the real pathname with nothing to clean up. A navigation
// that is cancelled or fails therefore corrects itself on the next render rather
// than leaving the rail permanently lying.

const EVENT = 'dear-route-pending';

let pending = null;

export function getPendingRoute() {
  return pending;
}

// A stable identity between calls, which useSyncExternalStore requires: a fresh
// object per read would re-render every subscriber on every render.
export function setPendingRoute(href, from) {
  pending = href ? { href, from } : null;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribePendingRoute(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// Nothing is in flight on the server, and the first client render must agree
// with the HTML it is hydrating.
export function serverPendingRoute() {
  return null;
}

// The route to draw the rail from: the one being navigated to if that click is
// still the current one, otherwise the page actually open.
export function routeFor(pathname) {
  return pending?.from === pathname ? pending.href : pathname;
}
