// Rule test for session/selftest-at-start.mjs: what session start says about the
// last background selftest, and when it starts another (SFG-013 design 3). The
// incident (design audit, 2026-10-08): run in the foreground under 45 s, the
// selftest never finished, and every session waited and said "unchecked".
// Pure: no run is started, nothing is written.
//
//   node .claude/hooks/session/test-selftest-at-start.mjs

import { shouldStart, summarize } from './selftest-at-start.mjs';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const H = 3600e3;

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const passed = { status: 'passed', started: ago(2 * H), finished: ago(H), failing: [] };
const broke = { status: 'failed', started: ago(2 * H), finished: ago(H), failing: ['FAIL record/guard-git-history.mjs refuses a force push'] };

check('a run that passed within the day says nothing', summarize(passed, NOW) === null);
check('a failed run names the failing case', /WARNING[\s\S]*refuses a force push/.test(summarize(broke, NOW) ?? ''));
check('no run ever recorded says the safeguards are unchecked', /no hook selftest has finished/.test(summarize(null, NOW) ?? ''));
check('a pass older than a day says the safeguards are unchecked', /no hook selftest has finished/.test(summarize({ ...passed, finished: ago(30 * H) }, NOW) ?? ''));
check('a run going keeps the failure before it in view', /WARNING/.test(summarize({ status: 'running', started: ago(60e3), previous: broke }, NOW) ?? ''));
check('a run going after a pass stays quiet', summarize({ status: 'running', started: ago(60e3), previous: passed }, NOW) === null);
check('a new run starts when none is going', shouldStart(passed, NOW) && shouldStart(null, NOW));
check('no second run starts beside one going', !shouldStart({ status: 'running', started: ago(60e3) }, NOW));
check('a run marked going for over ten minutes died, and another starts', shouldStart({ status: 'running', started: ago(11 * 60e3) }, NOW));
check('a run marked going from a day still to come died, and another starts (B9)', shouldStart({ status: 'running', started: ago(-24 * H) }, NOW));

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
