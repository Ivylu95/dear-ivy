// Which saved stress tests need judging again, checked by machine.
//
//   node scripts/spec-stress.mjs                 one line per case, then a summary
//   node scripts/spec-stress.mjs --summary       the summary line alone
//   node scripts/spec-stress.mjs --stamp ST-004  record the current fingerprints of a case's rows
//   node scripts/spec-stress.mjs --stamp all     the same, for every case
//
// The cases live in dev/skills/spec-review/stress-cases.md. Each rests on
// named rows; `Seen` holds a fingerprint of each row as it read when the case
// was last judged. A row that has changed since, or is gone, sends the case
// back for judging.
//
// ── What it does not do ─────────────────────────────────────────────────────
//
// It never gives a verdict. Whether a row still answers a scenario is meaning,
// and meaning is the spec-review skill's Stress job. This script only says
// which cases a change could have touched, so a run judges those and not all.
// Padding and spacing inside a table row are ignored, so re-aligning a table
// does not send every case back.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS_DIR, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';
import { parseRows, rowText } from '../../.claude/hooks/lib/spec-rows.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, SPECS_DIR);
const CASES = join(REPO, SKILLS_DIR, 'spec-review', 'stress-cases.md');

const walk = (dir) => {
  if (!existsSync(dir)) throw new Error(`no specs at ${dir}`);
  return walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') });
};

// Every live row, by ID. A row in Recently deleted is written "was 007", never
// as a bold ID, so it is not found here — which is right: the case must be judged again.
// The stamp hashes the row's own words, not its markup, so a row moved from a
// table line into a section of its own keeps its stamp.
const rows = new Map();
for (const file of walk(SPECS)) {
  for (const row of parseRows(readFileSync(file, 'utf8'))) {
    rows.set(row.id, createHash('sha1').update(rowText(row)).digest('hex').slice(0, 8));
  }
}

const raw = readFileSync(CASES, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

const cases = [];
let current = null;
lines.forEach((line, i) => {
  const head = line.match(/^### (ST-\d{3}) · (.+)$/);
  if (head) cases.push((current = { id: head[1], title: head[2], ids: [], seen: new Map(), seenLine: -1 }));
  if (!current) return;
  const r = line.match(/^- \*\*Rows:\*\* (.+)$/);
  if (r) current.ids = r[1].match(/[A-Z]{3}-\d{3}/g) ?? [];
  const s = line.match(/^- \*\*Seen:\*\* (.+)$/);
  if (s) {
    current.seenLine = i;
    for (const [, id, hash] of s[1].matchAll(/([A-Z]{3}-\d{3}) ([0-9a-f]{8})/g)) current.seen.set(id, hash);
  }
});

const awaitingBlock = raw.split(/^## Awaiting an answer$/m)[1]?.split(/^## /m)[0] ?? '';
const awaiting = awaitingBlock.split(/\r?\n/).filter((l) => /^- /.test(l) && !/None yet/.test(l)).length;

const status = (c) => {
  const missing = c.ids.filter((id) => !rows.has(id));
  if (missing.length) return { state: 'gone', ids: missing };
  if (!c.seen.size) return { state: 'unstamped', ids: [] };
  const changed = c.ids.filter((id) => c.seen.get(id) !== rows.get(id));
  return changed.length ? { state: 'changed', ids: changed } : { state: 'ok', ids: [] };
};

const args = process.argv.slice(2);
const stampAt = args.indexOf('--stamp');

if (stampAt !== -1) {
  const target = args[stampAt + 1];
  const chosen = target === 'all' ? cases : cases.filter((c) => c.id === target);
  if (!chosen.length) {
    console.error(`No case ${target ?? '(none named)'} in stress-cases.md.`);
    process.exit(1);
  }
  for (const c of chosen) {
    if (c.seenLine === -1) {
      console.error(`${c.id} has no Seen line to stamp.`);
      process.exit(1);
    }
    const gone = c.ids.filter((id) => !rows.has(id));
    if (gone.length) {
      console.error(`${c.id} rests on ${gone.join(', ')}, which no register defines. Fix its Rows first.`);
      process.exit(1);
    }
    lines[c.seenLine] = `- **Seen:** ${c.ids.map((id) => `${id} ${rows.get(id)}`).join(', ')}`;
  }
  writeFileSync(CASES, lines.join(eol));
  console.log(`Stamped ${chosen.map((c) => c.id).join(', ')}.`);
  process.exit(0);
}

const results = cases.map((c) => ({ ...c, ...status(c) }));
const due = results.filter((r) => r.state !== 'ok');
const summary = `${cases.length} cases · ${due.length} to judge again · ${awaiting} awaiting your answer`;

if (!args.includes('--summary')) {
  const word = { ok: 'ok', unstamped: 'never stamped', changed: 'row changed', gone: 'row gone' };
  for (const r of results) {
    const why = r.ids.length ? ` (${r.ids.join(', ')})` : '';
    console.log(`${r.id}  ${word[r.state].padEnd(13)} ${r.title}${why}`);
  }
  console.log('');
}
console.log(summary);
