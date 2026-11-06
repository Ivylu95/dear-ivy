#!/usr/bin/env node
// The restore drill's rule test (DAT-003 design 5): an invented record, the sample, passes;
// each way a saved copy can fail to come back whole is caught; a fault names a folder,
// never a file. Run on copies of data-sample/ in the system's temp folder.

import assert from 'node:assert/strict';
import { appendFileSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drill } from './restore-drill.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fresh = () => {
  const dir = makeTemp('restore-drill-test-');
  cpSync(join(ROOT, 'data-sample'), dir, { recursive: true });
  return dir;
};
const cases = [];
const run = (what, break_, check) => {
  const dir = fresh();
  try {
    break_(dir);
    check(drill(dir), what);
    cases.push(what);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

run('the invented sample comes back whole', () => {}, (f, w) => assert.deepEqual(f, [], w));
run('a standing file gone is caught', (d) => rmSync(join(d, 'core', 'me', 'what_helps.md')), (f, w) => assert.ok(f.some((x) => /standing file missing in core\/me/.test(x)), w));
run('a link in the index to nothing is caught', (d) => appendFileSync(join(d, 'README.md'), '\n- [gone](core/people/nobody-here.md)\n'), (f, w) => assert.ok(f.some((x) => /link in the index to nothing in core\/people/.test(x)), w));
run('a timeline out of date order is caught', (d) => appendFileSync(join(d, 'core', 'timeline.md'), '| 2001-01-01 | event | test | an old line last | |\n'), (f, w) => assert.ok(f.some((x) => /out of date order/.test(x)), w));
run('a dotted timeline line is read too', (d) => appendFileSync(join(d, 'core', 'timeline.md'), '\n2002-02-02 · event · test · a dotted old line\n'), (f, w) => assert.ok(f.some((x) => /out of date order/.test(x)), w));
run('a timeline pointer to nothing is caught', (d) => appendFileSync(join(d, 'core', 'timeline.md'), '| 2999-01-01 | event | test | a line | → data/core/journal/never-written.md |\n'), (f, w) => assert.ok(f.some((x) => /timeline pointer to nothing/.test(x)), w));
run('a profile that breaks its rules is caught', (d) => writeFileSync(join(d, 'PROFILE.yaml'), 'mandatory:\n  name:\n    status: sometimes\n'), (f, w) => assert.ok(f.some((x) => /profile/.test(x)), w));
run('a schedule file that does not read is caught', (d) => writeFileSync(join(d, 'core', 'calendar', 'reminders.json'), '{ not json'), (f, w) => assert.ok(f.some((x) => /schedule file that does not read/.test(x)), w));
run('a fault never names a file, only its folder', (d) => appendFileSync(join(d, 'README.md'), '\n- [x](core/people/somename.md)\n'), (f, w) => assert.ok(f.length && f.every((x) => !/somename/.test(x)), w));
assert.deepEqual(drill(join(tmpdir(), 'no-such-record-folder-here')), ['no record folder at all'], 'no record folder at all is a fault');

console.log(`restore drill test: ${cases.length + 1} cases pass`);
