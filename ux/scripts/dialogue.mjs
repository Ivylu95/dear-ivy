#!/usr/bin/env node
// Dialogue-driven development: the Transcript and the Agreements (desk D35, D37, D40).
// The Agreements are a view of the Transcript, never a second copy (P5): each agreed
// remark carries its card, and this script writes them out as readable pages: an
// index at agreements.md, a page per group and an archive, each within one read
// (dialogue-agreements.mjs, T-768).
//
//   node ux/scripts/dialogue.mjs build            write dev/dialogue/agreements.md, its parts in agreements/, and index/
//   node ux/scripts/dialogue.mjs check            fail if any of them is out of date
//   node ux/scripts/dialogue.mjs ask <words…>     what was said or agreed about this before
//   node ux/scripts/dialogue.mjs sort             list the entries still ❔ unsorted
//   node ux/scripts/dialogue.mjs trace            every register traced to its agreements (trace.md)
//   node ux/scripts/dialogue.mjs status           the opening line of a dev chat; after 3 days away, what changed
//   node ux/scripts/dialogue.mjs renumber         give a T- or A- number two chats both took a fresh one
//   node ux/scripts/dialogue.mjs resolve          after a pull that stopped: settle the Transcript's and eval cards' clashes, rebuild agreements.md
//   node ux/scripts/dialogue.mjs moved [--fix]    this chat's lines outside the Transcript citing a number a merge moved; --fix moves them
//   node ux/scripts/dialogue.mjs merge-driver …   git's merge driver for the Transcript and agreements.md (.gitattributes)
//   node ux/scripts/dialogue.mjs after-merge      git's post-merge hook: rebuild every generated page from the merged Transcript
//   node ux/scripts/dialogue.mjs gaps             spec rows quoting the owner that no card carries
//   node ux/scripts/dialogue.mjs owed             agreed cards no eval card names, and no spec carries (T-230)
//   node ux/scripts/dialogue.mjs unproven         agreed cards not every eval naming them passes yet (T-840): the loop's build queue
//   node ux/scripts/dialogue.mjs done A-NNN…      every level of a card: sorted, agreed, spec, eval, proven, committed, pushed (A-096)
//   node ux/scripts/dialogue.mjs milestones       moments worth seeing; never points or streaks (A-095)
//   node ux/scripts/dialogue.mjs group [date]     this week's group of cards, whole, for the weekly read (A-147)
//   node ux/scripts/dialogue.mjs learning         the learning chat's map: what is learned, taught, missing, and next (A-157)
//   node ux/scripts/dialogue.mjs lessons          what the owner was taught, what took, and which style teaches best (A-093)
//   node ux/scripts/dialogue.mjs growth           month by month, how the owner's asks change (A-063)
//   node ux/scripts/dialogue.mjs gists            every remark's gist, one line each, to match a question by meaning
//   node ux/scripts/dialogue.mjs triage           near-duplicate and month-old for-you lines, for the weekly loop
//   node ux/scripts/dialogue.mjs gates [hours]    commits that changed what she would notice with no Approved: line
//
// Growing, never capped (A-147, T-457): the Agreements grow as far as they need,
// and are reviewed at several timings so there are no gaps, overlaps or
// contradictions. A card made from CHECKED_SINCE on carries a "Checked against"
// line naming the cards it was compared with, refused without one; a review in
// dev/dialogue/reviews/ is due after REVIEW_EVERY new cards or REVIEW_DAYS days,
// reported until it is written; each closed month of the Transcript is owed a
// one-page digest in dev/dialogue/digests/; a learned lesson leaves the list.
//
// `ask` cannot rely on shared words to surface an agreement: on 2026-10-26 it
// missed A-015 for "skills self-healing self-evolving" (T-173). The cards are
// few and short, so it lists every standing card in one line each, word
// matches first, and the agent reading it judges relevance. Its other searches
// match word stems over each item's whole text, specs included, so they still
// miss a paraphrase; nothing here reads meaning.
//
// It lives in ux/scripts/ so the commit gate can run `check` (WKB-007 design 9),
// and does nothing where dev/dialogue/ is absent, so a copy without dev/ works
// whole (ARC-008).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk-skip.mjs';
import { DEV_DIR, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { readCards, readHistory, runnable } from './evals.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { TYPED_SINCE, typedEntries, typedRows, transcriptQuotes, missingEntries } from '../../.claude/hooks/lib/typed.mjs';
import { ONE_READ, oversizeParts, partOf, recut, sortParts } from '../../.claude/hooks/lib/transcript-parts.mjs';
import { PART_LINES, packParts, partPath } from '../../.claude/hooks/lib/one-read.mjs';
import { agreementsStale, transcriptPrint, writeAgreements } from './dialogue-agreements.mjs';
import { gitIn, mergeDriver, mergeLosses, movedReferences, rebuildAfterMerge, resolveConflicts } from './dialogue-merge.mjs';
import { ENOUGH_LESSONS, STALE_ITEM_DAYS, forYouTriage, clip, coverageGaps, gateHolds, growth, learning, lessons, levels, milestones, printAsk, quoteGaps, specRows, statusLines, unproven } from './dialogue-views.mjs';
// The merge driver and the views live beside this file (HYG-002: one file, one read);
// everything they export is still importable from here, as it was.
export { droppedByMerges, highestIds, mergeLosses, mergeTranscript, movedReferences, rebuildAfterMerge, recordMoves, remarkCounts, resolveConflicts, setMergeDriver, stageDuringMerge } from './dialogue-merge.mjs';
export { AGREEMENTS_INDEX, AGREEMENTS_PARTS, ARCHIVE_PAGE, agreementsStale, anchorOf, groupPage, renderAgreementParts, transcriptPrint, writeAgreements } from './dialogue-agreements.mjs';
export { AWAY_DAYS, ENOUGH_LESSONS, LEARNED_AFTER_DAYS, LOOP_LATE_DAYS, NOTICED, STALE_ITEM_DAYS, ask, keptQuestions, forYouTriage, checkKind, coverageGaps, evalsFor, gateHolds, growth, learning, lessons, readLearningMap, levels, milestones, quoteGaps, renderAgreements, specRows, statusLines, stem, unproven } from './dialogue-views.mjs';


export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIALOGUE = join(REPO, DEV_DIR, 'dialogue');
export const DIALOGUE_DIR = DIALOGUE;
const TRANSCRIPT = join(DIALOGUE, 'transcript');
export const TRACE = join(DIALOGUE, 'trace.md');
const DIGESTS = join(DIALOGUE, 'digests');
const INDEX = join(DIALOGUE, 'index');

/** A-147: a card made from this day on records the cards it was checked against for clashes. */
export const CHECKED_SINCE = '2026-10-30';
/** A-147: a review of the whole Agreements falls due after this many new cards, or this many days. */
export const REVIEW_EVERY = 20;
export const REVIEW_DAYS = 30;

/** A-147: a new card with no "Checked against" line, as a fault. */
/** How many commits GitHub's main has that this copy lacks, after a quick fetch; 0 when it cannot tell. */
export function behindOrigin(root, { fetch = true } = {}) {
  const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim();
  try {
    if (fetch) run(['fetch', '-q', 'origin', 'main']);
    return Number(run(['rev-list', '--count', 'HEAD..origin/main'])) || 0;
  } catch {
    return 0;
  }
}

export function clashFaults(entries, since = CHECKED_SINCE) {
  return cardEntries(entries)
    .filter((e) => e.date >= since && e.card.status !== 'merged' && !e.card.checked)
    .map((e) => `${e.card.id} (${e.id}) was drafted with no clash check: add "  - **Checked against:** <the cards it touches> · <no clash, or the clash put to the owner>" after comparing it with them (dialogue.mjs ask <its key words>) (A-147)`);
}

/**
 * A-093 ("none repeats"): a lesson recorded from CHECKED_SINCE on, in the same words as one
 * given before it, as a fault. `lessons()` reports every repeat; this refuses a new one as it
 * is written, and leaves the ones recorded before the check began to the report.
 */
export function lessonFaults(entries, since = CHECKED_SINCE) {
  const before = new Map();
  const faults = [];
  for (const e of [...entries].filter((x) => x.lesson).sort((a, b) => a.date.localeCompare(b.date))) {
    const key = e.lesson.text.trim().toLowerCase();
    if (before.has(key) && e.date >= since) faults.push(`${e.id} gives a lesson already given in ${before.get(key)}: teach the next step on from it instead, or drop the Lesson line (dialogue.mjs lessons) (A-093)`);
    if (!before.has(key)) before.set(key, e.id);
  }
  return faults;
}

/** A-147: whether a review of the Agreements is due. `reviews` are the dates (YYYY-MM-DD) of the reviews written. */
export function reviewDue(entries, reviews, today = new Date().toISOString().slice(0, 10)) {
  const last = [...reviews].sort().at(-1) ?? '';
  const fresh = standingCards(entries).filter((e) => e.date > last).length;
  const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86_400_000) : Infinity;
  const why = [fresh >= REVIEW_EVERY ? `${fresh} new agreements since the last review` : '', days >= REVIEW_DAYS ? (last ? `${days} days since the last review` : 'no review yet') : ''].filter(Boolean);
  return { due: why.length > 0, why, last, fresh };
}

