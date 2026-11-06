// Rule test for failClosed() in hook.mjs (Audit #5): a guard that crashes refuses
// the call and says why; an advisory hook that crashes still passes silently; and
// the guards that hold a rule nobody may skip (the safety-core lock, the
// record-deletion guard) each call it.
//
// Run: node .claude/hooks/lib/test-fail-closed.mjs

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hook = pathToFileURL(fileURLToPath(new URL('./hook.mjs', import.meta.url))).href;
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const run = (body) => {
  const env = { ...process.env };
  delete env.DEAR_HOOK_STRICT;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `import * as h from ${JSON.stringify(hook)};\n${body}`], { encoding: 'utf8', env, input: '{}' });
};

const guard = run("h.failClosed('PreToolUse', 'a test guard');\nthrow new Error('boom');");
let decision = null;
try { decision = JSON.parse(guard.stdout).hookSpecificOutput; } catch { /* no JSON: not refused */ }
check('a guard that crashes refuses the call', guard.status === 0 && decision?.permissionDecision === 'deny');
check('and says which guard crashed and why', /a test guard crashed \(boom\)/.test(decision?.permissionDecisionReason ?? ''));

const later = run("h.failClosed('PreToolUse', 'a test guard');\nawait Promise.reject(new Error('late'));");
check('a rejected promise in a guard refuses too', /"deny"/.test(later.stdout));

const advisory = run("throw new Error('boom');");
check('an advisory hook that crashes still passes silently', advisory.status === 0 && advisory.stdout.trim() === '');

for (const [path, name] of [['../safety/guard-safety-core.mjs', 'the safety-core lock'], ['../record/guard-record-deletion.mjs', 'the record-deletion guard']]) {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  check(`${name} fails closed`, /^failClosed\('PreToolUse',/m.test(text));
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('fail closed: a crashed guard refuses, an advisory hook still passes');
