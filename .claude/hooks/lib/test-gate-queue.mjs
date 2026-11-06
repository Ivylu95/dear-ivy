#!/usr/bin/env node
// gate-queue.mjs: one full commit gate at a time on a machine. Two holders never
// overlap, a dead holder is taken over, and a waiter past its limit goes ahead.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { stale, waitTurn } from './gate-queue.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const dir = makeTemp('dear-gate-queue-');
try {
  const lockDir = join(dir, 'gate.lock');
  // Two processes started together: each holds the turn 1.5 s and logs start and end.
  const log = join(dir, 'log.txt');
  writeFileSync(log, '');
  const holder = (name) => `
    import { waitTurn } from ${JSON.stringify(pathToFileURL(join(here, 'gate-queue.mjs')).href)};
    import { appendFileSync } from 'node:fs';
    const t = waitTurn({ lockDir: ${JSON.stringify(lockDir)}, poll: 100 });
    appendFileSync(${JSON.stringify(log)}, '${name} start ' + Date.now() + '\\n');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    appendFileSync(${JSON.stringify(log)}, '${name} end ' + Date.now() + '\\n');
    t.release();`;
  const run = (name) => new Promise((done) => spawn(process.execPath, ['--input-type=module', '-e', holder(name)], { stdio: 'inherit' }).on('exit', done));
  const codes = await Promise.all([run('a'), run('b')]);
  assert.deepEqual(codes, [0, 0], 'both commits got their turn');
  const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => l.split(' '));
  assert.equal(lines.length, 4, 'both started and ended');
  assert.equal(lines[0][0], lines[1][0], 'the first holder ended before the second started: they never overlapped');
  assert.ok(Number(lines[2][2]) >= Number(lines[1][2]), 'the second started only after the first ended');
  assert.ok(!existsSync(lockDir), 'the turn is released after both');

  // A holder that died is taken over at once.
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: 2147483646, at: Date.now() }));
  const t = waitTurn({ lockDir, poll: 50, waitMs: 2000 });
  assert.equal(t.wentAhead, false, 'a dead holder is taken over, not waited out');
  t.release();

  // A live holder past the wait limit: the waiter goes ahead and says so.
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, at: Date.now() }));
  const late = waitTurn({ lockDir, poll: 50, waitMs: 300 });
  assert.equal(late.wentAhead, true, 'past the wait limit it goes ahead, and the checks decide');
  rmSync(lockDir, { recursive: true, force: true });

  assert.equal(stale({ pid: process.pid, at: Date.now() }), false, 'a live, recent holder is not stale');
  assert.equal(stale({ pid: process.pid, at: Date.now() - 26 * 60 * 1000 }), true, 'one held past 25 minutes is');
  assert.equal(stale(null), true, 'no owner record is');
  console.log('gate queue test: two commits never overlap, a dead holder is taken over, a waiter past its limit goes ahead');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
