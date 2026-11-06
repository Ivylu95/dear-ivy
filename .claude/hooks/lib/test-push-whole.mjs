#!/usr/bin/env node
// Rule test for the whole-tree push check (lib/push-whole.mjs, T-981), on a throwaway
// repository with invented files, never her record: a push that changes the harness is
// judged; one that changes only data/ is never held; the tree is judged only when it is
// what is pushed; a failing check is reported with its name and a passing one is not; a
// check that cannot run is skipped, said, not failed. Last, the real pre-push hook, run in
// the throwaway repository, refuses a harness push whose tree fails and lets a record-only
// push of the same broken tree through.
//
// Run: node .claude/hooks/lib/test-push-whole.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { cannotJudge, pushedPaths, runWhole, touchesHarness } from './push-whole.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures += 1;
};

const dir = makeTemp('push-whole-');
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};

try {
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  write('README.md', 'a harness file\n');
  write('data/notes.md', 'an invented record line\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'start');
  const base = git('rev-parse', 'HEAD');

  write('data/notes.md', 'an invented record line\nanother\n');
  git('commit', '-q', '-am', 'record only');
  const recordOnly = git('rev-parse', 'HEAD');
  check('a record-only push changes only data/', !touchesHarness(pushedPaths(dir, recordOnly, base)));

  write('README.md', 'a harness file, changed\n');
  git('commit', '-q', '-am', 'harness');
  const harness = git('rev-parse', 'HEAD');
  check('a push that changes the harness is judged', touchesHarness(pushedPaths(dir, harness, recordOnly)));
  check('a main this copy has not fetched is left to git, unjudged', pushedPaths(dir, harness, 'f'.repeat(40)) === null && !touchesHarness(null));
  check('a new branch counts every path it carries', pushedPaths(dir, harness, '0'.repeat(40)).includes('README.md'));

  check('the tree is judged when it is what is pushed', cannotJudge(dir, harness) === '');
  check('not when another commit is checked out', cannotJudge(dir, recordOnly) !== '');
  write('README.md', 'an edit not committed\n');
  check('nor when the checkout has uncommitted changes', /uncommitted/.test(cannotJudge(dir, harness)));
  git('checkout', '-q', '--', 'README.md');

  write('ux/pass.mjs', 'process.exit(0);\n');
  write('ux/fail.mjs', "console.log('a pointer names a file that does not exist'); process.exit(1);\n");
  const pass = { name: 'passes', script: 'ux/pass.mjs', args: [] };
  const fail = { name: 'fails', script: 'ux/fail.mjs', args: [] };
  const gone = { name: 'gone', script: 'ux/missing.mjs', args: [] };
  const r = runWhole(dir, [pass, fail, gone]);
  check('a failing check is reported by name, with its words', r.failed.length === 1 && r.failed[0].name === 'fails' && /does not exist/.test(r.failed[0].out));
  check('a check that cannot run is skipped, not failed', r.skipped.includes('gone') && !r.failed.some((f) => f.name === 'gone'));

  // The real hook, against a bare origin, with the three whole-tree checks stood in for by
  // scripts that fail: a harness push is refused, a record-only push of the same tree is not.
  const origin = makeTemp('push-whole-origin-');
  execFileSync('git', ['init', '-q', '--bare', origin]);
  git('remote', 'add', 'origin', origin);
  mkdirSync(join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'hooks', 'git'), { recursive: true });
  for (const f of ['push-whole.mjs', 'merge-sides.mjs']) copyFileSync(join(here, f), join(dir, '.claude', 'hooks', 'lib', f));
  copyFileSync(join(here, '..', 'git', 'pre-push'), join(dir, '.claude', 'hooks', 'git', 'pre-push'));
  for (const s of ['check-links.mjs', 'sandbox.mjs', 'check-sample.mjs']) write(`ux/scripts/${s}`, "console.log('main would fail here'); process.exit(1);\n");
  git('add', '-A');
  git('commit', '-q', '-m', 'tooling');
  git('push', '-q', '--no-verify', 'origin', `${base}:refs/heads/main`);
  const hook = join(dir, '.claude', 'hooks', 'git', 'pre-push');
  const runHook = (local, remote) =>
    spawnSync(process.execPath, [hook, 'origin', origin], { cwd: dir, input: `refs/heads/main ${local} refs/heads/main ${remote}\n`, encoding: 'utf8' });
  const refused = runHook(git('rev-parse', 'HEAD'), base);
  check('the hook refuses a harness push that would leave main failing', refused.status === 1 && /would leave main failing/.test(refused.stderr) && /links/.test(refused.stderr));
  // Main now holds the broken tooling; a record save on top of it changes only data/.
  const tooling = git('rev-parse', 'HEAD');
  write('data/notes.md', 'an invented record line\nanother\na third\n');
  git('commit', '-q', '-am', 'a later record save');
  const let_through = runHook(git('rev-parse', 'HEAD'), tooling);
  check("and lets a record-only push through", let_through.status === 0);
  if (let_through.status !== 0) console.log(let_through.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log('\nwhole-tree push check: all cases hold');
