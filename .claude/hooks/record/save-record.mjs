// Stop — commit and push everything written to data/ (and data-sandbox/), the
// moment the turn ends. MEM-005, "What matters is recorded as it surfaces, never
// awaiting permission" (design 2): saving is never a step she takes.
//
// CLAUDE.md: "Writing a file is not saving it. Sessions run on a disposable
// machine that is reclaimed without warning once she goes quiet." This is the
// only thing standing between a written record and a lost one, so it runs on
// every turn end rather than at some end of session that may never arrive.
//
// Pushes to main first, from any branch, so the save lands where the next
// session reads it without depending on GitHub Actions. Where main refuses it
// (a phone session's git proxy once refused every branch but its own `claude/`
// one), it pushes to the branch the session is on, and
// .github/workflows/merge-sessions.yml carries that into main (DEP-005,
// DEP-007). At a desk, on main, this is the same push it always was.
//
// Never opens a pull request. Commit messages name the file, never the content.
// A failed push is written down where the next session will trip over it — a
// silent failure to save is the one failure she cannot see.
//
// Was a shell script until it wasn't: `git` here is an argument array, so this
// runs identically under sh, cmd.exe and PowerShell, and no part of it depends
// on a POSIX shell being the thing that launched it.

import { readHookInput, readEntries, pass, block, git, gitOk, gitMergeSigned, gitSigned, repoRoot } from '../lib/hook.mjs';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { CORE_DATA } from '../lib/modules.mjs';
import { canMergeTree, reconcile, runner, signedFirst, stillHalfDone, UNSIGNED } from '../lib/branches.mjs';
import { forgetRefused } from '../lib/refused-staged.mjs';

// The hook's own clock: settings.json gives it 180s, and the sync below gets
// only what the save leaves, so no git is ever cut off partway (review, 2026-10-16).
const T0 = Date.now();
const HOOK_MS = Number(process.env.DEAR_SAVE_HOOK_MS) || 170000; // the variable is for tests only
// Each network call of the save itself: at most eight of them, so a stalled
// connection still leaves the hook time to write the failure note and say so,
// rather than being killed silently at 180s (DEP-006; review, 2026-10-16).
const NET = { timeout: Number(process.env.DEAR_SAVE_NET_MS) || 15000 }; // the variable is for tests only
// But the calls are not all the save waits on: another chat's merge marker (up to 34 s)
// and a signer (up to SIGNED_MS) come first, and eight calls on top of them ran past the
// clock, stopped before the failure note was written (round 32, test-save-budget.mjs).
// So each call gets only what the clock has left, less RESERVE_MS for the note and the
// turn's message; with under a second left, none is started.
const RESERVE_MS = 5000;
const netLeft = () => Math.min(NET.timeout, HOOK_MS - (Date.now() - T0) - RESERVE_MS);
const netOk = (args) => netLeft() >= 1000 && gitOk(args, { timeout: netLeft() });

// The same pass a session opens with (lib/branches.mjs, DEP-011), at the end of
// every turn, so this copy and GitHub never drift apart for long: main caught
// up, every other branch landed or retired and removed. At most every few
// minutes, since each costs a fetch; never under the selftest, which runs on
// the live repository. Silent: what it cannot settle, the next session start
// hands to the agent.
const SYNC_EVERY_MS = 3 * 60 * 1000;
// The files the sync is made of; edited and uncommitted, the turn-end sync waits.
const SYNC_CODE = ['.claude/hooks/lib/branches.mjs', '.claude/hooks/lib/hook.mjs', '.claude/hooks/record/save-record.mjs', '.claude/hooks/session/prune-branches.mjs'];
function syncQuietly() {
  if (process.env.DEAR_RECORD_READONLY === '1') return;
  try {
    const at = git(['rev-parse', '--git-path', 'dear-synced']).trim() || join('.git', 'dear-synced');
    const stamp = isAbsolute(at) ? at : join(repoRoot, at);
    // A stamp dated ahead of the clock is no recent sync: one a day ahead once stopped
    // the turn-end sync for that day (round 3, B9).
    const age = existsSync(stamp) ? Date.now() - statSync(stamp).mtimeMs : Infinity;
    if (age >= 0 && age < SYNC_EVERY_MS) return;
    // Never while the sync's own code is being edited: hooks run from the working
    // tree, so a half-written change ran at a turn's end and pushed eleven
    // commits to main before it was tested (2026-10-15). It runs again once
    // the edits are committed.
    if (git(['status', '--porcelain', '--', ...SYNC_CODE]).trim()) return;
    // Deepening a shallow copy can take minutes: the session start does that, never a turn's end.
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return;
    writeFileSync(stamp, new Date().toISOString());
    reconcile(repoRoot, { budgetMs: Math.max(0, HOOK_MS - (Date.now() - T0)), netMs: NET.timeout });
  } catch {}
}
// Every way out through here means the record is on GitHub, however it got
// there (this turn's push, an earlier one, a hand push, the sync): so the
// failure flag goes too, or the next session warns of a failure long over
// (review, 2026-10-16).
const done = () => {
  // What was committed is on GitHub, but part of the record is not committed yet:
  // its note stays and the turn is told, as before the push (round 29).
  if (heldUp) heldUp.end();
  rmSync(failurePath, { force: true });
  syncQuietly();
  if (sandboxRefused && !input?.stop_hook_active) {
    block(
      [
        'The test chat in data-sandbox/ was not saved this turn: the commit gate refused it, most likely the privacy check (A-155). Her record in data/ was saved as usual.',
        'Run node ux/scripts/check-privacy.mjs from the repository root, take the personal part out of data-sandbox/ (it is outside data/, so nothing personal belongs there), and the next turn saves it. Do not mention this to her.',
      ].join('\n'),
    );
  }
  pass();
};

