// Rule test for check-hard-to-read.mjs (A-171): a passage he flagged fails the next check while it
// stands; rewritten, it passes; flagged today, it waits for the next day's check; never into data/.
//
// Run: node ux/scripts/test-hard-to-read.mjs

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { stale } from './check-hard-to-read.mjs';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++; };
const dir = makeTemp('dear-hard-');
try {
  mkdirSync(join(dir, 'dev'), { recursive: true });
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'page.md'), 'One line.\nThe stacked noun pile reply shape check\nwording here.\n');
  const ledger = (lines) => writeFileSync(join(dir, 'dev', 'hard-to-read.md'), `# Hard to read\n\n${lines.join('\n')}\n`);
  ledger(['- hard · .claude/page.md · "The stacked noun pile reply shape check wording here." · flagged 2026-11-05']);
  check('a passage he flagged still standing at the next day\'s check fails, across a line break', stale(dir, '2026-11-06').stale.length === 1);
  check('flagged today, it waits for the next check', stale(dir, '2026-11-05').stale.length === 0);
  writeFileSync(join(dir, '.claude', 'page.md'), 'One line.\nThe check reads plainly now.\n');
  check('rewritten, it passes', stale(dir, '2026-11-06').stale.length === 0);
  ledger(['- hard · data/core/now.md · "anything" · flagged 2026-11-01', '- hard · bad line']);
  check('a line pointing into data/, or out of format, is refused', stale(dir, '2026-11-06').bad.length === 2);
  rmSync(join(dir, 'dev'), { recursive: true });
  check('a copy without dev/ has nothing to check', stale(dir, '2026-11-06').stale.length === 0 && stale(dir, '2026-11-06').bad.length === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `hard-to-read: ${failed} failed` : 'hard-to-read: all cases hold');
process.exit(failed ? 1 : 0);
