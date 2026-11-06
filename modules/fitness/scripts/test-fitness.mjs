#!/usr/bin/env node
// Rule test for the training log reader (card A-132): estimated maxes, unreadable rows named,
// sessions in order, and protein per kilogram from the latest weigh-in.

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { e1rm, owed, readLog, summarise, week } from './fitness.mjs';
import { makeTemp } from '../../../.claude/hooks/lib/temp-litter.mjs';

// The estimate: a true single is the max; reps left count; unknown reps left count as none.
assert.equal(e1rm(100, 1, 0), 100, 'a single with nothing left is the max itself');
assert.equal(e1rm(100, 1), 100, 'a single with reps left unknown is the max itself');
assert.equal(e1rm(150, 5, 0), 175, 'Epley: 150 × 5 is about 175');
assert.ok(e1rm(150, 5, 2) > e1rm(150, 5, 0), 'an easy 5 counts for more than a grinding 5');
assert.equal(e1rm(100, 1, 2), 110, 'a single with 2 left counts as a triple');
assert.equal(e1rm(0, 5), null, 'no weight, no estimate');
assert.equal(e1rm(100, 0), null, 'no reps, no estimate');

const log = (sets, weights = '') => `# Fitness\n\n## Sets\n\n| Date | Lift | kg | Reps | Left | Note |\n|---|---|---|---|---|---|\n${sets}\n## Bodyweight\n\n| Date | kg | Note |\n|---|---|---|\n${weights}\n## Log\n`;
const good = readLog(log('| 2026-03-02 | Squat | 95 | 1 | | |\n| 2026-03-02 | Squat | 100 | 1 | 0 | |\n| 2026-03-02 | Squat | 80 | 2 | 0 | |\n| 2026-03-09 | Squat | 90 | 3 | 2 | |\n', '| 2026-03-03 | 70 | |\n| 2026-03-10 | 62.5 | |\n'));
assert.deepEqual(good.faults, [], 'a clean log has no faults');
assert.equal(good.sets.length, 4);
const s = summarise(good, 100);
assert.equal(s.lifts[0].best.e1rm, 105, 'the best estimate comes from the easy triple');
assert.deepEqual(s.lifts[0].sessions.map((x) => x.date), ['2026-03-02', '2026-03-09'], 'one point per session, in date order');
assert.equal(s.lifts[0].sessions[0].e1rm, 100, 'a session counts its best set');
assert.equal(s.bodyweight.kg, 62.5, 'the latest weigh-in is used');
assert.equal(s.proteinPerKg, 1.6, '100 g at 62.5 kg is about 1.6 g per kg');
assert.equal(summarise(readLog(log('')), 150).proteinPerKg, null, 'no weigh-in, no per-kg figure');

// Stress: every kind of unreadable row is named, and none is counted.
for (const [row, what] of [
  ['| 28 Oct | Squat | 100 | 1 | 0 | |', 'a date not YYYY-MM-DD'],
  ['| 2026-03-02 |  | 100 | 1 | 0 | |', 'no lift'],
  ['| 2026-03-02 | Squat | heavy | 1 | 0 | |', 'a weight in words'],
  ['| 2026-03-02 | Squat | -5 | 1 | 0 | |', 'a negative weight'],
  ['| 2026-03-02 | Squat | 100 | 0 | 0 | |', 'no reps'],
  ['| 2026-03-02 | Squat | 100 | 2.5 | 0 | |', 'half a rep'],
  ['| 2026-03-02 | Squat | 100 | 40 | 0 | |', 'forty reps'],
  ['| 2026-03-02 | Squat | 100 | 1 | 12 | |', 'twelve reps left'],
  ['| 2026-03-02 | Squat | 100 | 1 | lots | |', 'reps left in words'],
]) {
  const r = readLog(log(`${row}\n`));
  assert.equal(r.faults.length, 1, `${what} is named`);
  assert.equal(r.sets.length, 0, `${what} is not counted`);
}
for (const [row, what] of [['| yesterday | 70 | |', 'a weigh-in with no date'], ['| 2026-03-03 | 700 | |', 'a bodyweight of 700 kg'], ['| 2026-03-03 | ? | |', 'a bodyweight not given']]) {
  assert.equal(readLog(log('', `${row}\n`)).faults.length, 1, `${what} is named`);
}
assert.equal(readLog(log('| 2026-03-02 | Squat | 100 | 1 | ? | |\n')).faults.length, 0, '"?" for reps left reads as not known');
assert.equal(readLog(log('| 2026-03-02 | Squat | ~100 kg | 1 | | |\n')).sets[0].kg, 100, 'a weight written "~100 kg" still reads');
assert.deepEqual(readLog('# Fitness\n\nNo tables yet.\n'), { sets: [], weights: [], recovery: [], machines: [], faults: [] }, 'a log with no tables is empty, not broken');

