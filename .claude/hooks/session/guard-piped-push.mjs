// PreToolUse(Bash) — a git push or commit is never piped on unless its own
// exit status survives the pipe (SFG-006 design 5).
//
// A pipeline's status is its last command's. `git push origin main 2>&1 | tail
// -1 && break` reads a rejected push as done, because `tail` succeeded: the
// loop broke, the turn said saved, and the push had been refused (chat of
// 2026-10-12 to 10-15). A save that silently failed is the one failure she
// cannot see.
//
// Refused: a pipeline in which a `git push` or `git commit` stands before a
// `|`. Passed: the same with `set -o pipefail` (or `set -euo pipefail`) in the
// command, or `PIPESTATUS` read after it; `||`, which is not a pipe; and any
// other git command piped (`git log | head`). Quoted text is blanked first, so
// a `|` inside a commit message is not a pipe.
// Proven by the selftest's cases for this hook, the first a replay of the
// incident.

import { pass, readHookInput, refuse } from '../lib/hook.mjs';

const input = await readHookInput();
const command = String(input?.tool_input?.command ?? '');
if (!/\bgit\b/.test(command) || !command.includes('|')) pass();

// Quoted text blanked, so a `|` in a message or a path is not read as a pipe.
const bare = command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
if (/\bset\s+-[a-z]*o\s+pipefail\b|\bPIPESTATUS\b/.test(bare)) pass();

const SAVE = /\bgit\b(?:\s+-[cC]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+(push|commit)\b/;
for (const list of bare.replace(/\|\|/g, '\n').split(/&&|;|\n/)) {
  const stages = list.split('|');
  const piped = stages.slice(0, -1).find((stage) => SAVE.test(stage));
  if (piped) {
    const verb = piped.match(SAVE)[1];
    refuse(
      'PreToolUse',
      `\`git ${verb}\` is piped on, so the pipeline reports the last command's status and a refused ${verb} reads as done (SFG-006 design 5). ` +
        `Run it unpiped, or add \`set -o pipefail;\` at the start of the command, or read \`\${PIPESTATUS[0]}\` after it.`,
    );
  }
}
pass();
