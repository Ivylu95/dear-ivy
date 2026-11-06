// The schedule engine for her reminders and check-ins (HBT-010, HBT-014): when each
// entry in data/core/calendar/reminders.json (or check-ins.json) falls due, in her
// timezone. Pure: it reads and sends nothing. ux/scripts/reminders.mjs plans the
// sweep's sends and checks a file before it is pushed with it, the set-up doctor
// reads a file with it, and dev/run-report.mjs counts what comes next with it.
//
// A reminders file is { "timezone": "Area/City", "send": "routine", "reminders": [ ... ] }.
// Each reminder has an `id`, its `text` (what it is for), and exactly one schedule, all
// times local to the file's timezone (or the reminder's own `timezone`), written
// "YYYY-MM-DD HH:MM":
//   "at":    "2026-10-20 15:00"                      once
//   "cron":  "0 9 * * 4"                             minute hour day-of-month month
//                                                    day-of-week; lists, ranges, steps,
//                                                    names (mon, jan) and L (last day of
//                                                    the month) in day-of-month
//   "every": "2 weeks", with "start": "2026-10-16 09:00"
//                                                    minutes, hours, days, weeks, months
//                                                    or years, counted from start
// Optional on any: "start" (none before), "until" (none after; a date alone means
// through that day), "paused": true, and "ended" (the day she cancelled it; none after).
// "set" (the day it was written) and "emoji" (one, marking it in her table) are the
// record's. "reads" lists files of her record the sweep reads before writing it
// (HBT-010 design 2). A one-off may carry "window": N minutes, so it still counts as due
// up to N minutes after its time, once.
// "bot" names which Telegram chat it goes to: "main" (the default) or "dev", the
// development bot, for a reminder set in a development chat (card A-172). "inferred":
// true marks one the agent set unasked from a to-do it heard (card A-172): it goes once
// ("at"), always names the "chat" it came from, and is never about medicine.
//
// Moved here unchanged on 2026-10-26, when the sender it used to live in was retired,
// so nothing that reads a schedule depends on a service outside the repository.

import { chatFaults } from './chat-link.mjs';

export const REMINDERS_PATH = 'data/core/calendar/reminders.json';

/** The two Telegram chats there are (card A-172, T-752): the main bot, and the development bot. */
export const BOTS = ['main', 'dev'];
// Card A-172: a reminder the agent set unasked is never about taking a medicine. Read from
// what it is for; the skill holds the rest (never a time picked for her medication).
export const MEDICINE = /\b(tablets?|pills?|meds|medications?|medicines?|doses?|dosage|insulin|capsules?|antibiotics?|inhalers?)\b/i;

/** Why an entry's routing or inferred marks are wrong, or null: never sent while one stands. */
export function inferredFault(r) {
  if (r.bot !== undefined && !BOTS.includes(r.bot)) return '"bot" should be "main" or "dev"';
  if (r.inferred === undefined) return null;
  if (r.inferred !== true) return '"inferred" should be true, with no quotes, or left out';
  if (r.at === undefined || r.cron !== undefined || r.every !== undefined) return 'a reminder set unasked goes once: it needs "at", never "cron" or "every" (card A-172)';
  if (r.chat === undefined) return 'a reminder set unasked needs the "chat" it came from (card A-172)';
  if (chatFaults(r).length) return 'its "chat" is not one Claude Code chat\'s address and name (card A-172)';
  if (MEDICINE.test(String(r.text ?? '')) || (r.reads ?? []).some((p) => /supplement|medic/i.test(String(p)))) return 'a reminder set unasked is never about medicine (card A-172)';
  return null;
}

const pad =(n) => String(n).padStart(2, '0');

const MINUTE = 60e3;
const formatters = new Map();

/**
 * The wall clock in `timeZone` at instant `ms`: { y, mo, d, H, M, dow }. The zone's offset
 * comes from `offsetAt`, asked of Intl once per quarter hour, and the rest is arithmetic:
 * asked of Intl every minute, a year's scan took the reminders' edge tests past the
 * selftest's minute under load (2026-10-29), which refused every commit.
 */
