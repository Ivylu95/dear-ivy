// Rule test: no workflow prints the model's full output into the run log.
//
// SFG-012, "Nothing personal leaves the machine in a request the agent makes…". On
// 2026-10-09 `show_full_output: true` on claude-code-action, added to read why a
// heartbeat claim failed, printed text from her record into a GitHub run log; the run
// was deleted. A workflow that runs Claude on the record keeps its output to the
// action's summary, and reads failures from the workflow's own steps instead.
//
//   node .claude/hooks/lib/test-workflows-quiet.mjs [folder]   default .github/workflows

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOUD = /^\s*show_full_output:\s*(true|['"]true['"]|\$\{\{)/m;

/** Files in the folder that would print the model's full output. */
export function loud(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.ya?ml$/.test(f) && LOUD.test(readFileSync(join(dir, f), 'utf8')));
}

const dir = process.argv[2] ?? fileURLToPath(new URL('../../../.github/workflows', import.meta.url));
const found = loud(dir);
if (found.length) {
  console.error(`FAIL workflows print the model's full output, which can carry the record into a run log: ${found.join(', ')}`);
  process.exit(1);
}
console.log('ok   no workflow prints the model\'s full output');
console.log('workflows-quiet: all cases hold');
