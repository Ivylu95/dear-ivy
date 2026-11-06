// Rule test: a commit that only touches the record passes the commit gate at
// once, whatever letters its file names hold. git quotes a name with non-ASCII
// letters ("zo\303\253.md") unless asked not to, and a save of a person's page
// named that way missed the record-only pass and met the whole gate, which
// could refuse it every turn (review, 2026-10-16). Against a throwaway
// repository, never this one. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordOnly, stagedNames } from './refused-staged.mjs';
import { makeTemp } from './temp-litter.mjs';

const gate = join(dirname(fileURLToPath(import.meta.url)), '..', 'git', 'pre-commit');
// Git's own variables cleared, all but GIT_CONFIG_*, which keeps this test's commits unsigned (lib/unsigned-git.mjs).
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const dir = makeTemp('dear-gate-names-');
const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  git('init', '-q', '-b', 'main');
  // git's own default, whatever this machine's config says.
  git('config', 'core.quotePath', 'true');
  for (const name of ['person-ë.md', 'person-é.md', '例.md']) {
    mkdirSync(join(dir, 'data', 'core', 'people'), { recursive: true });
    writeFileSync(join(dir, 'data', 'core', 'people', name), 'a person\n');
  }
  git('add', '-A');
  // git's default listing quotes these names, which is what went wrong.
  check('git quotes them by default (the hazard)', git('diff', '--cached', '--name-only').includes('"data/core/people/'));
  const names = stagedNames(dir);
  check('the gate reads them raw', names.includes('data/core/people/person-ë.md') && names.includes('data/core/people/例.md'));
  check('and sees a record-only commit', recordOnly(names));
  check('while a harness file still makes it not record-only', !recordOnly([...names, 'README.md']));
  const t0 = Date.now();
  const run = spawnSync(process.execPath, [gate], { cwd: dir, env, encoding: 'utf8', timeout: 120000 });
  check('a record-only commit with non-ASCII names passes the gate', run.status === 0);
  check('and at once, without the harness checks', Date.now() - t0 < 10000);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('record-only names: all cases hold');
