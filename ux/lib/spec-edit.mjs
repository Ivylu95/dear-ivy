// Reading and changing a spec register.
//
// Called from `scripts/spec-move.mjs`, and kept separate from it so the move is
// a thing that can be read and tested on its own rather than a hundred lines
// inside an argument parser.
//
// A browser edit mode was built on this and then taken out again: the register
// is not changed often enough to be worth a write route into `specs`,
// and a surface that can rewrite a binding document is a cost that has to be
// paid for by use. What is left is the part that was actually hard.
//
// `.mjs` rather than `.js`: a `.js` here would be CommonJS to the script, which
// is a module, and break on the first named import.
//
// ── Why a move is not a row swap ────────────────────────────────────────────
//
// Reordering a register renumbers every row between the old position and the
// new one, and every citation of those rows — in the other specs, the skills,
// this app's own source — then names a different rule than the one it was
// written about.
//
// Nothing catches that. `check-links.mjs` verifies a cited id EXISTS; after a
// renumber every id still exists, so the check passes green while half the
// citations point one row off. That is the failure worth automating away: the
// one that cannot be seen.

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { parseGroups, parseRows } from '../../.claude/hooks/lib/spec-rows.mjs';
import { RECORD_DIRS, SKIP_DIRS } from './walk-skip.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, SPECS_DIR);

// Skipped wholesale when remapping: not authored here, or not text, or the
// record — whose citations are never rewritten. The mapping lives in the commit
// that makes the move, so nothing about the harness is written into data/ (ARC-004).
// `worktrees` holds other sessions' working copies (.claude/worktrees/agent-…); a
// renumber here must never rewrite their files (seen 2026-10-04).
// The folders no walker enters are in lib/walk-skip.mjs, the one list every
// walker reads; the record is skipped at the root only, so the spec group
// dev/specs/data/ is remapped like any other (it was skipped by name until
// 2026-10-06, and its DAT citations were never rewritten).
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
function resolveSpec(relPath) {
  // Two spellings reach this: `dev/specs/X`, rooted at the repository, and a bare
  // `X`. Stripped so both name the same file, and the resolved comparison below
  // still decides.
  const parts = String(relPath ?? '')
    .replace(new RegExp(`^(${SPECS_DIR}|specs)/?`), '')
    .split('/')
    .filter((part) => part && part !== '.');
  if (!parts.length) return null;
  const full = resolve(SPECS, ...parts);
  if (!full.startsWith(resolve(SPECS) + sep)) return null;
  if (extname(full) !== '.md') return null;
  return existsSync(full) ? full : null;
}

/**
 * The register in one spec file: its rows, in file order, with their parts.
 *
 * A row is read by lib/spec-rows.mjs. Its cells (statement, rationale, design)
 * come back without the id, because the id is the row's name and not one of the
 * things an editor may change — renumbering is what moveRow is for.
 */
