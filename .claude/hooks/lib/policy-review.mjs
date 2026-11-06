// When the policies were last reviewed against the law, and whether one is due.
//
// One parser for policies/review-log.md, used by the two things that must agree
// on the answer:
//
//   the check   ux/scripts/check-policies.mjs, run by `npm run check` and the
//               pre-commit gate: is the tracker well formed, and is a review due
//   the hook    session/policy-review-due.mjs, on /dev-mode: if a
//               review is due, the agent raises it before anything else
//
// POL-013, "The policies are reviewed against current law and practice on a
// fixed interval, and the date of the last review is always known." A second
// parser in the hook would be a second opinion on the due date; this is the one.
//
// A review is due on the earlier of two dates: the last review plus the
// interval, and the first date on the watch list after the last review — a law
// coming into force does not wait for the calendar.

import { readFileSync } from 'node:fs';

const field = (text, name) => new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+?)\\s*$`, 'm').exec(text)?.[1];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function addMonths(date, months) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

// Rows of the markdown table under a `## heading`, as arrays of cells.
function tableUnder(text, heading) {
  const at = text.search(new RegExp(`^##\\s+${heading}\\b`, 'mi'));
  if (at === -1) return null;
  const rows = [];
  for (const line of text.slice(at).split('\n').slice(1)) {
    if (/^##\s/.test(line)) break;
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    rows.push(line.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1); // drop the header
}

/** Parse the tracker. Returns { problems, last, next, months, reviews, watch, due, dueBecause }. */
export function readReviewLog(path, today = new Date().toLocaleDateString('en-CA')) {
  const problems = [];
  let text;
  try {
    text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return { problems: ['the review tracker is missing'], due: true, dueBecause: 'there is no record of any review' };
  }

  const last = field(text, 'Last review');
  const next = field(text, 'Next due');
  const months = Number(/^(\d+) months?\b/.exec(field(text, 'Interval') ?? '')?.[1]);

  if (!isDate(last)) problems.push('"**Last review:** YYYY-MM-DD" is missing or not a date');
  if (!isDate(next)) problems.push('"**Next due:** YYYY-MM-DD" is missing or not a date');
  if (!months) problems.push('"**Interval:** N months" is missing');
  if (isDate(last) && months && isDate(next) && next !== addMonths(last, months)) {
    problems.push(`next due should be ${addMonths(last, months)}, the last review plus ${months} months`);
  }

  const reviews = tableUnder(text, 'Reviews') ?? [];
  if (!reviews.length) problems.push('the Reviews table has no rows');
  for (const [date, trigger, benchmarked, outcome] of reviews) {
    if (!isDate(date)) problems.push(`a review row is dated "${date}", not YYYY-MM-DD`);
    else if (!trigger || !benchmarked || !outcome) problems.push(`the ${date} review leaves its trigger, benchmark or outcome blank`);
  }
  const latest = reviews.map((r) => r[0]).filter(isDate).sort().pop();
  if (isDate(last) && latest && latest !== last) problems.push(`the last review is ${last}, but the newest row is ${latest}`);

  const watch = (tableUnder(text, 'Watch list') ?? []).filter((r) => isDate(r[0]));
  const trigger = watch.map((r) => r).filter((r) => isDate(last) && r[0] > last).sort((a, b) => (a[0] < b[0] ? -1 : 1))[0];

  let due = false;
  let dueBecause = '';
  if (isDate(next) && next <= today) {
    due = true;
    dueBecause = `the review was due on ${next}`;
  }
  if (trigger && trigger[0] <= today && (!due || trigger[0] < next)) {
    due = true;
    dueBecause = `${trigger[1]} took effect on ${trigger[0]}, after the last review`;
  }
  if (problems.length && !due) {
    due = true;
    dueBecause = 'the tracker cannot be read';
  }
  return { problems, last, next, months, reviews, watch, due, dueBecause };
}
