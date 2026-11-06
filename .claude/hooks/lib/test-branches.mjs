// Rule test for lib/branches.mjs, the reconcile step (WKB-015) and the session-start
// prune it shares (DEP-011). Replayed against a throwaway remote and two clones:
// the incident is a copy left 14 commits behind on 2026-10-04, which hid a change
// already on GitHub. Run by the hook self-test.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcile } from './branches.mjs';
import { makeTemp } from './temp-litter.mjs';

const dir = makeTemp('dear-reconcile-');
const at = (repo) => (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: join(dir, repo), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (git, repo, file) => {
  writeFileSync(join(dir, repo, file), file);
  git('add', file);
  git('commit', '-q', '-m', file);
};

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', join(dir, 'remote.git')]);
  execFileSync('git', ['clone', '-q', join(dir, 'remote.git'), join(dir, 'a')], { stdio: 'ignore' });
  const a = at('a');
  a('checkout', '-q', '-b', 'main');
  commit(a, 'a', 'base.txt');
  a('push', '-q', '-u', 'origin', 'main');
  execFileSync('git', ['clone', '-q', join(dir, 'remote.git'), join(dir, 'b')], { stdio: 'ignore' });
  const b = at('b');

  // A branch this copy pushed, merged into main on GitHub by another copy, so
  // only GitHub's main holds it while this one's main is behind.
  a('checkout', '-q', '-b', 'landed');
  commit(a, 'a', 'landed.txt');
  a('push', '-q', 'origin', 'landed');
  a('checkout', '-q', 'main');
  b('fetch', '-q', 'origin');
  b('merge', '-q', '--ff-only', 'origin/landed');

  // Another copy lands work, so this one falls behind; it also has a finished
  // branch, an unmerged one, and a stash.
  commit(b, 'b', 'one.txt');
  commit(b, 'b', 'two.txt');
  b('push', '-q', 'origin', 'main');
  a('branch', 'done');
  a('checkout', '-q', '-b', 'wip');
  commit(a, 'a', 'wip.txt');
  a('checkout', '-q', 'main');
  writeFileSync(join(dir, 'a', 'base.txt'), 'edited');

  // Uncommitted edits in the folder holding main, in a file the incoming commits
  // leave alone: a fast-forward keeps them, so main still catches up.
  let r = reconcile(join(dir, 'a'), { dry: true });
  check('--dry changes nothing', a('rev-parse', 'main') !== a('rev-parse', 'origin/main') && a('branch', '--list', 'done') !== '');
  check('a dry run offers to pull main forward past an unrelated edit', r.fixed.some((f) => f.startsWith('would pull main forward')));
  check('with main behind, a branch merged on GitHub is judged against GitHub\'s main, not listed as unmerged', !r.left.some((l) => l.what.startsWith('branch landed')) && r.fixed.includes('would delete the merged branch landed'));
  check('with main behind, an unmerged branch is still listed', r.left.some((l) => l.what.startsWith('branch wip')));
  a('stash', 'push', '-q', '-m', 'kept');

  r = reconcile(join(dir, 'a'));
  check('main behind GitHub is pulled forward', a('rev-parse', 'main') === a('rev-parse', 'origin/main'));
  check('a merged branch is deleted', a('branch', '--list', 'done') === '');
  check('an unmerged branch stays, listed as not on GitHub', a('branch', '--list', 'wip') !== '' && r.left.some((l) => l.what.startsWith('branch wip') && l.command === 'git push origin wip'));
  check('a stash stays, listed', a('stash', 'list') !== '' && r.left.some((l) => l.what.startsWith('stash')));
  check('a stash of harness files alone is listed quietly', r.left.some((l) => l.what.includes('kept') && l.quiet));

  // Round 41: a stash taken whole in a folder another chat shares (the stalled-sync
  // memory note settled "an uncommitted edit is in the way" with `git stash push -u`)
  // carries her unsaved words with it: on no commit, on this machine only, and listed
  // quietly, so never said. One holding record words HEAD lacks is said; one whose
  // record pages HEAD already holds stays quiet.
  mkdirSync(join(dir, 'a', 'data', 'core'), { recursive: true });
  writeFileSync(join(dir, 'a', 'data', 'core', 'page.md'), 'An invented page.\n');
  a('add', 'data');
  a('commit', '-q', '-m', 'record: a page');
  writeFileSync(join(dir, 'a', 'data', 'core', 'page.md'), 'An invented page.\nAn invented evening.\n');
  a('stash', 'push', '-q', '-m', 'settled already');
  a('stash', 'apply', '-q');
  a('commit', '-q', '-am', 'record: session update');
  writeFileSync(join(dir, 'a', 'data', 'core', 'page.md'), 'An invented page.\nAn invented evening.\nAn invented night.\n');
  writeFileSync(join(dir, 'a', 'data', 'core', 'new.md'), 'An invented new page.\n');
  a('stash', 'push', '-q', '-u', '-m', 'in the way');
  r = reconcile(join(dir, 'a'));
  const stashed = (msg) => r.left.find((l) => l.what.startsWith('stash') && l.what.includes(msg));
  check('a stash holding record words HEAD lacks is said, not listed quietly', stashed('in the way') && !stashed('in the way').quiet && /data\/core\/new\.md/.test(stashed('in the way').why) && /data\/core\/page\.md/.test(stashed('in the way').why));
  check('a stash whose record pages HEAD already holds stays quiet', stashed('settled already')?.quiet === true);
  check('neither stash is dropped', a('stash', 'list').split('\n').length === 3);

  // Ahead only: pushed.
  commit(a, 'a', 'three.txt');
  r = reconcile(join(dir, 'a'));
  check('main ahead of GitHub is pushed', b('ls-remote', 'origin', 'main').split(/\s/)[0] === a('rev-parse', 'main'));

  // A finished worktree, idle for days, holding an edit: git would refuse to
  // remove it, so a dry run must not promise to (2026-10-07, five promised, none made).
  const aside = join(dir, 'aside');
  a('worktree', 'add', '-q', '-b', 'aside', aside);
  writeFileSync(join(aside, 'base.txt'), 'edited aside');
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  utimesSync(execFileSync('git', ['-C', aside, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim() + '/index', old, old);
  r = reconcile(join(dir, 'a'), { dry: true });
  check('a finished worktree with edits is not promised in a dry run, and is listed', !r.fixed.some((f) => f.includes('aside')) && r.left.some((l) => l.what.includes('aside')));

  // A finished worktree whose node_modules links to a shared install, as every
  // worktree here does: clearing it must leave the install whole. On 2026-10-07
  // `git worktree remove` followed the junction and emptied the shared one.
  writeFileSync(join(aside, 'base.txt'), 'edited');
  a('-C', aside, 'checkout', '-q', '--', 'base.txt');
  const shared = join(dir, 'shared-install', 'next');
  mkdirSync(shared, { recursive: true });
  writeFileSync(join(shared, 'keep.txt'), 'the shared install');
  writeFileSync(join(dir, 'a', '.git', 'info', 'exclude'), 'node_modules\n');
  mkdirSync(join(aside, 'ux'));
  symlinkSync(join(dir, 'shared-install'), join(aside, 'ux', 'node_modules'), 'junction');
  utimesSync(execFileSync('git', ['-C', aside, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim() + '/index', old, old);
  r = reconcile(join(dir, 'a'));
  check('a finished worktree is cleared, and the install its node_modules links to is left whole', !existsSync(aside) && existsSync(join(shared, 'keep.txt')));

  // A second run fixes nothing.
  r = reconcile(join(dir, 'a'));
  check('a second run changes nothing', r.fixed.length === 0);

  // Finished worktrees whose only edits lose nothing: a generated file, and a file
  // already byte for byte what GitHub's main holds (four of five left on
  // 2026-10-07 for the developer's force-remove). Cleared, and what each held named;
  // one holding a real edit beside them is still kept and listed.
  mkdirSync(join(dir, 'a', 'ux', 'app'), { recursive: true });
  writeFileSync(join(dir, 'a', 'ux', 'app', 'icon.svg'), 'v1');
  writeFileSync(join(dir, 'a', 'shared.txt'), 'v1');
  a('add', 'ux/app/icon.svg', 'shared.txt');
  a('commit', '-q', '-m', 'shared');
  const spare = join(dir, 'spare');
  const kept = join(dir, 'kept');
  a('worktree', 'add', '-q', '-b', 'spare', spare);
  a('worktree', 'add', '-q', '-b', 'kept', kept);
  writeFileSync(join(dir, 'a', 'shared.txt'), 'v2');
  a('commit', '-q', '-am', 'shared moves on');
  a('push', '-q', 'origin', 'main');
  writeFileSync(join(spare, 'shared.txt'), 'v2');
  a('-C', spare, 'add', 'shared.txt');
  writeFileSync(join(spare, 'ux', 'app', 'icon.svg'), 'regenerated');
  writeFileSync(join(kept, 'shared.txt'), 'v2');
  writeFileSync(join(kept, 'ux', 'app', 'icon.svg'), 'regenerated');
  writeFileSync(join(kept, 'base.txt'), 'a real edit');
  for (const p of [spare, kept]) utimesSync(execFileSync('git', ['-C', p, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim() + '/index', old, old);
  r = reconcile(join(dir, 'a'), { dry: true });
  check('a dry run promises a finished worktree holding only generated files or copies of main, and names them', r.fixed.some((f) => f.includes(spare) && f.includes('shared.txt') && f.includes('ux/app/icon.svg')) && existsSync(spare));
  check('a dry run does not promise one holding a real edit, and lists it', !r.fixed.some((f) => f.includes(kept)) && r.left.some((l) => l.what.includes(kept)));
  r = reconcile(join(dir, 'a'));
  check('a finished worktree holding only generated files or copies of main is cleared', !existsSync(spare));
  check('a finished worktree holding a real edit is kept, its edit untouched', existsSync(kept) && a('-C', kept, 'status', '--porcelain').includes('base.txt') && r.left.some((l) => l.what.includes(kept)));
  a('-C', kept, 'checkout', '-q', '--', '.');
  a('worktree', 'remove', kept);

  // A heartbeat run's detached checkout left by a run that died (five of about
  // 520 MB each in temp/, 2026-10-11): cleared once idle, clean and in main; one
  // holding an edit, or in use, stays.
  const hbIdle = (path) => utimesSync(execFileSync('git', ['-C', path, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim() + '/index', old, old);
  writeFileSync(join(dir, 'a', '.git', 'info', 'exclude'), 'node_modules\ntemp/\n');
  const hbDead = join(dir, 'a', 'temp', 'hb-run');
  const hbEdited = join(dir, 'a', 'temp', 'hb-run-1200');
  const hbLive = join(dir, 'a', 'temp', 'hb-run-1300');
  for (const p of [hbDead, hbEdited, hbLive]) a('worktree', 'add', '-q', '--detach', p, 'origin/main');
  writeFileSync(join(hbEdited, 'base.txt'), 'a run\'s unsaved edit');
  hbIdle(hbDead);
  hbIdle(hbEdited);
  r = reconcile(join(dir, 'a'));
  check('a dead heartbeat run\'s clean checkout is cleared', !existsSync(hbDead) && r.fixed.some((f) => f.includes('hb-run') && !f.includes('hb-run-')));
  check('one holding an edit stays', existsSync(join(hbEdited, 'base.txt')));
  check('one used in the last day stays', existsSync(hbLive));
  a('worktree', 'remove', '--force', hbEdited);
  a('worktree', 'remove', hbLive);

  // Nothing out of step is left unsaid (2026-10-07): each of these was silent before.
  const idle = (path) => utimesSync(execFileSync('git', ['-C', path, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim() + '/index', old, old);
  // All set up at once and judged by one run: each run costs seconds on Windows.
  const fresh = join(dir, 'fresh');
  a('worktree', 'add', '-q', '-b', 'fresh', fresh);
  writeFileSync(join(fresh, 'new.txt'), 'never committed');
  idle(fresh);

  const loose = join(dir, 'loose');
  a('worktree', 'add', '-q', '--detach', loose);
  idle(loose);

  b('checkout', '-q', '-b', 'shared');
  commit(b, 'b', 'shared.txt');
  b('push', '-q', 'origin', 'shared');
  a('fetch', '-q', 'origin');
  a('branch', 'shared', 'origin/shared');
  b('checkout', '-q', 'shared');
  commit(b, 'b', 'shared2.txt');
  b('push', '-q', 'origin', 'shared');

  a('checkout', '-q', '-b', 'elsewhere');
  writeFileSync(join(dir, 'a', '.git', 'MERGE_HEAD'), `${a('rev-parse', 'main')}\n`);

  r = reconcile(join(dir, 'a'), { dry: true });
  const said = (text) => r.left.some((l) => `${l.what} ${l.why}`.includes(text));
  check('a finished worktree holding only new files is not promised, and is listed', !r.fixed.some((f) => f.includes('fresh')) && said('new files never committed'));
  check('a detached worktree is listed', said('on no branch'));
  check('a merge stopped partway is listed', said('a merge stopped partway'));
  check('the main folder off main is listed', said('not main'));
  check('a branch behind its GitHub copy says so', said("GitHub's copy has 1 this one lacks"));

  // B3 (round 3): a merge another hook finishes a moment later is no merge stopped partway.
  const mergeHead = join(dir, 'a', '.git', 'MERGE_HEAD');
  const lock = join(dir, 'a', '.git', 'index.lock');
  writeFileSync(lock, '');
  const finisher = spawn(process.execPath, ['-e', `setTimeout(() => { require('fs').rmSync(${JSON.stringify(mergeHead)}, { force: true }); require('fs').rmSync(${JSON.stringify(lock)}, { force: true }); }, 800)`], { stdio: 'ignore' });
  r = reconcile(join(dir, 'a'), { dry: true });
  await new Promise((ok) => (finisher.exitCode !== null ? ok() : finisher.on('exit', ok)));
  check('a merge finished by another git a moment later is not listed as stopped partway (B3)', !r.left.some((l) => l.what.includes('a merge stopped partway')));

  // Round 30: a merge that signs its commit holds no lock while it signs, and a signer
  // may take up to SIGNED_MS (30s); one finished five seconds on is no merge stopped partway.
  writeFileSync(mergeHead, `${a('rev-parse', 'main')}\n`);
  const signer = spawn(process.execPath, ['-e', `setTimeout(() => require('fs').rmSync(${JSON.stringify(mergeHead)}, { force: true }), 5000)`], { stdio: 'ignore' });
  r = reconcile(join(dir, 'a'), { dry: true });
  await new Promise((ok) => (signer.exitCode !== null ? ok() : signer.on('exit', ok)));
  check('a merge still signing its commit five seconds on is not listed as stopped partway (round 30)', !r.left.some((l) => l.what.includes('a merge stopped partway')));

  // Round 46: a chat opened while another's pass is fetching gets a worktree on a new
  // branch at main's tip. The pass read the folders before its fetch, so the branch was
  // not counted as checked out, `git branch -d` refused it (checked out) and update-ref
  // deleted it under the live chat, whose saves then made root commits. The fetch is
  // slowed here so the chat opens inside it.
  execFileSync('git', ['clone', '-q', join(dir, 'remote.git'), join(dir, 'c')], { stdio: 'ignore' });
  const c = at('c');
  const slow = join(dir, 'slow-upload-pack');
  writeFileSync(slow, '#!/bin/sh\nsleep 3\nexec git-upload-pack "$@"\n', { mode: 0o755 });
  c('config', 'remote.origin.uploadpack', slow);
  const opener = spawn(process.execPath, ['-e', `setTimeout(() => require('child_process').execFileSync('git', ['-C', ${JSON.stringify(join(dir, 'c'))}, 'worktree', 'add', '-q', '-b', 'claude/new-chat', ${JSON.stringify(join(dir, 'c-new'))}, 'main'], { stdio: 'ignore' }), 1000)`], { stdio: 'ignore' });
  reconcile(join(dir, 'c'));
  await new Promise((ok) => (opener.exitCode !== null ? ok() : opener.on('exit', ok)));
  check('a chat\'s branch made while the pass fetched is never deleted under it (round 46)', c('for-each-ref', '--format=%(refname)', 'refs/heads/claude/new-chat') === 'refs/heads/claude/new-chat');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('reconcile: all cases hold');
