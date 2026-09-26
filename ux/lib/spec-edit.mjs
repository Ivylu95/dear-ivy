// Reading and changing a spec register.
//
// Called from `scripts/spec-move.mjs`, and kept separate from it so the move is
// a thing that can be read and tested on its own rather than a hundred lines
// inside an argument parser.
//
// A browser edit mode was built on this and then taken out again: the register
// is not changed often enough to be worth a write route into `specs`,
// and a surface that can rewrite a binding document is a cost that has to be
// paid for by use. What is left is the part that was actually hard. `editCell`
// stays for the same reason the move does — it is the safe way to replace a
// cell, pipes and line breaks refused rather than escaped, and the next caller
// that needs one should not write a second.
//
// `.mjs` rather than `.js`: a `.js` here would be CommonJS to the script, which
// is a module, and break on the first named import.
//
// ── Why a move is not a row swap ────────────────────────────────────────────
//
// Reordering a register renumbers every row between the old position and the
// new one, and every citation of those rows — in the other specs, the skills,
// the review queue, this app's own source — then names a different rule than
// the one it was written about.
//
// Nothing catches that. `check-links.mjs` verifies a cited id EXISTS; after a
// renumber every id still exists, so the check passes green while half the
// citations point one row off. That is the failure worth automating away: the
// one that cannot be seen.

import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, 'specs');
const RECORD_LOG = join(REPO, 'data', 'state', 'proposals.md');

// Skipped wholesale when remapping: not authored here, or not text, or the
// record — whose citations are never rewritten, only mapped in an appended row.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'temp', '.vercel', 'data', 'samples']);
const TEXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md', '.txt', '.yml', '.yaml']);

/**
 * A spec path from a request, resolved inside `specs` — or null.
 *
 * The same boundary lib/harness.js draws for the read path, drawn tighter: this
 * one also writes, so it admits only markdown and only under the register
 * folder. It compares the RESOLVED path, which covers `..`, an absolute path,
 * and the encoded forms of both — a string check is a list of tricks somebody
 * remembered.
 */
export function resolveSpec(relPath) {
  // Two spellings reach this: `specs/X`, rooted at the repository, and a bare
  // `X`. Stripped so both name the same file, and the resolved comparison below
  // still decides.
  const parts = String(relPath ?? '')
    .replace(/^specs\/?/, '')
    .split('/')
    .filter((part) => part && part !== '.');
  if (!parts.length) return null;
  const full = resolve(SPECS, ...parts);
  if (!full.startsWith(resolve(SPECS) + sep)) return null;
  if (extname(full) !== '.md') return null;
  return existsSync(full) ? full : null;
}

const rowPattern = (prefix) => new RegExp(`^\\|\\s*\\*\\*(${prefix ?? '[A-Z]{3}'}-\\d{2,3})\\*\\*\\s*\\|`);

/**
 * The register in one spec file: its rows, in file order, with their cells.
 *
 * A row is `| **PRE-NNN** | statement | rationale | design |`. The cells come
 * back without the id, because the id is the row's name and not one of the
 * things an editor may change — renumbering is what moveRow is for.
 */
export function readRegister(relPath) {
  const full = resolveSpec(relPath);
  if (!full) return { ok: false, error: 'no such spec' };

  const lines = readFileSync(full, 'utf8').split(/\r?\n/);
  const any = rowPattern();
  const rows = [];
  for (const [line, text] of lines.entries()) {
    const hit = any.exec(text);
    if (!hit) continue;
    const cells = text.split('|');
    const [prefix, num] = hit[1].split('-');
    rows.push({ id: hit[1], prefix, num, line, cells: cells.slice(2, -1).map((c) => c.trim()) });
  }
  if (!rows.length) return { ok: false, error: 'no register rows in that file' };

  const prefixes = [...new Set(rows.map((r) => r.prefix))];
  return { ok: true, path: relPath, rows, prefixes, columns: rows[0].cells.length };
}

/**
 * Replace one cell of one row.
 *
 * A pipe or a newline in the text would end the cell early and silently eat the
 * columns after it, so both are refused rather than escaped: a register row that
 * has to be escaped to survive is a row nobody can diff.
 */
export function editCell({ path, id, column, text }) {
  const full = resolveSpec(path);
  if (!full) return { ok: false, error: 'no such spec' };
  if (typeof text !== 'string') return { ok: false, error: 'no text' };
  if (text.includes('|')) return { ok: false, error: 'a cell cannot contain a pipe' };
  if (/[\r\n]/.test(text)) return { ok: false, error: 'a cell cannot contain a line break' };
  if (!text.trim()) return { ok: false, error: 'a cell cannot be empty' };

  const lines = readFileSync(full, 'utf8').split(/\r?\n/);
  const pattern = rowPattern();
  const index = lines.findIndex((l) => pattern.exec(l)?.[1] === id);
  if (index === -1) return { ok: false, error: `${id} is not in that file` };

  const cells = lines[index].split('|');
  const at = 2 + Number(column);
  if (!(at >= 2 && at < cells.length - 1)) return { ok: false, error: 'no such column' };
  cells[at] = ` ${text.trim()} `;
  lines[index] = cells.join('|');

  writeFileSync(full, lines.join('\n'));
  return { ok: true, id, column: Number(column) };
}

/**
 * Work out what moving one row does to every number in its register.
 *
 * The set of numbers never changes — only which row holds which. Take the moved
 * row out of the order, put it back at the target position, then hand the
 * numbers out down the new order. Pure, so the script can show it before
 * anything is written.
 */
