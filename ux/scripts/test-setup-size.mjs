// Rule test for lib/setup-size.mjs, DEP-014 design 3's size limit on the set-up
// skill: lines for the folder, and words for SKILL.md's body and each file beside
// it (T-598). Small folders built in a temporary directory, and the shipped
// folder against the shipped thresholds.
//
// Run from the repository root: node ux/scripts/test-setup-size.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords, routeTotals, setUpSizeFaults } from '../lib/setup-size.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const limits = { mainLines: 300, fileLines: 200, folderLines: 900, mainWords: 1000, fileWords: 1500 };
const root = makeTemp('dear-setup-size-');
const folder = (files) => {
  const dir = join(root, String(Math.random()).slice(2));
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};
const front = '---\nname: set-up\ndescription: ' + words(400) + '\n---\n';

try {
  check('a word is a run holding a letter or digit: pipes and dots are not words', countWords('| a | b · 3 |\n|---|---|') === 3);

  const fine = folder({ 'SKILL.md': front + words(1000) + '\n', 'repair.md': words(1500) + '\n' });
  check('at both word limits, nothing is refused', setUpSizeFaults(fine, limits).length === 0);
  check('the frontmatter description is not counted in SKILL.md\'s body', !setUpSizeFaults(fine, limits).some((f) => f.includes('SKILL.md')));

  const longMain = folder({ 'SKILL.md': front + words(1001) + '\n' });
  check('SKILL.md one word over its body limit is refused, naming the file', setUpSizeFaults(longMain, limits).some((f) => f.includes('SKILL.md: 1001 words in its body')));

  const longFile = folder({ 'SKILL.md': front + 'short\n', 'repair.md': words(1501) + '\n' });
  check('a reference one word over its limit is refused, naming the file', setUpSizeFaults(longFile, limits).some((f) => f.includes('repair.md: 1501 words, over its limit of 1500')));

  const fewLines = folder({ 'SKILL.md': front + words(10) + '\n', 'import.md': words(1600) + '\n' });
  check('a file within its lines but over its words is still refused', setUpSizeFaults(fewLines, limits).some((f) => f.includes('import.md') && f.includes('words')));

  const manyLines = folder({ 'SKILL.md': front + 'a\n'.repeat(301) });
  check('the line limits still hold beside the word limits', setUpSizeFaults(manyLines, limits).some((f) => f.includes('SKILL.md: 305 lines, over its limit of 300')));

  check('a limit missing from the thresholds is not checked', setUpSizeFaults(longFile, { ...limits, fileWords: null }).length === 0);

  // What one run reads, route by route (setUp.routeWords).
  const skillWith = (rows, extra = '') => `${front}# Set up\n\n## 1. Who is asking\n\n- **The developer**: every run reads [\`running.md\`](running.md).${extra}\n- **Her**: [\`her-side.md\`](her-side.md) answers; an update is [\`update.md\`](update.md).\n\n## 3. Routes\n\n| She or he says | Read |\n|---|---|\n${rows}\n\n## 4. Next\n\nNothing \`repair.md\` here counts.\n`;
  const routeLimits = { ...limits, routeWords: 2500 };
  const parts = { 'running.md': words(500), 'her-side.md': words(1400), 'update.md': words(800), 'repair.md': words(900), 'new-copy.md': words(900), 'telegram.md': words(400) };
  const routed = folder({ 'SKILL.md': skillWith('| *"It\'s broken"* | [`repair.md`](repair.md) |\n| *"Set this up"* | `new-copy.md`, then `telegram.md` |'), ...parts });
  const { routes } = routeTotals(routed);
  const byRoute = (name) => routes.find((r) => r.route.includes(name));
  check('a development route counts SKILL.md, the file every development run reads, and the row\'s file', byRoute("It's broken")?.words === countWords(skillWith('| *"It\'s broken"* | [`repair.md`](repair.md) |\n| *"Set this up"* | `new-copy.md`, then `telegram.md` |').replace(/^---\n[\s\S]*?\n---\n/, '')) + 500 + 900);
  check('a row naming two files counts both', byRoute('Set this up')?.files.join(',') === 'running.md,new-copy.md,telegram.md');
  check('each file the Her bullet names is a route of its own, without running.md', routes.filter((r) => r.chat === 'her').map((r) => r.files.join(',')).join(';') === 'her-side.md;update.md');
  check('a file named outside § 1 and § 3 is not a route', !routes.some((r) => r.files.length === 1 && r.files[0] === 'repair.md' && r.chat === 'her'));
  check('every route under 2,500 words: nothing refused', !setUpSizeFaults(routed, routeLimits).some((f) => f.includes('route')));
  const heavy = folder({ 'SKILL.md': skillWith('| *"Set this up"* | `new-copy.md`, then `telegram.md` |'), ...parts, 'new-copy.md': words(1700) });
  check('a route over 2,500 words is refused, naming the route and its files', setUpSizeFaults(heavy, routeLimits).some((f) => f.includes('the development route "Set this up"') && f.includes('running.md + new-copy.md + telegram.md') && f.includes('over its limit of 2500')));
  const herHeavy = folder({ 'SKILL.md': skillWith('| *"It\'s broken"* | `repair.md` |'), ...parts, 'update.md': words(2480) });
  check('a route in her chat over the limit is refused too', setUpSizeFaults(herHeavy, routeLimits).some((f) => f.includes('the her route "update.md"')));
  const noTable = folder({ 'SKILL.md': `${front}# Set up\n\n- **The developer**: x\n- **Her**: y\n`, ...parts });
  check('a SKILL.md with no routing table is refused, never passed unmeasured', setUpSizeFaults(noTable, routeLimits).some((f) => f.includes('no routing table')));

  const shipped = { mainLines: threshold('setUp.mainLines', 'lines'), fileLines: threshold('setUp.fileLines', 'lines'), folderLines: threshold('setUp.folderLines', 'lines'), mainWords: threshold('setUp.mainWords', 'words'), fileWords: threshold('setUp.fileWords', 'words'), routeWords: threshold('setUp.routeWords', 'words') };
  check('the word thresholds are stated (setUp.mainWords, setUp.fileWords, setUp.routeWords)', Boolean(shipped.mainWords && shipped.fileWords && shipped.routeWords));
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const faults = setUpSizeFaults(join(repo, '.claude', 'skills', 'set-up'), shipped);
  check(`the shipped set-up folder is within every limit${faults.length ? `: ${faults.join('; ')}` : ''}`, faults.length === 0);
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`\nsetup size test: ${failed} failed`);
  process.exit(1);
}
console.log('\nsetup size test: all passed');
