// Turn theme/palette.mjs into app/theme.generated.css.
//
// Run: npm run gen:theme
//
// The output is the only place colour literals and type-and-density values exist
// in the rendered app. globals.css and every component reference the variables it
// defines. Generation is explicit rather than computed at runtime, so the browser
// gets plain custom properties at zero JS cost — and because every tinted value
// is `oklch(L C var(--hue))`, re-tinting the whole app is one property, not a
// regeneration.
//
// ── The contrast gate ───────────────────────────────────────────────────────
//
// The hue is a free control, so correctness cannot be established by looking at
// the one hue that shipped. This gate walks the entire circle and measures every
// pair at every step, and a failure stops the build.
//
// That is what makes a free colour control safe to offer at all: she can put the
// hue anywhere, and no position on the circle can produce text she cannot read.
// It is the only check here that protects her rather than the code — the surface
// it guards is read on bad evenings.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARK_PATHS, MARK_STROKE, MARK_VIEWBOX } from '../theme/mark.mjs';
import {
  DEFAULT_CHARACTER,
  DEFAULT_HUE,
  GROUND,
  characterById,
  characters,
  MIN_HUE_SEPARATION,
  clamp01,
  colourScale,
  huePresets,
  neutralScale,
  hexOf,
  oklchToLinear,
  rolesFor,
  semanticHues,
  surfacesFor,
  syntaxFor,
  tokens,
} from '../theme/palette.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'app', 'theme.generated.css');
const MODES = ['light', 'dark'];

// Relative luminance is defined on LINEARISED sRGB, which is what
// oklchToLinear (in theme/palette.mjs, shared with the theme-colour meta tag)
// already returns — so it is read straight off, with no round trip through the
// gamma curve and back.
const luminance = ([r, g, b]) =>
  0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);

const ratio = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// A pair under test is resolved at one concrete hue. `spec` is [step, scale,
// hue, alpha]: alpha means the colour is a wash and has to be composited over
// whatever it sits on before it is measured, because the ratio of a translucent
// colour against its own backdrop is not a thing the eye ever sees.
const resolve = (scale, step, hue) => oklchToLinear(scale[step], hue);

const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

// Thresholds are per-use, not one number for everything.
//
//   4.5  WCAG AA for body text. Anything she actually reads.
//   3.0  AA for large text, UI components and graphical objects. `fg-dimmer` is
//        small print and icon strokes. Holding those to 4.5 would force every
//        hue to a harder, more clinical contrast than this record wants, for no
//        legibility gained.
//   1.3  A rule against its panel. Not a WCAG figure — a rule is decoration, and
//        this only asserts it is actually visible rather than a line nobody can
//        see. Without it a palette can pass every text check and render as
//        floating text on an undifferentiated ground.
function pairsAt(hue, mode) {
  const N = (step) => resolve(neutralScale, step, hue);
  const C = (step, h) => resolve(colourScale, step, h ?? hue);
  const light = mode === 'light';

  const bg = N(light ? 50 : 950);
  const panel = N(light ? 25 : 900);

  const rows = [
    ['fg on bg', N(light ? 800 : 150), bg, 4.5],
    ['fg on panel', N(light ? 800 : 150), panel, 4.5],
    ['fg-dim on bg', N(light ? 600 : 400), bg, 4.5],
    ['fg-dim on panel', N(light ? 600 : 400), panel, 4.5],
    ['fg-dimmer on bg', N(light ? 400 : 500), bg, 3],
    ['fg-dimmer on panel', N(light ? 400 : 500), panel, 3],
    ['accent on bg', C(light ? 500 : 300), bg, 4.5],
    ['accent on panel', C(light ? 500 : 300), panel, 4.5],
    ['line on panel', N(light ? 200 : 700), panel, 1.3],
    ['line-soft on panel', N(light ? 150 : 800), panel, 1.02],
  ];

  // Every role chip: its text on its own wash, and its border against the panel
  // it sits on. In dark the wash is translucent, so it composites first.
  for (const [name, roleHue] of Object.entries({ ...semanticHues, accent: hue, quiet: hue })) {
    const scale = name === 'quiet' ? neutralScale : colourScale;
    const at = (step) => resolve(scale, step, roleHue);
    const chipBg = light ? at(100) : over(at(500), panel, name === 'quiet' ? 0.1 : 0.16);
    rows.push([`${name} chip text`, at(light ? 600 : 200), chipBg, 4.5]);
    rows.push([`${name} chip border`, at(light ? 200 : 700), panel, 1.02]);
  }

  return rows;
}

