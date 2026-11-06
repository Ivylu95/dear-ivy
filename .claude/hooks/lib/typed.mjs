// What the developer typed, as a record no agent writes (MNT-008, WKB-007).
//
// An approval was text an agent could write: a 🤝 entry in the Transcript, or
// an `Approved: "…"` line in a commit. So session/dialogue-record.mjs, which
// keeps each development-mode message in the Transcript verbatim, also appends
// one line per message to `typed.jsonl` beside it: when, and the sha256 of the
// message normalized. Hashes only, never the words, which live in the
// Transcript. privacy/guard-secrets.mjs refuses any tool call naming that file,
// so an agent can write an entry but cannot make it count as typed.
//
// Read by `ux/scripts/dialogue.mjs check` (an agreed card's yes is a typed
// entry) and by git/commit-msg (an `Approved:` quote is his words as typed).
// Every function takes the repository root, so a test runs on a fixture folder.
//
// Kept in parts, as the Transcript's months are (T-499, T-768): `typed.jsonl` is
// the first, and once the last part holds PART_LINES lines the hook begins the
// next beside it, `typed-2.jsonl`, `-3`…, so no part outgrows one read (E-031).
// Every reader reads them all, in order, as one; the guard refuses a write to any.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_DIR } from './paths.mjs';
import { sortParts } from './transcript-parts.mjs';
import { PART_LINES, partPath } from './one-read.mjs';

// The first day the typed record exists in full. A Transcript entry dated
// earlier predates it: no line in the record can stand behind it, so it is
// not asked for one. The record landed on 2026-10-26, and most of that day's
// entries were written before it, so the day itself is exempt too.
export const TYPED_SINCE = '2026-10-27';

