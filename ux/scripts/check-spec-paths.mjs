#!/usr/bin/env node
// Every path a spec row's design column names exists.
//
// WKB-007, "Every change the developer asks for runs from spec to enforcement in
// one flow.": a row's design column is what gets built, so a path it names that
// is not in the repository is a design nobody built, or a file moved without its
// row. Where the two diverge the repository is wrong (dev/specs/README.md), so this
// reports the row; the fix is to build or restore the file, or to put a reworded
// row to the developer.
//
// What counts as a path is design-paths.mjs's, shared with check-claimed. Rows
// broken before this check are listed in check-spec-paths.known.txt; a new
// break fails, and a listed one that resolves should leave the list.
//
// Run from ux/: node scripts/check-spec-paths.mjs

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { designPaths } from './design-paths.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const knownFile = join(dirname(fileURLToPath(import.meta.url)), 'check-spec-paths.known.txt');
const known = new Set(
  existsSync(knownFile) ? readFileSync(knownFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [],
);

// ARC-008: a copy given away runs without the design, and has no rows to check.
if (!existsSync(join(root, SPECS_DIR))) {
  console.log('spec path check: no dev/specs/ in this copy (ARC-008), nothing to check');
  process.exit(0);
}

// A bare file name (no slash) is matched by name anywhere in the repository; a
// one-word folder (`claude/`) is as often a branch prefix as a folder, so it is
// left alone, as are slash commands (`/compact`).
// Read from disk, not git: the commit gate runs this in a copy with no .git.
const tracked = new Set();
(function names(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'data', 'temp'].includes(e.name)) continue;
    if (e.isDirectory()) names(join(dir, e.name));
    else tracked.add(e.name);
  }
})(root);

const broken = [];
for (const { id, file, path } of designPaths(root)) {
  if (/^[^/]+\/$/.test(path)) continue;
  if (!path.includes('/') && tracked.has(path)) continue;
  if (existsSync(join(root, path)) || existsSync(join(dirname(file), path))) continue;
  broken.push(`${id} ${path}`);
}

const fresh = broken.filter((b) => !known.has(b));
const healed = [...known].filter((k) => !broken.includes(k));
for (const h of healed) console.log(`  resolved now, remove from the known list: ${h}`);
if (fresh.length) {
  console.log('SPEC PATH CHECK FAILED\n');
  for (const b of fresh) console.log(`  - ${b.replace(' ', ' names ')}, which does not exist`);
  console.log('\n  A design column is what gets built (WKB-007). Build or restore the file, or put a reworded row to the developer.');
  process.exit(1);
}
console.log(`spec path check: every path in a design column resolves (${known.size} known, listed in check-spec-paths.known.txt)`);
