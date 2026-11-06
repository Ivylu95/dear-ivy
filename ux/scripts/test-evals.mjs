#!/usr/bin/env node
// The eval runner (WKB-007, D49), proven on invented cards: an answer from none
// of the closed sets, an unknown agreement, aspect or persona, a command that is
// not `node <existing file>`, and a runnable card with nothing to run each fail
// `check`; a good card passes. `coverage` names an agreement with no card;
// `regressions` finds a card that passed and now fails; `lastAllPass` skips a
// failed or dirty run; `runCard` grades by exit status against the pass mark,
// and the runner's exit 2 (could not run) as not run, never a fail.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVALS, NOT_RUN, cardFaults, coverage, lastAllPass, latest, oldestPersonas, parseFront, readCards, readPersonas, regressions, runCard, actsAsPerson, modelChange, runnable, staleCards, testHash } from './evals.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { DEV_DIR } from '../../.claude/hooks/lib/paths.mjs';

const dir = makeTemp('dear-evals-test-');
const good = {
  id: 'E-001', file: 'E-001.md', title: 't', why: ['A-001', 'safe'], what: 'system', where: 'code', who_acts: 'nobody',
  who_grades: 'code', when: 'before-landing', how: 'exact', runs: '1', pass_mark: '1', command: 'node ok.mjs', status: 'runnable',
};
const ctx = { agreements: ['A-001', 'A-002'], personas: ['P-01'], root: dir };
const faults = (over) => cardFaults({ ...good, ...over }, ctx);

