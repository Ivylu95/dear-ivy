// The only place a colour literal or a type-and-density value exists in this app.
//
// scripts/generate-theme.mjs turns this file into app/theme.generated.css, and
// every component reads the custom properties that file defines.
//
// ── The brief this is written to ────────────────────────────────────────────
//
// This is not a console. It is a record of someone's life, read mostly by the
// person who lived it, sometimes on a bad evening. Three rules follow, and they
// are design constraints rather than taste:
//
// 1. WARM, NOT CLINICAL. Paper and ink, not slate and cyan. A therapy record
//    rendered in dashboard blue reads as a file held ON her rather than a record
//    kept FOR her.
// 2. RED IS NOT FOR HER. `alert` exists for exactly one thing: the crisis
//    numbers on the safety plan, which have to be findable in a state where
//    reading is hard. Nothing about how she is doing is ever painted in it. A
//    record that colours a bad week red is scoring her.
// 3. NOTHING BLINKS OR BADGES. There is no unread count, no streak, no "3 days
//    since". Those turn a record into an obligation, and an obligation is the
//    one thing this must never become.
//
// ── Three axes, and why they are three ──────────────────────────────────────
//
// There was briefly a list of four named "themes" here. They were four hues with
// four names on them — which is not four themes, it is one slider with four
// stops, and pretending otherwise meant she could not have the colour she
// actually wanted and got no real choice about anything else.
//
// So the two ideas are separated:
//
//   COLOUR     one hue, anywhere on the circle. See below — it is a continuous
//              control, not a menu.
//   CHARACTER  everything colour is not: the reading face, the type sizes, the
//              leading, the density, the corner shape, the paper texture. Two of
//              these: a default, and a relief valve.
//
//              There was a third, Notebook — sans, tighter, square, no texture,
//              a wider measure — justified as being for scanning rather than
//              reading. It was withdrawn because this is a reading surface and
//              the scanning is done by the two rails, not by the prose: it
//              solved a problem the app does not have, and every style offered
//              is one more thing she has to hold an opinion about.
//   MODE       light or dark, following the system by default.
//
// The test that keeps them honest: a character must still be recognisably itself
// with the hue moved to the far side of the circle, and a hue must still be
// recognisably itself in all three characters. Anything that fails that test is
// on the wrong axis.

// ── Colour: one hue, everything else fixed ──────────────────────────────────
//
// Every tinted value is emitted as `oklch(<fixed L> <fixed C> var(--hue))`, so
// the entire palette re-tints from one custom property — no regeneration, no
// JavaScript, no second stylesheet. OKLCH is what makes that safe: its L is
// perceptual lightness, so holding L and C fixed while the hue turns keeps every
// contrast relationship in the app roughly where it was tuned. Rotating a hex
// ramp would not: the same arithmetic applied to a blue and a yellow gives two
// different lightnesses, and one of them would be unreadable.
//
// "Roughly" is doing real work in that paragraph, which is why
// generate-theme.mjs sweeps the whole circle and measures every pair at every
// hue rather than trusting the model. See the gate there.
//
// CHROMA IS NOT A CONTROL, and that is a decision rather than an omission.
// Chroma is the difference between a record and a dashboard: the values below
// are low on purpose, and a saturation slider is a direct route to rule 1 and a
// surface that shouts at her. Hue is hers; intensity is the brief's.

// Lightness and chroma per step. Hue arrives at render time.
//
// The neutral is a TINTED grey, not a grey — chroma is tiny but non-zero, so the
// paper, the rules and the ink all carry a trace of her colour and read as one
// family. At C 0 the app would be four greys with a coloured link in it.
export const neutralScale = {
  25: [0.995, 0.004],
  50: [0.978, 0.006],
  100: [0.957, 0.008],
  150: [0.933, 0.01],
  200: [0.893, 0.012],
  300: [0.82, 0.014],
  400: [0.62, 0.016],
  500: [0.545, 0.016],
  600: [0.435, 0.014],
  700: [0.33, 0.012],
  800: [0.248, 0.01],
  850: [0.215, 0.01],
  900: [0.188, 0.01],
  950: [0.155, 0.01],
};

