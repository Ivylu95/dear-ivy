'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fadeMs,
  getCollapsed,
  getDrawerOpen,
  setCollapsed,
  subscribeCollapsed,
} from '@/lib/sidebar';
import { Icon } from '@/components/ui/icons';

// The rail's only control, sitting under the nav. It owns the state; everything
// else in the sidebar is styled off the class it puts on <html>.
export function SidebarToggle() {
  // Null until mounted. The server cannot know the stored state, so committing to
  // one would guarantee a hydration mismatch on every load.
  const [collapsed, setLocal] = useState(null);
  // The displayed word, deliberately not derived from `collapsed`: on the way shut
  // it lags the state by one fade. See below.
  const [word, setWord] = useState('Collapse');
  const timer = useRef(null);

  useEffect(() => {
    const apply = (isCollapsed) => {
      setLocal(isCollapsed);
      clearTimeout(timer.current);
      if (isCollapsed) {
        // Shutting: the label is fading out. Swap the word only once it is
        // invisible, or you watch "Collapse" turn into "Expand" mid-fade, which
        // reads as a glitch rather than a transition.
        timer.current = setTimeout(() => setWord('Expand'), fadeMs() + 10);
      } else {
        // Opening: swap now, while it is still at zero opacity, so the label and
        // the rail arrive together already saying the right thing.
        setWord('Collapse');
      }
    };

    apply(getCollapsed());
    const unsubscribe = subscribeCollapsed(apply);
    return () => {
      clearTimeout(timer.current);
      unsubscribe();
    };
  }, []);

  // Escape dismisses a rail held open by keyboard focus, the same way it dismisses
  // the drawer. Without it, tabbing into the nav and changing your mind
  // leaves the rail open with no way to shut it but the mouse.
  useEffect(() => {
    const onKeyDown = (event) => {
      // The drawer owns Escape when it is open; blurring underneath it would
      // just steal the key from the thing the user is actually looking at.
      if (event.key !== 'Escape' || getDrawerOpen() || !getCollapsed()) return;
      const rail = document.querySelector('.sidebar');
      if (rail?.contains(document.activeElement)) document.activeElement.blur();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <button
      type="button"
      className="sidebar-toggle"
      onClick={() => setCollapsed(!getCollapsed())}
      aria-expanded={collapsed == null ? undefined : !collapsed}
      aria-controls="sidebar-nav"
      title={title}
    >
      {/* One chevron, rotated by CSS off the collapsed class, so the button cannot
          point in a direction that disagrees with the rail's actual state. */}
      <Icon name="chevron" size={16} className="sidebar-toggle-icon" />
      <span className="sidebar-toggle-label" aria-hidden="true">
        {word}
      </span>
      <span className="sr-only">{title}</span>
    </button>
  );
}
