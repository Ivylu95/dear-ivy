// Rule test: a save from a session branch lands on main, not only on its branch.
//
// With the Actions minutes spent (2026-10-13), merge-sessions stopped, and every
// phone save stayed on its `claude/` branch where no later session reads it.
// save-record.mjs now pushes to main first. This checks, against a throwaway
// bare remote, that a save reaches main; that one made after main moved on
// reaches it too, by a merge; that one main cannot take without a conflict
// still leaves the machine, on the session's own branch, which is otherwise
// never pushed (DEP-011); and that a development
// branch, which can hold unfinished harness work, is never pushed to main.
//
// Never this repository: the hook reads CLAUDE_PROJECT_DIR, set to the copy, and
// no inherited GIT_* variable is passed on. Exits non-zero on any failure. Run
// by selftest.mjs.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-save-main-');
const repo = join(dir, 'repo');
const other = join(dir, 'other');
const remote = join(dir, 'remote.git');
// Never DEAR_RECORD_READONLY: the selftest sets it, and the save hook's sync then never runs.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && k !== 'DEAR_RECORD_READONLY'));
const gitIn = (cwd) => (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const git = gitIn(repo);
const onRemote = (...args) => execFileSync('git', ['--git-dir', remote, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const has = (ref, path, text) => {
  try { return onRemote('show', `${ref}:${path}`).includes(text); } catch { return false; }
};

let failed = 0;
const check = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};
const save = (text, input = {}) => {
  writeFileSync(join(repo, 'data', 'core', 'note.md'), `${text}\n`);
  return spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: JSON.stringify(input), encoding: 'utf8', timeout: 60000,
  });
};
// Another session's save, straight to main.
const moveMain = (path, text) => {
  const o = gitIn(other);
  o('pull', '-q', 'origin', 'main');
  mkdirSync(dirname(join(other, path)), { recursive: true });
  writeFileSync(join(other, path), `${text}\n`);
  o('add', '-A');
  o('commit', '-qm', 'another session');
  o('push', '-q', 'origin', 'HEAD:main');
};

