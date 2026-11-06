// Rule test for check-doctor-fence.mjs (HBT-013): the doctor reaches the heartbeat
// machinery and nothing else, never its own rules, never safety, never deletes.

import { outsideFence } from './check-doctor-fence.mjs';
import { corePaths } from './check-only-strengthens.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const core = corePaths();
const one = (path, status = 'M') => outsideFence([{ status, path }], core);

check('a job prompt may be mended', one('.claude/jobs/safeguard-check.md').length === 0);
check('the heartbeat library, reminders, nudge and report may be mended', ['.claude/hooks/lib/heartbeats.mjs', 'ux/scripts/reminders.mjs', 'ux/scripts/nudge.mjs', 'dev/run-report.mjs'].every((p) => one(p).length === 0));
// A-152: a job passes its question in its reply; only the orchestrator writes the list.
check('the for-you list is refused', one('dev/for-you.md').length === 1);
check('the specs are refused', one('dev/specs/system/heartbeats.md').length === 1);
check('CLAUDE.md is refused', one('CLAUDE.md').length === 1);
check('the commit gate and the checks are refused', one('.claude/hooks/git/pre-commit').length === 1 && one('ux/lib/checks.mjs').length === 1 && one('ux/scripts/check-doctor-fence.mjs').length === 1);
check('the orchestrator and its own prompt are refused', one('.claude/jobs/README.md').length === 1 && one('.claude/jobs/heartbeat-doctor.md').length === 1);
check('the check-in, on the safety surface, is refused', one('.claude/jobs/check-in.md').length === 1);
check('the record is refused', one('data/core/calendar/reminders.json').length === 1);
check('deleting inside the fence is refused', one('ux/scripts/reminders.mjs', 'D').length === 1);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
