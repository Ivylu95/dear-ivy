// Rule test for ux/lib/walk-skip.mjs, the one list of folders no walker or watcher
// of the app enters. The incident (2026-10-06): ten agent worktrees under
// .claude/worktrees were walked by the Harness view and primed by the watcher,
// tens of seconds each, and the copies of her record inside them were listed in
// the Harness tab. Replayed in a throwaway folder. Skipped in a copy without ux/.
// Run by selftest.mjs.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const lib = fileURLToPath(new URL('../../../ux/lib/walk-skip.mjs', import.meta.url));
if (!existsSync(lib)) {
  console.log('walk skip: no ux/ in this copy, nothing to check');
  process.exit(0);
}
const { RECORD_DIRS, SKIP_DIRS, skipped, walkFiles } = await import(pathToFileURL(lib).href);

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('agent worktrees are skipped, at any depth', skipped('worktrees') && skipped('a/b/worktrees/x'));
check('packages, build output and git are skipped', skipped('node_modules') && skipped('x/.next') && skipped('.git'));
check('a copy of the record inside a worktree is skipped', skipped('worktrees/agent-1/data/core') && skipped('worktrees/agent-1/data-sample'));
// The review's finding, 2026-10-06: skipping every folder named data hid the spec group dev/specs/data/.
check('a folder named data is walked, so the spec group dev/specs/data/ stays', !skipped('data/record.md') && !skipped('data'));
check('the record is skipped only from the repository root', RECORD_DIRS.has('data') && RECORD_DIRS.has('data-sample'));
check('hook state is skipped as a path', skipped('hooks/state') && skipped('hooks/state/touched-1.json'));
check("her record's own core/state is not", !skipped('core/state') && !skipped('core/state/now.md'));
check('ordinary harness folders are walked', !skipped('skills/journal') && !skipped('hooks/session') && !skipped('memory'));
check('Windows separators are read the same', skipped('worktrees\\agent-1') && !skipped('core\\state\\now.md'));

// The incident, replayed: a walk of a harness holding a worktree with a record in it.
const root = makeTemp('dear-walk-skip-');
try {
  for (const p of ['skills/a', 'hooks/state', 'worktrees/agent-1/data/core', 'worktrees/agent-1/ux/node_modules/x']) mkdirSync(join(root, p), { recursive: true });
  writeFileSync(join(root, 'skills/a/SKILL.md'), 'x');
  writeFileSync(join(root, 'hooks/state/touched-1.json'), '{}');
  writeFileSync(join(root, 'worktrees/agent-1/data/core/now.md'), 'private');
  // The shared walker (SFG-007 design 5), told what each caller skips.
  mkdirSync(join(root, 'temp/hb-job/data'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'specs/data'), { recursive: true });
  writeFileSync(join(root, 'temp/hb-job/.git'), 'gitdir: elsewhere');
  writeFileSync(join(root, 'temp/hb-job/data/now.md'), 'private');
  writeFileSync(join(root, 'data/now.md'), 'private');
  writeFileSync(join(root, 'specs/data/row.md'), 'x');
  const rel = (files) => files.map((p) => relative(root, p).replace(/\\/g, '/'));
  const seen = rel(walkFiles(root, { names: new Set([...SKIP_DIRS].filter((n) => n !== 'temp')), paths: ['hooks/state'], top: RECORD_DIRS }));
  check('a walk of the harness reaches its own files', seen.includes('skills/a/SKILL.md'));
  check('and never a worktree, its record or hook state', !seen.some((p) => p.startsWith('worktrees/') || p.startsWith('hooks/state/')));
  check('the incident (2026-10-09): another checkout under temp/ is never entered', !seen.some((p) => p.startsWith('temp/hb-job/')));
  check('the record is skipped at the root only, so specs/data/ is walked', !seen.includes('data/now.md') && seen.includes('specs/data/row.md'));
  check('by default hook state is walked: a caller asks to skip it', rel(walkFiles(root)).includes('hooks/state/touched-1.json'));
  check('keep chooses the files', rel(walkFiles(root, { keep: (n) => n.endsWith('.md') })).every((p) => p.endsWith('.md')));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('walk skip: worktrees, packages, hook state and record copies are never walked');
