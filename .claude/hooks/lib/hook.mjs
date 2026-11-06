// Shared plumbing for the hooks in `.claude/hooks/`.
//
// Every hook is a short program that reads one JSON object on stdin and writes
// at most one JSON object on stdout. This file holds the parts all of them
// need, so a hook file contains only its own rule and nothing else.
//
// Harness, not record: nothing here may read for meaning, only for shape.
//
// ── Two properties everything here is built for ─────────────────────────────
//
// FAIL OPEN. A hook that throws must not take the session with it. The handler
//   below turns any uncaught error into a silent pass, which for a guard means
//   the call it was going to refuse goes through. That is the right trade: a
//   crashed guard that blocks every tool call leaves her with no session at all,
//   and the rule it enforces is also written in CLAUDE.md, where the model reads
//   it. A hook is the second line, never the only one.
//   Guards are the exception: the safety-core lock and the record-deletion guard
//   call failClosed() below, so a crash refuses and says why (Audit #5).
//
// ANY OS. No shell, no shell syntax, no platform assumptions — child processes
//   are spawned as argument arrays, paths are built with path.join, and text is
//   read with line endings normalised. The hooks are Node because Node is the
//   one interpreter this repo already requires on every machine it runs on.

import { mergeSigned, quietGitEnv, runner, signedFirst, SIGNED_MS, UNSIGNED } from './branches.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';
import { activeRecordDir } from './sandbox.mjs';
import { peopleSlugs } from './people.mjs';
import { CORE_DATA } from './modules.mjs';

// DEAR_HOOK_STRICT turns failing open off, so selftest.mjs can see a crash that
// a session would never be shown. Failing open is right in a session and wrong
// in a test: it is exactly how a hook goes quietly dead and nobody notices.
if (!process.env.DEAR_HOOK_STRICT) {
  process.on('uncaughtException', () => process.exit(0));
  process.on('unhandledRejection', () => process.exit(0));
}

export const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// The record this chat reads: data-sandbox/ when the chat has switched on
// `/dev-mode sandbox`, otherwise data/. Every hook reads through this, so none of them
// needs to know the sandbox exists. `realDataDir` is for the few that must mean
// her record whatever the chat is doing — the save's failure note, the privacy
// guard.
export const dataDir = activeRecordDir();
export const realDataDir = join(repoRoot, 'data');

// ── stdin / stdout ──────────────────────────────────────────────────────────

/** The hook payload Claude Code writes to stdin. `{}` if it is absent or bad. */
export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
}

/**
 * Refuse a tool call before it runs, and tell the model why in its own terms.
 * Every guard refuses outright: the build/locked switch that once let some of
 * them only warn was removed on the owner's instruction, 2026-09-27.
 */
/**
 * For a guard: a crash refuses the call instead of letting it through (Audit #5,
 * 2026-10-08). The rule a guard holds is one that must not be skipped silently, a
 * destroyed record or an edit to the safety core, so a guard that cannot decide says
 * no and says why; advisory hooks keep failing open, as above. Call it first thing.
 * Under DEAR_HOOK_STRICT (the selftest) a crash still shows as the crash itself.
 */
export function failClosed(event, guard) {
  if (process.env.DEAR_HOOK_STRICT) return;
  const deny = (err) => {
    emit({
      hookSpecificOutput: {
        hookEventName: event,
        permissionDecision: 'deny',
        permissionDecisionReason: `${guard} crashed (${String(err?.message ?? err).slice(0, 200)}), so it refused this call rather than let it through unchecked. Run node .claude/hooks/selftest.mjs to see why.`,
      },
    });
    process.exit(0);
  };
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
  process.on('uncaughtException', deny);
  process.on('unhandledRejection', deny);
}

export function refuse(event, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
  process.exit(0);
}

/**
 * The events whose hookSpecificOutput may carry additionalContext. Any other
 * event rejects the whole output and prints a schema error to the developer
 * (PreCompact did, on every /compact, until 2026-10-01).
 */
export const CONTEXT_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolBatch', 'Stop', 'SubagentStop'];

