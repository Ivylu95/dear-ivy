// SessionStart (new, resumed, cleared or compacted) — the retrieval order, done for the model.
//
// CLAUDE.md: "Retrieval order, every time: now.md -> timeline.md (Eras, then the
// range that matters) -> the two or three files it points at. Never sweep the
// folder." The first two are the same two files every time, so reading them is
// work a hook can do before the first word rather than work the session has to
// remember to do.
//
// It also does the one piece of arithmetic the model cannot do by reading:
// whether today falls inside a fortnight of a date in the hard-anniversaries
// table. "Know when you're inside a fortnight of one. Be gentler. Don't
// announce it." Knowing requires counting days; the record cannot count.
//
// MEM-001 design 2: the snapshot and the timeline's eras arrive before her
// first word, so the first reply is not the first misstep.
//
// After a compaction it runs again, because the compaction that loses her
// snapshot is exactly the one after which the session starts guessing. That
// rerun is SessionStart's (source "compact"), not PreCompact's: Claude Code
// takes no additionalContext from a PreCompact hook and prints an error on
// every /compact instead (seen 2026-10-01). A PreCompact call passes silently.

import { readHookInput, context, pass, read, dataDir } from '../lib/hook.mjs';
import { openingFlags } from '../lib/opening.mjs';
import { profilePath, record } from '../lib/profile.mjs';
import { join } from 'node:path';
import { CORE_DATA, timelineText } from '../lib/modules.mjs';

const input = await readHookInput();
if (input?.hook_event_name === 'PreCompact') pass();
const event = 'SessionStart';

const now = read(join(dataDir, CORE_DATA, 'state', 'now.md')).trim();
// With a split timeline's year files after it, oldest year first, so the tail is the latest (D14).
const timeline = timelineText(dataDir, read)
  .split('\n')
  .filter((l) => /^\s*(\||-|\d{4}-\d{2}-\d{2})/.test(l) && /\d{4}-\d{2}-\d{2}/.test(l));

// The Eras: the orienting tier CLAUDE.md says to read before the entries.
// Only when it holds something beyond its template placeholder.
const eras = (read(join(dataDir, CORE_DATA, 'timeline.md')).split(/^##\s+/m).find((s) => /^Eras\b/.test(s)) ?? '')
  .split('\n')
  .slice(1)
  .join('\n')
  .replace(/<!--[\s\S]*?-->/g, '') // comments
  .replace(/(^|\n)_[\s\S]*?_(?=\n|$)/g, '$1') // italic instructions, however many lines
  .replace(/^-{3,}\s*$/gm, '') // rules
  .trim();

// How she wants to be spoken to: read before writing, every session (PRD-004).
// A correction she made once must not depend on the model remembering to open
// the file. Only once it holds her words, not the template's.
const talk = read(join(dataDir, CORE_DATA, 'me', 'how_to_talk_to_me.md'));
const talkBody = talk.includes('<!-- unfilled:') ? '' : talk.trim();

// Her Google Calendar's next week, from the copy the check-in refreshes through
// the connector (A-093), so a session knows what is coming without being told.
let googleWeek = [];
try {
  const copy = JSON.parse(read(join(dataDir, CORE_DATA, 'calendar', 'google.json')) || '{}');
  const from = Date.now() - 86400e3;
  const to = Date.now() + 7 * 86400e3;
  googleWeek = (copy.events ?? [])
    .filter((e) => {
      const t = Date.parse(e.all_day ? `${String(e.start).slice(0, 10)}T00:00:00Z` : e.start);
      return t >= from && t <= to;
    })
    .map((e) => `- ${e.all_day ? `${String(e.start).slice(0, 10)} all day` : String(e.start).slice(0, 16).replace('T', ' ')} · ${e.title}`);
  if (googleWeek.length) googleWeek.unshift(`(copied ${String(copy.synced_at).slice(0, 16).replace('T', ' ')} UTC)`);
} catch {
  googleWeek = []; // no copy, or one that cannot be read: the session reads calendar.md as before
}

const parts = [];
if (now) parts.push(['data/core/state/now.md — the snapshot, read first:', '', now].join('\n'));
if (googleWeek.length) parts.push(['data/core/calendar/google.json — her Google Calendar, the next week (read-only; never write to it without her yes):', '', ...googleWeek].join('\n'));
if (talkBody) parts.push(['data/core/me/how_to_talk_to_me.md — read before you write a word to her:', '', talkBody].join('\n'));
if (eras) parts.push(['data/core/timeline.md — Eras, to orient:', '', eras].join('\n'));
// The tail gives way, never the snapshot: context over CONTEXT_LIMIT reaches the
// model as a 2,000-character preview, and this one ran 15.1k on 2026-10-03. The
// snapshot stays whole; the timeline is its last TAIL entries and a pointer.
const TAIL = 10;
if (timeline.length) {
  const shown = Math.min(TAIL, timeline.length);
  const tail = [`data/core/timeline.md — the last ${shown} of ${timeline.length} entries:`, '', ...timeline.slice(-TAIL)];
  if (timeline.length > TAIL) tail.push('', `For the ${timeline.length - TAIL} earlier entries, read data/core/timeline.md: the range that matters, not the whole file.`);
  parts.push(tail.join('\n'));
}

// Hard anniversaries: "| DD Mon | what | how she wants it handled |"
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const calendar = read(join(dataDir, CORE_DATA, 'calendar', 'calendar.md'));
const hard = calendar.split(/^##\s+/m).find((s) => /^Recurring — the hard ones/i.test(s)) ?? '';
const todayDate = new Date();
const near = [];
for (const line of hard.split('\n')) {
  const m = line.match(/^\|\s*(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) continue;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) continue;
  for (const year of [todayDate.getFullYear() - 1, todayDate.getFullYear(), todayDate.getFullYear() + 1]) {
    const days = Math.round((new Date(year, month, Number(m[1])) - todayDate) / 86400000);
    if (days >= -3 && days <= 14) near.push(`${line.trim()}   (${days === 0 ? 'today' : days > 0 ? `in ${days} days` : `${-days} days ago`})`);
  }
}
if (near.length) {
  parts.push(
    ['INSIDE A FORTNIGHT OF A HARD ANNIVERSARY — be gentler, and do not announce it:', '', ...near].join('\n'),
  );
}

// The opening: what should shape the first question, worked out here so it holds
// whatever skill loads, or none (lib/opening.mjs). Only at the start of
// a session; after a compaction the opening is long past.
if (event === 'SessionStart') {
  const opening = openingFlags({
    log: read(join(dataDir, CORE_DATA, 'state', 'log.md')),
    now,
    timeZone: record.readProfile(read(profilePath(dataDir))).value.timezone ?? 'UTC',
  });
  if (opening.length) {
    parts.push(['OPENING — for her first question; the first line that applies decides, and none of it is said to her:', '', ...opening].join('\n'));
  }
}

if (!parts.length) pass();
context(event, parts.join('\n\n---\n\n'));
