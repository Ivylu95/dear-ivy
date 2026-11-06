// Rule test: a failed save names why it failed.
//
// On 2026-10-03 a deleted branch ref was reported as "the remote could not be
// reached", and the session went looking at the network. save-record.mjs now
// names the cause; this checks two of them against a throwaway repository whose
// remote does not exist, so nothing can be pushed anywhere.
//
// Never this repository: the hook reads CLAUDE_PROJECT_DIR, set to the copy, and
// no inherited GIT_* variable is passed on. Exits non-zero on any failure. Run
// by selftest.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-save-cause-');
const repo = join(dir, 'repo');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let failed = 0;
const expect = (name, pattern) => {
  writeFileSync(join(repo, 'data', 'core', 'note.md'), `${name}\n`);
  const run = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  const ok = pattern.test(`${run.stdout}${run.stderr}`);
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} names the cause: ${name}`);
};

try {
  for (const part of ['.claude', 'modules']) copyTree(join(root, part), join(repo, part), { filter: (s) => !/[\\/](node_modules|state)$/.test(s) });
  mkdirSync(join(repo, 'data', 'core'), { recursive: true });
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'start\n');
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  // A new copy before its GitHub repository exists: nothing to save to, so the
  // hook commits nothing, flags nothing and says nothing (review, 2026-10-16).
  const fresh = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  const quietNoRemote = !fresh.stdout.trim() && !existsSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md')) && spawnSync('git', ['rev-parse', '-q', '--verify', 'HEAD'], { cwd: repo, env }).status !== 0;
  if (!quietNoRemote) failed += 1;
  console.log(`${quietNoRemote ? 'ok  ' : 'FAIL'} a copy with no GitHub repository yet: no commit, no flag, nothing said`);
  git('remote', 'add', 'origin', join(dir, 'no-such-remote.git'));
  git('add', '-A');
  git('commit', '-qm', 'start');

  expect('an unreachable remote', /remote could not be reached/);
  git('checkout', '-q', '--detach');
  expect('a detached HEAD', /detached HEAD/);

  // A detached trial merge holding no record change is the heartbeat's own to
  // push: no rescue, no failure note (2026-10-09).
  // The earlier cases left their failure notes on disk (never committed since
  // 2026-10-16); clear them, and mark the point with a commit of its own, so
  // the trial commit is all that is unpushed.
  rmSync(join(repo, 'data', 'core', 'state'), { recursive: true, force: true });
  git('add', '-A', '--', 'data/');
  git('commit', '-q', '--allow-empty', '-m', 'clear the notes');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  writeFileSync(join(repo, 'harness.md'), 'a job change\n');
  git('add', 'harness.md');
  git('commit', '-qm', 'a job change');
  const quiet = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  const noted = spawnSync('git', ['ls-files', '-o', '--', 'data/core/state/PUSH_FAILED.md'], { cwd: repo, env, encoding: 'utf8' }).stdout.trim();
  const left = quiet.status === 0 && !noted;
  if (!left) failed += 1;
  console.log(`${left ? 'ok  ' : 'FAIL'} leaves a detached commit with no record change to its run`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
