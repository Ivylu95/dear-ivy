// Rule test for lib/touched.mjs's stagedUnder, as session/track-touched.mjs uses
// it: a folder this session stages by name (`git add dev/dialogue`) makes the
// files staged under it this session's, so the pre-commit gate's "never touched"
// refusal (lib/refused-staged.mjs, unownedStaged) does not fire on a chat's own
// generated files. On 2026-11-02 a chat's rebuilt Transcript cards were refused
// as another chat's five times, because only the folder was recorded. Another
// chat's staged file outside any folder this one staged is still named.
// Replayed in a throwaway repository. Run by the hook self-test.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stagedUnder } from '../lib/touched.mjs';
import { unownedStaged } from '../lib/refused-staged.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const dir = makeTemp('dear-staged-folder-');
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  git('init', '-q');
  git('config', 'core.hooksPath', '/dev/null');
  writeFileSync(join(dir, 'base.txt'), 'x');
  git('add', 'base.txt');
  git('commit', '-qm', 'base');

  mkdirSync(join(dir, 'gen', 'index'), { recursive: true });
  mkdirSync(join(dir, 'other'), { recursive: true });
  writeFileSync(join(dir, 'gen', 'cards.md'), 'a');
  writeFileSync(join(dir, 'gen', 'index', 'one.md'), 'b');
  writeFileSync(join(dir, 'other', 'theirs.md'), 'c');
  git('add', 'other/theirs.md'); // another chat's staged file
  git('add', 'gen'); // this chat stages its folder by name

  const staged = git('diff', '--cached', '--name-only').trim().split('\n').sort();
  const rel = (ps) => new Set(ps.map((p) => relative(dir, p).replace(/\\/g, '/')));
  const ask = (touched) => unownedStaged(staged, { touched, cwd: dir });

  // The incident: only the folder recorded, so its own files are named as another chat's.
  const before = ask(new Set(['gen']));
  check('folder alone: its own files were refused (the incident)', before.includes('gen/cards.md') && before.includes('gen/index/one.md'));

  const expanded = rel(stagedUnder([join(dir, 'gen')], dir));
  check('the files staged under the folder are recorded', expanded.has('gen/cards.md') && expanded.has('gen/index/one.md'));
  check('a file outside the folder is not recorded', !expanded.has('other/theirs.md'));
  const after = ask(expanded);
  check("with them recorded: only another chat's file is named", JSON.stringify(after) === '["other/theirs.md"]');

  const file = rel(stagedUnder([join(dir, 'base.txt')], dir));
  check('a plain file stays as given', file.size === 1 && file.has('base.txt'));
  check('a missing path never throws and stays as given', stagedUnder([join(dir, 'gone')], dir).length === 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