export function localParts(ms, timeZone) {
  const t = new Date(Math.floor(ms / MINUTE) * MINUTE + offsetAt(ms, timeZone));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), H: t.getUTCHours(), M: t.getUTCMinutes(), dow: t.getUTCDay() };
}

function intlParts(ms, timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return { y: +p.year, mo: +p.month, d: +p.day, H: +p.hour % 24, M: +p.minute, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

export const formatLocal = (p) => `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.H)}:${pad(p.M)}`;

/** "YYYY-MM-DD HH:MM" (or "YYYY-MM-DD", read as `dayEnd` ? 23:59 : 00:00) → parts, or null. */
export function parseLocal(text, dayEnd = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const p = { y: +m[1], mo: +m[2], d: +m[3], H: m[4] === undefined ? (dayEnd ? 23 : 0) : +m[4], M: m[5] === undefined ? (dayEnd ? 59 : 0) : +m[5] };
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > daysIn(p.y, p.mo) || p.H > 23 || p.M > 59) return null;
  return p;
}

const daysIn = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
const dayNumber = (p) => Math.floor(Date.UTC(p.y, p.mo - 1, p.d) / 86400e3);
const wallMs = (p) => Date.UTC(p.y, p.mo - 1, p.d, p.H, p.M);

/** The instant at which the wall clock in `timeZone` reads `p`. */
export function zonedToUtc(p, timeZone) {
  const want = wallMs(p);
  let ms = want;
  for (let i = 0; i < 3; i++) {
    const diff = want - wallMs(localParts(ms, timeZone));
    if (diff === 0) break;
    ms += diff;
  }
  return ms;
}

const NAMES = {
  month: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  dow: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

function cronField(text, min, max, names, allowLast) {
  const out = { any: text === '*' || text === '?', values: new Set(), last: false };
  if (out.any) return out;
  const value = (v) => {
    const i = names ? names.indexOf(v.toLowerCase()) : -1;
    const n = i >= 0 ? i + (min === 1 ? 1 : 0) : /^\d+$/.test(v) ? +v : NaN;
    if (!(n >= min && n <= max)) throw new Error(`"${v}" is outside ${min}-${max}`);
    return n;
  };
  for (const part of text.split(',')) {
    if (allowLast && part.toUpperCase() === 'L') { out.last = true; continue; }
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : +stepText;
    if (!(step >= 1) || !Number.isInteger(step)) throw new Error(`"${part}" has a bad step`);
    let lo, hi;
    if (range === '*') [lo, hi] = [min, max];
    else if (range.includes('-')) [lo, hi] = range.split('-').map(value);
    else { lo = value(range); hi = stepText === undefined ? lo : max; }
    if (lo > hi) throw new Error(`"${part}" runs backwards`);
    for (let n = lo; n <= hi; n += step) out.values.add(n);
  }
  return out;
}

/** A five-field cron expression → a test of local parts. Throws on a bad expression. */
export function parseCron(expr) {
  const f = String(expr ?? '').trim().split(/\s+/);
  if (f.length !== 5) throw new Error('a cron needs five fields: minute hour day-of-month month day-of-week');
  const [minute, hour, dom, month, dow] = [
    cronField(f[0], 0, 59), cronField(f[1], 0, 23), cronField(f[2], 1, 31, null, true),
    cronField(f[3], 1, 12, NAMES.month), cronField(f[4], 0, 7, NAMES.dow),
  ];
  if (dow.values.has(7)) dow.values.add(0);
  const has = (field, n) => field.any || field.values.has(n);
  return (p) => {
    if (!has(minute, p.M) || !has(hour, p.H) || !has(month, p.mo)) return false;
    const domHit = dom.any || dom.values.has(p.d) || (dom.last && p.d === daysIn(p.y, p.mo));
    const dowHit = has(dow, p.dow);
    // As cron has always read them: with both day fields set, either one will do.
    if (!dom.any && !dow.any) return domHit || dowHit;
    return domHit && dowHit;
  };
}

const UNITS = { minute: 'minute', min: 'minute', hour: 'hour', hr: 'hour', day: 'day', week: 'week', wk: 'week', month: 'month', year: 'year', yr: 'year' };

/** "2 weeks", "every 90 minutes", "day" → { n, unit }. Throws on anything else. */
export function parseEvery(text) {
  const m = /^(?:every\s+)?(\d+)?\s*([a-z]+?)s?$/i.exec(String(text ?? '').trim());
  const unit = m && UNITS[m[2].toLowerCase()];
  const n = m && m[1] !== undefined ? +m[1] : 1;
  if (!unit || !(n >= 1)) throw new Error(`"${text}" is not an interval like "2 weeks" or "90 minutes"`);
  return { n, unit };
}

/**
 * Every problem with a reminders file, as plain sentences, and the reminders read from it,
 * each ready to test: { id, text, timeZone, fires(ms) }. An invalid reminder is left out
 * of `reminders`, so one bad entry never stops the rest.
 */
export function readReminders(file) {
  const errors = [];
  const reminders = [];
  if (!file || typeof file !== 'object' || !Array.isArray(file.reminders)) {
    return { errors: ['the file needs a "reminders" list'], reminders };
  }
  const zoneOk = (tz) => { try { localParts(0, tz); return true; } catch { return false; } };
  if (file.timezone !== undefined && !zoneOk(file.timezone)) errors.push(`"${file.timezone}" is not a timezone`);
  const seen = new Set();
  file.reminders.forEach((r, i) => {
    const name = r && typeof r.id === 'string' && r.id ? r.id : `reminder ${i + 1}`;
    const bad = (why) => errors.push(`${name}: ${why}`);
    if (!r || typeof r !== 'object') return bad('is not an object');
    if (typeof r.id !== 'string' || !r.id) return bad('needs an "id"');
    if (seen.has(r.id)) return bad('shares its id with another reminder');
    seen.add(r.id);
    if (typeof r.text !== 'string' || !r.text.trim()) return bad('needs its "text"');
    if (r.text.length > 1000) return bad('its text is over 1,000 characters');
    // HBT-010 design 2: files of her record the sweep reads before writing it, e.g. her supplements.
    if (r.reads !== undefined && !(Array.isArray(r.reads) && r.reads.every((p) => typeof p === 'string' && /^data\/[^\s]+$/.test(p) && !p.split('/').includes('..')))) return bad('"reads" should list files under data/');
    // `"paused": "true"`, a string, once read as not paused, and the paused reminder went
    // out (round 3, C6). Anything but true or false is named, and the entry is not sent.
    if (r.paused !== undefined && typeof r.paused !== 'boolean') return bad('"paused" should be true or false, with no quotes');
    // Card A-172: a wrong bot would land it in the wrong Telegram chat, so it is not sent at all.
    const routing = inferredFault(r);
    if (routing) return bad(routing);
    const timeZone = r.timezone ?? file.timezone ?? 'UTC';
    if (!zoneOk(timeZone)) return bad(`"${timeZone}" is not a timezone`);
    const kinds = ['at', 'cron', 'every'].filter((k) => r[k] !== undefined);
    if (kinds.length !== 1) return bad('needs exactly one of "at", "cron" or "every"');
    const bound = (key, dayEnd) => {
      if (r[key] === undefined) return null;
      const p = parseLocal(r[key], dayEnd);
      if (!p) throw new Error(`"${key}" should read "YYYY-MM-DD HH:MM" or "YYYY-MM-DD"`);
      return wallMs(p);
    };
    let test;
    let windowed = null;
    // Minute and hour intervals count real elapsed time; every other schedule reads her
    // wall clock, and a wall clock skips an hour in spring and repeats one in autumn.
    let byInstant = false;
    try {
      const start = bound('start', false);
      const until = Math.min(bound('until', true) ?? Infinity, bound('ended', true) ?? Infinity);
      if (r.at !== undefined) {
        const at = parseLocal(r.at);
        if (!at || !/\d{2}:\d{2}$/.test(String(r.at).trim())) throw new Error('"at" should read "YYYY-MM-DD HH:MM"');
        const key = formatLocal(at);
        const win = r.window === undefined ? 0 : Number(r.window);
        if (!(Number.isInteger(win) && win >= 0 && win <= 1440)) throw new Error('"window" should be whole minutes, 0 to 1440');
        if (win) {
          const from = zonedToUtc(at, timeZone);
          windowed = { from, to: from + win * MINUTE };
          test = (p, ms) => ms >= from && ms < from + win * MINUTE;
        } else test = (p) => formatLocal(p) === key;
      } else if (r.cron !== undefined) {
        test = parseCron(r.cron);
      } else {
        const { n, unit } = parseEvery(r.every);
        const s = r.start === undefined ? null : parseLocal(r.start);
        if (!s || !/\d{2}:\d{2}$/.test(String(r.start).trim())) throw new Error('"every" needs a "start" reading "YYYY-MM-DD HH:MM"');
        const sameTime = (p) => p.H === s.H && p.M === s.M;
        if (unit === 'minute' || unit === 'hour') {
          byInstant = true;
          const step = n * (unit === 'hour' ? 60 : 1) * MINUTE;
          const from = zonedToUtc(s, timeZone);
          test = (p, ms) => ms >= from && (ms - from) % step === 0;
        } else if (unit === 'day' || unit === 'week') {
          const step = n * (unit === 'week' ? 7 : 1);
          test = (p) => sameTime(p) && (dayNumber(p) - dayNumber(s)) % step === 0;
        } else {
          const step = n * (unit === 'year' ? 12 : 1);
          test = (p) => {
            const months = (p.y - s.y) * 12 + (p.mo - s.mo);
            return sameTime(p) && months % step === 0 && p.d === Math.min(s.d, daysIn(p.y, p.mo));
          };
        }
      }
      const window = (p) => (start === null || wallMs(p) >= start) && wallMs(p) <= until;
      // The last instant it could fire, so a search for its next times stops there
      // instead of walking a year of minutes (2026-10-17: a check of twelve entries
      // that had ended took over two minutes).
      const toUtc = (ms) => { const d = new Date(ms); return zonedToUtc({ y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes() }, timeZone); };
      const lastMs = Math.min(until === Infinity ? Infinity : toUtc(until) + MINUTE, windowed ? windowed.to : r.at !== undefined ? toUtc(wallMs(parseLocal(r.at))) + MINUTE : Infinity);
      const off = r.paused === true;
      reminders.push({
        id: r.id,
        text: r.text.trim(),
        timeZone,
        windowed,
        lastMs: off ? -Infinity : lastMs,
        // Whether its wall-clock schedule names local time `p` at all, clock changes aside:
        // what clockChanges asks of a time the clocks skip or repeat. Real-time intervals
        // and windowed one-offs never read the wall clock, so never.
        namesWall(p) {
          return !off && !byInstant && !windowed && window(p) && test(p, wallMs(p));
        },
        fires(ms) {
          if (off) return false;
          const at = Math.floor(ms / MINUTE) * MINUTE;
          const p = localParts(at, timeZone);
          return window(p) && (byInstant || windowed ? test(p, at) : onWallClock(test, p, at, timeZone));
        },
      });
    } catch (e) {
      bad(e.message);
    }
  });
  return { errors, reminders };
}

const partsOfWall = (w) => { const d = new Date(w); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), dow: d.getUTCDay() }; };

