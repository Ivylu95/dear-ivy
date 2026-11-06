// PreToolUse(Bash) — never settle a merge by keeping one side of every clash.
//
// `git merge -X ours` (or `-X theirs`, `--strategy-option`) settles each clash by taking
// one side whole, silently dropping the other's lines in that hunk. On 2026-10-29 a chat
// settled another chat's branch that way: thirteen clashes, and the branch lost three
// hazard-log rows, a skill section, eval-card rewrites and runner tests, found only when the
// safety gate missed the log. Merge plainly and read both sides of each clash instead.
//
// `-s ours` is left alone: it records a branch already in main as merged without taking
// its tree, which save-record does on purpose. Proven by the selftest's cases for this hook,
// the first a replay of 2026-10-29.

import { pass, readHookInput, refuse } from '../lib/hook.mjs';

const input = await readHookInput();
// Quoted text is left out: a commit message naming the refused form is no merge
// (2026-11-03: this check refused its own commit message).
const command = String(input?.tool_input?.command ?? '').replace(/"(?:[^"\\]|\\.)*"|'[^']*'/gs, '""');
if (!/\bgit\b/.test(command) || !/\b(merge|pull)\b/.test(command)) pass();

// -X ours, -Xtheirs, --strategy-option=ours, --strategy-option theirs, on merge or pull.
const ONE_SIDED = /\bgit\b[^\n;&|]*\b(?:merge|pull)\b[^\n;&|]*(?:\s-X\s*|\s--strategy-option[=\s]+)(?:ours|theirs)\b/;
if (ONE_SIDED.test(command)) {
  refuse(
    'PreToolUse',
    'Refused: a merge that settles every clash by keeping one side drops the other side\'s lines unseen ' +
      '(2026-10-29: a branch lost hazard-log rows, a skill section and tests this way). Merge plainly, ' +
      'then read both sides of each clash and keep what each added; for the Transcript, run ' +
      '`node ux/scripts/dialogue.mjs resolve`.',
  );
}
pass();
