// The scratch folder is reported on, so a sweep that has stopped shows as a number.
//
//   node scripts/check-scratch.mjs     (runs first in `npm run check`)
//
// ARC-013's design names a size check for one reason: the sweep in
// .claude/hooks/session/sweep-temp.mjs runs unattended, and an unattended thing
// that silently stops looks exactly like one that has nothing to do. Nothing else
// in the repository would notice — temp/ is untracked, so it produces no diff, no
// commit and no failure however large it grows.
//
// It reports rather than fails. A gate that refused a commit over housekeeping
// would put scratch ahead of the work, and the row asks for a number in front of
// a reader, not a blocked commit. It runs first in the check chain because it
// never fails: placed after a check that does, it never runs at all.
//
// THE AGE IS THE REAL SIGNAL, not the size. A stopped sweep shows first as a file
// older than the margin it should have been removed at; size only follows later,
// and only if something large happens to be written. Both are printed. The size
// ceiling is also read as each development session opens
// (.claude/hooks/session/heartbeats-at-start.mjs); both lines live in one place.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  measureScratch,
  scratchCeilingMb,
  scratchMaxAgeDays,
} from '../../.claude/hooks/lib/scratch.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');

// (The one exception fails: ARC-014, below.)
// ARC-014: state a later run reads is not scratch. A dashboard script that
// keeps a .json file inside temp/ gets it swept or emptied, and the next start
// then behaves differently (dev.mjs once kept its server ids there). That is the
// one thing here that fails: lasting state belongs in .claude/hooks/state/.
const scriptsDir = join(repoRoot, 'ux', 'scripts');
const STATE_IN_TEMP = /join\([^)]*'temp'[^)]*'[^']+\.json'/;
const misplaced = readdirSync(scriptsDir)
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('test-') && f !== 'check-scratch.mjs')
  .filter((f) => STATE_IN_TEMP.test(readFileSync(join(scriptsDir, f), 'utf8')));
for (const f of misplaced) {
  console.log(`  FAIL  ux/scripts/${f} keeps a .json file in temp/; state a later run reads belongs in .claude/hooks/state/ (ARC-014)`);
}
if (misplaced.length) process.exit(1);
const m = measureScratch(repoRoot);
const maxAge = scratchMaxAgeDays();
const ceiling = scratchCeilingMb();

if (!m) {
  console.log('scratch check: no temp/ folder, nothing to report');
  process.exit(0);
}
if (m.files === 0) {
  console.log('scratch check: temp/ is empty');
  process.exit(0);
}

console.log(
  `scratch check: temp/ holds ${m.files} file(s), ${m.mb.toFixed(1)} MB, oldest ${m.oldestDays} day(s)`,
);

if (!maxAge || !ceiling) {
  console.log('  NOTE  the scratch thresholds could not be read from .claude/thresholds.json (FND-009); run node ux/scripts/thresholds.mjs');
}
if (maxAge && m.oldestDays > maxAge) {
  console.log(
    `  NOTE  something in temp/ is older than the ${maxAge}-day margin, so the sweep has not run.\n` +
      '        Check that .claude/hooks/session/sweep-temp.mjs is wired into SessionStart in .claude/settings.json.',
  );
}

if (ceiling && m.mb > ceiling) {
  console.log(
    `  NOTE  temp/ is past its ${ceiling} MB ceiling. Nothing there is meant to be kept — anything that is\n` +
      '        should have moved to its proper home before the work ended (ARC-013).',
  );
}

process.exit(0);