try {
  writeFileSync(join(dir, 'ok.mjs'), 'process.exit(0)\n');
  writeFileSync(join(dir, 'bad.mjs'), 'console.error("broken"); process.exit(1)\n');
  writeFileSync(join(dir, 'cannot.mjs'), 'console.error("runner: no claude command here"); process.exit(2)\n');

  // The frontmatter reads as the cards write it.
  assert.deepEqual(parseFront('---\nid: E-009\nwhy: [A-001, safe]\n---\n# x\n'), { id: 'E-009', why: ['A-001', 'safe'] });

  // check: the good card passes; each bad answer fails.
  assert.deepEqual(faults({}), [], 'a good card passes');
  assert.equal(faults({ what: 'everything' }).length, 1, 'a What from none of the four fails');
  assert.equal(faults({ how: 'must' }).length, 1, 'a How from none of the four fails');
  assert.ok(faults({ who_grades: 'vibes' }).length >= 1, 'a grader from none of the three fails');
  assert.equal(faults({ why: ['A-099', 'safe'] }).length, 1, 'an agreement that does not exist fails');
  assert.equal(faults({ why: ['safe'] }).length, 1, 'a card protecting no agreement fails');
  assert.equal(faults({ why: ['A-001', 'speedy'] }).length, 1, 'an aspect none of the fourteen fails');
  assert.equal(faults({ who_acts: 'persona' }).length, 1, 'a persona acting with none named fails');
  assert.deepEqual(faults({ who_acts: 'persona', persona: 'P-01' }), [], 'a persona acting, named, passes');
  assert.equal(faults({ command: 'bash -c "rm -rf x"' }).length, 1, 'a command that is not node fails');
  assert.equal(faults({ command: 'node ../outside.mjs' }).length, 1, 'a script outside the repository fails');
  assert.equal(faults({ command: 'node missing.mjs' }).length, 1, 'a script that does not exist fails');
  assert.equal(faults({ command: undefined }).length, 1, 'runnable with no command fails');
  assert.deepEqual(faults({ command: undefined, status: 'not-runnable-yet', who_grades: 'judge', blocked_by: 'needs the owner, from real use' }), [], 'a judged card, not runnable yet, saying what blocks it, passes');
  // T-273: written is not running, so a card that cannot run says in one line what it waits on.
  assert.equal(faults({ command: undefined, status: 'not-runnable-yet', who_grades: 'judge' }).length, 1, 'a card not runnable yet with no blocked_by fails');
  assert.equal(faults({ blocked_by: 'an account' }).length, 1, 'a runnable card naming a blocker fails');
  assert.ok(runnable({ status: 'runnable' }) && !runnable({ status: 'not-runnable-yet' }), 'runnable tells a card that can run from one that cannot');
  assert.equal(faults({ who_grades: 'judge' }).length, 1, 'a judge grading any command but its runner fails');
  mkdirSync(join(dir, 'dev', 'evals', 'scenarios'), { recursive: true });
  writeFileSync(join(dir, 'dev', 'evals', 'runner.mjs'), 'process.exit(0)\n');
  const judged = { who_grades: 'judge', command: 'node dev/evals/runner.mjs E-001' };
  assert.equal(faults(judged).length, 1, 'a judged card with no scenario fails');
  writeFileSync(join(dir, 'dev', 'evals', 'scenarios', 'E-001.json'), '{"turns":["hi"]}\n');
  assert.deepEqual(faults(judged), [], 'a judged card naming its runner and scenario passes');
  assert.equal(faults({ ...judged, command: 'node dev/evals/runner.mjs E-002' }).length, 1, 'a judged card running another card fails');
  assert.equal(faults({ pass_mark: '2' }).length, 1, 'a pass mark above 1 fails');
  assert.equal(faults({ runs: '0' }).length, 1, 'zero runs fails');
  assert.equal(faults({ colour: 'red' }).length, 1, 'a field no card has fails');
  assert.equal(faults({ file: 'E-002.md' }).length, 1, 'a file not named after its id fails');

  // runCard: graded by exit status, against the pass mark.
  assert.equal(runCard({ ...good }, dir).verdict, 'pass', 'exit 0 passes');
  const failed = runCard({ ...good, command: 'node bad.mjs', runs: '2' }, dir);
  assert.equal(failed.verdict, 'fail', 'exit 1 fails');
  assert.equal(failed.runs, 2, 'it runs as many times as the card says');
  assert.match(failed.out, /broken/, 'a failure keeps what it printed');
  // The runner's exit 2 is "could not run": nothing was graded, so it is not a fail.
  const cannot = runCard({ ...good, command: 'node cannot.mjs', runs: '2' }, dir);
  assert.equal(cannot.verdict, NOT_RUN, 'exit 2 on every try is not run, not a fail');
  assert.equal(cannot.runs, 0, 'a try that could not run is not counted as run');
  assert.match(cannot.out, /no claude/, 'not run keeps what it printed, to say why');

  // coverage: an agreement with no card is named; one with only unrunnable cards is on paper.
  const g = coverage([{ ...good }, { ...good, id: 'E-002', why: ['A-002', 'safe'], status: 'not-runnable-yet' }], ['A-001', 'A-002', 'A-003']);
  assert.deepEqual(g.unprotected, ['A-003'], 'an agreement with no card is named');
  assert.deepEqual(g.onPaper, ['A-002'], 'an agreement whose cards cannot run is on paper');
  assert.ok(g.combos.some((c) => c.name.startsWith('drift') && !c.any), 'a combination no card covers is listed');

  // History: drift and the last all-pass.
  const card = (c, verdict) => ({ kind: 'card', card: c, verdict });
  assert.deepEqual(regressions([card('E-001', 'pass'), card('E-002', 'fail'), card('E-001', 'fail'), card('E-002', 'fail')]), ['E-001'], 'passed then failed is drift; failing twice is not');
  assert.deepEqual(regressions([card('E-001', 'fail'), card('E-001', 'pass')]), [], 'a fix is not drift');
  assert.deepEqual(regressions([card('E-001', 'pass'), card('E-001', NOT_RUN)]), [], 'passed, then could not run, is not drift');
  assert.deepEqual(regressions([card('E-001', 'pass'), card('E-001', NOT_RUN), card('E-001', 'fail')]), ['E-001'], 'drift is read across a run that could not run');
  assert.equal(latest([card('E-001', 'pass'), card('E-001', NOT_RUN)]).get('E-001').verdict, 'pass', 'the latest verdict is the last one graded');
  // A pass against a test since rewritten is no "passed before" (E-047, E-052, 2026-11-03).
  const ran = (verdict, test) => ({ ...card('E-001', verdict), test });
  assert.deepEqual(regressions([ran('pass', 'aaa'), ran('fail', 'bbb')]), [], 'a pass on the old test, a fail on the rewritten one, is not drift');
  assert.deepEqual(regressions([ran('pass', 'aaa'), ran('fail', 'aaa')]), ['E-001'], 'a pass and a fail on the same test is drift');
  assert.deepEqual(regressions([card('E-001', 'pass'), ran('fail', 'bbb')]), ['E-001'], 'a pass recorded before tests were hashed is still compared');
  assert.deepEqual(regressions([ran('pass', 'aaa'), card('E-001', 'fail')]), ['E-001'], 'a fail with no hash is still compared');
  // The hash follows the test line and the scenario, not the rest of the card.
  mkdirSync(join(dir, 'h', DEV_DIR, 'evals', 'cards'), { recursive: true });
  mkdirSync(join(dir, 'h', DEV_DIR, 'evals', 'scenarios'), { recursive: true });
  const cardAt = join(dir, 'h', DEV_DIR, 'evals', 'cards', 'E-900.md');
  writeFileSync(cardAt, '---\nid: E-900\n---\n# E-900\n\n**The test:** first.\n');
  const h1 = testHash({ id: 'E-900' }, join(dir, 'h'));
  writeFileSync(cardAt, '---\nid: E-900\n---\n# E-900 · retitled\n\n**The test:** first.\n');
  assert.equal(testHash({ id: 'E-900' }, join(dir, 'h')), h1, 'a retitled card keeps its test hash');
  writeFileSync(cardAt, '---\nid: E-900\n---\n# E-900\n\n**The test:** second.\n');
  const h2 = testHash({ id: 'E-900' }, join(dir, 'h'));
  assert.notEqual(h2, h1, 'a rewritten test line changes it');
  writeFileSync(join(dir, 'h', DEV_DIR, 'evals', 'scenarios', 'E-900.json'), '{"turns":[]}');
  assert.notEqual(testHash({ id: 'E-900' }, join(dir, 'h')), h2, 'a reseeded scenario changes it');
  const run = (commit, verdict, dirty = false) => ({ kind: 'run', scope: 'all', commit, verdict, dirty });
  assert.equal(lastAllPass([run('a1', 'pass'), run('b2', 'pass', true), run('c3', 'fail'), { ...run('d4', 'pass'), scope: 'E-001' }]).commit, 'a1', 'the last clean, whole, all-pass run');
  assert.equal(lastAllPass([run('c3', 'fail')]), null, 'no all-pass run is none');

  // Watching the watchers: a card whose last run is too old, or never ran, is named.
  const now = Date.parse('2026-01-10T00:00:00Z');
  const daily = { id: 'E-001', status: 'runnable', who_acts: 'nobody' };
  const weekly = { id: 'E-002', status: 'runnable', who_acts: 'persona' };
  const at = (id, d) => ({ kind: 'card', card: id, verdict: 'pass', date: `2026-01-${d}T00:00:00Z` });
  assert.deepEqual(staleCards([daily, weekly], [at('E-001', '09'), at('E-002', '09')], now), [], 'recent runs are not stale');
  assert.deepEqual(staleCards([daily, weekly], [at('E-001', '05'), { ...at('E-002', '01'), date: '2025-12-29T00:00:00Z' }], now).map((x) => x.id), ['E-001', 'E-002'], 'a code card 5 days old and a persona one 12 days old are stale');
  assert.deepEqual(staleCards([weekly], [at('E-002', '01')], now), [], 'a persona card 9 days old is not: it comes round about every nine days (T-340)');
  // The daily loop runs the oldest few persona cards, never-run first, so every one comes round.
  const p = (id) => ({ id, status: 'runnable', who_acts: 'persona' });
  const rot = oldestPersonas([p('E-010'), p('E-011'), p('E-012'), daily, { ...p('E-013'), status: 'not-runnable-yet' }], [at('E-010', '08'), at('E-011', '02')], 2).map((c) => c.id);
  assert.deepEqual(rot, ['E-012', 'E-011'], 'the oldest persona cards, never-run first, and only runnable persona ones');
  assert.equal(staleCards([daily], [], now)[0].age, null, 'a card never run is stale');
  assert.ok(actsAsPerson(weekly) && !actsAsPerson(daily), 'persona cards are told from code ones');

  // A model change is noticed; the same model is not.
  assert.ok(modelChange([], 'm1'), 'the first model is a change');
  assert.equal(modelChange([{ kind: 'model', model: 'm1' }], 'm1'), null, 'the same model is not');
  assert.equal(modelChange([{ kind: 'model', model: 'm1' }], 'm2').previous, 'm1', 'a new model keeps the one before');

  // The real cards and personas read.
  if (existsSync(EVALS)) assert.ok(readCards().length > 0 && readPersonas().length >= 5, 'the real cards and personas read');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('evals test: closed answers, agreements, aspects, personas, commands, grading, coverage, drift, rollback point, stale cards and model change each caught');
