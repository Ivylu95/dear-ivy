import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The folders no walker or watcher of the app enters: one list, read by every
// one of them (FND-005, "Every fact has one authoritative home; everything else
// points to it.").
//
// Five walkers and the live-reload watcher each walked the tree their own way,
// and only spec-edit skipped anything. On 2026-10-06 an audit found ten agent
// worktrees under .claude/worktrees: the Harness view walked 35,000 of their
// files on every click (22 s warm), the watcher primed 130,000 (37-49 s, the
// dashboard blocked), and the Harness tab listed and previewed the copies of her
// record inside them, a copy of the record outside data/ that ARC-004 forbids
// any view to show. Skipping them closes all three.
//
//   names   a folder with one of these names is never entered, at any depth
//   paths   a folder at one of these paths, relative to the walk's root, is
//           never entered: `hooks/state` and not every `state`, because her
//           record keeps a core/state/ that must still be watched
//   record  the record's own folders, skipped only by a walk from the
//           repository root: not by name, because dev/specs/data/ is a real
//           spec group (DAT, SMP), and a copy of the record inside a worktree is
//           already behind `worktrees`

export const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'out',
  'temp',
  '.vercel',
  'worktrees',
]);

/** The record's folders at the repository root: for a walk that starts there. */
export const RECORD_DIRS = new Set(['data', 'data-sample']);

const SKIP_PATHS = ['hooks/state'];

/**
 * Every file under `root`, as absolute paths: the one walk the checks share
 * (SFG-007 design 5), so a check can be pointed at a test folder and no check
 * grows its own idea of what to skip.
 *
 *   names   folder names never entered, at any depth (default SKIP_DIRS)
 *   paths   folder paths never entered, as consecutive segments at any depth
 *           (default none: `hooks/state` is untracked, but a check may still
 *           want to read it)
 *   top     folder names skipped at the root only, as RECORD_DIRS is: never by
 *           name, because dev/specs/data/ is a real spec group
 *   keep    which files to list, given the name; also gates `.env` files out
 *           wherever a caller says so
 *
 * Another checkout is never entered: a folder below the root holding its own
 * `.git` is a separate working tree (a heartbeat job's under temp/, an agent's
 * under .claude/worktrees), with a copy of the record inside it. A folder that
 * vanishes mid-walk is passed over: another session can move a file between the
 * listing and the read.
 */
export function walkFiles(root, { names = SKIP_DIRS, paths = [], top = new Set(), keep = () => true } = {}) {
  const out = [];
  const visit = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const sub = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (names.has(entry.name) || (!rel && top.has(entry.name))) continue;
        if (paths.some((p) => `/${sub}/`.includes(`/${p}/`))) continue;
        if (existsSync(join(full, '.git'))) continue;
        visit(full, sub);
      } else if (entry.isFile() && keep(entry.name)) out.push(full);
    }
  };
  visit(root, '');
  return out;
}

/** True when a path, relative to the walk's root, lies in a skipped folder. */
export function skipped(rel) {
  const parts = String(rel ?? '').split(/[\\/]+/).filter(Boolean);
  if (parts.some((p) => SKIP_DIRS.has(p))) return true;
  const posix = parts.join('/');
  return SKIP_PATHS.some((p) => posix === p || posix.startsWith(`${p}/`));
}
