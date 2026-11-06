// Bringing every copy of the repository into agreement with the remote, on its own.
//
// DEP-011, "Main is the only branch that lasts: every other is cleared once its work
// is in main, on the remote and on every machine." reconcile() is the whole of it,
// run silently by session/prune-branches.mjs when a session opens and by
// record/save-record.mjs at the end of every turn, so git is never the person's
// concern: main is caught up and pushed, chat and record branches on GitHub are
// merged into main, idle run and detached-rescue branches retired into its history (and so removed by the merge-sessions
// workflow, the only thing that deletes on GitHub), finished local branches and
// worktrees are cleared, and only what truly needs a judgement (a conflict) is
// left, for the agent to settle in the same session.
//
// WKB-015, "The developer can bring every copy of the repository into agreement in
// one step." The same reconcile(), on demand, through ux/scripts/git-reconcile.mjs.
//
// Nothing is lost, and that is the whole safety argument (SFG-011). A branch is
// deleted only once its tip is in GitHub's main: a session's save or a record-only
// branch by a real merge; a run's or a detached rescue's branch, left idle a day, by a merge that keeps
// its commits in main's history without applying them (an "ours" merge), so every
// commit stays reachable and `git log --grep '^chore(git): retire'` finds it (the
// body names the branch and its tip, so its work can still be cherry-picked).
// Main only moves forward: a fast-forward, a clean merge, or a push GitHub
// accepts only if nothing moved since. Nothing here deletes on GitHub, forces or
// rewrites; the workflow deletes what is in main. `git branch -d` and `git
// worktree remove` without --force refuse unmerged or unsaved work themselves. A
// stash is listed, never dropped.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';

export const MAIN = 'main';

// A worktree git touched in the last day is in use, finished or not: one just
// made from main is "merged" before its first commit, and was removed under a
// live session twice on 2026-10-03. Its own index is rewritten by every git
// operation inside it, so its age says when it was last used.
const IN_USE_MS = 24 * 60 * 60 * 1000;
// A heartbeat run's detached checkout, as .claude/jobs/README.md step 1 names it, and the
// inline jobs' own (`temp/hb-ci`, `temp/hb-rem`, check-in.md step 1, reminders.md step 4).
const HB_RUN = /\/temp\/hb-(run|ci|rem)(-\d{4})?$/;
// The inline jobs' checkouts, kept when neither the push nor the rescue landed.
const KEPT = /\/temp\/hb-(ci|rem)(-\d{4})?$/;
// Idle this long, a kept checkout's job is over: its push landed, or it was given up.
const KEPT_IDLE_MS = 60 * 60 * 1000;

/**
 * git that never asks anyone anything. A hook's git inherits the terminal she
 * types into: with a lapsed sign-in it printed a password prompt over the chat
 * and would read her next words as the password (review, 2026-10-16). So no
 * terminal prompt, no credential manager dialog, no ssh question: an unsigned
 * fetch or push fails at once, and the save's own fallbacks take over. A cloud
 * session's environment already says the same.
 */
export function quietGitEnv(env = process.env, cwd = process.cwd()) {
  return { ...env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...quietSsh(env, cwd), ...hookConfig(env) };
}

// Settings for the hooks' own merges only, whatever the person's git config
// says (review, 2026-10-16): merge.ff=only refused every merge that brings main
// in. Passed as GIT_CONFIG_COUNT entries, which outrank every config file,
// appended to any the environment already carries (a cloud session's does).
// Signing is left as configured, since a platform may require it: a commit or
// merge is tried signed first, briefly, and made unsigned only if signing fails
// or waits on a passphrase (SIGNED_MS, UNSIGNED below).
const HOOK_CONFIG = [['merge.ff', 'true']];

/**
 * Her record pages a stash holds that HEAD does not: each page the stash changed from
 * where it was taken (its tracked side) or took untracked (its third parent), whose
 * stashed version differs from HEAD's. A page HEAD already holds as stashed is saved.
 */
export function stashedRecord(g, ref) {
  const blob = (spec) => g.out(['rev-parse', '-q', '--verify', spec]).trim();
  const tracked = g.out(['diff', '--name-only', '--no-renames', '-z', `${ref}^1`, ref, '--', 'data/']).split('\0').filter(Boolean).map((p) => [p, ref]);
  const taken = blob(`${ref}^3`) ? g.out(['ls-tree', '-r', '--name-only', '-z', `${ref}^3`, '--', 'data/']).split('\0').filter(Boolean).map((p) => [p, `${ref}^3`]) : [];
  return [...new Set([...tracked, ...taken].filter(([p, from]) => blob(`${from}:${p}`) !== blob(`HEAD:${p}`)).map(([p]) => p))];
}

/** How long a signed attempt may take, and the prefix for the unsigned retry. */
export const SIGNED_MS = Number(process.env.DEAR_SIGNED_MS) || 30000; // the variable is for tests only
export const UNSIGNED = ['-c', 'commit.gpgSign=false'];

/**
 * Signed first, given SIGNED_MS, then unsigned: `signed(ms)` and `unsigned()` each
 * return what they made, or something falsy. A signer that waited out its whole time
 * once waits again (a passphrase dialog nobody answers), so for the rest of this
 * process every signed try is skipped: four such waits in one save are two minutes,
 * and took a save past the 180 s Claude Code gives it before its push (round 32,
 * test-save-budget.mjs). One that refuses at once is tried again each time.
 */
let signerStalled = false;
export function signedFirst(signed, unsigned) {
  if (!signerStalled) {
    const started = Date.now();
    const made = signed(SIGNED_MS);
    if (made) return made;
    if (Date.now() - started >= SIGNED_MS - 100) signerStalled = true;
  }
  return unsigned();
}
function hookConfig(env) {
  const base = Number(env.GIT_CONFIG_COUNT) || 0;
  const out = { GIT_CONFIG_COUNT: String(base + HOOK_CONFIG.length) };
  HOOK_CONFIG.forEach(([key, value], i) => {
    out[`GIT_CONFIG_KEY_${base + i}`] = key;
    out[`GIT_CONFIG_VALUE_${base + i}`] = value;
  });
  return out;
}

