// The idea list (A-125, WKB-017): every idea the developer drops in a dev chat,
// and every idea an agent offers, kept in dev/ideas.md, one line each:
//
//   - idea · <the idea> · his | agent's · from T-NNN · open | built T-NNN | parked T-NNN | dropped T-NNN · found: <what was found> · opened YYYY-MM-DD
//
// "from" is the Transcript remark it came from (his own words, or the remark an
// agent's idea answered), so it can be found again however long the list grows.
// An idea leaves "open" only on his word: built, parked or dropped names the
// remark that said so, and that remark must be one the typed record stands
// behind (lib/typed.mjs), so an agent cannot mark one built on its own say.
// One line of prose, "Put back: YYYY-MM-DD" (or "never"), records when the open
// ones were last shown to him; the dev menu shows them again in each new month.
//
// Read by the reply-shape hook (the monthly showing), checked by
// ux/scripts/check-for-you.mjs in the commit gate, and run by ux/scripts/ideas.mjs.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { read, repoRoot } from './hook.mjs';
import { IDEAS_FILE } from './paths.mjs';
import { TYPED_SINCE, transcriptDir, typedEntries } from './typed.mjs';
import { sortParts } from './transcript-parts.mjs';

export const IDEAS = join(repoRoot, IDEAS_FILE);
// From this day every remark sorted as a 💡 what-if, by its heading or its Also
// line, must be on the list: the day the list was built. Earlier ones were kept
// by hand when it began.
export const IDEAS_SINCE = '2026-11-02';
export const WHOSE = ['his', "agent's"];
const ITEM_RE = /^- idea · (.+?) · (his|agent's) · from (T-\d+) · (open|(built|parked|dropped) (T-\d+)) · found: (.+?) · opened (\d{4}-\d{2}-\d{2})$/;
const PUT_BACK_RE = /^Put back: (never|\d{4}-\d{2}-\d{2})\s*$/m;

/**
 * { ideas, putBack, problems, warnings } from the list's text. Every line opening
 * "- " must be an idea line; one that would be skipped is a problem, since a
 * skipped idea is one he never sees again.
 */
export function parseIdeas(text = read(IDEAS) ?? '') {
  const ideas = [];
  const problems = [];
  const warnings = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^\s*[-*+] /.test(line)) continue;
    const m = line.match(ITEM_RE);
    if (!m) {
      problems.push(`not in the idea format: ${line.slice(0, 80)}`);
      continue;
    }
    ideas.push({ what: m[1], whose: m[2], from: m[3], status: m[5] ?? 'open', by: m[6] ?? '', found: m[7].trim(), opened: m[8] });
  }
  const pb = String(text).match(PUT_BACK_RE);
  if (!pb) problems.push('no "Put back: YYYY-MM-DD" (or "never") line: when the open ideas were last shown to him is unknown');
  const whats = ideas.map((i) => i.what.toLowerCase());
  for (const w of new Set(whats.filter((w, i) => whats.indexOf(w) !== i))) warnings.push(`listed twice: ${w.slice(0, 70)}`);
  return { ideas, putBack: pb && pb[1] !== 'never' ? pb[1] : '', problems, warnings };
}

/**
 * Each Transcript remark: { id, date, ways } where ways holds the heading's way
 * and every way on its Also line. Read from a root's transcript folder.
 */