/**
 * The most text a hook can put in front of the model whole. Claude Code saves
 * longer additionalContext to a file and shows only a 2,000-character preview,
 * so the rest is never read: the development reply shape went unseen for a
 * whole chat that way (2026-10-03). A platform limit, not a setting.
 */
export const CONTEXT_LIMIT = 10000;

/** Put text in front of the model without interrupting it. */
export function context(event, text) {
  if (!CONTEXT_EVENTS.includes(event)) {
    if (process.env.DEAR_HOOK_STRICT) process.stderr.write(`context() called for ${event}, which takes no additionalContext\n`);
    process.exit(0);
  }
  emit({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
  process.exit(0);
}

/** Stop the turn from ending, and say what is still owed. */
export function block(reason) {
  emit({ decision: 'block', reason });
  process.exit(0);
}

/** Say nothing, change nothing. The common case: every hook's default. */
export function pass() {
  process.exit(0);
}

// ── the repository ──────────────────────────────────────────────────────────

/** File contents with CRLF normalised away, or '' — never a throw. */
export function read(path) {
  try {
    return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

/** Does this file exist? Never throws, including on a path the OS dislikes. */
export function existsFile(path) {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/** True when `path` sits inside `dir`. Absolute, separator- and case-tolerant. */
export function isInside(path, dir) {
  if (!path) return false;
  const rel = relative(resolve(dir), resolve(repoRoot, path));
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${sep}`);
}

/** Every file under `dir`. Unreadable entries are skipped, not thrown over. */
export function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    try {
      if (entry.isDirectory()) walk(full, out);
      else if (entry.isFile()) out.push(full);
    } catch {
      /* a file that cannot be stat'd is a file this hook has no opinion on */
    }
  }
  return out;
}

// Never walked into: not authored here, or enormous, or both.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'temp', '.vercel']);

/**
 * A cheap string that changes whenever anything under `dirs` does. Costs one
 * stat per file — hundreds of those are still an order of magnitude less than a
 * single `git` subprocess, which is the point: a hook that only needs to know
 * "did anything change" should never pay for a process to find out.
 */
export function treeFingerprint(dirs) {
  let hash = 5381;
  const feed = (text) => {
    for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  };
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith('.') && entry.isDirectory() && entry.name !== '.claude') continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        try {
          const stat = statSync(full);
          feed(`${entry.name}:${stat.size}:${Math.round(stat.mtimeMs)}|`);
        } catch {
          /* a file that vanished mid-walk is a change we will catch next time */
        }
      }
    }
  };
  for (const dir of dirs) visit(join(repoRoot, dir));
  return String(hash);
}

/**
 * Every name a leak looks like: her own, from `PROFILE.yaml`, and each first name
 * with a file in `people/` — from her record always, and from the sandbox too
 * when this chat is in it, so a test chat can leak neither.
 */
export async function recordNames() {
  const { profileName } = await import('./profile-schema.mjs');
  const names = [];
  for (const dir of new Set([realDataDir, dataDir])) {
    names.push(...peopleNames(dir));
    const own = profileName(read(join(dir, 'PROFILE.yaml')));
    if (own.length > 2) names.push(own[0].toUpperCase() + own.slice(1));
  }
  return [...new Set(names)];
}

/** Every first name on file in `people/` of the given record (the active one by default), page or folder. */
export function peopleNames(dir = dataDir) {
  return peopleSlugs(join(dir, CORE_DATA, 'people'))
    .filter((n) => n.length > 2)
    .map((n) => n[0].toUpperCase() + n.slice(1));
}

/**
 * git, as an argument array — never a shell string, so nothing here depends on
 * quoting rules that differ between cmd.exe, PowerShell and sh. Returns '' on
 * any failure, including git not being installed.
 */
// git that never asks anyone anything (lib/branches.mjs's quietGitEnv): a
// hook's git inherits the terminal she types into, and a lapsed sign-in would
// otherwise prompt there and read her next words as a password, while the
// machine's own ssh setup stays the one git runs (review, 2026-10-16). Worked
// out once, on first use.
let quietEnv = null;
const QUIET = () => (quietEnv ??= quietGitEnv(process.env, repoRoot));

export function git(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      env: QUIET(),
      encoding: 'utf8',
      timeout: options.timeout ?? 15000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    // A command whose exit status is itself an answer (merge-tree exits 1 on a conflict,
    // its tree still printed) asks for what it printed whatever the status; never a run
    // cut off by its timeout, whose output may be partial.
    return options.anyStatus && typeof e?.status === 'number' && !e?.signal ? String(e?.stdout ?? '') : '';
  }
}

/**
 * A commit tried signed first, then unsigned if signing failed or waited on a
 * passphrase past SIGNED_MS (review, 2026-10-16): the person's signing stays on
 * wherever it works, and never stalls or stops a save (signedFirst: one that waited
 * out its time is not waited on again in this run). Never a merge: that is
 * gitMergeSigned, below. A merge already under way is someone else's: the
 * save's commit of data/ fails in one ("cannot do a partial commit during a
 * merge"), and an abort here threw that merge away (2026-10-27, the self-test
 * run mid-merge, twice; test-merge-in-progress.mjs).
 */
export function gitSigned(args) {
  return signedFirst((ms) => gitOk(args, { timeout: ms }), () => gitOk([...UNSIGNED, ...args]));
}

/**
 * A merge of `target` into this checkout, signed if signing works: lib/branches.mjs's
 * mergeSigned, which undoes a merge left half-done only when it is known to be its own.
 * A merge begun by another chat in this folder in the same moment fails this one, and
 * its abort, checked only against a merge under way before the try, threw that merge
 * away mid-signing (round 32). False when not merged, with nothing of its own left.
 */
export function gitMergeSigned(args, target) {
  return mergeSigned(runner(repoRoot), repoRoot, args, target);
}

/** The same, but reporting whether git succeeded rather than what it said. */
export function gitOk(args, options = {}) {
  try {
    execFileSync('git', args, {
      cwd: repoRoot,
      env: QUIET(),
      encoding: 'utf8',
      timeout: options.timeout ?? 120000,
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export const today = () => new Date().toISOString().slice(0, 10);

// ── the last turn, read from the transcript ─────────────────────────────────
//
// For the Stop hooks that judge a reply (record/save-notice.mjs,
// session/dev-reply-check.mjs, session/everyday-shape-check.mjs): one reading,
// so they cannot disagree about where a turn starts or what its reply was.

/** The transcript's entries, or null when it cannot be read (then judge nothing: never block on a guess). */
export function readEntries(transcriptPath) {
  let lines;
  try {
    lines = readFileSync(String(transcriptPath ?? ''), 'utf8').split('\n').filter(Boolean);
  } catch {
    return null;
  }
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* a partial last line is still being written */
    }
  }
  return entries;
}

/** A message typed by the person: a user entry that is not only a tool result. */
export const typed = (e) =>
  e?.type === 'user' &&
  (typeof e.message?.content === 'string' ||
    (Array.isArray(e.message?.content) && e.message.content.some((c) => c?.type === 'text')));

/** Where the turn starts: the index of the last typed message, or -1. */
export function turnStart(entries) {
  let start = entries.length - 1;
  while (start >= 0 && !typed(entries[start])) start -= 1;
  return start;
}

/** The text blocks of the assistant's replies after `start`, in order. */
export const saidAfter = (entries, start) =>
  entries
    .slice(start + 1)
    .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content)
    .filter((c) => c?.type === 'text')
    .map((c) => c.text ?? '');

// ── one-shot markers, for hooks that must not fire twice ────────────────────
//
// Kept in .claude/hooks/state/ (ARC-014): gitignored, never `data/`, and apart
// from temp/ so the scratch folder can be emptied without changing how the next
// session behaves. Keyed by whatever the caller passes — usually the session id.
// A missing marker means recompute, never fail.

const markerDir = join(repoRoot, '.claude', 'hooks', 'state');

export function markerSeen(name) {
  return existsSync(join(markerDir, name));
}

export function markerWrite(name, body = '') {
  try {
    mkdirSync(markerDir, { recursive: true });
    writeFileSync(join(markerDir, name), body);
  } catch {
    /* a marker that cannot be written costs a repeat, not a failure */
  }
}

export function markerRead(name) {
  return read(join(markerDir, name));
}
