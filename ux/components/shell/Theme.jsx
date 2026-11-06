'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  applyTheme,
  getCharacter,
  getHue,
  getThemeMode,
  previewHue,
  setCharacter,
  setHue,
  setThemeMode,
  subscribeTheme,
  syncThemeColor,
  withThemeTransition,
} from '@/lib/theme';
import { DEFAULT_CHARACTER, DEFAULT_HUE, characters, huePresets } from '@/theme/palette.mjs';
import { Icon } from '@/components/ui/icons';
import { Count } from '@/components/ui';
import { Segmented } from '@/components/ui/Segmented';
import { useDismiss, useFocusFirst, usePlaced } from '@/components/ui/popover';

const MODES = [
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
  { key: 'system', label: 'System', icon: 'monitor' },
];

// A discrete change swaps a lot at once, so it goes through one composited
// animation. The class, attribute or property change and the pressed state
// change together inside the callback, and the store update is flushed
// synchronously: the browser snapshots the DOM the moment the callback returns,
// so an update left to React's normal batching would land after the snapshot and
// the pressed control would jump a frame late, outside the animation.
//
// `kind` and `origin` pick which of the two animations carries it — see
// withThemeTransition in lib/theme.js. Everything here cross-fades by default;
// only light/dark opens from a point, because it is the only one of the three
// that has a point to open from.
function change(apply, opts) {
  withThemeTransition(() => {
    flushSync(apply);
  }, opts);
}

// ── The panel shell ─────────────────────────────────────────────────────────

