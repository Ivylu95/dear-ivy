// Rule test for copyTree in temp-litter.mjs (2026-11-05): a test's copy of a live folder never fails because
// another process removed a file mid-copy, which refused a heartbeat claim (ENOENT on a state
// file while another selftest ran). A second process churns files while this one copies.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree, makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const dir = makeTemp('dear-copy-tree-');
const live = join(dir, 'live', 'hooks', 'state');
mkdirSync(live, { recursive: true });
writeFileSync(join(dir, 'live', 'hooks', 'keep.mjs'), 'export {};\n');
for (let i = 0; i < 300; i++) writeFileSync(join(live, `f${i}`), 'x');

// Another process removes and writes files in the folder being copied, as a running session does.
const churn = spawn(process.execPath, ['-e', `
  const { rmSync, writeFileSync } = require('node:fs');
  const end = Date.now() + 2500; let i = 0;
  while (Date.now() < end) { rmSync(${JSON.stringify(live)} + '/f' + (i % 300), { force: true }); writeFileSync(${JSON.stringify(live)} + '/f' + ((i + 150) % 300), 'y'); i++; }
`], { stdio: 'ignore' });

let threw = null;
let copies = 0;
const until = Date.now() + 2000;
while (Date.now() < until) {
  try {
    copyTree(join(dir, 'live'), join(dir, `copy${copies}`));
    copies += 1;
  } catch (err) {
    threw = err;
    break;
  }
}
await new Promise((r) => churn.on('close', r));
check(`copies a folder another process is changing, without failing (${copies} copies)`, threw === null && copies > 0);
check('every file that stayed is copied whole', readFileSync(join(dir, 'copy0', 'hooks', 'keep.mjs'), 'utf8') === 'export {};\n');
copyTree(join(dir, 'live'), join(dir, 'filtered'), { filter: (src) => !/[\\/]state$/.test(src) });
check('the filter is kept: a folder it leaves out is never copied', !existsSync(join(dir, 'filtered', 'hooks', 'state')) && existsSync(join(dir, 'filtered', 'hooks', 'keep.mjs')));
let other = null;
try {
  copyTree(join(dir, 'live', 'hooks', 'keep.mjs'), join(dir, 'live', 'hooks', 'keep.mjs', 'inside'));
} catch (err) {
  other = err;
}
check('any other failure still throws', other !== null && other.code !== 'ENOENT');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
