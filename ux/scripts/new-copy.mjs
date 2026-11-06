#!/usr/bin/env node
// The README's download step (DEP-015 design 1): a fresh clone becomes the start
// of a new copy. The history it came with and the record in it belong to the
// copy it was cloned from, so both go, and a blank record takes the record's
// place. Everything after this is the set-up skill's, in a conversation.
//
//   node ux/scripts/new-copy.mjs                        says what it would do, changes nothing
//   node ux/scripts/new-copy.mjs --go [--for me|someone-else]   does it
//
// Who the copy is for is asked when --for is not given (a terminal), or refused
// without it (no terminal). For someone else, dev/ goes too: the developer's
// folder never ships to a person's copy (DEP-013, ARC-007). Either answer is
// written in the setup notes as `- for · me` or `- for · someone else`, so the
// setup doctor can flag a copy marked as someone else's that has dev/ again.
//
// Run by the person, in their own terminal, before Claude is opened in the
// folder, so no session ever reads the record the clone brought with it. It
// refuses inside a Claude session: an agent never removes a record (set-up § 5).
// It refuses anything that looks like a copy in use, uncommitted or unpushed
// work, and says so once the copy is new, so running it twice is harmless.
// The source copy is untouched: its record stays where it was, on GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CODE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.NEW_COPY_ROOT || CODE;
const go = process.argv.includes('--go');
const argFor = (() => {
  const i = process.argv.findIndex((a) => a === '--for' || a.startsWith('--for='));
  return i < 0 ? '' : process.argv[i].includes('=') ? process.argv[i].split('=')[1] : (process.argv[i + 1] ?? '');
})();
/** 'me', 'someone else', or null when the answer is neither. */
const whoFor = (said) => (/^(me|self|mine|my own)$/i.test(said.trim()) ? 'me' : /^(someone[- ]else|other|them|a friend)$/i.test(said.trim()) ? 'someone else' : null);

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const gitOk = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};
const stop = (why) => {
  console.error(`new-copy: ${why}`);
  process.exit(1);
};

// The new history is started here, in scratch, before anything is removed: a git
// too old for `init -b` (before 2.28), a full disk or an interrupt once left a
// copy with its history gone and no new one, which every rerun called "not a git
// clone" (edge cases, 2026-10-29, A1-3). Its being here means a run passed every
// check below and stopped part-way, so a rerun finishes it.
const PENDING = join(ROOT, 'temp', 'new-copy');

// One run at a time: two at once each started a history in temp/new-copy, one
// left the folder with no .git, and the other called it a git too old (round 3,
// B11). Taken before anything is looked at; a lock whose run is gone is taken over.
const LOCK = join(ROOT, 'temp', 'new-copy.lock');
let locked = false;
const unlock = () => {
  if (!locked) return;
  locked = false;
  rmSync(LOCK, { force: true });
  try {
    if (!readdirSync(join(ROOT, 'temp')).length) rmSync(join(ROOT, 'temp'), { recursive: true, force: true });
  } catch {
    // already gone
  }
};
if (go && !process.env.CLAUDECODE && existsSync(join(ROOT, 'modules'))) {
  mkdirSync(join(ROOT, 'temp'), { recursive: true });
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  };
  for (let tries = 0; tries < 2 && !locked; tries += 1) {
    try {
      writeFileSync(LOCK, `${process.pid}\n`, { flag: 'wx' });
      locked = true;
    } catch {
      let holder = 0;
      try {
        holder = Number(readFileSync(LOCK, 'utf8').trim());
      } catch {
        // released meanwhile
      }
      if (Number.isInteger(holder) && holder > 0 && alive(holder)) {
        console.error('new-copy: another run of it is going on in this folder; nothing was changed. Wait for it to finish, then run it again if it is needed.');
        process.exit(1);
      }
      rmSync(LOCK, { force: true });
    }
  }
  process.on('exit', unlock);
}
const resuming = existsSync(join(PENDING, '.git'));

if (process.env.CLAUDECODE) stop('run this in your own terminal, not inside Claude: it removes the record that came with the clone, and an agent never removes a record.');
if ((!resuming && !existsSync(join(ROOT, 'data'))) || !existsSync(join(ROOT, 'modules'))) stop('run it from the folder you cloned: no data/ or modules/ here.');
if (!existsSync(join(ROOT, '.git')) && !resuming) stop('this folder is not a git clone. If new-copy stopped part-way here, delete this folder and clone again.');

