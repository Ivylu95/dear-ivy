// SFG-002 / MNT-008: the 🔒 prohibition, drifted.
//
// SFG-002 is the one this enforces — "a rule enforced by machinery is
// distinguishable from one enforced by instruction". The prohibition at the top
// of every spec file is instruction, and will stay instruction: no script can
// stop a model reading it and deciding this edit is the harmless one. What a
// script CAN do is prove the instruction is present, identical and pointing at
// the right file in all of them — which is the half SFG-002's own design column
// calls partial enforcement, named as such rather than mistaken for the whole.
//
//   node scripts/check-spec-banner.mjs          report, exit 1 on any mismatch
//   node scripts/check-spec-banner.mjs --fix    rewrite every drifted banner
//
// ── Why this exists, specifically ───────────────────────────────────────────
//
// specs/README.md § Anatomy of a Spec File makes the banner part 3 of
// seven, required always, and says why it is repeated rather than inherited
// from the index: "the moment it matters is the moment nobody is reading the
// index." That reasoning is sound and this script does not argue with it. It
// addresses the cost the reasoning accepts — one string, kept by hand, in every
// file in the folder.
//
// The cost has already been paid twice. `.claude/FOR_REVIEW.md` was renamed to
// `REVIEW.md` and twenty-seven files had to be hand-edited in that change; the
// row recording it is the last one in data/state/proposals.md. And
// ARCHITECTURE.md still routes its findings to README.md — a file that exists,
// holds no findings section, and has never been where a deviation goes.
//
// ── What check-links.mjs cannot see ─────────────────────────────────────────
//
// That last one is the case for a second script. check-links.mjs proves every
// pointer RESOLVES; it cannot prove a pointer is CORRECT. `README.md` resolves.
// A link check has no opinion about which file a finding belongs in, because it
// has no idea what the sentence around the link is for. This script does: it
// knows the whole sentence, so a right-looking link to the wrong file fails.
//
// ── The three variants ──────────────────────────────────────────────────────
//
//   folder       A README.md inside specs/, at any depth. Governs the
//                files beside it, so it says "this folder" and "these files".
//   references   REFERENCES.md. Not a register — nothing in it binds — so it
//                drops the compliance clause and adds its own three examples of
//                what wrong looks like, plus the rule that adding a row counts.
//   file         Every other spec file.
//
// Three is not tidiness that got away: a folder-level file saying "this file"
// would be read as covering only itself, which is the one thing it does not do.
//
// ── What --fix will and will not do ─────────────────────────────────────────
//
// It REPLACES a banner that is present and wrong. It never INSERTS one that is
// absent, and it never touches a file that has no banner at all — replacing a
// drifted string is mechanical, while writing the third part of the anatomy
// into a file that lacks it is authoring specification, and the human approval
// gate in specs/README.md § The rules covers that. A missing banner therefore
// stays a failure until a person writes one.
//
// Note what this script is, honestly: it edits files the agent may not edit.
// The boundary it respects is that a PERSON runs it — the same standing
// scripts/spec-move.mjs already has, which renumbers rows inside a register.
// Whether a script run from a terminal is a route around a prohibition aimed at
// the agent is a real question, and it is raised in .claude/REVIEW.md rather
// than answered here.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const specsDir = join(repoRoot, 'specs');

// Where a finding about a SPEC FILE goes — which is not always the same queue.
// specs/REVIEW.md sets the rule it is itself the result of: "an entry
// lives where its fix lands. A finding whose fix is a change inside
// specs/ belongs here; a finding whose fix is a change anywhere else in
// the repository belongs in ../REVIEW.md." A banner is about the file carrying
// it, so its findings always land inside the folder, and always belong to the
// specs queue where one exists.
//
// Resolved rather than hardcoded, so this works either side of that split: the
// first run of this script wrote ../REVIEW.md into ARCHITECTURE.md hours before
// the split existed, and hardcoding is exactly how it got that wrong.
const specsReview = join(specsDir, 'REVIEW.md');
const reviewFile = existsSync(specsReview) ? specsReview : join(repoRoot, '.claude', 'REVIEW.md');

// The queue itself never carries the prohibition. It is written by the agent —
// that is its entire purpose, and the banner exists to send findings TO it — so
// a file telling an agent it may not be edited would contradict the sentence
// pointing at it. Any REVIEW.md under the folder is the destination, not a spec.
const isQueue = (file) => basename(file) === 'REVIEW.md';

const fix = process.argv.includes('--fix');

