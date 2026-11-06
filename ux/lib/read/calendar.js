// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the calendar reader. Nothing here writes.

import { daysAway, daysUntilRecurring } from '@/lib/dates';
import { sections, table } from '@/lib/markdown';
import { core, derive, readFile } from '@/lib/read/source';
import { getToday } from '@/lib/read/profile';

// ── Calendar ────────────────────────────────────────────────────────────────

// The file's three tables, parsed once per version of the file (derive()), like
// the timeline and the loops. Only the text is cached here: everything measured
// against today is worked out per call in getCalendar, because a cached split
// on today would go stale at midnight with nothing on disk having changed.
function parseCalendar(file) {
  const parsed = sections(file.raw);
  const dated = table(file.raw, 'Coming up', parsed)
    .map((row) => ({
      date: /(\d{4}-\d{2}-\d{2})/.exec(row.date ?? '')?.[1] ?? row.date ?? '',
      what: row.what ?? '',
      notes: row.notes ?? '',
    }))
    .filter((r) => r.what)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    dated,
    hardRows: table(file.raw, 'Recurring — the hard', parsed),
    goodRows: table(file.raw, 'Recurring — the good', parsed),
  };
}

// What is coming, and the dates that land hard every year.
//
// The hard anniversaries are the reason this is read on the home view rather than
// only on its own tab. CLAUDE.md asks the agent to know when it is inside a
// fortnight of one and be gentler without announcing it; a surface that only
// showed them on a tab she has to think to open would be no help with that.
export function getCalendar(now = getToday()) {
  const file = readFile(core('calendar/calendar.md'));
  if (!file) return { upcoming: [], passed: [], hard: [], good: [], nearHard: [], filled: false };

  const { dated, hardRows, goodRows } = derive(file, 'calendar', parseCalendar);

  // Split on today, rather than showing the whole table under "Coming up".
  //
  // calendar/calendar.md says an entry moves to the timeline once it has passed, but that
  // happens in a session, and sessions do not run on the day a thing happens. So
  // between an appointment and the next conversation the row is still sitting in
  // the file — and it was being rendered under "Coming up", on the home view,
  // labelled "3 days ago". A surface that tells her an appointment she has
  // already been to is still ahead of her is worse than one that says nothing.
  //
  // Passed rows are kept and shown, not hidden: the record does not delete, and
  // "did that happen?" is a real question. They just stop being the future.
  const isPast = (r) => {
    const away = daysAway(r.date, now);
    return away != null && away < 0;
  };

  const upcoming = dated.filter((r) => !isPast(r));
  const passed = dated.filter(isPast).reverse();

  const recurring = (rows) =>
    rows
      .map((row) => {
        const when = row.date_dd_mon ?? row.date ?? '';
        const days = daysUntilRecurring(when, now);
        return {
          when,
          what: row.what ?? '',
          handling: row.how_she_wants_it_handled ?? row.how_it_s_handled ?? '',
          daysAway: days,
          // A fortnight, matching the window CLAUDE.md names. The view uses it to
          // decide what to carry, never to put a countdown in front of her.
          near: days != null && days <= 14,
        };
      })
      .filter((r) => r.what);

  const hard = recurring(hardRows);
  const good = recurring(goodRows);

  return {
    upcoming,
    passed,
    hard,
    good,
    // Anything hard inside the fortnight. Read by the home view, which changes
    // its own tone rather than saying anything about it.
    nearHard: hard.filter((h) => h.near),
    filled: dated.length > 0 || hard.length > 0 || good.length > 0,
    path: file.path,
  };
}