export function planMove({ rows, prefix, id, to }) {
  const mine = rows.filter((r) => r.prefix === prefix);
  const order = mine.map((r) => r.num).sort();
  const from = id.split('-')[1];
  const width = order[0].length;
  const target = String(Number(to)).padStart(width, '0');

  if (!order.includes(from)) return { ok: false, error: `${id} is not in that register` };
  const position = order.indexOf(target);
  if (position === -1) {
    return { ok: false, error: `position ${target} is outside ${prefix}-${order[0]}··${order[order.length - 1]}` };
  }
  if (from === target) return { ok: false, error: `${id} is already at position ${target}` };

  const without = order.filter((n) => n !== from);
  const reordered = [...without.slice(0, position), from, ...without.slice(position)];
  const map = Object.fromEntries(reordered.map((oldN, i) => [oldN, order[i]]).filter(([a, b]) => a !== b));
  return { ok: true, prefix, from, target, map };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.env')) continue;
    const full = join(dir, name);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(full, out);
    else if (TEXT.has(extname(name))) out.push(full);
  }
  return out;
}

/**
 * Rewrite every citation of a renumbered prefix, everywhere but the record.
 *
 * One pass, so nothing collides midway: `003 -> 004` must not then be read as
 * `004 -> 005`. A range like `ARC-001··007` names the register's extent rather
 * than a row and a move never changes it, so the lookahead leaves it alone.
 *
 * Returns the files it touched, and separately any file where an id changed
 * inside a dated blockquote — there an id is often the SUBJECT of a sentence
 * rather than a pointer at a rule, and rewriting it falsifies the record of what
 * happened. That has to be looked at by a person; it cannot be detected.
 */
export function remapCitations({ prefix, map, dryRun = false, skip = [] }) {
  const cite = new RegExp(`\\b${prefix}-(\\d{2,3})\\b(?!··)`, 'g');
  const touched = [];
  const historical = new Set();

  for (const full of walk(REPO)) {
    if (skip.some((s) => full.endsWith(s.split('/').join(sep)))) continue;
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    cite.lastIndex = 0;
    if (!cite.test(text)) continue;

    let hits = 0;
    const next = text.split('\n').map((line) => {
      cite.lastIndex = 0;
      const after = line.replace(cite, (m, n) => (map[n] ? (hits++, `${prefix}-${map[n]}`) : m));
      if (after !== line && /^>\s*\*\*\d{4}-\d{2}-\d{2}/.test(line)) historical.add(full);
      return after;
    });

    if (!hits) continue;
    if (!dryRun) writeFileSync(full, next.join('\n'));
    touched.push({ path: full.slice(REPO.length + 1).split(sep).join('/'), hits });
  }

  return {
    touched: touched.sort((a, b) => b.hits - a.hits),
    historical: [...historical].map((f) => f.slice(REPO.length + 1).split(sep).join('/')),
  };
}

/**
 * Move a row, and take everything that cites it along.
 *
 * Does not commit. A move is a decision and committing it is another one — and
 * the record write below is not saved until someone does.
 */
export function moveRow({ path, id, to, dryRun = false, record = true, skip = [] }) {
  const full = resolveSpec(path);
  if (!full) return { ok: false, error: 'no such spec' };

  const register = readRegister(path);
  if (!register.ok) return register;

  const prefix = id.split('-')[0];
  const plan = planMove({ rows: register.rows, prefix, id, to });
  if (!plan.ok) return plan;

  const { touched, historical } = remapCitations({ prefix, map: plan.map, dryRun, skip });

  if (!dryRun) {
    const lines = readFileSync(full, 'utf8').split(/\r?\n/);
    const pattern = rowPattern(prefix);
    const at = lines.map((l, i) => (pattern.test(l) ? i : -1)).filter((i) => i >= 0);
    const pipes = new Set(at.map((i) => (lines[i].match(/\|/g) || []).length));
    if (pipes.size > 1) return { ok: false, error: `rows have differing column counts (${[...pipes].join(', ')})` };

    const sorted = at.map((i) => lines[i]).sort((a, b) => pattern.exec(a)[1].localeCompare(pattern.exec(b)[1]));
    at.forEach((i, n) => (lines[i] = sorted[n]));
    writeFileSync(full, lines.join('\n'));
  }

  let recorded = false;
  if (!dryRun && record && existsSync(RECORD_LOG)) {
    appendRecordRow({ path, prefix, plan });
    recorded = true;
  }

  return { ok: true, ...plan, touched, historical, recorded };
}

// The record cannot have its citations rewritten — it is append-only — so the
// mapping is appended instead, dated, in the shape the file already uses.
function appendRecordRow({ path, prefix, plan }) {
  const full = resolveSpec(path);
  const moved = readFileSync(full, 'utf8')
    .split('\n')
    .find((l) => rowPattern(prefix).exec(l)?.[1] === `${prefix}-${plan.target}`);
  const statement = moved ? moved.split('|')[2].trim() : '';

  const pairs = Object.entries(plan.map)
    .map(([from, to]) => `\`${prefix}-${from}\` is now \`${prefix}-${to}\``)
    .join(', ');

  const row =
    `| ${new Date().toISOString().slice(0, 10)} | spec reorder | ` +
    `**Some \`${prefix}-NNN\` cited in the rows above have moved.** ` +
    `*${statement}* was moved to \`${prefix}-${plan.target}\`, and the rows it displaced shifted by one: ${pairs}. ` +
    `Nothing else moved. Citations in the rows above were left as written, because this file is append-only; ` +
    `this row is the mapping. |`;

  const existing = readFileSync(RECORD_LOG, 'utf8');
  appendFileSync(RECORD_LOG, (existing.endsWith('\n') ? '' : '\n') + row + '\n');
}
