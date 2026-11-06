// Rule test: no hook throws away a merge that is under way.
//
// session-brief.mjs merges main into a session branch, and save-record.mjs
// merges the remote before pushing; each ran `git merge --abort` when its merge
// failed. A merge already in progress always makes theirs fail, so the abort
// threw away someone else's half-resolved merge, conflict fixes included: twice
// in one development chat (2026-10-01), the self-test running session-brief.
// And a save whose commit of data/ failed mid-merge retried it unsigned after
// aborting the merge, which was not its own (2026-10-27).
//
// Run against a throwaway clone with its own remote, never this repository:
// both hooks read CLAUDE_PROJECT_DIR, which is set to the clone. Exits non-zero
// on any failure. Run by selftest.mjs.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const hooks = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(hooks, '..', '..');
const dir = makeTemp('dear-merge-');
const HOOKS = ['session/session-brief.mjs', 'record/save-record.mjs'];

/**
 * A fresh repository, mid-merge. Save-record leaves quietly when nothing is
 * unpushed, and reaches its merge only when the remote refuses the push; so the
 * branch holds a commit the remote lacks, and the remote one the branch lacks.
 * Without both, its guard was never reached (2026-10-03).
 */
function midMergeRepo(name, { record = false, words = false } = {}) {
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // A copy of the files, not a clone: the commit gate runs this in a snapshot
  // that is not a repository. Only what the two hooks load: the whole tree
  // (412 MB on 2026-10-03) took this test past the self-test's 30 s limit, and
  // .claude/ alone carried every other session's worktree in with it.
  for (const part of ['.claude', 'modules', 'README.md']) {
    copyTree(join(root, part), join(repo, part), { filter: (src) => !/[\\/](node_modules|worktrees)$/.test(src) });
  }
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-qm', 'the tree as it stands');
  // Two branches that change the same line, so merging one into the other conflicts.
  git('checkout', '-qb', 'other');
  appendFileSync(join(repo, 'README.md'), 'a\n');
  // The incoming side brings a record file too, so the stopped merge holds it
  // staged: the save's commit of data/ then fails ("cannot do a partial commit
  // during a merge"), and its signed-then-unsigned retry aborted the merge
  // (2026-10-27, the self-test run mid-merge, twice).
  if (record) {
    mkdirSync(join(repo, 'data', 'core'), { recursive: true });
    writeFileSync(join(repo, 'data', 'core', 'x.md'), 'made up\n');
    git('add', 'data');
  }
  git('commit', '-qam', 'a');
  git('checkout', '-qb', 'side', 'HEAD~1');
  appendFileSync(join(repo, 'README.md'), 'b\n');
  git('commit', '-qam', 'b');
  execFileSync('git', ['init', '-q', '--bare', remote], { stdio: 'ignore' });
  git('push', '-q', remote, 'other:main', 'side:side');
  git('remote', 'add', 'origin', remote);
  git('fetch', '-q', 'origin');
  // The remote's side moves on without this copy knowing...
  git('checkout', '-qb', 'elsewhere', 'origin/side');
  writeFileSync(join(repo, 'elsewhere.txt'), 'remote\n');
  git('add', 'elsewhere.txt');
  git('commit', '-qm', 'pushed from elsewhere');
  git('push', '-q', 'origin', 'elsewhere:side');
  git('checkout', '-q', 'side');
  git('branch', '-qD', 'elsewhere');
  git('update-ref', 'refs/remotes/origin/side', 'side');
  // ...while this copy holds a commit not yet pushed.
  writeFileSync(join(repo, 'here.txt'), 'local\n');
  git('add', 'here.txt');
  // A record page of her own, already saved, for a turn to write to (round 33).
  if (words) {
    mkdirSync(join(repo, 'data', 'core', 'state'), { recursive: true });
    writeFileSync(join(repo, 'data', 'core', 'state', 'now.md'), '# Now\n\nAn invented week.\n');
    git('add', 'data');
  }
  git('commit', '-qm', 'not yet pushed');
  spawnSync('git', ['merge', '-q', 'origin/main'], { cwd: repo, stdio: 'ignore' });
  if (!existsSync(join(repo, '.git', 'MERGE_HEAD'))) throw new Error('the conflicting merge did not start');
  return { repo, remote };
}

/**
 * Each hook gets its own repository and remote, so one hook's result can never
 * stand in for the other's. The second is a copy of the first, merge under way
 * included, pointed at its own copy of the remote: building each from scratch
 * was most of this test's time (17 s, 2026-10-04).
 */
function copyOf({ repo, remote }, name) {
  const copy = { repo: join(dir, name), remote: join(dir, `${name}.git`) };
  cpSync(repo, copy.repo, { recursive: true });
  cpSync(remote, copy.remote, { recursive: true });
  execFileSync('git', ['remote', 'set-url', 'origin', copy.remote], { cwd: copy.repo, stdio: 'ignore' });
  if (!existsSync(join(copy.repo, '.git', 'MERGE_HEAD'))) throw new Error('the copy lost its merge');
  return copy.repo;
}