// Portalled into <body> rather than rendered in place. The rail clips its
// overflow, and below the responsive breakpoint it also carries a transform —
// which makes it the containing block for a fixed descendant, so even
// `position: fixed` would be trapped inside a 272px drawer. A portal is the only
// placement that is correct at both widths.
// Placement, focus and closing are the shared popover hooks (ui/popover.js).
function Panel({ anchorRef, label, onClose, children }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Measured, not guessed. The rail changes width on hover, on pin, and at the
  // breakpoint, so any hard-coded offset here would be wrong in two of those
  // three states.
  usePlaced(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = panel;
    // Above the trigger, since the trigger sits at the bottom of the rail.
    // Clamped into the viewport so a short window cannot push it off-screen.
    setPos({
      left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)),
      top: Math.max(8, a.top - h - 8),
    });
  });
  useDismiss(panelRef, anchorRef, onClose);
  useFocusFirst(panelRef, pos != null);

  return createPortal(
    <div
      ref={panelRef}
      className="menu popover"
      role="dialog"
      aria-label={label}
      // Hidden until measured. One frame at the wrong coordinates is a visible
      // jump, and there is no position to render at before the panel has a size.
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

// Hers, and the invented one. The labels say whose it is rather than what it is
// called on disk: "Sample" next to "Yours" is the only pair where nobody has to
// work out which is which.
const RECORDS = [
  { key: 'real', label: 'Yours', note: 'Your own record, in data/' },
  { key: 'sample', label: 'Sample', note: 'An invented record. Nobody’s.' },
];

const Section = ({ title, aside, children }) => (
  <section className="menu-section">
    <p className="menu-head">
      <span>{title}</span>
      {aside && <span className="menu-aside">{aside}</span>}
    </p>
    {children}
  </section>
);

// ── The three controls ──────────────────────────────────────────────────────

// Colour: twelve named hues, with the continuous slider underneath.
//
// A bare slider was the wrong control on its own. Almost nobody wants to SPECIFY
// a colour — they want to RECOGNISE one they like, which is why a paint chart is
// a grid of named chips and not a spectrum. The swatches are the control; the
// slider is there for the case where none of them is the one she meant.
function Colour({ hue }) {
  return (
    <div className="colours-grid">
      {huePresets.map((p) => (
        <button
          key={p.hue}
          type="button"
          className="chip"
          // Through the same scale as the accent, so a recommended colour cannot
          // be a nicer colour than the slider can reach. A shortcut, never a
          // separate quality of paint.
          style={{ '--chip': `oklch(var(--swatch-lc) ${p.hue})` }}
          // A preset is a discrete choice, so it gets the crossfade. The slider
          // deliberately does not — see its own note below.
          onClick={() => change(() => setHue(p.hue === DEFAULT_HUE ? null : p.hue))}
          aria-pressed={hue === p.hue}
          title={p.name}
        >
          <span className="sr-only">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

// No view transition. The input fires on every step of a drag, and a composited
// crossfade per step would both look wrong and cost more than the repaint it
// replaces. Writing one custom property is the cheapest possible repaint — the
// whole point of holding the palette in oklch(L C var(--hue)) — but it is still
// a restyle of the page, so a drag shows the latest hue at most once a frame
// (previewHue), and stores and announces it only on release: the native
// `change` event, which a range input fires when the pointer lets go or a key
// moves it. Until then the slider holds its own value, so it follows the hand
// without the theme controls re-rendering behind it.
//
// `change` does not fire when a drag ends on the value it started from, so
// pointerup and blur release too; otherwise the held value would outlive the
// drag and hide a preset pressed later. Whichever comes first releases, the
// rest find nothing held. A value back where it started is not stored (a
// default hue stays unstored), only shown again. A held value also belongs to
// the hue it was taken from: once a preset or another tab changes the hue, it
// is the new hue that shows (derived in render; an effect clearing it would
// cost a second render each change).
function HueSlider({ hue }) {
  const [held, setHeld] = useState(null);
  const input = useRef(null);
  const frame = useRef(0);
  const wanted = useRef(hue);
  const holding = useRef(false);

  useEffect(() => {
    const el = input.current;
    if (!el) return undefined;
    const release = () => {
      if (!holding.current) return;
      holding.current = false;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      const next = Number(el.value);
      if (next === (getHue() ?? DEFAULT_HUE)) previewHue(next);
      else setHue(next);
      setHeld(null);
    };
    for (const type of ['change', 'pointerup', 'blur']) el.addEventListener(type, release);
    return () => {
      for (const type of ['change', 'pointerup', 'blur']) el.removeEventListener(type, release);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const value = held?.from === hue ? held.value : hue;
  return (
    <input
      ref={input}
      className="hue-slider"
      type="range"
      min="0"
      max="359"
      step="1"
      value={value}
      onChange={(e) => {
        const next = Number(e.target.value);
        setHeld({ value: next, from: hue });
        holding.current = true;
        wanted.current = next;
        if (!frame.current)
          frame.current = requestAnimationFrame(() => {
            frame.current = 0;
            previewHue(wanted.current);
          });
      }}
      aria-label="Any colour"
      aria-valuetext={`Hue ${value} degrees`}
    />
  );
}

function Reading({ stored }) {
  // An unrecognised stored id resolves to the default here, which is exactly what
  // theme.generated.css does with it — the control and the stylesheet agree
  // rather than one of them inventing a selection.
  const active = characters.find((c) => c.id === stored)?.id ?? DEFAULT_CHARACTER;

  return (
    <Segmented
      block
      label="Reading style"
      options={characters.map((c) => ({ key: c.id, label: c.label, title: c.note }))}
      current={active}
      // The default stores nothing rather than storing its own id, so "she
      // never chose" stays one state and the default can move later without
      // stranding every browser on the old one.
      onSelect={(id) => change(() => setCharacter(id === DEFAULT_CHARACTER ? null : id))}
    />
  );
}

function Appearance({ mode }) {
  return (
    <Segmented
      block
      label="Light or dark"
      // Glyphs alone, at the developer's ask (2026-10-11); each keeps its name as
      // the tooltip and for a screen reader (Segmented's icon-only option).
      options={MODES.map((m) => ({ key: m.key, icon: m.icon, title: m.label }))}
      current={mode}
      // The pointer, not the button's centre. The circle should open from
      // where she actually pressed — the corner of the control she hit, if
      // that is where she hit it — because a reveal that starts a few pixels
      // from the finger is a reveal that started somewhere else.
      //
      // `detail` is 0 for a press that came from the keyboard, where
      // clientX/clientY are both 0: not a point on screen, the top-left
      // corner. Passing no origin at all is the honest answer, and
      // withThemeTransition cross-fades instead.
      onSelect={(key, e) =>
        change(() => setThemeMode(key), {
          kind: 'mode',
          origin: e.detail ? { x: e.clientX, y: e.clientY } : undefined,
        })
      }
    />
  );
}

// Which record is on screen.
//
// A plain form posting to /api/record, not a click handler: the answer lives in
// an httpOnly cookie that the server reads before it renders anything, so the
// page has to come back from the server either way. A fetch and a refresh would
// be the same round trip with more code and a worse failure mode.
//
// Two submit buttons sharing one name rather than a radio and a Save. There is
// nothing to save — the choice IS the click — and a switch that needs
// confirming is a switch nobody flips.
function Record({ active }) {
  return (
    <Segmented
      block
      label="Which record"
      form={{ action: '/api/record', name: 'record' }}
      options={RECORDS.map((r) => ({ key: r.key, label: r.label, title: r.note }))}
      current={active}
    />
  );
}

// ── The menu ────────────────────────────────────────────────────────────────

// One trigger instead of three rows.
//
// The rail's foot had grown to a colour control, a reading-style control, a
// light/dark control and a sign-out button — four rows of chrome under a
// navigation list, on a surface whose entire job is to be quiet enough to read.
// None of them is touched in a normal session. So they live behind one button,
// and the rail gets its bottom back.
//
// What is NOT behind the button: anything that changes the record. The switch at
// the top of it chooses which record is READ — hers or the invented one — and
// nothing in this menu writes a word to either.
export function SettingsMenu({ record = 'real', sampleAvailable = false }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  // Nothing selected on the server. It cannot know any stored value, so
  // committing to one there would guarantee a hydration mismatch on every load
  // where the two disagree. Read as external stores, the server snapshot renders
  // while hydrating and the stored values follow straight after.
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode, () => null);
  const storedHue = useSyncExternalStore(subscribeTheme, getHue, () => null);
  const character = useSyncExternalStore(subscribeTheme, getCharacter, () => undefined);
  const hue = storedHue ?? DEFAULT_HUE;

  // The name if she is on a recommended hue, "Custom" if she dragged off one.
  const preset = huePresets.find((p) => p.hue === hue);

  // These two effects belong to the trigger, which is always mounted, and not to
  // the controls inside the panel, which are not. Put them in the panel and the
  // theme-colour tag would only ever be corrected on a load where she happened
  // to open the menu, and a system-mode flip would be ignored unless it was open
  // at the time.
  useEffect(() => {
    // The class, the hue and the character are already right by now: the inline
    // script in app/layout.jsx set all three before first paint. What is not
    // right is the theme-colour tag, which the server rendered against the OS
    // preference and the default hue, and could not have known any stored
    // choice. Sync it once on mount so a phone whose OS disagrees with the
    // stored surface is not left with the other ground painted in its scroll
    // gutter.
    syncThemeColor();
  }, []);

  // Keep "System" live: if the OS flips while the app is open, re-resolve.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemeMode() === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Whether what is on screen is the invented record. Read from the same prop
  // the switch is positioned from, so the marker on the row and the selection
  // inside the panel can never disagree.
  const onSample = record === 'sample';

  const close = useCallback(({ restoreFocus }) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  return (
    <div className="settings">
      <button
        ref={buttonRef}
        type="button"
        className="settings-trigger"
        data-record={record}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={onSample ? 'Settings — you are reading the sample record' : 'Settings'}
      >
        <Icon name="sliders" size={16} className="settings-icon" />
        {/* Fades out with every other open-rail-only element. Collapsed, the
            trigger keeps its icon and loses only the word, so the row does not
            reflow during the width animation. */}
        <span className="settings-label">Settings</span>

        {/* The one thing on this screen that is not hers, said on the screen
            rather than behind the button that changes it. Mistaking the invented
            record for her own is the single worst misreading this dashboard can
            invite — an invented event read as something that happened to her —
            so the switch cannot be the only place its position is visible.

            It rides the settings row because that is where the switch lives: the
            label says what is on screen, and the row under it is how to change
            it. Two states, one marker — the word when the rail is open, and the
            accent on the glyph, which is all a 64px column has room for. */}
        {onSample && (
          <Count tone="accent" className="settings-flag">
            Sample
          </Count>
        )}
      </button>

      {open && (
        <Panel anchorRef={buttonRef} label="Settings" onClose={close}>
          {/* First, and only when there IS a sample to switch to. It is the one
              control here that changes WHAT is on the page rather than how it
              looks, so it goes above the three that are only appearance. */}
          {sampleAvailable && (
            <Section title="Record" aside={record === 'sample' ? 'Sample' : undefined}>
              <Record active={record} />
            </Section>
          )}

          <Section title="Colour" aside={preset?.name ?? 'Custom'}>
            <Colour hue={hue} />
            <HueSlider hue={hue} />
          </Section>

          <Section title="Reading">
            <Reading stored={character} />
          </Section>

          <Section title="Appearance">
            <Appearance mode={mode} />
          </Section>

          {/* Last, and the only thing here that is not a preference. Separated by
              a rule rather than sitting as a fourth section, so it never reads as
              one more setting to adjust. */}
          <form action="/api/logout" method="post" className="menu-out">
            <button type="submit">
              <Icon name="logout" size={13} />
              <span>Sign out</span>
            </button>
          </form>
        </Panel>
      )}
    </div>
  );
}
