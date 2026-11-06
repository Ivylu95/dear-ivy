// Rule test for her reminders (HBT-010): the schedule engine in reminder-schedule.mjs
// fires each one in the minute she asked for, in her timezone, and nowhere else; a
// broken entry never stops the rest; and ux/scripts/reminders.mjs, the sweep's only
// sender, plans each due one once and names a file it would skip.

import { dueReminders, nextTimes, parseCron, parseEvery, readReminders, zonedToUtc } from './reminder-schedule.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const SG = 'Asia/Singapore';
const at = (local, tz = SG) => {
  const [d, t] = local.split(' ');
  const [y, mo, dd] = d.split('-').map(Number);
  const [H, M] = t.split(':').map(Number);
  return zonedToUtc({ y, mo, d: dd, H, M }, tz);
};
const fires = (r, local, tz = SG) => {
  const { reminders, errors } = readReminders({ timezone: tz, reminders: [{ id: 'r', text: 't', ...r }] });
  if (errors.length) throw new Error(errors.join('; '));
  return reminders[0].fires(at(local, tz));
};

// Once
check('"at" fires in its minute', fires({ at: '2026-10-20 15:00' }, '2026-10-20 15:00'));
check('"at" fires at no other minute', !fires({ at: '2026-10-20 15:00' }, '2026-10-20 15:01'));
check('"at" is read in her timezone, not UTC', (() => {
  const r = readReminders({ timezone: SG, reminders: [{ id: 'r', text: 't', at: '2026-10-20 15:00' }] }).reminders[0];
  return r.fires(Date.UTC(2026, 9, 20, 7, 0)) && !r.fires(Date.UTC(2026, 9, 20, 15, 0));
})());
check('a second within the minute still counts', readReminders({ timezone: SG, reminders: [{ id: 'r', text: 't', at: '2026-10-20 15:00' }] }).reminders[0].fires(at('2026-10-20 15:00') + 42e3));

// Cron
check('daily at 9', fires({ cron: '0 9 * * *' }, '2026-10-21 09:00') && !fires({ cron: '0 9 * * *' }, '2026-10-21 10:00'));
check('every Thursday by name', fires({ cron: '30 19 * * thu' }, '2026-10-22 19:30') && !fires({ cron: '30 19 * * thu' }, '2026-10-23 19:30'));
check('weekdays only', fires({ cron: '0 8 * * 1-5' }, '2026-10-23 08:00') && !fires({ cron: '0 8 * * 1-5' }, '2026-10-24 08:00'));
check('Sunday as 7', fires({ cron: '0 8 * * 7' }, '2026-10-25 08:00'));
check('every 15 minutes', fires({ cron: '*/15 * * * *' }, '2026-10-21 13:45') && !fires({ cron: '*/15 * * * *' }, '2026-10-21 13:50'));
check('last day of the month', fires({ cron: '0 10 L * *' }, '2026-02-28 10:00') && !fires({ cron: '0 10 L * *' }, '2026-02-27 10:00') && fires({ cron: '0 10 L * *' }, '2028-02-29 10:00'));
check('both day fields set: either will do, as cron reads them', fires({ cron: '0 9 1 * mon' }, '2026-10-01 09:00') && fires({ cron: '0 9 1 * mon' }, '2026-10-19 09:00'));
for (const bad of ['61 * * * *', '0 9 * *', '0 9 * * funday', '0 25 * * *', '5-1 * * * *']) {
  let threw = false;
  try { parseCron(bad); } catch { threw = true; }
  check(`refuses the cron "${bad}"`, threw);
}

// Every
check('"every 2 weeks" from its start', fires({ every: '2 weeks', start: '2026-10-18 09:00' }, '2026-11-01 09:00') && !fires({ every: '2 weeks', start: '2026-10-18 09:00' }, '2026-10-25 09:00'));
check('"every" never fires before its start', !fires({ every: '1 day', start: '2026-10-18 09:00' }, '2026-10-17 09:00'));
check('"every 90 minutes"', fires({ every: '90 minutes', start: '2026-10-16 09:00' }, '2026-10-16 10:30') && !fires({ every: '90 minutes', start: '2026-10-16 09:00' }, '2026-10-16 10:00'));
check('"every 1 month" from the 31st lands on the last day of a short month', fires({ every: '1 month', start: '2026-01-31 09:00' }, '2026-02-28 09:00') && fires({ every: '1 month', start: '2026-01-31 09:00' }, '2026-03-31 09:00'));
check('"every 1 year"', fires({ every: '1 year', start: '2026-03-14 08:00' }, '2027-03-14 08:00') && !fires({ every: '1 year', start: '2026-03-14 08:00' }, '2027-04-14 08:00'));
check('reads "every 3 days", "week" and "2 hrs"', parseEvery('every 3 days').n === 3 && parseEvery('week').unit === 'week' && parseEvery('2 hrs').unit === 'hour');
check('"every" without a start is refused', readReminders({ reminders: [{ id: 'r', text: 't', every: '1 day' }] }).errors.length === 1);

// Daylight saving: New York springs forward on 2026-03-08 and falls back on 2026-11-01.
const NY = 'America/New_York';
check('daily 9:00 holds its local time across daylight saving', fires({ cron: '0 9 * * *' }, '2026-03-07 09:00', NY) && fires({ cron: '0 9 * * *' }, '2026-03-09 09:00', NY) && fires({ cron: '0 9 * * *' }, '2026-11-02 09:00', NY));
check('"every 1 day" holds its local time across daylight saving', fires({ every: '1 day', start: '2026-03-01 09:00' }, '2026-03-10 09:00', NY));

// Windows
check('"until" a date runs through that day, then stops', fires({ cron: '0 9 * * *', until: '2026-10-22' }, '2026-10-22 09:00') && !fires({ cron: '0 9 * * *', until: '2026-10-22' }, '2026-10-23 09:00'));
check('"start" holds a cron back', !fires({ cron: '0 9 * * *', start: '2026-10-25' }, '2026-10-24 09:00') && fires({ cron: '0 9 * * *', start: '2026-10-25' }, '2026-10-25 09:00'));
check('"paused" sends nothing', !fires({ cron: '0 9 * * *', paused: true }, '2026-10-22 09:00'));
check('"ended" sends nothing after the day she cancelled', !fires({ cron: '0 9 * * *', ended: '2026-10-20' }, '2026-10-21 09:00'));

// A broken file
const mixed = readReminders({ timezone: SG, reminders: [{ id: 'a', text: 'ok', cron: '0 9 * * *' }, { id: 'b', text: 'bad', cron: '99 * * * *' }, { id: 'a', text: 'dup', cron: '0 9 * * *' }, { id: 'c', text: '', at: '2026-10-20 15:00' }, { id: 'd', text: 'two', at: '2026-10-20 15:00', cron: '0 9 * * *' }] });
check('one broken entry never stops the rest', mixed.reminders.length === 1 && mixed.reminders[0].id === 'a' && mixed.errors.length === 4);
check('a bad timezone is a problem, not a crash', readReminders({ timezone: 'Mars/Olympus', reminders: [] }).errors.length === 1);
check('a file with no list is a problem, not a crash', readReminders({}).errors.length === 1 && readReminders(null).errors.length === 1);
check('next times are found in order', (() => {
  const r = readReminders({ timezone: SG, reminders: [{ id: 'r', text: 't', cron: '0 9 * * thu' }] }).reminders[0];
  const n = nextTimes(r, at('2026-10-15 10:00'), 2);
  return n.length === 2 && n[0] === at('2026-10-22 09:00') && n[1] === at('2026-10-29 09:00');
})());

// What falls due in a minute: the engine alone. The sweep sends it (HBT-010 design 2).
const file = { timezone: SG, reminders: [{ id: 'meds', text: 'Take the evening tablet', cron: '0 21 * * *' }, { id: 'later', text: 'Not now', cron: '0 22 * * *' }] };
check('dueReminders finds only what is due that minute', dueReminders(file, at('2026-10-21 21:00')).map((r) => r.id).join() === 'meds');
check('dueReminders agrees with each reminder\'s own test', dueReminders(file, at('2026-10-21 22:00')).map((r) => r.id).join() === 'later');

