// Rule test for check-secrets.mjs (SFG-007 design 5): a tree built for it in a
// temporary folder, a key planted where each rule says it must or must not be
// found, beside a clean twin. The incident (2026-10-09 audit): every folder
// named `state` was skipped, so a key in data/core/state/ passed the check.
// The key is assembled at run time, so this file never holds one.
//
// Run from ux/: node scripts/test-check-secrets.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findSecrets } from './check-secrets.mjs';
import { hasToken } from '../../.claude/hooks/lib/update/secrets.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const KEY = ['ghp', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('_');
const tree = (files) => {
  const root = makeTemp('dear-secrets-');
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
};

const roots = [];
try {
  const clean = tree({ 'README.md': 'no key here', 'data/core/state/log.md': 'a session' });
  roots.push(clean);
  check('a clean tree passes', findSecrets(clean).length === 0);

  const leaky = tree({
    'README.md': 'no key here',
    'data/core/state/log.md': `pasted ${KEY}`,
    '.claude/skills/x/SKILL.md': `clone https://x-access-token:${'s3cr3t'.repeat(2)}@github.com/o/r`,
    '.claude/hooks/state/touched-1.json': KEY,
    '.claude/worktrees/agent-1/README.md': KEY,
    'temp/scratch.txt': KEY,
    'ux/node_modules/pkg/index.js': KEY,
  });
  roots.push(leaky);
  const found = findSecrets(leaky);
  check('the incident: a key in her session log is found', found.includes('data/core/state/log.md'));
  check('a key in a clone URL is found', found.includes('.claude/skills/x/SKILL.md'));
  check('hook state, which git ignores, is not read', !found.some((f) => f.includes('hooks/state')));
  check('an agent worktree, scratch and packages are not read', !found.some((f) => /worktrees|temp\/|node_modules/.test(f)));
  check('nothing else is reported', found.length === 2);
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

// The bot token's shapes (edge cases, 2026-10-29, D-G6): the pattern behind this
// check, the guard and the pre-commit gate let three through. Assembled here too.
{
  const tail = ['A1b2C3d4E5f6G7h8I9', 'j0K1l2M3n4O5p6Q7'].join('');
  const id = (n) => '1234567890123'.slice(0, n);
  check('a bot token is found', hasToken(`${id(9)}:${tail}x`));
  check('the incident: a bot token inside its own URL is found', hasToken(`https://api.telegram.org/bot${id(10)}:${tail}x/getMe`));
  check('a bot token ending in a dash is found', hasToken(`key ${id(9)}:${tail}-`));
  check('a bot token with an 11-digit id is found', hasToken(`${id(11)}:${tail}x`));
  // Round 2 (C2): the id's bounds and an encoded colon let these through.
  check('a bot token with a 20-digit id is found', hasToken(`${'12345678901234567890'}:${tail}x`));
  check('the incident: a bot token with a 13-digit id is found', hasToken(`${id(13)}:${tail}x`));
  check('the incident: a bot token with its colon URL-encoded is found', hasToken(`bot${id(9)}%3A${tail}x`));
  check('a clock time is not a token', !hasToken('meet at 12:30, or 2026-10-29 09:15:00'));
  check('a longer key is not a bot token', !hasToken(`${id(9)}:${tail}xyz`));
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
