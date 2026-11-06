// Tonight's plan and its message (A-173, A-174): one to three native /loop prompts,
// each with its timing and its stop, nothing from her record, never permissions off;
// the message a tap-to-copy /night-shift line per loop.
//
//   node ux/scripts/test-night-loops.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { faults, facts, lastNight, message, show, until, handoverFaults } from './night-loops.mjs';

const loop = {
  what: 'Make the failing eval E-028 pass again; it broke yesterday',
  prompt: 'Run node ux/scripts/evals.mjs run E-028, find why it fails, fix it with a test. Stop the loop when it passes, or at 07:00 Singapore time, whichever comes first',
  finish: 'node ux/scripts/evals.mjs run E-028',
  start_by: '23:30',
  round: 'about 20 min',
  rounds: '3 to 6 rounds, about 2 hours',
  weight: 'medium',
};
const good = { date: '2026-11-05', loops: [loop] };
const with_ = (patch) => ({ ...good, loops: [{ ...loop, ...patch }] });

const CASES = [
  ['a good plan passes', good, []],
  ['a loop with no prompt fails', with_({ prompt: '' }), ['no prompt']],
  ['a loop with no finish check fails', with_({ finish: '' }), ['no finish']],
  ['a prompt with no stop, or no 07:00, fails', with_({ prompt: 'Run E-028 forever' }), ['07:00']],
  ['a loop without its timing fails', with_({ start_by: '', rounds: '' }), ['start_by']],
  ['a weight not light, medium or heavy fails', with_({ weight: 'huge' }), ['weight']],
  ['four loops fail', { ...good, loops: [loop, loop, loop, loop] }, ['one to three']],
  ['a path in her record fails', with_({ prompt: loop.prompt.replace('E-028,', 'data/core/now.md,') }), ['her record']],
  ['permissions switched off fails', with_({ prompt: `--dangerously-skip-permissions ${loop.prompt}` }), ['permissions']],
  ['no loops and no reason fails', { date: '2026-11-05', loops: [] }, ['no loops']],
  ['no loops with a reason passes', { date: '2026-11-05', loops: [], none: 'Nothing worth a night: all green.' }, []],
  ['not JSON fails', null, ['not JSON']],
];

let failed = 0;
for (const [what, plan, want] of CASES) {
  const got = faults(plan).join('; ');
  const ok = want.length ? want.every((w) => got.includes(w)) : got === '';
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${what}: ${got || 'no faults'}`);
  }
}
const f = facts();
if (!f.some((l) => l.startsWith('failing evals')) || f.some((l) => /\bdata\//.test(l))) {
  failed += 1;
  console.error('FAIL the facts name the failing evals and nothing in her record');
}
// T-811: last night's suggestions are handed over, so the same ones are not sent again.
const body = 'chore(heartbeats): finish run ok\n\n- night-loops · ok · nothing to land · suggested 2 loops (an eval made to pass, a fix)\n- inline · reminders 0 sent';
if (lastNight(body) !== 'night-loops · ok · nothing to land · suggested 2 loops (an eval made to pass, a fix)' || lastNight('- dev-hygiene · ok') !== 'nothing found' || !f.some((l) => l.startsWith('suggested last night: '))) {
  failed += 1;
  console.error('FAIL the facts carry what was suggested last night');
}
// A-174, A-179: the message is tonight's roster and one tap-to-copy /night-shift that clocks the
// shift in, never a prompt; /night-shift shows the list, a loop with its prompt and finish, and says
// when the plan is old; the shift clocks out at the next 07:00; a handover never names her record.
const chat = { url: 'https://claude.ai/code/session_abcdefgh1234', title: '🌙 Night Shift' };
const msg = message({ ...good, loops: [loop, { ...loop, weight: 'heavy' }] }, chat);
if (!msg.includes('<code>/night-shift</code>') || !msg.includes('2 jobs · heavy') || msg.includes(loop.prompt) || !msg.includes('<code>/night-shift 2</code>') || !msg.includes(`<a href="${chat.url}">🌙 Night Shift</a>`) || message(good, null).includes('<a href')) {
  failed += 1;
  console.error('FAIL the message is the roster and a tap-to-copy /night-shift, without the prompts, ending with the link to its chat');
}
if (until(new Date('2026-11-05T15:30:00Z')) !== '2026-11-05T23:00:00.000Z' || until(new Date('2026-11-05T23:30:00Z')) !== '2026-11-06T23:00:00.000Z') {
  failed += 1;
  console.error('FAIL the shift clocks out at the next 07:00 Singapore time');
}
if (handoverFaults('Done: E-028 passes (a1b2c3d).').length || !handoverFaults('see data/core/now.md').join().includes('her record') || !handoverFaults('').join().includes('empty')) {
  failed += 1;
  console.error('FAIL the handover is refused empty or naming her record, and sent otherwise');
}
const found = { name: '2026-11-05.json', plan: good };
const at = new Date('2026-11-05T15:30:00Z');
if (!show(found, undefined, at).includes('1 · Make the failing') || !show(found, '1', at).includes(`prompt: ${loop.prompt}`) || !show(found, '1', at).includes(`finish: ${loop.finish}`) || !show(found, 'plan', at).includes('dev/night-shift/2026-11-05.json') || !show(found, '1', at).includes('(current)') || !show(found, '1', new Date('2026-11-08T15:00:00Z')).includes('old: from 2026-11-05') || !show(found, '4', at).includes('has no loop 4') || !show(null).includes('no plan yet')) {
  failed += 1;
  console.error('FAIL /night-shift shows the list, a loop and its prompt, and says when the plan is old');
}
// Every job file with a schedule is in the run's job list, or no sweep ever runs it
// (night-loops was built without its entry on 2026-11-05 and could not be claimed).
const jobs = new URL('../../.claude/jobs/', import.meta.url);
const listed = (readFileSync(new URL('README.md', jobs), 'utf8').match(/^jobs:(.*)$/m)?.[1] ?? '').split(',').map((n) => n.trim());
const unlisted = readdirSync(jobs).filter((f) => f.endsWith('.md') && f !== 'README.md' && /^every:/m.test(readFileSync(new URL(f, jobs), 'utf8')) && /^emoji:/m.test(readFileSync(new URL(f, jobs), 'utf8'))).map((f) => f.slice(0, -3)).filter((n) => !listed.includes(n));
if (unlisted.length) {
  failed += 1;
  console.error(`FAIL scheduled jobs missing from the run's list: ${unlisted.join(', ')}`);
}
if (failed) process.exit(1);
console.log(`night loops: ${CASES.length + 7} cases hold`);