// A one-off with a window counts as due through its window, and never after
const queuedFile = { timezone: SG, reminders: [{ id: 'check-in-1', text: 'Something waits', at: '2026-10-21 14:02', window: 60, from: 'check-in' }] };
const windowed = readReminders(queuedFile).reminders[0];
check('a windowed one-off seen late still counts as due, from its first minute', windowed.fires(at('2026-10-21 14:20')) && windowed.windowed.from === at('2026-10-21 14:02'));
check('it never goes after its window', !readReminders(queuedFile).reminders[0].fires(at('2026-10-21 15:03')));
check('a bad window is a problem, not a crash', readReminders({ reminders: [{ id: 'w', text: 't', at: '2026-10-21 14:02', window: -5 }] }).errors.length === 1);

// The list her table is drawn from (ux/scripts/reminders.mjs list): in the order set,
// each counted from the schedule, a windowed one-off once.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-list-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, reminders: [
    { id: 'later', emoji: '🗑️', text: 'Bin night', every: '1 hour', start: '2026-01-06 10:00', until: '2026-01-06', set: '2026-01-06' },
    { id: 'first', text: 'Queued', at: '2026-01-05 09:00', window: 60, set: '2026-01-05' },
  ] }));
  const out = spawnSync(process.execPath, [new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname, 'list', '--json', '--all', '--record', dir], { encoding: 'utf8' });
  const rows = JSON.parse(out.stdout || '{}').reminders ?? [];
  check('the list numbers reminders in the order they were set', rows[0]?.id === 'first' && rows[0]?.n === 1 && rows[1]?.n === 2);
  check('a windowed one-off counts once', rows[0]?.sent === 1 && rows[0]?.state === 'finished');
  check('an hourly one counts each hour it was due, and its last', rows[1]?.sent === 14 && /2026-01-06 23:00$/.test(rows[1]?.last ?? ''));
  check('the list carries the emoji', rows[1]?.emoji === '🗑️');
}

// Stopped ones leave her table and her file for the archive, never deleted (the reminders skill).
{
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-archive-');
  const path = join(dir, 'core', 'calendar', 'reminders.json');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [
    { id: 'old', text: 'Lunch', cron: '0 12 * * *', set: '2026-10-18', ended: '2026-10-18' },
    { id: 'gone', text: 'Call', at: '2026-01-05 09:00', set: '2026-01-04' },
    { id: 'live', emoji: '🌙', text: 'Before bed', cron: '0 23 * * *', set: '2026-10-18' },
  ] }));
  // The one-off went: Telegram accepted it. One that never went stays, missed (see below).
  writeFileSync(join(dir, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ counts: { gone: { sent: 1, first: '2026-01-05 09:01', last: '2026-01-05 09:01' } }, sent: [] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8' });
  let listed = JSON.parse(run('list', '--json').stdout || '{}');
  check('the table shows only what still runs, numbered from 1', listed.reminders?.length === 1 && listed.reminders[0].id === 'live' && listed.reminders[0].n === 1);
  const said = run('archive').stdout;
  const left = JSON.parse(readFileSync(path, 'utf8'));
  const kept = [join(dir, 'archive', 'reminders-2026.json')].filter(existsSync).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).reminders);
  check('archive moves a stopped one and a spent one-off out of her file', /archived old, gone/.test(said) && left.reminders.length === 1 && left.reminders[0].id === 'live' && left.send === 'routine');
  check('nothing is lost: each moved entry is in the archive, its ended mark kept', kept.length === 2 && kept.find((r) => r.id === 'old')?.ended === '2026-10-18');
  run('archive');
  check('archiving twice writes nothing twice', JSON.parse(readFileSync(join(dir, 'archive', 'reminders-2026.json'), 'utf8')).reminders.length === 2);
  listed = JSON.parse(run('list', '--json').stdout || '{}');
  check('the table counts what the archive keeps', listed.archived === 2 && listed.reminders.length === 1);
  check('--all shows the archived ones too', JSON.parse(run('list', '--json', '--all').stdout || '{}').reminders?.length === 3);
}

// The routine that sends one reminder (HBT-010 design 2): its schedule in her zone, a
// prompt carrying only that reminder's words, and a refusal for what a routine cannot do.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-routine-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', reminders: [
    { id: 'once', text: 'Call the clinic', at: '2026-10-20 15:00' },
    { id: 'bins', text: 'Bin night', cron: '30 19 * * thu', until: '2026-12-25' },
    { id: 'daily', text: 'Tablet', every: '1 day', start: '2026-10-18 21:00' },
    { id: 'often', text: 'Stretch', cron: '*/15 9-16 * * *' },
    { id: 'gone', text: 'Old', at: '2026-10-01 09:00', ended: '2026-10-02' },
  ] }));
  const routine = (id) => {
    const out = spawnSync(process.execPath, [new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname, 'routine', id, '--record', dir], { encoding: 'utf8' });
    return { code: out.status, ...JSON.parse(out.stdout || '{}') };
  };
  const once = routine('once');
  check('a one-off becomes a routine run once, at its time in her zone', once.code === 0 && once.run_once_at === '2026-10-20T07:00:00Z');
  check('the prompt carries the words and the key by name only', once.prompt.includes('⏰ Call the clinic') && once.prompt.includes('${TELEGRAM_BOT_TOKEN}') && once.prompt.includes('${TELEGRAM_CHAT_ID}'));
  const bins = routine('bins');
  check('a weekly cron keeps its fields, in her zone', bins.cron_expression === `CRON_TZ=${SG} 30 19 * * thu`);
  check('an end date becomes a check in the prompt', bins.prompt.includes('after 2026-12-25'));
  check('a daily "every" becomes a daily schedule at its start time', routine('daily').cron_expression === `CRON_TZ=${SG} 0 21 * * *`);
  const often = routine('often');
  check('more often than hourly is refused, for the hourly sweep instead', often.code === 1 && /hourly sweep sends it/.test(often.error));
  check('an ended reminder gets no routine', routine('gone').code === 1);
}

// The sweep's reminders step (HBT-010 design 2): each reminder due since the mark, once.
{
  const { dueSince } = await import('../../../ux/scripts/reminders.mjs');
  const file = { timezone: SG, send: 'routine', reminders: [
    { id: 'once', text: 'Call', at: '2026-10-21 18:50' },
    { id: 'often', text: 'Stretch', cron: '*/15 * * * *' },
    { id: 'later', text: 'Later', at: '2026-10-21 20:10' },
    { id: 'paused', text: 'P', at: '2026-10-21 19:00', paused: true },
    { id: 'queued', text: 'Q', at: '2026-10-21 19:05', window: 60 },
  ] };
  const due = dueSince(file, at('2026-10-21 18:47'), at('2026-10-21 19:47'));
  const ids = due.map((r) => r.id).sort().join();
  check('the sweep sends what fell due since the mark, each once', ids === 'often,once,queued');
  check('a reminder due four times in the hour goes once, with its latest time', due.find((r) => r.id === 'often').at === at('2026-10-21 19:45'));
  check('nothing due exactly at the mark goes again', dueSince(file, at('2026-10-21 18:50'), at('2026-10-21 19:00')).every((r) => r.id !== 'once'));
  check('after a long outage it looks back two days at most', dueSince({ timezone: SG, reminders: [{ id: 'old', text: 'o', at: '2026-10-10 09:00' }] }, at('2026-10-01 00:00'), at('2026-10-21 19:47')).length === 0);
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-mark-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  const path = join(dir, 'core', 'calendar', 'reminders.json');
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', sent_through: '2026-10-21 19:47', reminders: [] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8', env: { ...process.env, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' } });
  run('mark-sent', '2026-10-21 18:47');
  check('the mark never moves backward', JSON.parse(readFileSync(path, 'utf8')).sent_through === '2026-10-21 19:47');
  run('mark-sent', '2026-10-21 20:47');
  check('the mark moves forward', JSON.parse(readFileSync(path, 'utf8')).sent_through === '2026-10-21 20:47');
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'now', text: 't', cron: '* * * * *', reads: ['data/core/me/supplements.md'] }] }));
  const out = run('send-due');
  const plan = JSON.parse(out.stdout || '{}');
  check('send-due names the files a reminder reads first', plan.due?.[0]?.reads?.[0] === 'data/core/me/supplements.md');
  check('send-due lists what is due with its purpose, and sends nothing itself', out.status === 0 && plan.due?.[0]?.id === 'now' && plan.due[0].for === 't' && Array.isArray(plan.due[0].lastSent) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(plan.through));
  check('send-one refuses the purpose as written: never a fixed line', run('send-one', 'now', '--text', 't').status === 1);
  check('send-one refuses with no words', run('send-one', 'now').status === 1);
  const fresh = run('send-one', 'now', '--text', 'A fresh line for now.');
  check('without a bot key, fresh words are not sent, it says so, and the sweep goes on', fresh.status === 0 && /no bot key/.test(fresh.stdout));
  writeFileSync(join(dir, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ sent: [{ id: 'now', at: '2026-10-18 12:00', text: 'Said before.' }] }));
  check('send-one refuses to repeat an earlier message word for word', run('send-one', 'now', '--text', 'Said before.').status === 1);
  // Edge cases of 2026-10-29, each failing before its fix.
  writeFileSync(path, '{ not json');
  check('a file that will not read is NOT SENT, never "no file"', /NOT SENT: the file is not valid JSON/.test(run('send-due').stdout));
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine' }));
  const bare = run('send-due');
  check('a file with no list plans nothing and never fails the sweep', bare.status === 0 && JSON.parse(bare.stdout).due.length === 0);
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'dup', text: 'first', cron: '* * * * *', emoji: '💊', reads: ['data/core/me/supplements.md'] }, { id: 'dup', text: 'second', cron: '* * * * *', emoji: '🗑️' }] }));
  const dup = JSON.parse(run('send-due').stdout || '{}').due?.[0];
  check('a repeated id plans with the first entry\'s emoji and reads', dup?.emoji === '💊' && dup?.reads?.length === 1);
}

