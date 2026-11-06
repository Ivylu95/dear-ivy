// `node scripts/check-tech-stack.mjs`: the tech stack view names every package
// the repository depends on, and nothing it does not (STK-001, "Every package
// the repository depends on and every service it runs on appears on the view,
// with what it is for."), and every link joins two tools with a relation named
// (STK-002). A dependency added without its line in
// dev/ui/lib/tech-stack-data.js fails here, so the view cannot drift.
//
// The comparison is the view's own (dev/ui/lib/tech-stack.js), loaded through
// the admin app's aliases, so the gate and the page can never disagree. In a
// copy without dev/ (ARC-008) there is no view to keep true.

import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const admin = join(root, 'dev', 'ui');
if (!existsSync(join(admin, 'lib', 'tech-stack.js'))) {
  console.log('tech stack: no dev/ in this copy (ARC-008), nothing to check');
  process.exit(0);
}

process.env.DEAR_HARNESS ??= join(root, '.claude');
register(pathToFileURL(join(admin, 'test', 'aliases.mjs')).href);
const { disagreements, readDependencies } = await import(pathToFileURL(join(admin, 'lib', 'tech-stack.js')).href);

const deps = readDependencies(root);
const problems = disagreements(deps);
if (problems.length) {
  console.error('\n  TECH STACK CHECK FAILED\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\n  Give each dependency its tool, purpose and links in dev/ui/lib/tech-stack-data.js.');
  console.error('  See STK-001 in dev/specs/ux/tabs/stack.md.\n');
  process.exit(1);
}
console.log(`tech stack: ${Object.keys(deps).length} dependencies, each on the view`);
