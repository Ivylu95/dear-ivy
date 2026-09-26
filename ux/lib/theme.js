// Three independent preferences, stored per browser in localStorage.
//
//   MODE       'light' | 'dark' | 'system'  → the `dark` class on <html>
//   HUE        0-359                        → the `--hue` custom property
//   CHARACTER  an id from theme/palette.mjs → `data-character` on <html>
//
// They are deliberately three axes rather than one list of named themes. Colour
// is continuous and hers; character is the type, density and shape of the
// reading surface; mode is which face of the palette shows. Folding any two of
// them together means she can only have the combinations someone thought to
// name — which is what the four-named-themes version got wrong.
//
// The first paint of all three is handled by the inline script in
// app/layout.jsx, which runs before the body renders so there is no flash of the
// wrong surface. These helpers cover everything after that.

import { GROUND, hexOf, neutralScale } from '@/theme/palette.mjs';

const MODE_KEY = 'dear-theme';
const HUE_KEY = 'dear-hue';
const CHARACTER_KEY = 'dear-character';

// One channel for all three. Anything showing a current choice reads it as an
// external store (useSyncExternalStore) with its own snapshot getter, so a single
// event is cheaper than a context provider and cannot leave the three controls
// disagreeing about when a change happened.
const THEME_EVENT = 'dear-theme-change';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode, or storage blocked. "Nothing stored" is the right fallback.
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Non-persistent is still better than not switching at all.
  }
};