// The sweep sends from where it started and saves from its checkout: the two logs merge, nothing lost.
{
  const { mergeSent } = await import('../../../ux/scripts/reminders.mjs');
  const started = { counts: { a: { sent: 3, first: '2026-10-01 09:00', last: '2026-10-29 09:00', lastUtc: '2026-10-29T01:00:00Z' } }, sent: [{ id: 'a', at: '2026-10-28 09:00', text: 'old' }, { id: 'a', at: '2026-10-29 09:00', utc: '2026-10-29T01:00:00Z', text: 'new' }] };
  const checkout = { counts: { a: { sent: 2, first: '2026-10-01 09:00', last: '2026-10-28 09:00' }, b: { sent: 1, first: '2026-10-27 18:00', last: '2026-10-27 18:00' } }, sent: [{ id: 'b', at: '2026-10-27 18:00', text: 'only here' }, { id: 'a', at: '2026-10-28 09:00', text: 'old' }] };
  const m = mergeSent(started, checkout);
  check('the merged log keeps every entry from both, once each, in time order', m.sent.map((x) => x.text).join() === 'only here,old,new');
  check('each tally is the larger, with the later last send', m.counts.a.sent === 3 && m.counts.a.last === '2026-10-29 09:00' && m.counts.a.lastUtc === '2026-10-29T01:00:00Z' && m.counts.b.sent === 1);
}

