'use client';

import { usePathname } from 'next/navigation';

// Remounts its children whenever the route changes.
//
// The router replaces the content of a slot on navigation but reuses the DOM around
// it, so a CSS animation declared there fires once on first load and never again.
// Keying on the pathname forces a fresh node per route, which is what restarts it.
//
// Only the @rail slot needs this. A view's own content already animates through
// <Enter>, which sits on the content itself and therefore runs when the data
// arrives; wrapping the main panel in this as well animated the loading skeleton
// on the way in and then the content again on top of it, which is two entrances
// for one navigation.
export default function RemountOnRoute({ className, children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={className}>
      {children}
    </div>
  );
}