/** One hook against its own repository, as Claude Code runs it; the two run side by side. */
const runHook = (hook, repo, extra = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', hook)], {
      cwd: repo,
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo, ...extra },
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    });
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    child.stdin.end('{}');
  });

// Round 31: another chat's merge in this folder, still signing its commit. A merge
// that signs holds MERGE_HEAD and no lock while it signs, and gitSigned gives a
// signer up to SIGNED_MS. An abort while it signs leaves the merge committed and its
// incoming record lines staged as removed, for the next save to commit. A repository
// on a chat's branch, with a signer that is slow once a flag file says so.
function signingRepo(name) {
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  // Signs on purpose, through its own made-up signer below, so the unsigned switch comes off too.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k))); // signs-on-purpose
  const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const part of ['.claude', 'modules', 'README.md']) {
    copyTree(join(root, part), join(repo, part), { filter: (src) => !/[\\/](node_modules|worktrees|state)$/.test(src) });
  }
  const TL = 'data/core/timeline.md';
  const NOW = 'data/core/state/now.md';
  mkdirSync(join(repo, 'data', 'core', 'state'), { recursive: true });
  writeFileSync(join(repo, TL), '# Timeline\n\nAn invented line.\n');
  writeFileSync(join(repo, NOW), '# Now\n\nAn invented week.\n');
  execFileSync('git', ['init', '-q', '--bare', remote], { env, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('remote', 'add', 'origin', remote);
  git('add', '-A');
  git('commit', '-qm', 'start');
  git('push', '-q', 'origin', 'main');
  // What the other chat's merge brings in: a record line saved elsewhere.
  git('checkout', '-qb', 'incoming');
  appendFileSync(join(repo, TL), 'An invented line saved by another chat.\n');
  git('commit', '-qam', 'record: session update');
  // The chat's own branch has moved on too, so the merge makes a commit to sign.
  git('checkout', '-qb', 'claude/live', 'main');
  writeFileSync(join(repo, 'here.txt'), 'local\n');
  git('add', 'here.txt');
  git('commit', '-qm', 'not from the record');
  git('push', '-q', 'origin', 'claude/live');
  const slow = join(dir, `${name}-slow`);
  const signer = join(dir, `${name}-signer.sh`);
  writeFileSync(
    signer,
    `#!/bin/sh\ncat >/dev/null\nif [ -e '${slow}' ]; then rm -f '${slow}'; sleep 6; fi\nprintf '\\n[GNUPG:] SIG_CREATED D 1 8 00 0 X\\n' >&2\nprintf -- '-----BEGIN PGP SIGNATURE-----\\nmade up\\n-----END PGP SIGNATURE-----\\n'\n`,
    { mode: 0o755 },
  );
  git('config', 'gpg.format', 'openpgp');
  git('config', 'gpg.program', signer);
  git('config', 'user.signingkey', 'X');
  git('config', 'commit.gpgSign', 'true');
  // This chat's turn wrote to her record.
  writeFileSync(join(repo, NOW), '# Now\n\nAn invented week, and an invented evening.\n');
  const save = (extra = {}) =>
    new Promise((ok) => {
      const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
        cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SAVE_NET_MS: '15000', DEAR_RECORD_READONLY: '1', ...extra }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      });
      let out = '';
      child.stdout.on('data', (c) => (out += c));
      child.stderr.on('data', (c) => (out += c));
      const timer = setTimeout(() => child.kill(), 90000);
      child.on('close', () => {
        clearTimeout(timer);
        ok(out);
      });
      child.stdin.end('{}');
    });
  // The other chat's merge, its signature slow.
  const merge = () => {
    writeFileSync(slow, '');
    const merging = spawn('git', ['merge', '-q', '--no-edit', '-m', 'merge: main', 'incoming'], { cwd: repo, env, stdio: 'ignore' });
    return new Promise((ok) => merging.on('close', ok));
  };
  const waitFor = async (path) => {
    for (let i = 0; i < 200 && !existsSync(path); i++) await new Promise((ok) => setTimeout(ok, 50));
    return existsSync(path);
  };
  const report = (when, checks, said, round = 31, who = 'record/save-record.mjs') => {
    for (const [what, ok] of checks) {
      if (!ok) failed += 1;
      // A failure on stderr too, which is what the self-test shows of a failing test.
      (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} ${who} ${when} (round ${round}): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
    }
  };
  return { repo, git, TL, NOW, save, merge, waitFor, report, slow, env };
}

