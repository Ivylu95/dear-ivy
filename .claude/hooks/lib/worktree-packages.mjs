// A linked worktree borrows the main checkout's packages (2026-11-04, DEV-017 design 5).
//
// The full commit gate's checks run in a snapshot with no packages, and find them
// through DEAR_GIT_ROOT, the checkout committing: `<root>/ux/node_modules`. A worktree
// has none (it is git-ignored), so every check that loads react, next, marked or
// js-yaml failed there, and each agent brief of 3 to 4 Nov had to say "symlink
// ux/node_modules" or its first commit was refused. So before the checks, a linked
// worktree with no `ux/node_modules` gets a link to the main checkout's, the link
// those briefs asked for. A checkout with its own folder or link, the main checkout,
// and a main checkout with no install are left as they are, and no dangling link is
// made. The link is a junction on Windows, as dev/ui/scripts/link-deps.mjs makes; a
// worktree is cleared with its links taken out first (lib/branches.mjs).
//
// Its own file since 2026-11-04 (the developer's yes, "Please do it"): it was first
// put in lib/gate-queue.mjs only because a new file needed a spec row. Proven by
// lib/test-worktree-packages.mjs; called by git/pre-commit.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, symlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const has = (p) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

/** The main checkout of the repository `root` is a linked worktree of, or null. */
export function mainCheckout(root) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
    if (basename(common) !== '.git') return null;
    const main = dirname(common);
    return resolve(main) === resolve(root) ? null : main;
  } catch {
    return null;
  }
}

/** Link `<root>/ux/node_modules` to the main checkout's when a worktree has none; the link made, or null. */
export function linkPackages(root) {
  const link = join(root, 'ux', 'node_modules');
  if (has(link) || !existsSync(join(root, 'ux'))) return null;
  const main = mainCheckout(root);
  const target = main && join(main, 'ux', 'node_modules');
  if (!target || !existsSync(target)) return null;
  try {
    symlinkSync(target, link, 'junction');
    return link;
  } catch {
    return null;
  }
}
