// Rule test: a worktree in use is never pruned, and a finished one still is.
//
// prune-branches.mjs removes a linked worktree whose branch is in main. One
// just made from main is "in main" before its first commit, and was removed
// under a live session twice on 2026-10-03. Run against a throwaway repository,
// never this one: the hook reads CLAUDE_PROJECT_DIR, set to the copy, and no
// inherited GIT_* variable is passed on. Exits non-zero on any failure. Run by
// selftest.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-prune-');
const repo = join(dir, 'repo');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};
const prune = () =>
  spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'session', 'prune-branches.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', timeout: 60000,
  });

try {
  cpSync(join(root, '.claude', 'hooks'), join(repo, '.claude', 'hooks'), { recursive: true, filter: (s) => !/[\\/](node_modules|state)$/.test(s) });
  writeFileSync(join(repo, 'README.md'), 'x\n');
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'core.hooksPath', '/dev/null');
  git(repo, 'config', 'user.email', 'test@example.invalid');
  git(repo, 'config', 'user.name', 'test');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'start');

  const fresh = join(dir, 'fresh');
  git(repo, 'worktree', 'add', '-q', '-b', 'fresh', fresh, 'main');
  prune();
  expect('keeps a worktree just made from main', existsSync(fresh));

  const old = join(dir, 'old');
  git(repo, 'worktree', 'add', '-q', '-b', 'old', old, 'main');
  const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000;
  utimesSync(join(git(old, 'rev-parse', '--absolute-git-dir').trim(), 'index'), twoDaysAgo, twoDaysAgo);
  prune();
  expect('removes a finished worktree untouched for two days', !existsSync(old));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
