// What a repair needs from the reminders tools (set-up edge cases, 2026-10-29): a file that
// cannot be read says so without quoting it, Telegram's own reason for a refusal is shown,
// a missed one-off is never filed away as sent, a clock change is named before the day,
// an hour the clocks repeat is not read as already sent, and a development chat can see
// the table's shape without a word of it.
//
//   node .claude/hooks/lib/test-reminders-repair.mjs
//
// Throwaway records in the system temp folder, invented text, a stand-in Telegram on
// 127.0.0.1 only. Exits non-zero on any failure.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { readReminders } from './reminder-schedule.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
};

const script = new URL('../../../ux/scripts/reminders.mjs', import.meta.url).pathname;
const base = makeTemp('reminders-repair-');
const env = { ...process.env };
delete env.TELEGRAM_BOT_TOKEN;
delete env.TELEGRAM_CHAT_ID;
const record = (name, tz = 'Asia/Singapore') => {
  const dir = join(base, name);
  mkdirSync(join(dir, 'core', 'calendar'), { recursive: true });
  writeFileSync(join(dir, 'PROFILE.yaml'), `mandatory:\n  timezone:\n    value: ${tz}\n    status: answered\n`);
  return dir;
};
const put = (dir, text) => writeFileSync(join(dir, 'core', 'calendar', 'reminders.json'), text);
const run = (dir, ...a) => spawnSync(process.execPath, [script, ...a, '--record', dir], { encoding: 'utf8', env });
const PLANTED = 'PLANTED-REMINDER-WORDS';

