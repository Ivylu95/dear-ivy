// DEP-014 design 3: the set-up skill learns from every run, so it has a size
// limit, or it grows without end. Lines bound the folder; words bound what one
// run reads (T-598: live tests failed on rules the skill already held, lost in
// length), so SKILL.md's body and each file beside it have a word limit too.
//
// A word is a run of non-space holding a letter or a digit, so table pipes and
// separators are not words. SKILL.md is counted without its frontmatter: the
// description is the listing's, with its own budget (check-procedures.mjs).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const countWords = (text) => String(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const bodyOf = (text) => text.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');

/**
 * Faults for the set-up folder `dir` against `limits`
 * ({ mainLines, fileLines, folderLines, mainWords, fileWords }, each a number or null).
 * A null limit is not checked (thresholds.mjs: a missing key means do nothing).
 */
export function setUpSizeFaults(dir, limits, shown = '.claude/skills/set-up') {
  const faults = [];
  if (!existsSync(dir)) return faults;
  let total = 0;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const text = readFileSync(join(dir, name), 'utf8');
    const lines = text.split('\n').length - 1;
    total += lines;
    const main = name === 'SKILL.md';
    const lineCap = main ? limits.mainLines : limits.fileLines;
    if (lineCap && lines > lineCap) faults.push(`${shown}/${name}: ${lines} lines, over its limit of ${lineCap}; consolidate before adding (SKILL.md § 6)`);
    const words = countWords(main ? bodyOf(text) : text);
    const wordCap = main ? limits.mainWords : limits.fileWords;
    if (wordCap && words > wordCap) {
      faults.push(`${shown}/${name}: ${words} words${main ? ' in its body' : ''}, over its limit of ${wordCap}; split it by situation or consolidate before adding (SKILL.md § 6)`);
    }
  }
  if (limits.folderLines && total > limits.folderLines) faults.push(`${shown}/: ${total} lines, over its limit of ${limits.folderLines}; consolidate before adding (SKILL.md § 6)`);
  if (limits.routeWords) {
    const { routes, problem } = routeTotals(dir);
    if (problem) faults.push(`${shown}/SKILL.md: ${problem}, so what one run reads cannot be measured (DEP-014)`);
    for (const r of routes) {
      if (r.words > limits.routeWords) faults.push(`${shown}: the ${r.chat} route "${r.route}" reads ${r.words} words (SKILL.md + ${r.files.join(' + ') || 'nothing else'}), over its limit of ${limits.routeWords}; move what only one situation needs into that situation's file (SKILL.md § 6)`);
    }
  }
  return faults;
}

// The files a piece of SKILL.md names: markdown links and backticked names of
// files beside it, SKILL.md itself left out.
const named = (text, present) => [...new Set([...String(text).matchAll(/\]\(([\w.-]+\.md)\)|`([\w.-]+\.md)`/g)].map((m) => m[1] ?? m[2]))].filter((f) => f !== 'SKILL.md' && present.has(f));

/**
 * What one run reads, route by route (DEP-014, T-598). A development route is a
 * row of SKILL.md § 3's table: SKILL.md's body, every file the **The developer**
 * bullet of § 1 names (read by every development run), and every file the row
 * names. A route in her chat is each file the **Her** bullet names, read alone
 * with SKILL.md. Returns { routes: [{ chat, route, files, words }], problem }.
 */
export function routeTotals(dir) {
  const routes = [];
  const skill = join(dir, 'SKILL.md');
  if (!existsSync(skill)) return { routes, problem: 'no SKILL.md' };
  const present = new Set(readdirSync(dir).filter((n) => n.endsWith('.md')));
  const words = new Map([...present].map((n) => [n, countWords(n === 'SKILL.md' ? bodyOf(readFileSync(join(dir, n), 'utf8')) : readFileSync(join(dir, n), 'utf8'))]));
  const body = bodyOf(readFileSync(skill, 'utf8'));
  const lines = body.split('\n');
  const bullet = (label) => lines.find((l) => l.startsWith(`- **${label}**`));
  const dev = bullet('The developer');
  const her = bullet('Her');
  const start = lines.findIndex((l) => /^## 3\b/.test(l));
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && /^## /.test(l));
  const rows = start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end).filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l)).slice(1);
  if (!dev || !her) return { routes, problem: 'no **The developer** or **Her** bullet in § 1' };
  if (!rows.length) return { routes, problem: 'no routing table in § 3' };
  const total = (files) => words.get('SKILL.md') + files.reduce((n, f) => n + words.get(f), 0);
  const always = named(dev, present);
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1);
    const files = [...new Set([...always, ...named(cells.slice(1).join('|'), present)])];
    routes.push({ chat: 'development', route: cells[0].replace(/[*`"]/g, '').trim(), files, words: total(files) });
  }
  for (const f of named(her, present)) routes.push({ chat: 'her', route: f, files: [f], words: total([f]) });
  return { routes, problem: null };
}
