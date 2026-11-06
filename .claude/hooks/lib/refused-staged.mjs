// What a refused commit left staged, and the one refusal that follows from it.
//
// A refused commit leaves its files staged, and the next commit takes them in
// under its own message. It happened twice (2026-09-30, 2026-10-03), the second
// time with the rule written in the commit skill and the gate's own warning
// printed: a scripted loop of commits never read either. So a refusal is
// remembered, and the next commit that carries any of those files is refused
// once, naming them. Running it again carries them on purpose; unstaging them
// first is the other way out.
//
// The note lives in the repository's git folder for this worktree, never in the
// tree, so it is never committed and each worktree keeps its own.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { TYPED_PART } from './typed.mjs';

const NOTE = 'dear-refused-staged';

// The record of what the developer typed is staged by its own hook at every
// message (session/dialogue-record.mjs), so any commit carries it by design: a
// refusal that finds it staged did not leave it there. Counted as a leftover,
// it refused about eight commits in one evening (2026-10-27) naming only it.
// The cards and index pages are generated from the Transcript, and the commit
// gate rebuilds and stages them itself when a commit carries a Transcript change
// (git/pre-commit, T-631): staged by the gate, not left by anyone, so they are
// never "unseen" either.
export const GENERATED = ['dev/dialogue/agreements.md', 'dev/dialogue/agreements/', 'dev/dialogue/index/'];
export const isGenerated = (f) => GENERATED.some((g) => (g.endsWith('/') ? f.startsWith(g) : f === g));

const hookStaged = (cwd) => {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
    // The record and any later part of it (lib/typed.mjs, T-768).
    return { has: (f) => TYPED_PART.test(f) || isGenerated(f) };
  } catch {
    return { has: isGenerated };
  }
};

function notePath(cwd) {
  const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8' }).trim();
  return join(resolve(cwd, gitDir), NOTE);
}

/** On a refusal: remember what is still staged. */
export function rememberRefused(cwd = process.cwd()) {
  try {
    const staged = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only'], { cwd, encoding: 'utf8' }).trim();
    if (staged) writeFileSync(notePath(cwd), `${staged}\n`);
  } catch {
    // Not a repository, or git unreadable: nothing to remember.
  }
}

/**
 * On the next commit: the staged files a refused commit left behind, if this
 * commit carries any. The note is cleared either way, so the refusal comes once.
 */
export function carriedFromRefused(staged, cwd = process.cwd()) {
  let path;
  try {
    path = notePath(cwd);
  } catch {
    return [];
  }
  if (!existsSync(path)) return [];
  const left = new Set(readFileSync(path, 'utf8').split('\n').filter(Boolean));
  rmSync(path, { force: true });
  // A first commit carries every file by design, and a refused one leaves them
  // all staged: the retry of a new copy's first commit was refused naming 649
  // files (edge cases, 2026-10-29, A11). With no HEAD nothing rides in unseen.
  try {
    execFileSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd, stdio: 'ignore' });
  } catch {
    return [];
  }
  const byHook = hookStaged(cwd);
  // The same commit run again stages exactly what the refusal left: it carries nothing
  // unseen, so it passes. Refused, it re-armed with every slow check run, and one
  // commit took six tries (E-058, 2026-11-01; the owner's yes in T-558). A commit
  // staging anything more, or less, is still refused once.
  const own = (fs) => [...new Set(fs)].filter((f) => !byHook.has(f)).sort();
  const now = own(staged), then = own(left);
  if (now.length && now.length === then.length && now.every((f, i) => f === then[i])) return [];
  return staged.filter((f) => left.has(f) && !byHook.has(f));
}

/**
 * A refusal whose caller unstaged some of its files itself: they are no longer
 * left staged, so the note stops naming them. heartbeats.mjs restores and
 * unstages its record after a refused commit; the note still named it, and the
 * next finish of that job was refused for carrying it (a heartbeat finish, 2026-10-10,
 * a claim left running for days).
 */
export function forgetRefused(paths, cwd = process.cwd()) {
  try {
    const path = notePath(cwd);
    if (!existsSync(path)) return;
    const gone = new Set(paths);
    const left = readFileSync(path, 'utf8').split('\n').filter((f) => f && !gone.has(f));
    if (left.length) writeFileSync(path, `${left.join('\n')}\n`);
    else rmSync(path, { force: true });
  } catch {
    // Not a repository, or git unreadable: nothing remembered to forget.
  }
}

// The files a commit stages, as the commit gate reads them: raw names, never
// git's quoted form. git quotes a name with non-ASCII letters ("zo\303\253.md")
// unless asked not to, and a save of a person's page named that way missed the
// gate's record-only pass and met every harness check, which could refuse her
// save each turn (review, 2026-10-16).

/** Staged paths in the repository at `root`, NUL-separated so no name is quoted. */
export function stagedNames(root) {
  return execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

/**
 * Whether every staged path is the record's: data/ only. The sandbox counted too
 * until 2026-11-01, so a commit of data-sandbox/ skipped every check, the privacy
 * check among them; it is outside data/ and is held like harness (A-155).
 */
export const recordOnly = (names) => names.every((f) => /^data\//.test(f));

/** Whether a path is the sandbox's: saved each turn, and held to the privacy check. */
export const inSandbox = (f) => f.startsWith('data-sandbox/');

/**
 * A-164: a commit carrying only the dialogue (the Transcript, its cards and index, the
 * learning map), with or without the record, a lesson or the sandbox, is a remark being
 * kept or sorted. It cannot break code, so the gate runs only the checks that read it
 * (DIALOGUE_CHECKS), in seconds; the full set runs on everything else and at least daily.
 */
export const DIALOGUE_CHECKS = new Set(['privacy', 'secrets', 'dialogue', 'id clash']);
export const dialogueOnly = (names) => names.some((f) => f.startsWith('dev/dialogue/'))
  && names.every((f) => f.startsWith('dev/dialogue/') || f === 'FEEDBACK.md' || inSandbox(f) || recordOnly([f]));

// ── Staged by another chat ──────────────────────────────────────────────────
// Chats sharing one tree share one staging area: a chat's plain `git commit`
// took in another chat's staged files under its own message (T-330 edge cases,
// 2026-10-29, happened once). So a commit carrying staged files this session
// never touched (lib/touched.mjs: its edits, and the paths its shell commands
// name, `git add` among them) is refused once, naming them. The fix is to commit
// your own by name (`git commit -m … -- <paths>`), which leaves the rest staged;
// running the same commit again carries them on purpose. Not asked: a merge
// (it carries main's files by design), a first commit, a commit with no session
// (a laptop, a script) or a session that has touched nothing, the record, and
// what a hook stages itself. Sibling agents of one session share its list, so
// this tells chats apart, not agents inside one chat.

const UNOWNED_NOTE = 'dear-unowned-staged';

/** Staged paths this session never touched, or [] where that is not asked; the same list twice in a row passes. */
export function unownedStaged(staged, { touched, merging = false, cwd = process.cwd() } = {}) {
  if (merging || !touched || !touched.size) return [];
  let path;
  try {
    execFileSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd, stdio: 'ignore' });
    path = join(notePath(cwd), '..', UNOWNED_NOTE);
  } catch {
    return [];
  }
  const byHook = hookStaged(cwd);
  const left = staged.filter((f) => !touched.has(f) && !byHook.has(f) && !/^(data|data-sandbox)\//.test(f)).sort();
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const now = `${left.join('\n')}\n`;
  if (!left.length || before === now) {
    rmSync(path, { force: true });
    return [];
  }
  writeFileSync(path, now);
  return left;
}
