// Rule test: her words outlive a git operation the save does not read, stopped partway in
// her folder and then undone (round 40 of the review of the git sync, MEM-005).
//
// save-record.mjs reads a merge, a cherry-pick and a revert stopped partway
// (test-merge-in-progress.mjs holds those). A rebase, an am and a bisect leave no marker
// it reads. Run against throwaway repositories with their own remotes, never this one.
// Exits non-zero on any failure. Run by selftest.mjs.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const hooks = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(hooks, '..', '..');
const dir = makeTemp('dear-merge-');
let failed = 0;

// Round 40: the kinds round 39 left out. A rebase stopped partway (each backend), an am and
// a bisect leave no marker the save reads, so it saves as it would anywhere: on a detached
// HEAD to a rescue branch, on a branch as usual. Then whoever began it undoes it, a rebase's
// abort resetting the folder hard, and the pass that lands branches runs. In every cell her
// words are still on disk for the next save, or in main on GitHub. `record` makes the stop
// a conflict on a record page as well, beside the page she wrote to.
async function undetectedOp(op, record, staged) {
  const name = `undetected-${op.join('')}-${record ? 'record' : 'harness'}-${staged ? 'staged' : 'unstaged'}`.replace(/[^\w-]/g, '');
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const quiet = { ...env, GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' };
  const git = (...args) => spawnSync('git', args, { cwd: repo, env: quiet, encoding: 'utf8' });
  for (const part of ['.claude', 'modules', 'README.md']) {
    copyTree(join(root, part), join(repo, part), { filter: (src) => !/[\\/](node_modules|worktrees)$/.test(src) });
  }
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const PAGE = join(repo, 'data', 'core', 'me', 'page.md');
  const NEW = join(repo, 'data', 'core', 'journal', 'invented.md');
  mkdirSync(dirname(NOW), { recursive: true });
  mkdirSync(dirname(PAGE), { recursive: true });
  writeFileSync(NOW, '# Now\n\nAn invented week.\n');
  writeFileSync(PAGE, '# A page\n\nAn invented fact.\n');
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-qm', 'start');
  git('checkout', '-qb', 'up');
  appendFileSync(join(repo, 'README.md'), 'a\n');
  if (record) writeFileSync(NOW, '# Now\n\nAn invented week, as another chat saw it.\n');
  git('commit', '-qam', 'a');
  git('checkout', '-qb', 'claude/x', 'main');
  appendFileSync(join(repo, 'README.md'), 'b\n');
  if (record) writeFileSync(NOW, '# Now\n\nAn invented week, as this chat saw it.\n');
  git('commit', '-qam', 'b');
  writeFileSync(join(repo, 'one.txt'), 'one\n');
  git('add', 'one.txt');
  git('commit', '-qm', 'one');
  execFileSync('git', ['init', '-q', '--bare', remote], { env, stdio: 'ignore' });
  git('remote', 'add', 'origin', remote);
  // A bisect looks back through main's own history; the others stop on main's conflicting line.
  git('push', '-q', 'origin', `${op[0] === 'bisect' ? 'claude/x' : 'up'}:main`, 'claude/x');
  git('fetch', '-q', 'origin');
  writeFileSync(join(repo, 'two.txt'), 'two\n');
  git('add', 'two.txt');
  git('commit', '-qm', 'not yet pushed');
  let undo;
  if (op[0] === 'rebase') {
    git(...op, 'origin/main');
    undo = ['rebase', '--abort'];
  } else if (op[0] === 'am') {
    writeFileSync(join(dir, `${name}.patch`), git('format-patch', '-1', '--stdout', 'origin/main').stdout);
    git('am', join(dir, `${name}.patch`));
    undo = ['am', '--abort'];
  } else {
    git('bisect', 'start', 'HEAD', 'HEAD~3');
    undo = ['bisect', 'reset'];
  }
  const marker = { rebase: op.includes('--apply') ? 'rebase-apply' : 'rebase-merge', am: 'rebase-apply', bisect: 'BISECT_LOG' }[op[0]];
  if (!existsSync(join(repo, '.git', marker))) throw new Error(`${name}: the ${op.join(' ')} did not stop partway`);
  appendFileSync(PAGE, 'An invented evening.\n');
  mkdirSync(dirname(NEW), { recursive: true });
  writeFileSync(NEW, 'An invented entry.\n');
  if (staged) {
    git('add', '--', 'data/core/me/page.md', 'data/core/journal/invented.md');
    git('commit', '-qm', 'record: update a page');
  }
  const said = await new Promise((ok) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
      cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SIGNED_MS: '1000', DEAR_RECORD_READONLY: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    const timer = setTimeout(() => child.kill(), 120000);
    child.on('close', () => {
      clearTimeout(timer);
      ok(out);
    });
    child.stdin.end('{}');
  });
  git(...undo);
  // The pass a session opens with, which lands what a rescue carried.
  const lib = join(repo, '.claude', 'hooks', 'lib', 'branches.mjs');
  spawnSync(process.execPath, ['--input-type=module', '-e', `const b = await import(${JSON.stringify(pathToFileURL(lib).href)}); b.reconcile(${JSON.stringify(repo)});`], { cwd: repo, env, stdio: 'ignore', timeout: 120000 });
  git('fetch', '-q', 'origin');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const onMain = (rel) => git('show', `origin/main:${rel}`).stdout;
  const checks = [
    ['her words on an edited page are on disk for the next save, or in main', read(PAGE).includes('An invented evening.') || onMain('data/core/me/page.md').includes('An invented evening.')],
    ['and a new page', read(NEW).includes('An invented entry.') || onMain('data/core/journal/invented.md').includes('An invented entry.')],
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs, ${op.join(' ')} stopped partway${record ? ' on a record page' : ''} × words ${staged ? 'staged' : 'unstaged'}, then undone (round 40): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

try {
  const cells = [['rebase'], ['rebase', '-i'], ['rebase', '-m'], ['rebase', '--apply'], ['am'], ['bisect']].flatMap((op) =>
    (op[0] === 'bisect' ? [false] : [false, true]).flatMap((record) => [false, true].map((staged) => () => undetectedOp(op, record, staged))));
  // A few at a time: all at once, the load ran the saves past their own time limits.
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cells.length) await cells.shift()();
  }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