/**
 * A wall-clock schedule's test at instant `ms`, through the clock changes, as cron has
 * long done: a time the clocks skip goes at the first minute after the jump, and a time
 * the clocks repeat goes once, the first time (2026-10-28: a 02:30 reminder never went on
 * a spring-forward day, and a 01:30 one went twice on the autumn one). A zone with no
 * change, hers, takes the first line only.
 */
// Every zone changes its clock on a quarter hour, so one reading per quarter hour is exact.
const offsets = new Map();
function offsetAt(ms, timeZone) {
  const q = Math.floor(ms / 900e3) * 900e3;
  const key = `${timeZone}|${q}`;
  let off = offsets.get(key);
  if (off === undefined) {
    if (offsets.size > 50000) offsets.clear();
    off = wallMs(intlParts(q, timeZone)) - q;
    offsets.set(key, off);
  }
  return off;
}

function onWallClock(test, p, ms, timeZone) {
  const offNow = wallMs(p) - ms;
  const offHourAgo = offsetAt(ms - 3600e3, timeZone);
  if (offNow === offHourAgo) return test(p, ms);
  const prev = localParts(ms - MINUTE, timeZone);
  if (wallMs(p) - wallMs(prev) > MINUTE) {
    if (test(p, ms)) return true;
    for (let w = wallMs(prev) + MINUTE; w < wallMs(p); w += MINUTE) if (test(partsOfWall(w), ms)) return true;
    return false;
  }
  if (offNow < offHourAgo) {
    const earlier = ms - (offHourAgo - offNow);
    if (wallMs(localParts(earlier, timeZone)) === wallMs(p)) return false;
  }
  return test(p, ms);
}

