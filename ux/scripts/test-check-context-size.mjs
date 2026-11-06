#!/usr/bin/env node
// The context size check (CTX-001 design 1), run against files made for it: one
// line past the ceiling fails, the ceiling itself passes, a file that fell under
// it is told to lower it, and one at the cap passes with no such note. Then the
// real CLAUDE.md, which must pass.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-context-size.mjs');
const ceiling = threshold('context.layerCeiling', 'lines');
const cap = threshold('context.layerCap', 'lines');
assert.ok(ceiling && cap && cap < ceiling, 'both thresholds are stated, the cap under the ceiling');

const dir = makeTemp('dear-ctx-lines-');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
const run = (n) => {
  const file = join(dir, `lines-${n}.md`);
  writeFileSync(file, Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n') + '\n');
  return spawnSync(process.execPath, [script, '--file', file], { encoding: 'utf8' });
};

const past = run(ceiling + 1);
assert.equal(past.status, 1, 'one line past the ceiling fails');
assert.match(past.stderr, new RegExp(`${ceiling + 1} lines, past its ceiling of ${ceiling}`));
assert.equal(run(ceiling).status, 0, 'the ceiling itself passes');
const fell = run(ceiling - 3);
assert.equal(fell.status, 0, 'a file under the ceiling passes');
assert.match(fell.stdout, new RegExp(`Lower the ceiling to ${ceiling - 3}`), 'and is told to lower it');
const under = run(cap);
assert.equal(under.status, 0, 'the cap passes');
assert.doesNotMatch(under.stdout, /Lower the ceiling/, 'with no note to lower anything');

const real = spawnSync(process.execPath, [script], { encoding: 'utf8' });
assert.equal(real.status, 0, `the real CLAUDE.md passes: ${real.stderr}`);
console.log('context size test: past the ceiling fails; the ceiling, a fall under it and the cap pass; CLAUDE.md passes');
