// The sandbox switch, and the check that keeps its template in step with data/.
//
//   node ux/scripts/sandbox.mjs on      this chat uses data-sandbox/, built blank if absent
//   node ux/scripts/sandbox.mjs off     this chat goes back to data/
//   node ux/scripts/sandbox.mjs reset   data-sandbox/ back to blank; switched chats stay switched
//   node ux/scripts/sandbox.mjs check   data/ has no kind of file the blank template lacks
//                                       (runs as part of `npm run check`)
//
// Run by `/sandbox` (.claude/commands/sandbox.md), never by her. The logic is in
// .claude/hooks/lib/sandbox.mjs, shared with the hooks that follow the switch.
// Deletes nothing in data/, ever: `on`, `off` and `reset` touch data-sandbox/ only.

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
process.env.CLAUDE_PROJECT_DIR ||= repoRoot;
// pathToFileURL, not the bare path: on Windows an absolute path reaches the ESM
// loader as the scheme `c:` and it refuses to load at all.
const { enter, leave, reset, sessionId, missingFromTemplate } = await import(
  pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib', 'sandbox.mjs')).href
);

function dataFiles() {
  const root = join(repoRoot, 'data');
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(root, path).replace(/\\/g, '/'));
    }
  })(root);
  return out;
}

const action = process.argv[2] ?? 'on';

if (action === 'check') {
  const missing = missingFromTemplate(dataFiles);
  if (missing.length) {
    console.error(
      `\n  SANDBOX TEMPLATE CHECK FAILED\n\n${missing.map((m) => `  - data/${m} has no blank copy`).join('\n')}\n\n` +
        '  Add an emptied version of each at .claude/templates/record/<same path>, so a\n' +
        '  fresh sandbox has the shape data/ has now.\n',
    );
    process.exit(1);
  }
  console.log('sandbox template check: every kind of file in data/ has a blank copy');
  process.exit(0);
}

const id = sessionId();
if (!id) {
  console.error('sandbox: cannot tell which chat this is (no session ID in the environment), so nothing was switched.');
  process.exit(1);
}

if (action === 'on') enter(id);
else if (action === 'off') leave(id);
else if (action === 'reset') reset();
else {
  console.error(`sandbox: "${action}" is not an action — use on, off, reset or check.`);
  process.exit(1);
}

console.log(
  {
    on: 'sandbox ON: this chat now reads and writes data-sandbox/. data/ is untouched.',
    off: 'sandbox OFF: this chat is back on data/.',
    reset: 'sandbox RESET: data-sandbox/ is blank again.',
  }[action],
);
