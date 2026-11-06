// The eval history, one file per day (A-071, E-031).
//
// Every run of an eval card is a line of JSON. Kept in one file it passed the
// one-read line within a fortnight, so each line now goes to
// dev/evals/history/<YYYY-MM-DD>.jsonl, the UTC day of its own `date`. Readers
// get the whole history, oldest day first, the order within a day kept, exactly
// as one file read before. A busy day keeps parts (<day>.2.jsonl, <day>.3.jsonl …),
// a new one begun before a part would pass PART_LINES, so each stays within one
// read. Each file is merged by union (.gitattributes), so two chats recording runs
// at once both keep theirs.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DAY = /^(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.jsonl$/;
// Under the one-read line of 1000 (E-031), with room for two chats appending at once.
export const PART_LINES = 900;

/** A day file's [day, part] for ordering: the bare day file is part 1. */
const order = (n) => {
  const m = DAY.exec(n);
  return [m[1], Number(m[2] ?? 1)];
};
const byOrder = (a, b) => {
  const [da, pa] = order(a);
  const [db, pb] = order(b);
  return da < db ? -1 : da > db ? 1 : pa - pb;
};
const lineCount = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).length : 0);

/** A line's UTC day: its own date's, else today's. */
const dayOf = (entry) => {
  const t = Date.parse(entry?.date ?? '');
  return new Date(Number.isNaN(t) ? Date.now() : t).toISOString().slice(0, 10);
};

/** The day's last part, or a new one when `adding` more lines would pass PART_LINES. */
export function dayFile(dir, entry, adding = 1) {
  const day = dayOf(entry);
  const parts = existsSync(dir) ? readdirSync(dir).filter((n) => DAY.test(n) && order(n)[0] === day).sort(byOrder) : [];
  const last = parts.at(-1);
  if (!last) return join(dir, `${day}.jsonl`);
  if (lineCount(join(dir, last)) + adding <= PART_LINES) return join(dir, last);
  return join(dir, `${day}.${order(last)[1] + 1}.jsonl`);
}

/** Every line, oldest day first; an unreadable line is skipped, as before. */
export function readHistory(dir) {
  // A chat still on the code from before the split appends to the old single file
  // until it takes main; its lines are read first, so no run goes missing.
  const legacy = `${dir}.jsonl`;
  const files = [...(existsSync(legacy) ? [legacy] : []), ...(existsSync(dir) ? readdirSync(dir).filter((n) => DAY.test(n)).sort(byOrder).map((n) => join(dir, n)) : [])];
  return files
    .flatMap((f) => readFileSync(f, 'utf8').split('\n'))
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Append entries, each to its own day's file. */
export function appendHistory(dir, entries) {
  mkdirSync(dir, { recursive: true });
  const byDay = new Map();
  for (const e of [entries].flat()) byDay.set(dayOf(e), [...(byDay.get(dayOf(e)) ?? []), e]);
  for (const list of byDay.values()) {
    const lines = list.map((e) => JSON.stringify(e));
    appendFileSync(dayFile(dir, list[0], lines.length), `${lines.join('\n')}\n`);
  }
}
