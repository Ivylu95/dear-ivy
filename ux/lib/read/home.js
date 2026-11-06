// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the home reader. Nothing here writes.

import { core, derive, listDir, readFile, render } from '@/lib/read/source';
import { getToday } from '@/lib/read/profile';
import { getTimeline } from '@/lib/read/timeline';
import { getCalendar } from '@/lib/read/calendar';
import { getPeople, peopleOnFile } from '@/lib/read/people';
import { renderSections } from '@/lib/read/me';
import { getOpenLoops } from '@/lib/read/loops';

// ── Now ─────────────────────────────────────────────────────────────────────

// The snapshot, read first in every session and first on this page. Returned as
// its sections rather than one blob, so the home view can give "How she's doing"
// the weight it has in the file and let the rest sit under it.
function getNow() {
  const file = readFile(core('state/now.md'));
  // A source that could not be read is a fault, and an empty one is ordinary
  // (NOW-004): say which, so the view can state the fault instead of drawing a gap.
  if (!file) return { missing: true, filled: false, path: 'core/state/now.md', sections: [] };
  return derive(file, 'now', () => ({
    updated: file.updated,
    filled: file.filled,
    path: file.path,
    sections: renderSections(file.raw),
  }));
}


// ── The record itself ───────────────────────────────────────────────────────

export function getIndex() {
  return render('README.md');
}

// One line per session. Read only for the date of the most recent one, which is
// the single honest answer to "when was this record last added to" — and which
// the home view shows as a date, never as a gap.
export function getLastSession() {
  const file = readFile(core('state/log.md'));
  if (!file) return null;
  const dates = [...file.raw.matchAll(/(\d{4}-\d{2}-\d{2})\s*·/g)].map((m) => m[1]).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

// ── Nav counts ──────────────────────────────────────────────────────────────

// What the rail shows beside a view's name.
//
// Only two things are counted, and both are counts of THINGS ON FILE, never of
// her behaviour: how many people have a file, and how many threads are open. No
// journal count, no session count, no streak. The rule is at the top of
// theme/palette.mjs and it is enforced here, not just described there.
export function getNavCounts() {
  const counts = {};
  // A readdir, not getPeople(): the count needs the files, not every one of
  // them rendered, and this runs from the layout on every page.
  const people = peopleOnFile().length;
  if (people > 0) counts['/people'] = { value: people };
  const loops = getOpenLoops().open;
  if (loops > 0) counts['/loops'] = { value: loops };
  return counts;
}

// ── Home ────────────────────────────────────────────────────────────────────

// Everything the home view needs, read in the order CLAUDE.md prescribes for a
// session: now, then the timeline, then what those point at. The view is the
// same read a session does, rendered.
//
// Dated from getToday(), in her timezone, like every other view. A bare
// new Date() is UTC, and for hours a day split "Coming up" differently from
// /calendar.
export function getHome(now = getToday()) {
  const timeline = getTimeline();
  const calendar = getCalendar(now);
  const people = getPeople();

  return {
    now: getNow(),
    lastSession: getLastSession(),
    recent: timeline.entries.slice(0, 6),
    timelineFilled: timeline.filled,
    calendar,
    loops: getOpenLoops(),
    people,
    // The focus file alone: home shows nothing else from therapy, and
    // getTherapy() would render every session to get it.
    focus: render('therapy/what_im_working_on.md'),
    // True until anything real is on file. The whole surface changes shape in
    // that state rather than showing eight empty panels, which would read as a
    // system that is broken instead of a record that has not started.
    blank:
      !timeline.filled &&
      !calendar.filled &&
      people.length === 0 &&
      listDir(core('journal')).length === 0,
  };
}
