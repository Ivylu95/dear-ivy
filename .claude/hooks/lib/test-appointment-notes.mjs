#!/usr/bin/env node
// What she meant to tell her therapist comes up before the appointment, not only
// when she mentions it (T-330's edge cases; lib/opening.mjs). Made-up
// dates and items in throwaway folders, never her record.
//
// Run: node .claude/hooks/lib/test-appointment-notes.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appointmentNotes as fromTexts, calendarAppointments, googleAppointments, notesForTherapist } from './opening.mjs';
import { makeTemp } from './temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const dir = makeTemp('appointment-notes-');
const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const LOOPS = `# Open loops

## Raise next session

- [ ] the invented thread about the garden

## Before her next appointment

- [ ] "I keep waking at four and I never said so"
- [x] the sleep diary, already raised
- [ ]

## Cold
`;
const calendar = (rows) => `# Calendar

## Coming up

| Date | What | Notes |
|---|---|---|
${rows.map(([d, w]) => `| ${d} | ${w} |  |`).join('\n')}

## Recurring — the hard ones

| Date (DD Mon) | What | How she wants it handled |
|---|---|---|
| 03 Nov | therapy anniversary, invented |  |
`;
const text = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};
// As the session brief calls it: the three files of a record folder, read.
const appointmentNotes = (rec, today, timeZone = 'UTC') =>
  fromTexts({ loops: text(join(rec, 'core/state/open_loops.md')), calendar: text(join(rec, 'core/calendar/calendar.md')), google: text(join(rec, 'core/calendar/google.json')), today, timeZone });
const day = (base, n) => new Date(Date.parse(`${base}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

try {
  check('only the open items under "Before her next appointment", as written', JSON.stringify(notesForTherapist(LOOPS)) === JSON.stringify(['"I keep waking at four and I never said so"']));
  check('an empty template holds no item', notesForTherapist('## Before her next appointment\n\n- [ ]\n').length === 0);
  const rows = calendarAppointments(calendar([['2030-03-04', 'Therapy with the invented clinic'], ['2030-03-05', 'Dentist'], ['2030-03-06', 'Psychiatrist review']]));
  check('the "Coming up" rows that are clinical, never a recurring one or a dentist', rows.map((r) => r.date).join(',') === '2030-03-04,2030-03-06');
  const copy = JSON.stringify({ events: [
    { start: '2030-03-04T17:30:00Z', end: '2030-03-04T18:30:00Z', all_day: false, title: 'Counselling', calendar: 'Personal' },
    { start: '2030-03-04', end: '2030-03-05', all_day: true, title: 'Lunch', calendar: 'Personal' },
  ] });
  const g = googleAppointments(copy, 'Asia/Singapore');
  check('a timed event is dated in her timezone (17:30 UTC is the next day in Singapore)', g.length === 1 && g[0].date === '2030-03-05');
  check('an unreadable copy is no appointment, never a throw', googleAppointments('{not json', 'UTC').length === 0);

  // The record, end to end.
  const rec = join(dir, 'record');
  put(rec, 'core/state/open_loops.md', LOOPS);
  put(rec, 'core/calendar/calendar.md', calendar([['2030-03-04', 'Therapy']]));
  check('the day before: tomorrow, with the items', JSON.stringify(appointmentNotes(rec, '2030-03-03')) === JSON.stringify({ date: '2030-03-04', when: 'tomorrow', items: ['"I keep waking at four and I never said so"'] }));
  check('the day of: today', appointmentNotes(rec, '2030-03-04')?.when === 'today');
  check('two days before: nothing yet', appointmentNotes(rec, '2030-03-02') === null);
  check('the day after: nothing', appointmentNotes(rec, '2030-03-05') === null);
  check('a date not given is nothing, never a guess', appointmentNotes(rec, undefined) === null);
  put(rec, 'core/calendar/calendar.md', calendar([['2030-03-10', 'Therapy']]));
  put(rec, 'core/calendar/google.json', JSON.stringify({ events: [{ start: '2030-03-04T01:00:00Z', end: '2030-03-04T02:00:00Z', all_day: false, title: 'Therapist', calendar: 'Personal' }] }));
  check('found in her Google Calendar copy when calendar.md has none near', appointmentNotes(rec, '2030-03-04', 'UTC')?.when === 'today');
  put(rec, 'core/state/open_loops.md', LOOPS.replace(/- \[ \] "I keep[^\n]*\n/, ''));
  check('nothing waiting: nothing to raise, appointment or not', appointmentNotes(rec, '2030-03-04', 'UTC') === null);
  put(rec, 'core/state/open_loops.md', LOOPS);

  // The check-in's plan carries the day and a count only, never her words (SFG-012).
  const data = join(dir, 'copy', 'data');
  put(data, 'core/state/open_loops.md', LOOPS);
  put(data, 'core/calendar/check-ins.json', JSON.stringify({ timezone: 'UTC', send: 'routine', check_ins: [{ id: 'morning', text: 'Morning update', cron: '* * * * *', set: '2026-01-01' }] }));
  const reminders = join(here, '..', '..', '..', 'ux', 'scripts', 'reminders.mjs');
  const sendDue = () => spawnSync(process.execPath, [reminders, 'send-due', '--kind', 'check-ins', '--record', data], { encoding: 'utf8' }).stdout ?? '';
  // Her today is the plan's own (her timezone, whatever this machine's is).
  let today = '';
  try {
    today = JSON.parse(sendDue()).through.slice(0, 10);
  } catch {}
  check('the plan names her today', /^\d{4}-\d{2}-\d{2}$/.test(today));
  put(data, 'core/calendar/calendar.md', calendar([[day(today, 1), 'Therapy']]));
  const out = sendDue();
  let plan = {};
  try {
    plan = JSON.parse(out);
  } catch {}
  check('the check-in plan says a note waits for tomorrow, with a count', plan.appointment?.when === 'tomorrow' && plan.appointment?.waiting === 1);
  check('and never carries what she wrote', !out.includes('waking at four'));
  put(data, 'core/calendar/calendar.md', calendar([[day(today, 3), 'Therapy']]));
  const later = sendDue();
  check('three days out, the plan says nothing of it', !/"appointment"/.test(later));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\nappointment notes: ${failed} case(s) failed`);
  process.exit(1);
}
console.log('appointment notes: all cases hold');
