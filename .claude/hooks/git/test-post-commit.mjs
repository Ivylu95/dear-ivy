// Rule test for git/post-commit (T-643): after a commit, a generated card whose
// copy on disk is what was committed no longer sits stale in the index; one whose
// copy on disk differs is left exactly as it is. Run in a throwaway repository
// whose hooks folder is this one, with the gate skipped (--no-verify), so only
// post-commit runs. Exits non-zero on any failure. Run by selftest.mjs.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hooks = dirname(fileURLToPath(import.meta.url));
const dir = makeTemp('dear-post-commit-');
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const status = (p) => git('status', '--porcelain', '--', p).slice(0, 2);

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const cards = 'dev/dialogue/agreements.md';
const page = 'dev/dialogue/index/way-task.md';
mkdirSync(join(dir, 'dev', 'dialogue', 'index'), { recursive: true });
const write = (p, text) => writeFileSync(join(dir, p), text);
// The index holds `old` for p while HEAD and the disk hold what was committed:
// what a commit that names its files left behind on 3 Nov.
const staleInIndex = (p, old) => {
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: dir, input: old, encoding: 'utf8' }).trim();
  git('update-index', '--cacheinfo', `100644,${blob},${p}`);
};

git('init', '-q');
git('config', 'core.hooksPath', '/dev/null');
write(cards, 'old cards\n');
write(page, 'old page\n');
write('a.txt', '1\n');
git('add', '.');
git('commit', '-q', '-m', 'base');
write(cards, 'new cards\n');
write(page, 'new page\n');
git('add', '.');
git('commit', '-q', '-m', 'cards rebuilt');
git('config', 'core.hooksPath', hooks);

// 1. Stale in the index, committed copy on disk: settled by the next commit.
staleInIndex(cards, 'old cards\n');
staleInIndex(page, 'old page\n');
check('before: the cards sit staged as an undoing of the commit', status(cards) === 'MM' && status(page) === 'MM');
write('a.txt', '2\n');
git('add', 'a.txt');
git('commit', '-q', '--no-verify', '-m', 'named', '--', 'a.txt');
check('after a commit that names its files, the cards are settled', status(cards) === '' && status(page) === '');

// 2. Changed on disk: post-commit touches nothing.
staleInIndex(cards, 'old cards\n');
write(cards, 'being edited\n');
write('a.txt', '3\n');
git('add', 'a.txt');
git('commit', '-q', '--no-verify', '-m', 'named again', '--', 'a.txt');
check('a card whose copy on disk differs is left exactly as it is', status(cards) === 'MM');

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
