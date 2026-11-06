// SessionStart + PreCompact — the retrieval order, done for the model.
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
// On PreCompact it runs again, because the compaction that loses her snapshot
// is exactly the one after which the session starts guessing.

import { readHookInput, context, pass, read, dataDir } from '../lib/hook.mjs';
import { join } from 'node:path';

const input = await readHookInput();
const event = input?.hook_event_name === 'PreCompact' ? 'PreCompact' : 'SessionStart';

const now = read(join(dataDir, 'state', 'now.md')).trim();
const timeline = read(join(dataDir, 'timeline.md'))
  .split('\n')
  .filter((l) => /^\s*(\||-|\d{4}-\d{2}-\d{2})/.test(l) && /\d{4}-\d{2}-\d{2}/.test(l));

const parts = [];
if (now) parts.push(['data/state/now.md — the snapshot, read first:', '', now].join('\n'));
if (timeline.length) {
  parts.push(
    [`data/timeline.md — the last ${Math.min(10, timeline.length)} of ${timeline.length} entries:`, '', ...timeline.slice(-10)].join('\n'),
  );
}

// Hard anniversaries: "| DD Mon | what | how she wants it handled |"
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const calendar = read(join(dataDir, 'calendar', 'calendar.md'));
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

if (!parts.length) pass();
context(event, parts.join('\n\n---\n\n'));
