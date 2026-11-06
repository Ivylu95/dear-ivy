#!/usr/bin/env node
// No generated page outgrows one read (T-768: "Okay, these two are you have to do and make
// sure this issue doesn't happen again in the future."). The Agreements were one file of
// 1,004 lines on 2026-11-04, past the line (E-031, A-071). Proven here, on invented cards:
//
//   - the Agreements, built from a Transcript big enough to need more parts, come as an index,
//     a page per group cut before the line, and an archive of merged cards, cut the same way;
//     every part is within the line, every card is on exactly one page, with its ID and words
//     unchanged, and every ID in the index is an anchor linking to the page that holds it;
//   - a merge of two chats' new remarks, through the driver and the rebuild after it, leaves
//     every part matching the merged Transcript, each card once;
//   - the pages by way and topic, the privacy ledger's parts, and an appended log cut
//     themselves the same way (lib/one-read.mjs);
//   - the size check's early warning fires from 900 lines, names the file and how to split
//     it, and leaves a file past 1,000 to the failure.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_READ, PART_LINES, WARN_LINES, howToSplit, lineCount, nearOneRead, packParts, partNumber, partPath } from '../../.claude/hooks/lib/one-read.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { DIALOGUE_DIR, agreementsStale, parseTranscript, readTranscript, rebuildAfterMerge, renderAgreementParts, renderIndex, setMergeDriver, writeAgreements } from './dialogue.mjs';
import { renderOnce } from './dialogue-merge.mjs';
import { ledgerParts, partText } from './privacy-ledger.mjs';
import { appendPart, partsOf } from './append-part.mjs';