try {
  // C20: a broken file stops every command with one line, never its content, never a crash.
  const broken = record('broken');
  put(broken, `{"timezone":"Asia/Singapore","send":"routine","reminders":[{"id":"a","text":"${PLANTED}","at":"2027-03-14 02:30"}`);
  for (const cmd of [['check'], ['list'], ['list', '--shape'], ['archive'], ['mark-sent', '2026-11-01 01:00'], ['send-due'], ['hold', 'a'], ['routine', 'a'], ['due', '2026-11-01 01:00']]) {
    const r = run(broken, ...cmd);
    const out = r.stdout + r.stderr;
    check(`${cmd[0]}${cmd[1]?.startsWith('--') ? ` ${cmd[1]}` : ''} on a broken file says so, quoting none of it`, /not valid JSON/.test(out) && !out.includes(PLANTED) && !/at JSON\.parse|SyntaxError/.test(out));
  }
  check('send-due on a broken file never fails the sweep', run(broken, 'send-due').status === 0 && /nothing was sent/.test(run(broken, 'send-due').stdout));
  // Some parse errors quote the file itself ("Unexpected token ... is not valid JSON").
  put(broken, 'NOPE7 {}');
  check('a parse error that quotes the file is not passed on', !run(broken, 'check').stdout.includes('NOPE7'));
  put(broken, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', remindrs: [{ id: 'a', text: PLANTED, cron: '0 9 * * *' }] }));
  const misspelt = run(broken, 'send-due');
  check('a misspelt list key: send-due says nothing was sent, and does not crash', misspelt.status === 0 && /NOT SENT/.test(misspelt.stdout) && !misspelt.stderr);
  // A paused reminder ends at -Infinity: looking further ahead for it once looped for ever,
  // hanging check, list and the doctor (round 2 of the set-up edge cases, 2026-10-29).
  // A schedule that never fires (31 April) looked further ahead for ever, 1100 then 400 days
  // and round again: one look further, then it is finished (round 3, 2026-10-30).
  // "Within seconds" is the processor time the command spent, which it reports as it
  // exits, not the wall clock: on a loaded machine (load ~30, inside the commit gate)
  // every run waits its turn for a processor, and a wall-clock 10 s or 20 s failed with
  // nothing wrong. Work done is what a loop or a slowdown adds to, loaded or idle, so the
  // limits stay the old ones. A run that never ends is stopped at 90 s of wall time,
  // reports no time, and fails.
  const preload = join(base, 'cpu-time.mjs');
  writeFileSync(preload, "process.on('exit', () => { const u = process.cpuUsage(); process.stderr.write(`CPU-MS ${Math.round((u.user + u.system) / 1000)}\\n`); });\n");
  const withinSeconds = (cmd, limit) => {
    const out = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, script, ...cmd, '--record', broken], { encoding: 'utf8', env, timeout: 90000 });
    const ms = Number(String(out.stderr).match(/CPU-MS (\d+)/)?.[1] ?? NaN);
    if (out.status !== 0 || !(ms < limit)) console.log(`     ${cmd.join(' ')}: ${Number.isNaN(ms) ? 'no time reported' : `${ms} ms of processor time`} against ${limit} ms (status ${out.status})`);
    return out.status === 0 && ms < limit;
  };
  put(broken, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'n', text: 't', cron: '0 9 31 4,6 *', set: '2026-10-01 08:00' }] }));
  for (const cmd of [['check'], ['list', '--shape']]) {
    check(`${cmd.join(' ')} with a schedule that never fires answers within seconds`, withinSeconds(cmd, 20000));
  }
  put(broken, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'a', text: 't', cron: '0 9 * * *', set: '2026-10-01 08:00', paused: true }] }));
  for (const cmd of [['check'], ['list', '--shape']]) {
    check(`${cmd.join(' ')} with a paused reminder answers within seconds`, withinSeconds(cmd, 10000));
  }

  // C3: Telegram's own description is shown with the code; never the key or the chat.
  const tg = record('telegram');
  put(tg, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'n', text: 'invented purpose', cron: '0 9 * * *' }] }));
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user (chat 98765, key test-key-123)' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const tenv = { ...env, TELEGRAM_BOT_TOKEN: 'test-key-123', TELEGRAM_CHAT_ID: '98765', TELEGRAM_API_TEST: `http://127.0.0.1:${server.address().port}` };
  const refused = await new Promise((r) => {
    const p = spawn(process.execPath, [script, 'send-one', 'n', '--text', 'Fresh invented words.', '--record', tg], { env: tenv });
    let o = '';
    p.stdout.on('data', (c) => { o += c; });
    p.on('close', (code) => r({ code, o }));
  });
  server.close();
  check('a refusal prints Telegram\'s reason with its code', refused.code === 0 && /refused \(403: Forbidden: bot was blocked by the user/.test(refused.o));
  check('the refusal never prints the key or the chat id', !refused.o.includes('test-key-123') && !refused.o.includes('98765'));

  // C2: a one-off missed in an outage longer than the lookback is never archived as sent,
  // and the table keeps showing it as missed until it is stopped.
  const out = record('outage');
  put(out, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [
    { id: 'missed', text: 'invented one-off', at: '2026-01-05 09:00', set: '2026-01-04 10:00' },
    { id: 'went', text: 'invented one-off', at: '2026-01-06 09:00', set: '2026-01-04 10:00' },
  ] }));
  writeFileSync(join(out, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ counts: { went: { sent: 1, first: '2026-01-06 09:01', last: '2026-01-06 09:01' } }, sent: [] }));
  const said = run(out, 'archive').stdout;
  const left = JSON.parse(readFileSync(join(out, 'core', 'calendar', 'reminders.json'), 'utf8')).reminders.map((r) => r.id);
  check('archive files the one-off that went, and keeps the one that never went', /archived went/.test(said) && left.join() === 'missed');
  const listed = JSON.parse(run(out, 'list', '--json').stdout).reminders;
  check('the table shows the missed one-off, with its missed time', listed.length === 1 && listed[0].id === 'missed' && listed[0].missed === 'Mon 2026-01-05 09:00');
  put(out, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'missed', text: 'invented one-off', at: '2026-01-05 09:00', set: '2026-01-04 10:00', ended: '2026-10-29' }] }));
  check('once stopped, it is archived', /archived missed/.test(run(out, 'archive').stdout));

  // C4, C5: a time the clocks skip or repeat is named by check before the day.
  const ny = record('new-york', 'America/New_York');
  put(ny, JSON.stringify({ timezone: 'America/New_York', send: 'routine', reminders: [
    { id: 'gap', text: 't', at: '2027-03-14 02:30' },
    { id: 'daily', text: 't', cron: '30 2 * * *' },
    { id: 'nine', text: 't', cron: '0 9 * * *' },
  ] }));
  const c = JSON.parse(run(ny, 'check', '--json').stdout);
  check('a one-off in the skipped hour is named, with the day', c.notes.some((n) => /^gap: on 2027-03-14 the clocks skip 02:30/.test(n)));
  check('a daily in the skipped hour is named, with the day', c.notes.some((n) => /^daily: on 2027-03-14 the clocks skip/.test(n)));
  check('a 9am daily, clear of every change, is not named', !c.notes.some((n) => n.startsWith('nine:')));
  check('and the one-off still goes that day, the first minute after', c.reminders.find((r) => r.id === 'gap')?.next[0] === 'Sun 2027-03-14 03:00');
  const sg = record('singapore');
  put(sg, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'early', text: 't', cron: '30 2 * * *' }] }));
  check('in a zone with no clock change nothing is named', JSON.parse(run(sg, 'check', '--json').stdout).notes.length === 0);

  // C6: the second 01:30 of an hourly interval on the night the clocks go back is its own slot.
  const { slotHandled } = await import(script);
  const tally = { i: { sent: 1, first: '2026-11-01 01:35', last: '2026-11-01 01:35', lastUtc: '2026-11-01T05:35:00.000Z' } };
  check('a slot an hour after the last send, at the same wall time, is not read as sent', slotHandled({ id: 'i', at: Date.parse('2026-11-01T06:30:00Z') }, 'America/New_York', tally, []) === false);
  check('the slot that send covered is read as sent', slotHandled({ id: 'i', at: Date.parse('2026-11-01T05:30:00Z') }, 'America/New_York', tally, []) === true);
  check('an old tally with local times only still reads as before', slotHandled({ id: 'i', at: Date.parse('2026-11-01T05:30:00Z') }, 'America/New_York', { i: { sent: 1, last: '2026-11-01 01:35' } }, []) === true);
  check('a hold kept as an instant covers its own slot only', slotHandled({ id: 'i', at: Date.parse('2026-11-01T06:30:00Z') }, 'America/New_York', {}, [{ id: 'i', held: true, at: '2026-11-01 01:35', utc: '2026-11-01T05:35:00.000Z' }]) === false);
  const interval = readReminders({ timezone: 'America/New_York', reminders: [{ id: 'i', text: 't', every: '1 hour', start: '2026-11-01 00:30' }] }).reminders[0];
  check('the engine has both 01:30s for a real-time interval', interval.fires(Date.parse('2026-11-01T05:30:00Z')) && interval.fires(Date.parse('2026-11-01T06:30:00Z')));

  // C23: the table's shape, with no word she wrote, for a chat that is not hers.
  const shape = record('shape');
  put(shape, JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'r1', emoji: '🌙', text: PLANTED, cron: '0 23 * * *', set: '2026-10-01 09:00' }] }));
  writeFileSync(join(shape, 'core', 'calendar', 'reminders-sent.json'), JSON.stringify({ sent: [{ id: 'r1', at: '2026-10-02 23:00', text: `${PLANTED}-sent` }, { id: 'r1', at: '2026-10-03 23:00', held: true, why: `${PLANTED}-why` }] }));
  const s = run(shape, 'list', '--shape');
  const sj = JSON.parse(s.stdout);
  check('list --shape prints no text, emoji, message or reason', !s.stdout.includes(PLANTED) && !s.stdout.includes('🌙'));
  check('list --shape prints no id, a slug of what it is for (C22)', !s.stdout.includes('r1') && !('id' in sj.reminders[0]));
  check('list --shape keeps place, state, counts, missed and next', sj.reminders[0].n === 1 && sj.reminders[0].state === 'live' && sj.reminders[0].sent === 1 && 'missed' in sj.reminders[0] && sj.reminders[0].next && typeof sj.archived === 'number');
} finally {
  rmSync(base, { recursive: true, force: true });
}

if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log('reminders repair test: all passed');
