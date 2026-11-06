// Rule test for ux/scripts/eval-history.mjs (E-031, A-071): the history reads
// whole and in order across days and parts, and a busy day starts a new part
// before one would pass the one-read line.

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { join } from 'node:path';
import { appendHistory, PART_LINES, readHistory } from './eval-history.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const dir = makeTemp('eval-history-');
try {
  const at = (day, i) => ({ kind: 'card', date: `${day}T00:00:${String(i % 60).padStart(2, '0')}.000Z`, card: `E-${i}` });
  appendHistory(dir, [at('2026-10-02', 1)]);
  appendHistory(dir, [at('2026-10-01', 2)]);
  check('each line goes to its own day', readdirSync(dir).sort().join(',') === '2026-10-01.jsonl,2026-10-02.jsonl');
  check('read oldest day first', readHistory(dir).map((h) => h.card).join(',') === 'E-2,E-1');

  const busy = Array.from({ length: PART_LINES + 5 }, (_, i) => at('2026-10-03', 100 + i));
  for (const e of busy) appendHistory(dir, e);
  const parts = readdirSync(dir).filter((n) => n.startsWith('2026-10-03')).sort();
  check('a busy day starts a second part', parts.join(',') === '2026-10-03.2.jsonl,2026-10-03.jsonl');
  check('no part passes the line', parts.every((n) => readFileSync(join(dir, n), 'utf8').trim().split('\n').length <= PART_LINES));
  const read = readHistory(dir).filter((h) => h.date.startsWith('2026-10-03')).map((h) => h.card);
  check('the parts read back whole and in order', read.length === busy.length && read.join(',') === busy.map((e) => e.card).join(','));

  for (let p = 2; p <= 10; p += 1) writeFileSync(join(dir, `2026-10-04${p === 1 ? '' : `.${p}`}.jsonl`), `${JSON.stringify(at('2026-10-04', p))}\n`);
  writeFileSync(join(dir, '2026-10-04.jsonl'), `${JSON.stringify(at('2026-10-04', 1))}\n`);
  check('part 10 reads after part 9, not after part 1', readHistory(dir).filter((h) => h.date.startsWith('2026-10-04')).map((h) => h.card).join(',') === 'E-1,E-2,E-3,E-4,E-5,E-6,E-7,E-8,E-9,E-10');

  writeFileSync(`${dir}.jsonl`, `${JSON.stringify(at('2026-09-30', 0))}\n`);
  check('a single file an older chat wrote is read first', readHistory(dir)[0].card === 'E-0');
  rmSync(`${dir}.jsonl`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`eval-history test: ${failed} failed`);
  process.exit(1);
}
console.log('eval-history test: read whole and in order across days and parts, a busy day split before the one-read line, an older single file still read');
