// Rule test for isFreshStart in lib/sandbox.mjs (DAT-005): a rebuild reads as a fresh
// start only when the record really started over, never when an update added a
// standing file. On 2026-10-16 a new blank reminders file made session-brief tell a
// session with a whole record to "open as a first conversation".

import { isFreshStart } from './sandbox.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('one new standing file, never in history, is not a fresh start', !isFreshStart(['core/calendar/reminders.json'], ''));
check('the profile missing is a fresh start', isFreshStart(['PROFILE.yaml', 'core/state/now.md', 'core/timeline.md'], ''));
check('the snapshot missing is a fresh start', isFreshStart(['core/state/now.md'], ''));
check('a file history held, now gone, is a rebuild', isFreshStart(['core/calendar/reminders.json'], 'abc123'));

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
