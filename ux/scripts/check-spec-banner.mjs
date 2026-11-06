// SFG-002 / MNT-008: the 🔒 prohibition, drifted.
//
// SFG-002 is the one this enforces — "a rule enforced by machinery is
// distinguishable from one enforced by instruction". The prohibition at the top
// of every spec file is instruction, and will stay instruction: no script can
// stop a model reading it and deciding this edit is the harmless one. What a
// script CAN do is prove the instruction is present and identical in all of
// them — which is the half SFG-002's own design column
// calls partial enforcement, named as such rather than mistaken for the whole.
//
//   node scripts/check-spec-banner.mjs          report, exit 1 on any mismatch
//   node scripts/check-spec-banner.mjs --fix    rewrite every drifted banner
//
// ── Why this exists, specifically ───────────────────────────────────────────
//
// dev/specs/README.md § Anatomy of a Spec File makes the banner part 3 of
// seven, required always, and says why it is repeated rather than inherited
// from the index: "the moment it matters is the moment nobody is reading the
// index." That reasoning is sound and this script does not argue with it. It
// addresses the cost the reasoning accepts — one string, kept by hand, in every
// file in the folder.
//
// The cost has already been paid more than once: every rename of the place
// findings went to meant hand-editing every file in the folder. Since
// 2026-09-27 the banner names no file at all, and says to raise a finding with
// the developer.
//
// ── The three variants ──────────────────────────────────────────────────────
//
//   folder       A README.md inside dev/specs/, at any depth.
//   references   REFERENCES.md.
//   file         Every other spec file.
//
// Until 2026-10-19 the three were worded differently, each telling an agent to
// edit only on a person's instruction. Since the switch to dialogue-driven
// development all three carry the same approved words; the names stay so a
// future wording can separate them again without a rewrite of this script.
//
// ── What --fix will and will not do ─────────────────────────────────────────
//
// It REPLACES a banner that is present and wrong. It never INSERTS one that is
// absent, and it never touches a file that has no banner at all — replacing a
// drifted string is mechanical, while writing the third part of the anatomy
// into a file that lacks it is authoring specification, and the human approval
// gate in dev/specs/README.md § The rules covers that. A missing banner therefore
// stays a failure until a person writes one.
//
// Note what this script is, honestly: it edits spec files. Under the rule in
// full (dev/specs/README.md § The rules) agents keep the specs for the
// Agreements, but a change to the banner's wording is an edit to that rule, so
// it waits for the owner's yes to the exact words; a --fix that only restores
// the approved wording does not. Two of the files it would rewrite are in the
// safety core: --fix never writes there, and the check accepts their previous
// banner until the developer's unlock (MNT-006).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const specsDir = join(repoRoot, SPECS_DIR);

const fix = process.argv.includes('--fix');

// The canonical text of each variant: one line, and a link to the rule in full,
// which lives once under The rules in dev/specs/README.md (FND-005). These
// strings ARE the wording of the banner; changing a word here changes every
// spec file, which is the point, and is also why it is a human gate rather than
// a script. `link` is the path from the file to that heading.
// Since 2026-10-19 (the switch to dialogue-driven development, Transcript
// T-029/T-030) every variant carries the same approved words: the specs are
// kept by agents for the Agreements, and the rule in full says which edits
// still wait for the owner. The three variants are kept as names so a future
// wording can tell them apart again.
const WORDING = (link) =>
  `> 🔒 **Kept by agents for the Agreements; some edits wait for the owner's yes.** Which ones, and why — [the full rule](${link}).`;

const TEMPLATES = {
  file: WORDING,
  folder: WORDING,
  references: WORDING,
};

// The two spec files in the safety core keep the banner they had until the
// developer's own unlock (MNT-006): no agent may rewrite them, so for exactly
// those two files, and no other, the previous file-variant wording is also
// accepted. When the core is unlocked and they are brought up to date, this
// allowance becomes dead and should be removed with them.
const LOCKED_PREVIOUS = (link) =>
  `> 🔒 **Edit only on a person’s explicit instruction, quoted in the commit.** Found something wrong? Raise it, don’t fix it — [the full rule](${link}).`;

const BANNER = /^>\s*🔒/;
const LOCKED = new Set(['dev/specs/interaction/safety.md', 'dev/specs/ux/tabs/safety.md']);

function walk(dir) {
  if (!existsSync(dir)) throw new Error(`no specs at ${dir}`);
  return walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') });
}

function variantOf(file) {
  if (basename(file) === 'README.md') return 'folder';
  if (basename(file) === 'REFERENCES.md') return 'references';
  return 'file';
}

const linkFor = (file) => {
  const home = join(specsDir, 'README.md');
  const rel = relative(dirname(file), home).split(/[\\/]/).join('/');
  return file === home ? '#the-rules' : `${rel}#the-rules`;
};
const expectedFor = (file) => TEMPLATES[variantOf(file)](linkFor(file));

// The banner sits between the H1 and the first `##`, which is where parts 1-3
// of the anatomy are. That is line 5 in most files and line 7 in
// dev/specs/README.md, whose lede runs to two sentences — so position is checked by
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


const findings = [];
const fixed = [];
const files = walk(specsDir);

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
  if (LOCKED.has(rel) && got === LOCKED_PREVIOUS(linkFor(abs))) continue;

  const what = `is worded differently from the ${variantOf(abs)} variant`;

  // The safety core is locked behind the developer's own unlock; --fix never
  // writes there, and says so, rather than going round the lock.
  if (fix && LOCKED.has(rel)) {
    findings.push({ rel, what: `${what}; it is in the locked safety core, so the fix waits for the developer's unlock` });
  } else if (fix) {
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
  console.error('\n  Every file under dev/specs/ carries the 🔒 prohibition — part 3 of the');
  console.error('  seven in dev/specs/README.md, stated in each file because the moment it matters');
  console.error('  is the moment nobody is reading the index. See SFG-002 in');
  console.error('  dev/specs/system/safeguards.md.\n');
  console.error('  --fix rewrites a banner that is present and wrong. It will not write one');
  console.error('  into a file that has none: that is authoring specification, and the human');
  console.error('  gate in dev/specs/README.md covers it.\n');
  process.exit(1);
}

console.log(`spec banner check: ${files.length} spec files, every 🔒 banner canonical`);