export function getThemeMode() {
  const stored = read(MODE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

// Returns a number, or null for "she has never chosen". Null rather than the
// default so the default can move later without stranding every browser on the
// old one — the same reason the character below stores nothing for its default.
//
// Anything unparseable reads as null, which lands on the default declared in
// theme.generated.css. A tampered or stale value degrades to the default rather
// than to an unstyled page.
export function getHue() {
  const raw = read(HUE_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : null;
}

// Unvalidated, like the hue. Nothing here knows the list of character ids on
// purpose: validating would mean importing the palette into the pre-paint path,
// and it is unnecessary — an id no character claims matches no
// `[data-character=...]` rule, so the unqualified default block renders instead.
export function getCharacter() {
  return read(CHARACTER_KEY);
}

export function subscribeTheme(onChange) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function resolveDark(mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// The browser paints its own chrome from <meta name="theme-color">, and on iOS
// that includes the rubber-band gutter opened by scrolling past either end of the
// page. app/layout.jsx emits two of those tags scoped to prefers-color-scheme,
// which is the OS setting rather than this app's: the moment the two disagree, a
// phone in dark mode reading this in light gets the dark ground painted above
// warm paper, which reads as a black band the page itself cannot explain.
//
// So the tag has to track the resolved surface — the `dark` class AND the chosen
// hue — not the media query. Both tags are updated rather than replaced:
// whichever query matches then carries the right colour, and nothing is removed
// from a head that Next also manages.
//
// The tag gets a HEX, not the oklch() the stylesheet carries. The page is
// painted by a browser new enough to resolve oklch; this tag is read by browser
// chrome that may not be, and a value it cannot parse leaves the old colour
// painted in the gutter — the exact seam this function exists to close.
//
// So it is resolved rather than copied: the live --hue and the resolved mode go
// through the same scale and the same conversion the stylesheet and the contrast
// gate use, which keeps the tag correct as the palette moves without this file
// holding a colour of its own.
//
// (Canvas will not do this job. Its fillStyle serialises a modern colour
// function straight back to oklch(), so it round-trips rather than converting.)
export function syncThemeColor() {
  const root = document.documentElement;
  const hue = Number(getComputedStyle(root).getPropertyValue('--hue').trim());
  if (!Number.isFinite(hue)) return;

  const step = neutralScale[root.classList.contains('dark') ? GROUND.dark : GROUND.light];
  const value = hexOf(step, hue);

  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((tag) => tag.setAttribute('content', value));
}

// Two classes, not one.
//
// `dark` was enough while the dark palette was reachable only through it. The
// stylesheet now falls to dark on its own under a dark OS — see the note in
// scripts/generate-theme.mjs — so choosing LIGHT on a machine set to dark needs
// something to say so, or the media query simply undoes it. That is `light`,
// and it is set only for an explicit choice: on `system` neither class is
// forced, and the media query and the script agree by construction.
export function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolveDark(mode));
  root.classList.toggle('light', mode === 'light');
  syncThemeColor();
}

// Run a change as one animation of the whole page.
//
// Any of these three moves a great deal at once: a hue moves background, text,
// three levels of dim text, every rule and every role colour; a character moves
// every type size, every padding and every radius. Transitioning those
// individually means either declaring the transition on a handful of elements
// (so the rest snap while the background fades) or declaring it on `*`, which
// taxes every element's style resolution and, on a page with several hundred
// rows, turns one switch into a large paint.
//
// The View Transitions API sidesteps both. The browser snapshots the old and new
// renders and animates them on the compositor, so the cost is one pair of
// viewport-sized textures no matter how much changed — a 680-row timeline costs
// the same as an empty page, because a snapshot of the root is the size of the
// window and not of the document.
//
// ── Why it needs a name, and why the name is temporary ──────────────────────
//
// The root's `root` name is taken away in globals.css so that a transition
// inside the harness panel animates the panel and not the window. A document
// with no named element in it has nothing to snapshot, so the name is put back
// for the length of the swap and taken off again after. `[data-theme-swap]` on
// <html> is both that switch and what the stylesheet keys the animation off.
//
// ── Two changes, two animations ─────────────────────────────────────────────
//
// A HUE or a READING STYLE is the same surface in different paint. Nothing moved
// and nothing was replaced, so there is nowhere for it to come from and it
// cross-fades in place.
//
// LIGHT AND DARK has somewhere it came from: the press. It gets a circle of the
// new surface opening from that point, which keeps both grounds fully painted
// the whole way rather than passing through a washed middle.
//
// ── The cost, and why it is accepted ────────────────────────────────────────
//
// A document view transition owns the pointer for as long as it runs. The
// snapshot sits above the page, so the hit target is <html> rather than the
// control under the cursor, the hand cursor drops to an arrow and the press is
// discarded. Nothing releases it — `pointer-events` on the pseudo-elements does
// not.
//
// That is the whole reason the durations here are short. At --dur-swap the dead
// window is about as long as a button's own press feedback, which is the figure
// Nielsen Norman give for a movement across a large screen and the figure
// Material give for a large element. It was tried at twice that and the second
// press of a light/dark comparison was visibly lost.
//
// Falls through to an instant switch when the API is absent or the user asked for
// reduced motion. Instant is a correct outcome, not a degraded one.

// The swap in flight, so a second one starting before the first has finished
// cleans up once, at the end, rather than the older one tearing the name off
// mid-animation. startViewTransition already skips the transition it interrupts;
// this only keeps the bookkeeping from doing the same to the live one.
let swapping = null;

// Pressing through the animation.
//
// The cost named above is that the page cannot be pressed while the transition
// runs. It cannot be turned off — but it CAN be cut short, and a press is the
// clearest possible statement that the person is done watching.
//
// Two things have to happen, because skipping alone is not enough. The press
// that does the skipping is itself lost: it was reported against <html>, so the
// `click` that follows is dispatched on <html> too (a click goes to the nearest
// common ancestor of the down and up targets) and never reaches React's root.
// Without forwarding it, interrupting would cost the very press that interrupted
// — one to stop the animation, another to do the thing.
//
// So the point is read BEFORE skipping. elementFromPoint answers with real
// elements and never with a pseudo-element, so the snapshot covering the screen
// is invisible to it: it gives what the press would have hit had the overlay not
// been there. That element is then sent a click carrying the original
// coordinates, which matters because the reveal grows from them — a plain
// .click() has detail 0 and a point of 0,0, which this file reads as a keyboard
// press and answers with a cross-fade.
//
// Guarded on the press having actually been swallowed. Where a browser does not
// put the snapshot in front of the hit test, the press lands on the control
// itself, `e.target` is not the root, and none of this runs.
const pressThrough = (root, transition) => (e) => {
  if (e.target !== root) return;
  const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('button, a');
  transition.skipTransition();
  hit?.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      clientX: e.clientX,
      clientY: e.clientY,
    }),
  );
};

// Read from the stylesheet rather than repeated here, so the tokens stay the one
// place the length and the curve are decided. An unparseable duration means the
// stylesheet has not loaded; the fallback is the token's own value.
const swapTiming = (root) => {
  const style = getComputedStyle(root);
  const raw = style.getPropertyValue('--dur-swap').trim();
  const n = Number.parseFloat(raw);
  return {
    duration: Number.isFinite(n) ? (raw.endsWith('ms') ? n : n * 1000) : 400,
    easing: style.getPropertyValue('--ease-swap').trim() || 'ease',
  };
};

