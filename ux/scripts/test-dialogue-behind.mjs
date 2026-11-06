// Rule test for dialogue.mjs ask's stale-copy warning: a copy behind GitHub's main is
// told so before it answers "not found" (2026-10-30: a search on a copy hours behind
// missed what another chat had kept). A throwaway origin and two clones; nothing real.
//
// Run: node ux/scripts/test-dialogue-behind.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { behindOrigin } from './dialogue.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const dir = makeTemp('dear-behind-');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, stdio: 'ignore' });
try {
  const origin = join(dir, 'origin.git');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  const a = join(dir, 'a');
  git(dir, 'clone', '-q', origin, a);
  git(a, 'checkout', '-q', '-b', 'main');
  writeFileSync(join(a, 'f'), 'one\n');
  git(a, 'add', 'f');
  git(a, 'commit', '-q', '-m', 'one');
  git(a, 'push', '-q', 'origin', 'main');
  const b = join(dir, 'b');
  git(dir, 'clone', '-q', '-b', 'main', origin, b);
  assert.equal(behindOrigin(b), 0, 'a copy level with GitHub is not behind');
  writeFileSync(join(a, 'f'), 'two\n');
  git(a, 'commit', '-q', '-am', 'two');
  git(a, 'push', '-q', 'origin', 'main');
  assert.equal(behindOrigin(b), 1, 'another chat\'s push leaves this copy one behind, and the fetch sees it');
  git(b, 'pull', '-q', '--no-rebase', 'origin', 'main');
  assert.equal(behindOrigin(b), 0, 'after a pull it is level again');
  assert.equal(behindOrigin(join(dir, 'nowhere')), 0, 'no repository: it cannot tell, and says nothing');
  console.log('dialogue behind test: a stale copy is counted behind after a fetch, a level one is not');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
