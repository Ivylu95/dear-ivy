#!/usr/bin/env node
// Every piece of machinery is claimed by a row that says why it exists.
//
// FND-008. check-spec-paths holds one direction: a path a design column names
// exists. This holds the other: every file in the machinery folders is named by
// some row's design column, by its path, by a folder above it, by its bare
// file name, or, for a skill or command, by its name (`spec-writer`, `/dev-mode`). A file no row names has no stated reason, and no later session can
// judge whether it still serves one.
//
// Files unclaimed when this check was written are listed in
// check-claimed.known.txt, so the debt is recorded rather than blocking every
// commit; a new unclaimed file fails, and a listed one now claimed should leave
// the list. It reads the registers, so it is development tooling (ARC-008): a
// copy without the design has nothing to check.
//
// Run from ux/: node scripts/check-claimed.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS_DIR, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { designPaths, designTokens } from './design-paths.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const knownFile = join(dirname(fileURLToPath(import.meta.url)), 'check-claimed.known.txt');

if (!existsSync(join(root, SPECS_DIR))) {
  console.log(`claimed check: no ${SPECS_DIR}/ in this copy (ARC-008), nothing to check`);
  process.exit(0);
}

// The machinery: what runs, or tells the agent how to run.
const MACHINERY = ['.claude/hooks', '.claude/skills', '.claude/commands', 'ux/scripts', SKILLS_DIR];
// Exempt, with the reason each is not machinery of its own:
//   README.md     a folder's index; the folder rows (FND-001, FND-002) claim it
//   package*.json a tool's dependency manifest, claimed with the tool it serves
//   *.known.txt   a check's own list of what it already knows, claimed with the check
//   *.allow.txt
//   test-*.mjs    a rule test, claimed with the hook or script it tests
//   evals.json, evals-results.json in a skill's folder: its firing and scenario
//                 tests and their recorded run, claimed with the skill they test,
//                 as the skill-tests row names them (`dev/skills/<name>/evals.json`)
const EXEMPT = (file) =>
  /(^|\/)README\.md$/.test(file) || /(^|\/)package(-lock)?\.json$/.test(file) || /\.(known|allow)\.txt$/.test(file) || /(^|\/)test-[^/]+\.mjs$/.test(file) || /^(?:\.claude|dev)\/skills\/[^/]+\/evals(-results)?\.json$/.test(file);
const SKIP_DIRS = new Set(['node_modules', 'state']);

const files = [];
for (const top of MACHINERY) {
  for (const full of walkFiles(join(root, top), { names: SKIP_DIRS })) {
    const rel = relative(root, full).replace(/\\/g, '/');
    if (!EXEMPT(rel)) files.push(rel);
  }
}

// A claim naming a whole machinery folder, or a bare one-word folder, would
// claim everything at once and prove nothing; those are not counted.
const tooBroad = (c) => !c.includes('/') || MACHINERY.some((m) => m === c || m.startsWith(`${c}/`));
const claims = designPaths(root).map(({ path }) => path.replace(/\/$/, ''));
const byName = new Set(claims.filter((c) => !c.includes('/')));
const byPath = claims.filter((c) => c.includes('/') && !tooBroad(c));

// A skill is named by its folder and a command by its file, so a bare
// `spec-writer` or `/dev-mode` claims it.
const procedures = new Set(designTokens(root).map(({ token }) => token.replace(/^\//, '')).filter((t) => /^[a-z][\w-]*$/.test(t)));
// A module's skills are procedures too (modules/<module>/skills/<name>/, each listed in its
// module.json): their dev folders hold the same tests and logs as a core skill's (2026-11-02,
// the training, log and appointment tests were refused as unclaimed).
// The same for a core skill (.claude/skills/<name>/): a skill folder is itself the procedure
// (2026-11-02, something-happened's tests were refused because no design column happened to name it).
for (const name of existsSync(join(root, '.claude', 'skills')) ? readdirSync(join(root, '.claude', 'skills')) : []) {
  if (statSync(join(root, '.claude', 'skills', name)).isDirectory()) procedures.add(name);
}
if (existsSync(join(root, 'modules'))) for (const mod of readdirSync(join(root, 'modules'))) {
  const dir = join(root, 'modules', mod, 'skills');
  if (existsSync(dir)) for (const name of readdirSync(dir)) if (statSync(join(dir, name)).isDirectory()) procedures.add(name);
}
const procedureOf = (file) => file.match(/^(?:\.claude|dev)\/skills\/([^/]+)\//)?.[1] ?? file.match(/^\.claude\/commands\/([^/]+)\.md$/)?.[1];

const claimed = (file) =>
  procedures.has(procedureOf(file)) ||
  byName.has(basename(file)) ||
  byPath.some((c) => file === c || file.endsWith(`/${c}`) || file.startsWith(`${c}/`) || file.includes(`/${c}/`));

const unclaimed = files.filter((f) => !claimed(f)).sort();
const known = new Set(
  existsSync(knownFile) ? readFileSync(knownFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [],
);
for (const k of [...known].filter((k) => !unclaimed.includes(k))) console.log(`  claimed now, remove from check-claimed.known.txt: ${k}`);
const fresh = unclaimed.filter((f) => !known.has(f));
if (fresh.length) {
  console.log('CLAIMED CHECK FAILED\n');
  for (const f of fresh) console.log(`  - ${f} is named by no row's design column`);
  console.log('\n  Every piece of machinery is claimed by a row that says why it exists (FND-008).');
  console.log('  Name it in the design column of the row it carries out, or put that row to the developer.');
  process.exit(1);
}
console.log(`claimed check: ${files.length} machinery files, each named by a row (${known.size} known unclaimed, listed in check-claimed.known.txt)`);
