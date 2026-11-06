#!/usr/bin/env node
// The see-it logo check (DEV-004 design 4), proven on invented logos in a
// throwaway folder: each kind of fault is seen failing, the clean set passing,
// and a stale Checked date reported without failing. Reads no real logo.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTemp } from '../../../hooks/lib/temp-litter.mjs';
import { checkLogos, intervalMonths, svgFaults } from './check-logos.mjs';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const clean = {
  'square.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c33"/></svg>',
  'ring.svg': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#36c"/></linearGradient></defs><circle id="c" cx="5" cy="5" r="4" fill="url(#g)"/><use href="#c"/></svg>',
  'raster.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image width="1" height="1" href="data:image/png;base64,iVBORw0KGgo="/></svg>',
};

// Each fault, on its own, in an otherwise clean file.
const bad = [
  ['<svg><script>alert(1)</script></svg>', 'script'],
  ['<svg><rect onload="x()"/></svg>', 'event attribute'],
  ['<svg><a xlink:href="https://example.com/x"><rect/></a></svg>', 'links out'],
  ['<svg><image href="https://example.com/x.png"/></svg>', 'links out'],
  ['<svg><rect style="fill:url(https://example.com/p.svg#a)"/></svg>', 'links out'],
  ['<svg><foreignObject><div/></foreignObject></svg>', 'foreignObject'],
  ['<svg><style>@import "https://example.com/a.css";</style></svg>', '@import'],
];
for (const [text, kind] of bad) assert.ok(svgFaults(text).some((f) => f.includes(kind)), `should fail (${kind}): ${text}`);
for (const [name, text] of Object.entries(clean)) assert.deepEqual(svgFaults(text), [], `should pass: ${name}`);

assert.equal(intervalMonths('| **Interval** | 3 months, or sooner |'), 3);
assert.equal(intervalMonths('no status here'), 6);

const dir = makeTemp('diagram-logos-');
try {
  const logos = join(dir, 'logos');
  const log = join(dir, 'log.md');
  writeFileSync(log, '| **Interval** | 6 months |\n');
  mkdirSync(logos);
  const row = (file, text, checked = '2026-11-01', hash = sha(text)) => `| Name | \`${file}\` | https://example.com/brand | example | colour | trademark | ${checked} | \`${hash}\` |`;
  const write = (files, rows) => {
    rmSync(logos, { recursive: true, force: true });
    mkdirSync(logos);
    for (const [n, t] of Object.entries(files)) writeFileSync(join(logos, n), t);
    writeFileSync(join(logos, 'SOURCES.md'), `| Logo | File | Source | From | Kind | Licence | Checked | sha256 |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
  };
  const allRows = Object.entries(clean).map(([n, t]) => row(n, t));

  // Clean: passes, nothing reported.
  write(clean, allRows);
  let r = checkLogos(logos, log, '2026-11-04');
  assert.deepEqual(r.failures, [], 'the clean set passes');
  assert.deepEqual(r.reports, [], 'nothing stale');

  // A file changed after vetting.
  write({ ...clean, 'square.svg': clean['square.svg'].replace('#c33', '#3c3') }, allRows);
  r = checkLogos(logos, log, '2026-11-04');
  assert.ok(r.failures.some((f) => f.startsWith('square.svg: sha256')), 'a changed file fails');

  // A logo no row lists, and a row with no logo.
  write({ ...clean, 'stray.svg': clean['square.svg'] }, allRows.slice(1));
  r = checkLogos(logos, log, '2026-11-04');
  assert.ok(r.failures.includes('stray.svg is in no SOURCES.md row'), 'an unlisted logo fails');
  assert.ok(r.failures.includes('square.svg is in no SOURCES.md row'), 'a dropped row fails');
  write({ 'ring.svg': clean['ring.svg'] }, allRows);
  r = checkLogos(logos, log, '2026-11-04');
  assert.ok(r.failures.includes('square.svg is in SOURCES.md but not in logos/'), 'a row with no file fails');

  // A logo with a script in it, even when its hash is listed.
  const evil = '<svg><script>x</script></svg>';
  write({ ...clean, 'evil.svg': evil }, [...allRows, row('evil.svg', evil)]);
  r = checkLogos(logos, log, '2026-11-04');
  assert.ok(r.failures.some((f) => f.startsWith('evil.svg has a <script>')), 'a vetted hash does not excuse a script');

  // Stale: reported, never failed.
  write(clean, [row('square.svg', clean['square.svg'], '2026-01-02'), ...allRows.slice(1)]);
  r = checkLogos(logos, log, '2026-11-04');
  assert.deepEqual(r.failures, [], 'a stale date does not fail');
  assert.ok(r.reports.some((x) => x.startsWith('square.svg: checked 2026-01-02')), 'a stale date is reported');

  // No SOURCES.md at all.
  rmSync(join(logos, 'SOURCES.md'));
  assert.deepEqual(checkLogos(logos, log, '2026-11-04').failures, ['logos/SOURCES.md is missing']);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`see-it logos test: ${bad.length} unsafe logos caught, ${Object.keys(clean).length} clean ones passed, the sources table held both ways`);