try {
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { env });
  for (const part of ['.claude', 'modules']) copyTree(join(root, part), join(repo, part), { filter: (s) => !/[\\/](node_modules|state)$/.test(s) });
  mkdirSync(join(repo, 'data', 'core'), { recursive: true });
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'start\n');
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('remote', 'add', 'origin', remote);
  git('add', '-A');
  git('commit', '-qm', 'start');
  git('push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', remote, other], { env });
  for (const [k, v] of [['user.email', 'test@example.invalid'], ['user.name', 'test'], ['core.hooksPath', '/dev/null']]) gitIn(other)('config', k, v);
  git('switch', '-q', '-c', 'claude/a-session');

  // PMM-014: the save names the procedures the session loaded, one trailer each;
  // the commit's own tree is their version.
  const transcript = join(dir, 'transcript.jsonl');
  const skill = (name) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id: name, name: 'Skill', input: { skill: name } }] } });
  writeFileSync(transcript, [{ type: 'user', message: { content: 'hi' } }, skill('something-happened'), skill('a-person'), skill('a-person')].map((e) => JSON.stringify(e)).join('\n') + '\n');
  let run = save('first save', { transcript_path: transcript });
  check('a session-branch save reaches main', run.status === 0 && has('main', 'data/core/note.md', 'first save'));
  check('and names each procedure the session loaded, once (PMM-014)', onRemote('log', '-1', '--format=%B', 'main').trim() === 'record: session update\n\nProcedure: something-happened\nProcedure: a-person');
  // DEP-011: main holds everything, so the session's own branch is not pushed beside it.
  check('and no branch of its own is made on the remote', !execFileSync('git', ['ls-remote', '--heads', remote, 'claude/a-session'], { env, encoding: 'utf8' }).trim());

  // CON-017: a lesson written to FEEDBACK.md in her chat is saved too, in a commit of
  // its own after the record's, so a refused lesson never holds back her words.
  writeFileSync(join(repo, 'FEEDBACK.md'), '# Feedback\n\n- Rule: a lesson.\n  Why: a reason.\n');
  run = save('a save beside a lesson');
  const lessonSubjects = onRemote('log', '-2', '--format=%s', 'main').trim().split('\n');
  check('a lesson in FEEDBACK.md reaches main beside the record', run.status === 0 && has('main', 'FEEDBACK.md', 'Rule: a lesson.') && has('main', 'data/core/note.md', 'a save beside a lesson'));
  check('in a commit of its own, after the record', lessonSubjects[0]?.startsWith('chore(feedback)') && lessonSubjects[1]?.startsWith('record:'));

  moveMain('data/core/elsewhere.md', 'from another session');
  run = save('second save');
  check('a save after main moved on reaches main, by a merge', run.status === 0
    && has('main', 'data/core/note.md', 'second save') && has('main', 'data/core/elsewhere.md', 'from another session'));

  moveMain('data/core/note.md', 'a clashing edit');
  run = save('third save');
  check('a save main cannot take still leaves the machine, on its branch', has('claude/a-session', 'data/core/note.md', 'third save'));
  check('and main keeps what it had', has('main', 'data/core/note.md', 'a clashing edit'));

  // A development branch can hold unfinished harness work: it keeps its own push.
  git('switch', '-q', '-c', 'dev-work', 'origin/main');
  run = save('a development save');
  check('a development branch is never pushed to main', !has('main', 'data/core/note.md', 'a development save')
    && has('dev-work', 'data/core/note.md', 'a development save'));

  // A heartbeat job's branch holding no record change is its run's to land, never
  // the save's to push: hb-code-upkeep-20261026 reached GitHub, with a rescue copy
  // (edge-case run of 2026-10-29).
  git('switch', '-q', '-c', 'hb-code-upkeep-20261026', 'origin/main');
  writeFileSync(join(repo, 'harness.md'), 'a job change\n');
  git('add', 'harness.md');
  git('commit', '-qm', 'a job change');
  run = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  const heads = onRemote('for-each-ref', '--format=%(refname)', 'refs/heads');
  check('a heartbeat job branch with no record change is never pushed, nor rescued', run.status === 0 && !/hb-code-upkeep/.test(heads)
    && !existsSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md')));

  // A copy with no name set: git refused every save commit, silently (review, 2026-10-16).
  git('switch', '-q', '-c', 'claude/anon', 'origin/main');
  git('config', '--unset', 'user.email');
  git('config', '--unset', 'user.name');
  const noName = { ...env, GIT_CONFIG_GLOBAL: join(dir, 'no-global'), GIT_CONFIG_NOSYSTEM: '1', HOME: join(dir, 'no-home') };
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'a save with no name set\n');
  spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...noName, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  check('a copy with no name set still saves to main', has('main', 'data/core/note.md', 'a save with no name set'));
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');

  // A merge stopped partway: the save cannot commit, and must say so rather
  // than pass, or push older commits and call them saved (review, 2026-10-16).
  moveMain('data/core/clash.md', 'theirs');
  git('fetch', '-q', 'origin');
  mkdirSync(join(repo, 'data', 'core'), { recursive: true });
  writeFileSync(join(repo, 'data', 'core', 'clash.md'), 'mine\n');
  git('add', '-A');
  git('commit', '-qm', 'mine');
  spawnSync('git', ['merge', '-q', 'origin/main'], { cwd: repo, env, stdio: 'ignore' });
  run = save('words during a stopped merge');
  check('a save during a stopped merge blocks the turn and says why', /"decision"\s*:\s*"block"/.test(run.stdout) && /merge is stopped partway/.test(run.stdout));
  check('and no rescue reads as saved', !onRemote('for-each-ref', '--format=%(refname)', 'refs/heads').includes('rescue/'));
  spawnSync('git', ['merge', '--abort'], { cwd: repo, env, stdio: 'ignore' });

  // The failure flag never rides a later, successful save to GitHub (review, 2026-10-16).
  git('switch', '-q', '-C', 'claude/flag', 'origin/main');
  git('pull', '-q', 'origin', 'main');
  run = save('a save after a failure');
  check('a successful save reaches main', has('main', 'data/core/note.md', 'a save after a failure'));
  check('and the failure flag never does', !has('main', 'data/core/state/PUSH_FAILED.md', ''));

  // A passing lock is waited out, never read as a refusal (review, 2026-10-16).
  const lock = join(repo, '.git', 'index.lock');
  writeFileSync(lock, '');
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'a save behind a passing lock\n');
  const waited = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], { cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo } });
  waited.stdin.end('{}');
  let out = '';
  waited.stdout.on('data', (d) => (out += d));
  setTimeout(() => rmSync(lock, { force: true }), 1000);
  await new Promise((resolve) => waited.on('close', resolve));
  check('a save behind a passing lock still lands', !/"decision"\s*:\s*"block"/.test(out) && has('main', 'data/core/note.md', 'a save behind a passing lock'));

  // Round 4 of the review, 2026-10-16.
  // A flag an ordinary `git add data/` committed is taken out of main by the next save.
  const flag = join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md');
  mkdirSync(dirname(flag), { recursive: true });
  writeFileSync(flag, 'an old failure\n');
  git('add', '-f', '--', 'data/core/state/PUSH_FAILED.md');
  git('commit', '-qm', 'a flag committed by hand');
  run = save('a save after the flag was committed');
  check('a committed flag is taken out of main by the next save', has('main', 'data/core/note.md', 'a save after the flag was committed') && !has('main', 'data/core/state/PUSH_FAILED.md', ''));

  // A flag is cleared once the record is on GitHub, however it got there.
  writeFileSync(flag, 'a failure since pushed by hand\n');
  run = save('a save after the flag was committed');
  check('the flag is cleared once nothing is left unsaved', !existsSync(flag));

  // A record file left in conflict by a stopped merge is never staged with its
  // markers, which git would read as resolved (review round 5, 2026-10-16).
  moveMain('data/core/note.md', 'their side of the note');
  git('fetch', '-q', 'origin');
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'my side of the note\n');
  git('add', '-A', '--', 'data/');
  git('commit', '-qm', 'my side');
  spawnSync('git', ['merge', '-q', 'origin/main'], { cwd: repo, env, stdio: 'ignore' });
  run = save('words written mid-conflict');
  check('a conflicted record file stays unmerged, never staged with its markers', git('ls-files', '-u', '--', 'data/core/note.md').trim() !== '' && /merge is stopped partway/.test(run.stdout));
  spawnSync('git', ['merge', '--abort'], { cwd: repo, env, stdio: 'ignore' });

  // A stalled connection still ends in a note and a block, not a silent kill.
  git('config', 'remote.origin.receivepack', 'sleep 30; git-receive-pack');
  git('config', 'remote.origin.uploadpack', 'sleep 30; git-upload-pack');
  writeFileSync(join(repo, 'data', 'core', 'note.md'), 'a save on a stalled connection\n');
  const t0 = Date.now();
  const stalled = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SAVE_NET_MS: '1500' }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  check('a stalled connection still writes the note and says so, in time', Date.now() - t0 < 30000 && existsSync(flag) && /"decision"\s*:\s*"block"/.test(stalled.stdout));
  git('config', '--unset', 'remote.origin.receivepack');
  git('config', '--unset', 'remote.origin.uploadpack');

  // A branch whose GitHub copy moved on: the save merges it in, and the merge
  // message never names the branch (review, 2026-10-16).
  git('switch', '-q', '-C', 'dev-person-s-talk', 'origin/main');
  git('push', '-q', 'origin', 'dev-person-s-talk');
  const o2 = gitIn(other);
  o2('fetch', '-q', 'origin');
  o2('switch', '-q', '-C', 'dev-person-s-talk', 'origin/dev-person-s-talk');
  writeFileSync(join(other, 'elsewhere.txt'), 'moved on\n');
  o2('add', '-A');
  o2('commit', '-qm', 'another session');
  o2('push', '-q', 'origin', 'dev-person-s-talk');
  run = save('a save behind its own branch');
  check('a save behind its own GitHub branch lands there', has('dev-person-s-talk', 'data/core/note.md', 'a save behind its own branch'));
  check('and its merge message never names the branch', !onRemote('log', '--format=%s', 'dev-person-s-talk').includes('person-s'));

  // A save stuck on a conflict with main leaves one rescue branch, not one a turn (review, 2026-10-16).
  git('switch', '-q', '-C', 'main', 'origin/main');
  moveMain('data/core/stuck.md', 'theirs');
  writeFileSync(join(repo, 'data', 'core', 'stuck.md'), 'mine\n');
  save('a stuck save');
  // Its own merge, which conflicts, is undone: only another chat's is left alone (round 32).
  check('a save\'s own merge that conflicts is undone, never left half-done', !existsSync(join(repo, '.git', 'MERGE_HEAD')) && git('ls-files', '-u').trim() === '');
  save('a stuck save, again');
  const rescues = () => onRemote('for-each-ref', '--format=%(refname)', 'refs/heads/rescue').split('\n').filter(Boolean);
  const before = rescues().length;
  writeFileSync(join(repo, 'data', 'core', 'stuck.md'), 'mine\n');
  save('a stuck save, a third time');
  check('a stuck save makes one rescue branch, not one a turn', before >= 1 && rescues().length === before);

  // A new record file the add fails on is never left unsaid (review, 2026-10-16):
  // a nested repository inside data/ makes `git add` fail.
  git('switch', '-q', '-C', 'claude/add-fails', 'origin/main');
  mkdirSync(join(repo, 'data', 'core', 'journal'), { recursive: true });
  writeFileSync(join(repo, 'data', 'core', 'journal', '2026-10-16-new.md'), 'a new entry\n');
  execFileSync('git', ['init', '-q', join(repo, 'data', 'core', 'nested')], { env });
  run = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, input: '{}', encoding: 'utf8', timeout: 60000,
  });
  check('a new record file the add fails on blocks the turn and says why', /"decision"\s*:\s*"block"/.test(run.stdout) && /could not add a new record file/.test(run.stdout));
  rmSync(join(repo, 'data', 'core', 'nested'), { recursive: true, force: true });

  // The turn-end sync never runs its own half-written code: hooks run from the
  // working tree, and on 2026-10-15 an untested edit pushed eleven commits to
  // main at a turn's end. With the sync's code edited and uncommitted, it waits.
  git('switch', '-q', '-C', 'main', 'origin/main');
  git('pull', '-q', 'origin', 'main');
  const o3 = gitIn(other);
  o3('fetch', '-q', 'origin');
  o3('switch', '-q', '-C', 'claude/waiting', 'origin/main');
  mkdirSync(join(other, 'data', 'core'), { recursive: true });
  writeFileSync(join(other, 'data', 'core', 'waiting.md'), 'words\n');
  o3('add', '-A');
  o3('commit', '-qm', 'another session');
  o3('push', '-q', 'origin', 'claude/waiting');
  const stamp = join(repo, '.git', 'dear-synced');
  const branchesLib = join(repo, '.claude', 'hooks', 'lib', 'branches.mjs');
  rmSync(stamp, { force: true });
  writeFileSync(branchesLib, `${readFileSync(branchesLib, 'utf8')}\n// an edit in progress\n`);
  save('a save while the sync is being edited');
  check("the turn-end sync waits while its own code has uncommitted edits", !has('main', 'data/core/waiting.md', 'words'));
  git('checkout', '-q', '--', '.claude/hooks/lib/branches.mjs');
  rmSync(stamp, { force: true });
  save('a save once the edit is gone');
  check('and runs again once the edit is gone', has('main', 'data/core/waiting.md', 'words'));

  // B9 (round 3): a sync stamp dated ahead of the clock is no recent sync.
  o3('switch', '-q', '-C', 'claude/waiting2', 'origin/main');
  writeFileSync(join(other, 'data', 'core', 'waiting2.md'), 'more words\n');
  o3('add', '-A');
  o3('commit', '-qm', 'another session');
  o3('push', '-q', 'origin', 'claude/waiting2');
  const ahead = new Date(Date.now() + 86400e3);
  utimesSync(stamp, ahead, ahead);
  save('a save with the sync stamp a day ahead');
  check('a sync stamp a day ahead does not stop the turn-end sync (B9)', has('main', 'data/core/waiting2.md', 'more words'));

  // Another session's uncommitted file sits where main's new commit writes, so a
  // merge in this folder is refused: the save still lands on main, merged
  // without a working tree, and the other file is left as it was (2026-10-10,
  // six saves stuck on one machine until merged by hand).
  git('switch', '-q', '-C', 'main', 'origin/main');
  git('pull', '-q', 'origin', 'main');
  moveMain('notes/shared.md', 'theirs');
  mkdirSync(join(repo, 'notes'), { recursive: true });
  writeFileSync(join(repo, 'notes', 'shared.md'), 'another session, unsaved\n');
  const rescuesBefore = onRemote('for-each-ref', '--format=%(refname)', 'refs/heads/rescue').split('\n').filter(Boolean).length;
  run = save('a save beside unsaved files');
  check('a save behind main lands there though unsaved files block a merge here', run.status === 0 && has('main', 'data/core/note.md', 'a save beside unsaved files') && has('main', 'notes/shared.md', 'theirs'));
  check('and the unsaved file here is untouched, with no rescue branch made', readFileSync(join(repo, 'notes', 'shared.md'), 'utf8') === 'another session, unsaved\n'
    && onRemote('for-each-ref', '--format=%(refname)', 'refs/heads/rescue').split('\n').filter(Boolean).length === rescuesBefore);
  rmSync(join(repo, 'notes'), { recursive: true, force: true });

  // No commit the save made names a branch: a chat's branch takes its name
  // from the topic, and the commit gate refuses a name from the record (review, 2026-10-16).
  const subjects = git('log', '--all', '--format=%s').split('\n');
  check('no save commit names a branch', !subjects.some((t) => /claude\/|dev-work/.test(t) && !/^(another session|mine|my side|a flag committed by hand)$/.test(t)));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
