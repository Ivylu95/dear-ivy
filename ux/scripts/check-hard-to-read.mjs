#!/usr/bin/env node
// A-171: a passage the developer said was hard to read is rewritten by the next check.
// Reads dev/hard-to-read.md; fails while a passage flagged before today is still, word for word,
// in its file. A copy without dev/ has nothing to check.
//
// Run: node ux/scripts/check-hard-to-read.mjs [--root <dir>] [--today YYYY-MM-DD]

import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINE = /^- hard · (.+?) · "(.+)" · flagged (\d{4}-\d{2}-\d{2})\s*$/;

/** Each flagged passage still standing past its day, and each line out of format. */
export function stale(root, today) {
  const ledger = join(root, 'dev', 'hard-to-read.md');
  if (!existsSync(ledger)) return { stale: [], bad: [] };
  const out = { stale: [], bad: [] };
  for (const line of readFileSync(ledger, 'utf8').split('\n')) {
    if (!line.startsWith('- hard')) continue;
    const m = line.match(LINE);
    if (!m) { out.bad.push(line); continue; }
    const [, path, passage, day] = m;
    const first = normalize(path).split(/[\\/]/)[0];
    if (first === 'data' || first === '..') { out.bad.push(line); continue; }
    const file = join(root, path);
    const text = existsSync(file) ? readFileSync(file, 'utf8').replace(/\s+/g, ' ') : '';
    if (day < today && text.includes(passage.replace(/\s+/g, ' '))) out.stale.push({ path, passage, day });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const root = arg('--root') ?? fileURLToPath(new URL('../..', import.meta.url));
  const today = arg('--today') ?? new Date().toISOString().slice(0, 10);
  const { stale: left, bad } = stale(root, today);
  for (const b of bad) console.log(`  hard-to-read: a line out of format, or pointing into data/: ${b}`);
  for (const s of left) console.log(`  hard-to-read: ${s.path} still says "${s.passage.slice(0, 80)}", flagged hard to read on ${s.day}: rewrite it, then drop its line (A-171)`);
  console.log(left.length || bad.length ? `hard-to-read check: ${left.length + bad.length} to fix` : 'hard-to-read check: nothing he flagged is still standing');
  process.exit(left.length || bad.length ? 1 : 0);
}
