#!/usr/bin/env node
// Checks her reminders file before it is pushed, and shows when each one will fire.
//
// The reminders themselves are sent by the hourly sweep (send-due, then send-one,
// HBT-010 design 2), with the schedule engine in .claude/hooks/lib/reminder-schedule.mjs;
// this script reads every file with that same engine, so what it shows is what the sweep will do.
//
//   node ux/scripts/reminders.mjs check            the file as it stands: problems, then
//                                                  each reminder's next three times
//   node ux/scripts/reminders.mjs check --json     the same, as JSON
//   node ux/scripts/reminders.mjs preview '<json>' one reminder not yet written, e.g.
//                                                  '{"cron":"0 9 * * 4"}', in her timezone
//   node ux/scripts/reminders.mjs due '<YYYY-MM-DD HH:MM>'
//                                                  which would go out that minute
//   node ux/scripts/reminders.mjs list [--json]    the reminders still on or paused, in the
//                                                  order set, for the table she is shown:
//                                                  created, emoji, text, times sent, last
//                                                  sent, state, next; and how many stopped
//                                                  ones the archive keeps. --all shows those too;
//                                                  one missed stays listed until it is handled
//   node ux/scripts/reminders.mjs list --shape     the same rows with no word she wrote, and no
//                                                  id (a slug of her words): place in the list,
//                                                  state, times sent, last, missed, next, as
//                                                  JSON, for a development chat or a repair
//   node ux/scripts/reminders.mjs archive          moves every stopped or spent reminder to
//                                                  archive/reminders-<year>.json, never losing
//                                                  one: run straight after a stop
//   node ux/scripts/reminders.mjs send-due         with "send": "routine", the sweep's first
//                                                  step (HBT-010 design 2): lists, as JSON, each
//                                                  reminder due since sent_through, with what it
//                                                  is for and its last messages, and "through";
//                                                  it sends nothing: never a fixed line; with
//                                                  --kind check-ins, also "saidLately", every
//                                                  check-in sent in the last six days;
//                                                  --overdue <min> lists only what the usual
//                                                  sender has left that long (A-177), and
//                                                  "missed" names any past the lookback
//   node ux/scripts/reminders.mjs claim <id> --due "<YYYY-MM-DD HH:MM>" --by <runner>
//                                                  claims a slot before sending it, pushed to
//                                                  main first, so two runners never both send
//                                                  it; exit 3 when it is not this runner's
//   node ux/scripts/reminders.mjs send-one <id> --text "<fresh words>" [--due "<due>" --by <runner>]
//                                                  with --due and --by, looks at main just
//                                                  before sending and leaves a slot another
//                                                  runner has; names a send over 75 min late
//                                                  sends one, in words the sweep wrote now, with
//                                                  TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; a
//                                                  repeat or the purpose as written is refused,
//                                                  and a check-in line an earlier check-in said
//                                                  (not about today or tomorrow, T-811);
//                                                  a reminder naming a "chat" ends with its link
//                                                  (.claude/hooks/lib/chat-link.mjs, card A-128);
//                                                  one reading "bot": "dev" goes through the
//                                                  development bot, TELEGRAM_DEV_BOT_TOKEN, to
//                                                  TELEGRAM_CHAT_ID, never the main one (card
//                                                  A-172); one set unasked ("inferred") goes
//                                                  once, links only its own chat, and is held,
//                                                  never sent, after a hard session
//   node ux/scripts/reminders.mjs mark-sent "<YYYY-MM-DD HH:MM>"
//                                                  moves sent_through forward to that time, so
//                                                  nothing sent goes twice; never backward
//   node ux/scripts/reminders.mjs this-chat [--title "<its name>"]
//                                                  the chat this runs in, for a reminder set
//                                                  unasked (card A-172): its "chat" link and its
//                                                  "bot", dev in a development chat, else main
//   node ux/scripts/reminders.mjs routine <id>     one routine per reminder instead: an unused
//                                                  option, kept beside the sweep; its name,
//                                                  schedule and prompt, as JSON
//
// --record <dir> reads another record folder instead of data/ (data-sandbox/, a test).
// Exits 1 when the file has a problem, so a broken file is never pushed unseen.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readProfile } from '../../.claude/hooks/lib/profile-schema.mjs';
import { chatFaults, chatFor, messageFor, readChats } from '../../.claude/hooks/lib/chat-link.mjs';
import { appointmentNotes } from '../../.claude/hooks/lib/opening.mjs';
import { BOTS, REMINDERS_PATH, clockChangeHits, inferredFault, formatLocal, localParts, nextTimes, parseCron, parseEvery, parseLocal, readReminders, zonedToUtc } from '../../.claude/hooks/lib/reminder-schedule.mjs';
import { telegramPost } from '../../.claude/hooks/lib/telegram-post.mjs';
import { devModeActive } from '../../.claude/hooks/lib/dev-mode.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const recordDir = flag('--record') ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
// --kind check-ins works her check-ins file the same way (HBT-014): the same schedules,
// table and archive, a question written for each, and the nudge's gates on every send.
const KIND = flag('--kind') === 'check-ins' ? 'check-ins' : 'reminders';
const LIST_KEY = KIND === 'check-ins' ? 'check_ins' : 'reminders';
const file = KIND === 'check-ins' ? join(recordDir, 'core', 'calendar', 'check-ins.json') : join(recordDir, REMINDERS_PATH.replace(/^data\//, ''));
// Every save writes her profile's timezone, so a file that drifted is set right by the next one.
const save = (loaded) => {
  const { reminders, fileTimezone, timezone: _tz, ...rest } = loaded;
  const out = { timezone: timezone(loaded), ...rest, [LIST_KEY]: reminders };
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
};

/**
 * The sweep's mark moved by its one line only, leaving the rest of the file as the skill
 * wrote it: a whole-file rewrite on the first mark changed 40 lines, so a reminder she
 * added at the same time conflicted with it and never reached main (round 3, B12). False
 * when the file is not in a shape this can touch safely, or its timezone needs setting
 * right: the caller then saves the whole file.
 */
function markInPlace(through, loaded) {
  if ((loaded.fileTimezone ?? null) !== loaded.timezone) return false;
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  const value = JSON.stringify(through);
  const line = /^( *)"sent_through": *"[^"\n]*"(,?)[ \t]*$/m;
  const next = line.test(raw)
    ? raw.replace(line, (_, pad, comma) => `${pad}"sent_through": ${value}${comma}`)
    : /^\{\n( +)"/.test(raw) ? raw.replace(/^\{\n( +)/, (_, pad) => `{\n${pad}"sent_through": ${value},\n${pad}`) : null;
  if (next === null) return false;
  try {
    const before = JSON.parse(raw);
    const after = JSON.parse(next);
    if (after.sent_through !== through) return false;
    delete after.sent_through;
    delete before.sent_through;
    if (JSON.stringify(Object.entries(after).sort()) !== JSON.stringify(Object.entries(before).sort())) return false;
  } catch {
    return false;
  }
  writeFileSync(file, next);
  return true;
}

/** Her timezone: her profile's, else the file's, else UTC. The profile wins, so a file left saying another zone can't move her times (a check-in once went at 5pm, set to UTC). */
export function herTimezone(root) {
  const profile = join(root, 'data', 'PROFILE.yaml');
  return (existsSync(profile) && readProfile(readFileSync(profile, 'utf8')).value.timezone) || null;
}
function profileTimezone() {
  const profile = join(recordDir, 'PROFILE.yaml');
  return (existsSync(profile) && readProfile(readFileSync(profile, 'utf8')).value.timezone) || null;
}
function timezone(loaded) {
  return profileTimezone() || loaded?.timezone || 'UTC';
}

const load = () => {
  if (!existsSync(file)) return null;
  const j = JSON.parse(readFileSync(file, 'utf8'));
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('the file is not a JSON object');
  if (LIST_KEY !== 'reminders') { j.reminders = j[LIST_KEY] ?? []; delete j[LIST_KEY]; }
  // Times read in hers, from her profile, never UTC by accident; the file's own is kept for check to compare.
  // No list at all is an empty file; a list under another key is a misspelling, left for send-due to refuse.
  if (j.reminders === undefined && !Object.values(j).some(Array.isArray)) j.reminders = [];
  j.fileTimezone = j.timezone;
  j.timezone = timezone(j);
  return j;
};
/**
 * Why the file cannot be read, in one line that never quotes it: a parse error can carry a
 * piece of the file, and the file holds her words (2026-10-29: list and mark-sent echoed a
 * reminder's text to stderr). Only where it broke is said.
 */
const unreadable = (e) => {
  const at = /position (\d+)/.exec(String(e?.message ?? ''))?.[1];
  return `${KIND}: the file is not valid JSON${at ? ` (it breaks near character ${at})` : ''}`;
};
/** The file for a command, or null when there is none; an unreadable one stops the command with that line. */
const loadOrStop = (code = 1, tail = '', lead = '') => {
  try {
    return load();
  } catch (e) {
    console.log(`${unreadable(e).replace(`${KIND}: `, `${KIND}: ${lead}`)}${tail}`);
    process.exit(code);
  }
};

const show = (ms, tz) => {
  const p = localParts(ms, tz);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.dow]} ${formatLocal(p)}`;
};

function report(loaded, now = Date.now()) {
  const { errors, reminders } = readReminders(loaded);
  const raw = new Map(loaded.reminders?.map((r) => [r?.id, r]) ?? []);
  const rows = reminders.map((r) => {
    const next = nextTimes(r, now, 3);
    const state = raw.get(r.id)?.paused === true ? 'paused' : raw.get(r.id)?.ended ? 'ended' : next.length ? 'live' : 'never fires again';
    return { id: r.id, text: r.text, timezone: r.timeZone, state, next: next.map((ms) => show(ms, r.timeZone)) };
  });
  return { errors, rows };
}

/**
 * The minutes a reminder was due between the day it was set and `now`: how many, and the
 * last. Read from its schedule, for a file the sweep does not send (no "send": "routine"),
 * which keeps no log of what went, so this is what was due, not proof that Telegram
 * delivered it. A reminder
 * paused now counts as paused throughout, since no record says when it was paused.
 */
function pastTimes(r, raw, now) {
  // A windowed one-off goes once in its window, so it counts once, at the window's start.
  if (r.windowed) return r.windowed.from <= now && raw?.paused !== true ? { sent: 1, last: r.windowed.from } : { sent: 0, last: null };
  const from = [raw?.set, raw?.start, raw?.at].map((t) => parseLocal(t)).filter(Boolean).map((p) => zonedToUtc(p, r.timeZone));
  if (!from.length) return { sent: 0, last: null };
  const end = Math.min(now, r.lastMs ?? Infinity);
  let sent = 0;
  let last = null;
  for (let ms = Math.ceil(Math.min(...from) / 60e3) * 60e3; ms <= end; ms += 60e3) if (r.fires(ms)) { sent++; last = ms; }
  return { sent, last };
}

/**
 * A claim holds a slot this long (A-177): two runners may send, so each claims a slot on main
 * before sending it, and the other then leaves it alone. Long enough to send; short enough that a
 * claim whose send died is tried again by the next sweep.
 */
export const CLAIM_FRESH_MS = 20 * 60e3;

/** A fresh claim on this slot (id and due time, local) by a runner other than `by` (A-177). */
export function claimedElsewhere(log, id, due, by, now = Date.now()) {
  return (log ?? []).some((m) => m?.id === id && m.claimed && m.due === due && m.claimed !== by && now - Date.parse(m.utc) < CLAIM_FRESH_MS);
}

/** At most this far back a sweep looks, so a long outage sends each missed reminder once, not a flood. */
const LOOKBACK_MS = 48 * 3600e3;

/** The archive files of stopped reminders, never the sent log's (reminders-sent-<year>.json). */
const archiveDir = () => join(recordDir, 'archive');
const archiveFiles = () => (existsSync(archiveDir()) ? readdirSync(archiveDir()).filter((f) => new RegExp(`^${KIND}-\\d{4}\\.json$`).test(f)) : []);
const archived = () => archiveFiles().flatMap((f) => { try { return JSON.parse(readFileSync(join(archiveDir(), f), 'utf8'))[LIST_KEY] ?? []; } catch { return []; } });

/**
 * Move each stopped reminder (`ended`) and each one-off already past out of her reminders
 * file into archive/reminders-<year>.json, the year it stopped, so the file and her table
 * hold only what still runs. Nothing is deleted: an id is written to the archive before it
 * leaves the file. Returns the ids moved.
 */
export function archiveStopped(loaded, now = Date.now()) {
  const { reminders } = readReminders(loaded);
  // A one-off leaves only once the sweep's lookback has passed it, so one not yet sent is never moved.
  const spent = new Set(reminders.filter((r) => !nextTimes(r, now - LOOKBACK_MS, 1).length).map((r) => r.id));
  // Sent by the sweep, a one-off past its time that Telegram never accepted, and the sweep
  // never held, was missed (an outage longer than the lookback): it stays, listed as missed,
  // until it is stopped, never filed away as sent (2026-10-29).
  const tally = tallies();
  const held = new Set(readSent().filter((m) => m.held).map((m) => m.id));
  const handled = (e) => loaded.send !== 'routine' || (tally[e.id]?.sent ?? 0) > 0 || held.has(e.id);
  const out = (loaded.reminders ?? []).filter((e) => e?.ended || (e?.at && spent.has(e.id) && !e.paused && handled(e)));
  if (!out.length) return [];
  const byYear = new Map();
  for (const e of out) {
    const year = String(e.ended ?? e.at ?? e.set ?? '').slice(0, 4) || String(new Date(now).getUTCFullYear());
    byYear.set(year, [...(byYear.get(year) ?? []), e]);
  }
  mkdirSync(archiveDir(), { recursive: true });
  for (const [year, entries] of byYear) {
    const path = join(archiveDir(), `${KIND}-${year}.json`);
    const kept = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { _what: `${KIND === 'check-ins' ? 'Check-ins' : 'Reminders'} she stopped, or one-offs already sent, moved from core/calendar/${KIND}.json. Never deleted.`, [LIST_KEY]: [] };
    kept[LIST_KEY] ??= [];
    const have = new Set(kept[LIST_KEY].map((r) => `${r.id}|${r.set}`));
    kept[LIST_KEY].push(...entries.filter((e) => !have.has(`${e.id}|${e.set}`)));
    writeFileSync(path, `${JSON.stringify(kept, null, 2)}\n`);
  }
  loaded.reminders = loaded.reminders.filter((e) => !out.includes(e));
  save(loaded);
  return out.map((e) => e.id);
}

function list(loaded, now = Date.now(), { all = false } = {}) {
  if (all) loaded = { ...loaded, reminders: [...archived(), ...(loaded.reminders ?? [])] };
  const { errors, reminders } = readReminders(loaded);
  const byRoutine = loaded.send === 'routine';
  const tally = tallies();
  const log = readSent();
  const raw = new Map(loaded.reminders?.map((r) => [r?.id, r]) ?? []);
  const order = new Map(loaded.reminders?.map((r, i) => [r?.id, i]) ?? []);
  const rows = reminders
    .map((r) => {
      const e = raw.get(r.id);
      const next = nextTimes(r, now, 1);
      const due = pastTimes(r, e, now);
      // Sent by the sweep, the count and time are what Telegram accepted; otherwise they
      // are worked out from the schedule, as nothing comes back (HBT-010 design 2).
      const t = byRoutine ? tally[r.id] : null;
      const sent = byRoutine ? t?.sent ?? 0 : due.sent;
      const lastMs = byRoutine ? (t ? instant(t.lastUtc, t.last, r.timeZone) : null) : due.last;
      const heldAt = log.filter((m) => m.id === r.id && m.held).map((m) => instant(m.utc, m.at, r.timeZone)).sort((a, b) => a - b).at(-1) ?? null;
      const setP = parseLocal(e?.set);
      const firstMs = t ? zonedToUtc(parseLocal(t.first), r.timeZone) : e?.start ? zonedToUtc(parseLocal(e.start), r.timeZone) : heldAt ?? (setP ? zonedToUtc(setP, r.timeZone) : null);
      // Missed: due over 70 minutes ago, after it was first sent or started, with nothing sent or held since.
      const handled = Math.max(lastMs ?? -Infinity, heldAt ?? -Infinity);
      const missed = byRoutine && due.last !== null && firstMs !== null && due.last >= firstMs && now - due.last > 70 * 60e3 && !(handled >= due.last) ? due.last : null;
      const held = heldAt !== null && heldAt > (lastMs ?? -Infinity) ? { at: show(heldAt, r.timeZone), why: log.filter((m) => m.id === r.id && m.held).at(-1)?.why ?? null } : null;
      const state = e?.paused === true ? 'paused' : e?.ended ? 'ended' : next.length ? 'live' : 'finished';
      const schedule = e.at !== undefined ? { at: e.at } : e.cron !== undefined ? { cron: e.cron } : { every: e.every };
      return { id: r.id, created: e.set ?? null, emoji: e.emoji ?? null, text: r.text, schedule, inferred: e.inferred === true, bot: e.bot ?? 'main', start: e.start ?? null, until: e.until ?? null, sent, last: lastMs === null ? null : show(lastMs, r.timeZone), counted: byRoutine ? 'accepted' : 'due', held, missed: missed === null ? null : show(missed, r.timeZone), state, next: next.length ? show(next[0], r.timeZone) : null };
    })
    // A missed one-off stays in view after its time, until it is stopped (2026-10-29).
    .filter((row) => all || row.state === 'live' || row.state === 'paused' || (row.state === 'finished' && row.missed !== null))
    .sort((a, b) => String(a.created ?? '').localeCompare(String(b.created ?? '')) || order.get(a.id) - order.get(b.id))
    .map((row, i) => ({ n: i + 1, ...row }));
  return { errors, rows, archived: archived().length };
}

/** A list row with no word she wrote: no text, emoji, schedule or reason, for a chat that is not hers (repair.md: shape only). */
// No id either: an id is a slug of what the reminder is for (`evening-tablet`), so `n`,
// its place in the list, names the row (round 2, C22).
export const shapeOf = (row) => ({ n: row.n, state: row.state, counted: row.counted, sent: row.sent, last: row.last, missed: row.missed, held: row.held ? row.held.at : null, next: row.next });

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MARK = 'DEAR_REMINDER';

/**
 * The routine that sends one reminder (HBT-010 design 2). A routine runs at most hourly
 * and starts with no repository, so its prompt carries the reminder's words and posts them
 * itself with the environment's TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. Returns
 * { name, run_once_at | cron_expression, prompt }, or { error } when a routine of its own
 * cannot carry it; the hourly sweep still can (send-due).
 */
export function routineFor(entry, tz) {
  if (!entry) return { error: 'no reminder with that id' };
  if (entry.paused === true || entry.ended) return { error: 'it is paused or ended, so no routine should send it' };
  const text = String(entry.text ?? '').trim();
  if (!text) return { error: 'it has no text' };
  if (text.split('\n').some((line) => line.trim() === MARK)) return { error: `its text holds the line ${MARK}` };
  const out = { name: `⏰ Dear reminder • ${entry.id}` };
  if (entry.at !== undefined) {
    const p = parseLocal(entry.at);
    if (!p) return { error: '"at" should read "YYYY-MM-DD HH:MM"' };
    out.run_once_at = new Date(zonedToUtc(p, tz)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  } else if (entry.cron !== undefined) {
    const f = String(entry.cron).trim().split(/\s+/);
    if (f.length !== 5) return { error: 'its cron needs five fields' };
    try { parseCron(entry.cron); } catch (e) { return { error: e.message }; }
    if (!/^\d+$/.test(f[0])) return { error: 'it fires more than once an hour, which a routine of its own cannot carry; the hourly sweep sends it' };
    if (/L/i.test(f[2])) return { error: '"L" (the last day of the month) is not a routine schedule; the hourly sweep sends it' };
    out.cron_expression = `CRON_TZ=${tz} ${f.join(' ')}`;
  } else if (entry.every !== undefined) {
    let n, unit;
    try { ({ n, unit } = parseEvery(entry.every)); } catch (e) { return { error: e.message }; }
    const s = parseLocal(entry.start);
    if (!s) return { error: '"every" needs a "start"' };
    const dow = DAYS[new Date(Date.UTC(s.y, s.mo - 1, s.d)).getUTCDay()];
    const cron = n !== 1 ? null : { day: `${s.M} ${s.H} * * *`, week: `${s.M} ${s.H} * * ${dow}`, month: `${s.M} ${s.H} ${s.d} * *`, year: `${s.M} ${s.H} ${s.d} ${s.mo} *` }[unit];
    if (!cron) return { error: `every ${entry.every} has no routine schedule; the hourly sweep sends it` };
    out.cron_expression = `CRON_TZ=${tz} ${cron}`;
  } else return { error: 'it needs one of "at", "cron" or "every"' };
  const guard = [entry.start && entry.every === undefined ? `before ${String(entry.start).slice(0, 10)}` : '', entry.until ? `after ${String(entry.until).slice(0, 10)}` : '']
    .filter(Boolean)
    .join(' or ');
  out.prompt = [
    'You are one reminder from Dear, sent with no one present. Send the message below to Telegram exactly once, then stop. Read and change nothing else, and send nothing else.',
    guard ? `First run \`TZ=${tz} date +%F\`. If today is ${guard}, send nothing and stop.` : '',
    'Run exactly this command:',
    '',
    `curl -sS -X POST "https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/sendMessage" --data-urlencode "chat_id=\${TELEGRAM_CHAT_ID}" --data-urlencode "text@-" <<'${MARK}'`,
    `⏰ ${text}`,
    MARK,
    '',
    'If the reply holds "ok":true, you are done. If TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is empty, or the reply is not ok, say why in one line, never printing the key, and stop.',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
  return out;
}