// Round 53 of the git sync review: the sweep's own folder saves its sent log at the turn's end
// ("record: session update") and its checkout saves the carried copy ("record: reminders sent"),
// both from the same main. The two were written in different shapes (grouped by reminder and
// trimmed, against time order and untrimmed), so every sweep's two saves conflicted in git, and
// the merge was handed to her next chat to settle by hand. The same log carried is now the same
// bytes, so the two saves merge clean.
{
  const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const root = makeTemp('reminders-two-saves-');
  const g = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', ...a], { cwd, encoding: 'utf8' });
  const seed = join(root, 'seed');
  mkdirSync(join(seed, 'data', 'core', 'calendar'), { recursive: true });
  g(seed, 'init', '-q', '-b', 'main');
  writeFileSync(join(seed, 'data', 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', sent_through: '2026-10-30 08:00', reminders: [{ id: 'a', text: 'invented a', cron: '0 9 * * *' }, { id: 'b', text: 'invented b', cron: '0 10 * * *' }] }, null, 2));
  // As the old writer left it: grouped by reminder, so not in time order, and b's holds at the cap.
  const day = (d, h) => ({ at: `2026-10-${d} ${h}:00`, utc: `2026-10-${d}T0${h - 8}:00:00.000Z` });
  writeFileSync(join(seed, 'data', 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({
    _what: 'x',
    counts: { a: { sent: 2, first: '2026-10-25 09:00', last: '2026-10-29 09:00' } },
    sent: [
      { id: 'a', ...day(25, 9), text: 'a1' }, { id: 'a', ...day(29, 9), text: 'a2' },
      ...[24, 25, 26, 27, 28].map((d) => ({ id: 'b', ...day(d, 10), held: true, why: 'no meal near' })),
    ],
  }, null, 2));
  g(seed, 'add', '-A');
  g(seed, 'commit', '-q', '-m', 'seed');
  const started = join(root, 'started');
  const checkout = join(root, 'checkout');
  g(root, 'clone', '-q', seed, started);
  g(root, 'clone', '-q', seed, checkout);
  const run = (dir, ...a) => spawnSync(process.execPath, [script, ...a, '--record', join(dir, 'data')], { encoding: 'utf8', env: { ...process.env, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' } });
  run(started, 'hold', 'b', '--why', 'no meal near');
  run(checkout, 'carry-sent', join(started, 'data'));
  run(checkout, 'mark-sent', '2026-11-02 10:00');
  g(started, 'commit', '-q', '-am', 'record: session update');
  g(checkout, 'commit', '-q', '-am', 'record: reminders sent');
  g(started, 'fetch', '-q', checkout, 'HEAD');
  const merged = g(started, 'merge', '-q', '--no-edit', 'FETCH_HEAD');
  check('the sweep\'s two saves of one sent log merge without a conflict', merged.status === 0);
  let log = { sent: [] };
  try { log = JSON.parse(readFileSync(join(started, 'data', 'core', 'calendar', 'reminders-sent.json'), 'utf8')); } catch { /* conflict markers: failed above */ }
  check('the merged log keeps a\'s messages and the newest five holds of b, in time order', log.sent.length === 7 && log.sent.filter((m) => m.id === 'a').length === 2 && log.sent.filter((m) => m.id === 'b').length === 5 && log.sent.every((m, i, all) => i === 0 || String(all[i - 1].utc) <= String(m.utc)));
}

// A file never marked still sends what it missed, once, within the two-day look-back (HBT-010 design 5).
{
  const { dueSince } = await import('../../../ux/scripts/reminders.mjs');
  const late = dueSince({ timezone: SG, reminders: [{ id: 'late', text: 'Call', at: '2026-10-28 13:00' }] }, -Infinity, at('2026-10-28 15:05'));
  check('a one-off missed two hours ago with no mark yet is still due', late.length === 1 && late[0].id === 'late');
  // 29 February: live, with a next time, not finished (and so never archived as spent).
  const leap = readReminders({ timezone: SG, reminders: [{ id: 'leap', text: 't', cron: '0 9 29 2 *' }] }).reminders[0];
  check('a 29 February reminder has a next time years ahead', nextTimes(leap, at('2026-10-28 10:00'), 1).length === 1);
}

// A reminder naming its chat ends every message with that chat's link (card A-128).
{
  const { chatFaults, chatLine, messageFor, TELEGRAM_MAX, visible } = await import('./chat-link.mjs');
  const url = 'https://claude.ai/code/session_EXAMPLExxxxxxxxxxxxx';
  const good = { id: 'n', emoji: '🍽️', chat: { url, title: '🏋️ Weekly plan' } };
  check('a sound chat has no fault, and none is needed', chatFaults(good).length === 0 && chatFaults({ id: 'n' }).length === 0);
  check('the message ends with the chat line, after a blank line, only the chat\'s name a link', messageFor(good, 'Dinner is near.') === `🍽️ Dinner is near.\n\n💬 Carry on in <a href="${url}">🏋️ Weekly plan</a>`);
  check('the emoji goes once, even when the words open with it', messageFor({ emoji: '🍽️' }, '🍽️ Dinner is near.') === '🍽️ Dinner is near.');
  check('a short first line goes in bold, the rest line for line, a run of number lines bulleted', messageFor({ emoji: '🍽️' }, 'Lunch soon\n\n🔥 2,000 kcal\n💪 150 g protein') === '<b>🍽️ Lunch soon</b>\n\n• 🔥 2,000 kcal\n• 💪 150 g protein');
  check('a line straight under the bold heading joins it after an en dash', messageFor({ emoji: '🍽️' }, "Dinner's not far off\nNice one getting lunch in 💪\n\nSomething with protein.") === "<b>🍽️ Dinner's not far off</b> – Nice one getting lunch in 💪\n\nSomething with protein.");
  check('a list written with dashes or stars becomes bullets too', messageFor({ emoji: '🌤️' }, 'Today – a full one\n\n- 10:00 dentist\n* 19:00 dinner\n\nGo easy tonight.') === '<b>🌤️ Today – a full one</b>\n\n• 10:00 dentist\n• 19:00 dinner\n\nGo easy tonight.');
  check('a dash inside a sentence is no list', messageFor({ emoji: '🌤️' }, 'Morning\n\nRest - then eat.\nThen walk.') === '<b>🌤️ Morning</b>\n\nRest - then eat.\nThen walk.');
  check('a single emoji-led line is not bulleted, and a number line under the heading stays its own', messageFor({ emoji: '🍽️' }, 'Lunch soon\n🔥 2,000 kcal left\n\nEggs would do.') === '<b>🍽️ Lunch soon</b>\n🔥 2,000 kcal left\n\nEggs would do.');
  check('her words are escaped, so only the code makes markup', messageFor({ emoji: '🍽️' }, 'eggs & <toast>') === '🍽️ eggs &amp; &lt;toast&gt;');
  check('with no chat, the message is as before', messageFor({ emoji: '🍽️' }, 'Dinner is near.') === '🍽️ Dinner is near.');
  for (const [what, chat] of [
    ['another site', { url: 'https://evil.example/code/session_014e9VwgkfuMWQLp', title: 't' }],
    ['a look-alike host', { url: 'https://claude.ai.evil.example/code/session_014e9VwgkfuMWQLp', title: 't' }],
    ['plain http', { url: 'http://claude.ai/code/session_014e9VwgkfuMWQLp', title: 't' }],
    ['a page that is not a chat', { url: 'https://claude.ai/settings', title: 't' }],
    ['something after the address', { url: `${url}?next=https://evil.example`, title: 't' }],
    ['a second line hidden in the address', { url: `${url}\nhttps://evil.example`, title: 't' }],
    ['no title', { url }],
    ['a title of two lines', { url, title: 'a\nhttps://evil.example' }],
    ['a title too long', { url, title: 'x'.repeat(61) }],
    ['a string, not an object', url],
    ['null', null],
    ['a list', [url]],
  ]) {
    const e = { id: 'n', emoji: '🍽️', chat };
    check(`a broken chat (${what}) is a fault, and sends no link`, chatFaults(e).length > 0 && chatLine(e) === '' && !messageFor(e, 'x').includes('💬'));
  }
  const long = messageFor(good, 'w'.repeat(5000));
  check('a message too long for Telegram is cut, the link kept whole', visible(long).length <= TELEGRAM_MAX && long.endsWith(`${url}">🏋️ Weekly plan</a>`) && long.includes('…'));
  const exact = messageFor(good, 'w'.repeat(TELEGRAM_MAX));
  check('the cut lands within the limit whatever the length', visible(exact).length <= TELEGRAM_MAX);

  // End to end: check names a broken chat; send-one sends the link to a stand-in Telegram here.
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawn, spawnSync } = await import('node:child_process');
  const http = await import('node:http');
  const dir = makeTemp('reminders-chat-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  const path = join(dir, 'core', 'calendar', 'reminders.json');
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'n', text: 't', emoji: '🍽️', cron: '0 9 * * *', chat: { url: 'https://evil.example/x', title: 't' } }] }));
  const bad = spawnSync(process.execPath, [script, 'check', '--record', dir], { encoding: 'utf8' });
  check('check fails on a reminder whose chat is not a chat', bad.status === 1 && /chat\.url/.test(bad.stdout));
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'n', text: 't', emoji: '🍽️', cron: '0 9 * * *', chat: good.chat }] }));
  check('check passes a sound chat', !/chat/.test(spawnSync(process.execPath, [script, 'check', '--record', dir], { encoding: 'utf8' }).stdout));
  const got = [];
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { got.push(JSON.parse(b)); res.end('{"ok":true}'); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { ...process.env, TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_CHAT_ID: '1', TELEGRAM_API_TEST: `http://127.0.0.1:${server.address().port}` };
  const sent = await new Promise((r) => { const p = spawn(process.execPath, [script, 'send-one', 'n', '--text', 'Dinner is near.', '--record', dir], { env }); let o = ''; p.stdout.on('data', (c) => { o += c; }); p.on('close', (code) => r({ code, o })); });
  server.close();
  check('send-one sends the words with the chat link as the last line', sent.code === 0 && /sent/.test(sent.o) && got[0]?.text === `🍽️ Dinner is near.\n\n💬 Carry on in <a href="${url}">🏋️ Weekly plan</a>` && got[0]?.parse_mode === 'HTML' && got[0]?.link_preview_options?.is_disabled === true);
  const elsewhere = spawnSync(process.execPath, [script, 'send-one', 'n', '--text', 'Another line.', '--record', dir], { encoding: 'utf8', env: { ...env, TELEGRAM_API_TEST: 'http://evil.example:80' } });
  check('a stand-in on any other host is ignored: the send goes to Telegram itself or nowhere', !/evil/.test(elsewhere.stdout));

  // Card A-128: with her list of chats kept, the link goes only to an open everyday chat on it.
  const { chatFor } = await import('./chat-link.mjs');
  const dev = 'https://claude.ai/code/session_DEVxxxxxxxxxxxxxxxxx';
  const gone = 'https://claude.ai/code/session_GONExxxxxxxxxxxxxxxx';
  const home = 'https://claude.ai/code/session_HOMExxxxxxxxxxxxxxxx';
  const chats = [{ url, title: '🏋️ Weekly plan', kind: 'everyday', state: 'open' }, { url: home, title: '☀️ Home', kind: 'everyday', general: true, state: 'open' }, { url: dev, title: 'Dev', kind: 'dev', state: 'open' }, { url: gone, title: 'Old', kind: 'everyday', state: 'closed' }];
  check('the entry\'s own chat is linked when it is on her list', chatFor(good, {}, chats).chat?.url === url);
  check('a chat the sweep chose is linked, with its name from her list', chatFor({ id: 'm' }, { url: home }, chats).chat?.title === '☀️ Home');
  check('a message that needs nothing back has no link', chatFor(good, { none: true }, chats).chat === null);
  check('a development chat is never linked', chatFor({ id: 'm' }, { url: dev }, chats).fault === 'that is a development chat');
  check('a closed chat is never linked', chatFor({ id: 'm' }, { url: gone }, chats).fault === 'that chat is closed');
  check('a chat not on her list is never linked', /not on her list/.test(chatFor({ id: 'm', chat: { url: 'https://claude.ai/code/session_UNLISTEDxxxxxxxxxxx', title: 'x' } }, {}, chats).fault ?? ''));
  check('with no list kept, the entry\'s own chat stands as before', chatFor(good, {}, null).chat?.url === url);
  mkdirSync(join(dir, 'core', 'state'), { recursive: true });
  writeFileSync(join(dir, 'core', 'state', 'chats.json'), JSON.stringify({ chats }));
  check('send-one refuses to link a development chat', spawnSync(process.execPath, [script, 'send-one', 'n', '--text', 'Something fresh.', '--chat', dev, '--record', dir], { encoding: 'utf8', env }).status === 1);
  check('check names an entry whose chat is closed', (() => { writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'n', text: 't', emoji: '🍽️', cron: '0 9 * * *', chat: { url: gone, title: 'Old' } }] })); return /its chat cannot be linked: that chat is closed/.test(spawnSync(process.execPath, [script, 'check', '--record', dir], { encoding: 'utf8' }).stdout); })());
  const got2 = [];
  const server2 = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { got2.push(JSON.parse(b)); res.end('{"ok":true}'); }); });
  await new Promise((r) => server2.listen(0, '127.0.0.1', r));
  const env2 = { ...env, TELEGRAM_API_TEST: `http://127.0.0.1:${server2.address().port}` };
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'n', text: 't', emoji: '🍽️', cron: '0 9 * * *', chat: good.chat }] }));
  const run2 = (...a) => new Promise((r) => { const p = spawn(process.execPath, [script, 'send-one', 'n', ...a, '--record', dir], { env: env2 }); p.on('close', r); });
  await run2('--text', 'Lunch soon.', '--no-chat');
  await run2('--text', 'Morning, how are you?', '--chat', home);
  server2.close();
  check('--no-chat sends no link', got2[0] && !/Carry on/.test(got2[0].text));
  check('--chat links the chat the sweep chose', /Carry on in <a href="https:\/\/claude\.ai\/code\/session_HOMExxxxxxxxxxxxxxxx">☀️ Home/.test(got2[1]?.text ?? ''));
}

