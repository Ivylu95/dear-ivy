// Rule test for lib/affected.mjs: which tests a code change can break (A-164).
//
// A commit of only code outside safety and privacy narrows; anything else, or a
// file in those surfaces, runs everything. A test is kept when it imports the
// changed file (directly or through others), names it as a test does what it
// spawns, or reaches it through a library's path to a script; a library merely
// mentioning a file name does not count, and a name two files share keeps both.
// Run on a fixture folder, never this repository. Exits non-zero on any failure.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { affected, narrowable, reacher } from './affected.mjs';
import { makeTemp } from './temp-litter.mjs';

const root = makeTemp('dear-affected-');
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const put = (path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

try {
  check('only code outside safety and privacy narrows', narrowable(['.claude/hooks/lib/typed.mjs', 'ux/scripts/dialogue.mjs']));
  check('a Markdown, JSON or settings file runs everything', !narrowable(['.claude/hooks/lib/typed.mjs', 'dev/dialogue/agreements.md']) && !narrowable(['.claude/settings.json']));
  check('a safety or privacy file runs everything', !narrowable(['.claude/hooks/safety/crisis-floor.mjs']) && !narrowable(['.claude/hooks/privacy/guard-secrets.mjs']) && !narrowable(['ux/scripts/check-privacy.mjs']) && !narrowable(['ux/lib/safety.mjs']));
  check('a git hook, the selftest or this rule runs everything', !narrowable(['.claude/hooks/git/pre-commit']) && !narrowable(['.claude/hooks/selftest.mjs']) && !narrowable(['.claude/hooks/lib/affected.mjs']));
  check('nothing staged runs everything', !narrowable([]));

  const L = '.claude/hooks/lib';
  put(`${L}/a.mjs`, "import { b } from './b.mjs';\nexport const a = b;\n");
  put(`${L}/b.mjs`, "export const why = 'c.mjs';\nexport const b = 'spawned.mjs';\n");
  put(`${L}/c.mjs`, 'export const c = 1;\n');
  put(`${L}/runs.mjs`, "export const script = 'ux/scripts/d.mjs';\n");
  put('ux/scripts/d.mjs', "import '../../.claude/hooks/lib/c.mjs';\n");
  put(`${L}/spawned.mjs`, 'export {};\n');
  put('.claude/hooks/record/spawned.mjs', 'export {};\n');
  put(`${L}/test-x.mjs`, "import { a } from './a.mjs';\n");
  put(`${L}/test-y.mjs`, "const hook = join(dir, 'spawned.mjs');\n");
  put(`${L}/test-z.mjs`, "import { script } from './runs.mjs';\n");
  const tests = ['x', 'y', 'z'].map((t) => `${L}/test-${t}.mjs`);
  const reach = reacher(root);
  const hit = (changed) => affected(root, tests, changed, reach).map((t) => t.slice(-6, -4));
  check('a file imported through another keeps the test that imports the first', hit([`${L}/b.mjs`]).join() === '-x');
  check('a library naming a file in a comment or message does not keep it', !hit([`${L}/c.mjs`]).includes('-x'));
  check('a script a library names by path keeps the test, through what it imports', hit(['ux/scripts/d.mjs']).join() === '-z' && hit([`${L}/c.mjs`]).join() === '-z');
  check('a file a test names keeps it, both files of a shared name', hit([`${L}/spawned.mjs`]).join() === '-y' && hit(['.claude/hooks/record/spawned.mjs']).join() === '-y');
  check('a test reaches itself', hit([`${L}/test-x.mjs`]).join() === '-x');
  check('a file no test reaches keeps none', hit([`${L}/unrelated.mjs`]).length === 0);
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
