// What the first question of a session should be shaped by, worked out from the
// record rather than left to the model to notice. Read by session/session-context.mjs;
// tested by session/test-opening.mjs.
//
// Each flag is something the files can tell and a model reading them often
// misses: how the last session ended, how long ago it was, whether the snapshot
// has gone stale, whether it is the middle of the night where she is. The words
// attached to each are the instruction, so the first question gets them
// whatever skill loads, or none. Ordered: the first that applies decides; later ones only
// shape the words.
//
// Pure: text in, lines out. No file reads, no clock of its own.

import { zonedDateTime } from './profile-schema.mjs';

// `YYYY-MM-DD · <playbook> · <one clause>`, in a table row or bare. Upkeep and
// research lines are the system's, not a session with her.
const LOG_LINE = /^\|?\s*(\d{4}-\d{2}-\d{2})\s*·\s*([^·|]+?)\s*·\s*([^|]*?)\s*\|?\s*$/;
const NOT_A_SESSION = /^(upkeep|research|import|maintenance)\b/i;
const ENDED_BADLY = /\b(crisis|panic|unsafe|bad night|cut short|ongoing)\b/i;
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

const DAY = 86400000;
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export function sessionLines(log) {
  return log
    .split('\n')
    .map((l) => l.match(LOG_LINE))
    .filter((m) => m && !NOT_A_SESSION.test(m[2]))
    .map((m) => ({ date: m[1], kind: m[2].trim(), gist: m[3].trim() }));
}

// SAF-005's marker: a session where the crisis list fired leaves one line saying
// only that, so the next opener is softened even when nothing else was written.
// Nothing personal, and once a day: a second match the same day adds nothing.
// Returns the line to append, or null. Written by safety/crisis-floor.mjs.
export function crisisMarker(log, date) {
  const last = sessionLines(log).at(-1);
  if (last && last.date === date && last.kind === 'crisis') return null;
  return `| ${date} · crisis · ongoing |`;
}

// `_Last updated: 2026-09-14_` or `_Last updated: 27 Sep 2026 (…)_`.
export function snapshotDate(now) {
  const line = now.match(/Last updated:\s*([^_\n]*)/i)?.[1] ?? '';
  const iso = line.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const m = line.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return month < 0 ? null : `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function openingFlags({ log = '', now = '', timeZone = 'UTC', at = new Date() }) {
  const local = zonedDateTime(at, timeZone);
  const today = local.slice(0, 10);
  const hour = Number(local.slice(11, 13));
  const sessions = sessionLines(log);
  const last = sessions.at(-1);
  const flags = [];

  if (last && ENDED_BADLY.test(last.gist)) {
    flags.push(
      `LAST SESSION ENDED BADLY (${last.date}): open soft, about how she is now, not about a thread. No debrief of it unless she opens it, and reopen nothing she asked to drop then. If the crisis block applies again, it governs afresh.`,
    );
  }
  if (hour >= 23 || hour < 5) {
    flags.push(`LATE AT NIGHT where she is (${local.slice(11, 16)}, ${timeZone}): soft, about now. Not "how was your day".`);
  }
  if (!last) {
    flags.push(
      'FIRST CONVERSATION IN THIS SPACE: open on now. No "welcome back", which would be false; never mention where the record came from, and never claim it is empty.',
    );
  } else {
    const gap = days(last.date, today);
    if (gap >= 21) {
      flags.push(`LONG GAP (${gap} days since the last session): welcome her without comment on the gap; nothing that reads as missing her or pulling her back.`);
    }
    flags.push(`LAST OPENER: "${last.gist}" (${last.kind}, ${last.date}). Don't open on the same thread, or on one she declined, twice running.`);
  }
  const updated = snapshotDate(now);
  const age = updated ? days(updated, today) : null;
  if (age !== null && age >= 14) {
    flags.push(`SNAPSHOT STALE (now.md last updated ${age} days ago): ask whether a thread still holds before building on it.`);
  }
  return flags;
}

