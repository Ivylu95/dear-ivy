#!/usr/bin/env node
// side-by-side.mjs: the commit gate's checks run at once, and are read exactly as when
// they ran one after another (T-841, under T-822's "exact same functionality").
//   1. Two slow checks overlap, and the commit gate runs its checks through this.
//   2. Results come back in the list's order, whatever order they finish in.
//   3. Each result is what spawnSync gave for the same process: a pass, a failure with
//      both streams, a timeout, output past spawnSync's 1 MiB, and stdin closed.
//   4. No more run at once than asked.
//   5. A check marked `alone` runs after the rest, one at a time, with nothing beside it:
//      the selftest and the dialogue speed test are so marked.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { runOne, runSideBySide } from './side-by-side.mjs';
import { checksFor } from '../../../ux/lib/checks.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const dir = makeTemp('dear-side-by-side-');
const script = (name, body) => {
  const file = join(dir, `${name}.mjs`);
  writeFileSync(file, body);
  return file;
};
const sleep = (ms) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const job = (file, extra = {}) => ({ file: process.execPath, args: [file], cwd: dir, env: process.env, timeout: 10000, ...extra });
try {
  // 1. Two checks of 1.2 s each, two at a time: the second starts before the first ends.
  const slow = script('slow', `${sleep(1200)} console.log('slow done');`);
  const pair = await runSideBySide([job(slow), job(slow)], { concurrency: 2 });
  assert.ok(pair[1].started < pair[0].ended && pair[0].started < pair[1].ended, `two slow checks overlap (${JSON.stringify(pair.map(({ started, ended }) => [started, ended]))})`);
  const gate = readFileSync(join(here, '..', 'git', 'pre-commit'), 'utf8');
  assert.match(gate, /import \{ runSideBySide \} from '\.\.\/lib\/side-by-side\.mjs'/, 'the commit gate imports the side-by-side runner');
  assert.match(gate, /await runSideBySide\(jobs\)/, 'the commit gate runs its checks through it');
  assert.doesNotMatch(gate, /spawnSync\(process\.execPath, \[join\((?:snapshot|tree), script\)/, 'the commit gate no longer runs a check one at a time');

  // 2. The first finishes last, the last first: reported in the order given.
  const order = [1500, 50, 700, 0].map((ms, i) => job(script(`order-${i}`, `${sleep(ms)} console.log('check ${i}');`)));
  const ordered = await runSideBySide(order, { concurrency: 4 });
  assert.deepEqual(ordered.map((r) => r.stdout.trim()), ['check 0', 'check 1', 'check 2', 'check 3'], 'results come back in the list order');
  assert.ok(ordered[0].ended > ordered[3].ended, 'even though the first finished last');

  // 3. Each as spawnSync reports it.
  const cases = {
    pass: [script('pass', `console.log('fine'); console.error('a note');`)],
    fail: [script('fail', `console.log('out line'); console.error('FAIL a case'); process.exitCode = 3;`)],
    utf8: [script('utf8', `process.stdout.write('é'.repeat(70000) + ' — done');`)],
    stdin: [script('stdin', `let s = ''; for await (const c of process.stdin) s += c; console.log('stdin', JSON.stringify(s));`)],
    timeout: [script('timeout', sleep(5000)), 400],
    flood: [script('flood', `process.stdout.write('x'.repeat(2 * 1024 * 1024)); ${sleep(2000)}`)],
    crash: [script('crash', `throw new Error('boom');`)],
  };
  // Past 1 MiB, spawnSync itself keeps a varying amount (whole 64 KiB reads), and the gate
  // shows none of it: a check stopped so reads "did not finish". So that case compares the rest.
  const shape = (r, name) => ({ status: r.status, signal: r.signal, stdout: name === 'flood' ? '(not compared)' : r.stdout, stderr: r.stderr.replace(/\n\s+at .*/g, ''), error: r.error?.code ?? null });
  const asRun = await runSideBySide(Object.values(cases).map(([file, timeout = 10000]) => job(file, { timeout })), { concurrency: 4 });
  Object.entries(cases).forEach(([name, [file, timeout = 10000]], i) => {
    const sync = spawnSync(process.execPath, [file], { cwd: dir, env: process.env, encoding: 'utf8', timeout });
    assert.deepEqual(shape(asRun[i], name), shape(sync, name), `${name}: the same result as spawnSync`);
  });
  assert.equal(asRun[3].stdout.trim(), 'stdin ""', 'stdin is closed and empty, as spawnSync leaves it');
  assert.equal(asRun[4].error.code, 'ETIMEDOUT', 'a check past its limit is killed and says so');
  assert.equal(asRun[5].signal, 'SIGTERM', 'output past 1 MiB stops the check, as spawnSync does');
  assert.ok(asRun[5].stdout.length >= 1024 * 1024 && asRun[5].stdout.length < 2 * 1024 * 1024, 'keeping at least the first MiB, as spawnSync does');
  assert.equal(asRun[1].status, 3, 'a failing check keeps its exit code');
  const single = await runOne(process.execPath, [cases.fail[0]], { cwd: dir, env: process.env, timeout: 10000 });
  assert.equal(single.stderr.trim(), 'FAIL a case', 'both streams are kept');

  // 4. Six checks, two at a time: never three running.
  const log = join(dir, 'running.log');
  writeFileSync(log, '');
  const counted = script('counted', `import { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(log)}, '+\\n'); ${sleep(250)} appendFileSync(${JSON.stringify(log)}, '-\\n');`);
  await runSideBySide(Array.from({ length: 6 }, () => job(counted)), { concurrency: 2 });
  let now = 0;
  let most = 0;
  for (const mark of readFileSync(log, 'utf8').trim().split('\n')) {
    now += mark === '+' ? 1 : -1;
    most = Math.max(most, now);
  }
  assert.equal(most, 2, `no more than two at once (${most})`);

  // 5. Two side by side, two alone: the alone ones start after both others end, one after the other.
  const mixed = await runSideBySide([job(slow), job(slow, { alone: true }), job(slow), job(slow, { alone: true })], { concurrency: 4 });
  const poolEnd = Math.max(mixed[0].ended, mixed[2].ended);
  assert.ok(mixed[0].started < mixed[2].ended && mixed[2].started < mixed[0].ended, 'the others still run side by side');
  assert.ok(mixed[1].started >= poolEnd && mixed[3].started >= poolEnd, 'an alone check starts only once the others are done');
  assert.ok(mixed[3].started >= mixed[1].ended, 'and the alone checks run one at a time, in the list order');
  assert.ok(mixed.every((r) => r.stdout.trim() === 'slow done'), 'each reported in its place');
  assert.match(gate, /\balone,\s*\n\s*\}\);/, 'the commit gate passes each check its `alone`');
  const gateChecks = checksFor('gate');
  for (const name of ['hooks selftest', 'dialogue speed test']) assert.equal(gateChecks.find((c) => c.name === name)?.alone, true, `${name} runs alone at the gate`);
  console.log('side by side test: checks overlap, report in the list order, and each result is the one spawnSync gave; the selftest and the speed test run alone');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