// The circle, animated here rather than declared in the stylesheet.
//
// Its radius is the distance from the press to the furthest corner of the
// window, so it finishes by covering the viewport exactly once: anything smaller
// leaves a corner of the old surface standing, and a blanket 200vmax covers it
// by overshooting and spends most of the animation off-screen where the ease
// cannot be seen. A hypotenuse from an arbitrary point is not something CSS can
// work out, which is what puts this in JavaScript.
//
// On `ready`, which is the promise that resolves once the pseudo-element tree
// exists — there is nothing to animate before it. A rejection there means the
// transition was skipped, which is not an error and needs no handling beyond not
// throwing.
function revealFrom(root, { x, y }, transition) {
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  transition.ready.then(() => {
    root.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
      },
      { ...swapTiming(root), pseudoElement: '::view-transition-new(root)' },
    );
  }, () => {});
}

export function withThemeTransition(apply, { kind = 'surface', origin } = {}) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof document === 'undefined' || !document.startViewTransition) {
    apply();
    return;
  }

  const root = document.documentElement;
  root.dataset.themeSwap = kind;

  const token = {};
  swapping = token;

  let onPress;
  const done = () => {
    document.removeEventListener('pointerdown', onPress, { capture: true });
    if (swapping !== token) return;
    swapping = null;
    delete root.dataset.themeSwap;
  };

  const transition = document.startViewTransition(apply);

  // Capture, so it is heard before anything else can act on a press whose target
  // is wrong anyway. `once` because a skipped transition has nothing left to
  // skip; the listener is also removed on cleanup for the case where it never
  // fires.
  onPress = pressThrough(root, transition);
  document.addEventListener('pointerdown', onPress, { capture: true, once: true });

  // `finished` resolves even when the transition is skipped — a second press
  // mid-animation, a tab hidden before the first frame — so the name always comes
  // back off. It rejects for nothing this can cause, and a rejection left
  // unhandled would still be a console error, so it is caught to the same
  // cleanup.
  transition.finished.then(done, done);

  // No origin means the press came from the keyboard, where there is no point on
  // screen it came from. The cross-fade is the honest answer to that.
  if (kind === 'mode' && origin) revealFrom(root, origin, transition);
}

export function setThemeMode(mode) {
  write(MODE_KEY, mode === 'system' ? null : mode);
  applyTheme(mode);
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Deliberately NOT wrapped in a view transition by its caller while dragging.
// The hue slider fires continuously, and a crossfade per frame would be both
// wrong to look at and expensive; the live drag writes the property directly and
// the transition is for discrete changes. See HueSlider in components/shell/Theme.jsx.
export function setHue(hue) {
  if (hue == null) {
    write(HUE_KEY, null);
    document.documentElement.style.removeProperty('--hue');
  } else {
    write(HUE_KEY, String(hue));
    document.documentElement.style.setProperty('--hue', String(hue));
  }
  syncThemeColor();
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function setCharacter(id) {
  write(CHARACTER_KEY, id);
  if (id) document.documentElement.dataset.character = id;
  else delete document.documentElement.dataset.character;
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Inlined into the document head. Kept as one expression so it stays small and
// runs before first paint. Any throw here would block rendering, so the whole
// body is wrapped — and all three preferences are set in the one script, because
// two scripts would mean a frame where the mode is right and the surface is not.
//
// The catch is now a genuine fallback rather than a silent failure. `localStorage`
// itself throws when site data is blocked, which took the mode check down with
// it and left a dark-mode reader on a white page; the stylesheet answers that
// case on its own now, and this script exists to override it, not to produce it.
export const THEME_INIT_SCRIPT =
  `try{var e=document.documentElement,g=localStorage,` +
  `m=g.getItem('${MODE_KEY}'),h=g.getItem('${HUE_KEY}'),c=g.getItem('${CHARACTER_KEY}');` +
  `if(m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))` +
  `e.classList.add('dark');` +
  `else if(m==='light')e.classList.add('light');` +
  `if(h!==null&&h!==''&&!isNaN(h))e.style.setProperty('--hue',h);` +
  `if(c)e.setAttribute('data-character',c)}catch(e){}`;
