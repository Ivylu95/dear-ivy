// Rule test: a slow save keeps to its own clock (MEM-005).
//
// Claude Code stops the save at 180 s (settings.json), and the save gives itself
// 170 (HOOK_MS), so it is never cut off partway. Round 32 added up its worst case:
// up to 34 s waiting out another chat's merge marker, a signed try of up to 30 s for
// every commit and merge (the record, a second pass of it, a lesson, the sandbox, a
// merge of main), and up to eight network calls of 15 s. A signer waiting on a
// passphrase nobody answers waits out every try, so four of them alone are 120 s:
// past the clock, the save was stopped before its push, its commits on this machine
// only, and with every connection stalled, before the failure note was written,
// saying nothing. Now a signer that waited out its time once is not waited on again
// in that save, and no network call runs past the clock.
//
// Scaled down to a fifth, as the variables below allow (tests only): the signer's time, the
// network's, and the hook's clock, which is stopped at 180/170 of it as Claude Code
// would. Against throwaway repositories, never this one; no inherited GIT_*
// variable is passed on. Exits non-zero on any failure. Run by selftest.mjs.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-save-budget-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const SIGNED_MS = 12000;
const HOOK_MS = 34000;
const KILL_MS = Math.round((HOOK_MS * 180) / 170);

let failed = 0;
const check = (name, ok, said = '') => {
  if (!ok) failed += 1;
  (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${said.slice(0, 300)}`}`);
};

/** A chat's branch whose turn wrote to her record and left a lesson, with a signer that never answers. */
function slowRepo(name) {
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const part of ['.claude', 'modules', 'README.md']) {
    copyTree(join(root, part), join(repo, part), { filter: (src) => !/[\\/](node_modules|worktrees|state)$/.test(src) });
  }
  const NOW = 'data/core/state/now.md';
  mkdirSync(join(repo, 'data', 'core', 'state'), { recursive: true });
  writeFileSync(join(repo, NOW), '# Now\n\nAn invented week.\n');
  writeFileSync(join(repo, 'FEEDBACK.md'), '# Feedback\n');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { env, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('remote', 'add', 'origin', remote);
  git('add', '-A');
  git('commit', '-qm', 'start');
  git('push', '-q', 'origin', 'main');
  git('checkout', '-qb', 'claude/slow');
  git('push', '-q', 'origin', 'claude/slow');
  // Main on GitHub moves on, so the save merges it in before pushing there.
  git('checkout', '-qb', 'up', 'main');
  writeFileSync(join(repo, 'up.txt'), 'up\n');
  git('add', 'up.txt');
  git('commit', '-qm', 'main moved on');
  git('push', '-q', 'origin', 'up:main');
  git('checkout', '-q', 'claude/slow');
  git('branch', '-qD', 'up');
  // A passphrase dialog nobody answers: every signed try waits out its time.
  const signer = join(dir, `${name}-signer.sh`);
  writeFileSync(signer, '#!/bin/sh\nexec sleep 60\n', { mode: 0o755 });
  git('config', 'gpg.format', 'openpgp');
  git('config', 'gpg.program', signer);
  git('config', 'user.signingkey', 'X');
  git('config', 'commit.gpgSign', 'true');
  // This turn's words, and a lesson for the developer.
  writeFileSync(join(repo, NOW), '# Now\n\nAn invented week, and an invented evening.\n');
  appendFileSync(join(repo, 'FEEDBACK.md'), '\nAn invented lesson.\n');
  const save = (extra = {}) =>
    new Promise((ok) => {
      const started = Date.now();
      const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
        cwd: repo,
        env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_RECORD_READONLY: '1', DEAR_SIGNED_MS: String(SIGNED_MS), DEAR_SAVE_HOOK_MS: String(HOOK_MS), ...extra },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let out = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (out += c));
      let killed = false;
      // Claude Code's own stop, scaled with the clock.
      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, KILL_MS);
      child.on('close', () => {
        clearTimeout(timer);
        ok({ out, killed, ms: Date.now() - started });
      });
      child.stdin.end('{}');
    });
  return { repo, git, NOW, save };
}

// The signer never answers, the connection works: what was committed reaches main.
async function slowSigner() {
  const { git, NOW, save } = slowRepo('signer');
  const r = await save();
  let onMain = '';
  try {
    onMain = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
  } catch {}
  const mainHas = (path, text) => {
    try {
      git('fetch', '-q', 'origin', 'main');
      return git('show', `origin/main:${path}`).includes(text);
    } catch {
      return false;
    }
  };
  check(`a save whose signer never answers ends inside its own clock (${r.ms} ms of ${HOOK_MS})`, !r.killed && r.ms <= HOOK_MS, r.out);
  check('and pushes her record to main', Boolean(onMain) && mainHas(NOW, 'an invented evening'), r.out);
}

// The signer never answers and every connection stalls: the failure is still written down and said.
async function slowEverything() {
  const { repo, git, save } = slowRepo('stalled');
  git('config', 'remote.origin.uploadpack', 'sleep 120; git-upload-pack');
  git('config', 'remote.origin.receivepack', 'sleep 120; git-receive-pack');
  const r = await save({ DEAR_SAVE_NET_MS: '3000' });
  const note = join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md');
  check(`a save with a silent signer and a stalled connection ends inside its own clock (${r.ms} ms of ${HOOK_MS})`, !r.killed && r.ms <= HOOK_MS, r.out);
  check('and writes the failure down and says so', existsSync(note) && /"decision"\s*:\s*"block"/.test(r.out), r.out);
}

if (process.platform === 'win32') {
  console.log('ok   skipped on Windows: the fake signer and stalled remote are shell scripts');
} else {
  await Promise.all([slowSigner(), slowEverything()]);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
