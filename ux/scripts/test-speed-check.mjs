// Rule test for speed-check.mjs (HYG-006, design 5): a probe is called faster or slower
// only when every run of one side is beyond every run of the other and the medians
// differ by the margin; the probes nearest a change are found; and a CPU profile is
// read down to the repository's own slowest functions. Pure: no probe is run here.

import { hotspots, nearest, verdict } from './speed-check.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('every run quicker by more than the margin is faster', verdict([100, 102, 101], [80, 82, 81], 0.1) === 'faster');
check('every run slower by more than the margin is slower', verdict([100, 102, 101], [130, 128, 131], 0.1) === 'slower');
check('runs that overlap are no change, however the medians fall', verdict([100, 60, 140], [90, 70, 120], 0.1) === 'same');
check('clear of each other but within the margin is no change', verdict([100, 101, 100], [97, 96, 97], 0.1) === 'same');
check('a single slow outlier on the new side does not make it slower', verdict([100, 101, 102], [99, 160, 100], 0.1) === 'same');

const names = ['hook decisions', 'dashboard readers', 'unit tests', 'admin unit tests', 'rule test ux/scripts/test-reminders.mjs'];
check('a script with a rule test beside it is timed by that test and its folder\'s suites', nearest(['ux/scripts/reminders.mjs'], names).sort().join() === ['dashboard readers', 'rule test ux/scripts/test-reminders.mjs', 'unit tests'].sort().join());
check('a hook is timed by the hook decisions', nearest(['.claude/hooks/lib/heartbeats.mjs'], names).join() === 'hook decisions');
check('the admin page is timed by its own unit tests', nearest(['dev/ui/lib/x.js'], names).join() === 'admin unit tests');
check('a probe that does not exist is never named', nearest(['dev/ui/lib/x.js'], names.slice(0, 3)).length === 0);

const prof = {
  nodes: [
    { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1 } },
    { id: 2, callFrame: { functionName: 'slow', url: 'file:///repo/ux/lib/a.js', lineNumber: 9 } },
    { id: 3, callFrame: { functionName: '', url: 'file:///repo/ux/lib/b.js', lineNumber: 0 } },
    { id: 4, callFrame: { functionName: 'parse', url: 'node:internal/x', lineNumber: 1 } },
  ],
  samples: [2, 2, 3, 4, 1, 2],
  timeDeltas: [1000, 2000, 500, 9000, 100, 1000],
};
const hot = hotspots([prof, prof], 'file:///repo');
check('self time is summed per function, across processes, slowest first', hot[0].at === 'ux/lib/a.js:10 slow' && hot[0].ms === 8 && hot[1].at === 'ux/lib/b.js:1 (anonymous)' && hot[1].ms === 1);
check('time outside the repository is left out', hot.length === 2);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
