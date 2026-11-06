// Rule test for check-safety.mjs (SAF-002, SAF-016): a Singapore plan must hold
// all four shipped lines and every number CLAUDE.md recites; a plan for another
// country (recorded in the setup notes) needs its first route and emergency
// number, and the Singapore defaults are not expected in it. Fictional numbers
// only.
//
// Run from the repository root: node ux/scripts/test-check-safety.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const check = join(dirname(fileURLToPath(import.meta.url)), 'check-safety.mjs');
let failed = 0;
const expect = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const roots = [];
const copy = (plan, notes) => {
  const root = makeTemp('dear-safety-');
  roots.push(root);
  mkdirSync(join(root, 'safety'), { recursive: true });
  mkdirSync(join(root, 'core', 'state'), { recursive: true });
  writeFileSync(join(root, 'safety', 'safety_plan.md'), plan);
  if (notes !== undefined) writeFileSync(join(root, 'core', 'state', 'setup_notes.md'), notes);
  return spawnSync(process.execPath, [check], { env: { ...process.env, DEAR_DATA: root }, encoding: 'utf8' }).status;
};
const plan = (...lines) => `# Safety plan\n\n## If you need help right now\n\n${lines.map((l) => `- **${l}**`).join('\n')}\n`;
const abroad = plan('Testland Line: 0000 0001', 'Emergency: 0000 0004');

try {
  expect('another country\'s two lines pass when her country is recorded', copy(abroad, '# Setup notes\n\n- country · Testland\n') === 0);
  expect('the same plan fails with no country recorded', copy(abroad) !== 0);
  expect('the same plan fails when Singapore is recorded', copy(abroad, '# Setup notes\n\n- country · Singapore\n') !== 0);
  expect('abroad, a single number still fails', copy(plan('Testland Line: 0000 0001'), '- country · Testland\n') !== 0);
  expect('abroad, an undialable number still fails', copy(plan('Testland Line: 0000 0001', 'Emergency: call us'), '- country · Testland\n') !== 0);
} finally {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
}
if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('\ncheck-safety test: all passed');
