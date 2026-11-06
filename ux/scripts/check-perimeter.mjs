// DPV-001: "Every route is shut unless it is named as open."
//
//   node scripts/check-perimeter.mjs     (runs as part of `npm run check`)
//
// Why this exists, specifically:
//
// The gate is the whole of the protection standing between this record and the
// open internet, and its entire strength is one short list: the routes that are
// reachable without a session. A list of four is a posture you can audit at a
// glance. A list that has quietly become nine is not — and nothing about adding
// the ninth looks like a security decision at the moment it is made. It looks
// like adding a route.
//
// `specs/ux/perimeter.md` draws that perimeter, and the spec is normative: if the
// router and the spec disagree, the router is wrong. But a map nothing compares
// against the territory is a map that drifts, which is the criticism the spec's
// own Perimeter section invites. This is the comparison.
//
// ── What it checks ──────────────────────────────────────────────────────────
//
//   COUNT     The number of openings the gate has, against the number the spec's
//             Perimeter names. Adding one to the router without adding one to
//             the spec fails the build. It does not check WHICH — the spec names
//             openings in prose ("the sign-in page"), deliberately, because a
//             spec statement carries no mechanism. What it makes impossible is a
//             silent widening.
//
//             An opening is not the same as an allowlist entry. The gate has two
//             ways of letting something through: a path on the allowlist, and a
//             name excused from the matcher entirely. Static build assets are the
//             second, and they are one opening in the spec's tree however many
//             names implement them — so they are counted as one. This distinction
//             was not obvious until the check's first run reported four against
//             three, which is what a check is for.
//
//   ANCHORS   Every name excluded from the gate's matcher is terminated. This is
//             the bypass class the spec's key consideration names: an
//             unterminated name is a prefix, so an exclusion for `icon.svg` that
//             does not end in `$` also excuses `/icon.svgXanything`, and an
//             unescaped dot matches any character. Both are one keystroke from
//             correct and neither announces itself.
//
// ── What it cannot do ───────────────────────────────────────────────────────
//
// It reads the gate as text, not as behaviour. A route made reachable some other
// way — a rewrite, a header check, a framework default — is invisible to it. A
// clean run is not proof the perimeter holds; a dirty run is proof it has moved,
// which is the direction that matters.
//
// Nothing here reads anything under data/. It cannot print personal content
// because it never opens a file that holds any.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ux = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(ux);

const GATE = join(ux, 'proxy.js');
const SPEC = join(repoRoot, 'specs', 'ux', 'perimeter.md');

const findings = [];

function read(path, label) {
  if (!existsSync(path)) {
    findings.push(`${label} is missing — expected at ${path.slice(repoRoot.length + 1)}`);
    return null;
  }
  return readFileSync(path, 'utf8');
}

const gate = read(GATE, 'the gate');
const spec = read(SPEC, 'the perimeter spec');

// ── Count ───────────────────────────────────────────────────────────────────

if (gate && spec) {
  // The allowlist literal, as written. Parsing rather than importing: this file
  // must be readable without executing the gate or pulling in its dependencies,
  // and a check that runs the thing it is checking can be defeated by it.
  const list = /const\s+PUBLIC\s*=\s*\[([^\]]*)\]/.exec(gate);
  if (!list) {
    findings.push(
      'the gate has no recognisable allowlist — expected `const PUBLIC = [...]` in ux/proxy.js',
    );
  } else {
    const allow = [...list[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);

    // The matcher's exclusions are the gate's other opening: whatever they name
    // never reaches it at all. However many names are listed, the spec's tree
    // calls them one thing — static build assets — so they count once.
    const excuses = /\(\?!([^)]*)\)/.test(gate) ? 1 : 0;
    const openings = allow.length + excuses;

    // Openings the spec names: lines inside the Perimeter block marked `# open:`.
    const named = [...spec.matchAll(/#\s*open:/g)].length;

    if (named === 0) {
      findings.push(
        'the perimeter spec names no openings — expected lines marked `# open:` in its Perimeter block',
      );
    } else if (openings > named) {
      findings.push(
        `the gate has ${openings} openings; the perimeter spec names ${named}. ` +
          `Widening the gate is a change to the perimeter: add the opening to ` +
          `specs/ux/perimeter.md, or take it out of the router`,
      );
    } else if (openings < named) {
      // Not a security failure — the gate is tighter than the spec allows. Still
      // a divergence, and still worth knowing: it usually means a route was
      // removed and the spec was not told.
      findings.push(
        `the perimeter spec names ${named} openings; the gate has ${openings}. ` +
          `The gate is tighter than the map, which is safe but means one of them is stale`,
      );
    }
  }
}

// ── Anchors ─────────────────────────────────────────────────────────────────

if (gate) {
  const matcher = /matcher:\s*\[([^\]]*)\]/.exec(gate);
  if (!matcher) {
    findings.push('the gate has no recognisable matcher — expected `matcher: [...]` in its config');
  } else {
    // Everything inside the negative lookahead is excused from the gate. Each
    // alternative has to end in a path separator or an anchor, or it is a prefix.
    const lookahead = /\(\?!([^)]*)\)/.exec(matcher[1]);
    for (const raw of lookahead ? lookahead[1].split('|') : []) {
      const name = raw.trim();
      if (!name) continue;
      if (!name.endsWith('/') && !name.endsWith('$')) {
        findings.push(
          `the gate excuses "${name}" without terminating it — an unterminated name is a prefix, ` +
            `so anything starting with it bypasses the gate`,
        );
      }
      // A dot that reaches the regex unescaped matches any character, so
      // `favicon.ico` also excuses `faviconXico`.
      //
      // Backslashes are COUNTED rather than merely looked for, because this is
      // source text on its way through two layers. The matcher is a string
      // literal, and a JS string halves its backslashes before the regex ever
      // sees them: two in the source arrive as one and escape the dot, one in
      // the source arrives as none and does not. So a single backslash looks
      // like an escape, reads like an escape, and is a bypass.
      //
      // Not hypothetical. The first version of this check tested for "preceded
      // by a backslash", and a mutation that dropped one of the two walked
      // straight past it.
      for (const hit of name.matchAll(/(\\*)\./g)) {
        const slashes = hit[1].length;
        if (slashes >= 2 && slashes % 2 === 0) continue;
        findings.push(
          `the gate excuses "${name}" with a dot that reaches the regex unescaped ` +
            `(${slashes === 1 ? 'one backslash' : `${slashes} backslashes`} in the source, where it ` +
            `needs two) — a bare dot matches ` +
            `any character, so a near-miss of that name bypasses the gate too`,
        );
      }
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

if (findings.length > 0) {
  console.error('\n  PERIMETER CHECK FAILED\n');
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    '\n  The gate is the whole of the protection between this record and the open',
  );
  console.error(
    '  internet. See DPV-001, "Every route is shut unless it is named as open."\n',
  );
  process.exit(1);
}

const summary = /const\s+PUBLIC\s*=\s*\[([^\]]*)\]/.exec(gate ?? '');
const paths = summary ? [...summary[1].matchAll(/['"`]([^'"`]+)['"`]/g)].length : 0;
console.log(
  `perimeter check: ${paths} open paths plus static assets, each named in the spec, ` +
    `every exclusion anchored`,
);