// ── Before an appointment ────────────────────────────────────────────────────
//
// What she meant to tell her therapist, raised before the appointment rather than
// only when she happens to mention it (T-330's edge cases: "kept but never raised
// is the same as lost"). The next clinical appointment is found where the
// check-in already looks: the "Coming up" table of calendar.md and the copy of her
// Google Calendar (A-093); nothing here writes, least of all to her calendar
// (A-121). What she meant to say is the open items under "Before her next
// appointment" in open_loops.md, verbatim. Two readers: the session brief
// (session/session-brief.mjs) hands her chat the items themselves, the day before
// and the day of; the check-in's plan (ux/scripts/reminders.mjs send-due --kind
// check-ins) gets the day and a count only, since its message reaches a locked
// screen and may say only that something waits (SFG-012). Tested by
// lib/test-appointment-notes.mjs.

/** The words that make a calendar line a clinical appointment. */
export const CLINICAL = /\b(?:therap(?:y|ist|ists)|psychiatr\w*|psycholog\w*|counsell?(?:or|ors|ing)|CBT|DBT|EMDR)\b/i;

/** The open items under "Before her next appointment" (or "my"/"the"), as written. */
export function notesForTherapist(text) {
  const out = [];
  let inside = false;
  for (const line of String(text ?? '').split('\n')) {
    if (/^##\s/.test(line)) {
      inside = /^##\s+Before (?:her|my|the) next appointment\b/i.test(line);
      continue;
    }
    const item = inside && /^\s*-\s*\[ \]\s*(\S.*?)\s*$/.exec(line);
    if (item) out.push(item[1]);
  }
  return out;
}

/** Dated clinical rows of calendar.md's "Coming up" table, as { date, what }. */
export function calendarAppointments(text) {
  const out = [];
  let inside = false;
  for (const line of String(text ?? '').split('\n')) {
    if (/^##\s/.test(line)) {
      inside = /^##\s+Coming up\b/i.test(line);
      continue;
    }
    if (!inside || !line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const date = /(\d{4}-\d{2}-\d{2})/.exec(cells[0] ?? '')?.[1];
    const what = cells.slice(1).join(' ');
    if (date && CLINICAL.test(what)) out.push({ date, what: cells[1] ?? '' });
  }
  return out;
}

const dayIn = (ms, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** Clinical events in the Google Calendar copy, as { date, what }, each dated in her timezone. */
export function googleAppointments(copyText, tz = 'UTC') {
  let copy;
  try {
    copy = JSON.parse(copyText);
  } catch {
    return [];
  }
  const out = [];
  for (const e of copy?.events ?? []) {
    if (!e?.start || !CLINICAL.test(`${e.title ?? ''} ${e.calendar ?? ''}`)) continue;
    const ms = Date.parse(e.start);
    const date = e.all_day ? String(e.start).slice(0, 10) : Number.isNaN(ms) ? null : dayIn(ms, tz);
    if (date) out.push({ date, what: String(e.title ?? '') });
  }
  return out;
}

const nextDay = (day) => new Date(Date.parse(`${day}T12:00:00Z`) + 86400e3).toISOString().slice(0, 10);

/**
 * The notes waiting for an appointment today or tomorrow, or null. Texts in, as
 * read from the record: `loops` (core/state/open_loops.md), `calendar`
 * (core/calendar/calendar.md), `google` (core/calendar/google.json). `today` is
 * her date (YYYY-MM-DD, her timezone); `timeZone` dates the copy's timed events.
 * Returns { date, when: 'today' | 'tomorrow', items }: never the appointment's own
 * words, which no reader needs and the check-in must not carry.
 */
export function appointmentNotes({ loops = '', calendar = '', google = '', today, timeZone = 'UTC' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today ?? ''))) return null;
  const items = notesForTherapist(loops);
  if (!items.length) return null;
  const tomorrow = nextDay(today);
  const near = [...calendarAppointments(calendar), ...googleAppointments(google, timeZone)]
    .map((a) => a.date)
    .filter((d) => d === today || d === tomorrow)
    .sort();
  if (!near.length) return null;
  return { date: near[0], when: near[0] === today ? 'today' : 'tomorrow', items };
}
