// Rule test: a failed rule test's failing cases are shown by the self-test, even
// when the test prints them to stdout (lib/failure-detail.mjs, T-871).

import { failureDetail } from './failure-detail.mjs';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed += 1; };

const out = 'ok   first case\nFAIL a status message within the window\nok   last case\n';
const shown = failureDetail(out, '1 failing\n');
check('a FAIL line printed to stdout is shown', shown.includes('FAIL a status message within the window'));
check('passing lines are not', !shown.includes('first case'));
check('stderr is still shown, after the failing cases', shown.endsWith('1 failing') && shown.indexOf('FAIL') < shown.indexOf('1 failing'));
check('a test that writes only to stderr shows the same as before', failureDetail('', 'boom\n') === 'boom');

if (failed) { console.error(`${failed} failing`); process.exit(1); }
console.log('failure detail: all cases hold');
