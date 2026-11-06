#!/usr/bin/env node
// Finds lines in the record that read like a rule for everyone rather than a fact about her
// (card A-163): a system behaviour written where it surfaced, her record, instead of the
// harness, so no other copy ever gets it (seen 2 Nov 2026, six such rules). Also finds
// template text left unfilled in a day's log. Nothing is written to the record; a line the
// developer has looked at is marked reviewed by its fingerprint, never its words.
//
//   node ux/scripts/record-rules.mjs check [--json]   lines still to look at; exits 1 if any
//   node ux/scripts/record-rules.mjs review           mark every line found now as looked at
//
// --record <dir> reads another record folder instead of data/ (a test).

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REVIEWED = join(root, '.claude', 'record-rules-reviewed.json');

// A rule: says what to do, or how a reply, message or view should look.
const RULE = /\b(never|always|don't|do not|from now on|every time|whenever|each time|should|must|format|table|replies|reply|messages?|check-ins?|reminders?|layout)\b/i;
// Hers: her words in quotes, a date, a number with a unit, or the first person.
const HERS = /["“”]|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\b|\b\d+(\.\d+)? ?(kg|g|kcal|mg|ml|l|h|hours?|am|pm)\b|\b(I|I'm|my|me)\b/;
// Template text a day's log should have replaced.
const UNFILLED = /YYYY-MM-DD|Then, only once asked|<!-- unfilled:/;

const print = (line) => createHash('sha256').update(line.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

/** Whether a line reads like a rule for everyone and carries nothing of her. */
export function ruleLike(line) {
  const t = line.replace(/^[\s>*_|#-]+/, '').trim();
  if (t.length < 25 || /^\|?\s*-{3}/.test(t)) return false;
  return RULE.test(t) && !HERS.test(t);
}

// Where a rule would be written by mistake: her standing files, not the dated ones.
function standingFiles(record) {
  const out = [];
  const walk = (dir, depth) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < 2 && !['archive', 'journal', 'days', 'sessions', 'people', 'dev-chats', 'imports', 'assets', 'timeline'].includes(e.name)) walk(p, depth + 1);
      } else if (e.name.endsWith('.md') && !['log.md', 'timeline.md'].includes(e.name)) out.push(p);
    }
  };
  walk(record, 0);
  return out;
}

/** Lines to look at: rule-like lines in standing files, and unfilled template text in day logs. */
export function findings(record, reviewed = new Set()) {
  const found = [];
  for (const f of standingFiles(record)) {
    let fence = false;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.startsWith('```')) fence = !fence;
      if (fence || /^\s*_.*_\s*$/.test(line)) return; // a file's own italic note says what it holds
      if (ruleLike(line) && !reviewed.has(print(line))) found.push({ kind: 'rule', file: relative(record, f), line: i + 1, text: line.trim(), print: print(line) });
    });
  }
  const days = join(record, 'fitness', 'days');
  if (existsSync(days)) {
    for (const d of readdirSync(days).filter((x) => /^\d{4}-\d{2}-\d{2}\.md$/.test(x))) {
      readFileSync(join(days, d), 'utf8').split('\n').forEach((line, i) => {
        if (UNFILLED.test(line) && !reviewed.has(print(line))) found.push({ kind: 'unfilled', file: relative(record, join(days, d)), line: i + 1, text: line.trim(), print: print(line) });
      });
    }
  }
  return found;
}

export function readReviewed(path = REVIEWED) {
  try {
    return new Set(JSON.parse(readFileSync(path, 'utf8')).reviewed ?? []);
  } catch {
    return new Set();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ri = args.indexOf('--record');
  const record = ri >= 0 ? args[ri + 1] : join(root, 'data');
  const reviewed = readReviewed();
  const found = findings(record, reviewed);
  if (args[0] === 'review') {
    for (const f of found) reviewed.add(f.print);
    writeFileSync(REVIEWED, `${JSON.stringify({ _what: 'Fingerprints (sha256, first 16) of record lines the developer has looked at and kept as hers; never her words (card A-163).', reviewed: [...reviewed].sort() }, null, 2)}\n`);
    console.log(`record rules: ${found.length} marked reviewed`);
    process.exit(0);
  }
  if (args.includes('--json')) console.log(JSON.stringify(found, null, 2));
  else {
    for (const f of found) console.log(`${f.kind === 'rule' ? 'reads like a rule' : 'template text left'}: ${f.file}:${f.line}`);
    console.log(`record rules: ${found.length} line(s) to look at${found.length ? ': move each rule to the harness, or run review to keep them as hers' : ''}`);
  }
  process.exit(found.length ? 1 : 0);
}
