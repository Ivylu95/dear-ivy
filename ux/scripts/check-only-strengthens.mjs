#!/usr/bin/env node
// Only strengthens: what a branch landed with no one reviewing it may not do,
// checked by machine. Its readers of the safety core (corePaths) and of a
// branch's change set (changesBetween) are shared by the heartbeat doctor's
// fence (check-doctor-fence.mjs, HBT-013) and the code maintenance fence
// (check-hygiene-fence.mjs, HYG-006); the rules below are the strictest of
// the three, and can be run on any branch by hand.
//
//   node ux/scripts/check-only-strengthens.mjs <base> [<head>]   (head: HEAD)
//
// Refused, between base and head:
//   - any change under dev/specs/ (a gap is the repository's fault, never the row's)
//   - any change under data/ (the record is hers)
//   - any change to the safety core or surface (each read from its one list), and
//     any commit citing a safety row (SAF, SPL): safety is wholly the developer's
//   - any file deleted
//   - any line removed from a check, a test, a hook, the checks registry or the thresholds
//   - any line added to a known-exceptions list (*.known.txt)
// Adding a check, a test case, a registry entry, or code that makes the
// repository match a row, all pass.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const listIn = (root, file, name) => {
  const text = readFileSync(join(root, ...file.split('/')), 'utf8');
  const list = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(text)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/**
 * Safety, wholly the developer's: the core (guard-safety-core.mjs's CORE) and
 * the surface (safety-at-stop.mjs's SURFACE), each read from its one list. The
 * fixer once changed the session-close hook and the check-in for two safety
 * rows, files outside the core (2026-10-09); safety is never an unreviewed branch's.
 */
export function corePaths(root = REPO) {
  // A file is an entry whose last segment has an extension; any other entry is a
  // folder, kept as itself too, so the reading only ever gets stricter. A '.' in
  // a folder's path once read '.claude/skills/first-contact' as a file, and a new
  // file inside it passed (an edge-case run of 2026-10-29).
  const surface = listIn(root, '.claude/hooks/safety/safety-at-stop.mjs', 'SURFACE').flatMap((p) => {
    if (p.endsWith('/')) return [p];
    return /[^/.]\.[^/.]+$/.test(p) ? [p] : [p, `${p}/`];
  });
  return [...listIn(root, '.claude/hooks/safety/guard-safety-core.mjs', 'CORE'), ...surface];
}

/** Rows of the safety registers: SAF (interaction/safety.md) and SPL (ux/tabs/safety.md). */
export const SAFETY_ROW = /\b(SAF|SPL)-\d{3}\b/;

/** Commit messages between base and head that cite a safety row. */
export function safetyCommits(messages) {
  return messages.filter((m) => SAFETY_ROW.test(m)).map((m) => m.split('\n')[0]);
}

// What judges the repository: its lines may be added to, never taken out. Other
// hook and app code is what a fix changes to match a row, so it may be edited.
const GUARDED = [
  /^ux\/scripts\/(check|test)-[\w-]+\.mjs$/,
  /^\.claude\/hooks\/(.+\/)?(check|test|guard)-[\w-]+\.mjs$/,
  /^\.claude\/hooks\/selftest\.mjs$/,
  /^\.claude\/hooks\/git\//,
  /^ux\/lib\/checks\.mjs$/,
  /^\.claude\/thresholds\.json$/,
  /^dev\/ui\/test\//,
];

/**
 * What a change set breaks of the rules above. `changes` is a list of
 * { status: 'A'|'M'|'D'|'R…', path, added, removed } (removed: lines taken out).
 */
export function violations(changes, core) {
  const out = [];
  for (const c of changes) {
    const p = c.path;
    if (p.startsWith('dev/specs/')) out.push(`${p}: the specs are off limits`);
    else if (p === 'data' || p.startsWith('data/')) out.push(`${p}: the record is off limits`);
    else if (core.some((k) => (k.endsWith('/') ? p.startsWith(k) : p === k))) out.push(`${p}: safety is the developer's, never an unreviewed branch's`);
    else if (c.status.startsWith('D')) out.push(`${p}: deleted`);
    else if (c.status.startsWith('R')) out.push(`${p}: renamed`);
    else if (p.endsWith('.known.txt') && c.added > 0) out.push(`${p}: adds a known exception`);
    else if (GUARDED.some((re) => re.test(p)) && c.removed > 0) out.push(`${p}: removes ${c.removed} line(s) from a check`);
  }
  return out;
}

/** The change set between two commits, from git. */
export function changesBetween(base, head = 'HEAD', root = REPO) {
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  const counts = new Map();
  for (const line of git('diff', '--numstat', '--no-renames', `${base}...${head}`).split('\n').filter(Boolean)) {
    const [added, removed, path] = line.split('\t');
    // A binary file's numstat is `-\t-`: its lines cannot be counted, so it is marked, never read as unchanged.
    counts.set(path, { added: Number(added) || 0, removed: Number(removed) || 0, binary: added === '-' && removed === '-' });
  }
  return git('diff', '--name-status', '--find-renames', `${base}...${head}`).split('\n').filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const path = parts.at(-1);
    return { status: parts[0], path, ...(counts.get(path) ?? counts.get(parts[1]) ?? { added: 0, removed: 0, binary: false }) };
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) {
    console.error('usage: check-only-strengthens.mjs <base> [<head>]');
    process.exit(2);
  }
  const messages = execFileSync('git', ['log', '--format=%B%x00', `${base}..${head}`], { cwd: REPO, encoding: 'utf8' }).split('\0').map((m) => m.trim()).filter(Boolean);
  const found = [
    ...violations(changesBetween(base, head), corePaths()),
    ...safetyCommits(messages).map((s) => `"${s}": cites a safety row, which only the developer changes`),
  ];
  if (found.length) {
    console.error(`ONLY-STRENGTHENS CHECK FAILED\n\n  - ${found.join('\n  - ')}\n\n  An unreviewed branch may add checks and make the repository match a row; never these.`);
    process.exit(1);
  }
  console.log('only-strengthens check: the branch only adds and fixes');
}