export function transcriptRemarks(root = repoRoot) {
  const dir = transcriptDir(root);
  if (!existsSync(dir)) return [];
  const out = [];
  let entry = null;
  for (const file of sortParts(readdirSync(dir))) {
    for (const line of readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
      const head = line.match(/^### (T-\d+) · (\d{4}-\d\d-\d\d) · (.+)$/);
      if (head) out.push((entry = { id: head[1], date: head[2], ways: [head[3].trim()] }));
      else if (entry && /^- \*\*Also:\*\*/.test(line)) entry.ways.push(...line.replace(/^- \*\*Also:\*\*/, '').split('·').map((w) => w.trim()).filter(Boolean));
      else if (/^## /.test(line)) entry = null;
    }
  }
  return out;
}

/**
 * What breaks A-125 in a parsed list, given the Transcript's remarks and the ids
 * the typed record stands behind:
 *  - an idea whose "from" remark is not in the Transcript cannot be found again;
 *  - built, parked or dropped on a remark that is missing, earlier than the
 *    idea, or (from TYPED_SINCE) not one he typed, is an agent's word, not his;
 *  - an idea with nothing found about it cannot be put back with what was found;
 *  - a 💡 what-if remark from IDEAS_SINCE on that no idea comes from is lost.
 */
export function ideaFaults(ideas, remarks, backed = new Set(), since = IDEAS_SINCE) {
  const faults = [];
  const byId = new Map(remarks.map((r) => [r.id, r]));
  for (const i of ideas) {
    const label = `"${i.what.slice(0, 50)}"`;
    const from = byId.get(i.from);
    if (!from) faults.push(`idea ${label} comes from ${i.from}, which is not in the Transcript: it could not be found again`);
    if (!i.found || /^(nothing|none|-|tbd)\.?$/i.test(i.found)) faults.push(`idea ${label} says nothing of what was found about it: search what was said and agreed, and say it`);
    if (i.status === 'open') continue;
    const yes = byId.get(i.by);
    if (!yes) faults.push(`idea ${label} is ${i.status} on ${i.by}, which is not in the Transcript`);
    else if (from && yes.date < from.date) faults.push(`idea ${label} is ${i.status} on ${i.by}, said before the idea itself (${i.from})`);
    else if (yes.date >= TYPED_SINCE && !backed.has(yes.id)) faults.push(`idea ${label} is ${i.status} on ${i.by}, which is not a message he typed: only his own word builds, parks or drops an idea`);
  }
  const kept = new Set(ideas.map((i) => i.from));
  for (const r of remarks) {
    if (r.date < since || !r.ways.some((w) => /what-if/.test(w)) || kept.has(r.id)) continue;
    faults.push(`${r.id} (${r.date}) is a 💡 what-if no idea comes from: add it to ${IDEAS_FILE}`);
  }
  return faults;
}

/** The list checked against the real Transcript and typed record: { ideas, putBack, problems, warnings }. */
export function checkIdeas(root = repoRoot, text = existsSync(join(root, IDEAS_FILE)) ? readFileSync(join(root, IDEAS_FILE), 'utf8') : null) {
  if (text === null) return { ideas: [], putBack: '', problems: [`${IDEAS_FILE} is missing: an idea he gives has nowhere to be kept (A-125)`], warnings: [] };
  const parsed = parseIdeas(text);
  parsed.problems.push(...ideaFaults(parsed.ideas, transcriptRemarks(root), typedEntries(root)));
  return parsed;
}

export const openIdeas = (ideas) => ideas.filter((i) => i.status === 'open');

/** True when open ideas wait and none were put back to him yet this calendar month. */
export function putBackDue({ ideas, putBack }, today = new Date()) {
  return openIdeas(ideas).length > 0 && (!putBack || putBack.slice(0, 7) < today.toISOString().slice(0, 7));
}

/**
 * The dev menu's lines for the monthly showing: every open idea, oldest first,
 * whose it is, and what was found. They take at most `room` characters (the
 * hook gives what is left under its context limit, up to IDEAS_ROOM), the rest
 * named by count, so a long list never pushes the reply shape past the limit;
 * with almost no room, one short line still says the showing is due.
 */
export const IDEAS_ROOM = 1200;
export function ideasMenu(ideas, room = IDEAS_ROOM) {
  const open = openIdeas(ideas).sort((a, b) => a.opened.localeCompare(b.opened));
  if (!open.length) return [];
  const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const done = 'then run node ux/scripts/ideas.mjs shown and commit it';
  const head = `IDEAS (A-125), due this month: show the ${open.length} open one(s) on the menu as its own entry, "**Ideas** · ${open.length} open · build, park or drop?", each in a few words with whose it is ("yours" for his, "mine" for an agent's) and what was found; ${done}. His answer on one is kept with the remark that said it.`;
  const short = `IDEAS (A-125), due this month: ${open.length} open; read them with node ux/scripts/ideas.mjs open, show them on the menu with whose and what was found, ${done}.`;
  const more = (n) => `  - …and ${n} more: node ux/scripts/ideas.mjs open`;
  if (head.length + more(open.length).length + 2 > room) return [short];
  const out = [head];
  let left = room - head.length - more(open.length).length - 2;
  for (const i of open) {
    const l = `  - ${clip(i.what, 90)} · ${i.whose === 'his' ? 'yours' : 'mine'} · found: ${clip(i.found, 110)} (${i.from})`;
    if (l.length + 1 > left) break;
    out.push(l);
    left -= l.length + 1;
  }
  const rest = open.length - (out.length - 1);
  return rest ? [...out, more(rest)] : out;
}
