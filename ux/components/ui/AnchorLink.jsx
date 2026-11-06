'use client';

import { scrollParent, travel } from '@/lib/anchor-travel';

// A link to somewhere further down the same page, that travels there rather
// than jumping. Above the breakpoint the reading column is the scroller, and
// it is smooth only for the length of a trip (base.css), so a plain fragment
// link jumped where the right rail's rows travel. The click starts the same
// trip the rows do and leaves the navigation itself to the browser: hash,
// history entry and focus as before. Under reduced motion the CSS guard keeps
// it a jump. The look is the caller's: SectionHead passes its own class.
export function AnchorLink(props) {
  return <a {...props} onClick={(e) => travel(scrollParent(e.currentTarget))} />;
}
