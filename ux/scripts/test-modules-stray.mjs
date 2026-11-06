// Rule test for strayFolders (.claude/hooks/lib/modules.mjs): a record folder no
// module owns, holding a file, is found; module folders, the root's own folders and
// an empty leftover folder are not.
//
// The incident (2026-11-06): a module was renamed and its record folder moved; a
// session still on the old code wrote blank copies back at the old folder name.
//
// Run: node ux/scripts/test-modules-stray.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strayFolders } from '../../.claude/hooks/lib/modules.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const modules = [
  { data: 'core', manifest: { root: { 'templates/root': '.', 'templates/x/plan.md': 'safety/safety_plan.md' } } },
  { data: 'food', manifest: {} },
];
const put = (dir, path) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), 'x\n');
};

const sound = makeTemp('stray-sound-');
for (const p of ['core/timeline.md', 'food/days/2026-01-01.md', 'safety/safety_plan.md', 'archive/old.md', 'archive-local/raw.txt', 'README.md']) put(sound, p);
mkdirSync(join(sound, 'oldname'), { recursive: true });
check('a sound record, with an empty leftover folder, has no stray folder', strayFolders(sound, modules).length === 0);

const after = makeTemp('stray-incident-');
for (const p of ['core/timeline.md', 'food/README.md', 'oldname/README.md', 'oldname/supplements.md']) put(after, p);
check('the incident: blank copies written back at a renamed module\'s old folder are found', JSON.stringify(strayFolders(after, modules)) === '["oldname"]');

const deep = makeTemp('stray-deep-');
put(deep, 'other/sub/file.md');
check('a file deep inside an unowned folder still counts', JSON.stringify(strayFolders(deep, modules)) === '["other"]');

check('a record that is not there has no stray folder', strayFolders(join(deep, 'missing'), modules).length === 0);

console.log(failed ? `stray folders: ${failed} failed` : 'stray folders: all cases hold');
process.exit(failed ? 1 : 0);
