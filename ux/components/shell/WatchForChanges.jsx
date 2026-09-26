'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Re-reads the page when a file under the record or the harness changes.
//
// The server half is app/api/watch/route.js, which explains why any of this is
// needed. This is the small end of it: hold the connection open, and on each
// tick ask the router to re-run the server components for whatever route is on
// screen.
//
// router.refresh() rather than location.reload(), and the difference is the
// whole reason this is pleasant to use: a refresh re-runs the server tree and
// reconciles the result into the page already there, so client state survives
// it. The dragged widths of the sidebar, rail and review panes, an open fold, a
// scroll position, half-typed text in a review note — all of it is still there
// afterwards. A reload would throw every one of them away, and watching the
// agent write would mean losing your place every few seconds.
//
// ── Why a refresh is rationed rather than just fired ────────────────────────
//
// Because it is not cheap, and the cost was measured rather than assumed. A warm
// render of most routes is 120–250ms, which would not be worth a guard. But
// /changes is 1.4–1.8s and half a megabyte, because it shells out to git for
// every row it draws, and /timeline reaches 1.8s on a bad one. Against work that
// size, two things that look like details decide whether this helps or hurts:
//
//   HIDDEN    A tab nobody is looking at costs exactly as much to refresh as the
//             one in front of you. Three left open on /changes while the agent
//             writes is 4.5s of git per burst, for pixels nobody sees. Hidden
//             tabs record that they are behind and catch up when looked at,
//             which is the same result for a fraction of the work.
//
//   IN FLIGHT The debounce in the route is 250ms, and it is deliberately far
//             shorter than a slow render — a longer one would make every refresh
//             feel late. That gap is real though: writes arriving steadily, more
//             than 250ms apart, would start a refresh on top of one still
//             running. So a tick during a refresh sets a flag instead, and one
//             more refresh runs when the current one lands. Ticks are a signal
//             that something changed, not a queue to be worked through — however
//             many arrive while a render is in flight, one catch-up covers them.
//
// Rendered only outside production, by app/(dashboard)/layout.jsx.
export default function WatchForChanges() {
  const router = useRouter();

  // isPending stays true for as long as the refresh this started is still
  // running, which is the only honest signal available for "a render is in
  // flight" — router.refresh() itself returns nothing to wait on.
  const [isPending, startTransition] = useTransition();

  // Refs rather than state for both: they are read inside a handler that is
  // installed once, and neither changing should itself cause a render. isPending
  // is mirrored into one because the handler outlives the render that made it.
  const behind = useRef(false);
  const pending = useRef(false);

  const refresh = useCallback(() => {
    // Behind, and staying behind until the reason clears.
    if (document.hidden || pending.current) {
      behind.current = true;
      return;
    }
    behind.current = false;
    startTransition(() => router.refresh());
  }, [router]);

  // Catch up the moment the reason for holding back goes away — here, the render
  // that was in flight landing. The other reason, the tab being hidden, is
  // handled by listening for visibilitychange below.
  useEffect(() => {
    pending.current = isPending;
    if (!isPending && behind.current) refresh();
  }, [isPending, refresh]);

  useEffect(() => {
    // Same origin, so the session cookie rides along and the gate in
    // ux/proxy.js lets it through like any other request.
    const source = new EventSource('/api/watch');

    source.onmessage = refresh;

    // Only a tab coming back while behind catches up. Wired straight to refresh,
    // hiding the tab marked it behind and showing it refreshed regardless, so
    // every tab switch re-ran the whole server tree with nothing changed.
    const onVisible = () => {
      if (!document.hidden && behind.current) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    // EventSource reconnects on its own after an error, which is the behaviour
    // wanted here — restarting the dev server drops every connection, and each
    // tab should come back by itself rather than needing the reload this exists
    // to avoid.

    return () => {
      source.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return null;
}
