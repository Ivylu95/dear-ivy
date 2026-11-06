// Rule test for DEV-016, "A step left to the developer comes with the exact
// command and why no agent took it": everything git-reconcile leaves comes with
// a reason and a copyable git command. Against a throwaway repository with
// an unmerged branch, a stash and an uncommitted file, never the live one.
//
// Run from ux/: node scripts/test-git-reconcile.mjs

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reconcile } from '../../.claude/hooks/lib/branches.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const base = makeTemp('reconcile-test-');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });

try {
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  git(base, 'init', '--bare', '-b', 'main', origin);
  git(base, 'clone', origin, work);
  git(work, 'checkout', '-B', 'main');
  writeFileSync(join(work, 'a.txt'), 'a\n');
  git(work, 'add', 'a.txt');
  git(work, 'commit', '-m', 'first');
  git(work, 'push', '-u', 'origin', 'main');
  git(work, 'checkout', '-b', 'side');
  writeFileSync(join(work, 'b.txt'), 'b\n');
  git(work, 'add', 'b.txt');
  git(work, 'commit', '-m', 'side work');
  git(work, 'checkout', 'main');
  writeFileSync(join(work, 'a.txt'), 'changed\n');
  git(work, 'stash', 'push', '-m', 'test-stash');
  writeFileSync(join(work, 'a.txt'), 'edited again\n');

  const { left } = reconcile(work, { dry: true });
  const kinds = ['branch side', 'stash stash@{0}', 'uncommitted files'];

  check('each kind of thing left is listed', kinds.every((k) => left.some((l) => l.what.startsWith(k))));
  check('every item says why no agent took it', left.every((l) => typeof l.why === 'string' && l.why.trim().length > 0));
  check('every item gives a command', left.every((l) => typeof l.command === 'string' && l.command.trim().length > 0));
  check('every command is a git command, to copy as it stands', left.every((l) => /^git( |$)/.test(l.command)));
  check('no command is a placeholder', left.every((l) => !/[<>]|\.\.\.|\bTODO\b/.test(l.command)));
  check('a command naming a folder gives it in full, from where it runs', left.every((l) => !/ -C (?!")/.test(l.command)));
  check('the stash is settled by looking, never by dropping it', left.filter((l) => l.what.startsWith('stash')).every((l) => !/\b(drop|clear|pop)\b/.test(l.command)));
} finally {
  rmSync(base, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