// Sent by the sweep, the table counts what Telegram accepted, says when, and shows a missed one.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-tally-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  const local = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: SG, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms).replace(',', '');
  const twoAgo = Date.now() - 2 * 3600e3;
  const [hh, mm] = local(twoAgo).slice(11).split(':').map(Number);
  const dayBefore = local(Date.now() - 30 * 3600e3);
  writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', reminders: [
    { id: 'quiet', text: 'x', cron: `${mm} ${hh} * * *`, set: '2026-01-01' },
    { id: 'fine', text: 'y', cron: `${mm} ${hh} * * *`, set: '2026-01-01' },
  ] }));
  writeFileSync(join(dir, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ sent: [
    { id: 'quiet', at: dayBefore, text: 'a' },
    { id: 'fine', at: dayBefore, text: 'b' },
    { id: 'fine', at: local(twoAgo + 6 * 60e3), text: 'c' },
  ] }));
  const rows = JSON.parse(spawnSync(process.execPath, [new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname, 'list', '--json', '--record', dir], { encoding: 'utf8' }).stdout || '{}').reminders ?? [];
  const quiet = rows.find((r) => r.id === 'quiet');
  const fine = rows.find((r) => r.id === 'fine');
  check('sent by the sweep, Times sent is what Telegram accepted, not the schedule', quiet?.sent === 1 && fine?.sent === 2 && fine.counted === 'accepted');
  check('Last went out is when it was really sent', fine?.last?.endsWith(local(twoAgo + 6 * 60e3).slice(11)));
  check('a time passed with nothing sent shows as missed; one sent does not', quiet?.missed && !fine?.missed);
}

