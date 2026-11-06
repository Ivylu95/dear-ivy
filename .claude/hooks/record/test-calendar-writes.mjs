// A-121: her calendar is written only in a chat, never with a guest, never by a
// run with no one present, never an invitation answered for her.
//
//   node .claude/hooks/record/test-calendar-writes.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeTemp } from '../lib/temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const dir = makeTemp('cal-guard-');
const transcript = (first) => {
  const p = join(dir, `${Math.random().toString(36).slice(2)}.jsonl`);
  writeFileSync(p, `${JSON.stringify({ type: 'user', message: { role: 'user', content: first } })}\n`);
  return p;
};
const chat = transcript('put dinner on Friday at 7 in my calendar');
const run = transcript('You run unattended, with no one present. Open .claude/heartbeats.json in this repository and do exactly what the prompt of its orchestrator entry says.');
const hook = new URL('./guard-calendar-writes.mjs', import.meta.url).pathname;
const decide = (tool, args, path = chat) => {
  const out = spawnSync(process.execPath, [hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: `mcp__Google_Calendar__${tool}`, tool_input: args, transcript_path: path }), encoding: 'utf8' }).stdout;
  return /"permissionDecision":"deny"/.test(out) ? 'deny' : 'allow';
};
const dinner = { summary: 'Dinner', startTime: '2026-10-30T19:00:00', endTime: '2026-10-30T21:00:00' };

check('a plain event in a chat is let through', decide('create_event', dinner) === 'allow');
check('an event with a guest is refused', decide('create_event', { ...dinner, attendees: [{ email: 'a@example.com' }] }) === 'deny');
check('an event with a guest by the old field is refused', decide('create_event', { ...dinner, attendeeEmails: ['a@example.com'] }) === 'deny');
check('adding a guest to an event is refused', decide('update_event', { eventId: 'x', addedAttendees: [{ email: 'a@example.com' }], notificationLevel: 'NONE' }) === 'deny');
check('a change that would email guests is refused', decide('update_event', { eventId: 'x', startTime: '2026-10-30T20:00:00' }) === 'deny');
check('a change with no email is let through', decide('update_event', { eventId: 'x', startTime: '2026-10-30T20:00:00', notificationLevel: 'NONE' }) === 'allow');
check('a cancellation that would email guests is refused', decide('delete_event', { eventId: 'x' }) === 'deny');
check('a cancellation with no email is let through', decide('delete_event', { eventId: 'x', notificationLevel: 'NONE' }) === 'allow');
check('answering an invitation is refused', decide('respond_to_event', { eventId: 'x', responseStatus: 'accepted' }) === 'deny');
check('any write from the heartbeat is refused', decide('create_event', dinner, run) === 'deny' && decide('delete_event', { eventId: 'x' }, run) === 'deny');
check('reading is never stopped', decide('list_events', {}, run) === 'allow');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