/**
 * The clock changes in `timeZone` from `fromMs`, `days` ahead: each { at, skipped } with the
 * wall minutes the clocks skip (spring) or repeat (autumn), as [from, to) wall times.
 * Sampled hourly, then to the quarter hour every zone changes on. A zone with none, hers,
 * returns [].
 */
const changesByZone = new Map();
export function clockChanges(timeZone, fromMs, days = 366) {
  const key = `${timeZone}|${Math.floor(fromMs / 86400e3)}|${days}`;
  if (changesByZone.has(key)) return changesByZone.get(key);
  const out = [];
  const start = Math.floor(fromMs / 3600e3) * 3600e3;
  for (let h = start; h < start + days * 86400e3; h += 3600e3) {
    const before = offsetAt(h, timeZone);
    if (offsetAt(h + 3600e3, timeZone) === before) continue;
    let at = h + 900e3;
    while (offsetAt(at, timeZone) === before) at += 900e3;
    const after = offsetAt(at, timeZone);
    const [a, b] = [at + before, at + after];
    out.push({ at, skipped: after > before, from: Math.min(a, b), to: Math.max(a, b) });
  }
  changesByZone.set(key, out);
  return out;
}

/**
 * Each clock change in the coming `days` that falls on a time a reminder names: the local
 * day and whether the clocks skip it (it goes at the first minute after) or repeat it (it
 * goes once, the first time). For `check` to say so before the day, never silently.
 */