// Sweep the circle. 5° is finer than the eye distinguishes at these chromas and
// finer than the luminance function turns, so the worst case found here is the
// worst case there is.
const worst = new Map();
for (let hue = 0; hue < 360; hue += 5) {
  for (const mode of MODES) {
    for (const [name, fg, bg, min] of pairsAt(hue, mode)) {
      const key = `${mode} · ${name}`;
      const value = ratio(fg, bg);
      const held = worst.get(key);
      if (!held || value < held.value) worst.set(key, { value, min, hue });
    }
  }
}

const failures = [...worst.entries()]
  .filter(([, r]) => r.value < r.min)
  .map(
    ([key, r]) =>
      `  ${key}: ${r.value.toFixed(2)}:1 at hue ${r.hue}, needs ${r.min}:1`,
  );

if (failures.length) {
  console.error(
    `theme.generated.css NOT written — ${failures.length} contrast failure(s) on the hue circle:\n` +
      `${failures.join('\n')}\n\n` +
      'Adjust the L/C values in theme/palette.mjs. Do not lower a threshold and do\n' +
      'not narrow the hue range: this surface is read on bad evenings, and the gate\n' +
      'sweeping the whole circle is the reason a free colour control is safe at all.',
  );
  process.exit(1);
}

// A preset must not put the accent on top of a role.
//
// The slider can of course be dragged onto ok's green or alert's red, and that
// is her business — a free control is free. A RECOMMENDED colour is different:
// offering one by name that makes "in hand" indistinguishable from the accent is
// the app's mistake, not hers.
const collisions = [];
for (const preset of huePresets) {
  for (const [role, roleHue] of Object.entries(semanticHues)) {
    // Shortest way round the circle: 350 and 10 are 20 degrees apart, not 340.
    const raw = Math.abs(preset.hue - roleHue) % 360;
    const apart = Math.min(raw, 360 - raw);
    if (apart < MIN_HUE_SEPARATION) {
      collisions.push(
        `  ${preset.name} (${preset.hue}) is ${apart}deg from ${role} (${roleHue})`,
      );
    }
  }
}

if (collisions.length) {
  console.error(
    `theme.generated.css NOT written — ${collisions.length} recommended colour(s) ` +
      `collide with a role hue:\n${collisions.join('\n')}\n\n` +
      `Move the preset in theme/palette.mjs. Needs ${MIN_HUE_SEPARATION}deg of clearance.`,
  );
  process.exit(1);
}

// ── Emit ────────────────────────────────────────────────────────────────────

const lines = [];
const push = (s = '') => lines.push(s);

push('/* AUTO-GENERATED from theme/palette.mjs. Do not edit. Run: npm run gen:theme */');
push();

push('/* The three axes meet here. --hue is set by the picker (or left at the');
push('   default), --grain and the type and density tokens come from the character');
push('   block below, and light/dark comes from the .dark class. */');
push(':root {');
push(`  --hue: ${DEFAULT_HUE};`);
for (const [name, value] of Object.entries(tokens)) push(`  --${name}: ${value};`);
push('}');
push();

function colourBlock(selector, mode, pad = '') {
  push(`${pad}${selector} {`);
  push(`${pad}  color-scheme: ${mode};`);
  for (const [name, value] of Object.entries(surfacesFor(mode))) push(`${pad}  --${name}: ${value};`);
  push();
  for (const [name, triple] of Object.entries(rolesFor(mode))) {
    push(`${pad}  --${name}-fg: ${triple.fg};`);
    push(`${pad}  --${name}-border: ${triple.border};`);
    push(`${pad}  --${name}-bg: ${triple.bg};`);
  }
  push();
  // The harness's six code faces. Here rather than in globals.css so that they
  // are registered and tiered with everything else — see syntaxFor in
  // theme/palette.mjs for why that turned out to matter.
  for (const [name, value] of Object.entries(syntaxFor(mode))) push(`${pad}  --${name}: ${value};`);
  push(`${pad}}`);
  push();
}

// Light is the base, so a document with no class still renders correctly.
push('/* Light is the base: a document with no class still renders correctly. */');
colourBlock(':root', 'light');

// The OS preference, honoured by the stylesheet rather than only by the script.
//
// This block did not exist, and its absence was a real failure rather than a
// missing nicety: the default mode is `system`, and `system` was implemented
// ENTIRELY in JavaScript. A browser with scripting off — or one where the inline
// script's `localStorage` access throws, which is what blocked site data does —
// fell through to this file's light block and showed a dark-mode reader a white
// page. The app's own default silently stopped working in the one case nothing
// could report.
//
// So the media query carries it and the class only ever OVERRIDES. `:not(.light)`
// is what makes the override work in both directions: without it, choosing light
// on a machine set to dark would be undone by this block the moment it loaded.
push("/* The OS preference, in CSS. `system` mode is the default, so it cannot");
push('   depend on a script having run — see the note in scripts/generate-theme.mjs.');
push('   `:not(.light)` lets an explicit choice win in both directions. */');
push('@media (prefers-color-scheme: dark) {');
colourBlock(':root:not(.light)', 'dark', '  ');
push('}');
push();