// One scale for every chromatic ramp. Accent, ok, warn and alert differ only in
// hue, so a role chip and the accent sit at the same weight whichever colour she
// picked — and adding a role later cannot accidentally introduce a louder one.
export const colourScale = {
  100: [0.935, 0.03],
  200: [0.865, 0.055],
  300: [0.76, 0.08],
  400: [0.63, 0.1],
  500: [0.48, 0.105],
  600: [0.42, 0.095],
  700: [0.33, 0.075],
};

// Where she starts. A muted plum — the record's original accent.
export const DEFAULT_HUE = 336;

// Semantic hues are FIXED and do not rotate with her choice.
//
// Green meaning "in hand" stops meaning it if green becomes whatever is 120
// degrees from the colour she liked, and red is the crisis colour: it must not
// move because she changed the ground. The cost is that picking a hue near one
// of these makes the accent and that role resemble each other, which is a
// cosmetic collision. Rotating them instead would cost the meaning, which is not
// cosmetic. See rule 2.
export const semanticHues = {
  // In hand. Not "good" — this record does not grade her days.
  ok: 150,
  // Coming up, or left open. Attention, not alarm.
  warn: 70,
  // Crisis numbers only.
  alert: 28,
};

// The recommended colours.
//
// A curated set rather than a bare slider, for the reason a paint chart exists:
// almost nobody wants to specify a colour, they want to recognise one they like.
// Twelve named swatches answer that in a glance; the slider is still there
// underneath for the case where none of them is the one she meant.
//
// These are HUES, not colours — each one renders through the same scale as
// everything else, so a preset cannot be a nicer colour than the slider can
// reach. It is a shortcut, never a separate quality of paint.
//
// Chosen to sit at least 15 degrees clear of every semantic hue, so a preset
// never lands the accent on top of `ok`, `warn` or `alert`. That separation is
// asserted in scripts/generate-theme.mjs rather than trusted here — it is the
// kind of thing that survives the first edit and not the fifth.
export const huePresets = [
  { hue: 336, name: 'Plum' },
  { hue: 352, name: 'Mulberry' },
  { hue: 4, name: 'Rose' },
  { hue: 46, name: 'Clay' },
  { hue: 88, name: 'Ochre' },
  { hue: 122, name: 'Moss' },
  { hue: 168, name: 'Fern' },
  { hue: 196, name: 'Teal' },
  { hue: 222, name: 'Sea' },
  { hue: 248, name: 'Slate' },
  { hue: 276, name: 'Indigo' },
  { hue: 306, name: 'Violet' },
];

// The minimum separation asserted by the gate. Below this the accent and a role
// chip stop being distinguishable at these chromas.
export const MIN_HUE_SEPARATION = 15;