// The machine's own ssh stays the one git runs, told only never to ask: a
// plain `ssh` in its place broke a copy whose key lives with another ssh
// (Windows' OpenSSH agent via core.sshCommand, PuTTY's Pageant via GIT_SSH;
// review, 2026-10-16). An ssh command that is not OpenSSH's is left as it is.
const OPENSSH = /(^|[\\/"'\s])ssh(\.exe)?["']?(\s|$)/i;
export function quietSsh(env = process.env, cwd = process.cwd()) {
  if (env.GIT_SSH) return {};
  let cmd = env.GIT_SSH_COMMAND;
  if (!cmd) {
    try {
      cmd = execFileSync('git', ['config', '--get', 'core.sshCommand'], { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    } catch {
      cmd = '';
    }
  }
  if (!cmd) return { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' };
  return OPENSSH.test(cmd) && !/BatchMode/i.test(cmd) ? { GIT_SSH_COMMAND: `${cmd} -o BatchMode=yes` } : {};
}

/** git in one folder, as argument arrays: out() is '' on failure, ok() says whether it succeeded. */
export function runner(cwd) {
  const env = quietGitEnv(process.env, cwd);
  const run = (args, timeout) => {
    try {
      return execFileSync('git', args, { cwd, env, encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  };
  return { cwd, out: (args, timeout = 15000) => run(args, timeout) ?? '', ok: (args, timeout = 120000) => run(args, timeout) !== null };
}

// git worktree list --porcelain: blocks of "worktree <path>" / "branch refs/heads/<name>".
function worktrees(g) {
  return g
    .out(['worktree', 'list', '--porcelain'])
    .split(/\r?\n\r?\n/)
    .map((block) => ({ path: /^worktree (.+)$/m.exec(block)?.[1], branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] }))
    .filter((w) => w.path);
}

const lines = (text) => text.split(/\r?\n/).filter(Boolean);
// One listing per side rather than a check per branch: each git call costs a process.
const mergedInto = (g, into, remote = false) => new Set(lines(g.out(['branch', ...(remote ? ['-r'] : []), '--merged', into, '--format=%(refname:short)'])));
// --no-optional-locks: a plain status rewrites the index, which would make inUse() read
// the worktree as touched just now, by this check.
const dirty = (g, path) => g.out(['--no-optional-locks', '-C', path, 'status', '--porcelain', '--untracked-files=no']).trim() !== '';
// Files a build writes from their source (ux/scripts/generate-theme.mjs): an edit to
// one holds nothing a rebuild cannot make again.
const GENERATED = new Set(['ux/app/icon.svg', 'ux/app/theme.generated.css']);
/**
 * The edits a worktree holds that lose nothing if put back: each changed file is a
 * generated one, or byte for byte what GitHub's main already holds, in the folder and
 * in the index both. On 2026-10-07 four of five finished worktrees were left for the
 * developer's own force-remove over such edits alone. Returns those files, [] when
 * there is no edit, or null when any edit is real (or anything else: a delete, a
 * rename, a name git quotes), so the worktree is kept and listed as before.
 */
function spareEdits(g, path) {
  const rows = lines(g.out(['--no-optional-locks', '-C', path, 'status', '--porcelain', '--untracked-files=no']));
  const files = [];
  for (const row of rows) {
    const xy = row.slice(0, 2);
    const file = row.slice(3);
    if (!/^[ M][ M]$/.test(xy) || file.includes(' -> ') || file.startsWith('"')) return null;
    if (GENERATED.has(file)) {
      files.push(file);
      continue;
    }
    const main = g.out(['-C', path, 'rev-parse', '--verify', '-q', `${ORIGIN_MAIN}:${file}`]).trim();
    const here = g.out(['-C', path, 'hash-object', '--', file]).trim();
    const staged = xy[0] === 'M' ? g.out(['-C', path, 'rev-parse', '--verify', '-q', `:${file}`]).trim() : main;
    if (!main || here !== main || staged !== main) return null;
    files.push(file);
  }
  return files;
}
// New files never committed: git refuses to remove a worktree holding them, as it does one with edits.
const untracked = (g, path) => g.out(['-C', path, 'ls-files', '--others', '--exclude-standard']).trim() !== '';

// Record files git ignores (data/archive-local/): `git worktree remove` deletes
// ignored files without --force, so a worktree holding any is never removed
// (review, 2026-10-16). Nothing of the record is ever deleted.
const ignoredRecord = (g, path) => g.out(['-C', path, 'ls-files', '--others', '--ignored', '--exclude-standard', '--', 'data', 'data-sandbox']).trim() !== '';

// A merge, rebase, cherry-pick, revert or bisect stopped partway leaves one of these behind.
const HALF_DONE = { MERGE_HEAD: 'a merge', 'rebase-merge': 'a rebase', 'rebase-apply': 'a rebase', CHERRY_PICK_HEAD: 'a cherry-pick', REVERT_HEAD: 'a revert', BISECT_LOG: 'a bisect' };
function halfDoneAt(g, path) {
  // One git call for every marker: each process costs, most on Windows.
  const files = Object.keys(HALF_DONE);
  const paths = lines(g.out(['-C', path, 'rev-parse', ...files.flatMap((f) => ['--git-path', f])])).map((at) => (isAbsolute(at) ? at : join(path, at)));
  const i = paths.findIndex((at) => existsSync(at));
  return i === -1 ? null : { op: HALF_DONE[files[i]], at: paths[i] };
}
const halfDone = (g, path) => halfDoneAt(g, path)?.op ?? null;

/**
 * A marker that is still there a moment later, with no git holding the index: the
 * session brief's merge, run beside this pass at a session's start, was caught
 * mid-commit five times in six and read as "a merge stopped partway" with nothing left
 * (round 3, B3). A marker seen once is looked at again after SETTLE_MS, and longer while
 * index.lock is still held (up to SETTLE_MS more). Only a pass that finds one pays it.
 */
const SETTLE_MS = 2000;
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export function stillHalfDone(g, path) {
  if (!halfDone(g, path)) return null;
  let lock = '';
  try {
    const at = g.out(['-C', path, 'rev-parse', '--git-path', 'index.lock']).trim();
    lock = at && (isAbsolute(at) ? at : join(path, at));
  } catch {
    lock = '';
  }
  // The pause in full: a merge that signs its commit holds no lock while it signs.
  pause(SETTLE_MS);
  const until = Date.now() + SETTLE_MS;
  while (lock && existsSync(lock) && Date.now() < until) pause(250);
  // And a signer may take up to SIGNED_MS, the time gitSigned gives it: a marker written
  // less than that ago may be a merge still signing, so it is watched until it is that
  // old or gone (round 30: one finished five seconds on was handed on as stopped).
  const cap = Date.now() + SIGNED_MS;
  for (let m = halfDoneAt(g, path); m; m = halfDoneAt(g, path)) {
    if (Date.now() >= cap) return m.op;
    let age;
    try {
      age = Date.now() - statSync(m.at).mtimeMs;
    } catch {
      continue; // gone between the two looks: look again
    }
    if (age < 0 || age >= SIGNED_MS) return m.op;
    pause(Math.min(500, SIGNED_MS - age));
  }
  return null;
}

function inUse(g, path, ms = IN_USE_MS) {
  try {
    const admin = g.out(['-C', path, 'rev-parse', '--absolute-git-dir']).trim();
    return Date.now() - statSync(join(admin, 'index')).mtimeMs < ms;
  } catch {
    return false;
  }
}

// The links a worktree holds into folders outside it, taken out before git
// removes it. A worktree's ux/node_modules is a junction to the shared tree's
// install (and dev/ui's links through it), and on Windows `git worktree remove`
// follows a junction and deletes what it points at: on 2026-10-07 a session
// start cleared a finished worktree and emptied the shared ux/node_modules, and
// both apps stopped. Only the link goes; the folder it points at is untouched.
// Three levels down reaches dev/ui/node_modules; a link is never descended.
function unlinkLinks(path, depth = 3) {
  let entries;
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === '.git') continue;
    const p = join(path, e.name);
    if (e.isSymbolicLink()) {
      try {
        rmdirSync(p);
      } catch {
        try {
          unlinkSync(p);
        } catch {}
      }
    } else if (e.isDirectory() && depth > 1 && e.name !== 'node_modules') unlinkLinks(p, depth - 1);
  }
}

/**
 * Clears this machine's finished branches: a linked worktree whose branch is in
 * main goes first, so its branch is free to delete, then every merged local
 * branch. Never main, the branch in use, or the main working tree. With dry, only
 * says what it would try; git may still refuse any of it. `inMain` is the set of
 * branches counted as in main: those merged into main here, unless the caller
 * knows better (reconcile, when main here is behind GitHub's).
 */
export function clearFinished(g, { dry = false, trees = worktrees(g), inMain = mergedInto(g, MAIN) } = {}) {
  const current = g.out(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const [primary, ...linked] = trees;
  const done = { worktrees: [], branches: [], held: {} };
  const finished = (b) => b && b !== MAIN && b !== current && inMain.has(b);

  for (const w of linked) {
    // A settle worktree left on main once main here matches GitHub's: it holds
    // main, so the main folder could never switch back to it (review, 2026-10-16).
    if (w.branch === MAIN && basename(w.path) === SETTLE && !dirty(g, w.path) && !untracked(g, w.path) && !ignoredRecord(g, w.path) && !halfDone(g, w.path) && sha(g, `refs/heads/${MAIN}`) === sha(g, ORIGIN_MAIN)) {
      if (!dry) unlinkLinks(w.path);
      if (dry || g.ok(['worktree', 'remove', w.path], 60000)) done.worktrees.push(w.path);
      continue;
    }
    // A heartbeat run's own checkout (`temp/hb-run`, `temp/hb-run-<HHMM>`, .claude/jobs/README.md
    // step 1) is detached, so no branch ever reads as finished, and a run that died left
    // it behind for good: five of about 520 MB each on 2026-10-11. Cleared like a finished
    // branch once idle a day, clean and holding nothing main lacks.
    if (!w.branch && HB_RUN.test(w.path.replace(/\\/g, '/')) && !inUse(g, w.path) && !dirty(g, w.path) && !untracked(g, w.path) && !ignoredRecord(g, w.path) && !halfDone(g, w.path)) {
      const head = g.out(['-C', w.path, 'rev-parse', 'HEAD']).trim();
      if (head && [`refs/heads/${MAIN}`, ORIGIN_MAIN].some((m) => sha(g, m) && g.ok(['merge-base', '--is-ancestor', head, m]))) {
        if (!dry) unlinkLinks(w.path);
        if (dry || g.ok(['worktree', 'remove', w.path], 60000)) done.worktrees.push(w.path);
      }
      continue;
    }
    // git refuses a worktree with edits anyway; checking first keeps a dry run from
    // promising a removal the real one cannot make (2026-10-07). Edits that lose
    // nothing (spareEdits) are put back first, never forced past, and named.
    if (!finished(w.branch) || inUse(g, w.path) || untracked(g, w.path) || ignoredRecord(g, w.path)) continue;
    const spare = dirty(g, w.path) ? spareEdits(g, w.path) : [];
    if (!spare) continue;
    if (!dry) {
      if (spare.length && !g.ok(['-C', w.path, 'restore', '--staged', '--worktree', '--source=HEAD', '--', ...spare], 15000)) continue;
      unlinkLinks(w.path);
    }
    if (dry || g.ok(['worktree', 'remove', w.path], 60000)) {
      done.worktrees.push(w.path);
      if (spare.length) done.held[w.path] = spare;
    }
  }
  if (!dry && linked.length) g.ok(['worktree', 'prune'], 15000);

  const stillOut = new Set(linked.filter((w) => !done.worktrees.includes(w.path)).map((w) => w.branch));
  if (primary?.branch) stillOut.add(primary.branch);
  for (const b of inMain) {
    if (stillOut.has(b) || !finished(b)) continue;
    if (dry || g.ok(['branch', '-d', b], 15000)) done.branches.push(b);
  }
  return done;
}

// A branch is a session's save when a chat or the save hook made it: carried into
// main whole, as merge-sessions.yml always has. One touching only the record is
// carried in too, whoever made it, since her words belong in main. One an
// unattended run or a rescue of one left (THROWAWAY) is retired into main's
// history once idle: nobody returns to it, and a retired branch reads as merged,
// so merging it again later would silently skip what was retired (review,
// 2026-10-16). Any other branch is a person's own work, and is only listed.
const SESSION = /^(claude\/|rescue\/(main|claude)-)/;
const THROWAWAY = /^(hb-|rescue\/detached-|overnight\/)/;
const RECORD = /^(data\/|data-sandbox\/)/;
// A status flag the save hook writes and removes, never her words.
const FLAGS = new Set(['data/core/state/PUSH_FAILED.md']);
const IDLE_MS = 24 * 60 * 60 * 1000;
const ORIGIN_MAIN = `refs/remotes/origin/${MAIN}`;

const sha = (g, ref) => g.out(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
const isIn = (g, tip, into = ORIGIN_MAIN) => g.ok(['merge-base', '--is-ancestor', tip, into], 15000);

// commit-tree needs a name; a fresh clone may have none set.
function ident(g) {
  return g.out(['config', 'user.email']).trim() ? [] : ['-c', 'user.name=dear', '-c', 'user.email=dear@localhost'];
}

/** A shallow clone cannot see that an old branch is in main: every check here needs the whole history. */
export function wholeHistory(g, timeout = 300000) {
  if (g.out(['rev-parse', '--is-shallow-repository']).trim() !== 'true') return true;
  return g.ok(['fetch', '-q', '--unshallow', 'origin'], timeout);
}

// `merge-tree --write-tree` (a merge made without a working tree) came in git
// 2.38; an older git (Ubuntu 22.04 ships 2.34) would read every merge as a conflict.
export function canMergeTree(g) {
  const [major, minor] = (/(\d+)\.(\d+)/.exec(g.out(['version'])) ?? []).slice(1).map(Number);
  return major > 2 || (major === 2 && minor >= 38);
}

// A network call starts only when the pass has room for all of it, so a hook's
// own time limit never cuts git off partway (review, 2026-10-16). Past that,
// the pass stops reaching GitHub and says so; the next one carries on.
const NET_MS = 60000;
const SETTLE = 'main-settle';
function net(st, calls = 1) {
  if (st.deadline - Date.now() < calls * st.netMs) {
    st.late = true;
    return 0;
  }
  return st.netMs;
}

// The command that settles something on main, run in the folder holding main;
// where none does, in a worktree made for it.
function onMain(g, trees, ...cmds) {
  const tree = trees.find((w) => w.branch === MAIN);
  const at = (path) => cmds.map((c) => `git -C "${path}" ${c}`).join(' && ');
  if (tree) return at(tree.path);
  // Removed once done, so it never holds main and keeps the main folder off it.
  // Beside the main folder, wherever the pass was run from (npm runs it from ux/,
  // which once put this copy, record and all, inside the repository; review, 2026-10-16).
  const aside = join(trees[0]?.path ?? g.cwd, '..', SETTLE);
  return `git worktree add "${aside}" ${MAIN} && ${at(aside)} && git -C "${aside}" push origin ${MAIN} && git worktree remove "${aside}"`;
}

/**
 * Puts one commit on GitHub's main, made without touching any working tree:
 * `merge` merges tip into main, `retire` keeps tip's commits in main's history
 * with main's files unchanged. Pushed as a plain push, which GitHub refuses if
 * main moved since the fetch. Says 'landed', 'conflict' (nothing made), or
 * 'refused' (GitHub would not take the push: once one is, `st.refused` stops
 * every later push in the pass, since a proxy that refuses main refuses them all).
 */
function landOnMain(g, tip, how, message, st) {
  const base = sha(g, ORIGIN_MAIN);
  if (!base || st.refused) return 'refused';
  const ms = net(st, 3);
  if (!ms) return 'refused';
  let tree;
  if (how === 'merge') {
    // Exit 1 on a conflict, so out() is '' and nothing is made.
    tree = g.out(['merge-tree', '--write-tree', base, tip], 60000).split(/\r?\n/)[0].trim();
    if (!/^[0-9a-f]{40,64}$/.test(tree)) return 'conflict';
  } else {
    tree = g.out(['rev-parse', `${base}^{tree}`]).trim();
  }
  const made = [...ident(g), 'commit-tree', tree, '-p', base, '-p', tip, '-m', message];
  const commit = signedFirst((ms) => g.out(made, ms).trim(), () => g.out([...UNSIGNED, ...made]).trim());
  if (!commit) {
    st.refused = true;
    return 'refused';
  }
  if (!g.ok(['push', '-q', 'origin', `${commit}:refs/heads/${MAIN}`], ms)) {
    // Main moved since the fetch, or GitHub refuses main from here: either way
    // the next pass, from a fresh fetch, tries again.
    st.refused = true;
    return 'refused';
  }
  g.ok(['fetch', '-q', 'origin', MAIN], ms);
  return 'landed';
}

// The ref of a branch in main removed where `git branch -d` would not (it judges against
// HEAD), but never one checked out in any folder at this moment: update-ref, unlike
// `branch -d`, does not look, and the list of folders the pass read at its start is
// seconds old by now. A chat opened in that time, its worktree made on a new branch at
// main's tip, had its branch deleted under it, and its saves made root commits that
// share no history with main (round 46).
function dropRef(g, b, tip) {
  if (worktrees(g).some((w) => w.branch === b)) return false;
  return g.ok(['update-ref', '-d', `refs/heads/${b}`, tip]);
}

function changedSince(g, tip) {
  const base = g.out(['merge-base', ORIGIN_MAIN, tip]).trim();
  // -z: git quotes a name with non-ASCII letters otherwise ("zo\303\253.md"),
  // and a record file read that way looked like harness work (review, 2026-10-16).
  return base ? g.out(['diff', '--name-only', '-z', base, tip]).split('\0').filter(Boolean) : null;
}

// What a branch carries of the record: `all` when every file it changed is the
// record's; `pending`, the record files whose content at its tip main does not
// already hold (review, 2026-10-16: words already in main read as pending, and
// a branch stayed handed on forever).
function recordOf(g, tip, files) {
  const record = files.filter((f) => RECORD.test(f) && !FLAGS.has(f));
  const all = files.length > 0 && files.every((f) => RECORD.test(f) || FLAGS.has(f));
  const pending = record.length ? g.out(['diff', '--name-only', '-z', ORIGIN_MAIN, tip, '--', ...record]).split('\0').filter(Boolean) : [];
  return { all, pending };
}

/**
 * Every branch on GitHub but main is brought into main: a session's save or a
 * record-only branch by a merge; a throwaway one, once idle a day and checked
 * out nowhere here, retired into main's history. The workflow then deletes it.
 * A merge that conflicts, or record work mixed with harness work, is left for
 * the agent to settle; a person's own branch is only listed.
 */
function clearRemote(g, { dry, now, trees, fixed, left, notes, st }) {
  // A branch checked out in a folder here is someone's live work: never retired
  // under them, since a retired branch's later merge would skip what was retired.
  const checkedOut = new Set(trees.map((w) => w.branch).filter(Boolean));
  const would = dry ? 'would ' : '';
  let inMain = 0;
  let waiting = 0;
  const refs = lines(g.out(['for-each-ref', '--format=%(refname:short) %(objectname) %(committerdate:unix)', 'refs/remotes/origin']));
  for (const row of refs) {
    const [ref, tip, when] = row.split(' ');
    const branch = ref.replace(/^origin\//, '');
    if (!ref.startsWith('origin/') || branch === MAIN || branch === 'HEAD') continue;

    let landed = isIn(g, tip);
    if (!landed) {
      const files = changedSince(g, tip);
      const named = SESSION.test(branch) ? 'a session branch' : 'a saved record';
      if (files === null) {
        // Nothing here can settle it; listed, never handed on (review, 2026-10-16).
        left.push({ what: `branch ${branch} on GitHub shares no history with main`, why: 'it cannot be merged or retired safely by itself', command: `git log --oneline -5 origin/${branch}`, quiet: true });
        continue;
      }
      const { all, pending } = recordOf(g, tip, files);
      if (SESSION.test(branch) || (all && pending.length)) {
        if (!st.mergeTree) continue; // one note for the pass, below
        if (dry) {
          fixed.push(`${would}merge ${branch} into main on GitHub`);
          continue;
        }
        const r = landOnMain(g, tip, 'merge', `record: merge ${named} into main`, st);
        if (st.late) continue;
        if (r === 'conflict') {
          st.conflicted.add(branch);
          left.push({ what: `branch ${branch} on GitHub is not in main yet`, why: 'it conflicts with main; its saves must reach main', command: onMain(g, trees, `merge -m "merge: a session branch into main" origin/${branch}`) });
        }
        if (r !== 'landed') continue;
        fixed.push(`merged ${branch} into main on GitHub`);
        landed = true;
      } else if (pending.length) {
        // Her words beside someone's unfinished harness work: never merged whole,
        // never retired. Reported as saves not yet in main (prune-branches), not
        // handed on: landing them means landing that work, which is its owner's.
        left.push({ what: `branch ${branch} on GitHub holds record changes beside harness work`, why: 'its record changes reach main when its owner lands the branch', command: `git diff origin/${MAIN}...origin/${branch} --stat`, quiet: true, savesOff: branch });
        continue;
      } else if (!THROWAWAY.test(branch)) {
        left.push({ what: `branch ${branch} on GitHub: work not in main`, why: 'a person\'s own branch, landed only by them', command: `git log --oneline origin/${MAIN}..origin/${branch}`, quiet: true });
        continue;
      } else if (now - Number(when) * 1000 < IDLE_MS || checkedOut.has(branch)) {
        waiting += 1;
        continue;
      } else {
        const message = `chore(git): retire an idle branch into main's history\n\nIts commits stay reachable from main, unapplied: ${branch} at ${tip}.`;
        if (dry) {
          fixed.push(`${would}retire the idle branch ${branch} into main's history`);
          continue;
        }
        if (landOnMain(g, tip, 'retire', message, st) !== 'landed') continue;
        fixed.push(`retired the idle branch ${branch} into main's history`);
        landed = true;
      }
    }
    if (landed) inMain += 1;
  }
  // Deleting on GitHub is the workflow's alone (merge-sessions.yml, DEP-011): the
  // history guard and check-git-bypass.mjs refuse it anywhere else. Everything
  // landed here is in main, so the workflow's next run removes it, losing nothing.
  if (inMain) notes.push(`${inMain} branch(es) on GitHub are in main; the merge-sessions workflow removes them on its next run`);
  if (waiting) notes.push(`${waiting} branch(es) on GitHub had a commit in the last day; each is landed or retired once a day idle`);
}

// What MERGE_HEAD names in a folder, and when it was written; sha null when no merge is under way.
function mergeMark(g, path) {
  const at = g.out(['-C', path, 'rev-parse', '--git-path', 'MERGE_HEAD']).trim();
  const file = at && (isAbsolute(at) ? at : join(path, at));
  try {
    return { sha: readFileSync(file, 'utf8').split(/\s/)[0] || null, mtime: statSync(file).mtimeMs };
  } catch {
    return { sha: null, mtime: 0 };
  }
}

/**
 * A merge of `target` tried signed, then, if that failed (a refused signature, or one
 * that waited past SIGNED_MS), made unsigned; a conflict fails both. A merge either try
 * left half-done is undone, but only one known to be this call's own: no merge was
 * under way when the try began, and MERGE_HEAD now names the commit it merged. Another
 * chat's merge in the same folder, begun in the same moment, makes this one fail; it
 * holds MERGE_HEAD and no lock while it signs, and an abort threw it away mid-signing
 * (round 32; round 31 found the sites, test-merge-in-progress.mjs). Such a merge is
 * left as it is, and the call reports false. Every hook's merge comes through here.
 */
export function mergeSigned(g, path, args, target) {
  const want = g.out(['-C', path, 'rev-parse', '-q', '--verify', `${target}^{commit}`]).trim();
  const attempt = (run) => {
    const before = mergeMark(g, path);
    if (run()) return true;
    const now = mergeMark(g, path);
    if (before.sha === null && now.sha && want && now.sha === want) g.ok(['-C', path, 'merge', '--abort']);
    return false;
  };
  return signedFirst((ms) => attempt(() => g.ok(args, ms)), () => attempt(() => g.ok([...UNSIGNED, ...args])));
}

/**
 * A check-in's or reminders' checkout kept because neither its push nor its rescue
 * landed (check-in.md step 6, reminders.md step 4: the network was down): its commit of
 * her record is on no branch, on this machine only, and nothing pushed it once GitHub
 * could be reached again, so it stayed there for good (round 47). Idle an hour, holding
 * record work alone that main lacks and no branch on GitHub holds, it goes up as the
 * rescue the job would have pushed, which clearRemote then merges into main. The list of
 * folders is read here, never the one the pass read before its fetch.
 */
function sendKept(g, now, dry, fixed, st) {
  for (const w of worktrees(g).slice(1)) {
    if (w.branch || !KEPT.test(w.path.replace(/\\/g, '/')) || inUse(g, w.path, KEPT_IDLE_MS)) continue;
    const head = g.out(['-C', w.path, 'rev-parse', '--verify', '-q', 'HEAD^{commit}']).trim();
    if (!head || isIn(g, head) || lines(g.out(['for-each-ref', '--contains', head, '--format=%(refname)', 'refs/remotes/origin'])).length) continue;
    const files = changedSince(g, head);
    if (!files) continue;
    const { all, pending } = recordOf(g, head, files);
    if (!all || !pending.length) continue;
    const rescue = `rescue/main-${new Date(now).toISOString().replace(/\D/g, '').slice(0, 12)}-${basename(w.path)}`;
    if (dry) {
      fixed.push(`would push the record commit kept in ${w.path} to GitHub as ${rescue}`);
      continue;
    }
    // Fetched back by name, so a copy that fetches main alone still sees it as sent.
    if (!net(st, 2)) return;
    if (g.ok(['push', '-q', 'origin', `${head}:refs/heads/${rescue}`], st.netMs)) {
      g.ok(['fetch', '-q', 'origin', `+refs/heads/${rescue}:refs/remotes/origin/${rescue}`], st.netMs);
      fixed.push(`pushed the record commit kept in ${w.path} to GitHub as ${rescue}`);
    }
  }
}

// Main, against the remote's: caught up by fast-forward, pushed when only ahead,
// and merged when the two have diverged and the merge is clean.
function syncMain(g, trees, dry, fixed, left, st) {
  const counts = g.out(['rev-list', '--left-right', '--count', `refs/heads/${MAIN}...${ORIGIN_MAIN}`]).trim();
  if (!counts) return;
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  const tree = trees.find((w) => w.branch === MAIN);
  const at = tree ? ` in ${tree.path}` : '';
  const would = dry ? 'would ' : '';

  if (ahead && behind) {
    const cleanMerge = st.mergeTree && g.out(['merge-tree', '--write-tree', `refs/heads/${MAIN}`, ORIGIN_MAIN], 60000).trim() !== '';
    const settle = { what: `main has ${ahead} commit(s) GitHub lacks and lacks ${behind} of GitHub's`, command: onMain(g, trees, `fetch origin ${MAIN}`, `merge -m "merge: GitHub's main into this copy" origin/${MAIN}`) };
    if (!tree && cleanMerge && !dry) {
      // Main checked out nowhere here: merged without a folder, then main follows (review, 2026-10-16).
      const r = landOnMain(g, sha(g, `refs/heads/${MAIN}`), 'merge', 'merge: this copy\'s main into GitHub\'s', st);
      if (r === 'landed') {
        // Landed is done; main here follows now or at the next pass.
        g.ok(['fetch', '-q', 'origin', `${MAIN}:${MAIN}`], st.netMs);
        fixed.push('merged main here into GitHub\'s main');
      } else if (r === 'conflict') left.push({ ...settle, why: 'the two conflict, so the merge needs resolving by hand' });
    } else if (!tree && dry && cleanMerge) fixed.push(`${would}merge main here into GitHub's main`);
    else if (!tree) left.push({ ...settle, why: st.mergeTree ? 'the two conflict, so the merge needs resolving by hand' : 'this git is older than 2.38, so a clean merge cannot be checked first' });
    else if (!st.mergeTree) left.push({ ...settle, why: 'this git is older than 2.38, so a clean merge cannot be checked first' });
    else if (!cleanMerge) left.push({ ...settle, why: 'the two conflict, so the merge needs resolving by hand' });
    else if (dirty(g, tree.path) || halfDone(g, tree.path)) left.push({ ...settle, why: `the folder holding main has uncommitted edits or an operation stopped partway${at}` });
    else if (dry) fixed.push(`${would}merge GitHub's main into main and push`);
    else if (!mergeSigned(g, tree.path, [...ident(g), '-C', tree.path, 'merge', '-q', '--no-edit', '-m', 'merge: GitHub\'s main into this copy', ORIGIN_MAIN], ORIGIN_MAIN)) {
      // A refused merge (a hook, a signing failure) is never left half-done: a
      // stopped merge would block the next save (review, 2026-10-16). mergeSigned
      // undoes its own; another chat's, begun since halfDone was checked, is theirs.
      left.push({ ...settle, why: 'the merge was refused, and undone' });
    } else if (net(st) && g.ok(['push', '-q', 'origin', `${MAIN}:${MAIN}`], st.netMs)) {
      fixed.push(`merged GitHub's main into main${at} and pushed`);
    } else {
      left.push({ ...settle, why: 'the merge was made here, but GitHub refused its push; the next pass tries again', quiet: true });
    }
  } else if (behind) {
    if (dry) {
      fixed.push(`${would}pull main forward ${behind} commit(s)${at}`);
    } else if (tree ? !halfDone(g, tree.path) && g.ok(['-C', tree.path, 'merge', '-q', '--ff-only', ORIGIN_MAIN]) : net(st) && g.ok(['fetch', '-q', 'origin', `${MAIN}:${MAIN}`], st.netMs)) {
      // A fast-forward never overwrites an uncommitted edit: git refuses it instead, so it is tried whatever the folder holds.
      fixed.push(`pulled main forward ${behind} commit(s)${at}`);
    } else {
      // Checked out nowhere, main is only a ref: a late pass or a failed fetch catches up next time.
      left.push(tree
        ? { what: `main is ${behind} commit(s) behind GitHub`, why: `an uncommitted edit or new file is in the way${at}`, command: `git -C "${tree.path}" pull --ff-only` }
        : { what: `main is ${behind} commit(s) behind GitHub`, why: 'the fetch did not finish in this pass; the next one tries again', command: `git fetch origin ${MAIN}:${MAIN}`, quiet: true });
    }
  } else if (ahead) {
    if (dry) fixed.push(`${would}push ${ahead} commit(s) on main to GitHub`);
    else if (!net(st)) return;
    else if (g.ok(['push', '-q', 'origin', `${MAIN}:${MAIN}`], st.netMs)) fixed.push(`pushed ${ahead} commit(s) on main to GitHub`);
    // The save retries this every turn, and a rescue keeps it on GitHub meanwhile: nothing to hand on (review, 2026-10-16).
    else left.push({ what: `main has ${ahead} commit(s) not on GitHub`, why: 'the push was refused; the save retries it every turn', command: `git push origin ${MAIN}`, quiet: true });
  }
}

/**
 * One pass towards agreement. Returns what it fixed (or, with dry, would fix) and
 * what it left, each left item with why it stays and the command that settles it.
 * `now` is for tests. `netMs` is each network call's own limit (a turn's end,
 * with less time, passes a shorter one so it can still land a branch, review
 * 2026-10-16). `budgetMs` bounds the pass, so a hook's own time limit
 * never cuts git off partway (which would leave a lock behind): past it, no new
 * push starts, and the next pass carries on.
 */
export function reconcile(cwd, { dry = false, now = Date.now(), budgetMs = 10 * 60 * 1000, netMs = NET_MS } = {}) {
  const g = runner(cwd);
  const fixed = [];
  const left = [];
  const notes = [];

  let trees = worktrees(g);
  const started = Date.now();
  const st = { refused: false, late: false, conflicted: new Set(), mergeTree: canMergeTree(g), deadline: started + budgetMs, netMs };
  const left_ms = () => Math.max(5000, st.deadline - Date.now());
  const hasRemote = g.ok(['remote', 'get-url', 'origin'], 5000);
  const deep = hasRemote && wholeHistory(g, Math.min(300000, left_ms()));
  const reached = deep && g.ok(['fetch', '-q', '--prune', 'origin'], Math.min(120000, left_ms()));
  if (reached) {
    syncMain(g, trees, dry, fixed, left, st);
    sendKept(g, now, dry, fixed, st);
    clearRemote(g, { dry, now, trees, fixed, left, notes, st });
  } else if (hasRemote) {
    // Offline is nobody's to settle: the next pass tries again (review, 2026-10-16).
    left.push(deep
      ? { what: 'GitHub could not be reached', why: 'main was not compared with it; the next pass tries again', command: 'git fetch --prune origin', quiet: true }
      : { what: 'the history here could not be deepened', why: 'a shallow copy cannot tell merged branches apart; the next pass tries again', command: 'git fetch --unshallow origin', quiet: true });
  }

  // Main here can stay behind GitHub's: a dry run, an edit in the way, a
  // diverged main. Judged against main here alone, a branch already merged on
  // GitHub then read as unmerged work (2026-10-04); so a branch merged into
  // either counts as in main.
  const hasOrigin = sha(g, ORIGIN_MAIN) !== '';
  const inMain = mergedInto(g, MAIN);
  if (hasOrigin) for (const b of mergedInto(g, `origin/${MAIN}`)) inMain.add(b);

  const current = g.out(['rev-parse', '--abbrev-ref', 'HEAD']).trim();

  // The main folder left on a finished branch that is not a chat's own: back
  // onto main, so a desk copy only ever holds main. A chat's claude/ branch is
  // the platform's, and stays under the live chat. Never a branch just made: one
  // with no commit yet sits at main's tip and reads as merged, and one used in
  // the last day may be someone's live work (review, 2026-10-16).
  const primary = trees[0];
  const primaryTip = primary?.branch ? sha(g, `refs/heads/${primary.branch}`) : '';
  const landedBefore = primaryTip && primaryTip !== sha(g, `refs/heads/${MAIN}`) && primaryTip !== sha(g, ORIGIN_MAIN);
  if (!dry && landedBefore && primary.branch !== MAIN && !primary.branch.startsWith('claude/') && inMain.has(primary.branch) && !inUse(g, primary.path) && !dirty(g, primary.path) && !halfDone(g, primary.path) && sha(g, `refs/heads/${MAIN}`)) {
    if (g.ok(['-C', primary.path, 'switch', '-q', MAIN])) {
      fixed.push(`moved ${primary.path} back onto main from the finished branch ${primary.branch}`);
      if (hasOrigin && g.ok(['-C', primary.path, 'merge', '-q', '--ff-only', ORIGIN_MAIN])) {}
      trees = worktrees(g);
    }
  }

  const cleared = clearFinished(g, { dry, trees, inMain });
  if (cleared.worktrees.length && !dry) trees = worktrees(g);
  for (const p of cleared.worktrees) {
    const held = cleared.held?.[p];
    fixed.push(`${dry ? 'would remove' : 'removed'} the finished worktree ${p}${held ? `, which held only generated files or copies of GitHub's main (${held.join(', ')})` : ''}`);
  }
  for (const b of cleared.branches) fixed.push(`${dry ? 'would delete' : 'deleted'} the merged branch ${b}`);

  // `git branch -d` judges against the branch's upstream or HEAD, so it refuses
  // a branch only GitHub's main holds while this folder is elsewhere. Such a
  // branch is checked against GitHub's main and its ref removed only if it
  // still points where it was checked.
  const checkedOut = new Set(trees.map((w) => w.branch).filter(Boolean));
  const nowCurrent = g.out(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  for (const b of lines(g.out(['for-each-ref', '--format=%(refname:short)', 'refs/heads']))) {
    if (b === MAIN || b === nowCurrent || checkedOut.has(b) || !hasOrigin) continue;
    const tip = sha(g, `refs/heads/${b}`);
    if (!tip || !isIn(g, tip)) continue;
    if (dry) fixed.push(`would delete the merged branch ${b}`);
    else if (g.ok(['branch', '-d', b]) || dropRef(g, b, tip)) fixed.push(`deleted the merged branch ${b}`);
  }

  // Branches only this machine holds, never pushed and not in main: a session's
  // or a record-only one is merged into main, a throwaway one idle a day is
  // retired, the same way as GitHub's; any other is a person's, and only listed.
  for (const b of lines(g.out(['for-each-ref', '--format=%(refname:short)', 'refs/heads']))) {
    if (b === MAIN || b === nowCurrent || checkedOut.has(b) || !reached || dry) continue;
    const tip = sha(g, `refs/heads/${b}`);
    // One with a copy on GitHub is the GitHub pass's, unless this one is ahead of it (review, 2026-10-16).
    const theirs = sha(g, `refs/remotes/origin/${b}`);
    if (!tip || isIn(g, tip) || (theirs && isIn(g, tip, theirs))) continue;
    const files = changedSince(g, tip);
    if (files === null) continue;
    const { all, pending } = recordOf(g, tip, files);
    const tipTime = Number(g.out(['log', '-1', '--format=%ct', tip]).trim()) * 1000;
    let how = null;
    if ((SESSION.test(b) || (all && pending.length)) && st.mergeTree) how = 'merge';
    else if (THROWAWAY.test(b) && !pending.length && now - tipTime >= IDLE_MS) how = 'retire';
    if (!how) continue;
    const message = how === 'merge' ? 'record: merge a saved record into main' : `chore(git): retire an idle branch into main's history\n\nIts commits stay reachable from main, unapplied: ${b} at ${tip}.`;
    const r = landOnMain(g, tip, how, message, st);
    if (r === 'conflict') st.conflicted.add(b);
    if (r === 'landed' && (g.ok(['branch', '-d', b]) || dropRef(g, b, tip))) {
      fixed.push(`${how === 'merge' ? 'merged' : 'retired'} the local branch ${b} into main, then deleted it`);
    }
  }
  // Main on GitHub may have moved forward with the merges just made.
  if (!dry && reached) syncMain(g, trees, dry, fixed, left, st);
  if (st.late) notes.push('the pass ran out of time; the next one carries on');
  else if (st.refused) notes.push('GitHub refused a push to main from here (main moved meanwhile, or this copy may push only its own branch); the next pass tries again');
  if (!st.mergeTree) notes.push('this git is older than 2.38, so branches are not merged into main from here; a session with a newer git does it');

  // What is still here and not in main: a branch checked out somewhere, one
  // with a commit in the last day, or one that conflicts.
  const finalIn = mergedInto(g, MAIN);
  if (hasOrigin) for (const b of mergedInto(g, `origin/${MAIN}`)) finalIn.add(b);
  for (const b of lines(g.out(['for-each-ref', '--format=%(refname:short)', 'refs/heads']))) {
    if (b === MAIN || finalIn.has(b)) continue;
    const base = hasOrigin ? ORIGIN_MAIN : `refs/heads/${MAIN}`;
    const ahead = g.out(['rev-list', '--count', `${base}..refs/heads/${b}`]).trim();
    const remote = sha(g, `refs/remotes/origin/${b}`);
    const unpushed = remote ? g.out(['rev-list', '--count', `refs/remotes/origin/${b}..refs/heads/${b}`]).trim() : ahead;
    const newer = remote ? g.out(['rev-list', '--count', `refs/heads/${b}..refs/remotes/origin/${b}`]).trim() : '0';
    const onGitHub = newer !== '0' ? `, and GitHub's copy has ${newer} this one lacks` : '';
    // Only a save that could not reach main is the agent's to settle; everything
    // else here is expected, and listed without being handed on.
    const { all, pending } = recordOf(g, `refs/heads/${b}`, changedSince(g, `refs/heads/${b}`) ?? []);
    const carriesSaves = SESSION.test(b) || (all && pending.length > 0);
    // Only a branch whose merge into main actually conflicted (review, 2026-10-16).
    const stuck = carriesSaves && b !== nowCurrent && !checkedOut.has(b) && st.conflicted.has(b);
    const why =
      b === nowCurrent ? (b.startsWith('claude/') ? 'it is the branch this chat is on; its saves reach main every turn' : 'it is the branch this folder is on')
      : checkedOut.has(b) ? 'it is checked out in a worktree'
      : stuck ? 'it conflicts with main, and its saves must reach main'
      : carriesSaves ? 'its saves reach main once GitHub can be reached and takes a push from here'
      : THROWAWAY.test(b) ? 'a run\'s branch, retired once a day idle'
      : 'a person\'s own branch, landed only by them';
    const quiet = !stuck;
    left.push(
      unpushed !== '0'
        ? { what: `branch ${b}: ${ahead} commit(s) not in main, ${unpushed} not on GitHub${onGitHub}`, why: `unmerged work that exists only on this machine; ${why}`, command: stuck ? onMain(g, trees, `merge -m "merge: a saved branch into main" ${b}`) : `git push origin ${b}`, quiet }
        : { what: `branch ${b}: ${ahead} commit(s) not in main${onGitHub}`, why: `unmerged work, saved on GitHub; ${why}`, command: newer !== '0' ? `git log --oneline ${b}..origin/${b}` : `git log --oneline ${MAIN}..${b}`, quiet },
    );
  }

  // Every folder: a git operation stopped partway, and the main folder off main.
  // Each is listed, never settled: `git status` says how to finish or undo it.
  for (const w of trees) {
    const op = stillHalfDone(g, w.path);
    // In the main folder it blocks the next save, so it is the agent's; in another, perhaps a live chat's.
    if (op) left.push({ what: `${op} stopped partway in ${w.path}`, why: 'it must be finished or undone', command: `git -C "${w.path}" status`, quiet: w !== trees[0] });
  }
  // The main folder off main: handed on only when its branch is finished (the
  // same test as the switch above); a person's branch, or one just made, is theirs.
  if (trees[0] && trees[0].branch !== MAIN && !trees[0].branch?.startsWith('claude/')) {
    const tip0 = trees[0].branch ? sha(g, `refs/heads/${trees[0].branch}`) : '';
    const done0 = tip0 && tip0 !== sha(g, `refs/heads/${MAIN}`) && tip0 !== sha(g, ORIGIN_MAIN) && inMain.has(trees[0].branch);
    left.push({ what: `the main folder ${trees[0].path} is on ${trees[0].branch ? `branch ${trees[0].branch}` : 'no branch'}, not ${MAIN}`, why: done0 ? 'its branch is finished, and a session opening here expects main' : 'someone\'s work in progress, left as it is', command: `git -C "${trees[0].path}" switch ${MAIN}`, quiet: !done0 });
  }

  // A worktree left behind for any reason is listed, never silently skipped. One in
  // use in the last day is a live chat's, and only its edits are mentioned.
  for (const w of trees.slice(1)) {
    if (cleared.worktrees.includes(w.path)) continue;
    const settle = `git -C "${w.path}" status`;
    if (dirty(g, w.path)) left.push({ what: `worktree ${w.path}`, why: 'it holds uncommitted edits, perhaps a live chat\'s', command: settle, quiet: true });
    else if (inUse(g, w.path)) continue;
    else if (!w.branch) left.push({ what: `worktree ${w.path}`, why: 'it is on no branch (a detached checkout), so it is never cleared as finished', command: settle, quiet: true });
    else if (w.branch !== current && inMain.has(w.branch)) {
      const why = untracked(g, w.path) ? 'it holds new files never committed, so git refuses to remove it' : ignoredRecord(g, w.path) ? 'it holds record files git ignores, which removing it would delete' : 'git refused to remove it (perhaps locked)';
      left.push({ what: `worktree ${w.path} (finished branch ${w.branch})`, why, command: settle, quiet: true });
    }
  }
  if (g.out(['status', '--porcelain']).trim()) left.push({ what: `uncommitted files in ${cwd}`, why: 'perhaps a chat\'s work in progress, so never touched', command: 'git status', quiet: true });
  for (const s of lines(g.out(['stash', 'list', '--format=%gd %s']))) {
    const [ref, ...msg] = s.split(' ');
    // A stash taken whole in a shared folder carries her unsaved words with it, on no
    // commit and on this machine only; listed quietly, they were never said (round 41).
    const words = stashedRecord(g, ref);
    if (words.length) left.push({ what: `stash ${ref}: ${msg.join(' ')}`, why: `it holds her record words that no commit has (${words.join(', ')}), on this machine only; a stash is only ever dropped by the developer, so bring them back, keeping it`, command: `git stash apply ${ref}` });
    else left.push({ what: `stash ${ref}: ${msg.join(' ')}`, why: 'a stash is only ever dropped by the developer', command: `git stash show -p ${ref}`, quiet: true });
  }

  // main is compared twice in a pass; a thing still left is said once, as last found.
  const once = [...new Map(left.map((l) => [l.what, l])).values()];
  return { fixed, left: once, notes };
}