// The canonical text of each variant, with the link target left open. These
// strings ARE the wording of the banner — specs/README.md row 3 describes it in
// prose and deliberately does not quote it, so this is the only place the exact
// sentence lives. Changing a word here changes every spec file, which is the
// point, and is also why that row is a human gate rather than a script.
const TEMPLATES = {
  file:
    '> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, ' +
    'rewording, reformatting, renaming and moving included, and admits no exception for a change ' +
    'the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable, ' +
    'it records the finding in [`REVIEW.md`](%LINK%) with its reasoning and leaves the entry for a ' +
    'person to clear, never treating its own entry as settled. Until a person applies a change, ' +
    'this file is complied with as written; where it and the repository diverge, the repository ' +
    'is wrong.',

  folder:
    '> 🔒 **An agent may not edit this folder.** The prohibition covers every file in it except ' +
    '`REVIEW.md`, which is the review queue and not a spec, and ' +
    'extends to any alteration — rewording, reformatting, renaming and moving included — ' +
    'admitting no exception for a change the agent judges harmless. Where an agent finds anything ' +
    'wrong, inconsistent or improvable, it records the finding in [`REVIEW.md`](%LINK%) with its ' +
    'reasoning and leaves the entry for a person to clear, never treating its own entry as ' +
    'settled. Until a person applies a change, these files are complied with as written; where ' +
    'they and the repository diverge, the repository is wrong.',

  references:
    '> 🔒 **An agent may not edit this file.** The prohibition extends to any alteration of it, ' +
    'rewording, reformatting, renaming and moving included, and admits no exception for a change ' +
    'the agent judges harmless. Where an agent finds anything wrong, inconsistent or improvable — ' +
    'a dead link, a claim the source no longer supports, a limit that was written too generously — ' +
    'it records the finding in [`REVIEW.md`](%LINK%) with its reasoning and leaves the entry for a ' +
    'person to clear. Adding a row is an edit like any other.',
};

const BANNER = /^>\s*🔒/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

function variantOf(file) {
  if (basename(file) === 'README.md') return 'folder';
  if (basename(file) === 'REFERENCES.md') return 'references';
  return 'file';
}

// Written from the citing file's own directory, so a file that changes depth
// gets a different string — which is the half of this a rename gets wrong.
const linkTo = (file) => relative(dirname(file), reviewFile).split(/[\\/]/).join('/');

const expectedFor = (file) => TEMPLATES[variantOf(file)].replace('%LINK%', linkTo(file));

// The banner sits between the H1 and the first `##`, which is where parts 1-3
// of the anatomy are. That is line 5 in most files and line 7 in
// specs/README.md, whose lede runs to two sentences — so position is checked by
// what surrounds it, never by counting lines.
function positionOf(lines, at) {
  let h1 = -1;
  let h2 = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (h1 < 0 && lines[i].startsWith('# ')) h1 = i;
    if (h2 === lines.length && lines[i].startsWith('## ')) h2 = i;
  }
  if (h1 < 0) return 'no heading above it';
  if (at < h1) return 'above the heading';
  if (at > h2) return 'below the first section';
  return 'ok';
}

const linkIn = (line) => (/\]\(([^)]*)\)/.exec(line) ?? [, '(no link)'])[1];

const findings = [];
const fixed = [];
const files = walk(specsDir).filter((f) => !isQueue(f));

for (const abs of files) {
  const rel = relative(repoRoot, abs).split(/[\\/]/).join('/');
  const raw = readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);

  const found = lines.filter((l) => BANNER.test(l)).length;

  if (found === 0) {
    findings.push({
      rel,
      what:
        raw.trim() === ''
          ? 'is empty — no banner, and no file to put one in'
          : 'carries no 🔒 banner',
    });
    continue;
  }

  if (found > 1) {
    findings.push({ rel, what: `carries ${found} 🔒 banners` });
    continue;
  }

  const at = lines.findIndex((l) => BANNER.test(l));
  const place = positionOf(lines, at);
  if (place !== 'ok') findings.push({ rel, what: `has its banner ${place}` });

  const want = expectedFor(abs);
  const got = lines[at];
  if (got === want) continue;

  // Report the most actionable difference. A wrong link is one token to change
  // and is nearly always a move or a rename; a wrong sentence is a reword and
  // wants a person to read both. Telling them apart is the difference between
  // a finding someone fixes and a diff someone skims.
  // The whole link goes, label included. A banner naming `README.md` in both
  // halves is not a reworded sentence, it is a finding routed to the wrong
  // file — and saying so is the difference between a one-token fix and a
  // sentence someone has to diff by eye.
  const strip = (s) => s.replace(/\[`[^`]*`\]\([^)]*\)/, '⟨link⟩');
  const linkOnly = strip(got) === strip(want);
  const what = linkOnly
    ? `sends findings to ${linkIn(got)}, not ${linkTo(abs)}`
    : `is worded differently from the ${variantOf(abs)} variant`;

  if (fix) {
    lines[at] = want;
    writeFileSync(abs, lines.join(eol));
    fixed.push({ rel, what });
  } else {
    findings.push({ rel, what });
  }
}

if (fixed.length > 0) {
  console.log(`\n  BANNER FIXED — ${fixed.length} file${fixed.length === 1 ? '' : 's'} rewritten\n`);
  for (const f of fixed) console.log(`  - ${f.rel} ${f.what}`);
  console.log('');
}

if (findings.length > 0) {
  console.error('\n  SPEC BANNER CHECK FAILED\n');
  for (const f of findings) console.error(`  - ${f.rel} ${f.what}`);
  console.error('\n  Every file under specs/ carries the 🔒 prohibition — part 3 of the');
  console.error('  seven in specs/README.md, stated in each file because the moment it matters');
  console.error('  is the moment nobody is reading the index. A drifted one sends a finding');
  console.error('  somewhere nobody looks. See SFG-002 in specs/system/ARCHITECTURE.md.\n');
  console.error('  --fix rewrites a banner that is present and wrong. It will not write one');
  console.error('  into a file that has none: that is authoring specification, and the human');
  console.error('  gate in specs/README.md covers it.\n');
  process.exit(1);
}

console.log(`spec banner check: ${files.length} spec files, every 🔒 banner canonical`);
