#!/usr/bin/env node
// check-only-strengthens: what an unreviewed fix branch may and
// may not do, one change per case, and that the safety core is read from its
// own list.
//
// Run from ux/: node scripts/test-only-strengthens.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { corePaths, safetyCommits, violations } from './check-only-strengthens.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
const core = ['dev/specs/interaction/safety.md', '.claude/hooks/safety/', 'ux/scripts/check-safety.mjs'];
const one = (status, path, added = 1, removed = 0) => violations([{ status, path, added, removed }], core);

check('a new check passes', one('A', 'ux/scripts/check-new-rule.mjs', 40).length === 0);
check('a case added to a test passes', one('M', 'ux/scripts/test-check-doctor-fence.mjs', 3, 0).length === 0);
check('code changed to match a row passes', one('M', 'ux/components/Thing.jsx', 5, 4).length === 0);
check('a registry entry added passes', one('M', 'ux/lib/checks.mjs', 1, 0).length === 0);
check('a spec change is refused', one('M', 'dev/specs/system/dev.md').length === 1);
check('a change under data/ is refused', one('M', 'data/core/state/now.md').length === 1);
check('a safety-core file is refused', one('M', 'ux/scripts/check-safety.mjs', 1, 0).length === 1);
check('a file in a safety-core folder is refused', one('A', '.claude/hooks/safety/new.mjs').length === 1);
check('a deleted file is refused', one('D', 'ux/components/Old.jsx', 0, 30).length === 1);
check('a line removed from a check is refused', one('M', 'ux/scripts/check-links.mjs', 2, 1).length === 1);
check('a line removed from a guard is refused', one('M', '.claude/hooks/record/guard-record-history.mjs', 0, 1).length === 1);
check('a line removed from the commit gate is refused', one('M', '.claude/hooks/git/pre-commit', 0, 1).length === 1);
check('a hook\'s behaviour changed to match a row passes', one('M', '.claude/hooks/record/save-record.mjs', 3, 2).length === 0);
check('a known exception added is refused', one('M', 'ux/scripts/check-links.known.txt', 1, 0).length === 1);
check('a known exception removed passes', one('M', 'ux/scripts/check-links.known.txt', 0, 1).length === 0);
const live = corePaths();
check('the safety core is read from its guard', live.includes('dev/specs/interaction/safety.md') && live.includes('.claude/hooks/safety/'));
// 2026-10-09: the first fixer run changed the check-in and the session-close hook for SAF-004 and SAF-014.
check('the safety surface is read from its list, the check-in on it', live.includes('.claude/jobs/check-in.md') && live.includes('CLAUDE.md'));
check('a change to the check-in is refused', violations([{ status: 'M', path: '.claude/jobs/check-in.md', added: 5, removed: 1 }], live).length === 1);
// An edge-case run of 2026-10-29: '.claude/skills/first-contact' holds a '.', so it was read as
// a file and a new .claude/skills/first-contact/helper.mjs passed.
check('the first-contact skill is read as a folder', live.includes('.claude/skills/first-contact/'));
check('a new file in the first-contact skill is refused', violations([{ status: 'A', path: '.claude/skills/first-contact/helper.mjs', added: 5, removed: 0 }], live).length === 1);
{
  // The stricter reading still catches every path the old one did: an invented surface of each shape.
  const dir = makeTemp('dear-core-');
  try {
    const surface = ['CLAUDE.md', '.claude/hooks/safety', '.claude/skills/first-contact', 'ux/lib/x.mjs', 'bin/run', 'docs/', 'a.b/c', 'a.b/c.d/e.txt'];
    mkdirSync(join(dir, '.claude/hooks/safety'), { recursive: true });
    writeFileSync(join(dir, '.claude/hooks/safety/safety-at-stop.mjs'), `const SURFACE = [\n${surface.map((s) => `  '${s}',`).join('\n')}\n];\n`);
    writeFileSync(join(dir, '.claude/hooks/safety/guard-safety-core.mjs'), `const CORE = [\n  ['ux/lib/safety.mjs', whole],\n  ['.claude/hooks/safety/', whole],\n];\n`);
    const now = corePaths(dir);
    const old = [...['ux/lib/safety.mjs', '.claude/hooks/safety/'], ...surface.map((p) => (p.includes('.') && !p.endsWith('/') ? p : `${p.replace(/\/$/, '')}/`))];
    const paths = [...surface, ...surface.map((s) => `${s.replace(/\/$/, '')}/child.mjs`), 'ux/lib/safety.mjs', 'ux/lib/other.mjs', 'CLAUDE.md.bak'];
    const caught = (list, p) => violations([{ status: 'M', path: p, added: 1, removed: 0 }], list).length === 1;
    const lost = paths.filter((p) => caught(old, p) && !caught(now, p));
    check('every path the old reading caught is still caught', lost.length === 0);
    check('a folder named with a dot is read as a folder, a file with an extension as a file', caught(now, 'a.b/c/child.mjs') && caught(now, '.claude/skills/first-contact/child.mjs') && caught(now, 'a.b/c.d/e.txt') && !caught(now, 'a.b/c.d/e.txt/child.mjs') && !caught(now, 'CLAUDE.md.bak'));
    check('an entry with no extension is caught as itself and as a folder', caught(now, 'bin/run') && caught(now, 'bin/run/child.mjs'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
check('a commit citing a safety row is refused', safetyCommits(['fix(safety): a miss is detected at session close (SAF-004)']).length === 1);
check('a commit citing a safety-tab row is refused', safetyCommits(['fix(ux): the tab shows the plan (SPL-003)']).length === 1);
check('a commit citing any other row passes', safetyCommits(['fix(record): the timeline holds the event (DAT-002)']).length === 0);

if (failed) {
  console.log(`\nonly-strengthens test: ${failed} failed`);
  process.exit(1);
}
console.log('\nonly-strengthens test: all passed');
