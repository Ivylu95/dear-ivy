// PreToolUse(Bash) — the record is what data/ holds now, never what git once held.
//
// DAT-005: a rebuilt record is a fresh start, "not an erasure — the old record
// stays in git history". Staying there is only safe if no session reads it back:
// one lookup of an old commit and a first conversation greets her by a name she
// has not given. The session brief says so in words; this makes it mechanical.
//
// It refuses outright. A warning would still let the old content reach the
// model, which is the harm. Bringing an old
// record back is the developer's call, made by hand in their own terminal.
//
// Only commands that show content are refused: `git log --stat`, `--name-only`
// and a plain `git log -- data/` list what changed without reading it. A command
// run against another repository (`git -C <path>`, `--git-dir`) is the import's
// business, not this record's history.

import { readHookInput, refuse, pass, repoRoot } from '../lib/hook.mjs';
import { gitTargets, withoutGitGlobals } from '../lib/git-words.mjs';
import { resolve } from 'node:path';

// A folder that is this repository: `-C .` read the record's own history while
// passing as "another repository" (design audit, 2026-10-08).
const here = (dir) => {
  const at = resolve(repoRoot, dir).toLowerCase();
  const top = resolve(repoRoot).toLowerCase();
  return at === top || at === resolve(repoRoot, '.git').toLowerCase();
};

const input = await readHookInput();
const command = input?.tool_input?.command ?? '';
if (!command) pass();

// Each git invocation in a chain, judged on its own.
for (const part of command.split(/&&|\|\||;|\|/)) {
  // Another repository is the import's business; this one is not, however
  // it is named. Then git's global options go, so `--no-pager` or `-c k=v` is
  // never read as the subcommand.
  const targets = gitTargets(part);
  if (targets.length && !targets.every(here)) continue;
  const git = withoutGitGlobals(part).match(/\bgit\s+(.*)$/s);
  if (!git) continue;
  const args = git[1];
  if (!/(^|[\s"':=(/])data(\/|\s*$|["'\s])/.test(args)) continue;

  const sub = args.match(/^\s*(?:-c\s+\S+\s+)*([a-z-]+)/)?.[1] ?? '';
  const namesOnly = /--(stat|numstat|shortstat|name-only|name-status)\b/.test(args);
  const reads =
    (sub === 'show' && !namesOnly) ||
    sub === 'cat-file' ||
    sub === 'blame' ||
    sub === 'annotate' ||
    sub === 'archive' ||
    sub === 'grep' ||
    (sub === 'log' && /(\s-p\b|--patch\b|\s-L|\s-G|\s-S|--word-diff)/.test(args)) ||
    (sub === 'diff' && !namesOnly) ||
    (/^(checkout|restore)$/.test(sub) && /(--source|\S+\s+--\s)/.test(args));
  if (!reads) continue;

  refuse(
    'PreToolUse',
    `Blocked: \`git ${sub}\` would show the record as git once held it.\n\n` +
      'The record is what data/ holds now. After a rebuild the blank files are the whole ' +
      'of it: the old one is never read, restored or quoted by a session, so a fresh ' +
      'start stays fresh (DAT-005). Use `--stat` or `--name-only` if you only need to ' +
      'know which files changed. Bringing an old record back is the developer\'s call — ' +
      'say so and hand them the command to run by hand.',
  );
}

pass();
