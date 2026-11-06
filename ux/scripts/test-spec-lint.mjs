#!/usr/bin/env node
// spec-lint's --only, as the commit gate runs it: the index ranges and the row
// groups refuse a stale line, and a fault of any other kind does not count.
// Each case runs the lint on a throwaway copy of the specs with one line changed.
//
// Run from ux/: node scripts/test-spec-lint.mjs

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!existsSync(join(REPO, SPECS_DIR))) {
  console.log(`spec lint test: no ${SPECS_DIR}/ in this copy (ARC-008), nothing to test`);
  process.exit(0);
}
const GATED = ['--only', 'index-prefix,index-range,groups,coverage,note-last,lead'];

// One change to one file; null leaves the copy as it is.
const cases = [
  ['passes the specs as they are', null, null, 0],
  ['refuses an index range one past its register', 'README.md', (t) => t.replace(/`PRD-001··(\d{3})`/, (_, n) => `\`PRD-001··${String(Number(n) + 1).padStart(3, '0')}\``), 1],
  ['refuses a row group that leaves a row out', 'PRODUCT.md', (t) => t.replace(/^- `001–(\d{3})` ·/m, (_, n) => `- \`001–${String(Number(n) - 1).padStart(3, '0')}\` ·`), 1],
  ['refuses a parent whose Coverage leaves out a child', 'PRODUCT.md', (t) => t.replace(/; ✅ \[\*\*DES-008\*\*\]\([^)]*\) – [^\n]*/, ''), 1],
  ['refuses a row below the sources note', 'ux/design.md', (t) => {
    const note = t.match(/^> 📚 .*$/m)[0];
    return t.replace(`${note}\n`, '').replace(/^## \*\*DES-008/m, `${note}\n\n## **DES-008`);
  }, 1],
  ['refuses a bold lead past ten words', 'PRODUCT.md', (t) => t.replace('**Their safety comes before anything else, every single time** –', '**Their safety comes before anything else it is doing, every single time** –'), 1],
  ['refuses a bold lead under eight words', 'PRODUCT.md', (t) => t.replace('**Their safety comes before anything else, every single time** –', '**Their safety comes first** –'), 1],
  ['refuses a bold lead ended by a full stop', 'PRODUCT.md', (t) => t.replace('**Their safety comes before anything else, every single time** –', '**Their safety comes before anything else, every single time.**'), 1],
  ['lets a fault of another kind through', 'PRODUCT.md', (t) => t.replace(/^> 🔒 \*\*.*$/m, ''), 0],
];

let failed = 0;
for (const [what, file, change, expected] of cases) {
  const scratch = makeTemp('dear-spec-lint-');
  try {
    cpSync(join(REPO, SPECS_DIR), join(scratch, SPECS_DIR), { recursive: true });
    cpSync(join(REPO, '.claude', 'hooks', 'lib'), join(scratch, '.claude', 'hooks', 'lib'), { recursive: true });
    cpSync(join(REPO, 'ux', 'scripts', 'spec-lint.mjs'), join(scratch, 'ux', 'scripts', 'spec-lint.mjs'));
    cpSync(join(REPO, 'ux', 'lib', 'walk-skip.mjs'), join(scratch, 'ux', 'lib', 'walk-skip.mjs'));
    let changed = true;
    if (file) {
      const path = join(scratch, SPECS_DIR, file);
      const before = readFileSync(path, 'utf8');
      const after = change(before);
      changed = after !== before;
      writeFileSync(path, after);
    }
    const run = spawnSync(process.execPath, [join(scratch, 'ux', 'scripts', 'spec-lint.mjs'), ...GATED], { encoding: 'utf8' });
    const ok = changed && run.status === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${changed ? '' : ' (the change found nothing to change)'}`);
    if (!ok) console.log(run.stdout, run.stderr);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// --lead counts a draft as the rule above counts a row (2026-10-15: leads
// offered as ten were eleven by the rule, a dash standing alone counting as a word).
const leadCases = [
  ['--lead passes a draft of nine words', ['Their safety comes before anything else, every single time'], 0],
  ['--lead counts a dash standing alone as a word, as the rule does', ["**Every skill fires on its audience's words – and only those** –"], 1],
  ['--lead refuses one draft out of two', ['Their safety comes before anything else, every single time', 'Their safety comes first'], 1],
];
for (const [what, drafts, expected] of leadCases) {
  const run = spawnSync(process.execPath, [join(REPO, 'ux', 'scripts', 'spec-lint.mjs'), '--lead', ...drafts], { encoding: 'utf8' });
  const ok = run.status === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) console.log(run.stdout, run.stderr);
}

if (failed) {
  console.error(`\nspec lint test: ${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nspec lint test: every case passes');
