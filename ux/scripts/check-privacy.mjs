// ARC-003: everything personal lives in one folder at the root.
//
//   node scripts/check-privacy.mjs       (runs as part of `npm run build`)
//
// The spec does not merely state this rule, it asks for this exact program:
// "A grep for personal content outside the record folder is the one privacy
// control that automates completely — build it, because review won't catch a
// leak on the hundredth file."
//
// It is now the hundredth file. The dashboard added around sixty of them.
//
// ── What it can and cannot do ───────────────────────────────────────────────
//
// It cannot know what "personal" means in general. It checks the two leaks that
// actually happen, both mechanical:
//
//   NAMES     Every person with a file in data/people/ has their name checked
//             against every harness file. This is how a name reaches a code
//             comment, a test fixture, or a commit message.
//   COPIES    Any long line that appears verbatim in both data/ and a harness
//             file. This is how a quote reaches a sample, a screenshot caption,
//             or a doc "example".
//
// A clean run is not proof of privacy. A dirty run is proof of a leak, which is
// the direction that matters — and it is the half that review reliably misses.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { isLegacyProfile, parseProfile } from '../../.claude/hooks/lib/profile-schema.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const dataDir = join(repoRoot, 'data');

// Skipped wholesale: not authored here, or not text.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'temp', '.vercel', 'data', 'data-sandbox']);
const TEXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.svg']);

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

// data/ is in SKIP_DIRS above, so the record needs its own walker rather than a
// flag threaded through the one that deliberately avoids it.
function walkData(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) walkData(full, out);
    else if (TEXT.has(extname(name))) out.push(full);
  }
  return out;
}

if (!existsSync(dataDir)) {
  console.log('privacy check: no data/ directory — nothing to leak.');
  process.exit(0);
}

const harnessFiles = walk(repoRoot);
const findings = [];

// ── Names ───────────────────────────────────────────────────────────────────
//
// Two sources: the filenames in data/people/, which are firstname.md by
// convention, and HER OWN name from data/profile.yaml.
//
// Her name used to be excluded here, because it was the project's own name — in
// the repository name, the app title, the env vars and this very file. That
// exclusion was the one hole in this check and it is now closed: the name lives
// in the record and nowhere else, so the check can hold it to the same standard
// as everyone else's. If this starts failing, the leak is real.
const peopleDir = join(dataDir, 'people');
const fromPeople = existsSync(peopleDir)
  ? readdirSync(peopleDir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => f.replace(/\.md$/, '').toLowerCase())
  : [];

// Read with the parser every other reader uses (.claude/hooks/lib/profile-schema.mjs), rather than
// a regex: a hand-rolled "name:" match would read a commented-out line, and this
// check is only worth having if it cannot be fooled by the file it is checking.
// A name is taken even from a profile that fails its other rules, and from one
// still in the old flat shape: a broken file is no reason to stop looking for a
// leak.
function configName(text) {
  let value;
  if (isLegacyProfile(text)) {
    try {
      value = parseYaml(text)?.name;
    } catch {
      return '';
    }
  } else {
    value = parseProfile(text).data?.mandatory?.name?.value;
  }
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

const configPath = join(dataDir, 'profile.yaml');
const ownName = existsSync(configPath) ? configName(readFileSync(configPath, 'utf8')) : '';

const names = [...new Set([...fromPeople, ownName])].filter((n) => n && n.length > 2);

for (const file of harnessFiles) {
  const text = readFileSync(file, 'utf8').toLowerCase();
  for (const name of names) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      findings.push(`${relative(repoRoot, file)} names "${name}", who is named in the record`);
    }
  }
}

// ── Copies ──────────────────────────────────────────────────────────────────
//
// Long lines are the signal. Short ones collide by coincidence — every markdown
// file in the repo contains "## Right now" — and a check that reports
// coincidences is a check nobody runs twice.
const MIN_COPY = 60;

const dataLines = new Set();
for (const file of walkData(dataDir)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    // Structure is shared by design: headings, table rows, list markers and the
    // templates' own italic guidance all legitimately appear on both sides.
    if (trimmed.length < MIN_COPY) continue;
    if (/^[#>|\-*_]/.test(trimmed)) continue;
    dataLines.add(trimmed);
  }
}

// Templates are exempt from the COPY check, and only from that one.
//
// A template is a blank shape copied into data/ when a new file is needed, so
// its text appearing on both sides is the mechanism working, not a leak — the
// first run of this check flagged three of them, all correct sightings of the
// intended direction.
//
// They are NOT exempt from the name check above. A template is supposed to be
// empty of content but it is still a file someone edits, and a name written into
// one would be copied into every future record file made from it. That is the
// leak worth catching here, and the copy exemption does not cover it.
const isTemplate = (file) => relative(repoRoot, file).replace(/\\/g, '/').includes('/templates/');

for (const file of harnessFiles) {
  if (isTemplate(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length >= MIN_COPY && dataLines.has(trimmed)) {
      findings.push(`${relative(repoRoot, file)} repeats a line verbatim from data/: "${trimmed.slice(0, 70)}…"`);
    }
  }
}

if (findings.length > 0) {
  console.error('\n  PRIVACY CHECK FAILED\n');
  for (const f of new Set(findings)) console.error(`  - ${f}`);
  console.error('\n  Everything personal lives in data/ and nowhere else. See ARC-003 in');
  console.error('  specs/system/ARCHITECTURE.md.\n');
  process.exit(1);
}

console.log(
  `privacy check: ${harnessFiles.length} harness files clean ` +
    `(${names.length} name${names.length === 1 ? '' : 's'} on file, ${dataLines.size} record lines compared)`,
);