/**
 * When a send or hold happened: its UTC instant where kept, else its local time read in her
 * zone. A local time repeats in the hour the clocks go back, so an instant is kept from now
 * on and compared instead (2026-10-29: an hourly interval's second 01:30 read as already sent).
 */
const instant = (utc, local, tz) => {
  const ms = Date.parse(utc ?? '');
  if (!Number.isNaN(ms)) return ms;
  const p = parseLocal(local);
  return p ? zonedToUtc(p, tz) : null;
};

/**
 * A check-in's update never says again what an earlier one said (HBT-010, "never the same words
 * twice"; card A-129, "nothing said twice"; T-811: one coming date in five mornings running). A
 * line of a message, its first line and its question aside, is a repeat when most of its words
 * were in a line of a check-in sent in the last SAID_DAYS days (all check-ins, not only its own).
 * A line about today, tonight or tomorrow is never one: the calendar goes every morning (A-124),
 * and a coming date is said again the day before and on the day. A line a week out is never one
 * either: a big date comes back a week before (A-176).
 */
export const SAID_DAYS = 6;
const STOP = new Set('the and for are but not you your its it’s it\'s was were has have had this that with from into onto out off all any can will just still what when where who how why then than them they she her his him our ours there here been being also very more most much some only over such too nothing'.split(' '));
const NEAR = /\b(today|tonight|tomorrow|this (morning|afternoon|evening)|in (a|one) week|a week (away|from now|to go))\b/i;
/** The words a line says, without emoji, marks or small words. */
export const lineWords = (line) => new Set(String(line ?? '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
/** The lines of a message that can repeat: not its first line (the heading), not a question, not about today or tomorrow. */
const updateLines = (text) => String(text ?? '').split('\n').slice(1).map((l) => l.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, '').trim()).filter((l) => l && !/\?\s*$/.test(l) && !NEAR.test(l));
/** Two lines say the same thing when three-quarters of the shorter one's words, three at least, are in the other. */
export function sameLine(a, b) {
  const [x, y] = [lineWords(a), lineWords(b)].sort((p, q) => p.size - q.size);
  if (x.size < 3) return false;
  let n = 0;
  for (const w of x) if (y.has(w)) n += 1;
  return n / x.size >= 0.75;
}
/** Each line of `text` that an earlier message said: its number in `text` (1 is the first) and when. Never the words. */
export function repeatedLines(text, earlier = [], now = Date.now()) {
  const recent = earlier.filter((m) => m && !m.held && typeof m.text === 'string' && now - (Date.parse(m.utc ?? '') || Date.parse(`${String(m.at ?? '').replace(' ', 'T')}Z`) || 0) <= SAID_DAYS * 86400e3);
  const lines = String(text ?? '').split('\n');
  const out = [];
  for (const l of updateLines(text)) {
    const hit = recent.find((m) => updateLines(m.text).some((o) => sameLine(l, o)));
    if (hit) out.push({ line: lines.findIndex((x) => x.includes(l)) + 1, at: hit.at ?? hit.utc ?? '' });
  }
  return out;
}

/** The messages sent, newest last, kept so the next for a reminder differs (HBT-010 design 2). */
const SENT_KEEP = 5;
const sentFile = () => join(recordDir, 'core', 'calendar', `${KIND}-sent.json`);
/** Past this, a send is named late in the developer's report (A-177): the hourly sweep plus its own run. */
export const LATE_MIN = 75;
/** The sent log as GitHub's main holds it now, or null when it cannot be read (A-177). */
function sentOnMain() {
  try {
    const top = execFileSync('git', ['-C', recordDir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    execFileSync('git', ['-C', top, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore', timeout: 60e3 });
    const rel = relative(top, sentFile()).split(sep).join('/');
    return JSON.parse(execFileSync('git', ['-C', top, 'show', `origin/main:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}
const readSentFile = () => { try { return JSON.parse(readFileSync(sentFile(), 'utf8')); } catch { return {}; } };
const readSent = () => readSentFile().sent ?? [];
/**
 * Each reminder's tally of messages Telegram accepted: how many, the first and the last,
 * local "YYYY-MM-DD HH:MM" (HBT-010 design 2). Before the tally existed, counted from the log.
 */
export function tallies(file = readSentFile()) {
  if (file.counts && Object.keys(file.counts).length) return file.counts;
  const out = {};
  for (const m of file.sent ?? []) {
    if (m.held || m.claimed) continue;
    const t = (out[m.id] ??= { sent: 0, first: m.at, last: m.at });
    t.sent += 1;
    if (m.at < t.first) t.first = m.at;
    if (m.at > t.last) t.last = m.at;
  }
  return out;
}
/**
 * Two copies of a sent log made one, nothing lost: every message and hold from both, once each,
 * in time order, and each tally the larger of the two. The sweep sends from the folder it was
 * started in, then saves from its own checkout, and a copy laid over the checkout's file is
 * refused by the record guard and would drop anything only the checkout held (2026-10-29: a
 * check-in's sent entry stayed unsaved on the routine's copy).
 */
export function mergeSent(a = {}, b = {}) {
  const key = (m) => `${m.id}|${m.claimed ? `claim:${m.claimed}` : m.held ? 'held' : 'sent'}|${m.at}|${m.text ?? m.why ?? m.due ?? ''}`;
  const seen = new Map();
  for (const m of [...(a.sent ?? []), ...(b.sent ?? [])]) if (!seen.has(key(m))) seen.set(key(m), m);
  const sent = [...seen.values()].sort((x, y) => String(x.utc ?? x.at).localeCompare(String(y.utc ?? y.at)));
  const counts = {};
  for (const id of new Set([...Object.keys(a.counts ?? {}), ...Object.keys(b.counts ?? {})])) {
    const [x, y] = [a.counts?.[id], b.counts?.[id]];
    if (!x || !y) { counts[id] = { ...(x ?? y) }; continue; }
    const later = String(x.last) >= String(y.last) ? x : y;
    counts[id] = { sent: Math.max(x.sent, y.sent), first: String(x.first) <= String(y.first) ? x.first : y.first, last: later.last, ...(later.lastUtc ? { lastUtc: later.lastUtc } : {}) };
  }
  return { ...b, ...a, counts, sent };
}

/**
 * The one shape the sent log is written in, by a send, a hold and a carry alike: every entry in
 * time order, the last SENT_KEEP sends and, apart, the last SENT_KEEP holds of each, so holds
 * never push out the words; each tally's fields in one order. The sweep's own folder saves its
 * log at the turn's end and its checkout saves the carried copy, both from the same main: written
 * in two shapes (grouped by reminder and trimmed, against time order and untrimmed), the two saves
 * conflicted in git on every sweep, and the merge was left for her next chat (round 53 of the git
 * sync review). In one shape, the same log is the same bytes, and the two saves merge clean.
 */
function saveSent(counts, all) {
  const sorted = [...all].sort((x, y) => String(x.utc ?? x.at).localeCompare(String(y.utc ?? y.at)));
  const left = new Map();
  const keep = new Set();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const k = `${sorted[i].id}|${sorted[i].claimed ? 'claim' : sorted[i].held ? 'held' : 'sent'}`;
    const n = left.get(k) ?? 0;
    if (n < SENT_KEEP) keep.add(i);
    left.set(k, n + 1);
  }
  const tally = {};
  for (const [id, t] of Object.entries(counts ?? {})) tally[id] = { sent: t?.sent, first: t?.first, last: t?.last, ...(t?.lastUtc ? { lastUtc: t.lastUtc } : {}) };
  // Nothing is lost: older entries are the record's history in git.
  writeFileSync(sentFile(), `${JSON.stringify({ _what: `The last messages the sweep wrote for each ${KIND === 'check-ins' ? 'check-in' : 'reminder'}, so the next differs, how many Telegram accepted, and any held (HBT-010, HBT-014).`, counts: tally, sent: sorted.filter((_, i) => keep.has(i)) }, null, 2)}\n`);
}

function writeSent(all, sentNow = null) {
  const counts = tallies();
  if (sentNow) {
    const t = (counts[sentNow.id] ??= { sent: 0, first: sentNow.at, last: sentNow.at });
    t.sent += 1;
    t.last = sentNow.at;
    if (sentNow.utc) t.lastUtc = sentNow.utc;
  }
  saveSent(counts, all);
}


/**
 * Every live reminder due after `since` and up to `now` (HBT-010 design 2), each once,
 * however often it fell due in between, with the latest minute it fell due.
 */
export function dueSince(loaded, since, now) {
  const { reminders } = readReminders(loaded);
  const raw = new Map((loaded.reminders ?? []).map((e) => [e?.id, e]));
  const out = [];
  for (const r of reminders) {
    // Never a time before it was set (its "set", a date or a date and time, in her zone).
    const setAt = parseLocal(raw.get(r.id)?.set);
    const from = Math.max(since, now - LOOKBACK_MS, setAt ? zonedToUtc(setAt, r.timeZone) - 60e3 : -Infinity);
    let last = null;
    if (r.windowed) { if (r.windowed.from > from && r.windowed.from <= now) last = r.windowed.from; }
    else for (let ms = Math.floor(from / 60e3) * 60e3 + 60e3; ms <= Math.min(now, r.lastMs ?? Infinity); ms += 60e3) if (r.fires(ms)) last = ms;
    if (last !== null) out.push({ id: r.id, text: r.text, at: last });
  }
  return out;
}

/**
 * Whether a slot due at instant `slot.at` was already sent or held, so a retry that rolled
 * the mark back never plans it twice. Compared as instants where the tally or log keeps one:
 * a local time repeats in the hour the clocks go back (2026-10-29: an hourly interval's
 * second 01:30 read as already sent). Older entries, with local times only, compare as text.
 */
export function slotHandled(slot, tz, tally, log, now = Date.now()) {
  const due = formatLocal(localParts(slot.at, tz));
  const t = tally[slot.id];
  const sent = t?.lastUtc ? Date.parse(t.lastUtc) >= slot.at : Boolean(t?.last) && t.last >= due;
  const holds = log.filter((m) => m.id === slot.id && m.held);
  const held = holds.some((m) => (m.utc ? Date.parse(m.utc) >= slot.at : m.at >= due));
  // A-177: a slot another runner has just claimed is theirs to send.
  const claimed = log.some((m) => m.id === slot.id && m.claimed && m.due === due && now - Date.parse(m.utc) < CLAIM_FRESH_MS);
  return sent || held || claimed;
}

/**
 * The chat a reminder set unasked came from (card A-172): this chat's address, from its session
 * id; its name from her list of chats, else the one given; and its bot, "dev" when the chat is
 * switched to development mode or listed as a development chat, else "main". `fault` when it
 * cannot be linked, so no such reminder is written without its way back.
 */
export function thisChatFor({ id = '', chats = [], devMarked = false, title = '' } = {}) {
  const tail = String(id ?? '').replace(/^(cse|session)_/, '');
  if (!/^[A-Za-z0-9]{8,64}$/.test(tail)) return { fault: 'this chat\'s session id is not known here' };
  const url = `https://claude.ai/code/session_${tail}`;
  const listed = (chats ?? []).find((c) => c?.url === url) ?? null;
  const name = String(listed?.title ?? title ?? '').trim();
  const chat = { url, title: name };
  const faults = chatFaults({ id: 'this chat', chat });
  if (faults.length) return { fault: name ? faults.join('; ') : 'give this chat\'s name with --title' };
  const dev = devMarked || (listed !== null && listed.kind !== 'everyday');
  return { chat, bot: dev ? 'dev' : 'main' };
}

// Imported (by a test) rather than run, it does nothing.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const cmd = isMain ? args[0] : null;
if (cmd === 'check') {
  const loaded = loadOrStop(1);
  if (!loaded) { console.log(`${KIND}: no ${KIND} file yet`); process.exit(0); }
  const { errors, rows } = report(loaded);
  // "set" bounds what can fall due (dueSince): unreadable is a problem, a date alone a note.
  const notes = [];
  // The sweep is the only sender (HBT-010 design 2): a file it would skip is a problem, never silence.
  if (loaded.send !== 'routine') errors.push('the file does not read "send": "routine", so nothing sends it; set "send": "routine"');
  const herTz = profileTimezone();
  if (herTz && loaded.fileTimezone && loaded.fileTimezone !== herTz) errors.push(`the file says timezone ${loaded.fileTimezone}, her profile says ${herTz}; times follow the profile`);
  for (const e of loaded.reminders ?? []) {
    if (!e?.set || e.ended) continue;
    if (!parseLocal(e.set)) errors.push(`${e.id}: "set" should read "YYYY-MM-DD HH:MM"`);
    else if (!/\d{2}:\d{2}$/.test(String(e.set).trim())) notes.push(`${e.id}: "set" has no time, so it may fall due for a time earlier that day`);
  }
  // T-330 edge cases: a one-off before the minute it was set never goes; a day 29-31 skips the
  // months without it; the same purpose at the same times twice would reach her twice.
  const live = (loaded.reminders ?? []).filter((e) => e?.id && !e.ended && !e.paused);
  for (const e of live) {
    const a = parseLocal(e.at), s = parseLocal(e.set);
    if (a && s && /\d{2}:\d{2}$/.test(String(e.set).trim()) && formatLocal(a) < formatLocal(s)) errors.push(`${e.id}: "at" is before it was set, so it never goes; a time already past means the next one`);
    const dom = typeof e.cron === 'string' ? e.cron.trim().split(/\s+/)[2] ?? '' : '';
    if (/(^|,)(29|3[01])(,|$)/.test(dom) && !/L/i.test(dom)) notes.push(`${e.id}: day ${dom} of the month skips the months without it; for "the 31st" every month, "every": "1 month" with a "start" on the 31st goes on each month's last day`);
    // Card A-099 (E-038, 2026-10-29): a nutrition update goes by judgement, never on a clock she did not name.
    if (e.module === 'fitness' && e.timing !== 'judged') notes.push(`${e.id}: a nutrition update on fixed times goes whether or not the meal is logged or skipped; keep it only if she named these send times herself, otherwise "timing": "judged" (card A-099)`);
  }
  const plan = (e) => `${String(e.text ?? '').trim().toLowerCase()}|${e.at ?? ''}|${e.cron ?? ''}|${e.every ?? ''}|${e.every ? e.start ?? '' : ''}|${e.timezone ?? ''}`;
  live.forEach((e, i) => { const twin = live.slice(0, i).find((o) => plan(o) === plan(e)); if (twin) errors.push(`${e.id}: repeats ${twin.id}, the same purpose at the same times, so she would get it twice`); });
  // A chat it names must be one real chat's address, or its messages go without the way back (card A-128).
  for (const e of loaded.reminders ?? []) if (!e?.ended) errors.push(...chatFaults(e));
  // Card A-128: an entry's own chat must be an open everyday chat on her list, while she keeps one.
  const chats = readChats(recordDir);
  if (chats) for (const e of loaded.reminders ?? []) { if (e?.ended || !e?.chat) continue; const { fault } = chatFor(e, {}, chats); if (fault) errors.push(`${e.id}: its chat cannot be linked: ${fault}`); }
  // Card A-172: one set unasked in a listed chat goes to that chat's own Telegram: a development
  // chat's to the development bot, any other's to the main one.
  if (chats) for (const e of loaded.reminders ?? []) {
    if (e?.ended || e?.inferred !== true || !e?.chat) continue;
    const c = chats.find((x) => x.url === e.chat.url);
    if (!c) continue;
    const dev = c.kind !== 'everyday';
    if (dev && e.bot !== 'dev') errors.push(`${e.id}: it came from a development chat, so it goes to the development bot: set "bot": "dev"`);
    if (!dev && e.bot === 'dev') errors.push(`${e.id}: it came from an everyday chat, so it goes to the main bot: take out "bot": "dev"`);
  }
  // A time the clocks skip or repeat in the coming year: it still goes (the first minute
  // after a skip; once in a repeat), but she hears of it now, not on the day (2026-10-29).
  for (const r of readReminders(loaded).reminders) {
    if (loaded.reminders?.find((e) => e?.id === r.id)?.ended) continue;
    for (const h of clockChangeHits(r, Date.now())) {
      notes.push(`${r.id}: on ${h.day} the clocks ${h.skipped ? `skip ${h.time}, so it goes at the first minute after the change` : `repeat ${h.time}, so it goes once, the first time`}`);
    }
  }
  if (args.includes('--json')) console.log(JSON.stringify({ errors, notes, reminders: rows }, null, 2));
  else {
    for (const e of errors) console.log(`problem: ${e}`);
    for (const n of notes) console.log(`note: ${n}`);
    for (const r of rows) console.log(`${r.id} [${r.state}] "${r.text}"${r.next.length ? `\n  next: ${r.next.join(' · ')} (${r.timezone})` : ''}`);
    if (!errors.length && !rows.length) console.log(`${KIND}: the file holds none`);
  }
  process.exit(errors.length ? 1 : 0);
} else if (cmd === 'list') {
  const loaded = loadOrStop(1);
  if (!loaded) { console.log(`${KIND}: no ${KIND} file yet`); process.exit(0); }
  const { errors, rows, archived: stopped } = list(loaded, Date.now(), { all: args.includes('--all') });
  // --shape: problems as a count, since a problem line names an entry and what is wrong with it.
  if (args.includes('--shape')) console.log(JSON.stringify({ problems: errors.length, reminders: rows.map(shapeOf), archived: stopped }, null, 2));
  else if (args.includes('--json')) console.log(JSON.stringify({ errors, reminders: rows, archived: stopped }, null, 2));
  else {
    for (const e of errors) console.log(`problem: ${e}`);
    for (const r of rows) console.log(`${r.n}. ${r.created ?? '?'} ${r.emoji ?? '·'} ${r.id} [${r.state}] sent ${r.sent}${r.last ? `, last ${r.last}` : ''}${r.held ? `, held ${r.held.at} (${r.held.why})` : ''}${r.missed ? `, MISSED ${r.missed}` : ''}${r.next ? `, next ${r.next}` : ''} "${r.text}"`);
    if (stopped && !args.includes('--all')) console.log(`${stopped} stopped, kept in the archive`);
  }
  process.exit(errors.length ? 1 : 0);
} else if (cmd === 'archive') {
  const loaded = loadOrStop(1);
  if (!loaded) { console.log(`${KIND}: no ${KIND} file yet`); process.exit(0); }
  const moved = archiveStopped(loaded);
  console.log(moved.length ? `${KIND}: archived ${moved.join(', ')}` : `${KIND}: nothing stopped to archive`);
} else if (cmd === 'send-due') {
  // HBT-010 design 2: never a fixed line. This lists what is due, with each reminder's
  // purpose and the last messages sent for it; the sweep writes fresh words for each and
  // sends them with send-one. It sends nothing itself and never fails the sweep.
  // A file that will not read is a fault to say, never "no file" (HBT-010 design 3).
  const loaded = loadOrStop(0, ', so nothing was sent; run check', 'NOT SENT: ');
  if (!loaded) { console.log(`${KIND}: no ${KIND} file`); process.exit(0); }
  if (!Array.isArray(loaded.reminders)) { console.log(`${KIND}: NOT SENT: the file has no "${LIST_KEY}" list; run check`); process.exit(0); }
  // Nothing else sends this file (2026-10-26): without "send": "routine", nothing goes, so say so
  // plainly every sweep; `check` names it as a problem until the file is set right.
  if (loaded.send !== 'routine') { console.log(`${KIND}: NOT SENT: the file does not read "send": "routine", and nothing else sends it; run check`); process.exit(0); }
  const tz = timezone(loaded);
  const now = Math.floor(Date.now() / 60e3) * 60e3;
  const mark = parseLocal(loaded.sent_through);
  // A file never marked looks back as far as dueSince allows (two days, never before a reminder
  // was set), not one hour: a reminder missed while the sweep was down is sent late, once (HBT-010
  // design 5), and the mark is written only after a first send.
  const since = mark ? zonedToUtc(mark, tz) : -Infinity;
  // The first of a repeated id, as send-one and check read it, never a later one's emoji or reads.
  const byId = new Map();
  for (const r of loaded.reminders) if (!byId.has(r?.id)) byId.set(r?.id, r);
  const log = readSent();
  // A slot already sent, or already held, is never planned again after a retry rolled the mark back.
  const tally = tallies();
  const done = (r) => slotHandled(r, tz, tally, log);
    // A-177: a backup runner sends only what the usual sender has left this long.
  const overdue = flag('--overdue') === undefined ? null : Number(flag('--overdue'));
  if (overdue !== null && !(overdue > 0)) { console.log('send-due: --overdue needs minutes, more than 0'); process.exit(1); }
  const due = dueSince(loaded, since, now).filter((r) => !done(r)).filter((r) => overdue === null || r.at <= now - overdue * 60e3).map((r) => ({
    id: r.id,
    emoji: byId.get(r.id)?.emoji ?? null,
    for: r.text,
    reads: byId.get(r.id)?.reads ?? [],
    // Card A-172: set unasked from a to-do heard in a chat, and which Telegram it goes to.
    ...(byId.get(r.id)?.inferred === true ? { inferred: true } : {}),
    bot: byId.get(r.id)?.bot ?? 'main',
    due: formatLocal(localParts(r.at, tz)),
    lastSent: log.filter((m) => m.id === r.id && !m.held && !m.claimed).slice(-SENT_KEEP).map((m) => m.text),
    // When each went, so a reminder sent by judgement can keep its spacing (card A-099).
    lastSentAt: log.filter((m) => m.id === r.id && !m.held && !m.claimed).slice(-SENT_KEEP).map((m) => m.at),
  }));
  // A check-in's update may say that something she meant to bring to an appointment today or
  // tomorrow is waiting (T-330): the day and a count, never her words, since the message reaches a
  // locked screen (SFG-012). Her chat gets the words themselves, from the session brief.
  const text = (...p) => (existsSync(join(recordDir, ...p)) ? readFileSync(join(recordDir, ...p), 'utf8') : '');
  const appt = KIND === 'check-ins' && due.length
    ? appointmentNotes({ loops: text('core', 'state', 'open_loops.md'), calendar: text('core', 'calendar', 'calendar.md'), google: text('core', 'calendar', 'google.json'), today: formatLocal(localParts(now, tz)).slice(0, 10), timeZone: tz })
    : null;
  const appointment = appt ? { when: appt.when, date: appt.date, waiting: appt.items.length } : undefined;
  // Every check-in sent in the last SAID_DAYS days, whichever it was, oldest first: what the update
  // must not say again unless it is about today or tomorrow, or changed (T-811). send-one refuses a repeat.
  const saidLately = KIND === 'check-ins' && due.length
    ? log.filter((m) => !m.held && typeof m.text === 'string' && now - (instant(m.utc, m.at, tz) ?? 0) <= SAID_DAYS * 86400e3).map((m) => ({ id: m.id, at: m.at, text: m.text }))
    : undefined;
  // A-177: one missed past the lookback is never due again, so the report must name it.
  const dueIds = new Set(due.map((d) => d.id));
  const missed = list(loaded, now).rows.filter((row) => row.missed && !dueIds.has(row.id)).map((row) => ({ id: row.id, missed: row.missed }));
  console.log(JSON.stringify({ through: formatLocal(localParts(now, tz)), due, ...(missed.length && { missed }), ...(appointment && { appointment }), ...(saidLately && { saidLately }) }, null, 2));
  process.exit(0);
} else if (cmd === 'claim') {
  // A-177: before a runner sends a slot, it claims it here, then commits and pushes the sent log to
  // main; a push refused means main moved, so it takes main's tip and claims again. Exit 3: the slot
  // is sent, held or claimed by another runner already, so this runner leaves it.
  const id = args[1];
  const due = parseLocal(flag('--due') ?? '');
  const by = flag('--by');
  const loaded = loadOrStop(1);
  if (!Array.isArray(loaded?.reminders) || !loaded.reminders.some((r) => r?.id === id) || !due || !by) { console.log('claim: give an id from the file, --due "YYYY-MM-DD HH:MM" and --by <runner>'); process.exit(1); }
  const tz = timezone(loaded);
  const dueText = formatLocal(due);
  const log = readSent();
  if (slotHandled({ id, at: zonedToUtc(due, tz) }, tz, tallies(), log.filter((m) => m.claimed !== by))) { console.log(`claim: ${id} at ${dueText} is sent, held or claimed already; leave it`); process.exit(3); }
  writeSent([...log, { id, at: formatLocal(localParts(Date.now(), tz)), utc: new Date().toISOString(), claimed: by, due: dueText }]);
  console.log(`claim: ${id} at ${dueText} claimed by ${by}`);
  process.exit(0);
} else if (cmd === 'send-one') {
  // One reminder, in the words the sweep wrote for it now (HBT-010 design 2), kept in the
  // sent log so the next one differs. Prints "reminders: <id> sent" for the report.
  const id = args[1];
  const ti = args.indexOf('--text');
  // Spaces tidied, line breaks kept: an update is a few short lines, one per target.
  const text = String(ti >= 0 ? args[ti + 1] ?? '' : '').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const loaded = loadOrStop(1);
  const entry = Array.isArray(loaded?.reminders) ? loaded.reminders.find((r) => r?.id === id) : null;
  if (!entry || !text) { console.log('send-one: give a reminder id and --text "<fresh words>"'); process.exit(1); }
  const last = readSent().filter((m) => m.id === id && !m.claimed).map((m) => m.text);
  if (last.includes(text)) { console.log(`send-one: ${id} would repeat an earlier message word for word; write it fresh`); process.exit(1); }
  // A check-in's update line said in an earlier check-in (T-811): named by line and date, never its words.
  if (KIND === 'check-ins') {
    const again = repeatedLines(text, readSent());
    if (again.length) { console.log(`send-one: ${id} says again what an earlier check-in said (${again.map((r) => `line ${r.line}, said ${r.at}`).join('; ')}); leave it out, or say what changed`); process.exit(1); }
  }
  if (text === String(entry.text).trim()) { console.log(`send-one: ${id} is its purpose as written; write it fresh`); process.exit(1); }
  // Card A-172: which of the two Telegram chats it goes to. A development chat's goes through the
  // development bot's key to the same chat id, as dev-done-notify.mjs sends, and never falls back
  // to the main bot, which would land it in the wrong chat.
  if (entry.bot !== undefined && !BOTS.includes(entry.bot)) { console.log(`send-one: ${id} not sent: "bot" should be "main" or "dev"; run check`); process.exit(1); }
  const dev = entry.bot === 'dev';
  const token = dev ? process.env.TELEGRAM_DEV_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (entry.inferred === true) {
    const fault = inferredFault(entry);
    if (fault) { console.log(`send-one: ${id} not sent: ${fault}; run check`); process.exit(1); }
    // Once only: one set unasked never repeats, whatever asks.
    if ((tallies()[id]?.sent ?? 0) > 0) { console.log(`send-one: ${id} was sent once already; one set unasked never goes twice`); process.exit(1); }
    // Never on a hard day or in a crisis (card A-172): held, with why, and never sent later. Judged
    // from <root>/data, so another record folder is never sent from.
    if (basename(recordDir) !== 'data') { console.log(`${KIND}: ${id} not sent: the record folder is not data/, so a hard day cannot be judged`); process.exit(0); }
    const { lastSessionHard } = await import('./nudge.mjs');
    if (lastSessionHard(join(recordDir, '..'))) {
      writeSent([...readSent(), { id, at: formatLocal(localParts(Date.now(), timezone(loaded))), utc: new Date().toISOString(), held: true, why: 'a hard day: one set unasked never arrives then' }]);
      console.log(`${KIND}: ${id} held (a hard day: one set unasked never arrives then)`);
      process.exit(0);
    }
  }
  if (KIND === 'check-ins') {
    // HBT-014: a check-in passes the nudge's own gates first: her switch, and never after a hard session.
    // The gates read <root>/data, so only a record folder named data can be judged; any other is never sent from.
    if (basename(recordDir) !== 'data') { console.log(`check-ins: ${id} not sent: the record folder is not data/`); process.exit(0); }
    const { reasons } = await import('./nudge.mjs');
    const why = reasons(join(recordDir, '..'), { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHAT_ID: 'x' });
    if (why.length) {
      // Kept as held, so it shows held, not missed, and is not tried again.
      writeSent([...readSent(), { id, at: formatLocal(localParts(Date.now(), timezone(loaded))), utc: new Date().toISOString(), held: true, why: why.join('; ') }]);
      console.log(`check-ins: ${id} held (${why.join('; ')})`);
      process.exit(0);
    }
  }
  // Card A-128: the chat this message links to, chosen by the sweep (--chat), none (--no-chat), or
  // the entry's own; never a development, closed or unlisted chat while her record keeps a list.
  const linked = chatFor(entry, { url: flag('--chat') ?? null, none: args.includes('--no-chat') }, readChats(recordDir));
  if (linked.fault && (flag('--chat') || entry.inferred === true)) { console.log(`send-one: ${id} not linked to that chat: ${linked.fault}`); process.exit(1); }
  const sendAs = { ...entry, chat: linked.chat ?? undefined };
  if (!token || !chat) { console.log(`${KIND}: ${id} not sent: this environment holds no ${dev ? 'development ' : ''}bot key`); process.exit(0); }
  // A-177: with --due and --by, a last look at main just before sending: a slot another runner
  // claimed, or sent after its due time, is left to them. Main unreadable: sent anyway, since a
  // reminder missed is worse than one sent twice, and the line says so.
  const dueAt = parseLocal(flag('--due') ?? '');
  const by = flag('--by');
  let lateBy = null;
  if (dueAt && by) {
    const tz = timezone(loaded);
    const dueText = formatLocal(dueAt);
    const dueMs = zonedToUtc(dueAt, tz);
    const theirs = sentOnMain();
    if (theirs) {
      const lastUtc = Date.parse(theirs.counts?.[id]?.lastUtc ?? '');
      if (claimedElsewhere(theirs.sent, id, dueText, by) || lastUtc >= dueMs) { console.log(`${KIND}: ${id} left: another runner has it on main`); process.exit(0); }
    }
    const mins = Math.round((Date.now() - dueMs) / 60e3);
    if (mins > LATE_MIN) lateBy = mins;
  }
  // A test may point the send at a stand-in on this machine, never at any other host.
  const api = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TELEGRAM_API_TEST ?? '') ? process.env.TELEGRAM_API_TEST : 'https://api.telegram.org';
  // Through curl, never Node's fetch, which ignores a cloud machine's proxy (T-748).
  const res = await telegramPost(`${api}/bot${token}/sendMessage`, {
    body: JSON.stringify({ chat_id: chat, text: messageFor(sendAs, text), parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!res.ok) {
    // Telegram's own reason says who acts: blocked by her, the chat gone, the key revoked
    // (2026-10-29: only the code was printed). Never the key or the chat id.
    let why = String(res.description ?? '');
    for (const secret of [token, chat]) if (secret) why = why.split(secret).join('…');
    why = why.replace(/\s+/g, ' ').trim().slice(0, 200);
    console.log(`${KIND}: ${id} refused (${res.status}${why ? `: ${why}` : ''})`);
    process.exit(0);
  }
  const sentNow = { id, at: formatLocal(localParts(Date.now(), timezone(loaded))), utc: new Date().toISOString(), text };
  writeSent([...readSent(), sentNow], sentNow);
  console.log(`${KIND}: ${id} sent${lateBy !== null ? ` late (${lateBy} min)` : ''}`);
  process.exit(0);
} else if (cmd === 'hold') {
  // HBT-014: a check-in the sweep stood down (a hard day, or nothing worth asking) is kept as
  // held, with why, so the table shows it held rather than missed. Nothing is sent.
  const id = args[1];
  const wi = args.indexOf('--why');
  const why = String(wi >= 0 ? args[wi + 1] ?? '' : '').replace(/\s+/g, ' ').trim() || 'held';
  const loaded = loadOrStop(1);
  if (!Array.isArray(loaded?.reminders) || !loaded.reminders.some((r) => r?.id === id)) { console.log('hold: give an id from the file'); process.exit(1); }
  // A hard day changes how a reminder is written, never whether it goes (a reminder
  // was once held for a hard-day mark in the log). A check-in may stand down for one (HBT-014).
  // One the agent set unasked is the exception: it never arrives on a hard day (card A-172).
  const inferred = loaded.reminders.find((r) => r?.id === id)?.inferred === true;
  if (KIND === 'reminders' && !inferred && /\b(hard (day|session|night)|crisis|panic)\b/i.test(why)) {
    console.log(`hold: ${id} not held: a hard day is no reason to hold a reminder; send it, shorter and gentler`);
    process.exit(1);
  }
  writeSent([...readSent(), { id, at: formatLocal(localParts(Date.now(), timezone(loaded))), utc: new Date().toISOString(), held: true, why }]);
  console.log(`${KIND}: ${id} held (${why})`);
  process.exit(0);
} else if (cmd === 'carry-sent') {
  // The sent log of another record folder (where the sweep sent from) merged into this one's.
  const from = args[1];
  if (!from || from.startsWith('--')) { console.log(`carry-sent: give the record folder the sweep sent from`); process.exit(1); }
  const fromFile = join(from, 'core', 'calendar', `${KIND}-sent.json`);
  if (!existsSync(fromFile)) { console.log(`${KIND}: nothing to carry, ${fromFile} is not there`); process.exit(0); }
  let theirs;
  try { theirs = JSON.parse(readFileSync(fromFile, 'utf8')); } catch { console.log(`${KIND}: NOT CARRIED: ${fromFile} is not valid JSON`); process.exit(1); }
  const merged = mergeSent(theirs, readSentFile());
  saveSent(merged.counts, merged.sent);
  console.log(`${KIND}: sent log carried, ${merged.sent.length} entries`);
  process.exit(0);
} else if (cmd === 'mark-sent') {
  // --before "<due>": a send failed, so mark only up to the minute before the earliest
  // failed one's due time, and the next sweep tries it again (never skipped for good).
  const given = parseLocal(args[1]);
  const before = flag('--before') === undefined ? null : parseLocal(flag('--before'));
  if (flag('--before') !== undefined && !before) { console.log('mark-sent: --before needs a local time, "YYYY-MM-DD HH:MM"'); process.exit(1); }
  const tzm = timezone(loadOrStop(1));
  // Never past the time given, and with --before, never past the minute before the failed one.
  const p = before ? localParts(Math.min(zonedToUtc(before, tzm) - 60e3, given ? zonedToUtc(given, tzm) : Infinity), tzm) : given;
  if (!p) { console.log('mark-sent: give a local time, "YYYY-MM-DD HH:MM"'); process.exit(1); }
  const loaded = loadOrStop(1);
  if (!loaded) { console.log('mark-sent: no reminders file'); process.exit(1); }
  const old = parseLocal(loaded.sent_through);
  if (old && formatLocal(old) >= formatLocal(p)) { console.log(`mark-sent: already through ${formatLocal(old)}`); process.exit(0); }
  loaded.sent_through = formatLocal(p);
  if (!markInPlace(loaded.sent_through, loaded)) save(loaded);
  console.log(`mark-sent: through ${loaded.sent_through}`);
  process.exit(0);
} else if (cmd === 'this-chat') {
  const id = process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || '';
  // Switched to development mode: the marker the /dev-mode command leaves for this session.
  // A chat switched on stays on, but a turn about his life is answered the everyday way (A-146),
  // and a reminder set in it is his life's, so it goes to the main bot (T-955: an everyday
  // to-do set in a chat once switched on was routed to the dev bot).
  const devMarked = Boolean(id) && existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'state', `dev-mode-${id}`))
    && devModeActive({ session_id: id });
  const out = thisChatFor({ id, chats: readChats(recordDir) ?? [], devMarked, title: flag('--title') ?? '' });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.fault ? 1 : 0);
} else if (cmd === 'routine') {
  const loaded = loadOrStop(1);
  const entry = Array.isArray(loaded?.reminders) ? loaded.reminders.find((r) => r?.id === args[1]) : null;
  const out = routineFor(entry, timezone(loaded));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.error ? 1 : 0);
} else if (cmd === 'preview') {
  const one = { id: 'preview', text: 'preview', ...JSON.parse(args[1] ?? '{}') };
  const tz = one.timezone ?? timezone(loadOrStop(1));
  const { errors, rows } = report({ timezone: tz, reminders: [one] });
  for (const e of errors) console.log(`problem: ${e}`);
  for (const r of rows) console.log(r.next.length ? `next: ${r.next.join(' · ')} (${tz})` : 'never fires');
  process.exit(errors.length ? 1 : 0);
} else if (cmd === 'due') {
  const loaded = loadOrStop(1);
  const tz = timezone(loaded);
  const p = parseLocal(args[1]);
  if (!p) { console.log('due: give a local time, "YYYY-MM-DD HH:MM"'); process.exit(1); }
  const due = loaded ? readReminders(loaded).reminders.filter((r) => r.fires(zonedToUtc(p, r.timeZone))) : [];
  console.log(due.length ? due.map((r) => `${r.id}: "${r.text}"`).join('\n') : `nothing goes out at ${args[1]} (${tz})`);
} else if (isMain) {
  console.log('usage: node ux/scripts/reminders.mjs check [--json] | list [--json | --shape] | send-due | send-one <id> --text "<words>" | mark-sent "<time>" | carry-sent <record folder sent from> | this-chat [--title "<name>"] | routine <id> | preview \'<json>\' | due "YYYY-MM-DD HH:MM" [--record <dir>]');
  process.exit(cmd ? 1 : 0);
}