// The save's commit of data/ failed beside it ("a partial commit during a merge"), and
// the turn was told to settle the merge with `git merge --abort`. So the save waits
// for a merge marker that fresh, then saves as usual.
async function liveMerge() {
  const { repo, git, TL, NOW, save, merge, waitFor, report } = signingRepo('live-merge');
  git('push', '-q', 'origin', 'incoming:main');
  const mergeDone = merge();
  const signing = await waitFor(join(repo, '.git', 'MERGE_HEAD'));
  const said = await save();
  await mergeDone;
  report('beside a merge still signing', [
    ['the other chat\'s merge was caught while it signed', signing],
    ['the turn is not told to settle a merge still signing', !/merge --abort|stopped partway/.test(said)],
    ['this turn\'s record is saved once the merge is done', git('show', `HEAD:${NOW}`).includes('an invented evening')],
    ['the merged record line is kept', git('show', `HEAD:${TL}`).includes('saved by another chat')],
    ['and reaches main', git('ls-remote', 'origin', 'refs/heads/main').startsWith(git('rev-parse', 'HEAD').trim())],
  ], said);
}

// Round 37: the same with a clean cherry-pick still signing its commit. It holds
// CHERRY_PICK_HEAD while it signs, the save read that as a cherry-pick stopped partway and
// told the turn to settle it with `git cherry-pick --abort`, and that abort, mid-signing,
// left the pick committed and its record line staged as removed, for the next save to
// commit. So the save waits a marker that fresh out, as it does a merge's.
async function livePick() {
  const { repo, git, TL, NOW, save, waitFor, report, slow, env } = signingRepo('live-pick');
  writeFileSync(slow, '');
  const picking = spawn('git', ['cherry-pick', 'incoming'], { cwd: repo, env, stdio: 'ignore' });
  const pickDone = new Promise((ok) => picking.on('close', ok));
  const signing = await waitFor(join(repo, '.git', 'CHERRY_PICK_HEAD'));
  const said = await save();
  // What the turn is told to do, done while the pick may still be signing.
  if (said.includes('cherry-pick --abort')) spawnSync('git', ['cherry-pick', '--abort'], { cwd: repo, env, stdio: 'ignore' });
  await pickDone;
  const again = await save();
  report('beside a cherry-pick still signing', [
    ['the other chat\'s cherry-pick was caught while it signed', signing],
    ['the turn is not told to settle a cherry-pick still signing', !/cherry-pick --abort|stopped partway/.test(said)],
    ['this turn\'s record is saved', git('show', `HEAD:${NOW}`).includes('an invented evening')],
    ['the picked record line is kept', git('show', `HEAD:${TL}`).includes('saved by another chat')],
  ], `${said}${again}`, 37);
}

// The save's fetch before merging main in can take seconds. Another chat's merge begun
// meanwhile made the save's merge fail, and its abort threw that merge away mid-signing:
// the merge stayed committed, its record line staged as removed, and the next save
// committed the removal to main, saying nothing.
async function mergeDuringFetch() {
  const { repo, git, TL, save, merge, waitFor, report } = signingRepo('fetch-merge');
  // Main on GitHub has moved on, so the save fetches and merges it in.
  git('checkout', '-qb', 'up', 'main');
  writeFileSync(join(repo, 'up.txt'), 'up\n');
  git('add', 'up.txt');
  git('commit', '-qm', 'main moved on');
  git('push', '-q', 'origin', 'up:main');
  git('checkout', '-q', 'claude/live');
  // The save's fetch is slow once, and says when it starts.
  const slowFetch = join(dir, 'fetch-merge-slowfetch');
  const fetching = join(dir, 'fetch-merge-fetching');
  writeFileSync(slowFetch, '');
  git('config', 'remote.origin.uploadpack', `if [ -e '${slowFetch}' ]; then rm -f '${slowFetch}'; touch '${fetching}'; sleep 4; fi; git-upload-pack`);
  const saving = save();
  const caught = await waitFor(fetching);
  const mergeDone = merge();
  const said = await saving;
  await mergeDone;
  const left = git('status', '--porcelain', '--', 'data');
  const again = await save();
  report('beside a merge begun during its fetch', [
    ['the other chat\'s merge began while the save fetched', caught],
    ['the merged record line is not left staged as removed', left.trim() === ''],
    ['the merged record line is kept by the next save', git('show', `HEAD:${TL}`).includes('saved by another chat')],
    ['and on main', git('show', `origin/main:${TL}`).includes('saved by another chat')],
  ], `${said}${again}${left}`);
}

/**
 * A git on a hook's PATH that, the first time the hook runs a merge, starts another
 * chat's merge in the same folder (signed slowly, as signingRepo's) and lets the hook's
 * own merge run only once that one holds MERGE_HEAD: the two chats' merges begun in
 * the same moment, made certain. `done` appears when the other merge has finished.
 */