export function readRegister(relPath) {
  const full = resolveSpec(relPath);
  if (!full) return { ok: false, error: 'no such spec' };

  const rows = parseRows(readFileSync(full, 'utf8')).map((r) => ({
    id: r.id,
    prefix: r.prefix,
    num: r.num,
    line: r.line,
    cells: [r.statement, r.rationale, r.design],
  }));
  if (!rows.length) return { ok: false, error: 'no register rows in that file' };

  const prefixes = [...new Set(rows.map((r) => r.prefix))];
  return { ok: true, path: relPath, rows, prefixes, columns: 3 };
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
    if (SKIP_DIRS.has(name) || (dir === REPO && RECORD_DIRS.has(name)) || name.startsWith('.env')) continue;
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
// Dated history keeps the numbers it was written with: a file named for its
// date, and a backlog line already marked done. On 2026-10-07 a renumber
// rewrote both, and they had to be put back by hand. A citation there names the
// row as it stood that day, which is the record of what happened.
const DATED_FILE = /\d{4}-\d{2}-\d{2}\.md$/;
const DONE_LINE = /^- done \d{4}-\d{2}-\d{2} · /;
// So is a dated row of the hazard log in policies/SAFETY_POLICY.md: on 2026-10-17
// a renumber rewrote four of them and they were put back by hand, as the
// spec-writer's renumber note asks. Only rows inside "## The hazard log".
const HAZARD_ROW = /^\| \d{4}-\d{2}-\d{2} \|/;

function remapCitations({ prefix, map, dryRun = false, skip = [] }) {
  const touched = [];
  const historical = new Set();

  for (const full of walk(REPO)) {
    if (skip.some((s) => full.endsWith(s.split('/').join(sep)))) continue;
    if (DATED_FILE.test(full)) continue;
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const { next, hits, inHistory } = remapText(text, prefix, map);
    if (inHistory) historical.add(full);
    if (!hits) continue;
    if (!dryRun) writeFileSync(full, next);
    touched.push({ path: full.slice(REPO.length + 1).split(sep).join('/'), hits });
  }

  return {
    touched: touched.sort((a, b) => b.hits - a.hits),
    historical: [...historical].map((f) => f.slice(REPO.length + 1).split(sep).join('/')),
  };
}

// One text's citations rewritten by the map: the new text, how many changed,
// and whether one changed inside a dated blockquote.
function remapText(text, prefix, map) {
  // The ID as cited, and its lowercase form as a heading anchor (`#abc-006` for ABC-006),
  // which a parent spec's link carries: a renumber that left one would break it.
  const cite = new RegExp(`\\b(${prefix}|${prefix.toLowerCase()})-(\\d{2,3})\\b(?!··)`, 'g');
  if (!cite.test(text)) return { next: text, hits: 0, inHistory: false };
  let hits = 0;
  let inHistory = false;
  let inHazardLog = false;
  const next = text.split('\n').map((line) => {
    if (/^## /.test(line)) inHazardLog = /^## The hazard log\s*$/.test(line);
    if (DONE_LINE.test(line) || (inHazardLog && HAZARD_ROW.test(line))) return line;
    cite.lastIndex = 0;
    const after = line.replace(cite, (m, p, n) => (map[n] ? (hits++, `${p}-${map[n]}`) : m));
    if (after !== line && /^>\s*\*\*\d{4}-\d{2}-\d{2}/.test(line)) inHistory = true;
    return after;
  });
  return { next: next.join('\n'), hits, inHistory };
}

/**
 * Move a row, and take everything that cites it along.
 *
 * Does not commit. A move is a decision and committing it is another one — and
 * the record write below is not saved until someone does.
 */
// Row groups are read by lib/spec-rows.mjs.

// After a move, each row keeps its group except the moved one, which joins the
// group of the position it lands in; each range is then rebuilt from its rows.
function regroup(text, from, to) {
  const groups = parseGroups(text);
  if (!groups.length) return { ok: true, text };
  const owner = (pos) => groups.findIndex((g) => pos >= g.from && pos <= g.to);
  const total = groups[groups.length - 1].to;
  const order = Array.from({ length: total }, (_, i) => i + 1);
  const target = owner(to);
  order.splice(to - 1, 0, order.splice(from - 1, 1)[0]);
  const members = groups.map(() => []);
  order.forEach((old, n) => members[old === from ? target : owner(old)].push(n + 1));
  if (members.some((m) => !m.length)) return { ok: false, error: 'the move would leave a row group empty; regroup by hand' };
  const lines = text.split(/\r?\n/);
  groups.forEach((g, k) => {
    const pad = (n) => String(n).padStart(3, '0');
    lines[g.line] = `- \`${pad(Math.min(...members[k]))}–${pad(Math.max(...members[k]))}\` · ${g.name}`;
  });
  return { ok: true, text: lines.join('\n') };
}

export function moveRow({ path, id, to, dryRun = false, skip = [] }) {
  const full = resolveSpec(path);
  if (!full) return { ok: false, error: 'no such spec' };

  const register = readRegister(path);
  if (!register.ok) return register;

  const prefix = id.split('-')[0];
  const plan = planMove({ rows: register.rows, prefix, id, to });
  if (!plan.ok) return plan;

  // The register is renumbered, reordered and regrouped in memory before any
  // file is written, so a move regroup refuses leaves every file as it was. It
  // once rewrote every citation first and refused after, and the refused move
  // stayed renumbered everywhere but its own register.
  const lines = remapText(readFileSync(full, 'utf8'), prefix, plan.map).next.split(/\r?\n/);
  const mine = parseRows(lines.join('\n')).filter((r) => r.prefix === prefix);

  // Each row is a block of lines, and the renumbered
  // blocks go back into the same slots in ID order; what lies between rows stays.
  const blocks = mine.map((r) => ({ id: r.id, lines: lines.slice(r.line, r.end + 1) }));
  const sorted = [...blocks].sort((a, b) => a.id.localeCompare(b.id));
  const out = [];
  let at = 0;
  mine.forEach((r, n) => {
    out.push(...lines.slice(at, r.line), ...sorted[n].lines);
    at = r.end + 1;
  });
  out.push(...lines.slice(at));
  const grouped = regroup(out.join('\n'), Number(id.split('-')[1]), Number(plan.target));
  if (!grouped.ok) return grouped;

  const { touched, historical } = remapCitations({ prefix, map: plan.map, dryRun, skip });
  if (!dryRun) writeFileSync(full, grouped.text);

  return { ok: true, ...plan, touched, historical };
}
