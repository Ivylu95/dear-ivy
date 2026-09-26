// PreToolUse(Bash) — nothing in data/ is ever deleted, truncated or overwritten.
//
// CLAUDE.md: "nothing is ever deleted - superseded material moves to
// data/archive/, it never disappears." The permission deny-list already turns
// away `rm` and `git reset`. This catches the shapes a deny-list cannot see:
// a truncating `>` redirect, `sed -i`, a `find -delete`, a `git clean` that
// takes untracked files with it, an `mv` that carries a file out of data/.
//
// It refuses rather than asks. A destructive command against her record is
// never the intended one, and the archive move is always available instead.

import { readHookInput, deny, pass } from '../lib/hook.mjs';

const input = await readHookInput();
const command = input?.tool_input?.command ?? '';
if (!command) pass();

// Does this command mention the record at all?
const touchesData = /(^|[\s"'=(/])data\//.test(command) || /\bdata\b\s*$/.test(command);

const RULES = [
  [/\brm\s+(-\w+\s+)*[^|;&]*data\//, 'rm against data/'],
  [/\bgit\s+rm\b/, 'git rm'],
  [/\bgit\s+clean\b/, 'git clean (it takes untracked files in data/ with it)'],
  [/\bgit\s+(checkout|restore|reset)\b[^|;&]*\bdata\//, 'discarding written changes in data/'],
  [/\btruncate\b[^|;&]*data\//, 'truncate against data/'],
  [/\bsed\s+(-\w+\s+)*-i\b[^|;&]*data\//, 'sed -i rewriting a file in data/ in place'],
  [/\bfind\b[^|;&]*data\/[^|;&]*(-delete|-exec\s+rm)/, 'find -delete under data/'],
  [/(^|[^>\d])>\s*("?)[^\s"'|;&]*data\/[^\s"'|;&]+/, 'a single > redirect, which truncates the file it writes to (>> appends)'],
  [/\bmv\s+[^|;&]*data\/[^|;&]*\s+(?!.*data\/)[^\s|;&]+\s*$/, 'mv carrying a file out of data/'],
];

for (const [pattern, what] of RULES) {
  if (!pattern.test(command)) continue;
  if (!touchesData && !/git\s+(rm|clean)/.test(command)) continue;
  deny(
    'PreToolUse',
    `Blocked: ${what}.\n\n` +
      'Nothing in her record is ever deleted or overwritten in place — a memory that ' +
      'quietly changes cannot be trusted. Move the superseded material to data/archive/ ' +
      'with `git mv`, leave a dated line saying what changed, and write the new version ' +
      'forward. If this really was an append, use `>>`.',
  );
}

pass();