push('/* An explicit dark choice, which beats the media query above. */');
colourBlock(':root.dark', 'dark');

// ── Why there is no @property block here ────────────────────────────────────
//
// There was one, and it is worth saying why it went.
//
// Mode was animated by transitioning the colour tokens themselves: registered
// with @property so they would interpolate at all, tiered so ground and type
// crossed before structure and colour. It was built to dodge the one cost of a
// view transition — the API owns the pointer while it runs, so the page cannot
// be pressed until it finishes.
//
// It dodged that and bought two worse problems. Interpolating 33 properties on
// the root is a style recalculation of the whole document and a repaint of the
// viewport EVERY FRAME, which on a long page is the heaviest thing this surface
// does; and it can only animate what is a registered token, so anything that is
// not — an image, a blend mode, a colour some component holds — steps while
// everything around it slides. A fade that is not uniform reads worse than no
// fade at all.
//
// The view transition has neither problem: it is a picture of the old page and a
// picture of the new one, so EVERYTHING in the frame moves together, including
// the grain, and it costs one composited pair however long the page is. Its
// pointer cost is real and is paid for by keeping the animation short — see
// dur-swap in theme/palette.mjs.

function characterBlock(selector, character) {
  push(`${selector} {`);
  for (const [name, value] of Object.entries(character.tokens)) push(`  --${name}: ${value};`);
  push('}');
  push();
}

// Same fallback shape as the colour blocks: the default character is emitted
// unqualified as well as under its own attribute, so a document with no
// data-character — or one carrying an id no character claims — still renders a
// complete set of tokens rather than a page with no type scale.
push('/* The default character, unqualified. An unknown data-character lands here. */');
characterBlock(':root', characterById(DEFAULT_CHARACTER));

for (const character of characters) {
  push(`/* ${character.label} — ${character.note} */`);
  characterBlock(`:root[data-character='${character.id}']`, character);
}

// ── The favicon ─────────────────────────────────────────────────────────────
//
// Written here rather than kept as a hand-maintained file, for the two reasons
// everything else in this script is generated: it is made of colour, and colour
// has one home; and it is made of the same artwork as the rail's mark, which had
// already drifted once — the mark became a pen and the tab kept an envelope,
// because nothing connected them.
//
// A favicon cannot follow --hue. It is a file, and the hue is chosen in her
// browser long after this runs, so it is drawn at the DEFAULT hue and stays
// there. That is a real limitation and not a bug: a tab icon that changed colour
// with a preference would be a tab she stops recognising at a glance.
function writeIcon() {
  const { x, y, w, h } = MARK_VIEWBOX;
  // Padded into a 32 box. The scale is what keeps the stroke weight looking like
  // the rail's once the artwork has been shrunk to leave room for the corner.
  const inset = 5;
  const scale = (32 - inset * 2) / w;
  const tx = inset - x * scale;
  const ty = inset - y * scale;

  const ground = hexOf(neutralScale[GROUND.light], DEFAULT_HUE);
  const ink = hexOf(colourScale[500], DEFAULT_HUE);

  const paths = MARK_PATHS.map((p) => {
    const extra = [
      p.width ? ` stroke-width="${p.width}"` : '',
      p.opacity ? ` opacity="${p.opacity}"` : '',
    ].join('');
    return `    <path d="${p.d}"${extra}/>`;
  }).join('\n');

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `  <rect width="32" height="32" rx="7" fill="${ground}"/>`,
    `  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})"`,
    `     fill="none" stroke="${ink}" stroke-width="${MARK_STROKE}"`,
    '     stroke-linecap="round" stroke-linejoin="round">',
    paths,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');

  writeFileSync(join(root, 'app', 'icon.svg'), svg, 'utf8');
  return svg.length;
}

const iconBytes = writeIcon();

writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');

const tightest = [...worst.entries()].sort((a, b) => a[1].value / a[1].min - b[1].value / b[1].min)[0];
console.log(
  `theme.generated.css written: ${characters.length} characters × 2 modes × 360° of hue, ` +
    `${lines.filter((l) => l.trim().startsWith('--')).length} custom properties.\n` +
    `Contrast gate passed, ${huePresets.length} recommended colours clear of every role hue.
` +
    `Tightest pair anywhere on the circle: ` +
    `${tightest[0]} at ${tightest[1].value.toFixed(2)}:1 (needs ${tightest[1].min}:1, hue ${tightest[1].hue}).`,
);