// ── Character: everything colour is not ─────────────────────────────────────
//
// A character changes how the record READS, not what colour it is: which face
// carries the prose, how big it is, how far apart the lines sit, how much air is
// around a card, whether a card has an edge at all, and whether the ground has
// any tooth. Those are the choices that make a surface feel like a letter, a
// or a page held at arm's length — and neither of them is a hue.
//
// Every value here is a custom property consumed by globals.css. Nothing in this
// list is a colour, and nothing in the colour section above is a size.
export const characters = [
  {
    id: 'letter',
    label: 'Letter',
    note: 'Serif throughout, generous leading, soft edges. Reads like a letter.',
    tokens: {
      'f-display': 'var(--f-serif)',
      'f-prose': 'var(--f-serif)',
      'text-base': '16.5px',
      // Chrome — the rail's foot, the settings panel. Smaller than the body,
      // because navigation is the page's content and a settings row is not:
      // at body size the two compete, and the one that should win is the one
      // she is actually there to use. Scales with the character all the same,
      // so Open's larger type reaches the controls too.
      'text-ui': '13px',
      // Navigation. Between the body size and the chrome size, and closer to
      // the chrome: the rail is a list of ten short labels read at a glance,
      // not prose. At body size they had the weight of the page they point at,
      // which made the rail compete with the thing it is a way into.
      'text-nav': '14px',
      leading: '1.6',
      'prose-size': '17.5px',
      'prose-leading': '1.68',
      'title-size': '38px',
      'h2-size': '22px',
      'card-heading-size': '17px',
      'quote-size': '19px',
      // The three tiers of type that are not prose and not a heading: a
      // subtitle, a caption, a hallmark. They were hardcoded in globals.css at
      // nine slightly different pixel values, which meant a reading style could
      // grow the headline by a third and leave every date, tag and source line
      // exactly as small — in Open, the character that exists for a day when
      // reading is hard, that was the wrong half to scale.
      // The smallest tier: the uppercase tracked labels that rule off a
      // block — the rail's headings, the nav's groups, the settings panel's.
      // Tracked capitals read a size larger than they measure, which is why
      // this sits below `text-fine` rather than with it.
      // The crisis numbers, and nothing else. Their own tier because rule 2
      // at the top of this file makes them the one thing that must be findable
      // in a state where reading is hard — which means they grow with the
      // reading style like everything else, and further than everything else.
      'text-number': '21px',
      'text-label': '9.5px',
      'text-sub': '15px',
      'text-meta': '12.5px',
      'text-fine': '11.5px',
      measure: '68ch',
      // The column the measure sits in, card padding and a margin included.
      // Derived from `measure` rather than chosen: a 1000px column around 68ch
      // of serif left 300px of nothing down the right of every card, which is
      // how text ends up looking marooned in a box built for a dashboard.
      column: '740px',
      r1: '4px',
      r2: '8px',
      r3: '12px',
      r4: '18px',
      'pad-card': '20px 22px',
      'pad-row': '13px 16px',
      'pad-rail': '16px',
      'line-w': '1px',
      lift: 'none',
      flow: '14px',
      // Texture on. Points at the tile the palette emitted, so a character can
      // turn tooth off without ever naming the colour it is made of.
      grain: 'var(--grain-tile)',
    },
  },
  {
    id: 'open',
    label: 'Open',
    note: 'Large type, wide leading, narrow measure, no edges. For a hard day.',
    tokens: {
      'f-display': 'var(--f-serif)',
      'f-prose': 'var(--f-serif)',
      'text-base': '18px',
      'text-ui': '14.5px',
      'text-nav': '15.5px',
      leading: '1.75',
      'prose-size': '20px',
      'prose-leading': '1.9',
      'title-size': '42px',
      'h2-size': '25px',
      'card-heading-size': '19px',
      'quote-size': '22px',
      // The point of the whole exercise: everything grows here, captions and
      // dates and tags included, not just the parts that were already big.
      'text-number': '26px',
      'text-label': '11.5px',
      'text-sub': '17px',
      'text-meta': '14px',
      'text-fine': '12.5px',
      // Narrowest, following the narrowest measure.
      column: '700px',
      // Narrower than Letter, not wider. Fewer words per line is the single
      // cheapest thing that makes prose easier when concentration is short —
      // which is the whole reason this character exists.
      measure: '56ch',
      r1: '6px',
      r2: '12px',
      r3: '20px',
      r4: '28px',
      'pad-card': '28px 30px',
      'pad-row': '18px 22px',
      'pad-rail': '22px',
      // Borderless. A card is a tinted ground and a soft lift rather than a box
      // with a line around it, so a page of them reads as paper rather than as a
      // form to be filled in.
      'line-w': '0px',
      lift: '0 2px 10px -4px var(--shadow)',
      flow: '20px',
      grain: 'var(--grain-tile)',
    },
  },
];

export const DEFAULT_CHARACTER = characters[0].id;

export const characterById = (id) => characters.find((c) => c.id === id) ?? characters[0];