// Recovery (card A-154): a day a line, her words kept, a week read back.
const rec = (rows) => `# Fitness\n\n## Recovery\n\n| Date | Sleep h | Soreness | Energy | Note |\n|---|---|---|---|---|\n${rows}\n## Log\n`;
const r7 = readLog(rec('| 2030-03-04 | 8 | | | |\n| 2030-03-08 | | a bit sore | | shoulders, after a swim |\n| 2030-03-10 | 5.5 | | | "five and a bit, woke early" |\n| 2030-03-11 | 7.5 | | good | |\n'));
assert.deepEqual(r7.faults, [], 'a clean recovery table has no faults');
assert.equal(r7.recovery[1].sleep, null, 'sleep not given stays blank, never filled in');
assert.equal(r7.recovery[1].soreness, 'a bit sore', 'soreness is kept in her words');
const wk = week(r7.recovery, '2030-03-11');
assert.equal(wk.days, 3, 'only the last seven days are read (4 Mar is outside)');
assert.equal(wk.nights, 2, 'a day with no sleep given is not counted as a night');
assert.equal(wk.averageSleep, 6.5, 'average of 5.5 and 7.5, to one place');
assert.deepEqual(wk.shortNights, ['2030-03-10'], 'a night under 6 hours is named');
assert.deepEqual(wk.sore.map((x) => x.date), ['2030-03-08'], 'the sore day is named');
assert.equal(summarise(r7, null, '2030-03-11').recovery.nights, 2, 'summary carries the week');
assert.equal(week([], '2030-03-11').averageSleep, null, 'no nights, no average');
for (const [row, what] of [
  ['| 31 Oct | 5 | | | |', 'a recovery date not YYYY-MM-DD'],
  ['| 2026-03-04 | 25 | | | |', 'twenty-five hours of sleep'],
  ['| 2026-03-04 | lots | | | |', 'sleep in words'],
  ['| 2026-03-04 | -1 | | | |', 'negative sleep'],
]) assert.equal(readLog(rec(`${row}\n`)).faults.length, 1, `${what} is named`);
assert.equal(readLog(rec('| 2026-03-04 | 5 | | | |\n| 2026-03-04 | 6 | | | |\n')).faults.length, 1, 'a second row for one day is named');
assert.equal(readLog(rec('| 2026-03-04 | ~5 | | | |\n')).recovery[0].sleep, 5, 'sleep written "~5" still reads');

// Machines and reps owed (T-777): settings kept in one place; a set told without reps asked once.
const mach = (rows) => `# Fitness\n\n## Machines\n\n| Machine | Setting | Date | Note |\n|---|---|---|---|\n${rows}`;
assert.deepEqual(readLog(mach('| Chest press | seat 4 | 2026-01-02 | wide grip |\n')).machines, [{ machine: 'Chest press', setting: 'seat 4', date: '2026-01-02', note: 'wide grip' }], 'a machine and its setting read back');
assert.equal(readLog(mach('| Chest press | | | |\n')).faults.length, 1, 'a machine with no setting is named');
assert.equal(readLog(mach('| Chest press | seat 4 | soon | |\n')).faults.length, 1, 'a machine with a bad date is named');
const day = `# Fitness\n\n## Sets\n\n| Date | Lift | kg | Reps | Left | Note |\n|---|---|---|---|---|---|\n| 2026-01-02 | Bench Press | 60 | 5 | | |\n| 2026-01-02 | Lat Pulldown Machine | 40 | 10 | | |\n\n## Log\n\n- 2026-01-02 · Bench Press at 60 kg, her words: "x". Reps not given yet, so not in the Sets table.\n- 2026-01-02 · Bench Press at 75 kg, her words: "y". Reps not given, so not in the Sets table.\n- 2026-01-02 · Lat Pulldown Machine, seat 2, her words: "z". Weight, reps and sets not given yet.\n- 2026-01-02 · Leg curls, her words: "w". Weight and number of sets not given yet.\n- 2026-01-03 · Lunge at 20 kg. Reps not given.\n`;
assert.deepEqual(owed(day, '2026-01-02'), ['Bench Press at 75 kg'], 'only the set no row covers is owed: same lift and weight, or same lift where no weight is said');
assert.deepEqual(owed(day, '2026-01-04'), [], 'a day with nothing owed asks nothing');

// The command: check fails on a bad row, summary names the best.
const dir = makeTemp('fitness-');
mkdirSync(join(dir, 'fitness'), { recursive: true });
const run = (...a) => spawnSync(process.execPath, [new URL('./fitness.mjs', import.meta.url).pathname, ...a, '--record', dir], { encoding: 'utf8' });
writeFileSync(join(dir, 'fitness', 'training.md'), log('| 2026-03-02 | Squat | 100 | 1 | 0 | |\n| bad | Squat | 100 | 1 | 0 | |\n'));
assert.equal(run('check').status, 1, 'check fails on an unreadable row');
writeFileSync(join(dir, 'fitness', 'training.md'), log('| 2026-03-02 | Squat | 100 | 1 | 0 | |\n'));
assert.equal(run('check').status, 0, 'check passes a clean log');
assert.match(run('summary').stdout, /Squat: best estimated max 100 kg/, 'summary names the best');
assert.match(run('summary').stdout, /recovery: nothing logged in the last seven days/, 'summary says when no recovery is logged');

console.log('fitness test: estimates, sessions, per-kg protein and 12 kinds of unreadable row, and a week of recovery with 5 more, all hold');
