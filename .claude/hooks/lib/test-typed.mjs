// Rule test for lib/typed.mjs: the record of what the developer typed.
//
// Words count as typed only when the record holds their hash; the same words
// in another spelling (curly quotes, case, spacing, a composed accent) are the
// same words; an entry an agent wrote is not typed, and neither is a second
// entry carrying words he typed once; an `Approved:` quote counts only as part
// of an entry he typed. Run on a fixture folder, never this repository.
// Exits non-zero on any failure. Run by selftest.mjs.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENTRY_SINCE, TYPED_SINCE, isTyped, missingEntries, normalize, quoteIsTyped, recordTyped, sha, transcriptQuotes, typedEntries, typedFile, typedFiles, typedRows, TYPED_PART } from './typed.mjs';
import { makeTemp } from './temp-litter.mjs';

const root = makeTemp('dear-typed-');
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  const transcript = join(root, 'dev', 'dialogue', 'transcript');
  mkdirSync(transcript, { recursive: true });
  const day = TYPED_SINCE;
  const entry = (id, date, way, words, extra = '') => `\n### ${id} · ${date} · ${way}\n${words.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')}\n${extra}`;
  // What the hook does: the entry, then the record's line.
  const typed = ['Okay fix it. And make sure it all works', 'yes', 'Make the export\n\nfaster, please'];
  for (const words of typed) recordTyped(words, root);
  writeFileSync(
    join(transcript, `${day.slice(0, 7)}.md`),
    '# Transcript\n' +
      entry('T-001', day, '📋 task', typed[0], '- **Gist:** fix the approvals.\n> an agent quoting something below\n') +
      entry('T-002', day, '🤝 agreement', typed[1]) +
      entry('T-003', day, '💭 want', typed[2]) +
      entry('T-004', day, '🤝 agreement', 'yes, agreed to all of it') +
      entry('T-005', day, '🤝 agreement', 'yes') +
      entry('T-006', '2026-10-01', '🤝 agreement', 'an old yes, before the record'),
  );

  check('words he typed are typed', isTyped('Okay fix it. And make sure it all works', root));
  check('the same words spelt otherwise are the same words', isTyped('  OKAY  fix it.\nAnd make sure it all works ', root) && normalize('it’s “done”') === normalize('It\'s "done"'));
  check('a composed and a decomposed accent are the same words', normalize('café') === normalize('café'));
  check('words he never typed are not', !isTyped('yes, agreed to all of it', root));
  check('nothing is not typed', !isTyped('   ', root));

  const quotes = transcriptQuotes(root);
  check('an entry is the quoted lines straight under its heading', quotes.find((e) => e.id === 'T-001')?.quote === typed[0]);
  check('a message over several lines is read whole', quotes.find((e) => e.id === 'T-003')?.quote === typed[2]);

  const backed = typedEntries(root);
  check('an entry the hook wrote is backed', backed.has('T-001') && backed.has('T-002') && backed.has('T-003'));
  check('an entry an agent wrote is not', !backed.has('T-004'));
  check('a second entry with words he typed once is not', !backed.has('T-005'));
  check('an entry from before the record is not asked about', !backed.has('T-006'));

  check('a quote that is part of a typed entry passes', quoteIsTyped('okay fix it', root) && quoteIsTyped('Make the export faster', root));
  check('a quote never typed is refused', !quoteIsTyped('yes, agreed to all of it', root) && !quoteIsTyped('reword the row as I see fit', root));
  check('a quote an agent added under an entry is refused', !quoteIsTyped('an agent quoting something below', root));
  check('an empty quote is refused', !quoteIsTyped('', root));

  // Every typed message keeps an entry (A-047): a lost one is found, a marked one is not.
  {
    const d = ENTRY_SINCE;
    const at = (hh) => `${d}T${hh}:00:00.000Z`;
    const row = (hh, words) => ({ at: at(hh), sha: sha(words) });
    const ent = (id, words, date = d) => ({ id, date, way: '📋 task', quote: words });
    const later = Date.parse(at('10')) + 2 * 24 * 60 * 60 * 1000;
    const rows = [row('01', 'build the export'), row('02', 'yes'), row('03', 'lost to a race')];
    const ents = [ent('T-1', 'build the export'), ent('T-2', 'yes')];
    const lost = missingEntries(rows, ents, { now: later });
    check('a typed message with no entry is found, with its day and time', lost.length === 1 && lost[0].date === d && lost[0].at[0] === at('03'));
    check('a day with every message entered is clean', missingEntries(rows.slice(0, 2), ents, { now: later }).length === 0);
    check('words taken out under a mark cover the line they replaced', missingEntries(rows, [...ents, ent('T-3', 'lost to [moved to his record]')], { now: later }).length === 0
      && missingEntries(rows, [...ents, ent('T-3', 'ask [a name] about it')], { now: later }).length === 0);
    check('words changed with no mark do not cover it', missingEntries(rows, [...ents, ent('T-3', 'lost to a merge')], { now: later }).length === 1);
    {
      const late = { at: `${d}T16:30:00.000Z`, sha: sha('typed after his midnight') };
      const next = new Date(Date.parse(late.at) + 12 * 3600 * 1000).toISOString().slice(0, 10);
      check('a mark dated his own next day covers a line from after his midnight', missingEntries([late], [ent('T-4', '[moved to his record]', next)], { now: later + 86400000 }).length === 0);
      check('one mark covers one line, not two', missingEntries([late, { at: `${d}T16:40:00.000Z`, sha: sha('another late one') }], [ent('T-4', '[moved to his record]', next)], { now: later + 86400000 }).length === 1);
      const two = missingEntries([late, { at: `${d}T16:40:00.000Z`, sha: sha('another late one') }], [ent('T-4', '[moved to his record]', next)], { now: later + 86400000 });
      check('the line a mark was taken to cover is named too, since the mark cannot say which it replaced', two[0]?.or?.length === 1 && [...two[0].at, ...two[0].or].sort().join() === [late.at, `${d}T16:40:00.000Z`].sort().join());
      check('a day whose marks cover nothing names no other time', missingEntries(rows, ents, { now: later })[0].or === undefined);
    }
    check('a mark on another day does not cover it',missingEntries(rows, [...ents, ent('T-3', '[moved to his record]', '2099-01-01')], { now: later }).length === 1);
    check('a yes typed twice needs two entries', missingEntries([...rows.slice(0, 2), row('04', 'yes')], ents, { now: later }).length === 1);
    check('a line under a day old is left, its entry may be unstaged', missingEntries(rows, ents, { now: Date.parse(at('04')) }).length === 0);
    check('a line before the check began is left', missingEntries([{ at: '2026-10-01T00:00:00.000Z', sha: sha('old') }], [], { now: later }).length === 0);
    const kept = readFileSync(typedFile(root), 'utf8');
    writeFileSync(typedFile(root), `${JSON.stringify(rows[1])}\n<<<<<<< ours\n${JSON.stringify(rows[0])}\n`);
    const back = typedRows(root);
    check('the record reads back in order, skipping a merge leftover', back.length === 2 && back[0].at === at('01'));
    writeFileSync(typedFile(root), kept);
  }

  // T-768: the record keeps parts, each within one read: past the limit the next begins beside it.
  {
    const kept = readFileSync(typedFile(root), 'utf8');
    const held = kept.split('\n').filter((l) => l.trim()).length;
    const second = recordTyped('a message once the first part is full', root, new Date(), held);
    check('a full part begins the next beside it', second === typedFiles(root)[1] && typedFiles(root).length === 2 && /typed-2\.jsonl$/.test(second));
    check('and the next message goes on in it', recordTyped('and another after it', root, new Date(), held) === second && typedFiles(root).length === 2);
    check('every part is read as one record', isTyped('a message once the first part is full', root) && isTyped('Okay fix it. And make sure it all works', root) && typedRows(root).length === held + 2);
    check('the record and its parts are known by name, nothing beside them', TYPED_PART.test('dev/dialogue/typed.jsonl') && TYPED_PART.test('dev/dialogue/typed-2.jsonl') && TYPED_PART.test('dev/dialogue/typed-12.jsonl') && !TYPED_PART.test('dev/dialogue/typed-1.jsonl') && !TYPED_PART.test('dev/dialogue/typed-notes.jsonl'));
    rmSync(second);
  }

  rmSync(join(root, 'dev', 'dialogue', 'typed.jsonl'));
  check('with no record, nothing is typed', !isTyped('yes', root) && !quoteIsTyped('okay fix it', root) && typedEntries(root).size === 0);
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
