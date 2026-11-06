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
//
// ANY OS. No shell, no shell syntax, no platform assumptions — child processes
//   are spawned as argument arrays, paths are built with path.join, and text is
//   read with line endings normalised. The hooks are Node because Node is the
//   one interpreter this repo already requires on every machine it runs on.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';
import { activeRecordDir } from './sandbox.mjs';

// DEAR_HOOK_STRICT turns failing open off, so selftest.mjs can see a crash that
// a session would never be shown. Failing open is right in a session and wrong
// in a test: it is exactly how a hook goes quietly dead and nobody notices.
if (!process.env.DEAR_HOOK_STRICT) {
  process.on('uncaughtException', () => process.exit(0));
  process.on('unhandledRejection', () => process.exit(0));
}

export const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// The record this chat reads: data-sandbox/ when the chat has switched on
// `/sandbox`, otherwise data/. Every hook reads through this, so none of them
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

/** Refuse a tool call before it runs, and tell the model why in its own terms. */
export function deny(event, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
  process.exit(0);
}

/** Put text in front of the model without interrupting it. */
export function context(event, text) {
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

/** Every first name with a file in `data/people/`. The names a leak looks like. */
export function peopleNames() {
  try {
    return readdirSync(join(dataDir, 'people'))
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => f.slice(0, -3))
      .filter((n) => n.length > 2)
      .map((n) => n[0].toUpperCase() + n.slice(1));
  } catch {
    return [];
  }
}

/**
 * git, as an argument array — never a shell string, so nothing here depends on
 * quoting rules that differ between cmd.exe, PowerShell and sh. Returns '' on
 * any failure, including git not being installed.
 */
export function git(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: options.timeout ?? 15000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

/** The same, but reporting whether git succeeded rather than what it said. */
export function gitOk(args, options = {}) {
  try {
    execFileSync('git', args, {
      cwd: repoRoot,
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

// ── one-shot markers, for hooks that must not fire twice ────────────────────
//
// Kept in the project temp dir (gitignored, never `data/`), keyed by whatever
// the caller passes — usually the session id.

const markerDir = join(repoRoot, 'temp', 'hooks');

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