const input = await readHookInput();

// PMM-014: which procedure made the change. The commit's own tree pins each
// procedure's version, so what a save must add is its name: one `Procedure:`
// trailer per skill this session has loaded so far, read from the transcript's
// Skill calls. A skill's name is harness, never her record. No transcript, or
// no skill loaded, and the message is the subject alone.
function procedures(transcriptPath) {
  const entries = readEntries(transcriptPath) ?? [];
  const names = entries
    .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content)
    .filter((c) => c?.type === 'tool_use' && c.name === 'Skill')
    .map((c) => String(c.input?.skill ?? '').trim())
    .filter((name) => /^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(name));
  return [...new Set(names)];
}

// A new copy with no GitHub repository yet (setup, before its push step):
// there is nowhere off the machine to save to, and setup's own first commit
// carries the record, so its history starts with one commit. Nothing is
// committed, flagged or said here; the files stay on disk (review, 2026-10-16).
if (!gitOk(['remote', 'get-url', 'origin'])) pass();

const failurePath = join(repoRoot, 'data', CORE_DATA, 'state', 'PUSH_FAILED.md');

// Another chat's merge in this folder may still be signing its commit: it holds
// MERGE_HEAD and no lock while it signs, for up to SIGNED_MS. The commit of data/
// below fails beside it, and the turn was told to settle the merge with an abort,
// which, mid-signing, leaves the merge committed and its incoming record lines staged
// as removed for the next save to commit (round 31). So a marker that fresh is waited
// out first, as the session-start pass does; one still there after is stopped partway.
// A cherry-pick the same: a clean one holds CHERRY_PICK_HEAD while it signs, and the turn
// was told to settle it with `git cherry-pick --abort`, which, mid-signing, left the pick
// committed and its record lines staged as removed for the next save to commit (round 37).
// A revert likewise, now that one stopped partway is settled the same way (round 39).
if (['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some((m) => gitOk(['rev-parse', '-q', '--verify', m]))) stillHalfDone(runner(repoRoot), repoRoot);

// Her record, and the sandbox when there is one: saved whatever this chat is
// doing, so a switch never decides what is kept. A pathspec that does not exist
// fails the whole add, so the sandbox is named only when it is there.
// The failure flag below lives on this machine only, and is never committed: a
// flag that rode a successful save to GitHub told the next session a save had
// failed that had not (review, 2026-10-16).
// .gitignore keeps it out of every add; one an older version committed is
// untracked here, so its removal rides this save (review, 2026-10-16).
const records = ['data/', ...(existsSync(join(repoRoot, 'data-sandbox')) ? ['data-sandbox/'] : [])];
// Her record alone. The sandbox is outside data/ and is held to the privacy check like
// any harness file (A-155, 2026-11-01), so it is committed apart, after her record: a
// sandbox the gate refuses never holds back her words, and is never called her record.
const herRecord = ['data/'];
const sandbox = records.filter((r) => r !== 'data/');
let sandboxRefused = false;
// Set when part of her record could not be committed this turn (below).
let heldUp = null;

// Another git in this folder (a second chat's commit, the selftest, a sync
// tool) holds index.lock for a moment: wait it out briefly rather than read a
// passing lock as a refusal (review, 2026-10-16).
const lockPath = () => {
  const at = git(['rev-parse', '--git-path', 'index.lock']).trim() || join('.git', 'index.lock');
  return isAbsolute(at) ? at : join(repoRoot, at);
};
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function gitPatient(args, run = gitOk) {
  for (let i = 0; i < 4; i++) {
    if (run(args)) return true;
    if (!existsSync(lockPath())) return false;
    pause(1500);
  }
  return false;
}

// A record file a stopped merge left in conflict is never staged: `add` would
// take its conflict markers as the resolution, and the next commit would put
// them into her record (review, 2026-10-16). The merge is settled first, below.
// Nor is anything staged while any merge is stopped partway: the commit is refused there
// anyway, and the turn is told it may settle the merge with `git merge --abort`, which
// resets every staged file to HEAD on disk too, so her words staged into that merge were
// wiped and a new page deleted. Left unstaged, the abort keeps them (round 33). A
// cherry-pick stopped partway is the same: a partial commit refused, and its abort, by
// whichever chat began it, wiped them the same way (round 36). A revert the same since
// round 39: git takes a partial commit there, but any commit ends the revert, so the save's
// commit left it unabortable with its own record change staged (a page's removal), for the
// next save to commit as a session update. One rule for all three now.
const stoppedOp = () => (gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD']) ? 'merge' : gitOk(['rev-parse', '-q', '--verify', 'CHERRY_PICK_HEAD']) ? 'cherry-pick' : gitOk(['rev-parse', '-q', '--verify', 'REVERT_HEAD']) ? 'revert' : null);
const unmergedRecord = stoppedOp() !== null;
// A record page in conflict under a stop the save does not read (a rebase, an am, a stash
// brought back) is left out by name, never staged, and the rest of her record saved beside
// it: holding back every page there left her words uncommitted, and a rebase's abort, which
// resets the folder hard, wiped them, a staged new page too (round 40). Git takes a partial
// commit under those stops; a merge, a cherry-pick or a revert never get this far (above).
const conflictedRecord = git(['diff', '--name-only', '--diff-filter=U', '-z', '--', ...records]).split('\0').filter(Boolean);
const skipConflicts = conflictedRecord.map((p) => `:(exclude,literal)${p}`);

// The record pages an operation stopped partway changes itself are its own, never the
// save's: never unstaged here (below), so its abort finds them as it left them.
const opHead = () => ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].find((m) => gitOk(['rev-parse', '-q', '--verify', m])) ?? null;
const nulList = (args) => git(args).split('\0').filter(Boolean);
// What the operation itself does to her record is what its merge makes of HEAD, worked out
// again apart from the index (merge-tree, as the operation's own ort merge does): a commit
// whose page change HEAD already holds stages nothing there, yet its diff named the page,
// so her words staged on it were kept staged for the abort to wipe (round 40). A pick or a
// revert of a merge commit names no parent it took, so a page counts only if every parent
// would change it. Null where it cannot be worked out, for the diff below.
function opMergedPaths(m) {
  if (!canMergeTree(runner(repoRoot))) return null;
  const tip = git(['rev-parse', '-q', '--verify', `${m}^{commit}`]).trim();
  if (!tip) return null;
  let sides;
  if (m === 'MERGE_HEAD') {
    const at = git(['rev-parse', '--git-path', 'MERGE_HEAD']).trim();
    let heads = [];
    try {
      heads = readFileSync(isAbsolute(at) ? at : join(repoRoot, at), 'utf8').split(/\s+/).filter((h) => /^[0-9a-f]{40,64}$/.test(h));
    } catch {}
    sides = (heads.length ? heads : [tip]).map((h) => [[], h]);
  } else {
    const parents = git(['rev-list', '--parents', '-n', '1', tip]).trim().split(/\s+/).slice(1);
    if (!parents.length) return null;
    sides = parents.map((p) => (m === 'REVERT_HEAD' ? [[`--merge-base=${tip}`], p] : [[`--merge-base=${p}`], tip]));
  }
  const each = [];
  const trees = [];
  for (const [base, theirs] of sides) {
    const tree = git(['merge-tree', '--write-tree', ...base, 'HEAD', theirs], { timeout: 60000, anyStatus: true }).split(/\r?\n/)[0].trim();
    if (!/^[0-9a-f]{40,64}$/.test(tree)) return null;
    trees.push(tree);
    each.push(nulList(['diff', '--name-only', '--no-renames', '-z', 'HEAD', tree, '--', ...herRecord]));
  }
  // A merge of several heads changes what any of them changes.
  const named = m === 'MERGE_HEAD' ? [...new Set(each.flat())] : each.reduce((a, b) => a.filter((p) => b.includes(p)));
  // A page counts only if the operation staged it: still in conflict, resolved by an add
  // (git keeps its resolve-undo), or holding what the operation's merge makes of it. A
  // merge with `-s ours` (how a branch already in main is recorded as merged, its signer
  // failing) stages nothing at all, yet merge-tree named every page the branch changed, so
  // her words staged there were kept staged for its abort to wipe (round 41). A merge of
  // several heads is left as named: its result is none of the per-head trees.
  if (m === 'MERGE_HEAD' && sides.length > 1) return named;
  const blobs = (args) => new Map(nulList(args).map((l) => {
    const tab = l.indexOf('\t');
    return [l.slice(tab + 1), l.slice(0, tab).split(' ')];
  }));
  const index = blobs(['ls-files', '-s', '-z', '--', ...herRecord]);
  const resolved = new Set(blobs(['ls-files', '--resolve-undo', '-z', '--', ...herRecord]).keys());
  const made = trees.map((t) => blobs(['ls-tree', '-r', '-z', t, '--', ...herRecord]));
  const sha = (entry, at) => entry?.[at] ?? null;
  return named.filter((p) => {
    const here = index.get(p);
    if (!here || here[2] !== '0' || resolved.has(p)) return true;
    return made.some((t) => sha(t.get(p), 2) === sha(here, 1));
  });
}
function opRecordPaths() {
  const m = opHead();
  if (!m) return [];
  const changed = opMergedPaths(m) ?? (m === 'MERGE_HEAD'
    ? nulList(['diff', '--name-only', '--no-renames', '-z', 'HEAD...MERGE_HEAD', '--', ...herRecord])
    : gitOk(['rev-parse', '-q', '--verify', `${m}^`])
      ? nulList(['diff', '--name-only', '--no-renames', '-z', `${m}^`, m, '--', ...herRecord])
      : nulList(['diff-tree', '-r', '--root', '--no-commit-id', '--name-only', '--no-renames', '-z', m, '--', ...herRecord]));
  return [...new Set([...changed, ...nulList(['diff', '--name-only', '--diff-filter=U', '-z', '--', ...herRecord])])];
}
const opPaths = opRecordPaths();

// Excluded here too, for a copy whose .gitignore predates the rule.
if (!unmergedRecord) gitPatient(['add', '-A', '--', ...records, `:(exclude)data/${CORE_DATA}/state/PUSH_FAILED.md`, ...skipConflicts]);
// A commit limited to data/ takes every file HEAD tracks from disk, so a
// tracked flag still on disk would ride back in: it is lifted off for the
// commit and put back after, untracked.
const flagRel = `data/${CORE_DATA}/state/PUSH_FAILED.md`;
const flagTracked = !unmergedRecord && gitOk(['cat-file', '-e', `HEAD:${flagRel}`]);
const flagHeld = flagTracked && existsSync(failurePath) ? readFileSync(failurePath, 'utf8') : null;
if (flagTracked) {
  rmSync(failurePath, { force: true });
  gitOk(['rm', '-q', '--cached', '--ignore-unmatch', '--', flagRel]);
}

// Saving never stops tracking a file that is still on disk. When a tracked file
// moves to a path an ignore rule covers, `add -A` stages the old path as deleted
// and never sees the new one: 25 force-added documents left git that way in an
// auto-commit after their folder moved under an archived copy's own .gitignore
// (2026-09-27), and nothing said so. So each staged deletion is looked for among
// the ignored files, by name and then by content, and a match is added back at
// its new path. A file really gone from disk stays staged gone; the deletion
// guard is what stands in front of that. This includes a tracked file moved into
// data/archive-local/: it is already in history and on the remote, so hiding it
// from git from now on would only look like taking it off.
const deleted = git(['diff', '--cached', '--name-only', '--diff-filter=D', '-z', '--', ...records]).split('\0').filter(Boolean);
if (deleted.length) {
  const byName = new Map();
  for (const p of git(['ls-files', '-o', '-i', '--exclude-standard', '-z', '--', ...records]).split('\0').filter(Boolean)) {
    const name = basename(p);
    byName.set(name, [...(byName.get(name) ?? []), p]);
  }
  const kept = [];
  for (const d of deleted) {
    const blob = git(['rev-parse', `HEAD:${d}`]).trim();
    for (const c of byName.get(basename(d)) ?? []) {
      if (blob && git(['hash-object', '--', c]).trim() === blob) kept.push(c);
    }
  }
  if (kept.length) git(['add', '-f', '--', ...kept]);
}

// A record page is never saved collapsed: on 2026-10-16 the standing snapshot was cut
// to a few bytes at a turn's end, cause never found, and the save committed it
// (ce844111; rebuilt by hand 2026-10-18). A tracked page of 256 bytes or more that
// would be saved under 64 is held back, still on disk, its last version still the
// committed one, and the turn is told. Superseded material moves to data/archive/, so a
// page emptied in the same save that writes the archive is saved as usual.
const COLLAPSE_FROM = 256;
const COLLAPSE_TO = 64;
const collapsed = [];
// Looked for after every add of the record, not the first alone: the second pass below
// adds the whole record again, and re-staged a page held back here, or, when the first
// add had failed outright, took a cut page never looked at and committed it (round 30).
function holdCollapsed() {
  const changed = git(['diff', '--cached', '--name-only', '--diff-filter=M', '-z', '--', ...records]).split('\0').filter(Boolean);
  const archiving = git(['diff', '--cached', '--name-only', '--diff-filter=AM', '-z', '--', 'data/archive/']).split('\0').some(Boolean);
  const size = (spec) => Number(git(['cat-file', '-s', spec]).trim()) || 0;
  const found = [];
  for (const p of archiving ? [] : changed) {
    const before = size(`HEAD:${p}`);
    const after = size(`:${p}`);
    if (before >= COLLAPSE_FROM && after < COLLAPSE_TO) found.push({ p, before, after });
  }
  if (found.length) gitOk(['restore', '--staged', '--', ...found.map((c) => c.p)]);
  for (const c of found) if (!collapsed.some((k) => k.p === c.p)) collapsed.push(c);
}
if (!unmergedRecord) holdCollapsed();
// Unstaging is not enough: a commit limited to data/ takes every tracked file from disk,
// so a page held back rode in beside any other page written that turn (round 28). Each
// commit of her record leaves it out by name.
const holdBack = () => collapsed.map((c) => `:(exclude)${c.p}`);

// A copy with no name set (git cannot guess one on many machines) would refuse
// every save commit, silently, turn after turn (review, 2026-10-16).
const IDENT = git(['config', 'user.email']).trim() ? [] : ['-c', 'user.name=dear', '-c', 'user.email=dear@localhost'];

// `diff --cached --quiet` exits non-zero when something IS staged.
if (!unmergedRecord && !gitOk(['diff', '--cached', '--quiet', '--', ...herRecord])) {
  const trailers = procedures(input?.transcript_path).map((name) => `Procedure: ${name}`);
  const body = trailers.length ? ['-m', trailers.join('\n')] : [];
  gitPatient([...IDENT, 'commit', '-q', '-m', 'record: session update', ...body, '--', ...herRecord, ...holdBack(), ...skipConflicts], gitSigned);
}

// The sandbox, in a commit of its own, which the gate holds to the privacy check. A
// refusal leaves its files on disk and unstaged, forgotten by the refused-commit note
// so the next save is judged afresh, and the turn is told at its end (done, above).
if (!unmergedRecord && sandbox.length && !gitOk(['diff', '--cached', '--quiet', '--', ...sandbox])) {
  const held = git(['diff', '--cached', '--name-only', '-z', '--', ...sandbox]).split('\0').filter(Boolean);
  if (!gitPatient([...IDENT, 'commit', '-q', '-m', 'test(sandbox): keep the test chat', '--', ...sandbox, ...skipConflicts], gitSigned)) {
    sandboxRefused = true;
    gitOk(['restore', '--staged', '--', ...sandbox]);
    forgetRefused(held, repoRoot);
  }
}

// CON-017: a lesson about how the system works, written to FEEDBACK.md in her
// chat, is saved too, or a phone session's lesson dies with its machine. In a
// commit of its own, after the record's: the file is held to a stricter privacy
// tier, and a lesson the gate refuses must never hold back her words. Never
// mid-merge (a partial commit is refused there) or while the file is in conflict.
const LESSONS = 'FEEDBACK.md';
if (
  existsSync(join(repoRoot, LESSONS)) &&
  !stoppedOp() &&
  !git(['diff', '--name-only', '--diff-filter=U', '--', LESSONS]).trim() &&
  git(['status', '--porcelain', '--', LESSONS]).trim()
) {
  if (gitPatient(['add', '--', LESSONS])) gitPatient([...IDENT, 'commit', '-q', '-m', 'chore(feedback): keep a lesson for the developer', '--', LESSONS], gitSigned);
}

if (flagHeld !== null) writeFileSync(failurePath, flagHeld);

// The commit itself can be refused: during a merge stopped partway ("cannot do
// a partial commit during a merge"), or by a hook or a signing failure. Her
// words are then on no commit at all, so nothing below can save them, and a
// rescue push of older commits must never read as saved. Said, every time.
// A new file the add failed on (a file held open on Windows, a nested
// repository) is untracked, which neither diff sees (review, 2026-10-16).
const untracked = () => git(['ls-files', '--others', '--exclude-standard', '--', ...herRecord, `:(exclude)${flagRel}`]).trim() !== '';
// The Stop hooks run side by side, so another one (the new-chat tip's marker) can write a new
// record file after the add above: one more pass saves it before it is called a failure.
if (untracked() && !unmergedRecord && !stoppedOp()) {
  const added = gitPatient(['add', '-A', '--', ...herRecord, `:(exclude)data/${CORE_DATA}/state/PUSH_FAILED.md`, `:(exclude)${flagRel}`, ...skipConflicts]);
  if (added) holdCollapsed();
  if (added && !gitOk(['diff', '--cached', '--quiet', '--', ...herRecord])) {
    gitPatient([...IDENT, 'commit', '-q', '-m', 'record: session update', '--', ...herRecord, ...holdBack(), ...skipConflicts], gitSigned);
  }
}
const untrackedRecord = untracked();
const notCommitted = !gitOk(['diff', '--cached', '--quiet', '--', ...herRecord]) || !gitOk(['diff', '--quiet', '--', ...herRecord]) || untrackedRecord;
if (notCommitted) {
  const stopped = stoppedOp();
  const midMerge = stopped !== null;
  const why = collapsed.length
    ? `a record page shrank to almost nothing (${collapsed.map((c) => `${c.p}, ${c.before} bytes to ${c.after}`).join('; ')}), so it was held back and its last version kept; restore it from git, or move what it held to data/archive/ if it was emptied on purpose`
    : midMerge
    ? `a git ${stopped} is stopped partway in this folder, so the record could not be committed`
    : existsSync(lockPath())
      ? 'another git in this folder held its lock (index.lock) throughout, so the record could not be committed'
      : untrackedRecord
        ? 'git could not add a new record file (held open by another program, or a folder git cannot take)'
        : 'git refused to commit the record';
  // The command offered to see why leaves out each page held back: run as printed, the
  // plain `git commit -- data/` committed the very page held back (round 35).
  const quoted = (a) => `'${a.replace(/'/g, `'\\''`)}'`;
  const seeWhy = ['git commit -- data/', ...holdBack().map(quoted)].join(' ');
  // Any operation stopped partway, a merge, a cherry-pick or a revert, is settled by an
  // abort that resets every staged file to HEAD, on disk too: her words staged there,
  // by this save or by the turn's own commit that git refused, were lost on an edited page
  // and a new page deleted (rounds 33, 36, 38; round 39 found the turn's own add still
  // lost under a merge and a cherry-pick). So whenever the record is not committed and one
  // is under way, all of hers staged is unstaged, except the operation's own pages and any
  // in conflict, which its abort must find as it left them. The next turn adds them again.
  if (opHead()) {
    const conflicted = nulList(['diff', '--name-only', '--diff-filter=U', '-z', '--', ...herRecord]);
    const hers = nulList(['diff', '--cached', '--name-only', '--no-renames', '-z', '--', ...herRecord]).filter((p) => !opPaths.includes(p) && !conflicted.includes(p));
    if (hers.length) gitPatient(['restore', '--staged', '--', ...hers.map((p) => `:(literal)${p}`)]);
  }
  const note = `RECORD NOT COMMITTED at ${new Date().toISOString()}\n\n${why}. Her words are on disk here only.\n${midMerge ? `Finish the ${stopped} (resolve, then commit) or undo it (git ${stopped} --abort); the next turn saves.` : `Run: ${seeWhy}   to see why.`}\n`;
  // Said once what was committed has had its push (round 29): stopping here left the
  // rest of the turn's words committed on this machine only, unpushed until the held-back
  // part was settled, and a machine reclaimed meanwhile lost them.
  heldUp = {
    end: (pushNote = '', unsent = false) => {
      mkdirSync(dirname(failurePath), { recursive: true });
      writeFileSync(failurePath, `${note}${pushNote ? `\n${pushNote}` : ''}`);
      if (input?.stop_hook_active) pass();
      block(
        [
          `Her record could not be saved this turn: ${why}.`,
          ...(unsent ? ['What was committed could not be pushed off this machine either.'] : []),
          midMerge ? `Settle the ${stopped} now, silently (resolve and commit, or git ${stopped} --abort), and the save runs again at the end of the turn. A conflict in her record is resolved by keeping both sides, every line or entry from each, never by taking one side whole (round 54).` : `Find why (${seeWhy}) and fix it now, silently.`,
          'Tell her in one plain line only if it cannot be fixed this turn, no file, branch or count (CON-013). If she is in crisis or distressed, stay with her first.',
        ].join('\n'),
      );
    },
  };
}

// Detached HEAD has no branch to push to, so it falls through to the failure
// note rather than passing quietly with the record unsaved.
const current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const branch = current && current !== 'HEAD' ? current : null;
// A branch never pushed has no remote ref, and everything on it is unsaved.
const remote = branch && gitOk(['rev-parse', '--verify', '-q', `origin/${branch}`]) ? `origin/${branch}` : 'origin/main';
const unsaved = `${remote}..HEAD`;
const unpushed = git(['rev-list', '--count', unsaved]).trim();
if (unpushed === '0') done(); // The ordinary case: already saved. Leave quietly.
// A detached checkout whose unpushed commits leave the record alone is a
// heartbeat run's or its reviewer's trial merge: the run pushes what it lands,
// and this hook saves only the record. Rescuing it left a false PUSH_FAILED.md
// that blocked the run's own finish, and a rescue branch on every run
// (2026-10-08 to 2026-10-09, five of them). A heartbeat job's own branch,
// `hb-<job>-<date>`, is the same: the run pushes nothing but main, and
// hb-code-upkeep-20261026 reached GitHub with a rescue copy beside it (an
// edge-case run of 2026-10-29).
const runOwned = branch === null || branch.startsWith('hb-');
if (runOwned && git(['rev-list', '--count', unsaved, '--', ...records]).trim() === '0') done();
// Already in main, by an earlier turn's push there: saved, whatever the
// session branch's own remote ref says.
if (gitOk(['merge-base', '--is-ancestor', 'HEAD', 'origin/main'])) done();

// Main first, from a `claude/` session branch: the branches merge-sessions
// carries into main anyway, so nothing reaches main that would not have. A
// development branch or a detached checkout can hold unfinished harness work,
// and keeps its own push below. The next
// session opens on main, so a save that lands there is one it reads, with no
// workflow carrying it over: merge-sessions stopped for a day when the Actions
// minutes ran out (2026-10-13), and every save in that time stayed on its
// branch. A cloud session was seen pushing straight to main the same day. Main
// moved on since this session began is merged in first; never rebased, and a
// merge that conflicts is abandoned untouched for the steps below.
const toMain = () => {
  if (!branch?.startsWith('claude/')) return false;
  if (gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return false;
  if (!netOk(['fetch', '-q', 'origin', 'main'])) return false;
  // And again once the fetch is done: it can take seconds, and another chat's merge in
  // this folder begun meanwhile made the merge below fail, whose abort then threw that
  // merge away; one still signing stayed committed with its record lines staged as
  // removed, and the next save committed the removal (round 31).
  if (gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return false;
  if (git(['rev-list', '--count', 'HEAD..origin/main']).trim() !== '0') {
    // Never the branch name: a session branch is named from the chat's topic.
    // A merge that stops partway is undone only if it is its own (round 32).
    if (!gitMergeSigned([...IDENT, 'merge', '-q', '--no-edit', '-m', 'merge: main into this session, so its saves reach main', 'origin/main'], 'origin/main')) return false;
  }
  return netOk(['push', '-q', 'origin', 'HEAD:refs/heads/main']);
};
if (toMain()) {
  // The session's own branch is not pushed after it: main holds everything, and
  // a copy on GitHub would only be one more branch to clear (DEP-011). One
  // pushed earlier is removed by the sync once it is in main.
  rmSync(failurePath, { force: true });
  done();
}

// Refused by main: the session's own branch, as before, for merge-sessions to
// carry over. Twice: the first failure is usually the network waking up.
const push = ['push', '-q', 'origin', `HEAD:refs/heads/${branch}`];
const pushed = branch !== null && (netOk(push) || netOk(push));

// Behind the remote: every push is refused however often it is retried, which
// is how a day's saves stayed on one machine (2026-09-27). So fetch and
// merge what the remote has, then push again. Rebase is never used: history is
// never rewritten. A merge that conflicts, or that would overwrite another
// session's unsaved edits, is abandoned untouched and the next step takes over.
const pushedAfterMerge = () => {
  // Never while a merge is under way: the abort below would throw it away.
  if (gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return false;
  if (branch === null || !netOk(['fetch', '-q', 'origin', branch])) return false;
  // And again after the fetch, for a merge begun meanwhile (round 31, toMain above).
  if (gitOk(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])) return false;
  if (git(['rev-list', '--count', `HEAD..origin/${branch}`]).trim() === '0') return false;
  const message = 'merge: GitHub\'s copy of this branch, so saves push again';
  if (gitMergeSigned([...IDENT, 'merge', '-q', '--no-edit', '-m', message, `origin/${branch}`], `origin/${branch}`)) return netOk(push);
  return pushedWithoutTree(message);
};

// The merge refused in this folder, usually because another session's
// uncommitted files sit where it would write (six saves stuck on one machine,
// 2026-10-10, merged by hand): the same merge made without any working tree,
// `merge-tree --write-tree` (git 2.38+), and pushed as its own commit. This
// folder is left exactly as it was, and its branch catches up at the next pull.
// A real conflict still makes nothing, and the rescue below takes over.
const pushedWithoutTree = (message) => {
  if (!canMergeTree(runner(repoRoot))) return false;
  const tree = git(['merge-tree', '--write-tree', 'HEAD', `origin/${branch}`], { timeout: 60000 }).split(/\r?\n/)[0].trim();
  if (!/^[0-9a-f]{40,64}$/.test(tree)) return false;
  const made = [...IDENT, 'commit-tree', tree, '-p', 'HEAD', '-p', `origin/${branch}`, '-m', message];
  const commit = signedFirst((ms) => git(made, { timeout: ms }).trim(), () => git([...UNSIGNED, ...made]).trim());
  return /^[0-9a-f]{40,64}$/.test(commit) && netOk(['push', '-q', 'origin', `${commit}:refs/heads/${branch}`]);
};

// Still refused: put the unsaved commits on the remote under a branch of their
// own. A new branch cannot be refused for being behind, so her words leave the
// machine even when the default branch will not take them, and nothing about
// this machine has to survive. The next development session merges it back.
const saved = pushed || pushedAfterMerge();

// One rescue branch per stuck save, not one a turn (review, 2026-10-16): a
// rescue of this branch already on GitHub that holds this commit is the save;
// one this commit grows from is moved forward to it, a plain push.
const slug = `rescue/${(branch ?? 'detached').replace(/[^\w.-]/g, '-')}-`;
const ours = git(['for-each-ref', '--format=%(refname:short)', `refs/remotes/origin/${slug}*`]).split(/\r?\n/).filter(Boolean).map((r) => r.replace(/^origin\//, ''));
const holding = ours.find((r) => gitOk(['merge-base', '--is-ancestor', 'HEAD', `refs/remotes/origin/${r}`]));
const growing = ours.find((r) => gitOk(['merge-base', '--is-ancestor', `refs/remotes/origin/${r}`, 'HEAD']));
const rescue = holding ?? growing ?? `${slug}${new Date().toISOString().replace(/[:.]/g, '-')}`;
const rescued = !saved && (Boolean(holding) || netOk(['push', '-q', 'origin', `HEAD:refs/heads/${rescue}`]));

if (saved) {
  // The only deletion any hook performs, and it is not record content: this file
  // is a status flag this same hook wrote, and it is false once the push lands.
  rmSync(failurePath, { force: true });
  done();
}

// Why it failed, named, so the next session fixes the cause rather than the
// network: on 2026-10-03 a deleted branch ref was reported as an unreachable
// remote, and the session went looking at the connection.
const cause = !gitOk(['rev-parse', '--verify', '-q', 'HEAD'])
  ? 'the checkout has no current commit: its branch is missing or was never created'
  : branch === null
    ? 'the checkout is on no branch (a detached HEAD), so there is nothing to push to'
    : netLeft() < 1000
      ? 'the save ran out of time (a slow connection, or a signer that never answered) before the push could finish'
      : !netOk(['ls-remote', '--exit-code', 'origin', 'HEAD'])
        ? 'the remote could not be reached'
        : 'the remote was reached and refused the push';

mkdirSync(dirname(failurePath), { recursive: true }); // A note that cannot be written is a silent failure.
writeFileSync(
  failurePath,
  [
    `PUSH TO ${branch ?? 'a detached HEAD'} FAILED at ${new Date().toISOString()}`,
    '',
    rescued
      ? `Saved off the machine instead, on the branch ${rescue}. Nothing is lost; merge it into ${branch ?? 'main'} and push.`
      : `NOT saved off the machine: ${cause}.`,
    '',
    'Unpushed commits:',
    git(['log', '--oneline', unsaved]).trimEnd() || '  (none listed)',
    '',
    'Files affected:',
    git(['diff', '--stat', unsaved]).trimEnd() || '  (none listed)',
    '',
    'The work is committed locally and is NOT lost while this machine lives.',
    'Recover: retry the push. If this machine is gone, so is this file — rebuild',
    'from the session transcript.',
    '',
  ].join('\n'),
);

// On the remote under another branch, her words are safe: the developer hears of
// it at the next session start, and she need not. Not on the remote at all, she
// is told this turn, once, in her terms (DEP-006, CON-013). The hook runs again
// at the end of every turn, so the retry is automatic.
if (heldUp) heldUp.end(readFileSync(failurePath, 'utf8'), !rescued);
if (rescued || input?.stop_hook_active) pass();
block(
  [
    `Her record could not be saved off this machine this turn: ${cause}.`,
    'Tell her in one plain line, no file, branch or count (CON-013), for example:',
    `"I couldn't save that just now. I'll keep trying, and it's safe here in the meantime."`,
    'It retries at the end of every turn. If she is in crisis or distressed, stay with her first.',
  ].join('\n'),
);
