// Rule tests for lib/record-archive.mjs: SFG-007's archive check at commit time.
// A record file deleted without an archived copy is refused; in a merge, a
// deletion the incoming side had already made is not this commit's (2026-10-01:
// a flag file main removed in its own commit blocked every merge of main).
// Run by selftest.mjs; exits non-zero on any failure.

import { lostRecordFiles } from '../lib/record-archive.mjs';

const flag = 'data/core/state/FLAG.md';
const theyHold = () => true;
const theyRemoved = () => false;

const cases = [
  ['refuses a record file deleted outright', [['D', flag]], null, 1],
  ['passes a deletion whose copy lands in the archive', [['D', flag], ['A', 'data/archive/FLAG.md']], null, 0],
  ['ignores files outside the record', [['D', 'README.md']], null, 0],
  ['ignores the archive itself', [['D', 'data/archive/old.md']], null, 0],
  ['merge: passes a deletion the incoming side already made', [['D', flag]], theyRemoved, 0],
  ['merge: refuses a deletion while the incoming side still holds the file', [['D', flag]], theyHold, 1],
  // The save hook's failure flag is a status note, never her words (review, 2026-10-16).
  ["passes the save hook's failure flag leaving", [['D', 'data/core/state/PUSH_FAILED.md']], null, 0],
  ['still refuses a real state file leaving', [['D', 'data/core/state/now.md']], null, 1],
];

let failed = 0;
for (const [what, status, incoming, expected] of cases) {
  const ok = lostRecordFiles(status, incoming).length === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