/** A-147: the group the weekly read takes this week, turning through every group in order. */
export function weeklyGroup(entries, today = new Date().toISOString().slice(0, 10)) {
  const groups = [...new Set(standingCards(entries).map((e) => e.card.group).filter(Boolean))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
  if (!groups.length) return null;
  const week = Math.floor(Date.parse(today) / (7 * 86_400_000));
  const group = groups[week % groups.length];
  return { group, cards: standingCards(entries).filter((e) => e.card.group === group).sort((a, b) => a.card.order - b.card.order) };
}

function reviewState(entries) {
  const dir = join(DIALOGUE, 'reviews');
  const dates = existsSync(dir) ? readdirSync(dir).map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})-/) ?? [])[1]).filter(Boolean) : [];
  return reviewDue(entries, dates);
}

/** A-147: closed months of the Transcript with no digest yet. `months` are YYYY-MM; `have` the digests written. */
export function digestsOwed(months, have, today = new Date().toISOString().slice(0, 10)) {
  return months.filter((m) => m < today.slice(0, 7) && !have.includes(m)).sort();
}

/** A-153: the method's own weekly recheck, logged one dated line a run. */
export const METHOD_LOG = join(REPO, DEV_DIR, 'projects', 'mission-driven-dev', 'notes', 'method-checks.md');
export const METHOD_EVERY_DAYS = 7;
/**
 * A-153: whether the weekly recheck of DDD itself is due: no run logged, or the
 * newest `- YYYY-MM-DD · …` line in the log is seven days old or more.
 */
export function methodCheckDue(text, today = new Date().toISOString().slice(0, 10)) {
  const last = [...String(text ?? '').matchAll(/^- (\d{4}-\d\d-\d\d) · /gm)].map((m) => m[1]).sort().at(-1) ?? '';
  const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86_400_000) : Infinity;
  return { due: days >= METHOD_EVERY_DAYS, last, days };
}
const methodState = () => methodCheckDue(existsSync(METHOD_LOG) ? readFileSync(METHOD_LOG, 'utf8') : '');

function digestState() {
  const months = existsSync(TRANSCRIPT) ? [...new Set(sortParts(readdirSync(TRANSCRIPT)).map((f) => f.slice(0, 7)))] : [];
  const have = existsSync(DIGESTS) ? readdirSync(DIGESTS).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).map((f) => f.slice(0, 7)) : [];
  return digestsOwed(months, have);
}
export const SPECS = join(REPO, SPECS_DIR);
export const FOR_YOU = join(REPO, DEV_DIR, 'for-you.md');

/** Every Transcript entry, oldest file first (a month's parts in order, T-499), with its card if it has one. */
export function readTranscript(dir = TRANSCRIPT) {
  if (!existsSync(dir)) return [];
  const months = sortParts(readdirSync(dir));
  return parseTranscript(Object.fromEntries(months.map((f) => [f, readFileSync(join(dir, f), 'utf8')])));
}

