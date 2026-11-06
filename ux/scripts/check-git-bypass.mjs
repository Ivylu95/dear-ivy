// No harness script, and no unattended prompt, runs a git command the history guard refuses (SFG-011,
// "No committed version is ever lost, here or on the remote.").
//
//   node ux/scripts/check-git-bypass.mjs     (runs in `npm run check` and the commit gate)
//
// The guard, .claude/hooks/record/guard-git-history.mjs, reads the command line
// an agent types. A script it runs is one command line, `node x.mjs`, so a git
// call inside the script is never seen: a delete the guard would refuse typed
// goes through when written into a file. Learned 2026-10-01, when a branch
// sweep written in a development chat ran `git push --delete` from a script,
// duplicating DEP-011 and going around the guard; only the platform's own
// refusal stopped it.
//
// A git call is recognised by its argument list, the form every script here
// uses: 'push' with '--delete', '--force', '-f' or '--mirror'; 'branch' with
// '-D', '-f', '--force' or '-M'; 'reset' with '--hard'; 'tag' with '-d' or
// '--delete'; 'clean' with '-f'. Each on one line. The guard and its selftest
// name these on purpose and are skipped. The safe forms stay open: `git
// branch -d` and `git worktree remove` without --force refuse unmerged or
// unsaved work themselves (DEP-011). What must delete on GitHub does so in
// .github/workflows/, under DEP-011, where the developer reviews it.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIP_DIRS as WALK_SKIP, walkFiles } from '../lib/walk-skip.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const ROOTS = ['.claude', 'ux/scripts', 'ux/lib', 'modules'];
// The shared list (lib/walk-skip.mjs) keeps out an agent's worktree copy of the
// repository, whose scripts are the same ones read here already.
const SKIP_DIRS = new Set([...WALK_SKIP, 'state']);
const EXEMPT = new Set(['.claude/hooks/record/guard-git-history.mjs', '.claude/hooks/selftest.mjs', 'ux/scripts/check-git-bypass.mjs']);

const q = (s) => `['"\`]${s}['"\`]`;
const RULES = [
  [new RegExp(`${q('push')}.*${q('(--delete|--force|-f|--mirror)')}|${q('(--delete|--force|--mirror)')}.*${q('push')}`), 'a delete or force push'],
  [new RegExp(`${q('branch')}.*${q('(-D|-f|--force|-M)')}`), 'force-deleting or force-moving a branch'],
  [new RegExp(`${q('reset')}.*${q('--hard')}`), 'a hard reset'],
  [new RegExp(`${q('tag')}.*${q('(-d|--delete)')}`), 'deleting a tag'],
  [new RegExp(`${q('clean')}.*${q('-[a-z]*f[a-z]*')}`), 'git clean'],
];

export function findBypasses(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of RULES) if (re.test(line)) out.push({ line: i + 1, what });
  });
  return out;
}

// The unattended prompts are command lines the guard does see, but in a run
// with no one present to answer its refusal: the heartbeat's cleanup step was
// written with `git worktree remove --force`, which the guard refuses, and
// only a by-hand landing found it (2026-10-08). So each git command a prompt
// gives in backticks is put to the guard itself, as a run would type it. The
// guard is read, never copied: it is in the safety core, and its rules change
// only there.
const PROMPTS = join(repoRoot, '.claude', 'jobs');
const GUARD = join(repoRoot, '.claude', 'hooks', 'record', 'guard-git-history.mjs');

/** [{ line, command }] for each backticked span in a prompt that runs git. */
export function promptCommands(text) {
  const out = [];
  text.split('\n').forEach((l, i) => {
    for (const [, command] of l.matchAll(/`([^`]*\bgit\s[^`]*)`/g)) out.push({ line: i + 1, command });
  });
  return out;
}

/** Whether the history guard refuses this command line. */
export function guardRefuses(command, guard = GUARD) {
  const r = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  return /"permissionDecision"\s*:\s*"deny"/.test(r.stdout ?? '');
}

function promptFiles() {
  return walkFiles(PROMPTS, { names: new Set(), keep: (n) => n.endsWith('.md') });
}

function files() {
  const keep = (name) => !SKIP_DIRS.has(name) && /\.(mjs|js|cjs|ts)$/.test(name) && !/^test-/.test(name);
  return ROOTS.flatMap((r) => walkFiles(join(repoRoot, r), { names: SKIP_DIRS, keep }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = [];
  for (const path of files()) {
    const rel = relative(repoRoot, path).split('\\').join('/');
    if (EXEMPT.has(rel)) continue;
    for (const f of findBypasses(readFileSync(path, 'utf8'))) found.push(`  - ${rel}:${f.line}: ${f.what}`);
  }
  for (const path of promptFiles()) {
    const rel = relative(repoRoot, path).split('\\').join('/');
    for (const { line, command } of promptCommands(readFileSync(path, 'utf8'))) {
      if (guardRefuses(command)) found.push(`  - ${rel}:${line}: the history guard refuses \`${command}\`, so an unattended run stops there`);
    }
  }
  if (found.length) {
    console.error('\n  GIT BYPASS CHECK FAILED\n');
    console.error(found.join('\n'));
    console.error(
      '\n  A script runs git out of the history guard\'s sight (SFG-011). Use the form\n' +
        '  that refuses on its own (`git branch -d`, an ordinary push), or leave it to\n' +
        '  the developer; branch clean-up already exists (DEP-011).\n',
    );
    process.exit(1);
  }
  console.log('git bypass check: no script runs a git command the history guard refuses');
}
