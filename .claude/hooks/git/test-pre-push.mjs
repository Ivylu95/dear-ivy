// Rule test for git/pre-push: nothing is pushed from a harness checkout to the
// release repository, in any of the forms its address can take, nor anywhere
// but the checkout's own origin (edge cases, 2026-10-29, D-G7). Run by the hook
// self-test; exits non-zero on any failure.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'pre-push');
const dir = makeTemp('dear-pre-push-');
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const work = join(dir, 'work');
mkdirSync(join(work, '.claude', 'release'), { recursive: true });
mkdirSync(join(work, 'hooks'));
cpSync(hook, join(work, 'hooks', 'pre-push'));
cpSync(join(dirname(hook), 'package.json'), join(work, 'hooks', 'package.json'));
writeFileSync(join(work, '.claude', 'release', 'source.json'), JSON.stringify({ repo: 'https://github.com/Owner/Dear-Release.git' }));
// The hook reads the address through lib/release-source.mjs, from the checkout it guards.
mkdirSync(join(work, '.claude', 'hooks', 'lib'), { recursive: true });
cpSync(join(dirname(hook), '..', 'lib', 'release-source.mjs'), join(work, '.claude', 'hooks', 'lib', 'release-source.mjs'));
git(work, 'init', '-q');
git(work, 'config', 'core.hooksPath', 'hooks');
git(work, 'add', '-A');
git(work, 'commit', '-q', '-m', 'x');
git(work, 'remote', 'add', 'origin', 'https://github.com/owner/dear-dev.git');

// The hook is judged on the address git hands it; a GitHub address is never contacted.
const run = (url, name = 'origin') => spawnSync(process.execPath, [hook, name, url], { cwd: work, encoding: 'utf8', input: '' });
const CASES = [
  ['refuses the release repository by https', 'https://github.com/owner/dear-release.git', 1],
  ['refuses it with no .git and other case', 'https://github.com/OWNER/dear-release', 1],
  ['refuses it by ssh', 'git@github.com:owner/dear-release.git', 1],
  ['refuses it with a key in the address', 'https://x-access-token:abc@github.com/owner/dear-release.git', 1],
  ['passes the development repository, its origin', 'https://github.com/owner/dear-dev.git', 0],
  ['passes origin in another form', 'git@github.com:Owner/dear-dev', 0],
  ['passes origin with a key in the address', 'https://x-access-token:abc@github.com/owner/dear-dev.git', 0],
  ['the incident: refuses another repository that is not origin', 'https://github.com/someone/elsewhere.git', 1],
  ['refuses a folder that is not origin', join(dir, 'elsewhere.git'), 1],
  // Round 2 (C3): the host was not anchored, so these read as origin.
  ['the incident: refuses another host whose path names origin', 'https://evil.example/github.com/owner/dear-dev.git', 1],
  ['the incident: refuses a local folder whose path names origin', 'file:///srv/github.com/owner/dear-dev', 1],
  ['refuses another host with github.com in its name', 'https://notgithub.com/owner/dear-dev.git', 1],
];
let failed = 0;
for (const [what, url, want] of CASES) {
  const got = run(url).status;
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: exit ${got}`);
  }
}
{
  const r = run('https://github.com/someone/elsewhere.git', 'mirror');
  if (/someone\/elsewhere/.test(r.stderr)) {
    failed += 1;
    console.error('FAIL the refusal never prints the address, which may hold a key');
  }
}
// A-155: the address moved into the record, the harness file a placeholder. The push
// to the release repository is still refused, read from the record's file.
writeFileSync(join(work, '.claude', 'release', 'source.json'), JSON.stringify({ repo: '<the release repository: set in data/core/setup/release-source.json>' }));
mkdirSync(join(work, 'data', 'core', 'setup'), { recursive: true });
writeFileSync(join(work, 'data', 'core', 'setup', 'release-source.json'), JSON.stringify({ repo: 'https://github.com/Owner/Dear-Release.git' }));
for (const [what, url, want] of [
  ['the address in the record: refuses the release repository', 'https://github.com/owner/dear-release.git', 1],
  ['the address in the record: passes origin', 'https://github.com/owner/dear-dev.git', 0],
]) {
  const got = run(url).status;
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: exit ${got}`);
  }
}

// A copy whose origin is the release repository's old address is still refused there.
git(work, 'remote', 'set-url', 'origin', 'https://github.com/owner/dear-release.git');
if (run('https://github.com/owner/dear-release.git').status !== 1) {
  failed += 1;
  console.error('FAIL refuses the release repository even when it is origin');
}

// And as git itself runs it, on real pushes: to origin goes through, elsewhere does not.
const home = join(dir, 'home.git');
const elsewhere = join(dir, 'elsewhere.git');
git(dir, 'init', '-q', '--bare', home);
git(dir, 'init', '-q', '--bare', elsewhere);
git(work, 'remote', 'set-url', 'origin', home);
const push = (...a) => spawnSync('git', ['push', '-q', ...a, 'HEAD:refs/heads/main'], { cwd: work, encoding: 'utf8' });
let p = push('origin');
if (p.status !== 0) {
  failed += 1;
  console.error(`FAIL a push to origin goes through: ${p.stderr}`);
}
p = push(home);
if (p.status !== 0) {
  failed += 1;
  console.error(`FAIL a push to origin's address in full goes through: ${p.stderr}`);
}
git(work, 'remote', 'add', 'mirror', elsewhere);
for (const [what, to] of [['a push to a second remote', 'mirror'], ['a push to a folder typed in full', elsewhere]]) {
  p = push(to);
  if (p.status === 0) {
    failed += 1;
    console.error(`FAIL ${what} is refused`);
  }
}
// Round 2 (C3): pushInsteadOf sends origin's push elsewhere, and the push address
// git reported agreed with it. Origin is judged by its fetch address.
git(work, 'config', `url.${elsewhere}.pushInsteadOf`, home);
p = push('origin');
git(work, 'config', '--unset', `url.${elsewhere}.pushInsteadOf`);
if (p.status === 0) {
  failed += 1;
  console.error('FAIL the incident: a push that pushInsteadOf sends elsewhere is refused');
}
rmSync(dir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log(`pre-push tests: ${CASES.length + 10} cases pass`);