// Check-ins (HBT-014): the same schedules, table and archive, her own file, and the nudge's gates.
{
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = makeTemp('check-ins-');
  const dir = join(root, 'data');
  const path = join(dir, 'core', 'calendar', 'check-ins.json');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  mkdirSync(join(dir, 'core', 'me'), { recursive: true });
  mkdirSync(join(dir, 'core', 'state'), { recursive: true });
  writeFileSync(join(dir, 'core', 'state', 'log.md'), '| 2026-01-01 · session · quiet |\n');
  writeFileSync(join(dir, 'core', 'me', 'nudge.md'), '---\nnudge: off\n---\n');
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', check_ins: [
    { id: 'morning', emoji: '🌤️', text: 'How I slept and what is ahead', cron: '* * * * *', set: '2026-01-01' },
    { id: 'old', text: 'Sundays', cron: '0 10 * * 0', set: '2026-01-01', ended: '2026-01-02' },
  ] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--kind', 'check-ins', '--record', dir], { encoding: 'utf8', env: { ...process.env, TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' } });
  const listed = JSON.parse(run('list', '--json').stdout || '{}');
  check('check-ins list from their own file, live only', listed.reminders?.length === 1 && listed.reminders[0].id === 'morning');
  const plan = JSON.parse(run('send-due').stdout || '{}');
  check('check-ins plan what is due, with the focus', plan.due?.[0]?.id === 'morning' && plan.due[0].for === 'How I slept and what is ahead');
  check('a check-in is never sent while her switch is off, and is kept as held', /check-ins: morning held \(she has not asked/.test(run('send-one', 'morning', '--text', 'How did you sleep?').stdout));
  writeFileSync(join(dir, 'core', 'me', 'nudge.md'), '---\nnudge: on\n---\n');
  writeFileSync(join(dir, 'core', 'state', 'log.md'), `| ${new Date().toISOString().slice(0, 10)} · crisis · ongoing |\n`);
  check('a check-in is never sent after a hard session, and is kept as held', /held \(her last session ended hard/.test(run('send-one', 'morning', '--text', 'How did you sleep?').stdout));
  check('a held check-in is kept as held, with why', /check-ins: morning held \(a hard day\)/.test(run('hold', 'morning', '--why', 'a hard day').stdout));
  {
    // T-811: a coming date said in five mornings running. A line an earlier check-in said is refused,
    // by line and date, never its words; one about today or tomorrow, or one that changed, is not.
    const { repeatedLines, sameLine } = await import('../../../ux/scripts/reminders.mjs');
    const ago = (d) => new Date(Date.now() - d * 86400e3).toISOString();
    const before = [{ id: 'sunday', at: '2026-01-05 10:00', utc: ago(2), text: 'Sunday look-ahead\n\n• 📅 Nothing on today\n• 🎸 Band practice is on Saturday the 9th\n\nWhat do you want from the week?' }];
    const again = 'Wednesday morning\n\n• 📅 Nothing on today or tomorrow\n• 🎸 Saturday the 9th is band practice\n\nAnything to sort before Friday?';
    check('a line an earlier check-in said is a repeat, whichever check-in said it', repeatedLines(again, before).map((r) => r.line).join() === '4');
    check('the repeat is named by line and date, never by its words', JSON.stringify(repeatedLines(again, before)) === '[{"line":4,"at":"2026-01-05 10:00"}]');
    check('a line about today or tomorrow is never a repeat', repeatedLines('Friday\n\n• 🎸 Band practice is tomorrow, Saturday the 9th', before).length === 0);
    check('a big date\'s line a week before is never a repeat (A-176)', repeatedLines('Friday\n\n• 🎸 Band practice on Saturday the 9th, in a week', before).length === 0);
    check('a line that says what changed is not a repeat', repeatedLines('Thursday\n\n• 🎸 Band practice moved to Sunday the 10th, venue still open', before).length === 0);
    check('a line said more than six days ago may come back', repeatedLines(again, [{ ...before[0], utc: ago(8) }]).length === 0);
    check('a held one said nothing', repeatedLines(again, [{ ...before[0], held: true }]).length === 0);
    check('two short lines are never judged alike', !sameLine('📅 Busy day', '📅 Busy day'));
    const sentPath = join(dir, 'core', 'calendar', 'check-ins-sent.json');
    const kept = readFileSync(sentPath, 'utf8');
    writeFileSync(sentPath, JSON.stringify({ sent: before }));
    const plan2 = JSON.parse(run('send-due').stdout || '{}');
    check('send-due hands the sweep every check-in said lately, whichever it was', plan2.saidLately?.length === 1 && plan2.saidLately[0].id === 'sunday');
    const refused = run('send-one', 'morning', '--text', again);
    check('send-one refuses a check-in that says again what an earlier one said', refused.status === 1 && /line 4, said 2026-01-05 10:00/.test(refused.stdout) && !/band/i.test(refused.stdout));
    check('send-one lets the same check-in through once the line is gone', /morning held/.test(run('send-one', 'morning', '--text', 'Wednesday morning\n\n• 📅 Nothing on today or tomorrow\n\nAnything to sort before Friday?').stdout));
    writeFileSync(sentPath, kept);
  }
  {
    // A reminder is never held for a hard day; any other reason is kept, and shows as held.
    const rdir = makeTemp('rem-hold-');
    mkdirSync(join(rdir, 'core', 'calendar'), { recursive: true });
    writeFileSync(join(rdir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', reminders: [{ id: 'nutrition', text: 'Nutrition check-in', cron: '0 10-23 * * *', timing: 'judged', set: '2026-01-01' }] }));
    const rrun = (...a) => spawnSync(process.execPath, [script, ...a, '--record', rdir], { encoding: 'utf8' });
    const hard = rrun('hold', 'nutrition', '--why', 'today is a hard day');
    check('a reminder is never held for a hard day', hard.status === 1 && /not held/.test(hard.stdout) && !existsSync(join(rdir, 'core', 'calendar', 'reminders-sent.json')));
    check('a reminder held for another reason is kept as held, with why', /reminders: nutrition held \(no meal near\)/.test(rrun('hold', 'nutrition', '--why', 'no meal near').stdout));
    const row = JSON.parse(rrun('list', '--json').stdout || '{}').reminders?.[0];
    check('the list shows the reminder held, with its reason', row?.held?.why === 'no meal near');
  }
  const after = JSON.parse(run('list', '--json').stdout || '{}').reminders?.[0];
  check('the table shows it held, not missed, and sent nothing', after?.held?.why === 'a hard day' && !after.missed && after.sent === 0);
  run('archive');
  const left = JSON.parse(readFileSync(path, 'utf8'));
  check('archive keeps her check-ins file in its own shape, the stopped one moved', Array.isArray(left.check_ins) && left.check_ins.length === 1 && !left.reminders && existsSync(join(dir, 'archive', 'check-ins-2026.json')));
  check('the sent log is the check-ins own', existsSync(join(dir, 'core', 'calendar', 'check-ins-sent.json')) && !existsSync(join(dir, 'core', 'calendar', 'reminders-sent.json')));
}

// The audit of 2026-10-19: never a time before it was set; a failed send tried again; a
// reminder that never went shows as missed.
{
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { dueSince } = await import('../../../ux/scripts/reminders.mjs');
  const at = (s) => zonedToUtc({ y: +s.slice(0, 4), mo: +s.slice(5, 7), d: +s.slice(8, 10), H: +s.slice(11, 13), M: +s.slice(14, 16) }, SG);
  const file = { timezone: SG, reminders: [{ id: 'new', text: 'x', cron: '0 1 * * *', set: '2026-10-19 02:59' }, { id: 'old', text: 'y', cron: '0 1 * * *', set: '2026-10-18' }] };
  const due = dueSince(file, at('2026-10-18 23:06'), at('2026-10-19 03:05')).map((d) => d.id);
  check('a reminder never falls due for a time before it was set', !due.includes('new') && due.includes('old'));
  const dir = makeTemp('reminders-audit-');
  const path = join(dir, 'core', 'calendar', 'reminders.json');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(path, JSON.stringify({ timezone: SG, send: 'routine', sent_through: '2026-10-19 08:00', reminders: [{ id: 'gone', text: 'z', at: '2026-01-02 09:00', set: '2026-01-01' }] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8' });
  run('mark-sent', '2026-10-19 13:00', '--before', '2026-10-19 12:00');
  check('a failed send marks only up to the minute before it, so it is tried again', JSON.parse(readFileSync(path, 'utf8')).sent_through === '2026-10-19 11:59');
  check('a later --before never marks past the time given', (run('mark-sent', '2026-10-19 13:00', '--before', '2026-10-20 05:00'), JSON.parse(readFileSync(path, 'utf8')).sent_through === '2026-10-19 13:00'));
  check('an unreadable --before is refused, not ignored', run('mark-sent', '2026-10-19 14:00', '--before', 'soon').status === 1 && JSON.parse(readFileSync(path, 'utf8')).sent_through === '2026-10-19 13:00');
  const row = JSON.parse(run('list', '--json', '--all').stdout || '{}').reminders?.[0];
  check('one that never went out at all shows as missed', row?.sent === 0 && !!row?.missed);
}

// After a retry rolled the mark back, what already went is not sent again; check notes a set with no time.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-retry-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  const local = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: SG, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms).replace(',', '');
  const back = local(Date.now() - 30 * 60e3);
  writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', sent_through: local(Date.now() - 60 * 60e3), reminders: [
    { id: 'went', text: 'a', cron: '* * * * *', set: '2026-01-01 00:00' },
    { id: 'retry', text: 'b', cron: '* * * * *', set: '2026-01-01' },
  ] }));
  writeFileSync(join(dir, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ counts: { went: { sent: 1, first: back, last: local(Date.now() + 60e3) } }, sent: [] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8' });
  const plan = JSON.parse(run('send-due').stdout || '{}').due?.map((d) => d.id) ?? [];
  check('after a retry, one already sent for its slot is not planned again', !plan.includes('went') && plan.includes('retry'));
  check('check notes a set with no time', /note: retry: "set" has no time/.test(run('check').stdout));
}

// A reminder's reads name files of her record, nothing outside it (HBT-010 design 2).
{
  const ok = readReminders({ reminders: [{ id: 'a', text: 'x', cron: '0 12 * * *', reads: ['data/core/me/supplements.md'] }] });
  const out = readReminders({ reminders: [{ id: 'b', text: 'x', cron: '0 12 * * *', reads: ['../secrets.txt'] }] });
  check('reads must list files under data/, and nothing climbing out', !ok.errors.length && /"reads" should list files under data\//.test(out.errors[0] ?? ''));
}

// The sweep is the only sender (2026-10-26): a file it would skip is named, never silent.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-nosend-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, reminders: [{ id: 'r', text: 'x', cron: '0 9 * * *' }] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8' });
  const checked = run('check');
  check('check names a file without "send": "routine" as a problem, so it is never pushed unseen', checked.status === 1 && /does not read "send": "routine", so nothing sends it/.test(checked.stdout));
  check('send-due on such a file says plainly that nothing was sent', /NOT SENT: the file does not read "send": "routine"/.test(run('send-due').stdout));
}

{
  // A file left saying UTC once sent her 9am check-in at 5pm: her profile's timezone wins, and check flags the mismatch.
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = makeTemp('tz-');
  const dir = join(root, 'data');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(join(dir, 'PROFILE.yaml'), 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
  writeFileSync(join(dir, 'core', 'calendar', 'check-ins.json'), JSON.stringify({ timezone: 'UTC', send: 'routine', check_ins: [{ id: 'morning', text: 'Morning', cron: '0 9 * * *' }] }));
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const out = spawnSync(process.execPath, [script, 'check', '--kind', 'check-ins', '--record', dir], { encoding: 'utf8' }).stdout;
  check('her profile timezone wins over the file\'s', /09:00 .*\(Asia\/Singapore\)/.test(out));
  check('check flags a file whose timezone disagrees with her profile', /problem: the file says timezone UTC, her profile says Asia\/Singapore/.test(out));
  spawnSync(process.execPath, [script, 'mark-sent', '2026-10-21 08:00', '--kind', 'check-ins', '--record', dir], { encoding: 'utf8' });
  const { readFileSync } = await import('node:fs');
  check('the next save writes her profile timezone back into the file', JSON.parse(readFileSync(join(dir, 'core', 'calendar', 'check-ins.json'), 'utf8')).timezone === 'Asia/Singapore');
}


// T-330 edge cases: check refuses a one-off set for a time already past and a reminder that
// doubles another, and notes a day of the month that short months skip.
{
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = makeTemp('reminders-t330-');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const write = (reminders) => writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: SG, send: 'routine', reminders }));
  const run = () => spawnSync(process.execPath, [script, 'check', '--record', dir], { encoding: 'utf8' });
  write([{ id: 'late', text: 'a', at: '2026-10-28 09:00', set: '2026-10-28 15:00' }]);
  const late = run();
  check('check refuses a one-off whose time was past when it was set', late.status === 1 && /late: "at" is before it was set/.test(late.stdout));
  write([{ id: 'soon', text: 'a', at: '2026-10-29 09:00', set: '2026-10-28 15:00' }, { id: 'gone', text: 'b', at: '2026-10-28 09:00', set: '2026-10-28 15:00', ended: '2026-10-28' }]);
  check('a one-off still ahead, or one already ended, passes', run().status === 0);
  write([{ id: 'bins', text: 'Bin night', cron: '30 19 * * thu' }, { id: 'bins-2', text: 'bin night ', cron: '30 19 * * thu' }]);
  const twin = run();
  check('check refuses a reminder that repeats another\'s purpose and times', twin.status === 1 && /bins-2: repeats bins/.test(twin.stdout));
  write([{ id: 'bins', text: 'Bin night', cron: '30 19 * * thu', ended: '2026-10-28' }, { id: 'bins-2', text: 'Bin night', cron: '30 19 * * thu' }, { id: 'tue', text: 'Bin night', cron: '30 19 * * tue' }]);
  check('a move (old ended, new beside it) and the same purpose on another day pass', run().status === 0);
  write([{ id: 'rent', text: 'Rent', cron: '0 9 31 * *' }, { id: 'last', text: 'Rent', cron: '0 10 L * *' }]);
  const short = run();
  check('check notes a day 29-31 that short months skip, but passes it, and never notes L', short.status === 0 && /note: rent: day 31/.test(short.stdout) && !/note: last/.test(short.stdout));
  // Card A-099 (E-038): a nutrition update on a clock is noted, judged timing is not; neither is refused.
  write([{ id: 'nutrition-lunch', text: 'Nutrition before lunch', cron: '0 12 * * *', module: 'fitness' }, { id: 'nutrition', text: 'Nutrition before my next meal', cron: '0 10-23 * * *', module: 'fitness', timing: 'judged' }, { id: 'pill', text: 'Tablet', cron: '0 21 * * *' }]);
  const clock = run();
  check('check notes a nutrition update on fixed times, never judged timing or another reminder', clock.status === 0 && /note: nutrition-lunch: a nutrition update on fixed times/.test(clock.stdout) && !/note: nutrition: /.test(clock.stdout) && !/note: pill/.test(clock.stdout));
}

// Card A-172: a reminder the agent set unasked, from a to-do it heard in a chat. It goes once,
// to the Telegram chat its chat belongs to (a development chat's through the development bot),
// links back to that chat and no other, is never about medicine, and is held after a hard session.
// Everything here is invented: no record is read.
{
  const { inferredFault } = await import('./reminder-schedule.mjs');
  const { chatFor } = await import('./chat-link.mjs');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawn, spawnSync } = await import('node:child_process');
  const http = await import('node:http');
  const devUrl = 'https://claude.ai/code/session_DEVCHATxxxxxxxxxxxxx';
  const dayUrl = 'https://claude.ai/code/session_DAYCHATxxxxxxxxxxxxx';
  const later = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(Date.now() + 86400e3).replace(',', '');
  const inferred = { id: 'send-forms', emoji: '📮', text: 'Post the forms', at: later, inferred: true, bot: 'dev', chat: { url: devUrl, title: 'Build chat' } };

  check('a sound inferred reminder has no fault', inferredFault(inferred) === null);
  check('"bot" is only main or dev', /"bot" should be/.test(inferredFault({ ...inferred, bot: 'other' }) ?? '') && inferredFault({ id: 'x', text: 't', cron: '0 9 * * *', bot: 'dev' }) === null && inferredFault({ id: 'x', text: 't', cron: '0 9 * * *', bot: 'main' }) === null);
  check('"inferred" is only true', /"inferred" should be true/.test(inferredFault({ ...inferred, inferred: 'true' }) ?? ''));
  check('an inferred one goes once: never cron or every', /goes once/.test(inferredFault({ ...inferred, at: undefined, cron: '0 9 * * *' }) ?? '') && /goes once/.test(inferredFault({ ...inferred, at: undefined, every: '1 day', start: later }) ?? ''));
  check('an inferred one needs the chat it came from', /needs the "chat"/.test(inferredFault({ ...inferred, chat: undefined }) ?? '') && /not one Claude Code chat/.test(inferredFault({ ...inferred, chat: { url: 'https://example.com/x', title: 't' } }) ?? ''));
  check('an inferred one is never about medicine', /never about medicine/.test(inferredFault({ ...inferred, text: 'Take the evening tablet' }) ?? '') && /never about medicine/.test(inferredFault({ ...inferred, reads: ['data/fitness/supplements.md'] }) ?? ''));
  const read = readReminders({ timezone: 'UTC', reminders: [inferred, { ...inferred, id: 'bad-bot', bot: 'both' }, { ...inferred, id: 'no-chat', chat: undefined }] });
  check('an entry with a wrong bot or no chat is never planned to send', read.reminders.length === 1 && read.reminders[0].id === 'send-forms' && read.errors.length === 2);

  const chats = [{ url: devUrl, title: 'Build chat', kind: 'dev', state: 'open' }, { url: dayUrl, title: 'Day chat', kind: 'everyday', state: 'open' }];
  check('an inferred one links its own development chat, which a reminder she asked for never may', chatFor(inferred, {}, chats).chat?.url === devUrl && chatFor({ id: 'm', chat: inferred.chat }, {}, chats).fault === 'that is a development chat');
  check('the sweep can neither drop an inferred one\'s link nor point it elsewhere', chatFor(inferred, { none: true }, chats).fault !== null && chatFor(inferred, { url: dayUrl }, chats).fault !== null && chatFor(inferred, { url: devUrl }, chats).chat?.url === devUrl);

  // The chat it came from, and its bot, read by code from this chat's session id.
  const { thisChatFor } = await import('../../../ux/scripts/reminders.mjs');
  const devChat = thisChatFor({ id: 'cse_DEVCHATxxxxxxxxxxxxx', chats });
  check('this-chat links a listed development chat by its own name, to the development bot', devChat.chat?.url === devUrl && devChat.chat?.title === 'Build chat' && devChat.bot === 'dev');
  check('this-chat sends an everyday chat\'s to the main bot', thisChatFor({ id: 'session_DAYCHATxxxxxxxxxxxxx', chats }).bot === 'main');
  check('this-chat sends a chat switched to development mode to the development bot, even unlisted', thisChatFor({ id: 'cse_NEWCHATxxxxxxxxxxxxx', devMarked: true, title: 'New one' }).bot === 'dev');
  check('this-chat needs a known session id, and a name for a chat not on the list', /not known/.test(thisChatFor({ id: '' }).fault ?? '') && /--title/.test(thisChatFor({ id: 'cse_NEWCHATxxxxxxxxxxxxx' }).fault ?? ''));
  {
    // T-955: a chat switched on stays on, but a turn about his life is everyday (A-146): the real
    // command routes a reminder set on such a turn to the main bot, and on a building turn to dev.
    const { execFileSync: run } = await import('node:child_process');
    const { writeFileSync: put, rmSync: rm } = await import('node:fs');
    const { join: pj, dirname: pd } = await import('node:path');
    const { fileURLToPath: fp } = await import('node:url');
    const state = pj(pd(fp(import.meta.url)), '..', 'state');
    const sid = 'cse_TESTMIXEDxxxxxxxxxxxxx';
    const files = [pj(state, `dev-mode-${sid}`), pj(state, `turn-kind-${sid}`)];
    const cli = pj(pd(fp(import.meta.url)), '..', '..', '..', 'ux', 'scripts', 'reminders.mjs');
    const botFor = (kind) => { put(files[1], kind); return JSON.parse(run(process.execPath, [cli, 'this-chat', '--title', 'Mixed'], { env: { ...process.env, CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: sid }, encoding: 'utf8' })).bot; };
    try {
      put(files[0], new Date().toISOString());
      check('a switched-on chat on a building turn sends to the development bot', botFor('build') === 'dev');
      check('the same chat on a turn about his life sends to the main bot (T-955)', botFor('life') === 'main');
    } finally { for (const f of files) rm(f, { force: true }); }
  }

  // End to end, in a made-up record folder named data, so the hard-day hold can be judged.
  const root = makeTemp('reminders-a169-');
  const dir = join(root, 'data');
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  mkdirSync(join(dir, 'core', 'state'), { recursive: true });
  const path = join(dir, 'core', 'calendar', 'reminders.json');
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const write = (reminders) => writeFileSync(path, JSON.stringify({ timezone: 'UTC', send: 'routine', reminders }));
  const checkRun = () => spawnSync(process.execPath, [script, 'check', '--record', dir], { encoding: 'utf8' });
  write([inferred]);
  check('check passes a sound inferred reminder', checkRun().status === 0);
  write([{ ...inferred, bot: 'telegram' }]);
  const badBot = checkRun();
  check('check rejects a bot other than main or dev', badBot.status === 1 && /"bot" should be "main" or "dev"/.test(badBot.stdout));
  write([{ ...inferred, chat: undefined }]);
  check('check rejects an inferred one with no chat', /needs the "chat" it came from/.test(checkRun().stdout));
  write([{ ...inferred, inferred: 'yes' }]);
  check('check rejects "inferred" that is not true', checkRun().status === 1);
  writeFileSync(join(dir, 'core', 'state', 'chats.json'), JSON.stringify({ chats }));
  write([{ ...inferred, bot: undefined }]);
  const wrongBot = checkRun();
  check('check rejects a development chat\'s inferred reminder headed for the main bot', wrongBot.status === 1 && /development chat, so it goes to the development bot/.test(wrongBot.stdout));
  write([{ ...inferred, chat: { url: dayUrl, title: 'Day chat' } }]);
  check('check rejects an everyday chat\'s inferred reminder headed for the development bot', /everyday chat, so it goes to the main bot/.test(checkRun().stdout));
  write([inferred]);
  check('check passes a development chat\'s inferred reminder on the development bot, with its list kept', checkRun().status === 0);

  // A stand-in Telegram on this machine records which bot each message went through.
  const got = [];
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { got.push({ path: req.url, body: JSON.parse(b) }); res.end('{"ok":true}'); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { ...process.env, TELEGRAM_BOT_TOKEN: 'MAINKEY', TELEGRAM_DEV_BOT_TOKEN: 'DEVKEY', TELEGRAM_CHAT_ID: '1', TELEGRAM_API_TEST: `http://127.0.0.1:${server.address().port}` };
  const send = (id, text, extra = [], e = env) => new Promise((r) => { const p = spawn(process.execPath, [script, 'send-one', id, '--text', text, ...extra, '--record', dir], { env: e }); let o = ''; p.stdout.on('data', (c) => { o += c; }); p.on('close', (code) => r({ code, o })); });
  write([inferred, { id: 'bins', text: 'Bin night', cron: '30 19 * * thu' }, { id: 'dev-asked', text: 'Check the build', cron: '0 9 * * *', bot: 'dev' }]);
  const noDevKey = await send('send-forms', 'Forms go in the post today.', [], { ...env, TELEGRAM_DEV_BOT_TOKEN: '' });
  check('with no development key, a development reminder is not sent, never through the main bot', /not sent: this environment holds no development bot key/.test(noDevKey.o) && got.length === 0);
  const noLink = await send('send-forms', 'Forms go in the post today.', ['--no-chat']);
  check('the sweep cannot send an inferred one without its link', noLink.code === 1 && got.length === 0);
  const first = await send('send-forms', 'Forms go in the post today.');
  check('an inferred one from a development chat goes through the development bot', first.code === 0 && got[0]?.path === '/botDEVKEY/sendMessage' && got[0]?.body.chat_id === '1');
  check('it links back to the chat it came from', /Carry on in <a href="https:\/\/claude\.ai\/code\/session_DEVCHATxxxxxxxxxxxxx">Build chat<\/a>$/.test(got[0]?.body.text ?? ''));
  const again = await send('send-forms', 'One more nudge about the forms.');
  check('an inferred one never goes twice', again.code === 1 && /never goes twice/.test(again.o) && got.length === 1);
  await send('bins', 'Bins out tonight.');
  check('a reminder with no bot named goes through the main bot', got[1]?.path === '/botMAINKEY/sendMessage');
  await send('dev-asked', 'Time to look at the build.');
  check('a reminder asked for in a development chat goes through the development bot', got[2]?.path === '/botDEVKEY/sendMessage');
  // A hard session: the crisis marker's line today. One set unasked is held, never sent.
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, 'core', 'state', 'log.md'), `| ${today} · crisis · ongoing |\n`);
  write([{ ...inferred, id: 'call-back', text: 'Ring the garage back' }, { id: 'bins', text: 'Bin night', cron: '30 19 * * thu' }]);
  const hard = await send('call-back', 'The garage is waiting on your call.');
  check('after a hard session, an inferred one is held, not sent', /call-back held \(a hard day/.test(hard.o) && got.length === 3);
  const bins = await send('bins', 'Bins out tonight, gently.');
  check('after a hard session, a reminder she asked for still goes', /bins sent/.test(bins.o) && got.length === 4);
  const holdHard = spawnSync(process.execPath, [script, 'hold', 'call-back', '--why', 'hard day', '--record', dir], { encoding: 'utf8' });
  const holdAsked = spawnSync(process.execPath, [script, 'hold', 'bins', '--why', 'hard day', '--record', dir], { encoding: 'utf8' });
  check('a hard day is a reason to hold an inferred one, never one she asked for', holdHard.status === 0 && holdAsked.status === 1);
  server.close();
}

