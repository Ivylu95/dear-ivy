// Rule test for behaviour-snapshot.mjs (HYG-006): the lock compares what the app
// does byte for byte, ignores only when and where it ran, and refuses a changed
// line that no probe ran. Pure: no probes are run here.

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { changedLines, differences, normalise, stableDifferences, unorder, unrunLines } from './behaviour-snapshot.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('a duration or a timestamp is not behaviour', normalise('ok   12 ms done at 2026-10-18T13:08:01.883Z') === normalise('ok 9.5ms done at 2026-01-01T00:00:00Z'));
check('a changed word is behaviour', normalise('ran recently') !== normalise('ran lately'));
check('two cases of one side-by-side test swapping places is not behaviour', unorder(' ok <n>ms session/t.mjs ok case A\n ok case B') === unorder(' ok <n>ms session/t.mjs ok case B\n ok case A'));
check('a case that changed its verdict still is', unorder(' ok <n>ms session/t.mjs ok case A') !== unorder(' FAIL <n>ms session/t.mjs FAIL case A'));
// An edge-case run of 2026-10-29: the timing strip took the verdict and the name with it, so one
// test going ok to FAIL while another went FAIL to ok read as no change.
check('one test going ok to FAIL while another goes FAIL to ok is behaviour', unorder(' ok <n>ms session/a.mjs done\n FAIL <n>ms session/b.mjs done') !== unorder(' FAIL <n>ms session/a.mjs done\n ok <n>ms session/b.mjs done'));
check('only the timing comes off: the verdict and the name stay', unorder(' FAIL <n>ms session/a.mjs done').includes('FAIL session/a.mjs'));
check('two snapshots alike differ nowhere', differences({ a: { hash: '1' }, '@head': { hash: 'x' } }, { a: { hash: '1' }, '@head': { hash: 'y' } }).length === 0);
check('a probe whose output changed is named', differences({ a: { hash: '1' }, b: { hash: '2' } }, { a: { hash: '1' }, b: { hash: '3' } }).join() === 'b');
check('a probe that vanished is named', differences({ a: { hash: '1' } }, {}).join() === 'a');
const noisy = stableDifferences({ a: { hash: '1' }, n: { hash: 'x' } }, { a: { hash: '1' }, n: { hash: 'y' } }, { a: { hash: '1' }, n: { hash: 'z' } });
check('a probe that differs run to run is set aside as noise, never counted as a change', noisy.moved.length === 0 && noisy.unstable.join() === 'n');
const real = stableDifferences({ a: { hash: '1' } }, { a: { hash: '2' } }, { a: { hash: '2' } });
check('a probe that changed and holds steady is a change', real.moved.join() === 'a' && real.unstable.length === 0);

const diff = ['diff --git a/x.mjs b/x.mjs', '--- a/x.mjs', '+++ b/x.mjs', '@@ -3 +3,2 @@', '-old', '+new one', '+new two', '@@ -9,2 +10,0 @@', '-gone', '-gone'].join('\n');
const lines = changedLines(diff);
check('added and changed lines are read from the new side, a pure removal adds none', JSON.stringify(lines) === JSON.stringify({ 'x.mjs': [3, 4] }));

const src = 'a();\nif (x) {\n  b();\n}\n// note\n';
const url = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'x.mjs')).href;
const ranges = (inner) => [{ result: [{ url, functions: [{ ranges: [{ startOffset: 0, endOffset: src.length, count: 1 }, ...inner] }] }] }];
const read = () => src;
// 'b();' starts at offset 16; an inner block with count 0 around it means it never ran.
check('a line inside a block that ran passes', unrunLines({ 'x.mjs': [3] }, ranges([]), read).length === 0);
check('a line inside a block that never ran is refused', unrunLines({ 'x.mjs': [3] }, ranges([{ startOffset: 14, endOffset: 22, count: 0 }]), read).length === 1);
check('a comment line carries no behaviour and passes', unrunLines({ 'x.mjs': [5] }, [], read).length === 0);
check('a file no probe loaded is refused', unrunLines({ 'x.mjs': [1] }, [], read).join() === 'x.mjs:1');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
