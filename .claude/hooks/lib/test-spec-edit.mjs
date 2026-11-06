// Rule test for ux/lib/spec-edit.mjs, the row mover. A move regroup refuses
// must write nothing: it once rewrote every citation and refused after, so the
// refused move stayed renumbered in every file that cited the register
// (backlog, 2026-10-03). Run by the hook self-test, against a throwaway copy of
// the mover and an invented register, never the live specs.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from './temp-litter.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MOVER = ['ux/lib/spec-edit.mjs', 'ux/lib/walk-skip.mjs', '.claude/hooks/lib/spec-rows.mjs', '.claude/hooks/lib/paths.mjs'];
if (!MOVER.every((f) => existsSync(join(repo, f)))) {
  console.log('skip: no row mover in this copy');
  process.exit(0);
}

const dir = makeTemp('dear-spec-edit-');
for (const f of MOVER) {
  mkdirSync(dirname(join(dir, f)), { recursive: true });
  copyFileSync(join(repo, f), join(dir, f));
}

const row = (n, text) => [`### XYZ-00${n}`, '', '> **Spec Statement**', `> ${text}`, '', '- **Spec Rationale:** Why.', ''];
const register = [
  '# Test register',
  '',
  '## Specifications Register',
  '',
  '- `001–001` · Alone',
  '- `002–003` · Pair',
  '',
  ...row(1, 'First.'),
  ...row(2, 'Second.'),
  ...row(3, 'Third.'),
].join('\n');
const citing = 'Cites XYZ-001 and XYZ-002 and XYZ-003.\n';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  mkdirSync(join(dir, 'dev', 'specs'), { recursive: true });
  const specFile = join(dir, 'dev', 'specs', 'test.md');
  const citeFile = join(dir, 'notes.md');
  writeFileSync(specFile, register);
  writeFileSync(citeFile, citing);
  const { moveRow } = await import(pathToFileURL(join(dir, 'ux', 'lib', 'spec-edit.mjs')).href);

  // XYZ-001 to position 2 would leave the "Alone" group empty: refused.
  const refused = moveRow({ path: 'test.md', id: 'XYZ-001', to: '2' });
  check('a move that would empty a group is refused', refused.ok === false);
  check('a refused move leaves the citing files as they were', readFileSync(citeFile, 'utf8') === citing);
  check('a refused move leaves the register as it was', readFileSync(specFile, 'utf8') === register);

  const dry = moveRow({ path: 'test.md', id: 'XYZ-001', to: '2', dryRun: true });
  check('a dry run says the same move would be refused', dry.ok === false);

  // XYZ-003 to position 2 stays inside the "Pair" group: done, citations follow.
  const moved = moveRow({ path: 'test.md', id: 'XYZ-003', to: '2' });
  check('a move inside a group goes through', moved.ok === true);
  check('its citations follow it', readFileSync(citeFile, 'utf8') === 'Cites XYZ-001 and XYZ-003 and XYZ-002.\n');
  check('the register is renumbered in order', /XYZ-002\n\n> \*\*Spec Statement\*\*\n> Third\./.test(readFileSync(specFile, 'utf8')));

  // Dated history keeps its numbers (2026-10-07: a renumber rewrote the
  // backlog's Done lines and two dated notes, and they were put back by hand).
  const backlog = join(dir, 'backlog.md');
  const dated = join(dir, 'review-2026-10-04.md');
  writeFileSync(backlog, '- to-do · Cites XYZ-002 · opened 2026-10-07 · chat none\n- done 2026-10-04 · Built XYZ-002 · commit abc · chat none\n');
  writeFileSync(dated, 'Reviewed XYZ-002 that day.\n');
  const policy = join(dir, 'policy.md');
  writeFileSync(policy, '## Results\n| 2026-10-04 | XYZ-002 |\n## The hazard log\n| 2026-10-04 | XYZ-002 |\nProse XYZ-002\n');
  const back = moveRow({ path: 'test.md', id: 'XYZ-002', to: '3' });
  const lines = readFileSync(backlog, 'utf8').split('\n');
  check('a second move goes through', back.ok === true);
  check('an open backlog line follows the renumber', lines[0].includes('XYZ-003'));
  check('a done backlog line keeps the number it was written with', lines[1].includes('XYZ-002'));
  const pol = readFileSync(policy, 'utf8').split('\n');
  check('a dated hazard-log row keeps the number it was written with', pol[3] === '| 2026-10-04 | XYZ-002 |');
  check('outside the hazard log\'s dated rows, citations still follow', pol[1].includes('XYZ-003') && pol[4].includes('XYZ-003'));
  check('a file named for its date keeps its numbers', readFileSync(dated, 'utf8') === 'Reviewed XYZ-002 that day.\n');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
