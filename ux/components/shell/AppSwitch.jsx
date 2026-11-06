'use client';

import { useEffect, useRef, useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { DASHBOARDS } from '@/lib/sections';

// Long enough for the pill to be seen leaving, short enough not to read as a
// wait: about half its slide (the spring in components.css).
const SLIDE_HEAD_START_MS = 140;
// Once per tab: the other dashboard's server work is kept by its server, so
// asking again on every load of this one would only add work.
const WARMED_KEY = 'dear-dashboard-warmed';

// The switch beside her name between her dashboard and the admin app (WKB-002
// design 1): the shared Segmented (DES-001 design 3), a glyph per side, the lit
// side saying which dashboard this is.
//
// Crossing is a full page load, since it leaves the app it is in, so it is made
// to feel like one motion rather than a wait (DES-008):
//   - the pill slides the moment it is pressed, before the page goes;
//   - the other dashboard's landing page is asked for once the browser is idle
//     after this one loads (once per tab), and again when a pointer, focus or
//     touch reaches the switch, so its server work (a first compile, under
//     `next dev`) is done before the press;
//   - the page change itself is a view transition (styles/layout.css).
// Shown only where there is another dashboard to cross to.
export function AppSwitch({ current }) {
  const [shown, setShown] = useState(current);
  const warmed = useRef(false);
  const other = DASHBOARDS.find((d) => d.key !== current);

  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    fetch(other.href, { credentials: 'same-origin', priority: 'low' }).catch(() => {
      warmed.current = false; // try again on the next approach
    });
  };

  useEffect(() => {
    let done = false;
    try {
      done = sessionStorage.getItem(WARMED_KEY) === other.key;
    } catch {
      /* storage refused: warm anyway */
    }
    if (done) return undefined;
    const idle = window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      warm();
      try {
        sessionStorage.setItem(WARMED_KEY, other.key);
      } catch {
        /* nothing to keep it in */
      }
    });
    return () => cancel(handle);
    // Once, on load: `warm` and `other` are fixed for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (key) => {
    if (key === current) return;
    setShown(key);
    const href = DASHBOARDS.find((d) => d.key === key).href;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => window.location.assign(href), still ? 0 : SLIDE_HEAD_START_MS);
  };

  return (
    <span className="profile-switch" onPointerEnter={warm} onFocus={warm} onTouchStart={warm}>
      <Segmented
        options={DASHBOARDS.map(({ key, icon, title }) => ({ key, icon, title }))}
        current={shown}
        label="Dashboard"
        onSelect={go}
      />
    </span>
  );
}
