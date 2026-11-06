// Rule test for the remote half of reconcile() in lib/branches.mjs (DEP-011): every
// branch on GitHub but main is brought into main, and nothing is ever lost.
// Against a throwaway bare remote and clones, never this repository. The incident:
// 22 branches beside main on GitHub on 2026-10-15, after the workflow that cleared
// them stopped running, and a shallow cloud clone that read merged branches as
// unmerged. Run by the hook self-test.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { canMergeTree, reconcile } from './branches.mjs';
import { makeTemp } from './temp-litter.mjs';

const dir = makeTemp('dear-sync-');
const remote = join(dir, 'remote.git');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const OLD = '2020-01-01T00:00:00Z';
const run = (cwd, args, extra = {}) =>
  execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const at = (repo) => (...args) => run(join(dir, repo), args);
const write = (repo, file, text = file) => {
  mkdirSync(dirname(join(dir, repo, file)), { recursive: true });
  writeFileSync(join(dir, repo, file), text);
};
const commit = (repo, file, text, { old = false } = {}) => {
  write(repo, file, text);
  run(join(dir, repo), ['add', file]);
  run(join(dir, repo), ['commit', '-q', '-m', file], old ? { GIT_COMMITTER_DATE: OLD, GIT_AUTHOR_DATE: OLD } : {});
};
const onGitHub = () => run(dir, ['ls-remote', '--heads', remote]).split('\n').filter(Boolean).map((l) => l.split('refs/heads/')[1]);
const mainHas = (tip) => {
  try {
    run(dir, ['--git-dir', remote, 'merge-base', '--is-ancestor', tip, 'main']);
    return true;
  } catch {
    return false;
  }
};
const mainFile = (file) => {
  try {
    return run(dir, ['--git-dir', remote, 'show', `main:${file}`]);
  } catch {
    return null;
  }
};

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  run(dir, ['init', '-q', '--bare', '-b', 'main', remote]);
  run(dir, ['clone', '-q', remote, join(dir, 'other')]);
  const other = at('other');
  other('checkout', '-q', '-b', 'main');
  commit('other', 'base.txt', 'base\n');
  commit('other', 'data/core/timeline.md', 'one\n');
  other('push', '-q', 'origin', 'main');

  // A chat's branch with a save main lacks: merged in whole.
  other('checkout', '-q', '-b', 'claude/chat-a');
  commit('other', 'data/core/journal/a.md', 'her words\n');
  other('push', '-q', 'origin', 'claude/chat-a');
  const chatA = other('rev-parse', 'HEAD');

  // A chat's branch that conflicts with main: left, untouched.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'claude/chat-b');
  commit('other', 'data/core/timeline.md', 'chat b\n');
  other('push', '-q', 'origin', 'claude/chat-b');
  const chatB = other('rev-parse', 'HEAD');
  other('checkout', '-q', 'main');
  commit('other', 'data/core/timeline.md', 'main moved\n');
  other('push', '-q', 'origin', 'main');

  // A rescued save from a detached checkout, record only: merged in.
  other('checkout', '-q', '-b', 'rescue/detached-x');
  commit('other', 'data/core/people/a.md', 'a person\n', { old: true });
  other('push', '-q', 'origin', 'rescue/detached-x');

  // An unattended run's branch idle for years: retired into main's history, files unchanged.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'hb-idea-20200101');
  commit('other', 'idea.txt', 'unfinished\n', { old: true });
  other('push', '-q', 'origin', 'hb-idea-20200101');
  const idea = other('rev-parse', 'HEAD');

  // One from today: left for a day, in case it is live.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'hb-today');
  commit('other', 'today.txt', 'live\n');
  other('push', '-q', 'origin', 'hb-today');
  const today = other('rev-parse', 'HEAD');

  // A person's own branch, idle for years: never retired, since merging it later
  // would then silently skip its work (review, 2026-10-16). Only listed.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'feat/mine');
  commit('other', 'feature.txt', 'mine\n', { old: true });
  other('push', '-q', 'origin', 'feat/mine');
  const feat = other('rev-parse', 'HEAD');

  // Record and harness together, not a chat's: left, so her words are not retired unapplied.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'mixed');
  write('other', 'data/core/me/x.md', 'hers\n');
  write('other', 'tool.txt', 'harness\n');
  other('add', '-A');
  run(join(dir, 'other'), ['commit', '-q', '-m', 'mixed'], { GIT_COMMITTER_DATE: OLD, GIT_AUTHOR_DATE: OLD });
  other('push', '-q', 'origin', 'mixed');
  const mixed = other('rev-parse', 'HEAD');

  // Already merged: counted as in main.
  other('checkout', '-q', 'main');
  other('checkout', '-q', '-b', 'claude/done');
  commit('other', 'done.txt', 'done\n');
  other('checkout', '-q', 'main');
  other('merge', '-q', '--no-edit', 'claude/done');
  other('push', '-q', 'origin', 'main', 'claude/done');
  other('branch', '-q', '-d', 'claude/done');

  // This copy: a shallow clone, as a cloud session gets.
  run(dir, ['clone', '-q', '--depth', '1', '--no-single-branch', `file://${remote}`, join(dir, 'here')]);
  const here = at('here');
  const mainBefore = run(dir, ['--git-dir', remote, 'rev-parse', 'main']);

  let r = reconcile(join(dir, 'here'), { dry: true });
  check('a dry run changes nothing on GitHub', run(dir, ['--git-dir', remote, 'rev-parse', 'main']) === mainBefore);
  check('a shallow clone is deepened, so a merged branch is not read as unmerged', here('rev-parse', '--is-shallow-repository') === 'false' && !r.left.some((l) => l.what.includes('claude/done')));

  r = reconcile(join(dir, 'here'));
  check("a chat's branch is merged into main on GitHub", mainHas(chatA) && mainFile('data/core/journal/a.md') === 'her words');
  check('a record-only rescue branch is merged into main', mainFile('data/core/people/a.md') === 'a person');
  check("a conflicting chat branch stays out of main, untouched, and is handed on", !mainHas(chatB) && onGitHub().includes('claude/chat-b') && r.left.some((l) => l.what.includes('claude/chat-b') && !l.quiet));
  check("main's files are not changed by the conflict", mainFile('data/core/timeline.md') === 'main moved');
  check("an idle harness branch is retired: in main's history, its files not applied", mainHas(idea) && mainFile('idea.txt') === null);
  check('the retire names the branch and its tip, to find it again', run(dir, ['--git-dir', remote, 'log', '-1', '--grep', 'retire', '--format=%B', 'main']).includes(`hb-idea-20200101 at ${idea}`));
  check("a person's own branch is never retired, and is listed without being handed on", !mainHas(feat) && r.left.some((l) => l.what.includes('feat/mine') && l.quiet));
  check("today's harness branch is left alone", !mainHas(today) && r.notes.some((n) => n.includes('last day')));
  check('record mixed with harness work is never retired, and is reported as saves not in main, not handed on', !mainHas(mixed) && r.left.some((l) => l.what.includes('mixed') && l.quiet && l.savesOff === 'mixed'));
  check('nothing on GitHub is deleted here (the workflow deletes)', ['claude/chat-a', 'hb-idea-20200101', 'claude/done'].every((b) => onGitHub().includes(b)));
  check('what is now in main is counted for the workflow', r.notes.some((n) => /in main; the merge-sessions workflow/.test(n)));
  check('this copy ends on main, level with GitHub', here('rev-parse', 'HEAD') === run(dir, ['--git-dir', remote, 'rev-parse', 'main']));

  r = reconcile(join(dir, 'here'));
  check('a second run changes nothing', r.fixed.length === 0);

  // Diverged, cleanly: merged and pushed. Diverged with a conflict: left, unmerged.
  commit('here', 'mine.txt', 'mine\n');
  other('fetch', '-q', 'origin');
  other('merge', '-q', '--ff-only', 'origin/main');
  commit('other', 'theirs.txt', 'theirs\n');
  other('push', '-q', 'origin', 'main');
  r = reconcile(join(dir, 'here'));
  check('a diverged main that merges cleanly is merged and pushed', mainFile('mine.txt') === 'mine' && existsSync(join(dir, 'here', 'theirs.txt')));

  commit('here', 'clash.txt', 'mine\n');
  other('fetch', '-q', 'origin');
  other('merge', '-q', '--ff-only', 'origin/main');
  commit('other', 'clash.txt', 'theirs\n');
  other('push', '-q', 'origin', 'main');
  const before = here('rev-parse', 'HEAD');
  r = reconcile(join(dir, 'here'));
  check('a diverged main that conflicts is left as it was, and handed on', here('rev-parse', 'HEAD') === before && readFileSync(join(dir, 'here', 'clash.txt'), 'utf8') === 'mine\n' && r.left.some((l) => l.why.includes('conflict') && !l.quiet));
  here('merge', '-q', '-s', 'ours', '--no-edit', 'origin/main');
  here('push', '-q', 'origin', 'main');

  // Local branches: an unattended run's, idle, is retired and deleted; a fresh
  // one stays; a person's own, however old, stays.
  here('checkout', '-q', '-b', 'hb-old-local');
  commit('here', 'old-local.txt', 'x\n', { old: true });
  here('checkout', '-q', 'main');
  here('checkout', '-q', '-b', 'hb-new-local');
  commit('here', 'new-local.txt', 'y\n');
  here('checkout', '-q', 'main');
  here('checkout', '-q', '-b', 'my-old-idea');
  commit('here', 'my-idea.txt', 'w\n', { old: true });
  here('checkout', '-q', 'main');
  const oldLocal = here('rev-parse', 'hb-old-local');
  r = reconcile(join(dir, 'here'));
  check("an idle run's branch only this copy holds is retired into main, then deleted here", mainHas(oldLocal) && here('branch', '--list', 'hb-old-local') === '');
  check('a fresh local branch stays', here('branch', '--list', 'hb-new-local') !== '');
  check("a person's own local branch stays, however old", here('branch', '--list', 'my-old-idea') !== '');

  // A branch just made, with no commit yet, sits at main's tip and reads as
  // merged: the folder is never switched off it, nor the branch deleted (review, 2026-10-16).
  here('checkout', '-q', '-b', 'just-made');
  write('here', 'new.js', 'untracked\n');
  r = reconcile(join(dir, 'here'));
  check('a branch just made is kept, and the folder stays on it', here('rev-parse', '--abbrev-ref', 'HEAD') === 'just-made' && here('branch', '--list', 'just-made') !== '');
  here('checkout', '-q', 'main');

  // On a chat's own branch: a merged branch is still cleared, though `git branch -d` judges by HEAD.
  here('branch', 'finished', 'main');
  here('checkout', '-q', '-b', 'claude/live');
  commit('here', 'live.txt', 'z\n');
  r = reconcile(join(dir, 'here'));
  check("a merged branch is cleared while the folder is on a chat's branch", here('branch', '--list', 'finished') === '');
  check("the chat's own branch is never touched", here('rev-parse', '--abbrev-ref', 'HEAD') === 'claude/live');
  check("the chat's own branch is never handed on as something to settle", !r.left.some((l) => l.what.includes('claude/live') && !l.quiet));

  // GitHub refusing main (a phone session's proxy did): no false conflict, no
  // push per branch, one note (review, 2026-10-16).
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  for (const b of ['claude/r1', 'claude/r2']) {
    other('checkout', '-q', '-b', b, 'main');
    commit('other', `data/core/${b.replace('/', '-')}.md`, 'words\n');
    other('push', '-q', 'origin', b);
  }
  const hook = join(remote, 'hooks', 'pre-receive');
  writeFileSync(hook, '#!/bin/sh\nwhile read o n ref; do [ "$ref" = refs/heads/main ] && exit 1; done\nexit 0\n', { mode: 0o755 });
  here('checkout', '-q', 'claude/live');
  r = reconcile(join(dir, 'here'));
  check('a refused push to main is never reported as a conflict', !r.left.some((l) => l.why.includes('conflict') && !l.what.includes('chat-b')));
  check('nothing but a real conflict is handed on', r.left.filter((l) => !l.quiet).every((l) => /chat-b|mixed/.test(l.what)));
  check('a refused push is said once, as a note', r.notes.filter((n) => n.includes('refused a push')).length === 1);
  rmSync(hook);

  // Nothing is said twice, however often main is compared in a pass.
  const whats = r.left.map((l) => l.what);
  check('each thing left is listed once', whats.length === new Set(whats).size);

  // A copy with no name set still merges a diverged main.
  run(dir, ['clone', '-q', remote, join(dir, 'anon')]);
  const anon = (...a) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...a], { cwd: join(dir, 'anon'), env: { ...env, GIT_CONFIG_GLOBAL: join(dir, 'none'), GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  anon('-c', 'user.name=a', '-c', 'user.email=a@a', 'commit', '-q', '--allow-empty', '-m', 'anon local');
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'anon-theirs.txt', 'x\n');
  other('push', '-q', 'origin', 'main');
  const prevGlobal = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = join(dir, 'none');
  try {
    r = reconcile(join(dir, 'anon'));
  } finally {
    if (prevGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = prevGlobal;
  }
  check('a copy with no name set still merges a diverged main', existsSync(join(dir, 'anon', 'anon-theirs.txt')) && mainHas(anon('rev-parse', 'HEAD')));

  // Round 2 of the review, 2026-10-16.
  // A finished, idle worktree holding record files git ignores is never removed:
  // removing it would delete them.
  // (The ignore rule goes in the shared info/exclude, which every worktree reads.)
  here('checkout', '-q', 'main');
  writeFileSync(join(dir, 'here', '.git', 'info', 'exclude'), 'data/archive-local/\n');
  const wt = join(dir, 'wt');
  here('worktree', 'add', '-q', '-b', 'claude/w', wt, 'main');
  mkdirSync(join(wt, 'data', 'archive-local'), { recursive: true });
  writeFileSync(join(wt, 'data', 'archive-local', 'kept.md'), 'kept\n');
  const longAgo = new Date(Date.now() - 3 * 86400000);
  utimesSync(join(run(wt, ['rev-parse', '--absolute-git-dir']), 'index'), longAgo, longAgo);
  r = reconcile(join(dir, 'here'));
  check('a finished worktree holding ignored record files is never removed', existsSync(join(wt, 'data', 'archive-local', 'kept.md')));

  // The main folder on a person's branch, or one just made, is never handed on to switch.
  here('checkout', '-q', '-b', 'person-work');
  commit('here', 'person.txt', 'p\n');
  r = reconcile(join(dir, 'here'));
  check("the main folder on a person's branch is not handed on", r.left.filter((l) => !l.quiet).every((l) => !l.what.includes('the main folder')));
  here('checkout', '-q', 'main');

  // A chat's local branch ahead of its own copy on GitHub reaches main.
  here('checkout', '-q', '-b', 'claude/ahead', 'main');
  commit('here', 'data/core/first.md', 'first\n');
  here('push', '-q', 'origin', 'claude/ahead');
  commit('here', 'data/core/second.md', 'second\n');
  here('checkout', '-q', 'main');
  r = reconcile(join(dir, 'here'));
  check("a chat's branch ahead of its GitHub copy reaches main whole", mainFile('data/core/second.md') === 'second');

  // A diverged main whose merge a hook refuses is undone, never left half-done.
  commit('here', 'mine2.txt', 'mine\n');
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'theirs2.txt', 'theirs\n');
  other('push', '-q', 'origin', 'main');
  const hooks = join(dir, 'refuse-hooks');
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, 'commit-msg'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  here('config', 'core.hooksPath', hooks);
  r = reconcile(join(dir, 'here'));
  here('config', 'core.hooksPath', '/dev/null');
  check('a refused merge of main is undone', !existsSync(join(dir, 'here', '.git', 'MERGE_HEAD')));

  // Offline is nobody's to settle.
  here('remote', 'set-url', 'origin', join(dir, 'gone.git'));
  r = reconcile(join(dir, 'here'));
  check('an unreachable GitHub is noted, never handed on', r.left.some((l) => l.what.includes('could not be reached') && l.quiet));
  here('remote', 'set-url', 'origin', remote);

  // Out of time: no push starts, nothing is called a conflict.
  other('checkout', '-q', '-b', 'claude/late', 'main');
  commit('other', 'data/core/late.md', 'late\n');
  other('push', '-q', 'origin', 'claude/late');
  r = reconcile(join(dir, 'here'), { budgetMs: 0 });
  check('a pass out of time says so, and calls nothing a conflict', r.notes.some((n) => n.includes('ran out of time')) && !r.left.some((l) => l.what.includes('claude/late') && !l.quiet));

  // Round 3 of the review, 2026-10-16.
  // Offline, a leftover chat branch with no conflict is never called a conflict.
  here('checkout', '-q', '-b', 'claude/old-clean', 'main');
  commit('here', 'data/core/old-clean.md', 'old\n');
  here('checkout', '-q', 'main');
  here('remote', 'set-url', 'origin', join(dir, 'gone.git'));
  r = reconcile(join(dir, 'here'));
  check('offline, a clean leftover chat branch is never handed on as a conflict', !r.left.some((l) => l.what.includes('claude/old-clean') && !l.quiet));
  here('remote', 'set-url', 'origin', remote);
  r = reconcile(join(dir, 'here'));
  check('and once online it reaches main', mainFile('data/core/old-clean.md') === 'old');

  // Main checked out nowhere, diverged but clean: merged without a folder.
  here('checkout', '-q', '-b', 'person-two', 'main');
  run(join(dir, 'here'), ['commit', '-q', '--allow-empty', '-m', 'on person-two']);
  here('branch', '-f', 'main', 'origin/main');
  const mainHere = join(dir, 'main-only');
  run(dir, ['clone', '-q', remote, mainHere]);
  run(mainHere, ['commit', '-q', '--allow-empty', '-m', 'theirs again']);
  run(mainHere, ['push', '-q', 'origin', 'main']);
  run(join(dir, 'here'), ['-c', 'core.hooksPath=/dev/null', 'commit', '-q', '--allow-empty', '-m', 'x']);
  const localMain = run(join(dir, 'here'), ['commit-tree', '-p', 'main', '-m', 'mine on main', run(join(dir, 'here'), ['rev-parse', 'main^{tree}'])]);
  here('branch', '-f', 'main', localMain);
  r = reconcile(join(dir, 'here'));
  check('a diverged main checked out nowhere is merged without a folder', mainHas(localMain) && here('rev-parse', 'main') === run(dir, ['--git-dir', remote, 'rev-parse', 'main']));
  check('and the folder on a person\'s branch is never touched', here('rev-parse', '--abbrev-ref', 'HEAD') === 'person-two');
  here('checkout', '-q', 'main');

  // Out of room for a push: none starts, and the pass says so.
  commit('here', 'unpushed.txt', 'u\n');
  r = reconcile(join(dir, 'here'), { budgetMs: 30000 });
  check('with too little time left no push starts', !mainFile('unpushed.txt') && r.notes.some((n) => n.includes('ran out of time')));
  r = reconcile(join(dir, 'here'));

  // The session-start hook reports a chat branch GitHub kept out of main, on fresh refs.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/kept-out', 'origin/main');
  commit('other', 'data/core/kept-out.md', 'k\n');
  other('push', '-q', 'origin', 'claude/kept-out');
  const prune = join(dirname(new URL(import.meta.url).pathname), '..', 'session', 'prune-branches.mjs');
  // Never DEAR_RECORD_READONLY: the selftest sets it, and the hook then only clears local branches.
  const { DEAR_RECORD_READONLY: _ro, ...hookEnv } = env;
  const startHook = () => execFileSync(process.execPath, [prune], { cwd: join(dir, 'here'), env: { ...hookEnv, CLAUDE_PROJECT_DIR: join(dir, 'here') }, input: '{"hook_event_name":"SessionStart"}', encoding: 'utf8' });
  writeFileSync(hook, '#!/bin/sh\nwhile read o n ref; do [ "$ref" = refs/heads/main ] && exit 1; done\nexit 0\n', { mode: 0o755 });
  let said = startHook();
  check('a chat branch GitHub keeps out of main is reported at session start', said.includes('claude/kept-out') && said.includes('Not yet in main'));
  rmSync(hook);
  said = startHook();
  check('one the sync merges in the same start is never reported', !said.includes('claude/kept-out') && mainFile('data/core/kept-out.md') === 'k');

  // Round 49: the start's own landing reaches the chat it opens. The session brief merges main
  // into a chat's branch before this pass lands another chat's saved branch into main, and the
  // stranded note then stays silent (the branch is in main): the chat read a record without
  // those words until its first turn's save brought main in, and was never told.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/landed-at-start', 'origin/main');
  commit('other', 'data/core/landed-at-start.md', 'from another chat\n');
  other('push', '-q', 'origin', 'claude/landed-at-start');
  here('fetch', '-q', 'origin');
  here('checkout', '-q', '-B', 'claude/opening-now', 'origin/main');
  said = startHook();
  check("a chat branch the start lands in main reaches the chat it opens, and the chat is told to read again", mainFile('data/core/landed-at-start.md') === 'from another chat' && existsSync(join(dir, 'here', 'data/core/landed-at-start.md')) && said.includes('now.md'));
  here('checkout', '-q', 'main');
  here('merge', '-q', '--ff-only', 'origin/main');
  here('branch', '-q', '-D', 'claude/opening-now');

  // Round 50: a chat in the sandbox reads data-sandbox/, never her record. Told after that
  // merge to read data/core/state/now.md again, a resumed test chat was sent onto her real
  // record, the one failure the sandbox must not have (lib/sandbox.mjs).
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/landed-in-sandbox', 'origin/main');
  commit('other', 'data/core/landed-in-sandbox.md', 'from another chat\n');
  other('push', '-q', 'origin', 'claude/landed-in-sandbox');
  here('fetch', '-q', 'origin');
  here('checkout', '-q', '-B', 'claude/sandbox-now', 'origin/main');
  write('here', 'data-sandbox/.sessions', 'sandbox-chat\n');
  said = execFileSync(process.execPath, [prune], { cwd: join(dir, 'here'), env: { ...hookEnv, CLAUDE_PROJECT_DIR: join(dir, 'here'), CLAUDE_CODE_REMOTE_SESSION_ID: 'sandbox-chat' }, input: '{"hook_event_name":"SessionStart"}', encoding: 'utf8' });
  check('a sandbox chat is never sent to read her record after that merge', existsSync(join(dir, 'here', 'data/core/landed-in-sandbox.md')) && !said.includes('data/core/state/now.md'));
  rmSync(join(dir, 'here', 'data-sandbox'), { recursive: true, force: true });
  here('checkout', '-q', 'main');
  here('merge', '-q', '--ff-only', 'origin/main');
  here('branch', '-q', '-D', 'claude/sandbox-now');

  // Round 51: the switch is saved to main alone (the save pushes a claude/ branch to main,
  // never to itself), so a test chat resumed on a fresh machine opens on its branch as
  // GitHub last had it, without the switch, until the start's merge brings main in. The
  // record was chosen before that merge, as hers: the chat was sent to read
  // data/core/state/now.md. Main's saved switch counts while the folder lacks main.
  here('fetch', '-q', 'origin');
  here('checkout', '-q', '-B', 'claude/sandbox-resumed', 'origin/main');
  here('push', '-q', 'origin', 'claude/sandbox-resumed');
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/sandbox-switch', 'origin/main');
  commit('other', 'data-sandbox/.sessions', 'resumed-chat\n');
  commit('other', 'data/core/saved-meanwhile.md', 'from another chat\n');
  other('push', '-q', 'origin', 'HEAD:main');
  here('fetch', '-q', 'origin');
  said = execFileSync(process.execPath, [prune], { cwd: join(dir, 'here'), env: { ...hookEnv, CLAUDE_PROJECT_DIR: join(dir, 'here'), CLAUDE_CODE_REMOTE_SESSION_ID: 'resumed-chat' }, input: '{"hook_event_name":"SessionStart"}', encoding: 'utf8' });
  check('a test chat resumed on a branch without its switch is never sent to read her record', existsSync(join(dir, 'here', 'data-sandbox/.sessions')) && !said.includes('data/core/state/now.md'));
  other('rm', '-q', '-r', 'data-sandbox');
  other('commit', '-q', '-m', 'sandbox gone');
  other('push', '-q', 'origin', 'HEAD:main');
  here('fetch', '-q', 'origin');
  here('checkout', '-q', 'main');
  here('merge', '-q', '--ff-only', 'origin/main');
  here('branch', '-q', '-D', 'claude/sandbox-resumed');

  // Round 54, 2026-11-02: a record conflict handed over at the start was settled by taking
  // main's side whole, and the other side's sent marks went with it. The hand-over says how:
  // keep both sides, never one side whole.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/clashes', 'origin/main');
  commit('other', 'data/core/clash.md', 'from the chat\n');
  other('push', '-q', 'origin', 'claude/clashes');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'data/core/clash.md', 'from main\n');
  other('push', '-q', 'origin', 'main');
  here('fetch', '-q', 'origin');
  said = startHook();
  check('a conflict handed over at the start says to keep both sides, never one whole', said.includes('claude/clashes') && /keep(ing)? both sides/.test(said) && /never (by )?tak(e|ing) one side whole/.test(said));
  here('checkout', '-q', 'main');
  here('merge', '-q', '--ff-only', 'origin/main');
  other('push', '-q', 'origin', '--delete', 'claude/clashes');
  here('fetch', '-q', '--prune', 'origin');

  // Round 4 of the review, 2026-10-16.
  // A landing needs room for its push and both fetches: with less, none starts.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/needs-room', 'origin/main');
  commit('other', 'data/core/room.md', 'room\n');
  other('push', '-q', 'origin', 'claude/needs-room');
  r = reconcile(join(dir, 'here'), { budgetMs: 150000 });
  check('a landing starts only with room for all its calls', mainFile('data/core/room.md') === null && r.notes.some((n) => n.includes('ran out of time')));
  r = reconcile(join(dir, 'here'));
  check('and lands on the next full pass', mainFile('data/core/room.md') === 'room');

  // Checked out nowhere, main behind with no time to fetch: noted, never handed on.
  here('checkout', '-q', '-b', 'claude/away', 'main');
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'ahead-of-here.txt', 'a\n');
  other('push', '-q', 'origin', 'main');
  here('fetch', '-q', 'origin');
  r = reconcile(join(dir, 'here'), { budgetMs: 30000 });
  check('main behind and checked out nowhere is never handed on when the pass is late', !r.left.some((l) => l.what.includes('behind GitHub') && !l.quiet));

  // A settle worktree on main is removed once main matches GitHub's, so the main folder can switch back.
  r = reconcile(join(dir, 'here'));
  const aside = join(dir, 'main-settle');
  here('worktree', 'add', '-q', aside, 'main');
  r = reconcile(join(dir, 'here'));
  check('a settle worktree is removed once main matches GitHub', !existsSync(aside));
  here('checkout', '-q', 'main');
  check('and the main folder can switch back to main', here('rev-parse', '--abbrev-ref', 'HEAD') === 'main');

  // Round 5: a turn's end has under three minutes, yet still lands a branch
  // with its shorter per-call limit (review, 2026-10-16).
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/at-turn-end', 'origin/main');
  commit('other', 'data/core/turn-end.md', 't\n');
  other('push', '-q', 'origin', 'claude/at-turn-end');
  r = reconcile(join(dir, 'here'), { budgetMs: 170000, netMs: 15000 });
  check("a turn's end lands a chat branch within its budget", mainFile('data/core/turn-end.md') === 't');

  // Round 16 (review, 2026-10-16).
  // Run from a subfolder (npm runs reconcile from ux/), a settle command's spare
  // copy of main still goes beside the main folder, never inside it.
  here('checkout', '-q', '-b', 'person-three', 'main');
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/clash-again', 'origin/main');
  commit('other', 'data/core/clash3.md', 'theirs\n');
  other('push', '-q', 'origin', 'claude/clash-again');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'data/core/clash3.md', 'main side\n');
  other('push', '-q', 'origin', 'main');
  mkdirSync(join(dir, 'here', 'ux'), { recursive: true });
  r = reconcile(join(dir, 'here', 'ux'));
  const settleCmd = r.left.find((l) => l.what.includes('claude/clash-again'))?.command ?? '';
  check('a settle copy goes beside the main folder, never inside it', settleCmd.includes(`"${join(dir, 'main-settle')}"`) && !settleCmd.includes(join(dir, 'here', 'main-settle')));
  here('checkout', '-q', 'main');

  // A record-only branch whose file name has non-ASCII letters is still read as record work.
  other('checkout', '-q', '-B', 'rescue/detached-accents', 'origin/main');
  commit('other', 'data/core/people/person-ë.md', 'z\n', { old: true });
  other('push', '-q', 'origin', 'rescue/detached-accents');
  r = reconcile(join(dir, 'here'));
  check('a record file with non-ASCII letters is merged as record work', mainFile('data/core/people/person-ë.md') === 'z');

  // Round 19 (review, 2026-10-16): record words already in main are not pending.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'feat/with-words', 'origin/main');
  write('other', 'data/core/same.md', 'same\n');
  write('other', 'tool2.txt', 'harness\n');
  other('add', '-A');
  run(join(dir, 'other'), ['commit', '-q', '-m', 'work and words'], { GIT_COMMITTER_DATE: OLD, GIT_AUTHOR_DATE: OLD });
  other('push', '-q', 'origin', 'feat/with-words');
  other('checkout', '-q', '-B', 'main', 'origin/main');
  commit('other', 'data/core/same.md', 'same\n');
  other('push', '-q', 'origin', 'main');
  r = reconcile(join(dir, 'here'));
  check('words a branch holds that main already has are not reported as pending', !r.left.some((l) => l.what.includes('feat/with-words') && (!l.quiet || l.savesOff)));

  // Round 20: the branch this folder is on is never reported as saves missing here.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'feat/here-words', 'origin/main');
  write('other', 'data/core/here-words.md', 'w\n');
  write('other', 'tool3.txt', 'harness\n');
  other('add', '-A');
  other('commit', '-q', '-m', 'words and work');
  other('push', '-q', 'origin', 'feat/here-words');
  here('fetch', '-q', 'origin');
  here('checkout', '-q', '-b', 'feat/here-words', 'origin/feat/here-words');
  const hereSaid = startHook();
  check('the branch this folder is on is never reported as saves missing here', !hereSaid.includes('origin/feat/here-words'));
  // But one behind its GitHub copy lacks words saved from elsewhere, and is named.
  other('checkout', '-q', 'feat/here-words');
  commit('other', 'data/core/more-words.md', 'm\n');
  other('push', '-q', 'origin', 'feat/here-words');
  here('fetch', '-q', 'origin');
  check('the branch this folder is on, behind its GitHub copy, is named', startHook().includes('origin/feat/here-words'));
  here('checkout', '-q', 'main');

  // Round 29: a chat's branch this folder is on, behind its GitHub copy, with GitHub
  // keeping it out of main: words saved there from elsewhere are missing here, and named.
  other('fetch', '-q', 'origin');
  other('checkout', '-q', '-B', 'claude/here-chat', 'origin/main');
  commit('other', 'data/core/here-chat.md', 'c\n');
  other('push', '-q', 'origin', 'claude/here-chat');
  here('fetch', '-q', 'origin');
  here('checkout', '-q', '-b', 'claude/here-chat', 'origin/claude/here-chat');
  writeFileSync(hook, '#!/bin/sh\nwhile read o n ref; do [ "$ref" = refs/heads/main ] && exit 1; done\nexit 0\n', { mode: 0o755 });
  check('a chat branch this folder is on, level with GitHub, is never named', !startHook().includes('origin/claude/here-chat'));
  other('checkout', '-q', 'claude/here-chat');
  commit('other', 'data/core/here-chat-more.md', 'd\n');
  other('push', '-q', 'origin', 'claude/here-chat');
  check('a chat branch this folder is on, behind its GitHub copy kept out of main, is named', startHook().includes('origin/claude/here-chat'));
  rmSync(hook);
  here('checkout', '-q', 'main');

  // Round 47: a check-in's or reminders' checkout kept because neither its push nor its
  // rescue landed (the network was down, .claude/jobs/check-in.md step 6): its commit of
  // her record is on no branch, on this machine only, and nothing pushed it once GitHub
  // could be reached again. Idle an hour, record work alone, it goes up as the job's own
  // rescue would have, and lands; one carrying harness work is never sent.
  here('fetch', '-q', 'origin');
  const kept = join(dir, 'here', 'temp', 'hb-ci-0930');
  here('worktree', 'add', '-q', '--detach', kept, 'origin/main');
  const keptAt = at('here/temp/hb-ci-0930');
  commit('here/temp/hb-ci-0930', 'data/core/state/asked.md', 'an invented question\n');
  const keptTip = keptAt('rev-parse', 'HEAD');
  const harness = join(dir, 'here', 'temp', 'hb-rem-0930');
  here('worktree', 'add', '-q', '--detach', harness, 'origin/main');
  commit('here/temp/hb-rem-0930', 'tool.js', 'not the record\n');
  const harnessTip = at('here/temp/hb-rem-0930')('rev-parse', 'HEAD');
  const idle = (path) => {
    const index = run(path, ['rev-parse', '--absolute-git-dir']);
    const old = new Date(Date.now() - 2 * 24 * 3600e3);
    utimesSync(join(index, 'index'), old, old);
  };
  idle(kept);
  idle(harness);
  r = reconcile(join(dir, 'here'));
  check("a kept check-in checkout's record commit reaches main once GitHub can be reached", mainHas(keptTip) && mainFile('data/core/state/asked.md') === 'an invented question');
  check('and its checkout is cleared once that commit is in main', !existsSync(kept));
  check('a kept checkout carrying harness work is never sent', !mainHas(harnessTip) && !onGitHub().some((b) => b.includes('hb-rem')) && existsSync(harness));

  // An older git cannot merge without a working tree; it is told apart by version.
  check('git older than 2.38 is told apart', !canMergeTree({ out: () => 'git version 2.34.1' }) && canMergeTree({ out: () => 'git version 2.43.0' }) && canMergeTree({ out: () => 'git version 3.0.0' }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('sync: all cases hold');
