// Rule test for check-privacy-at-stop.mjs: a scan that times out is reported as
// unfinished, never as a leak, and still blocks (2026-10-05). Run by
// selftest.mjs; exits non-zero on any failure.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'check-privacy-at-stop.mjs');
const run = spawnSync(process.execPath, [hook], {
  input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'selftest-privacy-timeout' }),
  encoding: 'utf8',
  env: { ...process.env, DEAR_PRIVACY_STOP_TIMEOUT_MS: '1' },
  windowsHide: true,
});
const out = run.stdout || '';
const cases = [
  ['a timed-out scan still blocks', /"decision":\s*"block"/.test(out)],
  ['it says the check did not finish', /DID NOT FINISH/.test(out)],
  ['it never claims something personal was found', !/something personal is outside data/.test(out)],
];
let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.log(out || run.stderr);
  process.exit(1);
}
