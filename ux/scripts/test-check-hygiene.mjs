// Rule test for check-hygiene.mjs, HYG-002's `whole:` list: a file only code reads,
// written by a tool or imported byte for byte, is kept whole and named as such;
// everything else over the one-pass line is still reported, a folder entry keeps
// nothing whole, and an entry naming no tracked file is a fault.
//
// Run from the repository root: node ux/scripts/test-check-hygiene.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-hygiene.mjs');
// The cases use a large imported table under dev/; a copy without dev/ (ARC-008) has none to test.
if (!existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dev', 'skills', 'safety-eval', 'vera-mh', 'personas.tsv'))) {
  console.log('hygiene size test: no dev/ in this copy (ARC-008), nothing to test');
  process.exit(0);
}
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const dir = makeTemp('dear-hygiene-');
try {
  const run = (allowText) => {
    const env = { ...process.env };
    if (allowText !== undefined) {
      const file = join(dir, 'allow.txt');
      writeFileSync(file, allowText);
      env.HYGIENE_ALLOW_FILE = file;
    }
    return JSON.parse(execFileSync(process.execPath, [script, '--json'], { env, encoding: 'utf8', maxBuffer: 64 << 20 }));
  };
  const over = (r) => r.oversize.map((o) => o.path);
  const whole = (r) => r.leftWhole.map((o) => o.path);
  const TSV = 'dev/skills/safety-eval/vera-mh/personas.tsv';
  const LOCK = 'ux/package-lock.json';

  const empty = run('');
  check('with nothing listed, the imported table is reported over the line', over(empty).includes(TSV));
  check('a lockfile is kept whole without being listed', whole(empty).includes(LOCK) && !over(empty).includes(LOCK));

  const listed = run(`whole: ${TSV}\n`);
  check('a listed file is kept whole and still named', whole(listed).includes(TSV) && !over(listed).includes(TSV));
  check('every file not listed stays reported', over(empty).filter((p) => p !== TSV).every((p) => over(listed).includes(p)));

  const folder = run('whole: dev/skills/safety-eval/vera-mh/\nwhole: dev/\n');
  check('a folder entry keeps nothing whole', over(folder).includes(TSV) && whole(folder).every((p) => p === LOCK));

  const gone = run('whole: dev/no-such-file.tsv\n');
  check('an entry naming no tracked file is a fault', gone.wholeFaults.length === 1);

  const real = run();
  check('the repository list keeps whole only what it names, each still tracked', real.wholeFaults.length === 0 && whole(real).includes(TSV));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
