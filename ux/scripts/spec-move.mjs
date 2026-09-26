// Moving a row inside a spec register, and taking every citation with it.
//
//   node scripts/spec-move.mjs ARC-006 004               move to position 4
//   node scripts/spec-move.mjs ARC-006 004 --dry         show the mapping only
//   node scripts/spec-move.mjs ARC-006 004 --no-record   move, leave the record alone
//
// The work is in `lib/spec-edit.mjs`, shared with the dashboard's edit mode.
// This file is the terminal's way in: it finds which register defines the id,
// prints the mapping before anything happens, and says what it touched. A
// renumber done two ways is a renumber done two ways wrong.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moveRow, planMove, readRegister } from '../lib/spec-edit.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, 'specs');
const SELF = 'scripts/spec-move.mjs';

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const record = !args.includes('--no-record');
const [rawId, rawTo] = args.filter((a) => !a.startsWith('--'));

if (!rawId || !rawTo) {
  fail('usage: node scripts/spec-move.mjs <ID> <position> [--dry] [--no-record]');
}

const id = rawId.toUpperCase();
if (!/^[A-Z]{3}-\d{2,3}$/.test(id)) fail(`"${rawId}" is not a spec id`);
if (!/^\d+$/.test(rawTo)) fail(`"${rawTo}" is not a position`);
const prefix = id.split('-')[0];

// ── Which register defines it ───────────────────────────────────────────────

function markdown(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) markdown(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

if (!existsSync(SPECS)) fail('no specs in this repository');

const defines = new RegExp(`^\\|\\s*\\*\\*${prefix}-\\d{2,3}\\*\\*\\s*\\|`, 'm');
const owners = markdown(SPECS).filter((f) => defines.test(readFileSync(f, 'utf8')));
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
const result = moveRow({ path: specPath, id, to: rawTo, dryRun: dry, record, skip: [SELF] });
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
  const where = result.recorded ? ', and the mapping appended to the record' : ', and nothing written to the record';
  console.log(`\n  ${specPath} reordered${where}.`);
  console.log('  Run `npm run check`, then commit — nothing here is saved until you do.\n');
}
