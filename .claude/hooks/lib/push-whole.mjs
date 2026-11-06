// A push to main leaves main whole (T-981, 2026-11-06). On 5 to 6 Nov two half-done
// changes reached main: a record pointer to a harness file not yet pushed, and a module
// moved before the record followed. Main then failed its own fast checks for about an
// hour, and every chat's save stalled behind it. Worktrees would not have stopped it:
// each cloud chat already has its own clone, and the clash comes when they meet on main
// (dev/projects/parallel-chats/notes.md).
//
// So a push to main that changes the harness (anything outside data/) runs the fast
// whole-tree checks first: links, the sandbox's blank copies and the sample record.
// A push of her record alone is never held: her saves must reach main at once.
// A check that cannot run lets the push through, said, as the merge check does.
// Tested by lib/test-push-whole.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const WHOLE_CHECKS = [
  { name: 'links', script: 'ux/scripts/check-links.mjs', args: [] },
  { name: 'sandbox', script: 'ux/scripts/sandbox.mjs', args: ['check'] },
  { name: 'sample', script: 'ux/scripts/check-sample.mjs', args: [] },
];

const ZERO = /^0+$/;
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const known = (root, sha) => {
  try {
    git(root, ['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

/** The paths a push changes on main: everything between what main has and what is pushed; null when main is ahead of this copy. */
export function pushedPaths(root, localSha, remoteSha) {
  if (!localSha || ZERO.test(localSha)) return [];
  // A main this copy has not fetched: git refuses the push as not a fast-forward anyway.
  if (remoteSha && !ZERO.test(remoteSha) && !known(root, remoteSha)) return null;
  const range = !remoteSha || ZERO.test(remoteSha) ? [localSha] : [`${remoteSha}..${localSha}`];
  const out = git(root, ['log', '--format=', '--name-only', ...range]);
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))];
}

/** True when the push changes anything outside her record. */
export const touchesHarness = (paths) => (paths ?? []).some((p) => !p.startsWith('data/'));

/**
 * Why the whole-tree checks cannot judge this push from the working tree, or '' when they
 * can: the tree must be what is pushed, so HEAD is the pushed commit and nothing is changed.
 */
export function cannotJudge(root, localSha) {
  try {
    if (git(root, ['rev-parse', 'HEAD']) !== localSha) return 'the pushed commit is not the one checked out';
    if (git(root, ['status', '--porcelain', '--untracked-files=no'])) return 'the checkout has uncommitted changes';
  } catch (error) {
    return `git could not be read (${error.message})`;
  }
  return '';
}

/** Runs each check; returns the ones that failed, { name, out }, and the ones that could not run. */
export function runWhole(root, checks = WHOLE_CHECKS, { timeout = 120000 } = {}) {
  const failed = [];
  const skipped = [];
  for (const check of checks) {
    const script = join(root, check.script);
    if (!existsSync(script)) {
      skipped.push(check.name);
      continue;
    }
    const r = spawnSync(process.execPath, [script, ...check.args], { cwd: join(root, 'ux'), encoding: 'utf8', timeout });
    if (r.error || r.signal) skipped.push(check.name);
    else if (r.status !== 0) failed.push({ name: check.name, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n') });
  }
  return { failed, skipped };
}
