// Date labels, in one file, because both server views and client filters need
// them and a client component cannot import anything that reaches lib/content.js
// and so `fs`.
//
// One rule governs everything here: nothing counts days at her. "14 entries in
// the last 30 days" and "9 days since you last wrote" are the same sentence, and
// the second one is a scoreboard. Labels here describe WHEN something happened so
// a thing can be found again. They never describe how often she shows up.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISO(value) {
  const m = ISO.exec(String(value ?? '').trim());
  if (!m) return null;
  // Noon UTC, not midnight: a date-only value parsed at midnight lands on the
  // previous day for anyone west of UTC, and this record is read in Singapore.
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

// "4 March 2026". Long form on purpose: this is a record someone reads, not a log
// someone scans, and 04/03 is ambiguous in exactly the way a record must not be.
export function dateLabel(value) {
  const d = parseISO(value);
  if (!d) return String(value ?? '');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function yearOf(value) {
  const d = parseISO(value);
  return d ? d.getUTCFullYear() : null;
}

// Today, where she is.
//
// Every function below reads the calendar date off `now` with getUTC*, so the
// anchor it is given decides what "today" means. Left as new Date() that is the
// UTC date — and for anyone east of UTC the early hours of the morning fall on
// the previous UTC day, which is how an appointment happening this evening ends
// up labelled "tomorrow" until 8am. The record is read in Singapore, so it was
// wrong for a third of every day.
//
// Returns a Date whose UTC date is her local date, so the functions below need
// no changes: en-CA formats as YYYY-MM-DD, and parseISO anchors that at noon UTC
// the same way a date out of the record is anchored. Two noon-UTC values
// subtract to whole days exactly.
//
// No zone configured, or one the platform does not know, falls back to the
// server clock — the behaviour before this existed.
export function todayIn(timeZone) {
  if (!timeZone) return new Date();
  try {
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parseISO(local) ?? new Date();
  } catch {
    return new Date();
  }
}

// Whole days from today. Negative is past, positive is future. Used only for
// things with a date of their own — an appointment, an anniversary — never for
// anything she did or did not do.
export function daysAway(value, now = new Date()) {
  const d = parseISO(value);
  if (!d) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return Math.round((d.getTime() - today) / 86400000);
}

// "tomorrow", "in 3 days", "next week". For what is coming, so she can see
// whether something needs thinking about before it arrives.
export function untilLabel(value, now = new Date()) {
  const days = daysAway(value, now);
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

// A soft label for when something last changed. Kept vague past a fortnight on
// purpose: the useful fact is "a while back", and a precise day count invites
// reading it as a lapse.
export function agoLabel(value, now = new Date()) {
  const days = daysAway(value, now);
  if (days == null) return '';
  const ago = -days;
  if (ago <= 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago < 14) return `${ago} days ago`;
  if (ago < 60) return `${Math.round(ago / 7)} weeks ago`;
  if (ago < 365) return `${Math.round(ago / 30)} months ago`;
  return `${Math.round(ago / 365)} years ago`;
}

// When a file last changed: the date, and how long ago that was.
//
// "21 Sep 2026 (today)". The year is always written, including this one. A file
// listing conventionally drops it — ls does, git log does — on the argument that
// a column of identical four-digit numbers says nothing, and the argument holds
// for a listing. It does not hold for a single row in a margin: read on its own,
// "21 Sep" is a date whose year you supply from memory, and being sure is worth
// four characters.
//
// The bracket is agoLabel's, softening past a fortnight as it does everywhere
// else. The rule at the top of this file is about HER — a count of days since
// she last wrote is a scoreboard. How old a spec is, is not about her at all.
export function changedLabel(value, now = new Date()) {
  const d = parseISO(value);
  if (!d) return String(value ?? '');
  const on = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
  const ago = agoLabel(value, now);
  return ago ? `${on} (${ago})` : on;
}

// "14 Mar" or "14 March" from a recurring-date cell, which carries a day and a
// month but no year. Returns the number of days until its next occurrence, so a
// hard anniversary can be known about before it lands.
const MONTH_KEYS = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

export function daysUntilRecurring(value, now = new Date()) {
  const m = /^(\d{1,2})\s+([A-Za-z]{3,})/.exec(String(value ?? '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTH_KEYS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (month < 0) return null;

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  let next = Date.UTC(now.getUTCFullYear(), month, day, 12);
  if (next < today) next = Date.UTC(now.getUTCFullYear() + 1, month, day, 12);
  return Math.round((next - today) / 86400000);
}