const dialogueDir = (root) => join(root, DEV_DIR, 'dialogue');
export const typedFile = (root) => join(dialogueDir(root), 'typed.jsonl');
/** The record and each later part, as a repository path: what the hook stages, and what never counts as left over. */
export const TYPED_PART = /^dev\/dialogue\/typed(?:-(?:[2-9]|[1-9]\d+))?\.jsonl$/;
/** Every part of the record that exists, in order, the first being `typedFile`. */
export function typedFiles(root) {
  const out = [];
  for (let n = 1; existsSync(partPath(typedFile(root), n)); n += 1) out.push(partPath(typedFile(root), n));
  return out;
}
/** The whole record's text, every part in order; '' when there is none. */
function typedText(root) {
  return typedFiles(root).map((f) => {
    try {
      return readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  }).join('\n');
}
export const transcriptDir = (root) => join(dialogueDir(root), 'transcript');

/** One spelling for the same words: NFC, straight quotes, one space, lower case. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const sha = (text) => createHash('sha256').update(normalize(text)).digest('hex');

/** Append one message to the record, beginning the next part once the last is full. Called only by the recording hook; returns the file written. */
export function recordTyped(text, root, at = new Date(), limit = PART_LINES) {
  if (!normalize(text)) return null;
  const parts = typedFiles(root);
  const last = parts.at(-1);
  const lines = last ? readFileSync(last, 'utf8').split('\n').filter((l) => l.trim()).length : 0;
  const file = !last ? typedFile(root) : lines >= limit ? partPath(typedFile(root), parts.length + 1) : last;
  appendFileSync(file, `${JSON.stringify({ at: at.toISOString(), sha: sha(text) })}\n`);
  return file;
}

/** sha → how many times he typed it. A line that is not the record's shape counts for nothing. */
export function typedCounts(root) {
  const counts = new Map();
  for (const line of typedText(root).split('\n')) {
    try {
      const { sha: h } = JSON.parse(line);
      if (/^[0-9a-f]{64}$/.test(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
    } catch {
      // A blank line, or a merge's leftovers: nothing typed.
    }
  }
  return counts;
}

export const isTyped = (text, root, counts = typedCounts(root)) => Boolean(normalize(text)) && counts.has(sha(text));

/**
 * Every Transcript entry with the words the hook wrote for it: the `>` lines
 * straight under its heading, prefix taken off. Lines quoted further down
 * (an agent's note, a card) are not the message.
 */
export function transcriptQuotes(root) {
  const dir = transcriptDir(root);
  if (!existsSync(dir)) return [];
  const out = [];
  // A month's parts in order (T-499): each part is read as the month's next lines.
  for (const file of sortParts(readdirSync(dir))) {
    let entry = null;
    for (const line of readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
      const head = line.match(/^### (T-\d+) · (\d{4}-\d\d-\d\d) · (.+)$/);
      if (head) {
        entry = { id: head[1], date: head[2], way: head[3].trim(), lines: [], open: true };
        out.push(entry);
      } else if (entry?.open && line.startsWith('>')) entry.lines.push(line.replace(/^>\s?/, ''));
      else if (entry) entry.open = false;
    }
  }
  return out.map(({ id, date, way, lines }) => ({ id, date, way, quote: lines.join('\n') }));
}

/**
 * The ids of the entries the record stands behind, dated from TYPED_SINCE on.
 * Each typed line backs one entry: an entry an agent writes with the words of
 * one he did type ("yes") takes a line no other entry has, so the copy beyond
 * the count is not backed.
 */
export function typedEntries(root, since = TYPED_SINCE) {
  const counts = typedCounts(root);
  const used = new Map();
  const backed = new Set();
  for (const e of transcriptQuotes(root)) {
    if (e.date < since || !normalize(e.quote)) continue;
    const h = sha(e.quote);
    const n = used.get(h) ?? 0;
    if (n < (counts.get(h) ?? 0)) {
      used.set(h, n + 1);
      backed.add(e.id);
    }
  }
  return backed;
}

/** True when these words are part of a message he typed, as the Transcript keeps it. */
export function quoteIsTyped(quote, root) {
  const q = normalize(quote);
  if (!q) return false;
  const counts = typedCounts(root);
  return transcriptQuotes(root).some((e) => normalize(e.quote).includes(q) && isTyped(e.quote, root, counts));
}

// Every message he typed keeps an entry (A-047, 2026-11-04). A merge or a race can
// lose an entry while its typed line stays: on 3 Nov another chat's remark overwrote
// one of his, and nothing saw it. So from ENTRY_SINCE on, each typed line needs an
// entry with its words, or an entry that day whose words were taken out under a
// mark (moved to his record, a name kept out). Lines under a day old are left: the
// hook stages its line at once, and the entry may still be unsorted and unstaged.
export const ENTRY_SINCE = '2026-11-03';
export const REDACTED = /\[moved to his record\]|\[a name\]|\[someone[^\]]*\]|\*\(words not kept/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The record's lines, in order: { at, sha }. */
export function typedRows(root) {
  const rows = [];
  for (const line of typedText(root).split('\n')) {
    try {
      const { at, sha: h } = JSON.parse(line);
      if (/^[0-9a-f]{64}$/.test(h) && typeof at === 'string') rows.push({ at, sha: h });
    } catch {
      // A blank line, or a merge's leftovers.
    }
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Typed lines with no entry: [{ date, at: [times] }], one per day short. `entries`
 * as transcriptQuotes gives them. A day's marked entries no line matches cover that
 * many of its lines; the rest are words that went missing.
 */
export function missingEntries(rows, entries, { since = ENTRY_SINCE, now = Date.now() } = {}) {
  const have = new Map();
  for (const e of entries) {
    if (!normalize(e.quote)) continue;
    const h = sha(e.quote);
    (have.get(h) ?? have.set(h, []).get(h)).push(e);
  }
  const typed = new Map();
  for (const r of rows) (typed.get(r.sha) ?? typed.set(r.sha, []).get(r.sha)).push(r);
  const short = new Map();
  const cover = new Map();
  for (const [h, list] of typed) {
    const n = have.get(h)?.length ?? 0;
    for (const r of list.slice(n)) {
      const date = r.at.slice(0, 10);
      if (date >= since && Date.parse(r.at) <= now - DAY_MS) (short.get(date) ?? short.set(date, []).get(date)).push(r.at);
    }
  }
  for (const [h, list] of have) {
    for (const e of list.slice(typed.get(h)?.length ?? 0)) if (REDACTED.test(e.quote)) cover.set(e.date, (cover.get(e.date) ?? 0) + 1);
  }
  // A line is dated in UTC, an entry by whoever wrote it, often the developer's own
  // day: a remark at 00:30 his time is a day earlier in UTC (6 Nov 2026: a marked
  // entry dated 5 Nov left a line from 16:30 UTC on 4 Nov counted as lost). So a mark
  // covers a line from its UTC day or its local day, one mark one line.
  // A mark cannot say which line it replaced: when a day has more lines than marks, the
  // times a mark was taken to cover are named too, as `or`, so the search starts at every
  // line it could be (6 Nov 2026: the report named 16:30, whose words were moved out under
  // a mark; the lost one was 13:54, and hours went to the wrong chat).
  const out = [];
  for (const [date, at] of [...short].sort()) {
    const covered = [];
    const left = at.filter((t) => {
      for (const d of new Set([date, localDay(t)])) {
        const n = cover.get(d) ?? 0;
        if (n > 0) { cover.set(d, n - 1); covered.push(t); return false; }
      }
      return true;
    });
    if (left.length) out.push({ date, at: left, ...(covered.length && { or: covered }) });
  }
  return out;
}

/** The developer's own day for a UTC time, in DEAR_TZ (Singapore by default). */
function localDay(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: process.env.DEAR_TZ || 'Asia/Singapore' });
}
