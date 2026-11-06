'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  setCharacter,
  setHue,
  setThemeMode,
  subscribeTheme,
  syncThemeColor,
  withThemeTransition,
} from '@/lib/theme';
import { DEFAULT_CHARACTER, DEFAULT_HUE, characters, huePresets } from '@/theme/palette.mjs';
import { Icon } from '@/components/ui/icons';

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
function Panel({ anchorRef, label, onClose, children }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Measured, not guessed. The rail changes width on hover, on pin, and at the
  // breakpoint, so any hard-coded offset here would be wrong in two of those
  // three states.
  useLayoutEffect(() => {
    const place = () => {
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
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose({ restoreFocus: true });
    };
    // pointerdown rather than click: a click listener fires after the trigger's
    // own handler has already re-opened the panel, which reads as a dead toggle.
    //
    // Measured against the two boxes, NOT against the event's target.
    //
    // A target is a claim about which node was under the pointer, and it is only
    // as good as what else is on the page at the time. A view transition puts a
    // picture of the old surface in the top layer over everything, and a press
    // on a pseudo-element is reported against the element it belongs to — the
    // document root. So pressing Light, then Dark, inside the length of one
    // sweep sent a pointerdown whose target was <html>: not in the panel, not in
    // the trigger, so the panel closed itself while the pointer was sitting
    // squarely on one of its own buttons.
    //
    // Coordinates cannot be retargeted. Whatever is drawn over the panel, the
    // question "was this press inside that rectangle" has the same answer, so
    // this is not a patch for one overlay — it is the check the panel wanted in
    // the first place. Both boxes are read fresh on each press because the rail
    // changes width and the panel is placed from it.
    const within = (el, e) => {
      const r = el?.getBoundingClientRect();
      if (!r) return false;
      return (
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      );
    };

    const onDown = (e) => {
      if (within(panelRef.current, e) || within(anchorRef.current, e)) return;
      onClose({ restoreFocus: false });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className="menu"
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
          style={{ '--chip': `oklch(0.48 0.105 ${p.hue})` }}
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

function HueSlider({ hue }) {
  return (
    <input
      className="hue-slider"
      type="range"
      min="0"
      max="359"
      step="1"
      value={hue}
      // No view transition. This fires on every frame of a drag, and a composited
      // crossfade per frame would both look wrong and cost more than the repaint
      // it replaces. Writing one custom property is already the cheapest possible
      // repaint — the whole point of holding the palette in
      // oklch(L C var(--hue)) — so the live drag just writes it.
      onChange={(e) => setHue(Number(e.target.value))}
      aria-label="Any colour"
      aria-valuetext={`Hue ${hue} degrees`}
    />
  );
}

function Reading({ stored }) {
  // An unrecognised stored id resolves to the default here, which is exactly what
  // theme.generated.css does with it — the control and the stylesheet agree
  // rather than one of them inventing a selection.
  const active = characters.find((c) => c.id === stored)?.id ?? DEFAULT_CHARACTER;

  return (
    <div className="segmented" role="group" aria-label="Reading style">
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          // The default stores nothing rather than storing its own id, so "she
          // never chose" stays one state and the default can move later without
          // stranding every browser on the old one.
          onClick={() => change(() => setCharacter(c.id === DEFAULT_CHARACTER ? null : c.id))}
          aria-pressed={active === c.id}
          title={c.note}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Appearance({ mode }) {
  return (
    <div className="segmented" role="group" aria-label="Light or dark">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          // The pointer, not the button's centre. The circle should open from
          // where she actually pressed — the corner of the control she hit, if
          // that is where she hit it — because a reveal that starts a few pixels
          // from the finger is a reveal that started somewhere else.
          //
          // `detail` is 0 for a press that came from the keyboard, where
          // clientX/clientY are both 0: not a point on screen, the top-left
          // corner. Passing no origin at all is the honest answer, and
          // withThemeTransition cross-fades instead.
          onClick={(e) =>
            change(() => setThemeMode(m.key), {
              kind: 'mode',
              origin: e.detail ? { x: e.clientX, y: e.clientY } : undefined,
            })
          }
          aria-pressed={mode === m.key}
          title={m.label}
        >
          <Icon name={m.icon} size={13} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
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
    <form action="/api/record" method="post" className="segmented" aria-label="Which record">
      {RECORDS.map((r) => (
        <button
          key={r.key}
          type="submit"
          name="record"
          value={r.key}
          aria-pressed={active === r.key}
          title={r.note}
        >
          {r.label}
        </button>
      ))}
    </form>
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
        {onSample && <span className="settings-flag">Sample</span>}
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
