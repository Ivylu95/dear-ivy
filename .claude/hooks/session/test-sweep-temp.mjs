// Rule test for session/sweep-temp.mjs: an aged file in temp/ goes, and a folder
// holding a .git never does (round 3, B17: an aged heartbeat worktree with an
// unpushed commit was swept), nor new-copy's half-made history (B10). Run in a
// throwaway folder with invented files, by the hook self-test.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'sweep-temp.mjs');
const root = makeTemp('dear-sweep-');
const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
const put = (path, text = 'x\n') => {
  const p = join(root, 'temp', path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  utimesSync(p, old, old);
};

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  put('stale/old.log');
  // A worktree: its .git is a file naming the history it belongs to.
  put('hb-rem/.git', 'gitdir: /elsewhere/.git/worktrees/hb-rem\n');
  put('hb-rem/data/core/state/log.md');
  // A clone or a history of its own: .git is a folder.
  put('clone/.git/HEAD', 'ref: refs/heads/main\n');
  put('clone/notes.md');
  put('new-copy/for', 'me\n');
  put('new-copy/head', 'abc\n');
  const r = spawnSync(process.execPath, [hook], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  check('the sweep runs', r.status === 0);
  check('an aged scratch file goes', !existsSync(join(root, 'temp/stale/old.log')));
  check('the incident: an aged worktree in temp/ is left whole', existsSync(join(root, 'temp/hb-rem/.git')) && existsSync(join(root, 'temp/hb-rem/data/core/state/log.md')));
  check('an aged folder holding a history is left whole', existsSync(join(root, 'temp/clone/.git/HEAD')) && existsSync(join(root, 'temp/clone/notes.md')));
  check('the incident: a stopped new-copy run\'s folder is left whole', existsSync(join(root, 'temp/new-copy/for')) && existsSync(join(root, 'temp/new-copy/head')));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`sweep test: ${failed} failed`);
  process.exit(1);
}
console.log('sweep test: all passed');
