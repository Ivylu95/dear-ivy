// Rule test: no hook's git ever asks anyone anything. A hook's git inherits the
// terminal she types into; with a lapsed sign-in it printed a password prompt
// over the chat and would read her next words as the password (review,
// 2026-10-16). Both helpers, lib/hook.mjs's git()/gitOk() and lib/branches.mjs's
// runner(), are run against a stand-in `git` first on the PATH that records
// the environment it was given, from a parent with none of the settings. Run
// by the hook self-test.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { withoutUnsigned } from './unsigned-git.mjs';

const lib = dirname(fileURLToPath(import.meta.url));
const dir = makeTemp('dear-quiet-git-');
const seen = join(dir, 'seen.txt');
const fake = join(dir, process.platform === 'win32' ? 'git.cmd' : 'git');

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  if (process.platform === 'win32') {
    writeFileSync(fake, `@if "%1"=="config" exit /b 1\r\n@echo %GIT_TERMINAL_PROMPT%^|%GCM_INTERACTIVE%^|%GIT_SSH_COMMAND%>> "${seen}"\r\n`);
  } else {
    // A config read (the helpers' own look for core.sshCommand) is not a call under test.
    writeFileSync(fake, `#!/bin/sh\n[ "$1" = config ] && exit 1\nprintf '%s|%s|%s\\n' "$GIT_TERMINAL_PROMPT" "$GCM_INTERACTIVE" "$GIT_SSH_COMMAND" >> "${seen}"\n`);
    chmodSync(fake, 0o755);
  }
  const parent = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_TERMINAL_PROMPT|GCM_INTERACTIVE|GIT_SSH_COMMAND)$/.test(k)));
  parent.PATH = `${dir}${delimiter}${process.env.PATH}`;
  parent.CLAUDE_PROJECT_DIR = dir;
  const script = [
    `const h = await import(${JSON.stringify(pathToFileURL(join(lib, 'hook.mjs')).href)});`,
    `const b = await import(${JSON.stringify(pathToFileURL(join(lib, 'branches.mjs')).href)});`,
    `h.git(['fetch']); h.gitOk(['push']); b.runner(${JSON.stringify(dir)}).ok(['fetch']);`,
  ].join('\n');
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: parent, stdio: 'ignore', timeout: 30000 });
  const calls = readFileSync(seen, 'utf8').split(/\r?\n/).filter(Boolean);
  check('each helper ran git', calls.length === 3);
  check('none lets git prompt on the terminal', calls.every((c) => c.startsWith('0|')));
  check('none lets a credential manager open a dialog', calls.every((c) => c.split('|')[1] === 'never'));
  check('none lets ssh ask a question', calls.every((c) => /BatchMode=yes/.test(c.split('|')[2] ?? '')));

  // The machine's own ssh stays the one git runs (review, 2026-10-16): a key
  // held by Windows' OpenSSH agent or PuTTY's Pageant is reached through it.
  const { quietSsh, runner } = await import(pathToFileURL(join(lib, 'branches.mjs')).href);
  check('a GIT_SSH program is left as it is', JSON.stringify(quietSsh({ GIT_SSH: 'plink.exe' }, dir)) === '{}');
  check('an OpenSSH command is kept, told never to ask', quietSsh({ GIT_SSH_COMMAND: 'C:/Windows/System32/OpenSSH/ssh.exe' }, dir).GIT_SSH_COMMAND === 'C:/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes');
  if (process.platform !== 'win32') {
    const repo = join(dir, 'repo');
    const sshSeen = join(dir, 'ssh-seen.txt');
    // Named ssh, as an OpenSSH binary is; any other name is left untouched.
    mkdirSync(join(dir, 'openssh'));
    const sshFake = join(dir, 'openssh', 'ssh');
    writeFileSync(sshFake, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${sshSeen}"\nexit 1\n`);
    chmodSync(sshFake, 0o755);
    const plain = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_SSH|GIT_SSH_COMMAND)$/.test(k)));
    execFileSync('git', ['init', '-q', repo], { env: plain });
    execFileSync('git', ['-C', repo, 'config', 'core.sshCommand', sshFake], { env: plain });
    execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', 'ssh://fakehost/x.git'], { env: plain });
    const saved = { ...process.env };
    for (const k of ['GIT_SSH', 'GIT_SSH_COMMAND']) delete process.env[k];
    try {
      runner(repo).ok(['fetch', '-q', 'origin'], 15000);
    } finally {
      Object.assign(process.env, saved);
    }
    let used = '';
    try {
      used = readFileSync(sshSeen, 'utf8');
    } catch {}
    check("a repository's own core.sshCommand is still the ssh git runs, told never to ask", /BatchMode=yes/.test(used));
  }

  // A person's own signing and merge settings never stall or stop a hook's
  // save, and signing stays on wherever it works (review, 2026-10-16: turning
  // it off left every save commit unverified on a platform that requires it).
  if (process.platform !== 'win32') {
    const plain = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
    const make = (name, extra) => {
      const repo = join(dir, name);
      execFileSync('git', ['init', '-q', '-b', 'main', repo], { env: plain });
      for (const [k, v] of [['user.email', 't@t'], ['user.name', 't'], ['core.hooksPath', '/dev/null'], ...extra]) execFileSync('git', ['-C', repo, 'config', k, v], { env: plain });
      return repo;
    };
    const signedTry = (repo) => {
      const script = `const h = await import(${JSON.stringify(pathToFileURL(join(lib, 'hook.mjs')).href)}); process.stdout.write(String(h.gitSigned(['commit', '-q', '--allow-empty', '-m', 'a save'])));`;
      return execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...withoutUnsigned(), CLAUDE_PROJECT_DIR: repo }, encoding: 'utf8', timeout: 90000 });
    };
    const broken = make('broken-signer', [['commit.gpgsign', 'true'], ['gpg.format', 'openpgp'], ['gpg.program', '/bin/false']]);
    check('a save commits even where signing fails', signedTry(broken) === 'true');
    const g = runner(make('ff-only', [['merge.ff', 'only']]));
    g.ok(['commit', '-q', '--allow-empty', '-m', 'base']);
    g.ok(['checkout', '-q', '-b', 'side']);
    g.ok(['commit', '-q', '--allow-empty', '-m', 'side']);
    g.ok(['checkout', '-q', 'main']);
    g.ok(['commit', '-q', '--allow-empty', '-m', 'main']);
    check('a hook merges even where merge.ff=only is set', g.ok(['merge', '-q', '--no-edit', '-m', 'merge: side', 'side']));
    // Where this machine signs (its own global config), a hook's save is signed.
    let globalSigns = '';
    try {
      globalSigns = execFileSync('git', ['config', '--global', '--get', 'commit.gpgsign'], { env: plain, encoding: 'utf8' }).trim();
    } catch {}
    if (globalSigns === 'true') {
      const working = make('working-signer', []);
      signedTry(working);
      const body = execFileSync('git', ['-C', working, 'cat-file', 'commit', 'HEAD'], { env: plain, encoding: 'utf8' });
      check('where signing works, a hook\'s save is signed', /^gpgsig /m.test(body));
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('quiet git: all cases hold');
