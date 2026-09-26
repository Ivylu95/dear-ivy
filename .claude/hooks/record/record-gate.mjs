// Stop — the three checks that must be true of the record, before the turn ends.
//
// ux/scripts/ already holds them, and `npm run build` already runs them. But the
// build runs when the dashboard is built, which may be days after a session
// wrote the leak, and long after it was pushed to a remote. These are the checks
// whose whole value is being early:
//
//   check-safety   the crisis numbers in data/safety/safety_plan.md still parse (SAF-02)
//   check-privacy  nothing personal has reached a harness file (HAR-02)
//   check-links    nothing in the record points at a file that no longer exists
//
// ── What it costs, and why it usually costs nothing ─────────────────────────
//
// Three Node processes is ~600ms if they run one after another, and a turn that
// ends 600ms late is a turn where she watched a cursor blink for no reason. So:
//
//   · a fingerprint of every file the checks read (name, size, mtime) is stored
//     after each clean run, and an unchanged fingerprint exits in a few ms. Most
//     turns in a session change nothing, so most turns skip the checks entirely.
//   · the three checks run concurrently, not in sequence — they share no state
//     and none of them writes anything.
//   · each child gets a timeout, so a check that hangs costs the turn 20 seconds
//     rather than everything.
//
// A failure blocks the turn with the real output, because a broken link or a
// name in a code comment is cheap to fix now and expensive to find later.

import { readHookInput, block, pass, repoRoot, markerRead, markerWrite, existsFile, treeFingerprint } from '../lib/hook.mjs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const input = await readHookInput();
if (input?.stop_hook_active) pass();

const ux = join(repoRoot, 'ux');
if (!existsFile(join(ux, 'scripts', 'check-privacy.mjs'))) pass();

// What state are we about to check? Everything the three checks read, as one
// number. Deliberately not `git status`: two git subprocesses cost more on this
// path than the checks they were meant to save.
const WATCHED = ['data', '.claude', 'ux'];
const fingerprint = treeFingerprint(WATCHED);

if (markerRead('record-gate-last-pass') === fingerprint) pass(); // Already proven clean.

const CHECKS = ['check-safety.mjs', 'check-privacy.mjs', 'check-links.mjs'];

const results = await Promise.all(
  CHECKS.map((script) =>
    run(process.execPath, [join('scripts', script)], {
      cwd: ux,
      timeout: 20000,
      windowsHide: true,
      encoding: 'utf8',
    }).then(
      () => null,
      (error) => `── ${script} ──\n${`${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || error.message}`,
    ),
  ),
);

const failures = results.filter(Boolean);

if (!failures.length) {
  markerWrite('record-gate-last-pass', fingerprint);
  pass();
}

block(
  [
    'The record does not pass its own checks. Fix these before closing:',
    '',
    ...failures,
    '',
    'These are the same checks `npm run build` runs in ux/. Nothing ships past them,',
    'and nothing should be left in the record that would not.',
  ].join('\n\n'),
);
