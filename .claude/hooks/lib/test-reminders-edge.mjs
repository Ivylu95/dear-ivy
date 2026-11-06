// One hundred edge cases for her reminders and check-ins, end to end: the file's
// rules, when each schedule fires (her timezone, month ends, leap years, clock
// changes), what a sweep plans and never plans twice, and the command line a
// sweep and a chat use. Every case names the behaviour it holds.
//
//   node .claude/hooks/lib/test-reminders-edge.mjs

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readReminders, nextTimes, parseCron, parseEvery, parseLocal, zonedToUtc, localParts, formatLocal } from './reminder-schedule.mjs';
import { dueSince } from '../../../ux/scripts/reminders.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
let n = 0;
const check = (name, ok) => {
  n += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(n).padStart(3)} ${name}`);
  if (!ok) failed += 1;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const SG = 'Asia/Singapore';
const NY = 'America/New_York';
const at = (local, tz = SG) => zonedToUtc(parseLocal(local), tz);
const one = (r, tz = SG) => readReminders({ timezone: tz, reminders: [{ id: 'r', text: 't', ...r }] });
const rem = (r, tz) => one(r, tz).reminders[0];
const errs = (r, tz) => one(r, tz).errors;
const fires = (r, local, tz = SG) => Boolean(rem(r, tz)?.fires(at(local, tz)));
const next = (r, fromLocal, count = 3, tz = SG) => nextTimes(rem(r, tz), at(fromLocal, tz), count).map((ms) => formatLocal(localParts(ms, tz)));

// ── The file's rules: what is refused, and that one bad entry stops nothing else (1–25)
check('a file with no reminders list is refused', readReminders({}).errors.length === 1);
check('a list that is not an array is refused', readReminders({ reminders: {} }).errors.length === 1);
check('an entry with no id is refused', errs({ id: '' }).length === 1);
check('two entries sharing an id: the second is refused, the first kept', (() => { const x = readReminders({ timezone: SG, reminders: [{ id: 'a', text: 't', cron: '0 9 * * *' }, { id: 'a', text: 'u', cron: '0 9 * * *' }] }); return x.errors.length === 1 && x.reminders.length === 1; })());
check('an entry with no text is refused', errs({ text: '  ', at: '2026-11-01 09:00' }).length === 1);
check('text over 1,000 characters is refused', errs({ text: 'x'.repeat(1001), at: '2026-11-01 09:00' }).length === 1);
check('no schedule at all is refused', errs({}).length === 1);
check('two schedules at once is refused', errs({ at: '2026-11-01 09:00', cron: '0 9 * * *' }).length === 1);
check('a 30 February is refused', errs({ at: '2026-02-30 09:00' }).length === 1);
check('a 24:00 time is refused', errs({ at: '2026-11-01 24:00' }).length === 1);
check('a minute of 60 is refused', errs({ at: '2026-11-01 09:60' }).length === 1);
check('a one-off with a date and no time is refused', errs({ at: '2026-11-01' }).length === 1);
check('a one-off written with a T is read the same as with a space', fires({ at: '2026-11-01T09:00' }, '2026-11-01 09:00'));
check('a cron with six fields is refused', errs({ cron: '0 0 9 * * *' }).length === 1);
check('a cron with an hour of 24 is refused', errs({ cron: '0 24 * * *' }).length === 1);
check('a cron step of 0 is refused', errs({ cron: '*/0 * * * *' }).length === 1);
check('a cron range that runs backwards is refused', errs({ cron: '0 9 * * 5-1' }).length === 1);
check('an interval with an unknown unit is refused', errs({ every: '2 fortnights', start: '2026-11-01 09:00' }).length === 1);
check('an interval with no start is refused', errs({ every: '2 days' }).length === 1);
check('an interval whose start has no time is refused', errs({ every: '2 days', start: '2026-11-01' }).length === 1);
check('a window over a day is refused', errs({ at: '2026-11-01 09:00', window: 2000 }).length === 1);
check('a window that is not whole minutes is refused', errs({ at: '2026-11-01 09:00', window: 7.5 }).length === 1);
check('reads outside data/ is refused', errs({ cron: '0 9 * * *', reads: ['CLAUDE.md'] }).length === 1);
check('reads climbing out with .. is refused', errs({ cron: '0 9 * * *', reads: ['data/../CLAUDE.md'] }).length === 1);
check('an unknown timezone is refused, not a crash', readReminders({ timezone: 'Mars/Olympus', reminders: [] }).errors.length === 1);

// ── One-offs (26–37)
check('a one-off fires in its minute', fires({ at: '2026-11-01 09:00' }, '2026-11-01 09:00'));
check('a one-off fires at any second of its minute', rem({ at: '2026-11-01 09:00' }).fires(at('2026-11-01 09:00') + 59e3));
check('a one-off does not fire the minute before', !fires({ at: '2026-11-01 09:00' }, '2026-11-01 08:59'));
check('a one-off does not fire the minute after', !fires({ at: '2026-11-01 09:00' }, '2026-11-01 09:01'));
check('a one-off is read in her timezone, not UTC', rem({ at: '2026-11-01 09:00' }).fires(Date.parse('2026-11-01T01:00:00Z')));
check('a one-off at midnight fires at the start of that day', fires({ at: '2026-11-01 00:00' }, '2026-11-01 00:00'));
check('a one-off on 29 February in a leap year is accepted and fires', fires({ at: '2028-02-29 09:00' }, '2028-02-29 09:00'));
check('a one-off on 29 February in a common year is refused', errs({ at: '2027-02-29 09:00' }).length === 1);
check('a one-off already past has no next time', next({ at: '2026-11-01 09:00' }, '2026-11-02 00:00').length === 0);
check('a windowed one-off still counts as due inside its window', rem({ at: '2026-11-01 09:00', window: 60 }).fires(at('2026-11-01 09:45')));
check('a windowed one-off is not due once its window closes', !rem({ at: '2026-11-01 09:00', window: 60 }).fires(at('2026-11-01 10:00')));
check('a one-off paused never fires', !fires({ at: '2026-11-01 09:00', paused: true }, '2026-11-01 09:00'));

// ── Cron schedules (38–55)
check('a daily cron fires at its time', fires({ cron: '0 9 * * *' }, '2026-11-03 09:00'));
check('a daily cron does not fire at another minute', !fires({ cron: '0 9 * * *' }, '2026-11-03 09:01'));
check('three times a day, by a list of hours', ['12:00', '18:00', '23:00'].every((t) => fires({ cron: '0 12,18,23 * * *' }, `2026-11-03 ${t}`)));
check('a weekday name fires on that weekday only (Thu 5 Nov 2026)', fires({ cron: '0 9 * * thu' }, '2026-11-05 09:00') && !fires({ cron: '0 9 * * thu' }, '2026-11-04 09:00'));
check('day of week 7 is Sunday, as 0 is', fires({ cron: '0 9 * * 7' }, '2026-11-01 09:00'));
check('a weekday range Mon to Fri skips Saturday', fires({ cron: '30 7 * * 1-5' }, '2026-11-06 07:30') && !fires({ cron: '30 7 * * 1-5' }, '2026-11-07 07:30'));
check('every 15 minutes fires on the quarter hours', ['10:00', '10:15', '10:30', '10:45'].every((t) => fires({ cron: '*/15 * * * *' }, `2026-11-03 ${t}`)) && !fires({ cron: '*/15 * * * *' }, '2026-11-03 10:20'));
check('a step from a start value (5/20) fires at 5, 25 and 45', ['5', '25', '45'].every((m) => fires({ cron: `${m} * * * *`.replace(m, '5/20') }, `2026-11-03 10:${m.padStart(2, '0')}`)));
check('L fires on the last day of February in a common year', fires({ cron: '0 9 L * *' }, '2027-02-28 09:00'));
check('L fires on 29 February in a leap year, not the 28th', fires({ cron: '0 9 L * *' }, '2028-02-29 09:00') && !fires({ cron: '0 9 L * *' }, '2028-02-28 09:00'));
check('L fires on the 30th in a thirty-day month', fires({ cron: '0 9 L * *' }, '2026-11-30 09:00'));
check('the 31st never fires in a thirty-day month', next({ cron: '0 9 31 * *' }, '2026-11-01 00:00', 1)[0] === '2026-12-31 09:00');
check('a month name fires only in that month', fires({ cron: '0 9 1 dec *' }, '2026-12-01 09:00') && !fires({ cron: '0 9 1 dec *' }, '2026-11-01 09:00'));
check('day of month and day of week both set: either will do, as cron reads it', fires({ cron: '0 9 13 * fri' }, '2026-11-13 09:00') && fires({ cron: '0 9 13 * fri' }, '2026-11-06 09:00'));
check('a yearly date fires each year', next({ cron: '0 9 25 12 *' }, '2026-01-01 00:00', 1)[0] === '2026-12-25 09:00' && next({ cron: '0 9 25 12 *' }, '2026-12-26 00:00', 1)[0] === '2027-12-25 09:00');
check('a cron with a start fires nothing before it', !fires({ cron: '0 9 * * *', start: '2026-11-05 00:00' }, '2026-11-04 09:00') && fires({ cron: '0 9 * * *', start: '2026-11-05 00:00' }, '2026-11-05 09:00'));
check('a cron until a date alone runs through that whole day', fires({ cron: '0 23 * * *', until: '2026-11-05' }, '2026-11-05 23:00') && !fires({ cron: '0 23 * * *', until: '2026-11-05' }, '2026-11-06 23:00'));
check('a cron ended fires nothing after that day', !fires({ cron: '0 9 * * *', ended: '2026-11-04' }, '2026-11-05 09:00'));

// ── Intervals (56–65)
check('every 2 weeks fires on the start day and two weeks on', fires({ every: '2 weeks', start: '2026-11-02 09:00' }, '2026-11-02 09:00') && fires({ every: '2 weeks', start: '2026-11-02 09:00' }, '2026-11-16 09:00') && !fires({ every: '2 weeks', start: '2026-11-02 09:00' }, '2026-11-09 09:00'));
check('every 2 weeks fires nothing before its start', !fires({ every: '2 weeks', start: '2026-11-16 09:00' }, '2026-11-02 09:00'));
check('every month from the 31st falls on the last day of shorter months', next({ every: 'month', start: '2026-10-31 09:00' }, '2026-11-01 00:00', 3).join() === '2026-11-30 09:00,2026-12-31 09:00,2027-01-31 09:00');
check('every month from 31 January lands on 28 February', next({ every: '1 month', start: '2027-01-31 09:00' }, '2027-02-01 00:00', 1)[0] === '2027-02-28 09:00');
check('every year from 29 February falls on 28 February in common years', next({ every: 'year', start: '2028-02-29 09:00' }, '2028-03-01 00:00', 1)[0] === '2029-02-28 09:00');
check('every 90 minutes counts from its start, across midnight', next({ every: '90 minutes', start: '2026-11-03 22:30' }, '2026-11-03 22:30', 3).join() === '2026-11-03 22:30,2026-11-04 00:00,2026-11-04 01:30');
check('"every 3 hours" with the word every is read', !errs({ every: 'every 3 hours', start: '2026-11-03 08:00' }).length && fires({ every: 'every 3 hours', start: '2026-11-03 08:00' }, '2026-11-03 11:00'));
check('"day" alone means every day', fires({ every: 'day', start: '2026-11-03 21:00' }, '2026-11-09 21:00'));
check('an interval paused never fires', !fires({ every: 'day', start: '2026-11-03 21:00', paused: true }, '2026-11-04 21:00'));
check('parseEvery refuses zero', throws(() => parseEvery('0 days')));

// ── Her timezone and clock changes (66–73)
check('a reminder with its own timezone fires on that clock', rem({ at: '2026-11-03 09:00', timezone: NY }).fires(at('2026-11-03 09:00', NY)));
check('a New York 9am daily keeps 9am across the November clock change', next({ cron: '0 9 * * *' }, '2026-10-31 00:00', 3, NY).join() === '2026-10-31 09:00,2026-11-01 09:00,2026-11-02 09:00');
check('a one-off in the hour the clocks skip is not lost (New York, 8 Mar 2026, 02:30)', next({ at: '2026-03-08 02:30' }, '2026-03-08 00:00', 1, NY).length === 1);
check('a daily in the hour the clocks skip still goes that day (02:30, 8 Mar 2026)', next({ cron: '30 2 * * *' }, '2026-03-08 00:00', 1, NY)[0]?.startsWith('2026-03-08'));
check('a daily in the hour the clocks repeat goes once, not twice (01:30, 1 Nov 2026)', nextTimes(rem({ cron: '30 1 * * *' }, NY), at('2026-11-01 00:00', NY), 5).filter((ms) => formatLocal(localParts(ms, NY)).startsWith('2026-11-01')).length === 1);
check('Singapore has no clock change: a year of 9am dailies is 365', nextTimes(rem({ cron: '0 9 * * *' }), at('2027-01-01 00:00'), 400, 365).length === 365);
check('zonedToUtc reads her wall clock back exactly', formatLocal(localParts(at('2026-11-03 07:45'), SG)) === '2026-11-03 07:45');
check('a cron minute list (0,30) fires at both', fires({ cron: '0,30 8 * * *' }, '2026-11-03 08:30') && fires({ cron: '0,30 8 * * *' }, '2026-11-03 08:00'));

// ── What a sweep plans (dueSince) (74–85)
const file = (rs) => ({ timezone: SG, send: 'routine', reminders: rs });
const plan = (rs, sinceLocal, nowLocal) => dueSince(file(rs), at(sinceLocal), at(nowLocal));
check('a reminder due in the hour is planned', plan([{ id: 'a', text: 't', cron: '0 12 * * *' }], '2026-11-03 11:05', '2026-11-03 12:05').length === 1);
check('one due exactly at the sweep minute is planned', plan([{ id: 'a', text: 't', cron: '5 12 * * *' }], '2026-11-03 11:05', '2026-11-03 12:05').length === 1);
check('one due exactly at the last sweep is not planned again', plan([{ id: 'a', text: 't', cron: '5 11 * * *' }], '2026-11-03 11:05', '2026-11-03 12:05').length === 0);
check('several due in the gap go once, with the latest time', (() => { const p = plan([{ id: 'a', text: 't', cron: '*/15 * * * *' }], '2026-11-03 11:05', '2026-11-03 12:05'); return p.length === 1 && formatLocal(localParts(p[0].at, SG)) === '2026-11-03 12:00'; })());
check('after a long outage it looks back two days at most', plan([{ id: 'a', text: 't', at: '2026-11-01 09:00' }], '2026-10-01 00:00', '2026-11-05 09:00').length === 0);
check('inside two days, a one-off missed in an outage still goes', plan([{ id: 'a', text: 't', at: '2026-11-04 09:00' }], '2026-10-01 00:00', '2026-11-05 08:00').length === 1);
check('never a time before it was set', plan([{ id: 'a', text: 't', cron: '0 9 * * *', set: '2026-11-03 10:00' }], '2026-11-03 08:00', '2026-11-03 10:05').length === 0);
check('set the same minute as its time: it still goes', plan([{ id: 'a', text: 't', cron: '0 9 * * *', set: '2026-11-03 09:00' }], '2026-11-03 08:00', '2026-11-03 09:05').length === 1);
check('a paused one is never planned', plan([{ id: 'a', text: 't', cron: '0 12 * * *', paused: true }], '2026-11-03 11:05', '2026-11-03 12:05').length === 0);
check('an ended one is never planned', plan([{ id: 'a', text: 't', cron: '0 12 * * *', ended: '2026-11-02' }], '2026-11-03 11:05', '2026-11-03 12:05').length === 0);
check('a bad entry beside a good one: the good one is still planned', plan([{ id: 'bad', text: 't', cron: 'nonsense' }, { id: 'a', text: 't', cron: '0 12 * * *' }], '2026-11-03 11:05', '2026-11-03 12:05').map((r) => r.id).join() === 'a');
check('a windowed one-off is planned once, at its window\'s start', (() => { const p = plan([{ id: 'w', text: 't', at: '2026-11-03 11:30', window: 120 }], '2026-11-03 11:05', '2026-11-03 12:05'); return p.length === 1 && formatLocal(localParts(p[0].at, SG)) === '2026-11-03 11:30'; })());

// ── The command line, on a throwaway record (86–100)
const root = makeTemp('reminders-edge-');
const dir = join(root, 'data');
const cal = join(dir, 'core', 'calendar');
mkdirSync(cal, { recursive: true });
writeFileSync(join(dir, 'PROFILE.yaml'), 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
const env = { ...process.env };
delete env.TELEGRAM_BOT_TOKEN;
delete env.TELEGRAM_CHAT_ID;
const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8', env });
const write = (j) => writeFileSync(join(cal, 'reminders.json'), JSON.stringify(j));
const readFile = () => JSON.parse(readFileSync(join(cal, 'reminders.json'), 'utf8'));

write({ timezone: SG, reminders: [{ id: 'a', text: 't', cron: '0 9 * * *' }] });
check('a file without "send": "routine" is named a problem by check', /does not read "send": "routine"/.test(run('check').stdout));
check('and send-due says plainly it sends nothing', /NOT SENT/.test(run('send-due').stdout));
write({ timezone: SG, send: 'routine', reminders: [{ id: 'a', text: 'Take the evening tablet', cron: '* * * * *' }] });
check('send-due plans a due reminder with its purpose', JSON.parse(run('send-due').stdout).due?.[0]?.for === 'Take the evening tablet');
check('send-one refuses the purpose sent as written', /write it fresh/.test(run('send-one', 'a', '--text', 'Take the evening tablet').stdout));
check('send-one refuses no words at all', run('send-one', 'a', '--text', '   ').status === 1);
check('send-one refuses an id not in the file', run('send-one', 'nope', '--text', 'hi there').status === 1);
check('with no bot key, it says not sent and keeps nothing', /not sent: this environment holds no bot key/.test(run('send-one', 'a', '--text', 'Evening one, when you are ready').stdout) && !existsSync(join(cal, 'reminders-sent.json')));
check('mark-sent moves the mark forward', /through 2026-11-03 12:05/.test(run('mark-sent', '2026-11-03 12:05').stdout) && readFile().sent_through === '2026-11-03 12:05');
check('mark-sent never moves the mark backward', /already through/.test(run('mark-sent', '2026-11-03 11:00').stdout) && readFile().sent_through === '2026-11-03 12:05');
check('mark-sent --before stops a minute short of a failed send', (() => { write({ ...readFile(), sent_through: undefined }); run('mark-sent', '2026-11-03 13:05', '--before', '2026-11-03 13:00'); return readFile().sent_through === '2026-11-03 12:59'; })());
check('mark-sent refuses an unreadable time', run('mark-sent', 'tomorrow').status === 1);
check('hold refuses an id not in the file', run('hold', 'nope').status === 1);
write({ timezone: SG, send: 'routine', reminders: [{ id: 'live', text: 't', cron: '0 9 * * *', set: '2026-10-01 09:00' }, { id: 'gone', text: 't', cron: '0 9 * * *', ended: '2026-10-02', set: '2026-10-01 09:00' }, { id: 'past', text: 't', at: '2026-10-05 09:00', set: '2026-10-01 09:00' }] });
// The spent one-off went: Telegram accepted it (one that never went stays, missed).
writeFileSync(join(cal, 'reminders-sent.json'), JSON.stringify({ counts: { past: { sent: 1, first: '2026-10-05 09:01', last: '2026-10-05 09:01' } }, sent: [] }));
check('archive moves the ended and the spent one-off, and keeps the live one', /archived gone, past/.test(run('archive').stdout) && readFile().reminders.map((r) => r.id).join() === 'live');
check('nothing archived is lost: both are in the year\'s archive', (() => { const a = JSON.parse(readFileSync(join(dir, 'archive', 'reminders-2026.json'), 'utf8')).reminders.map((r) => r.id); return a.includes('gone') && a.includes('past'); })());
check('the list shows live reminders only, and counts the archived', (() => { const j = JSON.parse(run('list', '--json').stdout); return j.reminders.length === 1 && j.reminders[0].id === 'live' && j.archived === 2; })());

// ── Round 3 of the set-up edge cases
// C6: a pause written as a string is named, and the entry is not sent.
check('"paused": "true" as a string is refused, so it never goes (C6)', (() => { const x = one({ cron: '0 9 * * *', paused: 'true' }); return x.errors.length === 1 && /paused/.test(x.errors[0]) && x.reminders.length === 0; })());
check('"paused": true and false still read', errs({ cron: '0 9 * * *', paused: true }).length === 0 && errs({ cron: '0 9 * * *', paused: false }).length === 0);
// B12: mark-sent moves its own line only, so a reminder added beside it merges cleanly.
{
  const laid = `${JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'live', text: 't', cron: '0 9 * * *', set: '2026-10-01 09:00' }, { id: 'two', text: 'u', cron: '0 10 * * *', set: '2026-10-01 09:00' }] }, null, 4)}\n`;
  writeFileSync(join(cal, 'reminders.json'), laid);
  run('mark-sent', '2026-11-03 12:05');
  const first = readFileSync(join(cal, 'reminders.json'), 'utf8');
  check('the first mark-sent adds one line and leaves the layout as written (B12)', first.split('\n').length === laid.split('\n').length + 1 && first.replace(/\n {4}"sent_through": "2026-11-03 12:05",/, '') === laid);
  run('mark-sent', '2026-11-03 13:05');
  const second = readFileSync(join(cal, 'reminders.json'), 'utf8');
  check('a later mark-sent changes that one line only (B12)', second === first.replace('2026-11-03 12:05', '2026-11-03 13:05') && readFile().sent_through === '2026-11-03 13:05');
}
{
  // The real conflict: the sweep marks on one branch while a chat adds a reminder, one
  // entry to a line as the skill writes them, on another; git merges the two.
  const repo = join(root, 'merge');
  mkdirSync(join(repo, 'data', 'core', 'calendar'), { recursive: true });
  writeFileSync(join(repo, 'data', 'PROFILE.yaml'), 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
  const g = (...a) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', env: Object.fromEntries(Object.entries(env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k))) });
  const entries = Array.from({ length: 12 }, (_, i) => `    { "id": "r${i}", "text": "t", "cron": "0 ${i + 8} * * *", "set": "2026-10-01 09:00" }`);
  const body = (list) => `{\n  "timezone": "${SG}",\n  "send": "routine",\n  "reminders": [\n${list.join(',\n')}\n  ]\n}\n`;
  const f = join(repo, 'data', 'core', 'calendar', 'reminders.json');
  writeFileSync(f, body(entries));
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  g('checkout', '-q', '-b', 'chat');
  writeFileSync(f, body([...entries, '    { "id": "new", "text": "u", "cron": "0 21 * * *", "set": "2026-10-02 09:00" }']));
  g('commit', '-q', '-am', 'a reminder added');
  g('checkout', '-q', 'main');
  spawnSync(process.execPath, [script, 'mark-sent', '2026-11-03 12:05', '--record', join(repo, 'data')], { encoding: 'utf8', env });
  g('commit', '-q', '-am', 'the sweep marked');
  const merged = g('merge', '-q', '--no-edit', 'chat');
  const out = merged.status === 0 ? JSON.parse(readFileSync(f, 'utf8')) : null;
  check('a mark-sent and a reminder added beside it merge with no conflict, both kept (B12)', merged.status === 0 && out.sent_through === '2026-11-03 12:05' && out.reminders.some((r) => r.id === 'new'));
}
check('a file on one line is still marked, whole (B12)', (() => { write({ timezone: SG, send: 'routine', reminders: [] }); run('mark-sent', '2026-11-04 09:00'); return readFile().sent_through === '2026-11-04 09:00'; })());

console.log(`\n${n} cases, ${n - failed} passed`);
if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
