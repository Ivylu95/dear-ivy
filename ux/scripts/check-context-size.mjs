// The always-loaded instructions never grow: `CLAUDE.md` is held at or under a
// ceiling that only comes down, until it reaches the cap (CTX-001, "The
// always-loaded instructions stay under a measured size limit.", design 1).
//
//   node scripts/check-context-size.mjs              CLAUDE.md at the repository root
//   node scripts/check-context-size.mjs --file <p>   another file, for its test
//
// Every session reads the whole file, and the longer it grows the less of it is
// followed. It was 428 lines when this check was built, over twice the cap of
// 200, so a check failing at 200 would have failed every commit from its first
// day. It fails instead above `context.layerCeiling`, today's length, and says
// when the file has fallen far enough to lower it: sections move out into skills
// (CTX-001 design 2), the crisis block never does. Both numbers live in the
// row's design column (FND-009) and are read from .claude/thresholds.json.
// Lines stand in for attention; a short file of dense lines still passes.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = process.argv.indexOf('--file');
const file = at > -1 ? resolve(process.argv[at + 1] ?? '') : join(root, 'CLAUDE.md');

const ceiling = threshold('context.layerCeiling', 'lines');
const cap = threshold('context.layerCap', 'lines');
if (!ceiling || !cap) {
  console.error('context size: no context.layerCeiling or context.layerCap in .claude/thresholds.json; run node ux/scripts/thresholds.mjs');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`context size: ${file} not found`);
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const lines = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;

if (lines > ceiling) {
  console.error(
    `context size: CLAUDE.md is ${lines} lines, past its ceiling of ${ceiling} (CTX-001). Every session reads all of it. ` +
      'Move what grew into a skill that loads when it matches, or a file the layer links to (CTX-001 design 2); never the crisis block.',
  );
  process.exit(1);
}
if (lines <= cap) {
  console.log(`context size: CLAUDE.md is ${lines} lines, under the cap of ${cap} (CTX-001)`);
} else if (lines < ceiling) {
  console.log(
    `context size: CLAUDE.md is ${lines} lines, under its ceiling of ${ceiling}, over the cap of ${cap}. ` +
      `Lower the ceiling to ${lines} in CTX-001's design column, so the lines won stay won.`,
  );
} else {
  console.log(`context size: CLAUDE.md is ${lines} lines, at its ceiling, over the cap of ${cap} (CTX-001)`);
}