// A-177: a backup runner sends only what the usual sender left overdue, and every slot is claimed
// on main before it goes, so two runners never both send it. Two copies of a made-up record share
// a stand-in GitHub (a bare repository here) and a stand-in Telegram.
{
  const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { spawn, spawnSync, execFileSync } = await import('node:child_process');
  const http = await import('node:http');
  const { claimedElsewhere, CLAIM_FRESH_MS } = await import('../../../ux/scripts/reminders.mjs');
  const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
  const root = makeTemp('reminders-a177-');
  const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const loc = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  const now = Math.floor(Date.now() / 60e3) * 60e3;
  const due = loc(now - 120 * 60e3);
  g(root, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  g(root, 'clone', '-q', join(root, 'origin.git'), 'routine');
  const seed = join(root, 'routine');
  mkdirSync(join(seed, 'data', 'core', 'calendar'), { recursive: true });
  mkdirSync(join(seed, 'data', 'core', 'state'), { recursive: true });
  writeFileSync(join(seed, 'data', 'core', 'calendar', 'reminders.json'), JSON.stringify({ timezone: 'UTC', send: 'routine', reminders: [{ id: 'pill', text: 'Evening pill', at: due, set: loc(now - 180 * 60e3) }] }, null, 2));
  g(seed, 'add', '-A');
  g(seed, 'commit', '-q', '-m', 'seed');
  g(seed, 'push', '-q', 'origin', 'HEAD:main');
  g(root, 'clone', '-q', join(root, 'origin.git'), 'backup');
  const cli = (who, ...a) => spawnSync(process.execPath, [script, ...a, '--record', join(root, who, 'data')], { encoding: 'utf8' });
  const dueIds = (who, ...a) => { try { return JSON.parse(cli(who, 'send-due', ...a).stdout).due.map((d) => d.id).join(); } catch { return 'unreadable'; } };

  check('send-due lists a reminder two hours overdue', dueIds('routine') === 'pill');
  check('the backup lists it once it is past its wait', dueIds('backup', '--overdue', '90') === 'pill');
  check('the backup leaves one the usual sender still has time for', dueIds('backup', '--overdue', '150') === '');
  check('--overdue needs a number of minutes', cli('backup', 'send-due', '--overdue', 'soon').status === 1);

  const claimB = cli('backup', 'claim', 'pill', '--due', due, '--by', 'baxter');
  check('the backup claims the slot', claimB.status === 0 && /claimed by baxter/.test(claimB.stdout));
  check('another runner cannot claim a slot already claimed', cli('backup', 'claim', 'pill', '--due', due, '--by', 'cc-routine').status === 3);
  check('the same runner may claim again, as after a refused push', cli('backup', 'claim', 'pill', '--due', due, '--by', 'baxter').status === 0);
  g(join(root, 'backup'), 'add', '-A');
  g(join(root, 'backup'), 'commit', '-q', '-m', 'record: reminders claimed');
  g(join(root, 'backup'), 'push', '-q', 'origin', 'HEAD:main');

  const got = [];
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { got.push(JSON.parse(b)); res.end('{"ok":true}'); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { ...process.env, TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_CHAT_ID: '1', TELEGRAM_API_TEST: `http://127.0.0.1:${server.address().port}` };
  const send = (who, by, text) => new Promise((r) => { const p = spawn(process.execPath, [script, 'send-one', 'pill', '--text', text, '--due', due, '--by', by, '--record', join(root, who, 'data')], { env }); let o = ''; p.stdout.on('data', (c) => { o += c; }); p.on('close', (code) => r({ code, o })); });

  // The routine's own copy has not seen the claim: its last look at main finds it, and it stands back.
  const routine = await send('routine', 'cc-routine', 'Your evening pill is due.');
  check('the usual sender, coming back late, leaves a slot the backup claimed on main', /pill left: another runner has it on main/.test(routine.o) && got.length === 0);
  const backup = await send('backup', 'baxter', 'Evening pill time.');
  check('the backup sends it, and names it late', /^reminders: pill sent late \(1[12]\d min\)$/m.test(backup.o) && got.length === 1);
  g(join(root, 'backup'), 'add', '-A');
  g(join(root, 'backup'), 'commit', '-q', '-m', 'record: reminders sent');
  g(join(root, 'backup'), 'push', '-q', 'origin', 'HEAD:main');
  g(join(root, 'routine'), 'pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main');
  check('once the send is on main, the usual sender no longer lists it', dueIds('routine') === '');
  const again = await send('routine', 'cc-routine', 'Evening pill, one more time.');
  check('and its last look at main stops a second send', /left: another runner has it on main/.test(again.o) && got.length === 1);
  server.close();

  const log = [{ id: 'x', due, claimed: 'baxter', utc: new Date(now - CLAIM_FRESH_MS - 60e3).toISOString() }];
  check('a claim whose send died lapses, so the next sweep tries again', !claimedElsewhere(log, 'x', due, 'cc-routine', now) && claimedElsewhere([{ ...log[0], utc: new Date(now).toISOString() }], 'x', due, 'cc-routine', now));
  check('a claim never counts as a message sent', !JSON.stringify(JSON.parse(readFileSync(join(root, 'backup', 'data', 'core', 'calendar', 'reminders-sent.json'), 'utf8')).counts).includes('"sent":2'));
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