// The size check is the developer's (dev/ never ships, ARC-008): its warning is tested where it is.
const PROBE = new URL('../../dev/evals/probes/bounded-size.mjs', import.meta.url);
const { earlyWarnings } = existsSync(fileURLToPath(PROBE)) ? await import(PROBE.href) : { earlyWarnings: null };
const dir = makeTemp('dear-agreement-parts-');
const id = (n, k = 'T') => `${k}-${String(n).padStart(3, '0')}`;
const says = (n) => `🎯 Invented card number ${n} says one thing, plainly, in words long enough to wrap like a real one does.`;
/** One remark carrying one card: standing in `group`, or merged into `into`. */
const remark = (n, { group = '1 🧭 Big group', into = '', date = '2026-10-20' } = {}) => [
  `### ${id(n)} · ${date} · 🤝 agreement`,
  `> invented words of remark ${n}, said once`,
  '- **Gist:** an invented remark.',
  '- **Topics:** dialogue',
  into ? `- **Card ${id(n, 'A')}** · status: merged · into: ${into} · emoji: 🎯` : `- **Card ${id(n, 'A')}** · status: drafted · emoji: 🎯 · group: ${group} · order: ${n}`,
  `  - **Says:** ${says(n)}`,
  `  - **Why:** because remark ${n} asked for it, in its own words.`,
  `  - **Failed if:** card ${n} is missing, or reads otherwise than it was agreed.`,
  '',
].join('\n');
/** 130 cards in one big group, 6 in a small one, and 120 merged into the first: more than one read each. */
const month = (extra = '') => `# Transcript\n\n${Array.from({ length: 130 }, (_, i) => remark(i + 1)).join('\n')}\n${Array.from({ length: 6 }, (_, i) => remark(131 + i, { group: '2 🔁 Small group' })).join('\n')}\n${Array.from({ length: 120 }, (_, i) => remark(137 + i, { into: 'A-001' })).join('\n')}\n${extra}`;
const standingIds = (entries) => entries.flatMap((e) => e.cards ?? []).filter((c) => c.status !== 'merged').map((c) => c.id);
const allIds = (entries) => entries.flatMap((e) => e.cards ?? []).map((c) => c.id);
/** How often each card's anchor stands on the pages (index aside), and on the index. */
const anchors = (pages) => {
  const onPages = new Map();
  for (const [p, t] of Object.entries(pages)) if (p !== 'agreements.md') for (const m of t.matchAll(/^<a id="(a-\d+)"><\/a>$/gm)) onPages.set(m[1], (onPages.get(m[1]) ?? 0) + 1);
  const inIndex = new Map();
  for (const m of pages['agreements.md'].matchAll(/<a id="(a-\d+)"><\/a>\[(A-\d+)\]\(([^)#]+)#(a-\d+)\)/g)) {
    inIndex.set(m[1], (inIndex.get(m[1]) ?? 0) + 1);
    assert.equal(m[1], m[2].toLowerCase(), `the index anchor ${m[1]} is the ID it links`);
    assert.ok(pages[m[3]]?.includes(`<a id="${m[4]}"></a>`), `${m[2]} in the index links to ${m[3]}, which holds its anchor`);
  }
  return { onPages, inIndex };
};
const allWithinLine = (pages) => Object.entries(pages).filter(([, t]) => lineCount(t) > PART_LINES).map(([p, t]) => `${p} ${lineCount(t)}`);

try {
  // ── The helpers every generator shares ──────────────────────────────────────
  assert.ok(PART_LINES < ONE_READ && WARN_LINES < ONE_READ && ONE_READ === 1000, 'the cut and the warning come before the line, and the line stays 1,000');
  assert.equal(partPath('agreements/1-group.md', 1), 'agreements/1-group.md', 'part 1 keeps the name');
  assert.equal(partPath('agreements/1-group.md', 3), 'agreements/1-group-3.md', 'a later part is numbered before the extension');
  assert.equal(partPath('typed.jsonl', 2), 'typed-2.jsonl');
  assert.deepEqual(['a.md', 'a-2.md', 'a-12.md', 'a-1.md', 'ab-2.md'].map((n) => partNumber('a.md', n)), [1, 2, 12, 0, 0], 'a part is known by its number, and nothing else is one');
  const packed = packParts([1, 2, 3, 4, 5], (_, xs) => xs.map(String).join('\n'), 2);
  assert.deepEqual(packed, [[1, [1, 2]], [2, [3, 4]], [3, [5]]], 'items packed in order, cut only between them');

  // ── 1. The Agreements, built from a Transcript that needs more parts ────────
  const entries = parseTranscript({ '2026-10.md': month() });
  const pages = renderAgreementParts(entries, []);
  assert.deepEqual(allWithinLine(pages), [], 'every page is within the cut, so within one read');
  assert.ok(pages['agreements/1-big-group.md'] && pages['agreements/1-big-group-2.md'], 'a group past the cut goes on in a second part');
  assert.ok(pages['agreements/archive.md'] && pages['agreements/archive-2.md'], 'so does the archive of merged cards');
  assert.ok(pages['agreements/2-small-group.md'] && !pages['agreements/2-small-group-2.md'], 'a small group is one page');
  const { onPages, inIndex } = anchors(pages);
  for (const card of allIds(entries)) {
    assert.equal(onPages.get(card.toLowerCase()), 1, `${card} stands on exactly one page`);
    assert.equal(inIndex.get(card.toLowerCase()), 1, `${card} is in the index once, as an anchor`);
  }
  assert.equal(onPages.size, allIds(entries).length, 'and no card is on a page that is not one of them');
  const body = Object.entries(pages).filter(([p]) => p !== 'agreements.md').map(([, t]) => t).join('\n');
  for (let n = 1; n <= 256; n += 1) assert.equal(body.split(says(n)).length - 1, 1, `card ${n}'s words stand once, unchanged`);
  assert.ok(pages['agreements/archive.md'].includes('merged into [A-001](../agreements.md#a-001)'), 'a merged card names the card it went into, by its anchor');
  assert.ok(!pages['agreements/1-big-group.md'].includes('🗄️'), 'a standing page holds only standing cards');
  assert.ok(pages['agreements/1-big-group-2.md'].includes('[part 1](1-big-group.md)'), 'a later part says where it goes on from');
  assert.ok(/\*\*136 cards\*\* · 0 agreed · 136 drafted, awaiting the owner's yes · 120 merged, in the archive/.test(pages['agreements.md']), 'the index counts what stands and what is archived');
  assert.ok(lineCount(pages['agreements.md']) < 60, 'the index stays short: a line per group, not per card');
  // Card numbers run on across a group's parts, as they did in one file.
  assert.ok(pages['agreements/1-big-group-2.md'].includes(`> **${pages['agreements/1-big-group.md'].match(/^> \*\*(\d+)\.\*\*/gm).length + 1}.** 🤝`), 'numbering runs on across parts');

  // Written to disk, a stale part is found and removed.
  const ddir = join(dir, 'dialogue');
  writeAgreements(entries, [], ddir);
  assert.deepEqual(agreementsStale(entries, [], ddir), [], 'what is written matches what is rendered');
  writeFileSync(join(ddir, 'agreements', '9-gone.md'), 'a page no group makes any more\n');
  assert.deepEqual(agreementsStale(entries, [], ddir), ['agreements/9-gone.md'], 'a page no longer made is stale');
  writeAgreements(entries, [], ddir);
  assert.ok(!readdirSync(join(ddir, 'agreements')).includes('9-gone.md'), 'and the build removes it');

  // ── 2. A merge of two chats' new remarks, through git ───────────────────────
  {
    const repo = join(dir, 'merge');
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const tdir = join(repo, 'dev', 'dialogue', 'transcript');
    const ddirR = join(repo, 'dev', 'dialogue');
    const write = (text) => {
      writeFileSync(join(tdir, '2026-10.md'), text);
      const es = readTranscript(tdir);
      // The Agreements only: the pages by way and topic merge as they did before (test-dialogue.mjs).
      writeAgreements(es, [], ddirR);
    };
    mkdirSync(tdir, { recursive: true });
    g('init', '-q', '-b', 'main');
    g('config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(repo, '.gitattributes'), readFileSync(join(DIALOGUE_DIR, '..', '..', '.gitattributes'), 'utf8'));
    setMergeDriver(repo, fileURLToPath(new URL('./dialogue.mjs', import.meta.url)));
    write(month());
    g('add', '-A');
    g('commit', '-qm', 'base');
    // Each chat takes the next numbers for its own new cards, in the big group and the small one.
    const mine = (who) => [remark(257, { date: '2026-10-21' }).replace('invented words of remark 257', `${who} words, a card for the big group`), remark(258, { group: '2 🔁 Small group', date: '2026-10-21' }).replace('invented words of remark 258', `${who} words, a card for the small group`)].join('\n');
    g('checkout', '-qb', 'theirs');
    write(month(mine('theirs')));
    g('add', '-A');
    g('commit', '-qm', 'theirs');
    g('checkout', '-q', 'main');
    write(month(mine('ours')));
    g('add', '-A');
    g('commit', '-qm', 'ours');
    const run = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'merge', '-q', '--no-edit', 'theirs'], { cwd: repo, encoding: 'utf8' });
    assert.equal(run.status, 0, `the merge of both chats' new remarks goes through: ${run.stdout}${run.stderr}`);
    const merged = readTranscript(tdir);
    assert.equal(standingIds(merged).length, 136 + 4, 'both chats\' new cards are kept, the clashing numbers moved');
    // One render for the whole merge, kept in the git folder, every page git handed over cut from it (HYG-002).
    const renders = () => readdirSync(join(repo, '.git')).filter((f) => f.startsWith('dialogue-render-'));
    const kept = renders().filter((f) => f.startsWith('dialogue-render-agreements-'));
    assert.equal(kept.length, 1, `the merge rendered the Agreements once and kept it for its other pages: ${renders().join(', ')}`);
    const keptPages = JSON.parse(readFileSync(join(repo, '.git', kept[0]), 'utf8')).pages;
    assert.equal(keptPages['agreements.md'], readFileSync(join(ddirR, 'agreements.md'), 'utf8'), 'and the page the driver wrote is the kept render\'s');
    rebuildAfterMerge(repo);
    assert.deepEqual(renders(), [], 'the merge over, its kept renders are removed');
    assert.deepEqual(agreementsStale(merged, [], ddirR), [], 'every part matches the merged Transcript');
    const onDisk = Object.fromEntries([['agreements.md', readFileSync(join(ddirR, 'agreements.md'), 'utf8')], ...readdirSync(join(ddirR, 'agreements')).map((f) => [`agreements/${f}`, readFileSync(join(ddirR, 'agreements', f), 'utf8')])]);
    assert.deepEqual(allWithinLine(onDisk), [], 'and each within one read');
    const after = anchors(onDisk);
    for (const card of allIds(merged)) assert.equal(after.onPages.get(card.toLowerCase()), 1, `${card} stands on exactly one page after the merge`);
    for (const who of ['ours', 'theirs']) assert.equal(Object.values(onDisk).join('\n').split(`"${who} words, a card for the big group, said once"`).length - 1, 1, `${who}'s new card is on its page once`);

    // renderOnce itself: made once per merge and kind, again for another merge, only the newest kept.
    let made = 0;
    const make = () => ({ 'page.md': `render ${(made += 1)}\n` });
    const first = renderOnce(repo, 'trial', 'HEAD', 'theirs', make);
    const second = renderOnce(repo, 'trial', 'HEAD', 'theirs', make);
    assert.equal(made, 1, 'the second page of one merge reuses the first page\'s render');
    assert.deepEqual(second, first, 'and gets the same pages');
    assert.equal(renderOnce(repo, 'trial', 'HEAD', 'HEAD~1', make)['page.md'], 'render 2\n', 'another merge renders afresh');
    assert.equal(made, 2, 'once');
    renderOnce(repo, 'trial', 'HEAD', 'theirs', make, 'other cards');
    assert.equal(made, 3, 'other cards are another render too');
    assert.equal(readdirSync(join(repo, '.git')).filter((f) => f.startsWith('dialogue-render-trial-')).length, 1, 'only the newest render of a kind is kept');
    renderOnce(repo, 'other', 'HEAD', 'theirs', () => null);
    assert.equal(renders().length, 2, 'a render of another kind leaves this one alone');
    const [trial] = renders().filter((f) => f.startsWith('dialogue-render-trial-'));
    writeFileSync(join(repo, '.git', trial), '{ half written');
    assert.equal(renderOnce(repo, 'trial', 'HEAD', 'theirs', make, 'other cards')['page.md'], 'render 4\n', 'a render that cannot be read is made again');
    assert.equal(renderOnce(repo, 'other', 'HEAD', 'theirs', () => ({ never: 'made' })), null, 'a kept "cannot be rendered" is kept too');
    assert.equal(renderOnce(repo, 'trial', 'HEAD', 'no-such-commit', make)['page.md'], 'render 5\n', 'without both commits it renders, as before');
    assert.equal(renders().length, 2, 'and keeps nothing for it');
  }

  // ── 3. Every other generator cuts itself the same way ───────────────────────
  {
    const small = renderIndex(entries, { limit: 120 });
    const over = Object.entries(small).filter(([, t]) => lineCount(t) > 120);
    assert.deepEqual(over, [], 'the pages by way and topic are cut before their line');
    assert.ok(small['way-agreement-2.md'], 'a busy way goes on in a second page');
    const lines = Object.entries(small).filter(([p]) => /^way-agreement(?:-\d+)?\.md$/.test(p)).map(([, t]) => t).join('\n');
    for (const e of entries) assert.equal(lines.split(`**${e.id}**`).length - 1, 1, `${e.id} is on the way's pages once`);
    assert.ok(small['README.md'].includes('[part 2](way-agreement-2.md)'), 'and the README names every part');
    assert.deepEqual(Object.keys(renderIndex(entries)).filter((p) => /-\d+\.md$/.test(p)), [], 'at the real line, these invented remarks need no second page');
  }
  {
    const ledger = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`dev/f${String(i).padStart(2, '0')}.md`, { blob: 'b', read: '2026-11-04' }]).concat([['ux/a.mjs', { blob: 'c', read: '2026-11-04' }]]));
    const parts = ledgerParts(ledger, 12);
    assert.deepEqual(Object.keys(parts), ['dev.json', 'dev-2.json', 'dev-3.json', 'dev-4.json', 'ux.json'], 'a folder\'s ledger part goes on in dev-2.json and on');
    assert.ok(Object.values(parts).every((e) => lineCount(partText(e)) <= 12), 'each part within its line');
    assert.equal(Object.values(parts).reduce((n, e) => n + Object.keys(e).length, 0), 31, 'every entry kept once');
  }
  {
    const log = join(dir, 'growth.jsonl');
    for (let i = 0; i < 7; i += 1) appendPart(log, [`{"run":${i},"a":1}`, `{"run":${i},"b":2}`], 5);
    const parts = partsOf(log);
    assert.deepEqual(parts.map((p) => p.split('/').pop()), ['growth.jsonl', 'growth-2.jsonl', 'growth-3.jsonl', 'growth-4.jsonl'], 'an appended log begins its next part before the line');
    assert.ok(parts.every((p) => lineCount(readFileSync(p, 'utf8')) - 1 <= 5), 'each part within it');
    assert.equal(parts.map((p) => readFileSync(p, 'utf8')).join('').split('\n').filter(Boolean).length, 14, 'every line kept once, in order');
  }

  // ── 4. The early warning, for what cannot cut itself ───────────────────────
  {
    const files = [
      { path: 'dev/specs/system/dev.md', lines: WARN_LINES },
      { path: 'dev/specs/system/skills.md', lines: WARN_LINES - 1 },
      { path: 'ux/app/styles/components.css', lines: ONE_READ },
      { path: 'dev/ui/lib/git.js', lines: ONE_READ + 1 },
      { path: 'data/core/timeline.md', lines: 950 },
      { path: 'dev/archive/old.md', lines: 950 },
    ];
    assert.deepEqual(nearOneRead(files).map((f) => f.path), ['dev/specs/system/dev.md', 'ux/app/styles/components.css', 'data/core/timeline.md', 'dev/archive/old.md'], 'the warning fires from the warning line to the limit, not before or past it');
    const warned = earlyWarnings ? earlyWarnings(files) : nearOneRead(files.slice(0, 4)).map((f) => `${f.path} is ${f.lines} lines: ${howToSplit(f.path)}`);
    assert.equal(warned.length, 2, `the size check warns on what it counts, never the record or the archive: ${warned.join(' | ')}`);
    assert.ok(warned[0].startsWith('dev/specs/system/dev.md is 900 lines') && warned[0].includes('spec-move.mjs'), 'naming the file, its size, and how to split a register');
    assert.ok(warned[1].includes('components.css') && /stylesheet/.test(warned[1]), 'and how to split a stylesheet');
    assert.ok(/new part/.test(howToSplit('dev/hygiene-log.jsonl')) && /heading/.test(howToSplit('dev/for-you.md')), 'a log and a page each get their own way to split');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('agreement parts test: the Agreements cut into an index, a page per group and an archive, every part within one read, every card once with its ID, words and anchor; a merge of two chats\' new remarks rebuilt into correct parts; the pages by way and topic, the privacy ledger and an appended log cutting themselves the same way; the early warning from 900 lines, naming the file and how to split it (T-768)');
