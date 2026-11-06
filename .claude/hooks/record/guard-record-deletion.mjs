// PreToolUse(Bash|Write) — nothing in data/ is ever deleted, truncated or
// overwritten whole.
//
// SFG-003, "A write that would lose part of the record is refused before it
// lands." Git history keeps anything committed, and guard-git-history.mjs keeps
// history; what it cannot keep is a record file written and destroyed before the
// turn ends and save-record.mjs commits it. This closes that gap for data/ only:
// everything else in the repository is the agent's to delete (the developer's
// rule, 2026-09-27 — anything except destroying).
//
// Shell: rm and its PowerShell spellings, git rm, a truncating `>`, sed -i,
// truncate, find -delete, and mv carrying a file out of data/. A move within
// data/ — into data/archive/ — passes.
// Write: replacing an existing record file whole. A new file passes, and an Edit
// always does; a whole-file write is how a file loses the lines nobody re-typed.
//
// Refuses outright: a destroyed record is never the
// intended edit, and the archive move is always there instead.

import { failClosed, readHookInput, refuse, pass, isInside, repoRoot } from '../lib/hook.mjs';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';


// A guard: a crash refuses the call (lib/hook.mjs, failClosed).
failClosed('PreToolUse', 'the record-deletion guard');
const input = await readHookInput();
const { command = '', file_path: path = '' } = input?.tool_input ?? {};

const INSTEAD =
  'Nothing in the record is ever deleted or overwritten whole: a memory that quietly ' +
  'changes cannot be trusted. Move superseded material to data/archive/ (`git mv`), ' +
  'leave a dated line saying what changed, and write the new version forward. If the ' +
  'developer really wants it gone, they run it by hand.';

if (path) {
  const record = join(repoRoot, 'data');
  if (input?.tool_name === 'Write' && isInside(path, record) && existsSync(resolve(repoRoot, path))) {
    refuse(
      'PreToolUse',
      `Blocked: replacing ${path} whole.\n\nUse Edit to change the lines that changed. ${INSTEAD}`,
    );
  }
  pass();
}
if (!command) pass();

// A path is the record's when `data` starts it — `data/…`, `./data`, or the
// repository's own absolute path — never when it only contains it (temp/data/).
const root = repoRoot.replace(/\\/g, '/').replace(/\/$/, '');
const esc = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DATA = new RegExp(`(?:^|[\\s"'=(])(?:\\./|${esc}/)?data(?:/|(?=[\\s"';&|)]|$))`);
const IN_DATA = new RegExp(`^(?:\\./|${esc}/)?data(?:/|$)`);

// `rm` also covers `git rm` and `find -exec rm`.
const RULES = [
  [/\b(rm|rmdir|unlink|shred|del|erase|rd|Remove-Item|ri)\b/i, 'deleting from data/'],
  [/\btruncate\b/, 'truncate against data/'],
  [/\bsed\s+(-\w+\s+)*-i/, 'sed -i rewriting a file in data/ in place'],
  [/\bfind\b.*-delete\b/, 'find -delete under data/'],
];
const REDIRECT = new RegExp(`(^|[^>\\d])>\\s*["']?(?:\\./|${esc}/)?data/`);
const MOVE = /\b(mv|move|Move-Item|mi)\b/i;
const EMPTIES = /\b(Clear-Content|clc)\b/i;
const OVERWRITES = /\b(Set-Content|Out-File)\b/i;
const TEE = /\btee\b/;
const COPY = /\b(cp|copy|Copy-Item|cpi)\b/i;

// A commit message is prose, not a command: one that says it moved a file out
// of data/ must not refuse its own commit. Heredoc bodies and -m text go.
const code = command
  .replace(/\\/g, '/')
  .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
  .replace(/(\s-m|--message)(=|\s+)("([^"\\]|\\.)*"|'[^']*')/g, '');

// Quoted text is an argument, not a command. A `printf` of prose, or a test
// passing a command as a JSON string, once refused because "mv" and "data/" sat
// together inside quotes (2026-09-27). So the command words (rm, mv, sed -i…)
// count only outside quotes, while a quoted *path* still counts: `rm "data/x"`
// is refused as before. The one case where quoted text is itself the command —
// a shell run with -c, -Command or /c, or eval — is read whole, unmasked.
const masked = code.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (q) => q[0] + '_'.repeat(q.length - 2) + q[0]);
const RUNS_QUOTED = /\b(?:bash|sh|zsh|dash|pwsh|powershell|cmd)(?:\.exe)?\b[^|;&]*\s(?:-c|-Command|\/c)\b|\beval\b/i;

// Split on the masked text, so a ; or | inside quotes does not cut a command.
const parts = [];
let from = 0;
for (const m of masked.matchAll(/;|&&|\|\||\|/g)) {
  parts.push([code.slice(from, m.index), masked.slice(from, m.index)]);
  from = m.index + m[0].length;
}
parts.push([code.slice(from), masked.slice(from)]);

for (const [part, bare] of parts) {
  const words = RUNS_QUOTED.test(bare) ? part : bare;
  if (REDIRECT.test(part)) refuse('PreToolUse', `Blocked: a single > redirect into data/, which truncates the file (>> appends).\n\n${INSTEAD}`);
  if (!DATA.test(part)) continue;
  for (const [rule, what] of RULES) {
    if (rule.test(words)) refuse('PreToolUse', `Blocked: ${what}.\n\n${INSTEAD}`);
  }
  // A move is refused when data/ is a source and the destination is outside it;
  // `mv data/x data/archive/x` stays within the record and passes.
  if (MOVE.test(words)) {
    const dest = part.trim().split(/\s+/).pop().replace(/["']/g, '');
    if (!IN_DATA.test(dest)) refuse('PreToolUse', `Blocked: mv carrying a file out of data/.\n\n${INSTEAD}`);
  }
  // Emptying or overwriting a record file whole through the shell, the way the
  // Write tool is refused above: `cp /dev/null data/x`, `Clear-Content`, a
  // `Set-Content` or `Out-File` without -Append, a `tee` without -a (design
  // audit, 2026-10-08). A copy that creates a new file passes, as a Write does.
  if (EMPTIES.test(words)) refuse('PreToolUse', `Blocked: emptying a file in data/.\n\n${INSTEAD}`);
  if (OVERWRITES.test(words) && !/-Append\b/i.test(words)) refuse('PreToolUse', `Blocked: overwriting a file in data/ whole (add -Append to add to it).\n\n${INSTEAD}`);
  if (TEE.test(words) && !/\stee\b[^|;&]*\s-(a|-append)\b/.test(words)) refuse('PreToolUse', `Blocked: tee overwriting a file in data/ (tee -a appends).\n\n${INSTEAD}`);
  if (COPY.test(words)) {
    const dest = part.trim().split(/\s+/).pop().replace(/["']/g, '');
    const target = resolve(repoRoot, dest);
    if (IN_DATA.test(dest) && existsSync(target) && !statSync(target).isDirectory()) {
      refuse('PreToolUse', `Blocked: copying over ${dest}, which replaces it whole.\n\n${INSTEAD}`);
    }
  }
}

pass();
