// The Agreements, generated from the Transcript in parts (T-768: "Okay, these two are
// you have to do and make sure this issue doesn't happen again in the future.").
//
// One file of every card reached 1,004 lines on 2026-11-04, past the one-read line
// (E-031, A-071). So `dialogue.mjs build` writes:
//
//   agreements.md                 the index, at the same path every link already names:
//                                 the counts, each group's page, and every card's ID as an
//                                 anchor (`agreements.md#a-067`) linking on to its card
//   agreements/<n>-<group>.md     one page per group of standing cards, in reading order,
//                                 each card with its own anchor; a group past PART_LINES
//                                 goes on in `<n>-<group>-2.md` (lib/one-read.mjs)
//   agreements/archive.md         the cards merged into another: kept word for word, no
//                                 longer standing, cut the same way
//
// Every card keeps its ID and its words, and stands on exactly one page. Every page
// carries the Transcript's fingerprint, so when two chats both changed it, every page
// differs on both sides and git hands each to the merge driver to rebuild (as the
// pages by way and topic do, 2026-10-31).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PART_LINES, packParts, partPath } from '../../.claude/hooks/lib/one-read.mjs';
import { cardEntries, standingCards } from './dialogue.mjs';
import { checkKind, clip } from './dialogue-views.mjs';

/** The index page, and the folder its parts live in, both relative to the dialogue folder. */
export const AGREEMENTS_INDEX = 'agreements.md';
export const AGREEMENTS_PARTS = 'agreements';
export const ARCHIVE_PAGE = 'archive.md';

const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** A card's anchor: `A-067` → `a-067`, the same on its page and in the index. */
export const anchorOf = (id) => id.toLowerCase();

/** The Transcript's fingerprint: every remark's number, ways, topics and words. */
export const transcriptPrint = (entries) => createHash('sha1').update(entries.map((e) => `${e.id}|${e.way}|${(e.also ?? []).join()}|${(e.topics ?? []).join()}|${e.words ?? ''}`).join('\n')).digest('hex').slice(0, 12);

/** A group's page name: its number, then its first words until they say enough (`1-how-we-agree.md`). */
export function groupPage(group) {
  const num = (group.match(/^\d+/) ?? ['0'])[0];
  const words = group.replace(/^\d+\s*/, '').toLowerCase().match(/[a-z0-9]+/g) ?? ['cards'];
  const kept = [];
  for (const w of words) {
    kept.push(w);
    if (kept.join('-').length >= 12 || kept.length >= 4) break;
  }
  return `${num}-${kept.join('-')}.md`;
}

const byGroup = (a, b) => a.card.group.localeCompare(b.card.group, 'en', { numeric: true }) || a.card.order - b.card.order || a.card.id.localeCompare(b.card.id, 'en', { numeric: true });

/** One card as the owner reads it: its number, ID, status, words, checks and where it came from. */
function cardBlock(e, n, evalCards, up) {
  const c = e.card;
  const out = [`<a id="${anchorOf(c.id)}"></a>`, '', `> **${n}.** 🤝 ${c.id} · ${e.way} · ${c.status} ${day(e.date)}`, `> **${c.emoji ? `${c.emoji} ` : ''}${c.says}**`];
  if (c.why) out.push(`> *Why:* ${c.why}`);
  out.push(`> *Failed if:* ${c.failedIf}`);
  if (c.eval) out.push(`> *Eval:* ${c.eval}`);
  // A-065: its checks, one line each, under the agreement: kind, what, how often. Results
  // change daily, so they are shown by `dialogue.mjs done`, not written into this file.
  const checks = evalCards.filter((k) => (Array.isArray(k.why) ? k.why : []).includes(c.id));
  if (checks.length) out.push('> *Checked by:*', ...checks.map((k) => `> ${checkKind(k)} ${k.title} · ${k.status !== 'runnable' ? 'not running yet' : k.when === 'before-landing' ? 'every commit' : 'daily'} (${k.id})`));
  out.push(`> *From:* "${clip(e.quote)}" (${e.id}, [transcript](${up}transcript/${e.file}))`, '');
  return ['---', '', ...out].join('\n');
}

