// The sandbox switch, and the check that keeps its template in step with data/.
//
//   node ux/scripts/sandbox.mjs on      this chat uses data-sandbox/, built blank if absent
//   node ux/scripts/sandbox.mjs off     this chat goes back to data/
//   node ux/scripts/sandbox.mjs reset   data-sandbox/ back to blank; switched chats stay switched
//   node ux/scripts/sandbox.mjs sample  data-sandbox/ becomes a copy of data-sample/, to play on a full record
//   node ux/scripts/sandbox.mjs check   data/ has no kind of file the blank template lacks
//                                       (runs as part of `npm run check`)
//
// Run by `/dev-mode sandbox` (dev/commands/dev-mode.md), never by her. The logic is in
// .claude/hooks/lib/sandbox.mjs, shared with the hooks that follow the switch.
// Deletes nothing in data/, ever: `on`, `off` and `reset` touch data-sandbox/ only.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
process.env.CLAUDE_PROJECT_DIR ||= repoRoot;
// pathToFileURL, not the bare path: on Windows an absolute path reaches the ESM
// loader as the scheme `c:` and it refuses to load at all.
const { enter, leave, reset, resetFromSample, sessionId, missingFromTemplate, takeSwitch, SWITCH_STEPS, inSandbox } = await import(
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

let action = process.argv[2] ?? 'on';

if (action === 'check') {
  // The sandbox is development mode's (/dev-mode sandbox). A copy made for someone
  // else has no dev/ and no sandbox, and its record may grow folders of its own (an
  // import's, CLAUDE.md: the structure is hers), which it cannot template without a
  // harness change (DEP-013); so nothing to check (ARC-008; rehearsal 2026-10-27).
  if (!existsSync(join(repoRoot, 'dev'))) {
    console.log('sandbox template check: no dev/ in this copy, so no sandbox to keep in step, skipped');
    process.exit(0);
  }
  const missing = missingFromTemplate(dataFiles);
  if (missing.length) {
    console.error(
      `\n  SANDBOX TEMPLATE CHECK FAILED\n\n${missing.map((m) => `  - data/${m} has no blank copy`).join('\n')}\n\n` +
        '  Add an emptied version of each at modules/core/templates/blank-record/<same path>, or\n' +
        "  under another module's templates/ and name it in that module.json's standing map,\n" +
        '  so a fresh sandbox has the shape data/ has now.\n',
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

// `toggle` is what /dev-red-team runs: off if this chat is in the test, else on.
// The typed switch was recorded with the same direction, so the gate below holds.
const toggled = action === 'toggle';
if (toggled) action = inSandbox(id) ? 'off' : 'on';

// WKB-013: only the developer switches the sandbox, by typing it; never the agent.
if (Object.hasOwn(SWITCH_STEPS, action) && !takeSwitch(id, action)) {
  const how = toggled ? '/dev-red-team' : `/dev-mode sandbox ${action}`;
  console.error(`sandbox: nothing was switched. Only the developer switches the sandbox, by typing ${how} in their own message (WKB-013).`);
  process.exit(1);
}

if (action === 'on') enter(id);
else if (action === 'off') leave(id);
else if (action === 'reset') reset();
else if (action === 'sample') resetFromSample();
else {
  console.error(`sandbox: "${action}" is not an action — use on, off, reset, sample or check.`);
  process.exit(1);
}

console.log(
  {
    on: 'sandbox ON: this chat now reads and writes data-sandbox/. data/ is untouched.',
    off: 'sandbox OFF: this chat is back on data/.',
    reset: 'sandbox RESET: data-sandbox/ is blank again.',
    sample: 'sandbox SAMPLE: data-sandbox/ is now a copy of data-sample/. data-sample/ and data/ are untouched.',
  }[action],
);