/** The same, from each month's text by its file name (each part its own): what a merge reads, before anything is on disk. */
export function parseTranscript(months) {
  const entries = [];
  for (const file of sortParts(Object.keys(months))) {
    let entry = null;
    let card = null;
    for (const line of String(months[file]).split('\n')) {
      const head = line.match(/^### (T-\d+) · (\d{4}-\d\d-\d\d) · (.+)$/);
      if (head) {
        entry = { id: head[1], date: head[2], way: head[3].trim(), quote: '', gist: '', file, card: null };
        card = null;
        entries.push(entry);
        continue;
      }
      if (!entry) continue;
      if (line.startsWith('> ') && !entry.quote) entry.quote = line.slice(2).trim();
      // A second remark below this one's Gist lost its own heading, usually in a merge (2026-10-26).
      else if (line.startsWith('> ') && entry.gist) entry.joined = true;
      if (line.startsWith('>') && !card) entry.words = `${entry.words ?? ''} ${line.replace(/^>\s?/, '')}`;
      if (line.startsWith('- **Gist:** ')) entry.gist = line.slice(12).trim();
      if (line.startsWith('- **Became:** ')) entry.became = line.slice(14).trim();
      // A-070: every other way the remark carries, and every topic it touches.
      if (line.startsWith('- **Also:** ')) entry.also = line.slice(12).split(' · ').map((w) => w.trim()).filter(Boolean);
      if (line.startsWith('- **Topics:** ')) entry.topics = line.slice(14).split(' · ').map((w) => w.trim()).filter(Boolean);
      // A-093: the lesson a reply gave, kept on the entry it answered, and its style, so the
      // agent learns which way of teaching takes; a later entry that shows it applied says so.
      const lesson = line.match(/^- \*\*Lesson:\*\* (.+?)(?: · style: (example|principle|question))?(?: · map: (L-\d+))?$/);
      if (lesson) entry.lesson = { text: lesson[1].trim(), style: lesson[2] ?? 'principle', map: lesson[3] ?? '' };
      // A-157: what the learning chat found missing, and his own explanation of an earlier lesson.
      const gapLine = line.match(/^- \*\*Gap:\*\* (.+?)(?: · map: (L-\d+))?$/);
      if (gapLine) (entry.gaps ??= []).push({ text: gapLine[1].trim(), map: gapLine[2] ?? '' });
      const explained = line.match(/^- \*\*Explained:\*\* (T-\d+)(?: · (kept|missed))?/);
      if (explained) entry.explained = { lesson: explained[1], kept: explained[2] !== 'missed' };
      const applies = line.match(/^- \*\*Applies:\*\* (T-\d+)/);
      if (applies) entry.applies = applies[1];
      const recalled = line.match(/^- \*\*Recalled:\*\* (T-\d+)(?: · (kept|missed))?/);
      if (recalled) entry.recalled = { lesson: recalled[1], kept: recalled[2] !== 'missed' };
      const c = line.match(/^- \*\*Card (A-\d+)\*\* · status: (\w+)(?: · into: (A-\d+))?(?: · emoji: (\S+))?(?: · group: ([^·]+?))?(?: · order: (\d+))?\s*$/);
      if (c) {
        card = { id: c[1], status: c[2], into: c[3] ?? '', emoji: c[4] ?? '', group: c[5]?.trim() ?? '', order: Number(c[6] ?? 99), says: '', failedIf: '', why: '' };
        (entry.cards ??= []).push(card);
        entry.card ??= card;
      }
      const part = line.match(/^ {2}- \*\*(Says|Failed if|Why|Eval|Names|Checked against):\*\* (.+)$/);
      if (part && card) card[{ Says: 'says', 'Failed if': 'failedIf', Why: 'why', Eval: 'eval', Names: 'names', 'Checked against': 'checked' }[part[1]]] = part[2].trim();
    }
  }
  return entries;
}

/** One entry per card: a remark may carry several (T-127 carried five), each with the remark's words. */
export const cardEntries = (entries) => entries.flatMap((e) => (e.cards ?? []).map((card) => ({ ...e, card })));

/** The cards that stand: a card merged into another is kept, word for word, but no longer counts. */
export const standingCards = (entries) => cardEntries(entries).filter((e) => e.card.status !== 'merged');

/**
 * The sixteen ways, plus the tray a remark waits in until it is sorted: the thirteen
 * of D23, and from 2026-10-30 his promises, feelings and judgements (A-070), so a day
 * spent looking for all of his worries, or all he promised, finds every one.
 */
export const WAYS = ['💭 want', '😟 worry', '❤️ keep', '🚫 not doing', '⚖️ trade-off', '🔨 ruling', '❓ question', '📖 story', '😤 complaint', '📋 task', '🧱 fact', '💡 what-if', '🤝 agreement', '🤞 promise', '💗 feeling', '🧐 judgement'];
export const UNSORTED = '❔ unsorted';

/**
 * A-070: what a remark is about, one or more on its `- **Topics:**` line, so a day
 * spent looking for everything said about a subject finds it whatever its way. A
 * closed list, so one subject is never filed under two names; a remark no topic fits
 * says a topic is missing, and adding one is a change to this list.
 */
export const TOPICS = {
  dialogue: '🗣️ How we talk and agree: the Transcript, cards, gates, reviews, DDD itself',
  'dev-replies': '🛠️ Development mode and the shape of its replies',
  learning: '🎓 His own growth: lessons, thinking skills, asking better',
  checks: '✅ Evals, tests, checks, personas and proof',
  skills: '🧰 Skills, commands and procedural memory',
  agents: '🤖 How agents work: grounding, self-knowledge, models, research',
  'her-chat': '💛 Her everyday conversation: tone, comfort, advice',
  safety: '🛟 Crisis, safety rules and the safety core',
  privacy: '🔐 Privacy, names, access, secrets and keys',
  record: '🗃️ Her record: memory, the timeline, people, how data is kept and found',
  nutrition: '🥗 Food, supplements, training and the fitness module',
  reminders: '⏰ Reminders, check-ins, Telegram and the calendar',
  heartbeats: '💓 Scheduled jobs, routines and the daily loop',
  saving: '💾 Git, saving, branches and keeping copies level',
  dashboard: '🖥️ Her app and the dev dashboard',
  setup: '🧳 Set-up, copies for others, updates and releases',
  upkeep: '🧹 Growth limits, cleanup, speed and cost',
};
/** A-070: from this day on a sorted remark without a topic is refused; earlier ones are counted, never refused. */
export const TOPICS_SINCE = '2026-10-31';

/**
 * What the Transcript gets wrong, as plain sentences: a way that is none of the
 * sixteen, a topic not in the list, a sorted remark with no topic (from TOPICS_SINCE), and a remark left unsorted past the day it was said. The recording
 * hook (.claude/hooks/session/dialogue-record.mjs) files every remark as
 * unsorted; sorting it is the agent's, the same day (D35).
 */
/**
 * A-052: research is kept in its own domain, and the Became line names where. On 3 Nov a
 * round of research (T-702) was answered and kept nowhere, so on 6 Nov the same question
 * was researched again from nothing (T-975, T-981). From RESEARCH_SINCE, an entry whose
 * Became says it was researched names a desk, an evidence base or a skill folder.
 */
export const RESEARCH_SINCE = '2026-11-06';
const RESEARCH_HOMES = /\b(dev\/projects\/[\w.-]+|modules\/[\w.-]+\/knowledge|dev\/skills\/[\w.-]+)/;
export const researchUnkept = (e) => (e.date ?? '') >= RESEARCH_SINCE && /\bresearch(ed)?\b/i.test(e.became ?? '') && !RESEARCH_HOMES.test(e.became ?? '');

export function transcriptFaults(entries, today = new Date().toISOString().slice(0, 10)) {
  const faults = [];
  for (const e of entries) {
    if (e.way === UNSORTED) {
      if (e.date < today) faults.push(`${e.id} (${e.date}) is still ${UNSORTED}: sort it into its way (dialogue.mjs sort)`);
    } else {
      if (!WAYS.includes(e.way)) faults.push(`${e.id} has the way "${e.way}", which is none of the sixteen`);
      if (!e.topics?.length && e.date >= TOPICS_SINCE) faults.push(`${e.id} has no topic: add "- **Topics:** <one or more of ${Object.keys(TOPICS).join(', ')}>" (A-070)`);
    }
    for (const w of e.also ?? []) {
      if (!WAYS.includes(w)) faults.push(`${e.id} also carries "${w}", which is none of the sixteen ways`);
      else if (w === e.way || (e.also.indexOf(w) !== e.also.lastIndexOf(w))) faults.push(`${e.id} lists "${w}" twice: its Also line names only the ways beyond its heading's, once each`);
    }
    for (const t of e.topics ?? []) if (!(t in TOPICS)) faults.push(`${e.id} has the topic "${t}", which is not in the list (${Object.keys(TOPICS).join(', ')}): use one, or add it to TOPICS in dialogue.mjs`);
    if (e.joined) faults.push(`${e.id} holds a second remark below its Gist: give that remark its own heading and the next free number`);
    if (researchUnkept(e)) faults.push(`${e.id} says it was researched but names no place the research is kept: write it on its domain's desk or evidence base (dev/projects/<name>/, modules/<name>/knowledge/, dev/skills/<name>/), sources dated, and name that path in its Became line (A-052)`);
  }
  faults.push(...duplicateRemarks(entries).filter((d) => d.date >= DUPLICATES_SINCE).map((d) => `${d.ids.join(' and ')} hold the same remark of ${d.date}: a merge kept two copies of one entry; keep the one carrying the latest sorting and card, and remove the other (A-047: every word kept once)`));
  return faults;
}

/**
 * The same remark twice (2026-11-03: a merge kept both the old and the newly sorted copy
 * of one entry, under two numbers, and no check saw it). Same day, same first line, and
 * long enough that typing it twice is not the likelier story ("Yes" often is).
 */
export const DUPLICATES_SINCE = '2026-11-03';
export function duplicateRemarks(entries) {
  const seen = new Map();
  for (const e of entries) {
    if ((e.quote ?? '').length < 40) continue;
    const key = `${e.date}\n${e.quote}`;
    (seen.get(key) ?? seen.set(key, { date: e.date, ids: [] }).get(key)).ids.push(e.id);
  }
  return [...seen.values()].filter((d) => d.ids.length > 1);
}

/** Every register in the spec folder: a file whose title ends in its prefix, `# Name [ABC]`. */
export function specRegisters(dir = SPECS) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const full of walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') && !['README.md', 'REFERENCES.md'].includes(n) })) {
    const prefix = readFileSync(full, 'utf8').match(/^# .*\[([A-Z]{3})\]\s*$/m)?.[1];
    if (prefix) found.push({ prefix, path: relative(dir, full).replace(/\\/g, '/') });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

const NO_AGREEMENT = '— (no agreement yet: draft one)';

/**
 * What trace.md gets wrong (stage 3, step 4), at register level: a register with
 * no row, a row for a register that is gone, a row naming no agreement and not
 * saying so honestly, and a card cited that does not exist.
 */
export function traceFaults(text, registers, cardIds) {
  const faults = [];
  const rows = new Map();
  for (const line of String(text ?? '').split('\n')) {
    const m = line.match(/^\|\s*`([A-Z]{3})`\s*\|[^|]*\|([^|]*)\|/);
    if (!m) continue;
    if (rows.has(m[1])) faults.push(`${m[1]} has two rows in trace.md`);
    rows.set(m[1], m[2].trim());
  }
  const cards = new Set(cardIds);
  for (const r of registers) if (!rows.has(r.prefix)) faults.push(`${r.prefix} (${r.path}) has no row in trace.md: name the agreement it serves, or "${NO_AGREEMENT}"`);
  const known = new Set(registers.map((r) => r.prefix));
  for (const [prefix, serves] of rows) {
    if (!known.has(prefix)) faults.push(`trace.md has a row for ${prefix}, which is no register in the spec folder`);
    const cited = serves.match(/\bA-\d+\b/g) ?? [];
    if (!cited.length && serves !== NO_AGREEMENT) faults.push(`${prefix} names no agreement; write the card(s) it serves, or "${NO_AGREEMENT}"`);
    for (const id of cited) if (!cards.has(id)) faults.push(`${prefix} cites ${id}, which is no card in the Transcript`);
  }
  return faults;
}

function traceCheck(entries) {
  if (!existsSync(SPECS)) return [];
  if (!existsSync(TRACE)) return [`${DEV_DIR}/dialogue/trace.md is missing: every register needs its agreements traced`];
  return traceFaults(readFileSync(TRACE, 'utf8'), specRegisters(), cardEntries(entries).map((e) => e.card.id));
}

/**
 * The gate on agreements (gate 1, A-003): a card is binding only once the owner
 * said yes, so a card marked `agreed` needs a 🤝 agreement entry in the
 * Transcript (its own, or any other) dated on or after the card's own entry.
 * An agent cannot flip a card to agreed on its own word, nor write the yes:
 * given `typed` (`check` passes lib/typed.mjs's record of what the developer
 * typed), the 🤝 entry must be one that record stands behind. Entries dated
 * before TYPED_SINCE are exempt: they predate the record, and no line in it
 * could stand behind them. A status other than
 * `agreed` or `drafted` is a fault too, so a misspelling cannot slip past it.
 * Every card leads with an emoji (A-026), so the list reads at a glance. A card
 * `merged` into another names it (` · into: A-0nn`), and that card must stand.
 */
export function agreementFaults(entries, typed = null) {
  const yeses = entries.filter((e) => e.way === '🤝 agreement');
  const faults = [];
  const standing = new Set(standingCards(entries).map((e) => e.card.id));
  // Two chats writing the Transcript at once can each take the next id (seen 2026-10-26).
  const seen = new Map();
  for (const e of cardEntries(entries)) {
    if (seen.has(e.card.id)) faults.push(`${e.card.id} is used twice (${seen.get(e.card.id)} and ${e.id}): run \`dialogue.mjs renumber\``);
    else seen.set(e.card.id, e.id);
  }
  for (const e of cardEntries(entries)) {
    const { id, status } = e.card;
    if (status !== 'merged' && !e.card.group) faults.push(`${id} (${e.id}) has no group: add " · group: <n> <emoji> <name> · order: <n>" so it is filed in its place (A-091)`);
    if (!e.card.emoji) faults.push(`${id} (${e.id}) has no emoji: add " · emoji: <one>" after its status (A-026)`);
    if (status === 'merged') {
      if (!standing.has(e.card.into)) faults.push(`${id} (${e.id}) is merged into "${e.card.into || 'nothing'}", which is not a standing card`);
    } else if (!['agreed', 'drafted'].includes(status)) faults.push(`${id} (${e.id}) has the status "${status}"; a card is agreed, drafted or merged`);
    else if (status === 'agreed') {
      const after = yeses.filter((y) => y.date >= e.date);
      if (!after.length) faults.push(`${id} (${e.id}, ${e.date}) is marked agreed, but no 🤝 agreement entry on or after ${e.date} records the owner's yes: set it back to drafted, or record the yes`);
      else if (typed && !after.some((y) => y.date < TYPED_SINCE || typed(y))) {
        faults.push(
          `${id} (${e.id}, ${e.date}) is marked agreed, but no 🤝 agreement entry on or after ${e.date} is the owner's own message as he typed it (the typed record beside the Transcript): ` +
            'an agent cannot write his yes. Set it back to drafted and ask him; if he did say it, commit the typed record with the Transcript',
        );
      }
    }
  }
  return faults;
}

/**
 * A-131, the owner's "Remember all agreement should not have implementation details
 * specifics": a card says what he wants, why, and how he would notice it failing; how it is
 * built (a file, a path, code, a command, a spec or eval ID, an address) never appears in its
 * Says or Failed if, and is a fault. A product, one particular chat, or a fixed time, span
 * or count can belong to the want itself ("just GitHub and Claude"), so it is allowed only
 * when the card says why on a line of its own, `  - **Names:** <what, and why it is the
 * want>`; without that line it is a fault too. Its Why may quote him, so it is not read.
 * A card merged into another stands no more and is not read either.
 */
export const HOW_BUILT = [
  [/`[^`]+`/, 'code or a file in backticks'],
  [/\b[\w-]+\.(?:md|mjs|js|ts|json|ya?ml|sh|py|html|css)\b/i, 'a file name'],
  [/(?:^|[\s(])(?:\.?\/)?(?:data|dev|ux|\.claude|modules|policies|deploy|temp)\/\S*/, 'a path'],
  [/https?:\/\/|www\./i, 'an address'],
  [/\b(?:[A-Z]{3}-\d{3}|E-\d{3}|T-\d{3})\b/, 'a spec row, eval or transcript ID'],
  [/\b(?:node|npm|npx|git (?:push|commit|merge)|cron|regex|frontmatter|parse_mode|HTML|JSON|API|endpoint|webhook|env(?:ironment)? variable)\b/, 'a tool or a mechanism'],
];
export const PARTICULAR = [
  [/\b(?:Telegram|Google|GitHub|Cloudflare|BAXTER|Anthropic|Sonnet|Opus|Haiku|iPhone|Android|WhatsApp)\b/, 'a product'],
  [/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|thirty|sixty)\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\b/i, 'a fixed span'],
  [/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i, 'a fixed time'],
  [/(?:^|\s)\p{Extended_Pictographic}\uFE0F?\s+[A-Z][\w']*(?:\s+[\w']+){0,5}\s+chat\b|\bthe\s+"[^"]+"\s+chat\b/u, 'one particular chat'],
];
export function wordingFaults(entries) {
  const faults = [];
  for (const e of standingCards(entries)) {
    const { id, says = '', failedIf = '', names = '' } = e.card;
    const text = `${says} ${failedIf}`;
    for (const [re, what] of HOW_BUILT) if (re.test(text)) faults.push(`${id} (${e.id}) names how it is built (${what}): say what he wants and how he would notice it failing; the how goes in the specs (A-131)`);
    if (!names.trim()) for (const [re, what] of PARTICULAR) if (re.test(text)) faults.push(`${id} (${e.id}) names ${what}: make it general (a number that suits one time, such as how long a run lasts, is asked each time or set in the specs, T-479); add "  - **Names:** <what, and why it is the want itself>" only when that particular is itself what he wants (A-131)`);
  }
  return faults;
}

/**
 * The process gap (T-230): "why is it now the card binds every agent but
 * nothing checks it yet?" An agreed card binds at once, so one that no eval
 * card names in its `why` binds with nothing checking it. Every such card is
 * reported by `check`, as a count and a list, beside the agreed cards no spec
 * row or trace.md register cites. Failing all of them would turn the gate red
 * for every card agreed before the check existed, so those, listed below as
 * they stood on EVAL_OWED_SINCE, are reported and never refused; any other
 * agreed card fails `check`, and so the commit, until an eval card names it or
 * the card carries `  - **Eval:** none, because <reason>`. The list only
 * shrinks: a card leaves it by gaining an eval, and adding one to it is
 * weakening this check, which waits for the owner's yes.
 */
export const EVAL_OWED_SINCE = '2026-10-26';
export const EVAL_OWED = new Set([
  // Left after the T-260 triage ("Do it, but check whether those are issues"): every other card
  // once listed here now has an eval naming it. These two are real gaps, handed to the owner on dev/for-you.md.
  'A-053', 'A-090',
]);
const NO_EVAL = /^none, because \S.{7,}/;

/**
 * Agreed cards no eval names (`noEval`), cards whose every naming eval is written but cannot run
 * (`notRunning`), none a spec carries (`noSpec`), and the faults: new ones with neither an eval
 * nor a reason for none. An eval counts only when it can run (T-273, the owner: "Okay, please do
 * as you recommend."): a card named only by `not-runnable-yet` evals is "eval written, not
 * running", reported beside the others and never refused, as each such eval says what blocks it.
 */
export function evalGaps(entries, cards = [], carried = new Set(), owed = EVAL_OWED) {
  const whyOf = (c) => (Array.isArray(c.why) ? c.why : [c.why]).filter(Boolean);
  const named = new Set(cards.flatMap(whyOf));
  const running = new Set(cards.filter(runnable).flatMap(whyOf));
  const agreed = standingCards(entries).filter((e) => e.card.status === 'agreed').sort((a, b) => a.card.id.localeCompare(b.card.id, 'en', { numeric: true }));
  const faults = [];
  for (const e of cardEntries(entries)) {
    if (e.card.eval !== undefined && !NO_EVAL.test(e.card.eval)) faults.push(`${e.card.id} (${e.id}) has the eval line "${e.card.eval}": it reads "none, because <the reason no eval can check it>"`);
  }
  const noEval = agreed.filter((e) => !named.has(e.card.id) && !NO_EVAL.test(e.card.eval ?? '')).map((e) => e.card.id);
  for (const id of noEval) if (!owed.has(id)) faults.push(`${id} is agreed and binds every agent, but no eval card names it in its why: write one in ${DEV_DIR}/evals/cards/ judged against its Failed if line, or add "  - **Eval:** none, because …" to the card (T-230)`);
  const notRunning = agreed.filter((e) => named.has(e.card.id) && !running.has(e.card.id)).map((e) => e.card.id);
  const noSpec = agreed.filter((e) => !carried.has(e.card.id)).map((e) => e.card.id);
  return { noEval, notRunning, noSpec, faults };
}

/**
 * A card merged into another stands no more, so a spec row, trace.md or a
 * for-you line that still cites it points at words that no longer bind, and the
 * card that does bind reads as uncited (T-330 edge cases, 2026-10-28: an open
 * backlog line still named A-020 after it was merged into A-098). A line that
 * names the card it went into as well is a pointer, and passes. Each text is
 * { label, text, lines }: with `lines`, a hit names its line.
 */
export function mergedCitations(texts, entries) {
  const into = new Map(cardEntries(entries).filter((e) => e.card.status === 'merged').map((e) => [e.card.id, e.card.into]));
  const found = [];
  for (const { label, text, lines } of texts) {
    String(text ?? '').split('\n').forEach((line, i) => {
      for (const id of new Set(line.match(/\bA-\d{3}\b/g) ?? [])) {
        if (into.has(id) && !line.includes(into.get(id))) found.push(`${label}${lines ? `, line ${i + 1}` : ''} cites ${id}, merged into ${into.get(id)}: cite ${into.get(id)}`);
      }
    });
  }
  return found;
}

/** Every card id a spec row or trace.md cites: what carries an agreement into the specs. */
export function specCarried(rows = specRows(), traceText = existsSync(TRACE) ? readFileSync(TRACE, 'utf8') : '') {
  return new Set([...rows.map((r) => r.text).join('\n').matchAll(/\bA-\d{3}\b/g), ...String(traceText).matchAll(/\bA-\d{3}\b/g)].map((m) => m[0]));
}

/**
 * Two chats filing at once can each take the same next number: on 2026-10-26
 * T-065, T-170 and T-176 each named two remarks, settled by hand. A number
 * names one remark, so a repeat is a fault (a card's, in agreementFaults), and
 * `renumber` settles either.
 */
export function idFaults(entries) {
  const faults = [];
  const repeated = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  for (const id of repeated(entries.map((e) => e.id))) faults.push(`${id} names ${entries.filter((e) => e.id === id).length} remarks: run \`dialogue.mjs renumber\``);
  return faults;
}

/**
 * Give each repeated T- or A- number but one a fresh number past the highest.
 * The one kept is the one already on GitHub's main (`published`, the text of
 * every month there), since other chats may have cited it; failing that, the
 * first in the file. Only the heading line changes; every word stays.
 * Returns the new files' text and what moved.
 */
export function renumber(files, published = '') {
  const heads = [];
  for (const [file, text] of Object.entries(files)) {
    text.split('\n').forEach((line, i) => {
      const t = line.match(/^### (T-(\d+)) · /);
      const a = line.match(/^- \*\*Card (A-(\d+))\*\*/);
      if (t || a) heads.push({ file, i, line, id: (t ?? a)[1], n: Number((t ?? a)[2]), kind: t ? 'T' : 'A' });
    });
  }
  const lines = Object.fromEntries(Object.entries(files).map(([f, t]) => [f, t.split('\n')]));
  const moved = [];
  for (const kind of ['T', 'A']) {
    const mine = heads.filter((h) => h.kind === kind);
    let next = Math.max(0, ...mine.map((h) => h.n));
    for (const id of [...new Set(mine.map((h) => h.id))]) {
      const same = mine.filter((h) => h.id === id);
      if (same.length < 2) continue;
      // The kept one: its heading and the line after it already on main.
      const onMain = (h) => published.includes(`${h.line}\n${lines[h.file][h.i + 1] ?? ''}`);
      const keep = same.find(onMain) ?? same[0];
      for (const h of same.filter((x) => x !== keep)) {
        const fresh = `${kind}-${String(++next).padStart(3, '0')}`;
        lines[h.file][h.i] = h.line.replace(id, fresh);
        moved.push(`${id} → ${fresh} (${h.file}, line ${h.i + 1})`);
        // A card merged into the moved one in the same unpublished work follows it: left
        // alone, it would point at the other chat's card (seen 2026-10-27: A-055 and A-081
        // pointed into nutrition cards after the self-knowledge cards moved to A-101, A-102).
        if (kind === 'A' && onMain(keep)) {
          for (const [f, ls] of Object.entries(lines)) {
            ls.forEach((line, i) => {
              if (line.startsWith('- **Card ') && line.includes(` · into: ${id}`) && !published.includes(line)) {
                ls[i] = line.replace(` · into: ${id}`, ` · into: ${fresh}`);
                moved.push(`${line.match(/A-\d+/)[0]} now merged into ${fresh} (${f}, line ${i + 1})`);
              }
            });
          }
        }
      }
    }
  }
  return { files: Object.fromEntries(Object.entries(lines).map(([f, l]) => [f, l.join('\n')])), moved };
}

/** renumber's moves as [old, new], leaving out a number moved two ways (three chats took it), which no reference can follow. */
export function renumberedPairs(moved) {
  const pairs = moved.map((m) => m.match(/^([TA]-\d+) → ([TA]-\d+) \(/)?.slice(1)).filter(Boolean);
  return pairs.filter(([a]) => pairs.filter(([b]) => b === a).length === 1);
}


/** A file name for a way's page: its word, e.g. `way-not-doing.md`. */
export const wayPage = (way) => `way-${way.replace(/^\S+\s+/, '').replace(/\s+/g, '-')}.md`;
/** One line of a page: the remark's number, day, ways and his own opening words. Kept per remark
 *  once made: a page is packed into parts by rendering it again and again, and every one of some
 *  45 pages did that afresh, about 13 seconds a build and a merge's driver call each (T-822). The
 *  line turns only on the remark, so the kept one is the same text. */
const lines = new WeakMap();
function indexLine(e) {
  if (!lines.has(e)) lines.set(e, indexLineFresh(e));
  return lines.get(e);
}
function indexLineFresh(e) {
  const words = String(e.words ?? e.quote ?? '').replace(/\s+/g, ' ').trim();
  const clipped = words.length > 200 ? `${words.slice(0, 200).replace(/\s\S*$/, '')}…` : words;
  const ways = [e.way, ...(e.also ?? [])].join(' + ');
  const day = new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `- **${e.id}** · ${day} · ${ways} · [${e.file.replace('.md', '')}](../transcript/${e.file})\n  > ${clipped.replace(/^([#>*-])/, '\\$1')}`;
}
/**
 * A-070: the pages by way and by topic, generated from his exact words, newest first,
 * grouped by month: a README naming every page with its count, one page per way and
 * one per topic. Every page is always written, empty or not, so the set never changes
 * by itself. Each line carries his opening words; the whole remark is a click away.
 */
export function renderIndex(entries, { limit = PART_LINES } = {}) {
  const sorted = entries.filter((e) => e.way !== UNSORTED).sort((a, b) => Number(b.id.slice(2)) - Number(a.id.slice(2)));
  // Every page carries a fingerprint of the whole Transcript, so when both chats changed it every
  // page differs on both sides and git hands each to the merge driver to rebuild: a page only one
  // side touched was taken from that side unasked, with this chat's renumbered remark still under
  // its old number (2026-10-31).
  const print = transcriptPrint(entries);
  const head = (title, note) => `# ${title}\n\n> **Generated** from the Transcript's ${entries.length} remarks (${print}) by \`node ux/scripts/dialogue.mjs build\`; never edit it by hand. ${note}\n`;
  const body = (list) => {
    if (!list.length) return '\nNothing yet.\n';
    const out = [];
    let month = '';
    for (const e of list) {
      const m = e.file.replace('.md', '');
      if (m !== month) out.push('', `## ${m}`, '');
      month = m;
      out.push(indexLine(e));
    }
    return `${out.join('\n')}\n`;
  };
  const pages = {};
  const counts = { ways: [], topics: [] };
  // A page past PART_LINES goes on in `<page>-2.md`, cut between remarks (lib/one-read.mjs, T-768):
  // the busiest way passed 500 lines in its first fortnight.
  const paged = (name, title, note, list) => {
    const render = (n, items) => head(n > 1 ? `${title} · part ${n}` : title, `${note}${n > 1 ? ` Goes on from [part ${n - 1}](${partPath(name, n - 1)}).` : ''}`) + body(items);
    const parts = packParts(list, render, limit);
    for (const [n, items] of parts) pages[partPath(name, n)] = render(n, items);
    return parts.length > 1 ? ` (${parts.map(([n]) => `[part ${n}](${partPath(name, n)})`).join(', ')})` : '';
  };
  for (const way of WAYS) {
    const list = sorted.filter((e) => e.way === way || e.also?.includes(way));
    const more = paged(wayPage(way), `${way}: everything said this way`, `${list.length} remark(s), newest first; one carrying several ways is on each of their pages.`, list);
    counts.ways.push(`- [${way}](${wayPage(way)}) · ${list.length}${more}`);
  }
  for (const [slug, label] of Object.entries(TOPICS)) {
    const list = sorted.filter((e) => e.topics?.includes(slug));
    const more = paged(`topic-${slug}.md`, `${label}`, `${list.length} remark(s) on this topic, newest first; one touching several topics is on each of their pages.`, list);
    counts.topics.push(`- [${label}](topic-${slug}.md) · ${list.length}${more}`);
  }
  const untagged = sorted.filter((e) => !e.topics?.length);
  pages['README.md'] = `${head('Everything said, by kind and by topic', 'What the developer said in development mode, findable both ways (A-070): by the kind of thing it is, and by what it is about. Each remark is on the page of every way it carries and every topic it touches.')}\n## By kind\n\n${counts.ways.join('\n')}\n\n## By topic\n\n${counts.topics.join('\n')}\n${untagged.length ? `\n${untagged.length} remark(s) carry no topic yet: ${untagged.map((e) => e.id).join(', ')}.\n` : ''}`;
  return pages;
}
/** Writes every page, and removes a page no longer generated; returns the file names written. */
export function writeIndex(entries, dir = INDEX) {
  const pages = renderIndex(entries);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.md') && !(f in pages)) rmSync(join(dir, f));
  for (const [f, text] of Object.entries(pages)) writeFileSync(join(dir, f), text);
  return Object.keys(pages);
}
/** The pages that differ from what the Transcript generates. */
export function indexStale(entries, dir = INDEX) {
  const pages = renderIndex(entries);
  const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  return [...new Set([...Object.keys(pages), ...have])].filter((f) => !(f in pages) || !existsSync(join(dir, f)) || readFileSync(join(dir, f), 'utf8') !== pages[f]);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
// git's merge driver runs in the repository being merged, whatever this copy holds.
if (isMain && process.argv[2] === 'merge-driver') process.exit(mergeDriver(process.argv.slice(3)));
// After a merge went through (git/post-merge): the pages rebuilt in the repository merged, as above.
if (isMain && process.argv[2] === 'after-merge') {
  const top = (gitIn(process.cwd(), 'rev-parse', '--show-toplevel') ?? '').trim();
  const rebuilt = top ? rebuildAfterMerge(top) : [];
  // Committed at once, so a merge's out-of-date pages never reach a push (2026-11-04: e313b7ee6
  // carried a 1,035-line one-file Agreements to main). Only when the Transcript on disk is the
  // one committed: pages built from remarks not yet committed would not match the commit.
  const pages = [`${DEV_DIR}/dialogue/agreements.md`, `${DEV_DIR}/dialogue/agreements/`, `${DEV_DIR}/dialogue/index/`];
  const clean = top && spawnSync('git', ['diff', '--quiet', 'HEAD', '--', `${DEV_DIR}/dialogue/transcript/`], { cwd: top }).status === 0;
  let committed = false;
  if (rebuilt.length && clean) {
    spawnSync('git', ['add', '-A', '--', ...pages], { cwd: top });
    committed = spawnSync('git', ['commit', '-q', '-m', 'chore(dialogue): rebuild the generated pages after a merge', '--', ...pages], { cwd: top, stdio: ['ignore', 'ignore', 'inherit'], timeout: 300000 }).status === 0;
  }
  if (rebuilt.length) console.log(`dialogue: ${rebuilt.length} generated page(s) rebuilt from the merged Transcript (${rebuilt.slice(0, 4).join(', ')}${rebuilt.length > 4 ? ', …' : ''}); ${committed ? 'committed' : 'the next commit carries them'}`);
  process.exit(0);
}
if (isMain && !existsSync(DIALOGUE)) {
  console.log(`dialogue: no ${DEV_DIR}/dialogue/ in this copy (ARC-008), nothing to do`);
  process.exit(0);
}
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const entries = readTranscript();
  if (cmd === 'build') {
    const parts = writeAgreements(entries, readCards(), DIALOGUE);
    const pages = writeIndex(entries);
    console.log(`dialogue: ${entries.length} transcript entries · wrote ${standingCards(entries).length} standing cards to agreements.md and ${parts.length - 1} page(s) in agreements/ (archive included), and ${pages.length} pages by way and topic to index/`);
  } else if (cmd === 'check') {
    const cardsOff = agreementsStale(entries, readCards(), DIALOGUE);
    if (cardsOff.length) {
      console.error(`dialogue: ${cardsOff.length} page(s) of the Agreements do not match the Transcript (${cardsOff.slice(0, 5).join(', ')}${cardsOff.length > 5 ? ', …' : ''}). Run: node ux/scripts/dialogue.mjs build`);
      process.exit(1);
    }
    const pagesOff = indexStale(entries);
    if (pagesOff.length) {
      console.error(`dialogue: ${pagesOff.length} page(s) in index/ do not match the Transcript (${pagesOff.slice(0, 5).join(', ')}${pagesOff.length > 5 ? ', …' : ''}). Run: node ux/scripts/dialogue.mjs build`);
      process.exit(1);
    }
    const owed = evalGaps(entries, readCards(), specCarried());
    const backed = typedEntries(REPO);
    // A merged card cited where a standing one binds: refused in the specs and trace.md, reported in for-you lines.
    const mergedCited = mergedCitations([
      ...specRows().map((r) => ({ label: `${SPECS_DIR}/${r.path} ${r.id}`, text: r.text })),
      { label: `${DEV_DIR}/dialogue/trace.md`, text: existsSync(TRACE) ? readFileSync(TRACE, 'utf8') : '', lines: true },
    ], entries);
    // This chat's lines outside the Transcript still citing a number its merge moved (the commit gate reads a copy, its git is DEAR_GIT_ROOT).
    const stale = movedReferences({ gitRoot: process.env.DEAR_GIT_ROOT || REPO, root: REPO }).map((h) => `${h.path}, line ${h.line}, cites ${h.ids.join(', ')}, moved in a merge: run \`dialogue.mjs moved --fix\``);
    // A remark both parents of a merge hold, lost by it: the one under way, or one not pushed yet (cc3b5320, 2026-10-30).
    const lostInMerge = mergeLosses({ gitRoot: process.env.DEAR_GIT_ROOT || REPO, root: REPO });
    // A part grown past the one-read line since it was cut (by sorting, or a merge appending to it): cut the month again.
    const tfiles = Object.fromEntries(sortParts(readdirSync(TRANSCRIPT)).map((f) => [f, readFileSync(join(TRANSCRIPT, f), 'utf8')]));
    const oversize = oversizeParts(tfiles).map(([f, n]) => `${DEV_DIR}/dialogue/transcript/${f} is ${n} lines, past the one-read line of ${ONE_READ}: run \`dialogue.mjs split\` (T-499)`);
    // A typed message with no entry: its words lost to a merge or a race (A-047, 3 Nov).
    const missing = missingEntries(typedRows(REPO), transcriptQuotes(REPO)).map((m) => `${m.at.length} message(s) he typed on ${m.date} (at ${m.at.map((t) => t.slice(11, 16)).join(', ')} UTC${m.or ? `, or at ${m.or.map((t) => t.slice(11, 16)).join(', ')}, which a moved-out mark was taken to stand for` : ''}) have no Transcript entry: a merge or a race lost the words; restore them word for word from that chat's conversation, or, where they were taken out for his privacy, leave the entry's mark ([moved to his record], [a name]) (A-047)`);
    const faults = [...missing, ...oversize, ...idFaults(entries), ...transcriptFaults(entries), ...agreementFaults(entries, (e) => backed.has(e.id)), ...wordingFaults(entries), ...traceCheck(entries), ...owed.faults, ...mergedCited, ...clashFaults(entries), ...lessonFaults(entries), ...stale, ...lostInMerge];
    if (faults.length) {
      console.error(`dialogue: the Transcript has ${faults.length} fault(s):\n${faults.map((f) => `  - ${f}`).join('\n')}`);
      process.exit(1);
    }
    // Reported, not refused: cards agreed before this check began (EVAL_OWED), and cards no spec cites yet.
    if (owed.noEval.length) console.log(`dialogue: ⚠️ ${owed.noEval.length} agreed card(s) bind with no eval card naming them: ${owed.noEval.join(', ')} (dialogue.mjs owed)`);
    if (owed.notRunning.length) console.log(`dialogue: ⚠️ ${owed.notRunning.length} agreed card(s) have an eval written, not running (every eval naming them is not runnable yet): ${owed.notRunning.join(', ')}`);
    if (owed.noSpec.length) console.log(`dialogue: ⚠️ ${owed.noSpec.length} agreed card(s) no spec row or trace.md cites: ${owed.noSpec.join(', ')}`);
    const digests = digestState();
    const review = reviewState(entries);
    if (review.due) console.log(`dialogue: ⚠️ a review of the Agreements is due (A-147): ${review.why.join('; ')}; look for gaps, overlaps and contradictions, write it in ${DEV_DIR}/dialogue/reviews/<YYYY-MM-DD>-<topic>.md, and put each finding to the owner`);
    const method = methodState();
    if (method.due) console.log(`dialogue: ⚠️ the weekly recheck of the method is due (A-153): ${method.last ? `last run ${method.last}` : 'never run'}; the daily loop's method step runs it, logged in ${relative(REPO, METHOD_LOG)}`);
    if (digests.length) console.log(`dialogue: ⚠️ closed month(s) with no digest (A-147): ${digests.join(', ')}; write one page each in ${DEV_DIR}/dialogue/digests/<YYYY-MM>.md`);
    const forYouLines = (existsSync(FOR_YOU) ? readFileSync(FOR_YOU, 'utf8') : '').split('\n').map((l) => (/^- for-you · /.test(l) ? l : '')).join('\n');
    for (const hit of mergedCitations([{ label: `${DEV_DIR}/for-you.md`, text: forYouLines, lines: true }], entries)) console.log(`dialogue: ⚠️ ${hit}`);
    // Reported, not refused: rows written before the Transcript began quote him still (dialogue.mjs gaps).
    const gaps = quoteGaps(specRows(), entries);
    const gapNote = gaps.length ? `; ${gaps.length} owner quote(s) in spec rationales no card carries (${[...new Set(gaps.map((g) => g.id))].join(', ')}): dialogue.mjs gaps` : '';
    const untagged = entries.filter((e) => e.way !== UNSORTED && !e.topics?.length).length;
    if (untagged) console.log(`dialogue: ⚠️ ${untagged} remark(s) from before ${TOPICS_SINCE} carry no topic yet (A-070): see index/README.md`);
    console.log(`dialogue: agreements.md, its parts and index/ match the Transcript (${entries.length} entries)${gapNote}`);
  } else if (cmd === 'trace') {
    const faults = traceCheck(entries);
    if (faults.length) {
      console.error(`dialogue: trace.md has ${faults.length} fault(s):\n${faults.map((f) => `  - ${f}`).join('\n')}`);
      process.exit(1);
    }
    const regs = specRegisters();
    const rows = readFileSync(TRACE, 'utf8').split('\n').filter((l) => /^\|\s*`[A-Z]{3}`/.test(l));
    const open = rows.filter((l) => l.includes(NO_AGREEMENT)).length;
    // A row whose every card is still drafted serves nothing binding yet: counted apart, never as agreed.
    const agreed = new Set(standingCards(entries).filter((e) => e.card.status === 'agreed').map((e) => e.card.id));
    const waiting = rows.filter((l) => !l.includes(NO_AGREEMENT) && !(l.split('|')[3].match(/\bA-\d+\b/g) ?? []).some((id) => agreed.has(id))).length;
    console.log(`dialogue: all ${regs.length} registers traced in trace.md · ${regs.length - open - waiting} to an agreed card, ${waiting} only to drafted cards awaiting the owner's yes, ${open} with none yet`);
  } else if (cmd === 'sort') {
    const waiting = entries.filter((e) => e.way === UNSORTED);
    console.log(waiting.length ? `dialogue: ${waiting.length} entr${waiting.length === 1 ? 'y' : 'ies'} to sort into one of the sixteen ways (${WAYS.join(' · ')}), with every other way it carries on an Also line and every topic it touches on a Topics line (${Object.keys(TOPICS).join(', ')}); an idea, his or an agent's, also gets its line in dev/ideas.md (A-125):` : 'dialogue: nothing unsorted');
    for (const e of waiting) console.log(`   ${e.id} · ${e.date} · ${e.file} · "${clip(e.quote, 80)}"`);
  } else if (cmd === 'coverage' && rest.length === 1) {
    // An import that skips a decision is invisible to `ask`: on 2026-10-19 the health check
    // answered "not considered" to a question decided hours earlier (D46), because the import
    // into the Transcript had left it out. This lists what no entry names, so a gap shows.
    const said = [...new Set(entries.map((e) => e.file))].map((f) => readFileSync(join(TRANSCRIPT, f), 'utf8')).join('\n');
    const { decided, missing } = coverageGaps(readFileSync(rest[0], 'utf8'), said);
    console.log(missing.length ? `dialogue: ${missing.length} of ${decided.length} decisions are named by no Transcript entry: ${missing.join(' | ')}` : `dialogue: all ${decided.length} decisions are named in the Transcript`);
    process.exitCode = missing.length ? 1 : 0;
  } else if (cmd === 'unproven') {
    const u = unproven(entries, readCards(), readHistory());
    const says = new Map(standingCards(entries).map((e) => [e.card.id, e.card.says]));
    console.log(u.length ? `dialogue: ${u.length} agreed card(s) not yet proven (proven only when every runnable eval naming it passed its last run, T-840), so not yet built for certain:\n${u.map((id) => `   ${id} · ${clip(says.get(id) ?? '', 90)}`).join('\n')}` : 'dialogue: every agreed card is proven: every eval naming it passed');
    process.exitCode = u.length ? 1 : 0;
  } else if (cmd === 'done' && rest.length) {
    let gaps = 0;
    for (const id of rest) {
      const ls = levels(id, entries);
      gaps += ls.filter((x) => !x.ok).length;
      console.log(`${id}: ${ls.every((x) => x.ok) ? '✅ every level done' : `${ls.filter((x) => !x.ok).length} level(s) left`}`);
      for (const x of ls) console.log(`   ${x.ok ? '✅' : '❌'} ${x.level}: ${x.saw}`);
    }
    process.exitCode = gaps ? 1 : 0;
  } else if (cmd === 'milestones') {
    const m = milestones(entries);
    console.log(m.length ? m.map((x) => `🏁 ${x.date} · ${x.text}`).join('\n') : 'no milestones yet');
  } else if (cmd === 'group') {
    const w = weeklyGroup(entries, rest[0]);
    if (!w) { console.log('dialogue: no groups'); process.exit(0); }
    console.log(`📚 This week's group (A-147): ${w.group}, ${w.cards.length} card(s). Read them whole, side by side, for gaps, overlaps and contradictions:`);
    for (const e of w.cards) console.log(`\n${e.card.id} ${e.card.emoji} ${e.card.says}\n   Failed if: ${e.card.failedIf}`);
  } else if (cmd === 'learning') {
    const m = learning(entries);
    console.log(`🎓 learning map: ${m.counts.learned} learned · ${m.counts.taught} taught · ${m.counts.gap} with a gap · ${m.counts.new} not started, of ${m.topics.length}`);
    for (const t of m.topics) console.log(`   ${{ learned: '✅', taught: '📘', gap: '🕳️', new: '⬜' }[t.status]} ${t.id} ${t.track} ${t.title}${t.lessons.length ? ` · ${t.lessons.join(', ')}` : ''}${t.gaps.length ? ` · gap: ${t.gaps.map((g) => g.text).join('; ')}` : ''}`);
    console.log(m.next ? `   next: ${m.next.id} ${m.next.title}${m.next.status === 'gap' ? ' (a gap to close)' : ''}` : '   next: the map is done; add topics where his questions show a need');
    if (m.unknown.length) console.log(`   ⚠️ lines naming no topic on the map: ${m.unknown.join(', ')}`);
  } else if (cmd === 'lessons') {
    const l = lessons(entries);
    console.log(`🎓 ${l.given.length} lesson(s) given, ${l.given.filter((x) => x.took).length} learned (used on your own a week or more later)${l.repeats.length ? ` · ⚠️ repeated: ${l.repeats.join(', ')}` : ''}${l.tooOften.length ? ` · ⚠️ recall asked more than once a week` : ''}`);
    for (const [style, b] of Object.entries(l.byStyle)) console.log(`   by ${style}: ${b.took} of ${b.given} learned`);
    console.log(l.enough ? `   teaches best by: ${l.best ?? 'no style yet stands out'}` : `   too few lessons to tell how you learn best (${l.given.length} of ${ENOUGH_LESSONS}); mixing styles until then`);
    if (l.due) console.log(`   recall due: ${l.due.id} · ${clip(l.due.text, 80)}`);
    // A-147: a learned lesson retires from the list; it is counted above, never listed again.
    for (const x of l.given.filter((g) => !g.took).slice(-10)) console.log(`   ${x.id} · ${x.date} · ${x.style} · ${x.took ? '✅' : '·'}${x.recalled ? ` recalled ${x.recallKept}/${x.recalled}` : ''} ${clip(x.text, 80)}`);
  } else if (cmd === 'growth') {
    const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');
    console.log('🌱 How your dialogue is growing (evidence, not a grade):');
    for (const g of growth(entries)) console.log(`   ${g.month} · ${g.remarks} remarks · wants ${pct(g.wants, g.remarks)} · corrections ${pct(g.complaints, g.remarks)} · repeats ${g.repeats} · became agreements ${g.agreed}`);
  } else if (cmd === 'gists') {
    // `ask` matches words; a paraphrase can miss. This is every remark's gist, one line each,
    // for the agent to read and match by meaning (T-168, gap 5).
    for (const e of entries) console.log(`${e.id} · ${e.date} · ${e.way} · ${e.card ? `${e.card.id} · ` : ''}${e.gist || clip(e.quote, 100)}`);
  } else if (cmd === 'gates') {
    const hours = Number(rest[0]) || 24;
    let log = '';
    try { log = execFileSync('git', ['log', `--since=${hours} hours ago`, '--no-merges', '--format=%x1e%h%x09%s%n%b%x1f', '--name-only'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* no history */ }
    // A yes is an agreed card, or a Transcript entry that records one (a 🤝 entry, or one holding an agreed card).
    const agreedCards = cardEntries(entries).filter((e) => e.card.status === 'agreed');
    const yes = new Set([...entries.filter((e) => e.way === '🤝 agreement').map((e) => e.id), ...agreedCards.map((e) => e.id), ...agreedCards.map((e) => e.card.id)]);
    const held = gateHolds(log, yes);
    console.log(held.length ? `dialogue: ${held.length} commit(s) in ${hours}h changed what she would notice with no Approved: line and no agreed card named (gate 2):\n${held.map((h) => `  - ${h.sha} ${h.subject} (${h.files.slice(0, 3).join(', ')}${h.files.length > 3 ? ', …' : ''})`).join('\n')}` : `dialogue: no commit in ${hours}h changed what she would notice without the owner's yes`);
    process.exitCode = held.length ? 1 : 0;
  } else if (cmd === 'triage') {
    const t = forYouTriage(existsSync(FOR_YOU) ? readFileSync(FOR_YOU, 'utf8') : '', rest[0]);
    console.log(`dialogue: ${t.open} waiting on the owner · ${t.groups.length} group(s) of near-duplicates (${t.groups.reduce((n, g) => n + g.count, 0)} lines) · ${t.old} open over ${STALE_ITEM_DAYS} days`);
    for (const g of t.groups.slice(0, 15)) console.log(`   ${g.count}× ${g.lead}…`);
  } else if (cmd === 'status') {
    const today = rest[0] === '--today' && rest[1] ? rest[1] : undefined;
    let commits = [];
    try {
      commits = execFileSync('git', ['log', '--since=60 days ago', '--format=%cs%x09%s'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').filter(Boolean).map((l) => { const [date, subject] = l.split('\t'); return { date, subject }; });
    } catch { /* no history: the digest counts nothing */ }
    const forYou = existsSync(FOR_YOU) ? readFileSync(FOR_YOU, 'utf8') : '';
    console.log(statusLines(entries, { today, cards: readCards(), history: readHistory(), commits, forYou, digests: digestState(), review: reviewState(entries), method: methodState() }).join('\n'));
  } else if (cmd === 'split') {
    // Every month with a part past the one-read line, cut again from that part on (T-499); each entry word for word, in order.
    const names = sortParts(readdirSync(TRANSCRIPT));
    const byMonth = new Map();
    for (const f of names) byMonth.set(partOf(f).month, [...(byMonth.get(partOf(f).month) ?? []), [f, readFileSync(join(TRANSCRIPT, f), 'utf8')]]);
    const said = [];
    for (const [month, parts] of byMonth) {
      const out = recut(parts);
      const changed = out.filter(([f, t]) => t !== parts.find(([g]) => g === f)?.[1]);
      if (!changed.length) continue;
      for (const [f, t] of changed) {
        // A part no longer needed: its entries are in the parts before it, word for word (checked below), and in git.
        if (t === null) rmSync(join(TRANSCRIPT, f));
        else writeFileSync(join(TRANSCRIPT, f), t);
      }
      said.push(`${month}: ${out.filter(([, t]) => t !== null).map(([f, t]) => `${f} ${t.split('\n').length}`).join(', ')}`);
    }
    const after = readTranscript().map(({ file, ...e }) => e);
    if (JSON.stringify(after) !== JSON.stringify(entries.map(({ file, ...e }) => e))) {
      console.error('dialogue: the cut changed an entry; nothing should differ but which part holds it. Compare with git diff before committing');
      process.exit(1);
    }
    console.log(said.length ? `dialogue: cut again, every entry word for word and in order: ${said.join('; ')}. Rebuild: dialogue.mjs build` : `dialogue: no part is past the one-read line of ${ONE_READ}`);
  } else if (cmd === 'renumber') {
    const months = sortParts(readdirSync(TRANSCRIPT));
    const files = Object.fromEntries(months.map((f) => [f, readFileSync(join(TRANSCRIPT, f), 'utf8')]));
    const published = months.map((f) => { try { return execFileSync('git', ['show', `origin/main:${relative(REPO, join(TRANSCRIPT, f))}`], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } }).join('\n');
    const { files: out, moved } = renumber(files, published);
    for (const f of months) if (out[f] !== files[f]) writeFileSync(join(TRANSCRIPT, f), out[f]);
    console.log(moved.length ? `dialogue: renumbered ${moved.length}: ${moved.join('; ')}. Rebuild: dialogue.mjs build` : 'dialogue: no number is given twice');
    // Main's number was kept, so this chat's own lines citing it (a month apart, in a spec, the for-you list) follow the moved one.
    const pairs = renumberedPairs(moved);
    const main = published ? (gitIn(REPO, 'rev-parse', '-q', '--verify', 'origin/main') ?? '').trim() : '';
    if (pairs.length && main) {
      const base = (gitIn(REPO, 'merge-base', 'HEAD', main) ?? '').trim();
      for (const h of movedReferences({ fix: true, notes: [{ pairs, base, ours: null, theirs: main, everywhere: true }] })) console.log(`dialogue: ${h.path}, line ${h.line}: ${h.ids.join(', ')} (moved)`);
    }
  } else if (cmd === 'moved') {
    const fix = rest.includes('--fix');
    const hits = movedReferences({ gitRoot: (gitIn(process.cwd(), 'rev-parse', '--show-toplevel') ?? REPO).trim(), root: REPO, fix });
    for (const h of hits) console.log(`dialogue: ${h.path}, line ${h.line}: ${h.ids.join(', ')}${h.fixed ? ' (moved)' : ''}`);
    console.log(hits.length ? (fix ? `dialogue: ${hits.length} reference(s) moved with their number; commit them` : `dialogue: ${hits.length} line(s) this chat wrote cite a number its merge moved: run dialogue.mjs moved --fix`) : 'dialogue: no line this chat wrote cites a number a merge moved');
  } else if (cmd === 'resolve') {
    process.exitCode = resolveConflicts((gitIn(process.cwd(), 'rev-parse', '--show-toplevel') ?? REPO).trim());
  } else if (cmd === 'gaps') {
    const gaps = quoteGaps(specRows(), entries);
    console.log(gaps.length ? `dialogue: ${gaps.length} owner quote(s) in spec rationales that no card carries; carry each in (dialogue README, *Words from before the Transcript*) as an entry with a drafted card:` : 'dialogue: every owner quote in a spec rationale is carried by a card');
    for (const g of gaps) console.log(`   ${g.id} · "${clip(g.quote, 90)}"`);
    process.exitCode = gaps.length ? 1 : 0;
  } else if (cmd === 'owed') {
    const owed = evalGaps(entries, readCards(), specCarried());
    const says = new Map(standingCards(entries).map((e) => [e.card.id, e.card.says]));
    console.log(`dialogue: ${owed.noEval.length} agreed card(s) no eval card names${owed.noEval.length ? ':' : ''}`);
    for (const id of owed.noEval) console.log(`   ${id}${EVAL_OWED.has(id) ? '' : ' 🔴 new, refused by check'} · ${clip(says.get(id) ?? '', 90)}`);
    // T-273: written is not running. Each eval that cannot run names what blocks it.
    const blocked = new Map(readCards().filter((c) => !runnable(c)).flatMap((c) => (Array.isArray(c.why) ? c.why : []).map((w) => [w, `${c.id}: ${c.blocked_by ?? 'no reason given'}`])));
    console.log(`dialogue: ${owed.notRunning.length} agreed card(s) with an eval written, not running${owed.notRunning.length ? ':' : ''}`);
    for (const id of owed.notRunning) console.log(`   ${id} · ${clip(says.get(id) ?? '', 60)} · blocked: ${blocked.get(id) ?? '?'}`);
    console.log(`dialogue: ${owed.noSpec.length} agreed card(s) no spec row or trace.md cites${owed.noSpec.length ? ':' : ''}`);
    for (const id of owed.noSpec) console.log(`   ${id} · ${clip(says.get(id) ?? '', 90)}`);
    for (const f of owed.faults) console.log(`   🔴 ${f}`);
    process.exitCode = owed.faults.length ? 1 : 0;
  } else if (cmd === 'ask' && rest.length) {
    // A copy hours behind GitHub answers "never said" for what another chat kept (2026-10-30: a
    // search here missed T-450 and the developer was told his ask was lost). Say so before the answer.
    const behind = behindOrigin(REPO);
    if (behind > 0) console.log(`⚠️ this copy is ${behind} commit(s) behind GitHub's main: what is not found below may be there. Pull first (git pull --no-rebase origin main), then ask again.\n`);
    printAsk(rest.join(' '), entries);
  } else {
    console.error('usage: dialogue.mjs build | check | group [YYYY-MM-DD] | owed | sort | trace | status [--today YYYY-MM-DD] | unproven | done A-NNN… | milestones | learning | lessons | growth | gists | gates [hours] | triage | ask <question> | coverage <decisions.md> | renumber | resolve | gaps | moved [--fix]');
    process.exit(2);
  }
}
