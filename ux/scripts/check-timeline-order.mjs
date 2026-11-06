// The invented timelines run in order of when things happened (MEM-007, "The
// record is ordered by when things happened, not by when they were said.",
// design 2).
//
//   node scripts/check-timeline-order.mjs     the sample's and the sandbox's timelines
//
// Each entry opens with the date it happened; a line told later carries
// "(told YYYY-MM-DD)" after it, and that date is never the one sorted on. A line
// out of order is named with the line before it. Only the invented records,
// data-sample/ and data-sandbox/, are read: her record is never opened by a
// check, so in hers the order stays held by instruction. What this proves is
// that the record the views and the skills are tried against keeps the rule,
// so a sample built out of order cannot teach the wrong one.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The entries, after the "Entries" heading, as dates in file order: a table row
// `| YYYY-MM-DD | …` or a line `YYYY-MM-DD · …`, the first date on it.
export function entryDates(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s+entries\b/i.test(l.trim()));
  const out = [];
  lines.forEach((line, i) => {
    if (start > -1 && i <= start) return;
    const m = /^\s*(?:\|\s*)?(\d{4}-\d{2}-\d{2})\b/.exec(line);
    if (m) out.push({ line: i + 1, date: m[1] });
  });
  return out;
}

export function outOfOrder(text) {
  const dates = entryDates(text);
  return dates.slice(1).flatMap((d, i) => (d.date < dates[i].date ? [{ ...d, before: dates[i] }] : []));
}

const self = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (self) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = ['data-sample/core/timeline.md', 'data-sandbox/core/timeline.md'].filter((f) => existsSync(join(root, f)));
  const found = files.flatMap((f) => outOfOrder(readFileSync(join(root, f), 'utf8')).map((d) => `  ${f}:${d.line} · ${d.date} comes after ${d.before.date} (line ${d.before.line})`));
  if (found.length) {
    console.error(`timeline order: ${found.length} entr${found.length === 1 ? 'y' : 'ies'} out of order (MEM-007); sort by when it happened, never by when it was told:\n${found.join('\n')}`);
    process.exit(1);
  }
  console.log(`timeline order: ${files.length} invented timeline${files.length === 1 ? '' : 's'}, every entry in the order it happened`);
}