function raceGit(name, repo, slow, otherArgs) {
  const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  const bin = join(dir, `${name}-bin`);
  const trigger = join(dir, `${name}-trigger`);
  const done = join(dir, `${name}-done`);
  mkdirSync(bin, { recursive: true });
  const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  writeFileSync(
    join(bin, 'git'),
    `#!/bin/sh\nif [ -e ${q(trigger)} ]; then case " $* " in *" merge "*) case " $* " in *" --abort "*) ;; *)\n` +
      `rm -f ${q(trigger)}; touch ${q(slow)}\n` +
      `(cd ${q(repo)} && ${q(real)} ${otherArgs.map(q).join(' ')}; touch ${q(done)}) </dev/null >/dev/null 2>&1 &\n` +
      `i=0; while [ ! -e ${q(join(repo, '.git', 'MERGE_HEAD'))} ] && [ $i -lt 600 ]; do sleep 0.05; i=$((i+1)); done ;; esac ;; esac; fi\n` +
      `exec ${q(real)} "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(trigger, '');
  return { path: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, done, fired: () => !existsSync(trigger) };
}

// Round 32: another chat's merge begun in the same moment as the save's own merge of
// main. The save's merge then fails on it ("you have not concluded your merge"), and
// gitSigned aborted the merge it found, which was not its own, mid-signing: the merge
// stayed committed with its record line staged as removed, for the next save to commit.
// A merge is undone only when it is known to be the caller's own.
async function mergeAsOursBegins() {
  const { repo, git, TL, save, waitFor, report, slow, env } = signingRepo('race-merge');
  git('checkout', '-qb', 'up', 'main');
  writeFileSync(join(repo, 'up.txt'), 'up\n');
  git('add', 'up.txt');
  git('commit', '-qm', 'main moved on');
  git('push', '-q', 'origin', 'up:main');
  git('checkout', '-q', 'claude/live');
  const race = raceGit('race-merge', repo, slow, ['merge', '-q', '--no-edit', '-m', 'merge: main', 'incoming']);
  const said = await save({ PATH: race.path });
  const finished = await waitFor(race.done);
  const left = git('status', '--porcelain', '--', 'data');
  const again = await save();
  report('beside a merge begun as its own merge began', [
    ['the other chat\'s merge began as the save\'s own merge did', race.fired() && finished],
    ['the other chat\'s merge is not thrown away', spawnSync('git', ['merge-base', '--is-ancestor', 'incoming', 'HEAD'], { cwd: repo, env, stdio: 'ignore' }).status === 0],
    ['the merged record line is not left staged as removed', left.trim() === ''],
    ['the merged record line is kept by the next save', git('show', `HEAD:${TL}`).includes('saved by another chat')],
    ['and on main', git('show', `origin/main:${TL}`).includes('saved by another chat')],
  ], `${said}${again}${left}`, 32);
}

// The same moment at a session's start: the brief merges main into the chat's branch,
// and undid whatever merge its own left behind, without asking whose.
async function briefAsOtherBegins() {
  const { repo, git, report, slow, env } = signingRepo('race-brief');
  git('checkout', '-qb', 'up', 'main');
  writeFileSync(join(repo, 'up.txt'), 'up\n');
  git('add', 'up.txt');
  git('commit', '-qm', 'main moved on');
  git('push', '-q', 'origin', 'up:main');
  git('checkout', '-q', 'claude/live');
  const race = raceGit('race-brief', repo, slow, ['merge', '-q', '--no-edit', '-m', 'merge: main', 'incoming']);
  // Its own environment, never the caller's git variables: under the commit gate they
  // name the gate's index, which a merge here would write to.
  await new Promise((ok) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'session', 'session-brief.mjs')], {
      cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, PATH: race.path }, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true,
    });
    const timer = setTimeout(() => child.kill(), 90000);
    child.on('close', () => {
      clearTimeout(timer);
      ok();
    });
    child.stdin.end('{}');
  });
  const finished = await waitForFile(race.done);
  report('beside a merge begun as its own merge began', [
    ['the other chat\'s merge began as the brief\'s own merge did', race.fired() && finished],
    ['the other chat\'s merge is not thrown away', spawnSync('git', ['merge-base', '--is-ancestor', 'incoming', 'HEAD'], { cwd: repo, env, stdio: 'ignore' }).status === 0],
  ], git('log', '--oneline', '-5'), 32, 'session/session-brief.mjs');
}

// And the sync's merge of GitHub's main into main, in the folder that holds main.
async function syncAsOtherBegins() {
  const { repo, git, NOW, report, slow, env } = signingRepo('race-sync');
  git('commit', '-qm', 'record: session update', '--', NOW);
  git('checkout', '-q', 'main');
  writeFileSync(join(repo, 'ahead.txt'), 'ahead\n');
  git('add', 'ahead.txt');
  git('commit', '-qm', 'main here moved on');
  git('checkout', '-qb', 'up', 'origin/main');
  writeFileSync(join(repo, 'up.txt'), 'up\n');
  git('add', 'up.txt');
  git('commit', '-qm', 'main moved on');
  git('push', '-q', 'origin', 'up:main');
  git('checkout', '-q', 'main');
  git('branch', '-qD', 'up');
  const race = raceGit('race-sync', repo, slow, ['merge', '-q', '--no-edit', '-m', 'merge: main', 'incoming']);
  const lib = join(repo, '.claude', 'hooks', 'lib', 'branches.mjs');
  const said = await new Promise((ok) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `const b = await import(${JSON.stringify(pathToFileURL(lib).href)}); console.log(JSON.stringify(b.reconcile(${JSON.stringify(repo)})));`], {
      cwd: repo, env: { ...env, PATH: race.path }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    const timer = setTimeout(() => child.kill(), 90000);
    child.on('close', () => {
      clearTimeout(timer);
      ok(out);
    });
  });
  const finished = await waitForFile(race.done);
  report('beside a merge begun as its own merge began', [
    ['the other chat\'s merge began as the sync\'s own merge did', race.fired() && finished],
    // The sync lands the other chat's local branch too, and deletes it: so its merge is looked for by its message.
    ['the other chat\'s merge is not thrown away', git('log', 'main', '--format=%s').split('\n').includes('merge: main')],
  ], said, 32, 'lib/branches.mjs reconcile');
}

// Round 33: a merge stopped partway on a harness file, and a turn that wrote to her
// record. The save staged her words into that merge's index, its commit was refused
// ("a partial commit during a merge"), and the turn was told to settle it with
// `git merge --abort`, which resets every staged file to HEAD, on disk too: an edited
// page lost the turn's words and a new page was deleted. Left unstaged, the abort keeps
// them, and the save after it commits them.
async function abortKeepsHerWords() {
  const { repo } = midMergeRepo('abort-keeps', { words: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const NEW = join(repo, 'data', 'core', 'journal', 'invented.md');
  appendFileSync(NOW, 'An invented evening.\n');
  mkdirSync(dirname(NEW), { recursive: true });
  writeFileSync(NEW, 'An invented entry.\n');
  const said = await new Promise((ok) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
      cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SIGNED_MS: '1000', DEAR_RECORD_READONLY: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('close', () => {
      clearTimeout(timer);
      ok(out);
    });
    child.stdin.end('{}');
  });
  // What the turn is told to do, done.
  const told = /merge --abort/.test(said);
  git('merge', '--abort');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const checks = [
    ['the turn is told the record was not saved', /could not be saved/.test(said)],
    ['the abort it is told of keeps the turn\'s words on an edited page', !told || read(NOW).includes('An invented evening.')],
    ['and a new page', !told || read(NEW).includes('An invented entry.')],
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs beside a merge stopped partway (round 33): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

// Round 36: the same with a cherry-pick stopped partway, in another chat's hands in this
// shared folder. Git refuses a partial commit there too ("cannot do a partial commit
// during a cherry-pick"), and its abort resets every staged file to HEAD, on disk too:
// whoever settled it with `git cherry-pick --abort` lost the turn's words on an edited
// page and deleted a new page the save had staged. A revert, which takes a partial
// commit, is held to the same end.
async function pickAbortKeepsHerWords(op) {
  const { repo } = midMergeRepo(`${op}-keeps`, { words: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  git('merge', '--abort');
  if (op === 'cherry-pick') git('cherry-pick', 'origin/main');
  else {
    appendFileSync(join(repo, 'README.md'), 'c\n');
    git('commit', '-qam', 'c');
    git('revert', '--no-edit', 'HEAD~2');
  }
  const head = op === 'cherry-pick' ? 'CHERRY_PICK_HEAD' : 'REVERT_HEAD';
  if (!existsSync(join(repo, '.git', head))) throw new Error(`the conflicting ${op} did not start`);
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const NEW = join(repo, 'data', 'core', 'journal', 'invented.md');
  appendFileSync(NOW, 'An invented evening.\n');
  mkdirSync(dirname(NEW), { recursive: true });
  writeFileSync(NEW, 'An invented entry.\n');
  const said = await new Promise((ok) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
      cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SIGNED_MS: '1000', DEAR_RECORD_READONLY: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('close', () => {
      clearTimeout(timer);
      ok(out);
    });
    child.stdin.end('{}');
  });
  git(op, '--abort');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  // A revert takes a partial commit, so the save goes through there; a cherry-pick refuses it.
  const refused = /could not be saved/.test(said);
  const checks = [
    [`the turn is told of the ${op}, not a merge, if the save was refused`, !refused || said.includes(`git ${op} --abort`)],
    [`git ${op} --abort keeps the turn's words on an edited page`, read(NOW).includes('An invented evening.')],
    ['and a new page', read(NEW).includes('An invented entry.')],
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs beside a ${op} stopped partway (round 36): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

// Round 38: a revert stopped partway takes the save's commit, but one refused for another
// reason (the gate refuses a file over 95 MiB, a lock held throughout) left her words
// staged, and `git revert --abort` resets every staged file to HEAD, on disk too: the
// turn's words on an edited page were lost and a new page deleted. A gate that refuses
// what the save stages stands in for the reason.
async function refusedRevertKeepsHerWords() {
  const { repo } = midMergeRepo('refused-revert', { words: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  git('merge', '--abort');
  appendFileSync(join(repo, 'README.md'), 'c\n');
  git('commit', '-qam', 'c');
  git('revert', '--no-edit', 'HEAD~2');
  if (!existsSync(join(repo, '.git', 'REVERT_HEAD'))) throw new Error('the conflicting revert did not start');
  const gate = join(dir, 'refused-revert-hooks');
  mkdirSync(gate, { recursive: true });
  writeFileSync(join(gate, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  git('config', 'core.hooksPath', gate);
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const NEW = join(repo, 'data', 'core', 'journal', 'invented.md');
  appendFileSync(NOW, 'An invented evening.\n');
  mkdirSync(dirname(NEW), { recursive: true });
  writeFileSync(NEW, 'An invented entry.\n');
  const said = await new Promise((ok) => {
    const child = spawn(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
      cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SIGNED_MS: '1000', DEAR_RECORD_READONLY: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('close', () => {
      clearTimeout(timer);
      ok(out);
    });
    child.stdin.end('{}');
  });
  git('revert', '--abort');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const checks = [
    // Since round 39 the save commits nothing while a revert is stopped partway (any commit
    // ends the revert), so the cause named is the revert, as for a merge or a cherry-pick.
    ['the turn is told the record was not saved, and why', /could not be saved this turn: a git revert is stopped partway/.test(said)],
    ['git revert --abort keeps the turn\'s words on an edited page', read(NOW).includes('An invented evening.')],
    ['and a new page', read(NEW).includes('An invented entry.')],
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs beside a revert stopped partway, its commit refused (round 38): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

// Round 39: rounds 33, 36 and 38 each kept her words through one kind of abort, so the
// kinds are held to one table: a merge, a cherry-pick and a revert stopped partway, each
// carrying a record change of its own; the save's commit refused by the gate, refused as
// a partial commit, or blocked by a lock held throughout; and the turn's words on disk
// only, or already staged by the turn's own commit that git refused. In every cell the
// abort the turn or another chat runs keeps her words, and undoes the operation's own
// record change rather than leaving it saved. Under a lock held throughout nothing can
// touch the index, so words staged before it are left out: no git can unstage them.
function stoppedOpRepo(op) {
  const { repo, remote } = midMergeRepo(`matrix-${op}`, { record: true, words: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  if (op !== 'merge') git('merge', '--abort');
  if (op === 'cherry-pick') git('cherry-pick', 'origin/main');
  if (op === 'revert') {
    // A commit that brought a record page and a harness line, then one beside that line:
    // its revert stops on the harness file with the page's removal staged.
    appendFileSync(join(repo, 'README.md'), 'd\n');
    mkdirSync(join(repo, 'data', 'core', 'me'), { recursive: true });
    writeFileSync(join(repo, 'data', 'core', 'me', 'old.md'), 'An invented page.\n');
    git('add', '-A');
    git('commit', '-qm', 'd');
    appendFileSync(join(repo, 'README.md'), 'e\n');
    git('commit', '-qam', 'e');
    git('revert', '--no-edit', 'HEAD~1');
  }
  const head = { merge: 'MERGE_HEAD', 'cherry-pick': 'CHERRY_PICK_HEAD', revert: 'REVERT_HEAD' }[op];
  if (!existsSync(join(repo, '.git', head))) throw new Error(`the matrix's ${op} did not stop partway`);
  return { repo, remote };
}

async function matrixCell(base, op, failure, staged) {
  const name = `matrix-${op}-${failure}-${staged ? 'staged' : 'unstaged'}`;
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  cpSync(base.repo, repo, { recursive: true });
  cpSync(base.remote, remote, { recursive: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  git('remote', 'set-url', 'origin', remote);
  // A copied index holds the first repository's file times: refreshed here, as any git in
  // the copy would, or an abort after a lock held throughout reads every page as changed.
  git('update-index', '-q', '--refresh');
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const NEW = join(repo, 'data', 'core', 'journal', 'invented.md');
  appendFileSync(NOW, 'An invented evening.\n');
  mkdirSync(dirname(NEW), { recursive: true });
  writeFileSync(NEW, 'An invented entry.\n');
  if (staged) {
    // The turn saves at once, as it is told to: git refuses its commit, its add stays.
    git('add', '--', 'data/core/state/now.md', 'data/core/journal/invented.md');
    git('commit', '-qm', 'record: update now');
  }
  if (failure === 'gate') {
    const gate = join(dir, `${name}-hooks`);
    mkdirSync(gate, { recursive: true });
    writeFileSync(join(gate, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    git('config', 'core.hooksPath', gate);
  }
  const lock = join(repo, '.git', 'index.lock');
  if (failure === 'lock') writeFileSync(lock, '');
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
  rmSync(lock, { force: true });
  git(op, '--abort');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const own = op === 'revert'
    ? ['the revert\'s removal of a record page is undone, not saved', existsSync(join(repo, 'data', 'core', 'me', 'old.md'))]
    : [`the ${op}'s incoming record page is undone, not saved`, !existsSync(join(repo, 'data', 'core', 'x.md')) && !git('log', '--format=%H', '--', 'data/core/x.md').stdout.trim()];
  const checks = [
    [`git ${op} --abort keeps the turn's words on an edited page`, read(NOW).includes('An invented evening.')],
    ['and a new page', read(NEW).includes('An invented entry.')],
    own,
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs, ${op} stopped partway × ${failure} × words ${staged ? 'staged' : 'unstaged'} (round 39): ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

async function abortMatrix() {
  const cells = [];
  for (const op of ['merge', 'cherry-pick', 'revert']) {
    const base = stoppedOpRepo(op);
    for (const failure of ['gate', 'partial', 'lock']) {
      for (const staged of [false, true]) if (!(failure === 'lock' && staged)) cells.push(matrixCell(base, op, failure, staged));
    }
  }
  await Promise.all(cells);
}

// Round 40: the operation's own pages were read from its commit's diff, not from what it
// does to HEAD. A merge, pick or revert whose page change HEAD already holds stages nothing
// on that page, yet the diff named it, so the turn's words staged there were kept staged and
// the abort the turn is told of wiped them. And a page HEAD had renamed took the incoming
// edit under its new name, which the diff never named: unstaged by the save, the abort left
// the operation's edit on disk for the next save to keep.
async function opOnPage(op, kind) {
  const name = `onpage-${op}-${kind}`;
  const repo = join(dir, name);
  const remote = join(dir, `${name}.git`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
  const git = (...args) => spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
  for (const part of ['.claude', 'modules', 'README.md']) {
    copyTree(join(root, part), join(repo, part), { filter: (src) => !/[\\/](node_modules|worktrees)$/.test(src) });
  }
  const NOW = join(repo, 'data', 'core', 'state', 'now.md');
  const OLD = join(repo, 'data', 'core', 'me', 'a.md');
  const MOVED = join(repo, 'data', 'core', 'me', 'b.md');
  mkdirSync(dirname(NOW), { recursive: true });
  mkdirSync(dirname(OLD), { recursive: true });
  writeFileSync(NOW, '# Now\n\nAn invented week.\n');
  writeFileSync(OLD, '# A page\n\nAn invented fact.\nAnother invented fact.\nA third invented fact.\n');
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-qm', 'start');
  if (op === 'revert') {
    git('checkout', '-qb', 'claude/x');
    appendFileSync(join(repo, 'README.md'), 'd\n');
    appendFileSync(NOW, 'An invented line.\n');
    git('commit', '-qam', 'd');
    // HEAD takes the page's line back by hand, beside a harness line the revert stops on.
    writeFileSync(NOW, '# Now\n\nAn invented week.\n');
    appendFileSync(join(repo, 'README.md'), 'e\n');
    git('commit', '-qam', 'e');
  } else if (kind === 'ours' || kind === 'ours-clean') {
    // Round 41: a branch whose work reached main as copies is recorded as merged with
    // `git merge -s ours` (.claude/memory/leftover-chat-branches-clear-themselves.md),
    // in the folder holding main. Its signer failing stops it partway, staging nothing.
    git('checkout', '-qb', 'up');
    if (kind === 'ours') appendFileSync(NOW, 'An incoming invented line.\n');
    else writeFileSync(NOW, '# Now\n\nAn incoming invented week.\n\nAn invented week.\n');
    git('commit', '-qam', 'a');
    git('checkout', '-qb', 'claude/x', 'main');
    appendFileSync(join(repo, 'README.md'), 'b\n');
    if (kind === 'ours') appendFileSync(NOW, 'An invented line.\n');
    git('commit', '-qam', 'b');
  } else {
    git('checkout', '-qb', 'up');
    appendFileSync(join(repo, 'README.md'), 'a\n');
    if (kind === 'applied') appendFileSync(NOW, 'An invented line.\n');
    else appendFileSync(OLD, 'An incoming invented fact.\n');
    git('commit', '-qam', 'a');
    git('checkout', '-qb', 'claude/x', 'main');
    appendFileSync(join(repo, 'README.md'), 'b\n');
    if (kind === 'applied') appendFileSync(NOW, 'An invented line.\n');
    else git('mv', 'data/core/me/a.md', 'data/core/me/b.md');
    git('commit', '-qam', 'b');
  }
  execFileSync('git', ['init', '-q', '--bare', remote], { env, stdio: 'ignore' });
  git('remote', 'add', 'origin', remote);
  git('push', '-q', 'origin', `${op === 'revert' ? 'claude/x' : 'up'}:main`, 'claude/x');
  git('fetch', '-q', 'origin');
  writeFileSync(join(repo, 'here.txt'), 'local\n');
  git('add', 'here.txt');
  git('commit', '-qm', 'not yet pushed');
  if (op === 'merge' && kind.startsWith('ours')) git('-c', 'commit.gpgSign=true', '-c', 'gpg.program=false', '-c', 'gpg.format=openpgp', 'merge', '-q', '-s', 'ours', '-m', 'merge: a branch already in main', 'origin/main');
  else if (op === 'merge') git('merge', '-q', 'origin/main');
  if (op === 'cherry-pick') git('cherry-pick', 'origin/main');
  if (op === 'revert') git('revert', '--no-edit', 'HEAD~2');
  const head = { merge: 'MERGE_HEAD', 'cherry-pick': 'CHERRY_PICK_HEAD', revert: 'REVERT_HEAD' }[op];
  if (!existsSync(join(repo, '.git', head))) throw new Error(`${name}: the ${op} did not stop partway`);
  // The turn's words, staged by its own commit that git refused.
  appendFileSync(NOW, 'An invented evening.\n');
  git('add', '--', 'data/core/state/now.md');
  // A partial commit, which git refuses mid-merge; a whole one would end the merge.
  git('commit', '-qm', 'record: update now', ...(kind.startsWith('ours') ? ['--', 'data/core/state/now.md'] : []));
  if (!existsSync(join(repo, '.git', head))) throw new Error(`${name}: the turn's commit ended the ${op}`);
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
  git(op, '--abort');
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const checks = [
    ['the turn is told the record was not saved', /could not be saved/.test(said)],
    [`git ${op} --abort keeps the turn's words`, read(NOW).includes('An invented evening.')],
    ...(kind === 'renamed' ? [[`the ${op}'s edit to a page HEAD renamed is undone, not left for the next save`, !read(MOVED).includes('incoming')]] : []),
  ];
  for (const [what, ok] of checks) {
    if (!ok) failed += 1;
    const where = { applied: 'its page change already on HEAD (round 40)', renamed: 'its page change on a page HEAD renamed (round 40)', ours: 'as -s ours, a page both sides changed (round 41)', 'ours-clean': 'as -s ours, a page only the incoming side changed (round 41)' }[kind];
    (ok ? console.log : console.error)(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs, ${op} stopped partway, ${where}: ${what}${ok ? '' : ` ${said.slice(0, 300)}`}`);
  }
}

const waitForFile = async (path) => {
  for (let i = 0; i < 600 && !existsSync(path); i++) await new Promise((ok) => setTimeout(ok, 50));
  return existsSync(path);
};

let failed = 0;
try {
  const first = midMergeRepo(HOOKS[0].split('/')[0]);
  const repos = [first.repo, copyOf(first, HOOKS[1].split('/')[0])];
  // The save with the record staged by the merge, at a turn's end and under
  // the self-test's own environment, each on its own copy.
  const carrying = midMergeRepo('record-merge', { record: true });
  const runs = [
    ['at a turn end', carrying.repo, {}],
    ['under the self-test', copyOf(carrying, 'record-merge-selftest'), { DEAR_HOOK_STRICT: '1', DEAR_RECORD_READONLY: '1' }],
  ];
  // All side by side: each save waits out a merge marker this fresh (round 31).
  await Promise.all([
    ...HOOKS.map((hook, i) => runHook(hook, repos[i])),
    ...runs.map(([, repo, extra]) => runHook('record/save-record.mjs', repo, extra)),
    abortKeepsHerWords(),
    pickAbortKeepsHerWords('cherry-pick'),
    pickAbortKeepsHerWords('revert'),
    refusedRevertKeepsHerWords(),
    abortMatrix(),
    // Round 32's first: each sets up its repository synchronously before its first wait,
    // and set up while liveMerge watched for a merge still signing, they held the event
    // loop past the whole six seconds it signs for under the self-test's load.
    ...(process.platform === 'win32' ? [] : [mergeAsOursBegins(), briefAsOtherBegins(), syncAsOtherBegins(), liveMerge(), mergeDuringFetch(), livePick()]),
  ]);
  // Round 40's cells after the rest: all at once, the load ran the round 33 and 38 saves
  // past their own time limits. The kinds the save does not read are test-undetected-ops.mjs.
  const later = [
    ...['merge', 'cherry-pick', 'revert'].map((op) => () => opOnPage(op, 'applied')),
    () => opOnPage('merge', 'renamed'),
    () => opOnPage('cherry-pick', 'renamed'),
    () => opOnPage('merge', 'ours'),
    () => opOnPage('merge', 'ours-clean'),
  ];
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (later.length) await later.shift()();
  }));
  HOOKS.forEach((hook, i) => {
    const ok = existsSync(join(repos[i], '.git', 'MERGE_HEAD'));
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${hook} leaves a merge under way alone`);
  });
  for (const [when, repo] of runs) {
    const ok = existsSync(join(repo, '.git', 'MERGE_HEAD'));
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs leaves a merge carrying the record alone, ${when}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
// Round 54 (2026-11-02): a record conflict settled by taking one side whole dropped the
// other side's lines. The turn told to settle a stopped merge is told to keep both sides.
{
  const src = readFileSync(join(hooks, 'record', 'save-record.mjs'), 'utf8');
  const line = src.split('\n').find((l) => l.includes('midMerge ? `Settle the')) ?? '';
  const ok = /keeping both sides/.test(line) && /never by taking one side whole/.test(line);
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} record/save-record.mjs tells the turn settling a stopped merge to keep both sides of her record`);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