// ── Shared, and not a preference ────────────────────────────────────────────
//
// The family and the motion curve belong to the app rather than to a choice. A
// character picks the size, the leading and the density it is read at; it does
// not get to introduce a second face or a different easing.
export const tokens = {
  // One family, and this is it.
  //
  // There is no 'f-sans' and no 'f-mono'. The sans carried the chrome and the
  // mono carried anything quoted exactly; both were removed on the owner's
  // explicit instruction, and neither is downloaded in app/fonts/ any more.
  // Neither is defined here either, deliberately: a token pointing at a font
  // variable nothing declares is worse than an absent one, because a rule using
  // it is invalid at computed-value time and falls back silently to whatever it
  // inherited rather than failing where it can be seen.
  'f-serif': 'var(--f-serif-var), ui-serif, Georgia, "Times New Roman", serif',

  // ── Weight ────────────────────────────────────────────────────────────────
  //
  // Shared rather than per character, for the same reason the family is: a
  // character chooses the size and the leading it is read at, not how heavy the
  // page is.
  //
  // These are the third axis of type, and until they were written down they were
  // the only one with no home. Size flows from the character, family from the
  // token above; weight was fifty literals across two stylesheets in seven
  // values — 400, 450, 500, 520, 550, 600, 700 — where `550` alone was spelled
  // out seven times by rules that did not know the others existed. That is what
  // a variable font invites: with static weights you get two and no choice, and
  // with a 200–800 range nudging one label costs nothing at the moment you do
  // it. The bill arrives as a surface where no two emphasised things agree.
  //
  // Five steps, each named for the job rather than the number, because a scale
  // whose steps have no roles just relocates the same guess:
  //
  //   body    running prose at reading size, and large titles that want to stay
  //           light — a serif headline at 400 is a choice, not an omission
  //   ui      chrome set BELOW reading size. Heavier than body by the numbers
  //           and lighter to the eye: small text needs more weight to hold the
  //           same apparent ink, so this is an optical correction, not a step up
  //   medium  the name or label that is the subject of its row
  //   semi    emphasis inside running text, and the active state of a nav row
  //   strong  headings, table heads, `strong`
  //
  // The print block at the foot of globals.css keeps its own weights and is not
  // converted, the same way it keeps its own sizes in `pt`: paper is a different
  // medium read at a different physical size, and the safety plan is printed to
  // be legible on a bad day rather than to match the screen.
  'w-body': '400',
  'w-ui': '450',
  'w-medium': '500',
  'w-semi': '550',
  'w-strong': '600',

  'dur-fast': '120ms',
  dur: '220ms',
  'dur-slow': '380ms',

  // The whole-surface change: light to dark, and the cross-fade its two
  // neighbours get. Timed to the published guidance rather than to taste.
  //
  // Nielsen Norman put the usable band at 200-500ms and reserve the top of it
  // for "big movements across large screens", which is exactly what this is.
  // Material says 300-400ms for a large element against 150-200ms for a small
  // one. Both agree on the ceiling from the other end too: one second is the
  // limit of a person's flow of thought.
  //
  // It is also, and not coincidentally, how long the page is unpressable. A
  // document view transition owns the pointer while it runs (see the note in
  // lib/theme.js), so this number is the dead window as well as the animation.
  // It was tried at 800ms and the second press of a light/dark comparison was
  // visibly lost.
  //
  // 650 is PAST that band, deliberately and on instruction. The guidance tops
  // out at 500 for the largest movement on the largest screen; this is a third
  // longer, because the reveal is the one animation here anybody watches on
  // purpose and at 500 it was still reading as feedback rather than as
  // something to look at.
  //
  // What it costs is written above and is the reason the number is worth
  // arguing about at all: 650 is also 650ms of unpressable page. It is under the
  // 800 where the second press of a light/dark comparison was visibly lost, and
  // it is the ceiling — the next value up is the one that failed.
  'dur-swap': '650ms',

  // And its own curve, which for a CIRCLE is not a matter of taste.
  //
  // A reveal's radius ends at the distance from the press to the furthest
  // corner, so the last tenth of that radius is spent closing one corner — the
  // smallest, least interesting part of the screen. Any curve with a long
  // settle spends a third of the animation there, and that is the crawl: the
  // edge bolts across everything worth looking at and then creeps shut in a
  // corner. Measured at 650ms, on the last tenth of the radius:
  //
  //   this app's --ease   0.32,0.72,0,1    411ms   unusable here
  //   Material standard   0.4,0,0.2,1      238ms   the crawl, visible
  //   sine in-out         0.45,0,0.55,1    149ms   even
  //
  // --ease is tuned for a widget and is the worst of the three for this: almost
  // all the distance in the first third, then a long settle, which is right for
  // a 120ms hover. Material's is better and still tail-heavy, because it is
  // shaped for an element ENTERING and coming to rest, and an edge leaving the
  // screen never rests.
  //
  // Sinusoidal in-out is the even one: a soft start at the press, a steady pace
  // through the middle where the edge is crossing the part of the page anyone is
  // actually reading, and a finish that does not linger.
  //
  // The one thing NOT to reach for is the guess this usually starts from —
  // something logarithmic, fast then slowing. A circle's AREA grows as the
  // square of its radius, so an even area rate really does mean a decelerating
  // radius; it is just that the eye follows the EDGE and not the area, and a
  // decelerating radius is the crawl above, maximised.
  'ease-swap': 'cubic-bezier(0.45, 0, 0.55, 1)',

  ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

// ── Emitting colour ─────────────────────────────────────────────────────────

// `hue` is either a number (a fixed semantic hue) or the string that reads the
// live custom property. Everything the app paints goes through here, so there is
// exactly one place that decides what a colour value looks like.
export const oklch = ([l, c], hue, alpha) =>
  `oklch(${l} ${c} ${typeof hue === 'number' ? hue : hue}${alpha == null ? '' : ` / ${alpha}`})`;

const HUE = 'var(--hue)';

const n = (step, alpha) => oklch(neutralScale[step], HUE, alpha);
const a = (step, alpha) => oklch(colourScale[step], HUE, alpha);

// A step that sits BETWEEN the two scales: `t` of the chromatic ramp, the rest
// of the neutral. For the one surface that wants a neutral's lightness and some
// of the accent's colour, and can get neither from a single step — see
// literal-bg in surfacesFor.
//
// Resolved here rather than left to color-mix() in CSS so the emitted value is a
// plain oklch() like every other token: one quality of paint in the generated
// file, and a value that can be read off it without evaluating a function.
const between = (chromatic, neutral, t) =>
  oklch(
    [chromatic[0] * t + neutral[0] * (1 - t), chromatic[1] * t + neutral[1] * (1 - t)].map(
      (v) => +v.toFixed(4),
    ),
    HUE,
  );

// The tooth of the paper.
//
// A real noise field rather than two soft colour blooms. Blooms give a page a
// light source, which is a thing a screen does and paper does not; grain gives
// it a surface. On a full-bleed ground the difference is the whole of why one
// reads as a sheet and the other as a rectangle with a gradient in it.
//
// An inline SVG turbulence tile, baked to a data URI at build time: no request,
// no asset to lose, and the browser rasterises it once and repeats it.
//
// ── The two numbers that matter ─────────────────────────────────────────────
//
// ONE octave at a low base frequency, not four. Multi-octave noise puts energy
// in the same spatial band as the stems and counters of the type, which is how
// a texture stops being a surface and starts being something the eye tries to
// resolve while reading. One octave keeps the field coarse enough to sit behind
// prose.
//
// The floor is negative on purpose. It clips most of the field to zero alpha so
// only the peaks show, which buys visible tooth without lifting the whole ground
// — mean alpha is roughly `amplitude / 2 + floor`, and this stays near 2%.
//
// ── Why the ink is achromatic ──────────────────────────────────────────────
//
// Every other colour here follows `var(--hue)`, but this one cannot: the alpha
// is baked into the filter matrix, so the tile is fixed at build time while the
// hue is chosen at runtime. Baking one hue in would be right for that hue and
// subtly wrong for the other 359. At this alpha the tint is imperceptible
// anyway, so the tile carries only the palette's ink LIGHTNESS and no chroma.
// The tooth itself: turbulence, tinted to the ink and tiled.
//
// It was baked into a PNG at build time for a while, to keep the harness panel's
// pinned section heading off a filter it re-ran on every frame of every scroll.
// Reverted on the owner's explicit instruction, and the reason it had to be is
// worth keeping: a PNG is a fixed grid of pixels stretched across 140 CSS px, so
// on a 2x screen every speck is painted at twice its size and the paper's tooth
// becomes visible mottling. An SVG filter is rasterised at the device's own
// resolution, which is the whole reason the speckle disappears into the surface
// instead of sitting on top of it.
//
// If the sticky heading needs answering again, answer it there — promote that
// layer, or take the grain off that one element — not by changing what the paper
// is made of.
// Rasterised by the browser at the DEVICE's resolution, which is the whole
// reason it is a filter and not a picture.
//
// Baking this field into a PNG has been tried twice and reverted twice, on the
// owner's instruction both times. It is the obvious answer to a real scroll cost
// (see .claude/memory/grain-stays-svg-turbulence.md) and it is the wrong one: a
// bitmap is a fixed grid of pixels stretched over 140 CSS px, so on a 2x display
// every speck is painted at twice its intended size and the tooth stops being
// tooth and becomes mottling. The speckle disappearing into the surface instead
// of sitting on top of it is not an implementation detail of this texture — it
// IS the texture.
//
// The scroll cost belongs to the one element that has it, and is answered there:
// globals.css promotes the pinned section heading to its own layer so the filter
// is rasterised once and then composited, rather than re-painted per frame.
const grain = (ink, amplitude, floor) => {
  const [r, g, b] = ink;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>` +
    `<filter id='g' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.45' numOctaves='1' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${amplitude} ${floor}'/>` +
    `</filter>` +
    `<rect width='140' height='140' filter='url(#g)'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

// The ink, as gamma-encoded sRGB in 0-1, read off the neutral scale at zero
// chroma. Light speckles the ground with its own text colour; dark speckles it
// with its own paper colour.
const grainInk = (step) => srgb([neutralScale[step][0], 0], 0).map((c) => c.toFixed(3));

// Which neutral step is the page's ground, per mode.
//
// Named rather than inlined because two callers need it: surfacesFor below, and
// lib/theme.js, which resolves the same colour to a hex for the theme-colour
// meta tag. A tag painted from a different step than the page is exactly the
// seam above the page that the tag exists to prevent.
export const GROUND = { light: 50, dark: 950 };

// Ground, panel, rule and text. One formula, both modes.
//
// Dark is not the light map reversed. It reads from the deep end of the same
// scale and steps the accent up two stops, because the mid-tone that carries a
// quoted paragraph on paper is invisible on charcoal.
export function surfacesFor(mode) {
  if (mode === 'light') {
    return {
      bg: n(GROUND.light),
      panel: n(25),
      // The panel with the paper showing through it — for the harness list,
      // where a sheet that lets the grain in reads as lying ON the page rather
      // than pasted over it. Same step as the panel, so text contrast holds.
      'panel-glass': n(25, 0.72),
      'panel-2': n(100),
      line: n(200),
      'line-soft': n(150),
      fg: n(800),
      'fg-dim': n(600),
      'fg-dimmer': n(400),
      accent: a(500),
      'accent-soft': a(100),
      // The ground an inline literal sits on — a backticked path in a spec, a
      // filename in her record. See .prose code in app/prose.css.
      //
      // It is a surface rather than a role because no role triple fits: -bg is
      // too pale to close the chip's shape and -border carries more colour than
      // a box behind TEXT should. This is the rule's lightness with most of the
      // border's hue, which is the only combination that both reads as an object
      // and stays quiet under --fg.
      'literal-bg': between(colourScale[200], neutralScale[200], 0.7),
      shadow: n(800, 0.09),
      'shadow-lift': n(800, 0.14),
      // Named -tile because the CHARACTER owns whether there is texture at
      // all: it sets --grain to this or to none. The palette decides what the
      // tooth is made of; the character decides whether the paper has any.
      'grain-tile': grain(grainInk(800), 0.16, -0.055),
    };
  }

  return {
    // Warm charcoal, not black. Pure black under tinted text buzzes, and this is
    // a surface someone reads late.
    bg: n(GROUND.dark),
    panel: n(900),
    'panel-glass': n(900, 0.72),
    'panel-2': n(850),
    // In dark the rule is LIGHTER than the panel and `line-soft` sits nearer to
    // it — the reverse of light. Soft always means less visible; it is never a
    // fixed direction along the scale.
    line: n(700),
    'line-soft': n(800),
    fg: n(150),
    'fg-dim': n(400),
    'fg-dimmer': n(500),
    accent: a(300),
    'accent-soft': a(500, 0.2),
    // TRANSLUCENT in dark, where light is opaque, and that is the whole of the
    // fix. Two opaque values were tried and each failed at one end.
    //
    // The grounds are not spread the same way in the two modes. In light the
    // page, the panel and the inner panel sit at 0.978, 0.995 and 0.957 — a
    // span of 0.04 — so ONE colour below all three clears every one of them by
    // roughly the same amount, and an opaque chip works. In dark they are
    // 0.155, 0.188 and 0.215, a span of 0.06 with the chip now ABOVE them, and
    // a single value cannot clear the deepest without overshooting the
    // shallowest: at n(700) it was a lit box on the page, and at the panel step
    // it vanished inside a table cell, which is where most literals in this app
    // actually are.
    //
    // Alpha has no such problem. A wash lifts whatever is under it by a
    // proportion of the distance to it, so the chip clears its own ground by
    // 0.10 to 0.13 of lightness on the page, on a card and in a cell alike —
    // against 0.175 for the version that shouted, and roughly what light gets
    // for free. The same mechanism the dark role washes already use; see `bg`
    // in rolesFor.
    'literal-bg': a(400, 0.24),
    shadow: 'oklch(0 0 0 / 0.38)',
    'shadow-lift': 'oklch(0 0 0 / 0.5)',
    // A wider spread than light, because equal alpha is not equal visibility:
    // the same field that reads as tooth on paper disappears on charcoal.
    'grain-tile': grain(grainInk(150), 0.2, -0.082),
  };
}

// Role triples: the text colour, the rule, and the wash behind it. A component
// that needs a colour asks for a role, never for a scale step.
//
// `accent` and `quiet` follow her hue; `ok`, `warn` and `alert` do not. See
// semanticHues above for why.
// The six faces the harness sets code in.
//
// They were declared in globals.css, on the reasoning that they are one view's
// vocabulary rather than the app's. That reasoning held right up until mode
// became something this surface ANIMATES: a token declared outside the generated
// theme is a token that is not registered, and an unregistered custom property
// changes in one step. So light to dark faded every colour on the page except
// the code, which jumped — the one place on the surface where colour IS the
// text, and the one place the jump is impossible to miss.
//
// Hues, not colours, and they run through the same scale as the role faces
// (--ok-fg and the rest), so there is still no second quality of paint here. The
// keyword takes the live hue, which is what keeps a highlighted file looking
// like it belongs to her chosen colour rather than to an editor.
export const syntaxHues = {
  keyword: HUE,
  string: semanticHues.ok,
  number: semanticHues.warn,
  literal: semanticHues.alert,
  // Two the roles do not have: a key in a JSON or YAML object, and a pattern.
  // Far enough from the three above to stay distinguishable in one listing.
  key: 255,
  regex: 195,
};

export function syntaxFor(mode) {
  return Object.fromEntries(
    Object.entries(syntaxHues).map(([name, hue]) => [
      `syn-${name}`,
      oklch(colourScale[mode === 'light' ? 600 : 200], hue),
    ]),
  );
}

export function rolesFor(mode) {
  const ramps = {
    ok: semanticHues.ok,
    warn: semanticHues.warn,
    alert: semanticHues.alert,
    accent: HUE,
    // Structural chips: a tag, a date, a file name. The neutral scale, so the
    // coloured roles stay rare enough to mean something.
    quiet: HUE,
  };

  return Object.fromEntries(
    Object.entries(ramps).map(([name, hue]) => {
      const scale = name === 'quiet' ? neutralScale : colourScale;
      const at = (step, alpha) => oklch(scale[step], hue, alpha);
      return [
        name,
        mode === 'light'
          ? { fg: at(600), border: at(200), bg: at(100) }
          : { fg: at(200), border: at(700), bg: at(500, name === 'quiet' ? 0.1 : 0.16) },
      ];
    }),
  );
}

// ── OKLCH → sRGB ────────────────────────────────────────────────────────────
//
// Björn Ottosson's Oklab matrices. Two callers, and they need different halves
// of the same conversion, which is why it lives here rather than in either of
// them: the contrast gate in scripts/generate-theme.mjs measures WCAG luminance,
// which is defined on LINEARISED sRGB, and app/layout.jsx needs a plain hex for
// the theme-colour meta tag, which cannot carry an oklch() value on every
// browser that reads it.
//
// The gate needs this at all because contrast is not a property of Oklab L: two
// colours at the same L and different hues have measurably different sRGB
// luminance, enough to swing a ratio by more than a point.
export function oklchToLinear([l, c], hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

// Out-of-gamut channels are clamped, which is the conservative reading: a
// browser gamut-maps instead, and mapping moves a colour less far than clamping
// does. The chroma values above are low enough that this is nearly always a
// no-op.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

// Gamma-encoded sRGB in 0-1. The filter matrix in grain() above works in sRGB
// rather than linear light, so it needs these rather than oklchToLinear's output.
// Not exported: hexOf and grainInk are its only callers and both live here.
function srgb(scaleStep, hue) {
  return oklchToLinear(scaleStep, hue).map((c) => gamma(clamp01(c)));
}

export function hexOf(scaleStep, hue) {
  return `#${srgb(scaleStep, hue)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
