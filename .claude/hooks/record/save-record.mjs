// Stop — commit and push everything written to data/ (and data-sandbox/), the
// moment the turn ends.
//
// CLAUDE.md: "Writing a file is not saving it. Sessions run on a disposable
// machine that is reclaimed without warning once she goes quiet." This is the
// only thing standing between a written record and a lost one, so it runs on
// every turn end rather than at some end of session that may never arrive.
//
// Pushes to the branch the session is on, never to a named one. A phone session
// runs on a `claude/` branch and its git proxy refuses a push to any other, so
// `HEAD:main` failed on every phone turn; .github/workflows/merge-sessions.yml
// carries the branch into main instead (DEP-005, DEP-007). At a desk, on main,
// this is the same push it always was.
//
// Never opens a pull request. Commit messages name the file, never the content.
// A failed push is written down where the next session will trip over it — a
// silent failure to save is the one failure she cannot see.
//
// Was a shell script until it wasn't: `git` here is an argument array, so this
// runs identically under sh, cmd.exe and PowerShell, and no part of it depends
// on a POSIX shell being the thing that launched it.

import { readHookInput, pass, git, gitOk, repoRoot } from '../lib/hook.mjs';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

await readHookInput();

const failurePath = join(repoRoot, 'data', 'state', 'PUSH_FAILED.md');

// Her record, and the sandbox when there is one: saved whatever this chat is
// doing, so a switch never decides what is kept. A pathspec that does not exist
// fails the whole add, so the sandbox is named only when it is there.
const records = ['data/', ...(existsSync(join(repoRoot, 'data-sandbox')) ? ['data-sandbox/'] : [])];

git(['add', '-A', '--', ...records]);

// `diff --cached --quiet` exits non-zero when something IS staged.
if (!gitOk(['diff', '--cached', '--quiet', '--', ...records])) {
  git(['commit', '-q', '-m', 'record: session update', '--', ...records]);
}

// Detached HEAD has no branch to push to, so it falls through to the failure
// note rather than passing quietly with the record unsaved.
const current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const branch = current && current !== 'HEAD' ? current : null;
// A branch never pushed has no remote ref, and everything on it is unsaved.
const remote = branch && gitOk(['rev-parse', '--verify', '-q', `origin/${branch}`]) ? `origin/${branch}` : 'origin/main';
const unsaved = `${remote}..HEAD`;
const unpushed = git(['rev-list', '--count', unsaved]).trim();
if (unpushed === '0') pass(); // The ordinary case: already saved. Leave quietly.

// Twice: the first failure is usually the network waking up.
const push = ['push', '-q', 'origin', `HEAD:refs/heads/${branch}`];
const pushed = branch !== null && (gitOk(push) || gitOk(push));

if (pushed) {
  // The only deletion any hook performs, and it is not record content: this file
  // is a status flag this same hook wrote, and it is false once the push lands.
  rmSync(failurePath, { force: true });
  pass();
}

mkdirSync(dirname(failurePath), { recursive: true }); // A note that cannot be written is a silent failure.
writeFileSync(
  failurePath,
  [
    `PUSH TO ${branch ?? 'a detached HEAD'} FAILED at ${new Date().toISOString()}`,
    '',
    'Unpushed commits:',
    git(['log', '--oneline', unsaved]).trimEnd() || '  (none listed)',
    '',
    'Files affected:',
    git(['diff', '--stat', unsaved]).trimEnd() || '  (none listed)',
    '',
    'The work is committed locally and is NOT lost while this machine lives.',
    'Recover: retry the push. If this machine is gone, so is this file — rebuild',
    'from the session transcript.',
    '',
  ].join('\n'),
);
pass();
