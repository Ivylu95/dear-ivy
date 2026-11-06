// A-093: her Google Calendar is kept as a read-only copy in her record, refreshed
// through the connector, and read by the check-in and every session.
//
//   node ux/scripts/test-google-calendar.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalise, render } from './google-calendar.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const SG = 'Asia/Singapore';
const results = [
  { summary: 'Personal', events: [
    { start: { dateTime: '2026-10-31T11:00:00+08:00' }, end: { dateTime: '2026-10-31T12:00:00+08:00' }, status: 'confirmed', summary: 'Appointment', description: 'private notes', attendees: [{ email: 'someone@example.com' }] },
    { start: { date: '2026-11-07T00:00:00Z' }, end: { date: '2026-11-08T00:00:00Z' }, status: 'confirmed', summary: 'Pay bills' },
    { start: { dateTime: '2026-10-27T09:00:00+08:00' }, end: { dateTime: '2026-10-27T10:00:00+08:00' }, status: 'cancelled', summary: 'Called off' },
  ] },
  { summary: 'Personal', events: [{ start: { dateTime: '2026-10-31T11:00:00+08:00' }, end: { dateTime: '2026-10-31T12:00:00+08:00' }, summary: 'Appointment' }] },
  { summary: 'Birthdays (Family)', events: [{ start: { date: '2026-10-27' }, end: { date: '2026-10-28' }, summary: 'A birthday' }] },
];
const events = normalise(results);
check('keeps each event once, in order, cancelled ones left out', events.map((e) => e.title).join('|') === 'A birthday|Appointment|Pay bills');
check('keeps no description, attendee, link or id', !JSON.stringify(events).match(/private notes|someone@|htmlLink|"id"/));
check('an all-day event is marked all day', events.find((e) => e.title === 'Pay bills').all_day === true);

const now = Date.parse('2026-10-27T01:00:00Z'); // 9am in Singapore
const lines = render({ events }, now, SG, 14);
check('today, then later days, in her timezone', lines[0] === 'Today · all day · A birthday (Birthdays (Family))' && lines[1] === 'Sat 31 Oct · 11:00 · Appointment');
check('an event past the window is left out', render({ events }, now, SG, 3).length === 1);
check('an event already over is left out', !render({ events }, Date.parse('2026-11-08T05:00:00Z'), SG, 14).some((l) => /Appointment|Pay bills/.test(l)));

// The command line: save from stdin, stale and show.
const root = makeTemp('gcal-');
const dir = join(root, 'data');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'PROFILE.yaml'), 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
const script = new URL('./google-calendar.mjs', import.meta.url).pathname;
const run = (args, input) => spawnSync(process.execPath, [script, ...args, '--record', dir], { input, encoding: 'utf8' });
check('no copy yet reads as stale', run(['stale']).stdout.trim() === 'stale');
check('save keeps the events it was given', /3 event\(s\) kept/.test(run(['save'], JSON.stringify(results)).stdout));
check('a copy just saved is fresh', run(['stale']).stdout.trim() === 'fresh');
const kept = JSON.parse(readFileSync(join(dir, 'core', 'calendar', 'google.json'), 'utf8'));
check('the copy says it is read-only and when it was taken', /Read-only/.test(kept._what) && !Number.isNaN(Date.parse(kept.synced_at)));
const before = readFileSync(join(dir, 'core', 'calendar', 'google.json'), 'utf8');
check('input that is not JSON leaves the copy unchanged', run(['save'], 'not json').status === 1 && readFileSync(join(dir, 'core', 'calendar', 'google.json'), 'utf8') === before);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
