'use client';

import { useSyncExternalStore } from 'react';

// The only button in the app that does something, and it is on the safety plan.
//
// The print stylesheet at the bottom of globals.css is useless if nobody knows
// it is there, and Ctrl+P is not a thing anyone thinks of on a bad night — which
// is the whole point of having a paper copy in the first place. The moment to
// print it is a calm afternoon, and that is when this has to be visible.
//
// Absent until mounted, because a button that does nothing without JavaScript is
// worse than no button: it looks broken rather than absent.
//
// Read as an external store rather than set in an effect. The store never
// changes — subscribe is a no-op — so this is only the server/client snapshot
// split, which is exactly the question being asked: false on the server, true in
// the browser, and no state written during render.
const noop = () => () => {};

export default function PrintButton() {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return (
    <button type="button" className="btn print-btn" onClick={() => window.print()}>
      Print a copy
    </button>
  );
}