export function clockChangeHits(reminder, fromMs, days = 366) {
  if (typeof reminder?.namesWall !== 'function') return [];
  const hits = [];
  for (const c of clockChanges(reminder.timeZone, fromMs, days)) {
    if (c.at > (reminder.lastMs ?? Infinity)) break;
    for (let w = c.from; w < c.to; w += MINUTE) {
      const p = partsOfWall(w);
      if (reminder.namesWall(p)) {
        hits.push({ day: formatLocal(p).slice(0, 10), time: formatLocal(p).slice(11), skipped: c.skipped });
        break;
      }
    }
  }
  return hits;
}

/** The reminders in `file` due in the minute holding `ms`. */
export const dueReminders = (file, ms) => readReminders(file).reminders.filter((r) => r.fires(ms));

/** The next `count` minutes a reminder fires, from `fromMs`, looking `days` ahead at most. */
export function nextTimes(reminder, fromMs, count = 3, days = 400, again = false) {
  const out = [];
  const end = Math.min(fromMs + days * 86400e3, reminder.lastMs ?? Infinity);
  for (let ms = Math.ceil(fromMs / MINUTE) * MINUTE; ms <= end && out.length < count; ms += MINUTE) {
    if (reminder.fires(ms)) out.push(ms);
  }
  // A reminder with no end that fires less often than the window, 29 February above all, is
  // still live: look on to four years and a margin before calling it finished, or it is shown
  // as finished and archived as spent (2026-10-29 edge case).
  if (!out.length && (reminder.lastMs ?? Infinity) === Infinity && days < 1500 && !again) return nextTimes(reminder, end, count, 1500 - days, true);
  return out;
}