/** A merged card, word for word, with the card it went into. */
function archivedBlock(e) {
  const c = e.card;
  const out = [`<a id="${anchorOf(c.id)}"></a>`, '', `> 🗄️ ${c.id} · ${e.way} · merged into [${c.into}](../${AGREEMENTS_INDEX}#${anchorOf(c.into)}) · first said ${day(e.date)}`, `> **${c.emoji ? `${c.emoji} ` : ''}${c.says}**`];
  if (c.why) out.push(`> *Why:* ${c.why}`);
  if (c.failedIf) out.push(`> *Failed if:* ${c.failedIf}`);
  out.push(`> *From:* "${clip(e.quote)}" (${e.id}, [transcript](../transcript/${e.file}))`, '');
  return ['---', '', ...out].join('\n');
}

const generated = (print, count) => [
  `> **Generated** from the Transcript's ${count} remarks (${print}) by \`node ux/scripts/dialogue.mjs build\`. Never edit it by hand:`,
  '> change the card in the Transcript entry it comes from, then rebuild.',
];

/**
 * Every page of the Agreements, as { relative path: text }, the index first. Pure: the
 * merge driver renders a merged Transcript with it before anything is on disk.
 */
export function renderAgreementParts(entries, evalCards = [], { limit = PART_LINES } = {}) {
  const print = transcriptPrint(entries);
  const cards = standingCards(entries).sort(byGroup);
  const merged = cardEntries(entries).filter((e) => e.card.status === 'merged').sort((a, b) => a.card.id.localeCompare(b.card.id, 'en', { numeric: true }));
  const drafted = cards.filter((e) => e.card.status !== 'agreed').length;
  const number = new Map(cards.map((e, i) => [e.card.id, i + 1]));
  const pages = {};
  const where = new Map(); // card id → the page it stands on
  const groups = []; // { group, label, pages: [[page, first, last]], count }

  // One page per group, cut only between cards when it would pass the line.
  for (const group of [...new Set(cards.map((e) => e.card.group))]) {
    const list = cards.filter((e) => e.card.group === group);
    const label = group.replace(/^\d+\s*/, '');
    const base = `${AGREEMENTS_PARTS}/${groupPage(group)}`;
    const render = (n, items) => [
      `# Agreements · ${label}${n > 1 ? ` · part ${n}` : ''}`,
      '',
      ...generated(print, entries.length),
      '',
      `One group of [the Agreements](../${AGREEMENTS_INDEX}): ${list.length} card(s), numbered as they are read there${n > 1 ? `; it goes on from [part ${n - 1}](${partPath(groupPage(group), n - 1)})` : ''}. Each card's ID never changes, and its anchor here is its ID.`,
      '',
      ...items.map((e) => cardBlock(e, number.get(e.card.id), evalCards, '../')),
    ].join('\n');
    const parts = packParts(list, render, limit);
    const entry = { group, label, count: list.length, pages: [] };
    for (const [n, items] of parts) {
      const path = partPath(base, n);
      pages[path] = `${render(n, items)}\n`;
      for (const e of items) where.set(e.card.id, path);
      entry.pages.push([path, number.get(items[0].card.id), number.get(items.at(-1).card.id)]);
    }
    groups.push(entry);
  }

  // The archive: every card merged into another, by ID, cut the same way.
  const archiveBase = `${AGREEMENTS_PARTS}/${ARCHIVE_PAGE}`;
  const renderArchive = (n, items) => [
    `# Agreements · 🗄️ Archive${n > 1 ? ` · part ${n}` : ''}`,
    '',
    ...generated(print, entries.length),
    '',
    `The cards merged into another, ${merged.length} in all, by ID: no longer standing, kept word for word so a link to one still lands. Each names the card it went into, which is the one that binds. Nothing is deleted.${n > 1 ? ` Goes on from [part ${n - 1}](${partPath(ARCHIVE_PAGE, n - 1)}).` : ''}`,
    '',
    ...(items.length ? items.map(archivedBlock) : ['Nothing merged yet.', '']),
  ].join('\n');
  const archiveParts = packParts(merged, renderArchive, limit);
  for (const [n, items] of archiveParts) {
    const path = partPath(archiveBase, n);
    pages[path] = `${renderArchive(n, items)}\n`;
    for (const e of items) where.set(e.card.id, path);
  }

  // The index: the counts, each group's page, then every ID as an anchor linking on.
  const link = (id) => `<a id="${anchorOf(id)}"></a>[${id}](${where.get(id)}#${anchorOf(id)})`;
  const index = [
    '# Agreements',
    '',
    ...generated(print, entries.length),
    '',
    'What currently stands. Each card says one thing, how a person would notice it failing, and the',
    'words it came from. A card is binding only once its status is *agreed* (gate 1). Numbered 1 to n',
    'for reading; the ID beside each never changes, so links to it hold. A card merged into another',
    'leaves this list and stays, word for word, in its Transcript entry and in the archive.',
    '',
    'The cards are kept in parts, one page per group, each within one read (A-071). This page names',
    'the groups, then every card by its ID: a link to a card here (`agreements.md#a-067`) lands on its',
    'ID, one click from the card itself.',
    '',
    // The remark count changes with every remark either chat adds, so two chats adding at once
    // both change this file and git hands it to the merge driver, which rebuilds it.
    `**${cards.length} cards** · ${cards.length - drafted} agreed · ${drafted} drafted, awaiting the owner's yes · ${merged.length} merged, in the archive · from ${entries.length} remarks`,
    '',
    '## Groups',
    '',
    ...groups.map((g) => `- **${g.label}** · ${g.count} card(s), ${g.pages.map(([p, a, b], i) => `[${g.pages.length > 1 ? `part ${i + 1}, ` : ''}${a === b ? a : `${a}–${b}`}](${p})`).join(' · ')}`),
    `- **🗄️ Archive** · ${merged.length} merged card(s), no longer standing · ${archiveParts.map(([n]) => `[${n > 1 ? `part ${n}` : 'archive'}](${partPath(archiveBase, n)})`).join(' · ')}`,
    '',
    '## Every card, by ID',
    '',
    ...groups.flatMap((g) => [`**${g.label}:** ${cards.filter((e) => e.card.group === g.group).map((e) => link(e.card.id)).join(' · ')}`, '']),
    ...(merged.length ? [`**🗄️ Archive:** ${merged.map((e) => link(e.card.id)).join(' · ')}`, ''] : []),
  ];
  return { [AGREEMENTS_INDEX]: `${index.join('\n')}\n`, ...pages };
}