const finish = () => {
  git('config', 'core.hooksPath', '.claude/hooks/git');
  rmSync(PENDING, { recursive: true, force: true });
  unlock();
  const temp = join(ROOT, 'temp');
  if (existsSync(temp) && !readdirSync(temp).length) rmSync(temp, { recursive: true, force: true });
};
const done = () => {
  // A run stopped after the new history took the old one's place: finish it.
  if (existsSync(PENDING)) finish();
  console.log('This is already a new copy: no history from another copy, and a blank record.');
  console.log('Next: open Claude Code in this folder and say "help me set it up".');
  process.exit(0);
};
const inUse = (why) => stop(`${why}, so this looks like a copy in use; nothing was changed.`);
if (existsSync(join(ROOT, '.git')) && gitOk('rev-parse', '--verify', '-q', 'HEAD') === null) done();
// Every commit on no remote: the one checked out even when no branch holds it (a
// detached HEAD's), every branch, every tag (round 2, 2026-10-29, C14: dropping
// HEAD wiped an unpushed commit made on a detached HEAD).
const unpushed = () => Number(gitOk('rev-list', '--count', 'HEAD', '--branches', '--tags', '--not', '--remotes=origin') || 0);
// Another working folder on this history (git worktree) loses its history with
// this one's, and whatever it holds unsaved with it (C14).
const otherWorktrees = () => (gitOk('worktree', 'list', '--porcelain') ?? '').split('\n').filter((l) => l.startsWith('worktree ')).length > 1;
const PENDING_HEAD = join(PENDING, 'head');
// FEEDBACK.md with the source copy's entries taken out, keeping its heading
// (CON-017; round 2, 2026-10-29, B23).
const emptiedFeedback = (text) => {
  let inEntries = false;
  const kept = String(text).split('\n').filter((line) => {
    if (/^## /.test(line)) {
      inEntries = /^## Entries\s*$/.test(line);
      return true;
    }
    return !inEntries;
  });
  return `${kept.join('\n').replace(/\n*$/, '')}\n`;
};
// A rerun's own FEEDBACK.md change is the run's, not work since: it once read
// as uncommitted work, and a stopped run could never be finished (round 3, C22).
const feedbackEmptiedHere = () => {
  const head = gitOk('show', 'HEAD:FEEDBACK.md');
  return head !== null && existsSync(join(ROOT, 'FEEDBACK.md')) && readFileSync(join(ROOT, 'FEEDBACK.md'), 'utf8') === emptiedFeedback(head);
};
// The heartbeat's run record (.claude/jobs/state.json, HBT-008) is the source
// copy's own: a new copy cloned it, and read the source's runs and locks as its
// own (round 8 follow-up). It starts with only the file's _what line.
const JOB_STATE = '.claude/jobs/state.json';
const emptiedJobState = (text) => {
  let what;
  try {
    what = JSON.parse(text)?._what;
  } catch {
    what = undefined;
  }
  return `${JSON.stringify(typeof what === 'string' ? { _what: what } : {}, null, 2)}\n`;
};
// A rerun's own reset of it is the run's, not work since, as with FEEDBACK.md.
const jobStateEmptiedHere = () => {
  const head = gitOk('show', `HEAD:${JOB_STATE}`);
  return head !== null && existsSync(join(ROOT, JOB_STATE)) && readFileSync(join(ROOT, JOB_STATE), 'utf8') === emptiedJobState(head);
};
if (resuming && existsSync(join(ROOT, '.git'))) {
  // A run stopped before its history took the old one's place left the old one
  // here. Finishing it trusts the checks that run made, so only while nothing has
  // moved since: the same commit checked out, nothing new on no remote, nothing
  // unsaved beyond what the run itself changed (the record, dev/ going, the
  // review ledger's lines). A stale temp/new-copy/ once skipped every check and
  // wiped work done after it (round 2, 2026-10-29, C15).
  const startOver = 'If you mean to start again, delete the temp/new-copy folder and run it again.';
  const was = existsSync(PENDING_HEAD) ? readFileSync(PENDING_HEAD, 'utf8').trim() : '';
  if (!was || gitOk('rev-parse', 'HEAD') !== was) stop(`temp/new-copy/ is left from an earlier run, and this folder has moved on since; nothing was changed. ${startOver}`);
  const dirty = (gitOk('status', '--porcelain', '--untracked-files=all', '--', '.', ':!data', ':!data-sandbox', ':!temp') ?? '')
    .split('\n')
    // The first line comes trimmed (" M x" reads "M x"), so its leading space is optional.
    .filter((l) => l && !/^ ?D dev\//.test(l) && !/^ ?M dev\/session-reviews\.md$/.test(l) && !(/^ ?M FEEDBACK\.md$/.test(l) && feedbackEmptiedHere()) && !(/^ ?M \.claude\/jobs\/state\.json$/.test(l) && jobStateEmptiedHere()));
  if (dirty.length || unpushed() || gitOk('stash', 'list') || otherWorktrees()) stop(`temp/new-copy/ is left from an earlier run, and there is work here since that is on no remote; nothing was changed. ${startOver}`);
}
if (!resuming) {
  if (gitOk('remote', 'get-url', 'origin') === null) stop('this copy has its own history and no origin; it is not a fresh clone, so nothing was changed.');
  // This run's own lock aside, in a clone that does not ignore temp/.
  if (git('status', '--porcelain', '--', '.', ':!temp/new-copy.lock')) inUse('there are uncommitted changes here');
  // Every branch, not only the one checked out, and the stash: each goes with the
  // history (edge cases, 2026-10-29, A5).
  if (unpushed()) inUse('this folder has commits that are on no remote');
  if (otherWorktrees()) inUse('this history has another working folder (git worktree list)');
  if (gitOk('stash', 'list')) inUse('this folder has stashed changes, which are on no remote');
  // Files git ignores are on no remote either, and data/archive-local/ is ignored
  // by design: status never shows them, and the record's removal would take them
  // (edge cases, 2026-10-29, A4).
  if (gitOk('ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '--', 'data', 'data-sandbox')) inUse('there are files in the record here that are on no remote');
}

const plan = [
  'remove the history it was cloned with (and any token saved in its address)',
  'remove the record that came with it, which is the source copy\'s and stays there',
  'lay a blank record in its place, from the templates in modules/',
  'for someone else, remove dev/, the developer\'s own folder, which never ships to a person\'s copy',
  'empty FEEDBACK.md\'s entries, the source copy\'s lessons, keeping its heading',
  'empty the heartbeat\'s run record (.claude/jobs/state.json), the source copy\'s runs, keeping its _what line',
  'record the harness it starts from, so its first update is an ordinary one',
  'write who it is for in the setup notes, and start a new history on main with the commit gate on',
];
if (!go) {
  console.log('Would:');
  for (const step of plan) console.log(`  - ${step}`);
  console.log('Nothing has changed. Run it again with --go to do it.');
  process.exit(0);
}

const pendingFor = join(PENDING, 'for');
const PENDING_INSTALLED = join(PENDING, 'installed.json');
const INSTALLED = join(ROOT, '.claude', 'release', 'installed.json');
/**
 * The harness this copy starts from, as the updater records an installed
 * release: every tracked file the release manifest ships, with its hash. Without
 * it a new copy's first update read as a first install: going back over it was
 * refused, and files that release dropped were never removed (round 3, D23).
 * Only from the download's own tracked files and manifest, so nothing local or
 * ignored is ever listed for an update to remove; a copy that already records
 * one keeps its own.
 */
function downloadShipped() {
  if (existsSync(INSTALLED)) return null;
  const manifestPath = join(ROOT, 'dev', 'skills', 'release', 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
  const under = (path, entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry);
  const tracked = (gitOk('-c', 'core.quotePath=false', 'ls-files', '-z') ?? '').split('\0').filter(Boolean);
  const files = tracked.filter((p) => (manifest.ship ?? []).some((e) => under(p, e)) && !(manifest.never ?? []).some((e) => under(p, e)) && touchable(p) && existsSync(join(ROOT, p)));
  const hashes = hashTree(ROOT, files);
  return `${JSON.stringify({ version: '0', source: 'download', fingerprint: fingerprint(hashes), files: hashes, notes: 'the download this copy was made from' }, null, 2)}\n`;
}
let forWhom = whoFor(argFor) ?? (resuming && existsSync(pendingFor) ? whoFor(readFileSync(pendingFor, 'utf8')) : null);
if (!forWhom && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  forWhom = whoFor(await rl.question('Who is this copy for? Type "me" or "someone else": '));
  rl.close();
}
if (!forWhom) stop(`say who the copy is for: --for me, or --for someone-else. Nothing ${resuming ? 'more ' : ''}was changed.`);
if (!resuming && forWhom === 'someone else' && gitOk('ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '--', 'dev')) inUse('there are files in dev/ here that are on no remote');

// Templates come from this harness; the record goes into the folder being made new.
process.env.CLAUDE_PROJECT_DIR = CODE;
const { buildBlankRecord } = await import(pathToFileURL(join(CODE, '.claude', 'hooks', 'lib', 'sandbox.mjs')).href);
const { readModules } = await import(pathToFileURL(join(CODE, '.claude', 'hooks', 'lib', 'modules.mjs')).href);
const { fingerprint, hashTree, touchable } = await import(pathToFileURL(join(CODE, '.claude', 'hooks', 'lib', 'update', 'release-lib.mjs')).href);

if (!resuming) {
  rmSync(PENDING, { recursive: true, force: true });
  mkdirSync(PENDING, { recursive: true });
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', PENDING], { stdio: 'ignore' });
  } catch {
    rmSync(PENDING, { recursive: true, force: true });
    stop('git could not start a new history on main here; it needs git 2.28 or newer (`git --version` says which you have). Nothing was changed.');
  }
  // What a rerun checks it is still finishing this run on (C15).
  writeFileSync(PENDING_HEAD, `${git('rev-parse', 'HEAD')}\n`);
  const shipped = downloadShipped();
  if (shipped) writeFileSync(PENDING_INSTALLED, shipped);
}
writeFileSync(pendingFor, `${forWhom}\n`);

rmSync(join(ROOT, 'data'), { recursive: true, force: true });
rmSync(join(ROOT, 'data-sandbox'), { recursive: true, force: true });
buildBlankRecord(join(ROOT, 'data'));
// The harness points at places in the record that fill with use: each module's
// growing folders (a therapy sessions folder, nutrition's days) and the archive's
// check-in questions, made on first use. git keeps no empty folder, so a blank
// record would commit without them, and the link check, rightly strict in a
// record in use, refused the first commit of every new copy (set-up cases,
// 2026-10-27 · 8). Each is laid here: a .gitkeep in an empty growing folder, and
// the questions file with its one-line heading.
for (const mod of readModules(CODE)) {
  for (const folder of mod.grows) {
    const dir = join(ROOT, 'data', folder);
    mkdirSync(dir, { recursive: true });
    if (!readdirSync(dir).length) writeFileSync(join(dir, '.gitkeep'), '');
  }
}
const questions = join(ROOT, 'data', 'archive', 'check-in-questions.md');
if (!existsSync(questions)) writeFileSync(questions, '# Check-in questions\n');
if (forWhom === 'someone else') rmSync(join(ROOT, 'dev'), { recursive: true, force: true });
// For the developer himself, dev/ stays, and its review ledger's lines name
// commits in the history this copy no longer has: they belong to the source
// copy, which keeps them on GitHub, as its record and history do. What waits on
// him (dev/for-you.md, A-152) stays, still his; the ledger starts empty, so the
// for-you check (every review's commit held here) holds from the first commit
// (2026-10-27 · 8).
const reviews = join(ROOT, 'dev', 'session-reviews.md');
if (forWhom === 'me' && existsSync(reviews)) {
  const kept = readFileSync(reviews, 'utf8').split('\n').filter((line) => !line.startsWith('- '));
  writeFileSync(reviews, kept.join('\n'));
}
// FEEDBACK.md holds lessons learnt in this copy's conversations (CON-017): the
// source copy's are its own, so its entries stay with it and the heading stays
// for this copy's (round 2, 2026-10-29, B23).
const feedback = join(ROOT, 'FEEDBACK.md');
if (existsSync(feedback)) writeFileSync(feedback, emptiedFeedback(readFileSync(feedback, 'utf8')));
const jobState = join(ROOT, JOB_STATE);
if (existsSync(jobState)) writeFileSync(jobState, emptiedJobState(readFileSync(jobState, 'utf8')));
// The setup notes (set-up SKILL.md § 1), in setup terms only, listed in the map.
writeFileSync(join(ROOT, 'data', 'core', 'state', 'setup_notes.md'), `# Setup notes\n\nWhat the setup needs, in setup terms only, nothing about her life (the set-up skill).\n\n- for · ${forWhom}\n`);
const map = join(ROOT, 'data', 'README.md');
if (existsSync(map)) {
  const text = readFileSync(map, 'utf8');
  const row = '| `core/state/setup_notes.md` | What the setup needs, in setup terms only. | — |';
  const after = text.split('\n').findIndex((l) => l.startsWith('| `core/state/proposals.md`'));
  if (after >= 0 && !text.includes('setup_notes.md')) {
    const lines = text.split('\n');
    lines.splice(after + 1, 0, row);
    writeFileSync(map, lines.join('\n'));
  }
}
// Last, the history: the new one, made first, takes the old one's place in one
// rename. Stopped before it, a rerun finishes from here; after it, a rerun sees
// a new copy and tidies up.
if (existsSync(PENDING_INSTALLED) && !existsSync(INSTALLED)) {
  mkdirSync(dirname(INSTALLED), { recursive: true });
  writeFileSync(INSTALLED, readFileSync(PENDING_INSTALLED, 'utf8'));
}
rmSync(join(ROOT, '.git'), { recursive: true, force: true });
renameSync(join(PENDING, '.git'), join(ROOT, '.git'));
finish();

if (!readFileSync(join(ROOT, 'data', 'core', 'me', 'about_me.md'), 'utf8').includes('unfilled:')) stop('the blank record did not come out blank; check modules/core/templates.');
console.log(`Done: a new copy for ${forWhom}, with a blank record and no history${forWhom === 'me' ? '' : ', and no dev/ folder'}.`);
console.log('Next: open Claude Code in this folder and say "help me set it up".');
