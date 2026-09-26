'use client';

import { usePathname } from 'next/navigation';
import { ViewTransition, useSyncExternalStore } from 'react';
import {
  getPendingRoute,
  serverPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';

// The reading column, and the half of a cross-fade that nothing else could do.
//
// ── What was wrong ──────────────────────────────────────────────────────────
//
// Moving between two files here was a hard cut into a fade. Every harness route
// reads the disk at request time, so the router holds the file you are on until
// the next one is ready and then swaps them in a single frame: the paragraph you
// were reading is simply gone, the panel is briefly empty, and the new file
// fades up from nothing over 120ms. Only one end of that swap was animated, and
// it was the wrong end — an arrival is easy to follow, a disappearance is not,
// and the eye reads the cut as the page having been yanked.
//
// It shows up here more than anywhere else in the app because this is the one
// view built for moving through a series of files in one sitting. A cut you
// notice once a session is a detail; the same cut six times in a minute, beside
// a column that never moves, is the whole texture of the view.
//
// ── Two animations, because a click here has two halves ─────────────────────
//
// THE WAIT, from the click until the payload lands, is covered by dimming the
// panel. Nothing else could do it: the disk read has not finished, so there is
// no new content to animate to, and the only thing the app knows at that moment
// is that a click happened. The signal is the same pending-route channel the
// tree and the left rail mark themselves from, so the file dims, the row lights
// up and the rail moves on one frame — one gesture with one response, rather
// than three components each noticing at their own pace.
//
// A click that never lands corrects itself: the record carries the path it was
// made on, so the moment the pathname changes — or a new click replaces it — the
// match fails and the panel is at full opacity again with nothing to clean up.
//
// THE SWAP is covered by <ViewTransition>, which is the browser doing the one
// thing no amount of CSS here could: holding a picture of the file being left
// while the file arriving is painted underneath it, so the two genuinely
// dissolve rather than one being cut and the other faded up. React snapshots the
// old subtree before it commits the new one, which is the frame that was
// previously unreachable — the outgoing content is unmounted by the router the
// instant the new payload lands, and a node that is gone cannot be animated.
//
// They are sequential, not two takes on the same moment: the dim plays while the
// read is in flight and the dissolve plays when it returns.
//
// ── On leaning on it ────────────────────────────────────────────────────────
//
// Nothing breaks without it. A browser with no view-transition support (or a
// reader who has asked for less motion) skips straight to the commit and gets
// exactly what this view did before — the dim, then <Enter>'s own fade — so the
// dissolve is an improvement layered on a view that already worked. globals.css
// keeps both paths honest with an @supports pair: where the transition runs it
// owns the entrance, and where it does not, <Enter> still does.
//
// The name is explicit rather than left to React, because the pseudo-elements it
// creates have to be addressable by name in the stylesheet to be given this
// app's easing instead of the browser's default fade. It also has to stay
// unique on the page: two elements sharing a view-transition-name in one frame
// is an error the browser resolves by skipping the transition entirely.
export function HarnessPanel({ children }) {
  const here = usePathname();
  const pending = useSyncExternalStore(
    subscribePendingRoute,
    getPendingRoute,
    serverPendingRoute,
  );

  // Going somewhere, and somewhere else: re-clicking the open file is not a
  // navigation and must not blink the thing it is already showing.
  const leaving = pending?.from === here && pending.href !== here;

  return (
    <div className="harness-panel" data-leaving={leaving ? 'true' : undefined}>
      <ViewTransition name="harness-file">{children}</ViewTransition>
    </div>
  );
}
