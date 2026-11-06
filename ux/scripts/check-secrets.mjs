// No access key is committed, anywhere in the repository, the record included.
//
//   node ux/scripts/check-secrets.mjs     (runs in `npm run check` and the commit gate)
//
// PRV-003, "A credential never enters version control." A key pasted into a
// chat to fetch a harness update is refused at the write by guard-secrets.mjs;
// this is the same rule at the commit, for whatever reached a file past that
// guard (a shell command it could not read, an edit made off the machine). A
// committed key stays in history after it expires, so it is caught here, before.
//
// Walked with the shared walker (lib/walk-skip.mjs). Until 2026-10-09 it skipped
// every folder named `state`, which took her session log in data/core/state/
// out of the check with the hook state it meant; it now skips hook state by
// path, which git ignores anyway, and agent worktrees, which are not this tree.
// Proven by test-check-secrets.mjs (SFG-007 design 5).

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKEN } from '../../.claude/hooks/lib/update/secrets.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

const MAX_BYTES = 2_000_000;

/** Files under `root` that hold an access key, relative and with forward slashes. */
export function findSecrets(root) {
  const found = [];
  for (const abs of walkFiles(root, { paths: ['hooks/state'] })) {
    let text;
    try {
      if (statSync(abs).size >= MAX_BYTES) continue;
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (TOKEN.test(text)) found.push(relative(root, abs).replace(/\\/g, '/'));
  }
  return found;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) {
  const repoRoot = process.env.CLAUDE_PROJECT_DIR || join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
  const found = findSecrets(repoRoot);
  if (found.length) {
    console.error(
      `\n  SECRETS CHECK FAILED\n\n${found.map((f) => `  - ${f} holds an access key`).join('\n')}\n\n` +
        '  Take the key out before committing, and revoke it: once committed, history keeps it.\n' +
        '  See PRV-003, "A credential never enters version control."\n',
    );
    process.exit(1);
  }
  console.log('secrets check: no access key in any file');
}
