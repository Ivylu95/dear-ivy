// Her Google Calendar, kept as a copy in her record (A-093).
//
// Only an agent can reach the calendar (Anthropic's Google Calendar connector, in a
// chat or in the hourly routine it is attached to); scripts cannot. So the agent
// reads the next fortnight through the connector and hands the events here, and
// every script, check-in and session reads the copy. Read-only towards Google:
// nothing here, and nothing that reads the copy, ever writes to her calendar.
//
//   node ux/scripts/google-calendar.mjs save < events.json   write the copy from the
//                                                  connector's list_events results:
//                                                  one result, or an array of them
//   node ux/scripts/google-calendar.mjs stale [--hours 6]
//                                                  prints "fresh" or "stale" (no copy,
//                                                  or older than that); exits 0 either way
//   node ux/scripts/google-calendar.mjs show [--days 14]
//                                                  today, tomorrow, then the rest, in her
//                                                  timezone, one line per event
//
// --record <dir> works another record folder instead of data/ (a checkout, a test).
// Kept per event: start, end, all-day, title, calendar name. Never descriptions,
// attendees, links or ids: what a check-in needs, nothing more.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProfile } from '../../.claude/hooks/lib/profile-schema.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const recordDir = flag('--record') ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
export const COPY_PATH = 'core/calendar/google.json';
const copyFile = join(recordDir, COPY_PATH);

function timezone() {
  const profile = join(recordDir, 'PROFILE.yaml');
  return (existsSync(profile) && readProfile(readFileSync(profile, 'utf8')).value.timezone) || 'UTC';
}

/** The connector's list_events results (one, or an array) as the copy's events, sorted, deduplicated. */
export function normalise(results) {
  const list = (Array.isArray(results) ? results : [results]).filter(Boolean);
  const seen = new Set();
  const events = [];
  for (const r of list) {
    for (const e of r.events ?? []) {
      if (e.status === 'cancelled') continue;
      const allDay = Boolean(e.start?.date && !e.start?.dateTime);
      const start = e.start?.dateTime ?? e.start?.date;
      const end = e.end?.dateTime ?? e.end?.date ?? start;
      if (!start) continue;
      const title = String(e.summary ?? '(no title)').trim();
      const key = `${start}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ start, end, all_day: allDay, title, calendar: r.summary ?? null });
    }
  }
  return events.sort((a, b) => startMs(a) - startMs(b));
}

// An all-day date is read as that day's start in her timezone, close enough to order by.
const startMs = (e) => Date.parse(e.all_day ? `${e.start.slice(0, 10)}T00:00:00Z` : e.start);

const dayOf = (ms, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
const timeOf = (ms, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
const weekday = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Lines for `show`: Today, Tomorrow, then each later day, from `now` for `days`. */
export function render(copy, now, tz, days = 14) {
  const today = dayOf(now, tz);
  const tomorrow = dayOf(now + 86400e3, tz);
  const last = dayOf(now + days * 86400e3, tz);
  const out = [];
  for (const e of copy.events ?? []) {
    const day = e.all_day ? e.start.slice(0, 10) : dayOf(Date.parse(e.start), tz);
    const endDay = e.all_day ? e.end.slice(0, 10) : dayOf(Date.parse(e.end), tz);
    if ((e.all_day ? endDay <= today : endDay < today) || day > last) continue;
    const when = day <= today ? 'Today' : day === tomorrow ? 'Tomorrow' : weekday(day);
    const time = e.all_day ? 'all day' : timeOf(Date.parse(e.start), tz);
    out.push(`${when} · ${time} · ${e.title}${e.calendar && e.calendar !== 'Personal' ? ` (${e.calendar})` : ''}`);
  }
  return out;
}

const read = () => (existsSync(copyFile) ? JSON.parse(readFileSync(copyFile, 'utf8')) : null);

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = args[0];
  if (cmd === 'save') {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    let results;
    try { results = JSON.parse(raw); } catch (e) { console.log(`google-calendar: not JSON (${e.message}); the copy is unchanged`); process.exit(1); }
    const events = normalise(results);
    mkdirSync(dirname(copyFile), { recursive: true });
    const copy = { _what: 'A copy of her Google Calendar, the next fortnight, refreshed by the heartbeat or a session through the connector (A-093). Read-only: nothing writes to her calendar from here.', synced_at: new Date().toISOString(), events };
    writeFileSync(copyFile, `${JSON.stringify(copy, null, 2)}\n`);
    console.log(`google-calendar: ${events.length} event(s) kept`);
  } else if (cmd === 'stale') {
    const hours = Number(flag('--hours') ?? 6);
    const copy = read();
    console.log(!copy || Date.now() - Date.parse(copy.synced_at) > hours * 3600e3 ? 'stale' : 'fresh');
  } else if (cmd === 'show') {
    const copy = read();
    if (!copy) { console.log('google-calendar: no copy yet'); process.exit(0); }
    const lines = render(copy, Date.now(), timezone(), Number(flag('--days') ?? 14));
    console.log(`synced ${copy.synced_at}`);
    console.log(lines.length ? lines.join('\n') : 'nothing on');
  } else {
    console.log('usage: google-calendar.mjs save | stale [--hours N] | show [--days N] [--record <dir>]');
    process.exit(1);
  }
}
