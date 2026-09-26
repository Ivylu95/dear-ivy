// Sidebar rail: pinned open, or collapsed to an icon column that peeks on hover.
//
// Collapsed is the default: the rail
// earns its width by being asked for, and the peek means you rarely have to ask.
// Only an explicit pin is stored, so a browser with no storage behaves like a
// first visit rather than like a lost preference.
//
// The state lives on <html> as a class, not in React, for the same reason the
// theme does: the inline script in app/layout.jsx sets it before first paint, so
// the rail never flashes at the wrong width. Components that need to render
// differently read the class on mount and subscribe to the event below; nothing
// renders it on the server.

const SIDEBAR_KEY = 'dear-sidebar';
const SIDEBAR_CLASS = 'nav-collapsed';
const SIDEBAR_EVENT = 'dear-sidebar-change';
const SIDEBAR_PINNED = 'pinned';

export function getCollapsed() {
  return document.documentElement.classList.contains(SIDEBAR_CLASS);
}

export function setCollapsed(collapsed) {
  document.documentElement.classList.toggle(SIDEBAR_CLASS, collapsed);
  try {
    if (collapsed) localStorage.removeItem(SIDEBAR_KEY);
    else localStorage.setItem(SIDEBAR_KEY, SIDEBAR_PINNED);
  } catch {
    // Private mode, or storage blocked. Not persisting is still better than not
    // collapsing at all.
  }
  window.dispatchEvent(new CustomEvent(SIDEBAR_EVENT, { detail: collapsed }));
}

// One channel for the whole app: the toggle owns the state, everything else
// listens. Cheaper than a context provider, which would need a client wrapper
// around a server layout to hold it.
export function subscribeCollapsed(handler) {
  const onChange = (event) => handler(event.detail);
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

// How long the labels take to fade, read from the one token that defines it so
// the JS that has to wait for the fade cannot drift from the CSS that runs it.
export function fadeMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-fast');
  return parseFloat(raw) || 120;
}

// Inlined into the document head, before first paint. Wrapped whole, because a
// throw here would block rendering.
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_KEY}')!=='${SIDEBAR_PINNED}')document.documentElement.classList.add('${SIDEBAR_CLASS}')}catch(e){document.documentElement.classList.add('${SIDEBAR_CLASS}')}`;

// ── Mobile drawer ────────────────────────────────────────────────────────────
// A second, separate state. Below the responsive breakpoint the rail stops being
// a rail and becomes an off-canvas drawer, where "collapsed" is meaningless and
// the only question is open or shut. Deliberately not persisted: a drawer you
// left open yesterday should not be covering the page today.

const DRAWER_CLASS = 'nav-open';
const DRAWER_EVENT = 'dear-drawer-change';

export function getDrawerOpen() {
  return document.documentElement.classList.contains(DRAWER_CLASS);
}

export function setDrawerOpen(open) {
  document.documentElement.classList.toggle(DRAWER_CLASS, open);
  window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: open }));
}

export function subscribeDrawer(handler) {
  const onChange = (event) => handler(event.detail);
  window.addEventListener(DRAWER_EVENT, onChange);
  return () => window.removeEventListener(DRAWER_EVENT, onChange);
}