/** The index page alone: what `agreements.md` holds. */
export const renderAgreements = (entries, evalCards = []) => renderAgreementParts(entries, evalCards)[AGREEMENTS_INDEX];

/** Writes every page under `dir` (the dialogue folder), and removes a part no longer generated; returns the paths written. */
export function writeAgreements(entries, evalCards = [], dir) {
  const pages = renderAgreementParts(entries, evalCards);
  const parts = join(dir, AGREEMENTS_PARTS);
  mkdirSync(parts, { recursive: true });
  for (const f of readdirSync(parts)) if (f.endsWith('.md') && !(`${AGREEMENTS_PARTS}/${f}` in pages)) rmSync(join(parts, f));
  for (const [p, text] of Object.entries(pages)) writeFileSync(join(dir, p), text);
  return Object.keys(pages);
}

/** The pages that differ from what the Transcript generates, a stale part left behind among them. */
export function agreementsStale(entries, evalCards = [], dir) {
  const pages = renderAgreementParts(entries, evalCards);
  const parts = join(dir, AGREEMENTS_PARTS);
  const have = existsSync(parts) ? readdirSync(parts).filter((f) => f.endsWith('.md')).map((f) => `${AGREEMENTS_PARTS}/${f}`) : [];
  return [...new Set([...Object.keys(pages), ...have])].filter((p) => !(p in pages) || !existsSync(join(dir, p)) || readFileSync(join(dir, p), 'utf8') !== pages[p]);
}
