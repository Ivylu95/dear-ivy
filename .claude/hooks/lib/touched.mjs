// Which files this session has touched: the stop checks' way to tell "yours"
// from "another session's" in a shared working tree.
//
// Many sessions share one tree. A stop check that blocks on every change it
// finds blocks the wrong session most of the time, and a gate that is usually
// "not mine" trains every session to wave it through — the costliest habit on
// the safety path. So the end-of-turn checks block only on files this session
// touched; the git pre-commit hook still checks every staged file, whoever
// wrote it, so nothing reaches history unchecked.
//
// Recorded by session/track-touched.mjs after each edit, and after each shell
// command for every existing path it names. A path written by a script the
// command does not name is missed; the pre-commit hook is the backstop for that.
// Kept in hooks/state/ (ARC-014), one file per session.

import { markerRead, markerWrite, repoRoot } from './hook.mjs';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// A folder this session stages by name (`git add dev/dialogue`) stages every file
// under it, and those files are this session's. The pre-commit gate matches files
// exactly, so the folder alone left them "never touched": a chat's own rebuilt
// Transcript cards were refused as another chat's five times in one chat
// (2026-11-02). Each folder in `paths` is kept and joined by the files staged
// under it; a file, or a folder with nothing staged, stays as given. Another
// chat's file in a folder this session never staged is still not this session's.
// Never throws: git unreadable leaves `paths` as they were.
export function stagedUnder(paths, cwd = repoRoot) {
  const out = [];
  for (const p of paths) {
    out.push(p);
    let dir = false;
    try {
      dir = statSync(p).isDirectory();
    } catch {}
    if (!dir) continue;
    try {
      const opts = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 };
      const top = execFileSync('git', ['rev-parse', '--show-toplevel'], opts).trim();
      for (const f of execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '-z', '--', p], opts).split('\0')) {
        if (f) out.push(resolve(top, f));
      }
    } catch {}
  }
  return out;
}

const markerName = (session) => `touched-${String(session).replace(/[^\w-]/g, '')}.json`;

export const relPath = (p) => relative(repoRoot, resolve(repoRoot, p)).replace(/\\/g, '/');

export function touchedBy(session) {
  if (!session) return new Set();
  try {
    return new Set(JSON.parse(markerRead(markerName(session)) || '[]'));
  } catch {
    return new Set();
  }
}

// A path inside a record is never kept: its name can be a person's (a people
// file), this file sits outside data/, and no stop check it serves looks at a
// record's files — the privacy and safety gates are about the harness.
export const inRecord = (rel) => /^(data|data-sandbox|data-sample)(\/|$)/.test(rel);

// When this session last touched each path, in ms, kept beside the list so the
// list's shape stays as its readers expect. It tells "this session's unsaved
// change" from "another session's change to a file this one touched and has
// since committed" (lib/dev-review.mjs).
const atMarkerName = (session) => `touched-at-${String(session).replace(/[^\w-]/g, '')}.json`;

/** path → ms of this session's last touch; empty for a session recorded before times were kept. */
export function touchedAt(session) {
  if (!session) return new Map();
  try {
    return new Map(Object.entries(JSON.parse(markerRead(atMarkerName(session)) || '{}')));
  } catch {
    return new Map();
  }
}

export function recordTouched(session, paths, now = Date.now()) {
  if (!session || !paths.length) return;
  const set = touchedBy(session);
  const at = touchedAt(session);
  for (const p of paths) {
    const rel = relPath(p);
    if (rel && !rel.startsWith('../') && !inRecord(rel)) {
      set.add(rel);
      at.set(rel, now);
    }
  }
  markerWrite(markerName(session), JSON.stringify([...set].filter((t) => !inRecord(t)).sort()));
  markerWrite(atMarkerName(session), JSON.stringify(Object.fromEntries([...at].filter(([t]) => !inRecord(t)))));
}

// True when `path`, or a folder above it, is one this session touched.
export function isTouched(set, path) {
  const rel = relPath(path);
  for (const t of set) if (rel === t || rel.startsWith(`${t}/`)) return true;
  return false;
}
