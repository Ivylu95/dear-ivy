#!/usr/bin/env node
// The timeline order check (MEM-007 design 2), against timelines made for it:
// an entry dated before the one above it is caught, in a table and in the line
// format; a "told" date later than the next entry is not sorted on; dates above
// the Entries heading are not entries. Then the real check, on the invented
// records, must pass.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryDates, outOfOrder } from './check-timeline-order.mjs';

const head = '# Timeline\n\n## Eras\n\n2026-09-01 was the start of an era.\n\n## Entries\n\n';
const table = (...dates) => head + '| Date | Type | What happened |\n|---|---|---|\n' + dates.map((d) => `| ${d} | event | something |`).join('\n') + '\n';

assert.deepEqual(outOfOrder(table('2026-01-02', '2026-01-02', '2026-03-01')), [], 'in order, a shared day included');
const caught = outOfOrder(table('2026-01-02', '2026-03-01', '2026-02-10'));
assert.equal(caught.length, 1, 'an entry dated before the one above it is caught');
assert.equal(caught[0].date, '2026-02-10');
assert.equal(caught[0].before.date, '2026-03-01');
assert.deepEqual(outOfOrder(table('2026-01-02 (told 2026-06-01)', '2026-02-10')), [], 'a told date is never the one sorted on');
assert.equal(outOfOrder(table('2026-02-10 (told 2026-02-11)', '2026-01-02 (told 2026-06-01)')).length, 1, 'a line told late but filed by its telling is caught');
assert.equal(entryDates(table('2026-01-02')).length, 1, 'a date above the Entries heading is not an entry');
const lines = head + '2026-01-02 · event · work · a gist · → data/core/x.md\n2025-12-30 · event · work · earlier · → data/core/y.md\n';
assert.equal(outOfOrder(lines).length, 1, 'the line format is read too');

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-timeline-order.mjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// data-sample/ ships in every copy; data-sandbox/ is the developer's, and a new
// copy has none (new-copy.mjs removes it), so there the sample's is the only one.
assert.ok(existsSync(join(root, 'data-sample/core/timeline.md')), 'the sample holds a timeline');
const held = ['data-sample/core/timeline.md', 'data-sandbox/core/timeline.md'].filter((f) => existsSync(join(root, f))).length;
const real = spawnSync(process.execPath, [script], { encoding: 'utf8' });
assert.equal(real.status, 0, `the invented timelines are in order: ${real.stderr}`);
assert.match(real.stdout, new RegExp(`\\b${held} invented timelines?\\b`), `every invented timeline in this copy was read (${held})`);
console.log('timeline order test: out of order caught in both formats, told dates and the Eras ignored, the invented records in order');
