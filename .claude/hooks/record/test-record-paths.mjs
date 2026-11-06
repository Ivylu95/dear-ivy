#!/usr/bin/env node
// The bare-"data" rule in ux/scripts/check-record-paths.mjs: it refuses a prefix
// that also matches data-sandbox/, and passes a folder named in full with its
// slash. It refused startsWith('data-sandbox/') on 2026-10-02, a false alarm.
//
// Run: node .claude/hooks/record/test-record-paths.mjs

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'ux', 'scripts', 'check-record-paths.mjs');
const { risks } = await import(pathToFileURL(script).href);

// Sample lines say DATA, swapped in at run time, so the scanner this tests
// does not refuse its own test file.
const cases = [
  ["refuses a bare DATA prefix", "if (p.startsWith('DATA')) skip();", true],
  ["refuses DATA- with no folder named", "if (p.startsWith('DATA-')) skip();", true],
  ["refuses includes of a bare DATA", "p.includes('DATA')", true],
  ['refuses a regex anchored at DATA with no slash', 'if (/^DATA/.test(p)) skip();', true],
  ["passes startsWith('data/')", "if (p.startsWith('DATA/')) skip();", false],
  ["passes startsWith('data-sandbox/'), named in full", "if (p.startsWith('DATA-sandbox/')) skip();", false],
  ["passes includes('/data-sample/')", "p.includes('/DATA-sample/')", false],
];

let failed = 0;
for (const [what, line, risky] of cases) {
  const ok = risks(line.replace('DATA', 'data')).length > 0 === risky;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (failed) process.exit(1);
console.log(`record-path rule tests: ${cases.length} cases pass`);
