// Moving a row inside a spec register, and taking every citation with it.
//
//   node scripts/spec-move.mjs ARC-006 004               move to position 4
//   node scripts/spec-move.mjs ARC-006 004 --dry         show the mapping only
//
// The work is in `lib/spec-edit.mjs`, shared with the dashboard's edit mode.
// This file is the terminal's way in: it finds which register defines the id,
// prints the mapping before anything happens, and says what it touched. A
// renumber done two ways is a renumber done two ways wrong.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { parseRows } from '../../.claude/hooks/lib/spec-rows.mjs';
import { moveRow, planMove, readRegister } from '../lib/spec-edit.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, SPECS_DIR);
const SELF = 'scripts/spec-move.mjs';

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const [rawId, rawTo] = args.filter((a) => !a.startsWith('--'));

if (!rawId || !rawTo) {
  fail('usage: node scripts/spec-move.mjs <ID> <position> [--dry]');
}

const id = rawId.toUpperCase();
if (!/^[A-Z]{3}-\d{2,3}$/.test(id)) fail(`"${rawId}" is not a spec id`);
if (!/^\d+$/.test(rawTo)) fail(`"${rawTo}" is not a position`);
const prefix = id.split('-')[0];

// ── Which register defines it ───────────────────────────────────────────────

const markdown = (dir) => walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') });

if (!existsSync(SPECS)) fail('no specs in this repository');

const owners = markdown(SPECS).filter((f) => parseRows(readFileSync(f, 'utf8')).some((r) => r.prefix === prefix));
if (!owners.length) fail(`no register under specs defines ${prefix} rows`);
if (owners.length > 1) {
  fail(`${prefix} rows appear in more than one file:\n    ` + owners.map((f) => relative(REPO, f)).join('\n    '));
}

const specPath = relative(REPO, owners[0]).split(sep).join('/');

// ── The mapping, before anything moves ──────────────────────────────────────

const register = readRegister(specPath);
if (!register.ok) fail(register.error);

const plan = planMove({ rows: register.rows, prefix, id, to: rawTo });
if (!plan.ok) fail(plan.error);

console.log(`\n  ${specPath}  —  ${id} to position ${plan.target}\n`);
console.log('  mapping');
for (const [from, to] of Object.entries(plan.map)) console.log(`    ${prefix}-${from}  ->  ${prefix}-${to}`);

// ── Move ────────────────────────────────────────────────────────────────────
//
// This file is skipped: the usage lines above name real ids so they can be
// copied, and renumbering them would leave the instructions describing a move
// nobody asked for.
const result = moveRow({ path: specPath, id, to: rawTo, dryRun: dry, skip: [SELF] });
if (!result.ok) fail(result.error);

console.log(`\n  ${dry ? 'would rewrite' : 'rewrote'} ${result.touched.length} file${result.touched.length === 1 ? '' : 's'}`);
result.touched.forEach((t) => console.log(`  ${String(t.hits).padStart(4)}  ${t.path}`));

if (result.historical.length) {
  console.log('\n  ids changed inside a dated note — check these are pointers, not history:');
  result.historical.forEach((f) => console.log('    ' + f));
}

if (dry) {
  console.log('\n  --dry: nothing was written.\n');
} else {
  const pairs = Object.entries(result.map).map(([from, to]) => `${prefix}-${from} → ${prefix}-${to}`).join(', ');
  console.log(`\n  ${specPath} reordered: ${pairs}.`);
  // The renumbered rows' words, regenerated for the reply check (WKB-007), so a
  // row is not cited under its old number until the gate's --check catches it.
  const statements = spawnSync(process.execPath, [join(REPO, 'ux', 'scripts', 'spec-statements.mjs')], { cwd: REPO, encoding: 'utf8' });
  console.log(`  ${(statements.stdout || statements.stderr).trim()}`);
  console.log('  Put that mapping in the commit body: it is the only record of the move.');
  console.log('  Run `npm run check`, then commit — nothing here is saved until you do.\n');
}
