// Every agent that edits or commits works in its own copy (2026-11-04, DEV-017 design 6,
// the developer's yes: "Please do it").
//
// On 3 Nov two of one chat's agents shared the main checkout and collided three ways:
// a live .git/index.lock while the other committed, a pull blocked by the other's
// half-written files, and six .merge_file_* copies left by failed merges. Five later
// agents, each in its own worktree, never collided
// (.claude/memory/the-shared-tree-blocks-in-six-ways.md).
//
// Who is a subagent: only Claude Code's hook input says so, as `agent_id`, present
// only when the tool call comes from inside a subagent. The git hooks cannot tell:
// an agent runs in its chat's process, with the same environment and the same session
// id, so `git/pre-commit` sees one session either way. So the refusal is made before
// the commit command runs, by session/guard-agent-own-copy.mjs, and git's own gate is
// unchanged. Another tool, or a person at a terminal, is never refused by it.
//
// Who else is working in a checkout: each writing tool call is stamped, per session
// and per agent (the chat itself as "main"), with the checkout it wrote in and when
// (session/track-touched.mjs). Another writer is any other stamp on the same checkout
// within ACTIVE_MS. A stamp is kept in hooks/state/ (ARC-014), one file per writer.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { markerRead, markerWrite, repoRoot } from './hook.mjs';

/** A writer seen in a checkout within this long is still working there (DEV-017 design 6). */
export const ACTIVE_MS = 30 * 60 * 1000;

const PREFIX = 'writer-';
const clean = (s) => String(s).replace(/[^\w-]/g, '');
const markerName = (session, agent) => `${PREFIX}${clean(session)}--${clean(agent || 'main')}.json`;

/** The checkout `path` lies in: the nearest folder above it holding `.git`, or null. */
export function checkoutOf(path) {
  let dir = resolve(path);
  try {
    if (!statSync(dir).isDirectory()) dir = dirname(dir);
  } catch {
    dir = dirname(dir);
  }
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Whether `root` is a linked worktree: its `.git` is a file pointing elsewhere, not the folder. */
export function isLinkedWorktree(root) {
  try {
    return statSync(join(root, '.git')).isFile();
  } catch {
    return false;
  }
}

/** Stamp that this session's agent (or the chat itself) wrote in `root` at `now`. Never throws. */
export function recordWriter(session, agent, root, now = Date.now()) {
  if (!session || !root) return;
  const name = markerName(session, agent);
  let roots = {};
  try {
    roots = JSON.parse(markerRead(name) || '{}').roots ?? {};
  } catch {}
  roots[resolve(root)] = now;
  markerWrite(name, JSON.stringify({ session: String(session), agent: agent ? String(agent) : 'main', roots }));
}

/** Every writer stamp kept: [{ session, agent, root, at }]. `stateDir` is for tests. */
export function readWriters(stateDir = join(repoRoot, '.claude', 'hooks', 'state')) {
  const out = [];
  let names = [];
  try {
    names = readdirSync(stateDir).filter((n) => n.startsWith(PREFIX) && n.endsWith('.json'));
  } catch {
    return out;
  }
  for (const n of names) {
    try {
      const { session, agent, roots } = JSON.parse(readFileSync(join(stateDir, n), 'utf8'));
      for (const [root, at] of Object.entries(roots ?? {})) out.push({ session, agent, root, at });
    } catch {}
  }
  return out;
}

/** Pure: the other writers active in `root` at `now`, this session's agent `agent` left out. */
export function otherWriters({ session, agent, root, writers, now = Date.now() }) {
  const me = `${session}\0${agent || 'main'}`;
  const seen = new Set();
  return writers.filter((w) => {
    const key = `${w.session}\0${w.agent}`;
    if (key === me || resolve(w.root) !== resolve(root) || now - w.at > ACTIVE_MS || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const blank = (command) => command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
const COMMIT = /\bgit\b((?:\s+-[cC]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*)\s+commit\b/;

/**
 * Where a shell command's `git commit` runs, or null when it makes none: its `git -C <dir>`,
 * else the last `cd <dir>` before it, else `cwd`. Quoted text is no command.
 */
export function commitDir(command, cwd) {
  const bare = blank(String(command ?? ''));
  const m = bare.match(COMMIT);
  if (!m) return null;
  const dashC = m[1].match(/\s-C\s+(\S+)/);
  if (dashC) return resolve(cwd, dashC[1]);
  const before = bare.slice(0, m.index);
  const cds = [...before.matchAll(/(?:^|[;&|(]\s*)cd\s+([^\s;&|)]+)/g)];
  return cds.length ? resolve(cwd, cds.at(-1)[1]) : resolve(cwd);
}

/** The paths a `git commit … -- <paths>` names, or [] when it names none. */
export function namedPaths(command) {
  const bare = blank(String(command ?? ''));
  const m = bare.match(COMMIT);
  if (!m) return [];
  const rest = bare.slice(m.index).split(/&&|\|\||;|\n/)[0];
  const at = rest.search(/\s--(\s|$)/);
  return at < 0 ? [] : rest.slice(at).trim().split(/\s+/).slice(1).filter(Boolean);
}
