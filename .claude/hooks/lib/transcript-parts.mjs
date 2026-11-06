// A month of the Transcript kept in parts (T-499, HYG-002): `<YYYY-MM>.md` is
// the first part, `<YYYY-MM>-2.md`, `-3.md`… the later ones, each under the
// one-read line, cut only between entries. Every reader takes all of a month's
// parts in this order and reads them as one file; the hook that keeps each
// remark appends to the month's last part, and starts the next part when the
// last would pass PART_LINES. October 2026 reached 2,700 lines in one file
// before this, past what an agent reads in one go (bounded-size, A-071).
//
// Only names here, never a read: a copy without dev/ still loads it (ARC-008).

// The one-read line every tracked file stays under (HYG-002, bounded-size), and
// where the hook starts a new part: short of it, so the day's sorting (a Gist, a
// Became line, a card) still fits in the part it lands in. Shared with every other
// generator that cuts itself (lib/one-read.mjs).
import { ONE_READ, PART_LINES, lineCount } from './one-read.mjs';
export { ONE_READ, PART_LINES, lineCount };

/** A Transcript file name: its month, and its part (1 for the bare month). */
export const PART_FILE = /^(\d{4}-\d\d)(?:-([2-9]|[1-9]\d+))?\.md$/;
const base = (f) => String(f).split('/').pop();
export const isPart = (f) => PART_FILE.test(base(f));
export function partOf(f) {
  const m = base(f).match(PART_FILE);
  return m ? { month: m[1], part: Number(m[2] ?? 1) } : null;
}
export const partName = (month, part = 1) => (part === 1 ? `${month}.md` : `${month}-${part}.md`);

/** Transcript file names (or paths), oldest month first and each month's parts in order; anything else dropped. */
export function sortParts(names) {
  return names.filter(isPart).sort((a, b) => {
    const [x, y] = [partOf(a), partOf(b)];
    return x.month === y.month ? x.part - y.part : x.month < y.month ? -1 : 1;
  });
}

/** The same, grouped by month, newest month first: [[month, [part names in order]]]. */
export function monthsNewestFirst(names) {
  const months = new Map();
  for (const f of sortParts(names)) {
    const { month } = partOf(f);
    months.set(month, [...(months.get(month) ?? []), f]);
  }
  return [...months].reverse();
}

/** The heading a later part opens with: no entries, so every reader skips it as it skips the first part's. */
export const partHeader = (month, part, monthName) =>
  `# Transcript · ${monthName} · part ${part}\n\n` +
  `The month continues from [\`${partName(month, part - 1)}\`](${partName(month, part - 1)}). A month is kept in parts, each\n` +
  'under the one-read line and cut only between entries; every reader reads them in order, as one.\n\n---\n';

// ── A part grown past the line ──────────────────────────────────────────────
// The hook caps only the part it appends to. A part already cut still grows two
// ways it never sees: sorting adds lines to entries in it (topics put back on every
// remark grew each October part by about 190 lines, 88446169), and a merge puts
// this chat's new remarks at the end of the part the chat wrote them to, even when
// main has since begun a later one (mergeTranscript appends them to the part it
// merges, and a merge driver can write no other file). So `dialogue.mjs check`
// refuses a part past ONE_READ, and `dialogue.mjs split` cuts the month again.

/** The parts past the one-read line, as [name, lines], from { name: text }. */
export const oversizeParts = (files, limit = ONE_READ) =>
  sortParts(Object.keys(files)).map((f) => [f, lineCount(files[f])]).filter(([, n]) => n > limit);

/**
 * One month's parts cut again, from the first part past `over`: its entries and
 * every later part's, in order and word for word, packed into parts of at most
 * `limit` lines, cut only between entries; parts before it are left as they are.
 * `parts` is [[name, text]] for one month, in order. Returns [[name, text]]; a
 * part no longer needed comes back with text null (never left holding a copy).
 */
export function recut(parts, { limit = PART_LINES, over = ONE_READ } = {}) {
  const ordered = sortParts(parts.map(([f]) => f)).map((f) => parts.find(([g]) => g === f));
  const from = ordered.findIndex(([, t]) => lineCount(t) > over);
  if (from < 0) return ordered;
  const { month } = partOf(ordered[0][0]);
  const monthName = (String(ordered[0][1]).match(/^# Transcript · (.+)$/m) ?? [])[1] ?? month;
  const heads = [];
  const entries = [];
  for (const [, text] of ordered.slice(from)) {
    const chunks = String(text).split(/^(?=### T-\d+ · )/m);
    heads.push(chunks[0].startsWith('### T-') ? '' : chunks.shift());
    entries.push(...chunks.map((c) => c.replace(/\n+$/, '')));
  }
  const firstHead = from === 0 ? heads[0].replace(/\n+$/, '') : null;
  const headOf = (n) => (n === 1 && firstHead !== null ? firstHead : partHeader(month, n, monthName).replace(/\n+$/, ''));
  const render = (n, list) => `${headOf(n)}\n\n${list.join('\n\n')}\n`;
  const out = ordered.slice(0, from);
  let n = from + 1;
  let list = [];
  for (const e of entries) {
    if (list.length && lineCount(render(n, [...list, e])) > limit) {
      out.push([partName(month, n), render(n, list)]);
      n += 1;
      list = [];
    }
    list.push(e);
  }
  if (list.length) out.push([partName(month, n), render(n, list)]);
  for (const [f] of ordered.slice(from)) if (!out.some(([g]) => g === f)) out.push([f, null]);
  return out;
}
