// PreToolUse(Bash|Write|Edit|MultiEdit|NotebookEdit) — git history, local and
// on GitHub, is never destroyed or rewritten.
//
// SFG-011, "No committed version is ever lost, here or on the remote."
//
// The developer's rule, 2026-09-27: the agent may change anything in the
// repository — CLAUDE.md, the hooks, the harness — as long as git and GitHub
// keep every version. That one property is what makes every other edit safe:
// whatever an agent gets wrong in a file, the commit before it still exists.
// So commit, push, pull, fetch, merge, branch and switch stay open, and
// everything that loses a commit, rewrites one, or discards unsaved work is
// refused.
//
// Refuses outright.
// The permission deny-list in settings.json turns away the common prefixes;
// this reads the whole command line, so a flag later in the command, a chained
// `&&`, or a PowerShell spelling does not slip past.

import { readHookInput, refuse, pass, isInside, repoRoot } from '../lib/hook.mjs';
import { withoutGitGlobals } from '../lib/git-words.mjs';
import { join } from 'node:path';

const input = await readHookInput();
const { command = '', file_path: path = '' } = input?.tool_input ?? {};

const INSTEAD =
  'Git history is never destroyed or rewritten, locally or on GitHub. Make the change ' +
  'forward instead: a new commit that reverts or fixes (`git revert`, or an edit and ' +
  'a commit), an ordinary push, a new branch. If this really must happen, ask the ' +
  'developer to run it themselves.';

if (path && isInside(path, join(repoRoot, '.git'))) {
  refuse('PreToolUse', `Blocked: writing inside .git/.\n\n${INSTEAD}`);
}

// Each is tested against one command in a chain (split on ; && || |), so a
// flag is only matched against the git command it belongs to.
const RULES = [
  [/\bgit\s+push\b.*(\s-f\b|--force|--mirror|--delete|\s-d\b|--prune|\s\+\S|\s:\S)/, 'a force, delete or mirror push'],
  [/\bgit\s+reset\b.*--(hard|merge|keep)\b/, 'git reset that discards work'],
  [/\bgit\s+clean\b/, 'git clean'],
  [/\bgit\s+commit\b.*--amend\b/, 'amending a commit'],
  [/\bgit\s+rebase\b/, 'git rebase'],
  [/\bgit\s+(filter-branch|filter-repo|replace)\b/, 'rewriting history'],
  [/\bgit\s+reflog\s+(expire|delete)\b/, 'expiring the reflog'],
  [/\bgit\s+gc\b.*--prune/, 'pruning unreachable commits'],
  [/\bgit\s+update-ref\b/, 'moving a ref by hand'],
  [/\bgit\s+branch\b.*(\s-D\b|\s-f\b|--force|\s-M\b)/, 'force-deleting or force-moving a branch'],
  [/\bgit\s+tag\b.*(\s-d\b|--delete|\s-f\b|--force)/, 'deleting or moving a tag'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'dropping a stash'],
  [/\bgit\s+checkout\b.*(\s--(\s|$)|\s\.(\s|$)|\s-f\b|--force|\s-B\b)/, 'git checkout that discards unsaved work'],
  // Unstaging alone (--staged without --worktree) keeps the working copy.
  [(c) => /\bgit\s+restore\b/.test(c) && (!/(\s-S\b|--staged)/.test(c) || /(\s-W\b|--worktree)/.test(c)), 'git restore that discards unsaved work'],
  [/\bgit\s+switch\b.*(\s-f\b|--force|--discard-changes|\s-C\b)/, 'git switch that discards unsaved work'],
  [/\bgit\s+worktree\s+remove\b.*(\s-f\b|--force)/, 'force-removing a worktree'],
  [/\bgit\s+remote\s+(remove|rm|rename|set-url)\b/, 'changing where the repository saves to'],
  [/\bgh\s+repo\s+(delete|archive|rename|edit|transfer)\b/, 'changing or deleting the GitHub repository'],
  [/\bgh\s+repo\s+sync\b.*--force/, 'a forced repo sync'],
  [/\bgh\s+release\s+delete\b/, 'deleting a release'],
  [/\bgh\s+api\b.*(-X|--method)\s*(DELETE|PATCH|PUT)\b/i, 'a GitHub API call that changes or deletes'],
  [/\b(rm|rmdir|del|erase|rd|Remove-Item|ri|mv|move|Move-Item|truncate|shred)\b.*(^|[\s"'/\\])\.git([\s"'/\\]|$)/i, 'deleting or moving .git'],
  [/(^|[^>\d])>\s*("?)(\S*[/\\])?\.git[/\\]/, 'overwriting a file inside .git/'],
  // The commit gate's own ways round (unlock, 2026-11-03): a commit it never sees
  // (commit-tree, made by a review on 2026-10-03), and one that skips it (one
  // slipped through on 2026-10-07). History keeps both, but neither was checked.
  [/\bgit\s+commit-tree\b/, 'git commit-tree, which makes a commit the commit gate never sees'],
  [/\bgit\s+(commit|merge|push|cherry-pick|revert|am|pull)\b.*\s--no-verify\b/, 'skipping the commit gate with --no-verify'],
  [/\bgit\s+commit\b.*\s-n(\s|$)/, 'skipping the commit gate with -n'],
];

// Git's global options are dropped before the rules read a command, so the one
// that points git at another hooks folder is read here, from the command as typed.
const HOOKS_PATH = /\bcore\.hookspath\b/i;
const READS_ONLY = /\bgit\s+config\b.*(--get\b|--get-all\b|--list\b|\s-l\b)/;
// Pointing it at the gate itself is how set-up switches the gate back on (repair.md).
const THE_GATE = /\bcore\.hookspath(=|\s+)["']?(\.\/)?\.claude\/hooks\/git\/?["']?(\s|$)/i;

// A commit message is prose, not a command: one that mentions a rebase or a
// force push must not refuse its own commit. Heredoc bodies and -m text go.
// Git's own global options go too, so `git -C . commit --amend` and
// `git -c k=v push --force` read as the subcommand every rule expects
// (lib/git-words.mjs; design audit, 2026-10-08).
const code = withoutGitGlobals(
  command
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
    .replace(/(\s-m|--message)(=|\s+)("([^"\\]|\\.)*"|'[^']*')/g, ''),
);

const typed = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
  .replace(/(\s-m|--message)(=|\s+)("([^"\\]|\\.)*"|'[^']*')/g, '');
for (const part of typed.split(/;|&&|\|\||\|/)) {
  if (/\bgit\b/.test(part) && HOOKS_PATH.test(part) && !READS_ONLY.test(part) && !THE_GATE.test(part)) {
    refuse('PreToolUse', `Blocked: pointing git at another hooks folder, which skips the commit gate.\n\n${INSTEAD}`);
  }
}

for (const part of code.split(/;|&&|\|\||\|/)) {
  for (const [rule, what] of RULES) {
    if (typeof rule === 'function' ? rule(part) : rule.test(part)) refuse('PreToolUse', `Blocked: ${what}.\n\n${INSTEAD}`);
  }
}

pass();
