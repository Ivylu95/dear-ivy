// `npm run check`: every check, run to the end, every failure reported.
//
//   node lib/run-checks.mjs          from ux/: the checks marked `local`
//   node lib/run-checks.mjs --ci     the checks marked `ci`, as the push workflow runs them
//
// It was one `&&` chain, so the first failure hid every check after it: the
// scratch report never ran behind a failing sandbox check (WKB-004, backlog
// 2026-10-03). Each check now runs whatever the one before it did, and the run
// fails if any did. The list is lib/checks.mjs, shared with the commit gate and
// the workflow (SFG-007 design 4).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksFor } from './checks.mjs';
import { unsignedEnv } from '../../.claude/hooks/lib/unsigned-git.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const where = process.argv.includes('--ci') ? 'ci' : 'local';
const CHECKS = checksFor(where);
// Unsigned: the checks' throwaway commits never go through the machine's signer (unsigned-git.mjs).
const env = unsignedEnv();

const failed = [];
for (const { name, script, args = [], cwd = 'ux', prepare } of CHECKS) {
  console.log(`\n── ${name}: ${[script, ...args].join(' ')} ──`);
  // A released copy has no dev/ (FND-007), and runs whole without it (ARC-008).
  if ([script, cwd].some((p) => p.startsWith('dev/') && !existsSync(join(ROOT, p)))) {
    console.log('no dev/ in this copy: skipped');
    continue;
  }
  if (prepare) {
    const ready = spawnSync(process.execPath, [join(ROOT, prepare)], { cwd: join(ROOT, cwd), stdio: 'inherit', env });
    if (ready.status !== 0) {
      failed.push(`${name} (could not prepare: ${prepare})`);
      continue;
    }
  }
  const run = spawnSync(process.execPath, [join(ROOT, script), ...args], { cwd: join(ROOT, cwd), stdio: 'inherit', env });
  if (run.status !== 0) failed.push(`${name}${run.error ? ` (${run.error.message})` : run.signal ? ` (killed: ${run.signal})` : ''}`);
}

if (failed.length) {
  console.error(`\ncheck: ${failed.length} of ${CHECKS.length} failed:\n${failed.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`\ncheck: all ${CHECKS.length} passed`);
