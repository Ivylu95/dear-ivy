// No code tells the record apart from its siblings by a bare "data" prefix.
//
//   node scripts/check-record-paths.mjs     (runs as part of `npm run check`)
//
// `data/` sits beside folders whose names begin the same way — `data-sandbox/`,
// the throwaway test record, is the first. A path test written as
// startsWith('data') or /^data/ is true for both, so a rule meant for her record
// would fire on the sandbox, or a rule meant to keep the sandbox out would let it
// in. Every test that means "inside the record" has to name the folder with its
// slash — 'data/', /^data\// — or compare path segments.
//
// Pattern-matched, so it catches the usual shapes rather than every possible
// one: startsWith / includes / a regex anchored at ^data / a glob data*, each
// flagged unless "data" is followed by a slash. A test built by string
// concatenation passes unseen, and so does a flagged literal like /^data/i;
// those are the limits.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const self = fileURLToPath(import.meta.url);

const ROOTS = ['.claude/hooks', 'ux/lib', 'ux/app', 'ux/components', 'ux/config', 'ux/scripts', '.github/workflows'];
const EXTENSIONS = /\.(mjs|js|jsx|cjs|yml|yaml)$/;

// Each: a bare "data" prefix, not followed by a slash (escaped or not).
const RISKY = [
  [/startsWith\(\s*['"`]data(?!\\?\/)/, 'startsWith("data") also matches data-sandbox/'],
  [/includes\(\s*['"`]\/?data(?!\\?\/)/, 'includes("data") also matches data-sandbox/'],
  // In a regex literal an unescaped slash ends the pattern — /^data/ — so only an
  // escaped one, or a slash running on into a path or a closing quote, counts.
  [/\^data(?!\\\/|\/[\w'"`-])/, 'a regex anchored at ^data also matches data-sandbox/'],
  [/(^|[\s'"`])data\*/, 'the glob data* also matches data-sandbox/'],
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(name) && path !== self) yield path;
  }
}

const findings = [];
let scanned = 0;
for (const root of ROOTS) {
  for (const file of walk(join(repoRoot, root))) {
    scanned += 1;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const [pattern, why] of RISKY) {
          if (pattern.test(line)) findings.push(`${relative(repoRoot, file)}:${i + 1} — ${why}`);
        }
      });
  }
}

if (findings.length) {
  console.error(
    `\n  RECORD PATH CHECK FAILED\n\n${findings.map((f) => `  - ${f}`).join('\n')}\n\n` +
      '  Name the folder with its slash (\'data/\', /^data\\//) so data-sandbox/ and\n' +
      '  any other data-* folder can never be mistaken for the record.\n',
  );
  process.exit(1);
}

console.log(`record path check: ${scanned} code files clean, no bare "data" prefix`);
