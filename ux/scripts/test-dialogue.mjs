#!/usr/bin/env node
// The dialogue checks (WKB-007 designs 9 and 10), each proven against an
// invented Transcript: a remark left unsorted past its day, or filed under a
// way that is none of the sixteen, fails `check`; one sorted, or unsorted
// today, passes; a register missing from trace.md, a row for one that is
// gone, a card cited that does not exist, or a row naming nothing without
// saying so, fails `trace`; and a card marked agreed with no 🤝 agreement
// entry on or after its own date fails the gate, as does one whose yes is not
// the developer's own message as typed (lib/typed.mjs), unless dated before
// the record began. `ask` lists every card and
// reads spec rows whole, by stem; a T or A number taken twice fails and is
// renumbered; an owner quote in a rationale that no card carries is a gap;
// and an agreed card no eval names fails unless it was agreed before the
// check began or says why it has none (T-230).

import assert from 'node:assert/strict';
import { cardFaults, readCards } from './evals.mjs';
import { TYPED_SINCE, recordTyped, transcriptQuotes, typedEntries } from '../../.claude/hooks/lib/typed.mjs';
import { ONE_READ, PART_LINES, lineCount, oversizeParts, partHeader, recut, sortParts } from '../../.claude/hooks/lib/transcript-parts.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DIALOGUE_DIR, METHOD_LOG, methodCheckDue, EVAL_OWED, CHECKED_SINCE, TOPICS, TOPICS_SINCE, WAYS, renderIndex, indexStale, writeIndex, wayPage, REVIEW_EVERY, clashFaults, droppedByMerges, mergeLosses, lessonFaults, reviewDue, weeklyGroup, digestsOwed, agreementFaults, wordingFaults, evalGaps, mergedCitations, renderAgreements, renderAgreementParts, writeAgreements, agreementsStale, specCarried, ask, keptQuestions, cardEntries, standingCards, coverageGaps, evalsFor, gateHolds, statusLines, unproven, growth, idFaults, quoteGaps, mergeTranscript, movedReferences, readTranscript, recordMoves, renumber, renumberedPairs, resolveConflicts, rebuildAfterMerge, setMergeDriver, stageDuringMerge, specRegisters, specRows, stem, traceFaults, transcriptFaults, duplicateRemarks, DUPLICATES_SINCE } from './dialogue.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { keptAgain } from './dialogue-views.mjs';

const dir = makeTemp('dear-dialogue-test-');
const entry = (id, date, way, extra = '') => `### ${id} · ${date} · ${way}\n> words\n${extra}`;
const faultsOf = (text, today = '2026-10-20') => {
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${text}`);
  return transcriptFaults(readTranscript(dir), today);
};

try {
  // Sorting: the recording hook files every remark as ❔ unsorted, and the agent sorts it the same day.
  assert.deepEqual(faultsOf(entry('T-001', '2026-10-20', '❔ unsorted')), [], 'unsorted today passes');
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '❔ unsorted')).length, 1, 'unsorted from yesterday fails');
  assert.deepEqual(faultsOf(entry('T-001', '2026-10-19', '💭 want')), [], 'sorted passes');
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '🌀 musing')).length, 1, 'a way none of the sixteen fails');
  // A-070: every other way a remark carries, and every topic it touches.
  assert.deepEqual(faultsOf(entry('T-001', '2026-10-19', '🤞 promise')), [], 'a promise is one of the sixteen ways');
  assert.deepEqual(faultsOf(entry('T-001', TOPICS_SINCE, '💭 want', '- **Also:** 💗 feeling · 🧐 judgement\n- **Topics:** dialogue · checks\n'), TOPICS_SINCE), [], 'other ways and topics from the lists pass');
  assert.equal(faultsOf(entry('T-001', TOPICS_SINCE, '💭 want'), TOPICS_SINCE).length, 1, 'a sorted remark with no topic fails from the day topics began');
  assert.deepEqual(faultsOf(entry('T-001', '2026-10-19', '💭 want')), [], 'an older remark with no topic is counted, not refused');
  assert.deepEqual(faultsOf(entry('T-001', TOPICS_SINCE, '❔ unsorted'), TOPICS_SINCE), [], 'an unsorted remark needs no topic until it is sorted');
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '💭 want', '- **Topics:** gossip\n')).length, 1, 'a topic not in the list fails');
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '💭 want', '- **Also:** 🌀 musing\n')).length, 1, 'another way not in the list fails');
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '💭 want', '- **Also:** 💭 want\n')).length, 1, "an Also line repeating the heading's way fails");
  {
    writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${entry('T-001', '2026-10-19', '💭 want', '- **Also:** 😟 worry\n- **Topics:** safety · checks\n')}\n${entry('T-002', '2026-10-20', '❓ question', '- **Topics:** safety\n')}\n${entry('T-003', '2026-10-20', '❔ unsorted')}`);
    const parsed = readTranscript(dir);
    const pages = renderIndex(parsed);
    assert.equal(Object.keys(pages).length, WAYS.length + Object.keys(TOPICS).length + 1, 'one page per way, one per topic, and a README, empty or not');
    assert.ok(pages[wayPage('😟 worry')].includes('**T-001**') && pages[wayPage('💭 want')].includes('**T-001**'), 'a remark carrying two ways is on both pages');
    assert.ok(pages['topic-checks.md'].includes('**T-001**') && pages['topic-safety.md'].includes('**T-001**'), 'a remark touching two topics is on both pages');
    assert.ok(pages['topic-safety.md'].indexOf('**T-002**') < pages['topic-safety.md'].indexOf('**T-001**'), 'newest first');
    assert.ok(pages['topic-safety.md'].includes('> words'), 'each line carries his own words');
    assert.ok(!Object.values(pages).some((t) => t.includes('**T-003**')), 'an unsorted remark is on no page until sorted');
    assert.ok(pages['README.md'].includes('[😟 worry](way-worry.md) · 1'), 'the README counts each page');
    const out = join(dir, 'index');
    writeIndex(parsed, out);
    assert.deepEqual(indexStale(parsed, out), [], 'pages just written match');
    writeFileSync(join(out, 'topic-safety.md'), 'edited by hand');
    writeFileSync(join(out, 'topic-gone.md'), 'left over');
    assert.deepEqual(indexStale(parsed, out).sort(), ['topic-gone.md', 'topic-safety.md'], 'a page edited by hand, or one no longer generated, is stale');
  }
  // The real tree's, only where it has one: a copy made for someone else has no dev/ (ARC-008), and these two
  // and the method log below refused its first commit (first commit test, 2026-11-01).
  const REAL = existsSync(join(DIALOGUE_DIR, 'transcript'));
  if (REAL) assert.deepEqual(indexStale(readTranscript()), [], 'the real pages match the real Transcript');
  if (REAL) assert.deepEqual(readTranscript().filter((e) => e.way !== '❔ unsorted' && e.date >= TOPICS_SINCE && !e.topics?.length).map((e) => e.id), [], 'every sorted remark in the real Transcript from the day topics began carries one');

  // A-153: the weekly recheck of the method, due by its own log, carried by the daily loop.
  {
    const log = '# Log\n\n- 2026-10-29 · the first grounding · [a](a.md)\n- 2026-11-02 · nothing new · [b](b.md)\n';
    assert.equal(methodCheckDue(log, '2026-11-08').due, false, 'six days after the last run, not yet due');
    assert.equal(methodCheckDue(log, '2026-11-09').due, true, 'seven days after, due');
    assert.equal(methodCheckDue(log, '2026-11-09').last, '2026-11-02', 'the newest run is read, not the first');
    assert.equal(methodCheckDue('', '2026-11-01').due, true, 'never run is due');
    assert.ok(statusLines([], { today: '2026-11-09', method: { due: true, last: '2026-11-02' } })[0].includes('method recheck due'), 'a recheck due is said in the opening line');
    if (REAL) {
      const job = readFileSync(join(DIALOGUE_DIR, '..', '..', '.claude', 'jobs', 'dialogue-loop.md'), 'utf8');
      assert.ok(/The method, weekly\*\* \(A-153/.test(job) && job.includes('method-checks.md'), 'the daily loop carries the weekly method step and writes its log');
      assert.ok(existsSync(METHOD_LOG), 'the method log exists');
    }
  }

  // Two remarks under one heading: a parallel chat's merge dropped the second heading (2026-10-26).
  assert.equal(faultsOf(entry('T-001', '2026-10-19', '💭 want', '- **Gist:** one.\n> a second remark\n')).length, 1, 'a remark below the Gist fails');
  assert.deepEqual(faultsOf(entry('T-001', '2026-10-19', '💭 want', '> more of the same remark\n- **Gist:** one.\n')), [], 'a remark of several lines passes');

  // The gate on agreements: a card is agreed only after a 🤝 entry records the owner's yes.
  const card = (status) => `- **Card A-001** · status: ${status} · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** keep it.\n  - **Failed if:** it went.\n`;
  const gateOf = (text) => {
    writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${text}`);
    return agreementFaults(readTranscript(dir));
  };
  assert.equal(gateOf(entry('T-001', '2026-10-19', '💭 want', card('agreed'))).length, 1, 'agreed with no yes anywhere fails');
  assert.equal(gateOf(entry('T-001', '2026-10-19', '🤝 agreement', '') + entry('T-002', '2026-10-20', '💭 want', card('agreed'))).length, 1, 'a yes dated before the card does not count');
  assert.deepEqual(gateOf(entry('T-001', '2026-10-19', '💭 want', card('agreed')) + entry('T-002', '2026-10-19', '🤝 agreement')), [], 'a yes the same day passes');
  assert.deepEqual(gateOf(entry('T-001', '2026-10-19', '🤝 agreement', card('agreed'))), [], 'a card on its own agreement entry passes');
  assert.deepEqual(gateOf(entry('T-001', '2026-10-19', '💭 want', card('drafted'))), [], 'a drafted card needs no yes');
  assert.equal(gateOf(entry('T-001', '2026-10-19', '🤝 agreement', card('agred'))).length, 1, 'a misspelt status fails');

  // The yes is his own message as typed (lib/typed.mjs), not an entry an agent wrote.
  // Run on a fixture repository: the hook's entry and record line, then a forged entry.
  const repo = join(dir, 'repo');
  const tdir = join(repo, 'dev', 'dialogue', 'transcript');
  mkdirSync(tdir, { recursive: true });
  const since = TYPED_SINCE;
  const typedGate = (text) => {
    writeFileSync(join(tdir, `${since.slice(0, 7)}.md`), `# Transcript\n\n${text}`);
    const backed = typedEntries(repo);
    return agreementFaults(readTranscript(tdir), (e) => backed.has(e.id));
  };
  const said = (id, date, way, words, extra = '') => `### ${id} · ${date} · ${way}\n> ${words}\n${extra}`;
  recordTyped('yes, card it as written', repo);
  assert.deepEqual(typedGate(said('T-001', since, '💭 want', 'keep it', card('agreed')) + said('T-002', since, '🤝 agreement', 'yes, card it as written')), [], 'a yes he typed passes');
  const forged = typedGate(said('T-001', since, '💭 want', 'keep it', card('agreed')) + said('T-002', since, '🤝 agreement', 'yes, agreed'));
  assert.ok(forged.length === 1 && forged[0].includes('as he typed it'), 'a yes an agent wrote fails');
  const next = new Date(Date.parse(since) + 864e5).toISOString().slice(0, 10);
  const copied = typedGate(said('T-001', since, '🤝 agreement', 'yes, card it as written') + said('T-002', next, '💭 want', 'keep it', card('agreed')) + said('T-003', next, '🤝 agreement', 'yes, card it as written'));
  assert.equal(copied.length, 1, 'a second entry copying words he typed once does not count as a second yes');
  // Grandfathered: entries dated before TYPED_SINCE predate the record, so no line stands behind them.
  assert.deepEqual(typedGate(said('T-001', '2026-10-19', '💭 want', 'keep it', card('agreed')) + said('T-002', '2026-10-19', '🤝 agreement', 'yes, agreed')), [], 'a yes from before the record is exempt');
  assert.ok(since > '2026-10-19', 'the exemption ends: the record begins after the day above');

  // Trace: every register has a row, every row a register, every card cited exists.
  const specs = join(dir, 'specs');
  mkdirSync(join(specs, 'system'), { recursive: true });
  writeFileSync(join(specs, 'README.md'), '# Specifications\n');
  writeFileSync(join(specs, 'REFERENCES.md'), '# References [REF]\n');
  writeFileSync(join(specs, 'system', 'dev.md'), '# Development [DEV]\n');
  writeFileSync(join(specs, 'system', 'tabs.md'), '# Tabs [TAB]\n');
  const registers = specRegisters(specs);
  assert.deepEqual(registers.map((r) => r.prefix), ['DEV', 'TAB'], 'registers are titled files, not the index or the sources');
  const row = (p, serves) => `| \`${p}\` | [x](x) | ${serves} | note |`;
  const none = '— (no agreement yet: draft one)';
  const good = [row('DEV', 'A-001, A-002'), row('TAB', none)].join('\n');
  assert.deepEqual(traceFaults(good, registers, ['A-001', 'A-002']), [], 'a full trace passes');
  assert.equal(traceFaults(row('DEV', 'A-001'), registers, ['A-001']).length, 1, 'a register with no row fails');
  assert.equal(traceFaults(`${good}\n${row('OLD', 'A-001')}`, registers, ['A-001', 'A-002']).length, 1, 'a row for a register that is gone fails');
  assert.equal(traceFaults(good, registers, ['A-001']).length, 1, 'a card cited that does not exist fails');
  assert.equal(traceFaults([row('DEV', 'A-001'), row('TAB', '')].join('\n'), registers, ['A-001']).length, 1, 'a row naming nothing, and not saying so, fails');
  const desk = '**2026-10-03 · Format before graph.** chosen.\n\n**2026-10-04 · One root.** chosen.\n';
  assert.deepEqual(coverageGaps(desk, '- **Became:** spec-graph desk: Format before graph.').missing, ['One root.'], 'a titled decision no entry names is listed');
  assert.deepEqual(coverageGaps(desk, 'Format before graph. One root.').missing, [], 'a titled desk fully imported passes');
  assert.deepEqual(coverageGaps('D1 · a\nD2 · b', '- **Became:** D1').missing, ['D2'], 'a numbered decision no entry names is listed');
  // One remark may carry several cards; each is read, with the remark's words.
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${entry('T-001', '2026-10-19', '💭 want', '- **Card A-001** · status: drafted\n  - **Says:** one\n- **Card A-002** · status: drafted\n  - **Says:** two\n  - **Why:** because')}`);
  const many = cardEntries(readTranscript(dir));
  assert.deepEqual(many.map((e) => [e.id, e.card.id, e.card.says]), [['T-001', 'A-001', 'one'], ['T-001', 'A-002', 'two']], 'every card a remark carries is read');
  assert.equal(many[1].card.why, 'because', "a card's reason is kept");
  assert.ok(agreementFaults(readTranscript(dir)).some((f) => f.includes('no emoji')), 'a card with no emoji fails');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${entry('T-001', '2026-10-19', '💭 want', '- **Card A-001** · status: drafted · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** one')}`);
  assert.deepEqual(agreementFaults(readTranscript(dir)), [], 'a card with an emoji and a place passes');
  assert.equal(cardEntries(readTranscript(dir))[0].card.group, '1 Test', "a card's group is read");
  assert.equal(cardEntries(readTranscript(dir))[0].card.emoji, '🎯', "a card's emoji is read");
  const merge = (into) => `# Transcript\n\n${entry('T-001', '2026-10-19', '🤝 agreement', `- **Card A-001** · status: merged · into: ${into} · emoji: 🎯\n  - **Says:** old\n- **Card A-002** · status: agreed · emoji: 🧩 · group: 1 Test · order: 1\n  - **Says:** new`)}`;
  writeFileSync(join(dir, '2026-10.md'), merge('A-002'));
  assert.deepEqual(agreementFaults(readTranscript(dir)), [], 'a card merged into a standing card passes');
  assert.deepEqual(standingCards(readTranscript(dir)).map((e) => e.card.id), ['A-002'], 'a merged card no longer stands');
  // A merged card still cited where a standing one binds (T-330, 2026-10-28: an open backlog line named A-020 after its merge into A-098).
  const mergedEntries = readTranscript(dir);
  assert.equal(mergedCitations([{ label: 'trace.md', text: '| `DEV` | x | A-001 | note |', lines: true }], mergedEntries).length, 1, 'a merged card cited in trace.md is found');
  assert.ok(mergedCitations([{ label: 'trace.md', text: 'x\nA-001 here', lines: true }], mergedEntries)[0].includes('line 2'), 'the hit names its line');
  assert.deepEqual(mergedCitations([{ label: 'row', text: 'serves A-001, merged into A-002' }, { label: 'row', text: 'serves A-002' }], mergedEntries), [], 'a pointer naming the kept card, and the kept card itself, pass');
  writeFileSync(join(dir, '2026-10.md'), merge('A-009'));
  assert.equal(agreementFaults(readTranscript(dir)).length, 1, 'a card merged into nothing that stands fails');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${entry('T-001', '2026-10-19', '🤝 agreement', '- **Card A-001** · status: agreed · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** one')}\n${entry('T-002', '2026-10-19', '🤝 agreement', '- **Card A-001** · status: agreed · emoji: 🧩 · group: 1 Test · order: 2\n  - **Says:** two')}`);
  assert.ok(agreementFaults(readTranscript(dir)).some((f) => f.includes('used twice')), 'a card id used twice fails');
  const cards = [{ id: 'E-001', title: 'a', why: ['A-001', 'safe'] }, { id: 'E-002', title: 'b', why: ['A-002'] }];
  const history = [{ kind: 'card', card: 'E-001', verdict: 'fail', date: '2026-10-01' }, { kind: 'card', card: 'E-001', verdict: 'pass', date: '2026-10-02' }];
  const found = evalsFor(['A-001'], cards, history);
  assert.deepEqual(found.map((v) => [v.id, v.run.verdict]), [['E-001', 'pass']], 'an agreement finds the eval guarding it, with its latest run');
  assert.equal(evalsFor(['A-002'], cards, history)[0].run, null, 'an eval never run says so');
  // Stems by rule, no synonym list: forms of one word meet, two words do not (T-173).
  assert.deepEqual(['skills', 'healing', 'practices', 'practice', 'evolving', 'evolve', 'agreements', 'agree', 'policies', 'stopped'].map(stem), ['skill', 'heal', 'practic', 'practic', 'evolv', 'evolv', 'agre', 'agre', 'policy', 'stop'], 'word forms share a stem');
  assert.notEqual(stem('heartbeat'), stem('heal'), 'two words keep two stems');

  // ask lists every standing card, matched or not, and reads a spec row's whole text.
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n${entry('T-001', '2026-10-19', '🤝 agreement', '- **Card A-001** · status: agreed · emoji: 💓\n  - **Says:** No heartbeats for upkeep.\n  - **Failed if:** a timer runs it.\n- **Card A-002** · status: drafted · emoji: 🎯\n  - **Says:** Talk only.')}`);
  writeFileSync(join(specs, 'system', 'dev.md'), '# Development [DEV]\n\n## **DEV-001 • 🧠**\n\n> ### **(§) SPEC STATEMENT —**\n>\n> **Routines stay current** – x.\n\n### **(∵) SPEC RATIONALE —**\n\nThe developer asked for *"every procedure heals itself when used"*.\n');
  const rows = specRows(specs);
  assert.deepEqual(rows.map((r) => [r.id, r.statement]), [['DEV-001', 'Routines stay current']], 'a row is read with its statement');
  const asked = ask('self-healing skills', readTranscript(dir), rows);
  assert.deepEqual([...asked.agreed, ...asked.rest.map((e) => ({ e }))].map((x) => x.e.card.id).sort(), ['A-001', 'A-002'], 'every standing card is listed, whatever the words');
  assert.deepEqual(asked.specs.map((x) => x.id), [], 'one shared stem is not enough for a spec');
  assert.deepEqual(ask('procedures healing', readTranscript(dir), rows).specs.map((x) => x.id), ['DEV-001'], 'a row is found by words only its rationale holds, by stem');
  // E-094 (2026-10-30): a question he keeps asking is recognised as asked before, from the README's table (A-053).
  const kept = keptQuestions('# x\n\n## Your questions\n\n| Question | First asked |\n|---|---|\n| ❓ Do we need this? | T-170 |\n| 🧩 Does anything overlap, or can it be combined? | T-146 |\n\n## Next\n| not | T-999 |\n');
  assert.deepEqual(kept.map((k) => k.first), ['T-170', 'T-146'], 'the kept questions are read from their own section only');
  assert.deepEqual(ask('do we actually need this?', readTranscript(dir), rows, kept).again.map((k) => k.first), ['T-170'], 'a question asked in other words is known as one he keeps asking');
  assert.deepEqual(ask('can these two be combined, do they overlap', readTranscript(dir), rows, kept).again.map((k) => k.first), ['T-146'], 'two shared words of a longer kept question are enough');
  assert.deepEqual(ask('self-healing skills', readTranscript(dir), rows, kept).again, [], 'an unrelated ask names no kept question');
  // The misfires of 2-3 Nov: one shared word, or two common ones, across a whole message.
  const hard = keptQuestions('## Your questions\n\n| Question | First asked |\n|---|---|\n| ❓ Do we need this? | T-170 |\n| 🧱 Is anything hard-coded that should be reasoned? | T-164 |\n');
  assert.deepEqual(keptAgain('Does it apply throughout across all chats already? Or do u need to restart chats?', hard), [], 'a word of a kept question in a longer question is not that question');
  assert.deepEqual(keptAgain('Do you think this is robust enough, or is there any gaps, any edge cases? And also, is everything optimized, or is there anything that should be better off, any redundancies, any duplication, etc.?', hard), [], 'two common words of a longer kept question are not enough');
  assert.deepEqual(keptAgain('Should anything change?', hard), [], 'a short question sharing two common words of a longer kept one is not it');
  assert.deepEqual(keptAgain('That makes sense. Do we actually need this?', hard).map((k) => k.first), ['T-170'], 'the kept question in one sentence of a longer message is still found');
  assert.deepEqual(keptAgain('Is anything here hard-coded when it should be reasoned instead?', hard).map((k) => k.first), ['T-164'], 'a longer kept question in other words is still found');
  // E-126 (2026-11-05): a kept question of two sentences, asked again as written.
  const two = keptQuestions('## Your questions\n\n| Question | First asked |\n|---|---|\n| ❓ Do we need this? | T-170 |\n| ⚖️ Does anything conflict? What needs clarifying? | T-143 |\n| 🧹 Is it too specific? What could be removed? | T-202 |\n');
  assert.deepEqual(keptAgain('Fine. Is it too specific? What could be removed?', two).map((k) => k.first), ['T-202'], 'a kept question of two sentences is found across both');
  assert.equal(keptAgain('Ok. Does anything conflict? What needs clarifying?', two)[0]?.first, 'T-143', 'the fullest match is named first, not a shorter one sharing a word');

  // A quote of the owner in a rationale that no card carries is a gap; carried, it is not.
  assert.equal(quoteGaps(rows, readTranscript(dir)).length, 1, 'an owner quote no card carries is a gap');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n### T-001 · 2026-10-13 · 💭 want\n> every procedure heals itself when used\n- **Card A-001** · status: drafted · emoji: 🩹\n  - **Says:** heal.\n`);
  assert.deepEqual(quoteGaps(rows, readTranscript(dir)), [], 'a quote carried by a card is no gap');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n### T-001 · 2026-10-13 · 💭 want\n> every procedure heals itself when used\n\n### T-002 · 2026-10-14 · 🤝 agreement\n> yes\n- **Card A-001** · status: drafted · emoji: 🩹\n  - **Says:** heal.\n  - **Why:** "every procedure heals itself when used" (T-001)\n`);
  assert.deepEqual(quoteGaps(rows, readTranscript(dir)), [], 'a quote a card\'s Why carries from another remark is no gap');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n### T-001 · 2026-10-13 · 💭 want\n> every procedure heals itself when used\n\n### T-002 · 2026-10-14 · 🤝 agreement\n> yes\n- **Card A-001** · status: drafted · emoji: 🩹\n  - **Says:** heal.\n  - **Why:** "something else" (T-001)\n`);
  assert.equal(quoteGaps(rows, readTranscript(dir)).length, 1, 'but a remark with no card, its words in no card, is still a gap');
  writeFileSync(join(dir, '2026-10.md'), `# Transcript\n\n### T-001 · 2026-10-13 · 💭 want\n> something else entirely\n\n### T-002 · 2026-10-14 · 🤝 agreement\n> yes\n- **Card A-001** · status: drafted · emoji: 🩹\n  - **Says:** heal.\n  - **Why:** "every procedure heals itself when used" (T-001)\n`);
  assert.equal(quoteGaps(rows, readTranscript(dir)).length, 1, 'a Why quoting words no remark holds carries nothing');

  // Two chats each took the same number: check fails it; renumber gives the later one, or the one not on main, a fresh number.
  const twice = `# Transcript\n\n${entry('T-007', '2026-10-26', '💭 want', '- **Card A-003** · status: drafted · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** mine\n')}\n${entry('T-007', '2026-10-26', '❔ unsorted')}\n${entry('T-008', '2026-10-26', '❓ question', '- **Card A-003** · status: drafted · emoji: 🧩 · group: 1 Test · order: 1\n  - **Says:** theirs\n')}`;
  writeFileSync(join(dir, '2026-10.md'), twice);
  assert.equal(idFaults(readTranscript(dir)).length, 1, 'a T number naming two remarks fails');
  const fixed = renumber({ '2026-10.md': twice });
  writeFileSync(join(dir, '2026-10.md'), fixed.files['2026-10.md']);
  assert.deepEqual(readTranscript(dir).map((e) => e.id), ['T-007', 'T-009', 'T-008'], 'the later remark takes the next free number');
  assert.deepEqual(cardEntries(readTranscript(dir)).map((e) => e.card.id), ['A-003', 'A-004'], 'the later card takes the next free number');
  assert.deepEqual([...idFaults(readTranscript(dir)), ...agreementFaults(readTranscript(dir))], [], 'renumbered, nothing repeats');
  assert.equal(fixed.files['2026-10.md'].replace(/T-009/, 'T-007').replace(/A-004/, 'A-003'), twice, 'only the numbers change, every word stays');
  const onMain = `### T-007 · 2026-10-26 · ❔ unsorted\n> words`;
  assert.deepEqual(renumber({ '2026-10.md': twice }, onMain).moved.map((m) => m.split(' (')[0]), ['T-007 → T-009', 'A-003 → A-004'], 'the one already on main keeps its number');
  assert.ok(renumber({ '2026-10.md': twice }, onMain).files['2026-10.md'].startsWith('# Transcript\n\n### T-009 · 2026-10-26 · 💭 want'), 'the one not on main moves');
  // A card this chat merged into its own card follows it to the fresh number; the other chat's pointer stays.
  const merges = `# Transcript\n\n${entry('T-001', '2026-10-20', '💭 want', '- **Card A-001** · status: merged · into: A-003 · emoji: 🪞\n  - **Says:** old mine\n')}\n${entry('T-002', '2026-10-20', '💭 want', '- **Card A-002** · status: merged · into: A-003 · emoji: 🧩\n  - **Says:** old theirs\n')}\n${entry('T-003', '2026-10-26', '🤝 agreement', '- **Card A-003** · status: agreed · emoji: 🪞 · group: 1 Test · order: 1\n  - **Says:** mine\n')}\n${entry('T-004', '2026-10-26', '🤝 agreement', '- **Card A-003** · status: agreed · emoji: 🧩 · group: 1 Test · order: 2\n  - **Says:** theirs\n')}`;
  const theirsOnMain = '- **Card A-002** · status: merged · into: A-003 · emoji: 🧩\n' + '### T-004 · 2026-10-26 · 🤝 agreement\n> words\n- **Card A-003** · status: agreed · emoji: 🧩 · group: 1 Test · order: 2\n  - **Says:** theirs';
  const settled = renumber({ '2026-10.md': merges }, theirsOnMain).files['2026-10.md'];
  assert.ok(settled.includes('- **Card A-001** · status: merged · into: A-004 · emoji: 🪞'), 'this chat\'s merged card follows its card to the fresh number');
  assert.ok(settled.includes('- **Card A-002** · status: merged · into: A-003 · emoji: 🧩'), 'the other chat\'s pointer is left as main has it');
  assert.equal(renumber({ '2026-10.md': merges }).files['2026-10.md'].match(/into: A-003/g).length, 2, 'with nothing known of main, no pointer is guessed at');

  // An agreed card binds every agent, so one no eval names cannot pass quietly (T-230).
  const bound = (extra = '') => `# Transcript\n\n${entry('T-001', '2026-10-27', '🤝 agreement', `- **Card A-001** · status: agreed · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** one\n  - **Failed if:** it went.\n${extra}- **Card A-002** · status: agreed · emoji: 🧩 · group: 1 Test · order: 2\n  - **Says:** two\n- **Card A-003** · status: drafted · emoji: 🪞 · group: 1 Test · order: 3\n  - **Says:** three\n`)}`;
  writeFileSync(join(dir, '2026-10.md'), bound());
  const evals = [{ id: 'E-001', why: ['A-002', 'safe'] }];
  let gap = evalGaps(readTranscript(dir), evals, new Set(['A-002']), new Set());
  assert.deepEqual(gap.noEval, ['A-001'], 'an agreed card no eval names is listed; a drafted one is not');
  assert.equal(gap.faults.length, 1, 'a card agreed after the check began, with no eval, fails');
  assert.ok(gap.faults[0].startsWith('A-001'), 'the fault names the card');
  assert.deepEqual(gap.noSpec, ['A-001'], 'an agreed card no spec cites is listed');
  gap = evalGaps(readTranscript(dir), evals, new Set(), new Set(['A-001']));
  assert.deepEqual([gap.noEval, gap.faults], [['A-001'], []], 'a card agreed before the check began is reported, not refused');
  assert.deepEqual(evalGaps(readTranscript(dir), [...evals, { id: 'E-002', why: ['A-001', 'safe'] }], new Set(), new Set()), { noEval: [], notRunning: [], noSpec: ['A-001', 'A-002'], faults: [] }, 'an eval naming the card clears it');
  // T-273: an eval counts only when it can run; one written but blocked is listed apart, never refused.
  const blockedOnly = evalGaps(readTranscript(dir), [...evals, { id: 'E-002', why: ['A-001', 'safe'], status: 'not-runnable-yet', blocked_by: 'needs a real person' }], new Set(), new Set());
  assert.deepEqual([blockedOnly.noEval, blockedOnly.notRunning, blockedOnly.faults], [[], ['A-001'], []], 'a card named only by an eval that cannot run is "eval written, not running", reported and not refused');
  const alsoRunning = evalGaps(readTranscript(dir), [...evals, { id: 'E-002', why: ['A-001', 'safe'], status: 'not-runnable-yet' }, { id: 'E-003', why: ['A-001', 'safe'], status: 'runnable' }], new Set(), new Set());
  assert.deepEqual(alsoRunning.notRunning, [], 'one runnable eval naming the card is enough');
  writeFileSync(join(dir, '2026-10.md'), bound('  - **Eval:** none, because it is a ruling on who decides, with nothing a run could show\n'));
  assert.deepEqual(evalGaps(readTranscript(dir), evals, new Set(), new Set()).faults, [], 'a card saying why it has no eval passes');
  assert.ok(Object.values(renderAgreementParts(readTranscript(dir))).join('\n').includes('> *Eval:* none, because it is a ruling'), "the reason for no eval is shown on the card");
  writeFileSync(join(dir, '2026-10.md'), bound('  - **Eval:** later\n'));
  assert.equal(evalGaps(readTranscript(dir), evals, new Set(), new Set()).faults.length, 2, 'an eval line with no reason fails, and does not excuse the card');
  assert.ok([...specCarried([{ text: 'serves A-001 and A-010' }], '| `DEV` | x | A-002 |')].sort().join() === 'A-001,A-002,A-010', 'a card cited by a spec row or trace.md counts as carried');

  // The query that missed on 2026-10-26 (T-173), against this repository's own Transcript and specs.
  if (existsSync(join(DIALOGUE_DIR, 'transcript'))) {
    const real = ask('skills self-healing self-evolving best practice', readTranscript());
    assert.ok([...real.agreed.map((x) => x.e), ...real.rest].some((e) => e.card.id === 'A-015'), 'ask lists A-015, no heartbeats for skill upkeep');
    assert.ok(real.specs.some((s) => s.id.startsWith('PMM-')), 'ask finds the procedural memory (skill) rows');
    const owedNow = evalGaps(readTranscript(), readCards(), specCarried());
    assert.deepEqual(owedNow.faults, [], 'every card agreed since the check began has an eval, or says why not');
    assert.ok(owedNow.noEval.every((id) => EVAL_OWED.has(id)), 'only cards agreed before the check began may lack an eval');
  }

  const log = (sha, subject, body, files) => `\x1e${sha}\t${subject}\n${body}\x1f\n${files.join('\n')}\n`;
  const gl = [
    log('a1', 'feat(x): a skill she uses', 'no yes here', ['.claude/skills/x/SKILL.md']),
    log('b2', 'feat(x): approved', 'Approved: "yes"', ['CLAUDE.md']),
    log('c3', 'feat(x): from a card', 'Builds A-001.', ['modules/m/SKILL.md']),
    log('d4', 'record: update timeline', '', ['data/core/timeline.md']),
    log('e5', 'fix(dev): a dev script', '', ['ux/scripts/x.mjs']),
  ].join('');
  assert.deepEqual(gateHolds(gl, new Set(['A-001'])).map((h) => h.sha), ['a1'], 'only the noticed change with no yes and no agreed card is held');
  const late = statusLines([], { today: '2026-01-10', history: [{ kind: 'run', scope: 'all', verdict: 'pass', date: '2026-01-05T00:00:00Z' }] });
  assert.ok(late.some((l) => l.startsWith('⏰')), 'a loop five days late is called out, with the catch-up');
  const fresh = statusLines([], { today: '2026-01-10', history: [{ kind: 'run', scope: 'all', verdict: 'pass', date: '2026-01-10T01:00:00Z' }] });
  assert.ok(!fresh.some((l) => l.startsWith('⏰')), 'a loop run today is not');
  const ents = [{ id: 'T-1', date: '2026-01-01', way: '💭 want', cards: [{ id: 'A-001', status: 'agreed' }] }, { id: 'T-2', date: '2026-01-01', way: '💭 want', cards: [{ id: 'A-002', status: 'agreed' }] }, { id: 'T-3', date: '2026-01-01', way: '💭 want', cards: [{ id: 'A-003', status: 'drafted' }] }];
  const ecards = [{ id: 'E-001', why: ['A-001'] }, { id: 'E-002', why: ['A-002'] }];
  const hist = [{ kind: 'card', card: 'E-001', verdict: 'pass', date: '2026-01-02' }, { kind: 'card', card: 'E-002', verdict: 'fail', date: '2026-01-02' }];
  assert.deepEqual(unproven(ents, ecards, hist), ['A-002'], 'an agreed card whose eval fails is unproven; a passing one is built; a drafted one is not yet owed');
  // Every check naming it (T-840, the owner: "Yes, do both"): one passing card no longer proves an
  // agreement another card naming it fails or never ran.
  const both = [{ id: 'E-001', why: ['A-001'] }, { id: 'E-003', why: ['A-001'] }, { id: 'E-002', why: ['A-002'] }, { id: 'E-004', why: ['A-002'] }];
  const passFail = [...hist, { kind: 'card', card: 'E-003', verdict: 'fail', date: '2026-01-02' }, { kind: 'card', card: 'E-002', verdict: 'pass', date: '2026-01-03' }, { kind: 'card', card: 'E-004', verdict: 'pass', date: '2026-01-03' }];
  assert.deepEqual(unproven(ents, both, passFail), ['A-001'], 'one card naming an agreement passing and another failing leaves it unproven; all passing proves it');
  assert.deepEqual(unproven(ents, both, [...passFail, { kind: 'card', card: 'E-003', verdict: 'pass', date: '2026-01-04' }]), [], 'every card naming each agreement passing proves them all');
  assert.deepEqual(unproven(ents, [...ecards, { id: 'E-005', why: ['A-001'] }], hist), ['A-001', 'A-002'], 'a card naming it that never ran counts as not passed');
  assert.deepEqual(unproven(ents, [...ecards, { id: 'E-006', why: ['A-001'], status: 'not-runnable-yet' }], hist), ['A-002'], 'a card written, not running, neither proves nor holds it back');
  assert.equal(growth(ents)[0].agreed, 2, 'growth counts the agreed cards');
  // Two chats append to one month at once, each taking the next T and A number
  // (2026-10-27: settled by hand more than ten times in one chat). The merge keeps
  // main's side whole, adds this chat's entries after it, and moves only the
  // numbers that clash, with this chat's own references to them.
  const T1 = (way, more = '') => `### T-001 · 2026-10-26 · ${way}\n> first words\n${more}`;
  const cardOf = (id, says) => `- **Card ${id}** · status: drafted · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** ${says}\n  - **Failed if:** it went.\n`;
  const mBase = `# Transcript\n\n${T1('❔ unsorted')}`;
  const mOurs = `# Transcript\n\n${T1('💭 want', '- **Gist:** sorted here.\n')}\n### T-002 · 2026-10-27 · 📋 task\n> ours words\n${cardOf('A-002', 'ours card.')}\n### T-003 · 2026-10-27 · 🔨 ruling\n> ours again\n- **Became:** see T-002, card A-002\n`;
  const mTheirs = `# Transcript\n\n${T1('❔ unsorted')}\n### T-002 · 2026-10-27 · 💭 want\n> theirs words\n${cardOf('A-002', 'theirs card.')}`;
  const merged = mergeTranscript({ base: mBase, ours: mOurs, theirs: mTheirs });
  assert.ok(merged.clean, 'two chats appending at once merge without a conflict');
  assert.ok(merged.text.includes(`### T-002 · 2026-10-27 · 💭 want\n> theirs words\n${cardOf('A-002', 'theirs card.')}`), "main's entry keeps its number and its card, word for word");
  assert.ok(merged.text.includes('### T-004 · 2026-10-27 · 📋 task\n> ours words\n- **Card A-003**'), "this chat's clashing entry and card take the next free numbers");
  assert.ok(merged.text.includes('### T-003 · 2026-10-27 · 🔨 ruling\n> ours again\n- **Became:** see T-004, card A-003'), "a number that did not clash stays; this chat's references follow the moved ones");
  assert.ok(merged.text.includes(T1('💭 want', '- **Gist:** sorted here.\n')), "this chat's sorting of an older entry is kept");
  assert.ok(merged.text.indexOf('theirs words') < merged.text.indexOf('ours words'), "main's side comes first");
  writeFileSync(join(dir, '2026-10.md'), merged.text);
  assert.deepEqual([...idFaults(readTranscript(dir)), ...agreementFaults(readTranscript(dir))], [], 'after the merge no number repeats');
  assert.deepEqual(merged.moved, ['T-002 → T-004', 'A-002 → A-003'], 'what moved is said');
  const bothSorted = mergeTranscript({ base: mBase, ours: `# Transcript\n\n${T1('💭 want')}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}` });
  assert.equal(bothSorted.clean, false, 'one entry changed two ways is left for a person, never guessed');
  // 2026-10-29: copies removed by hand came back on every merge, 17 to 24 at a time.
  const T2 = `### T-002 · 2026-10-27 · 📋 task\n> second words\n- **Gist:** sorted.\n${cardOf('A-002', 'a card.')}`;
  const removedHere = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}`, ours: `# Transcript\n\n${T1('🔨 ruling')}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}\n### T-003 · 2026-10-28 · 💭 want\n> new there\n` });
  assert.ok(removedHere.clean && !removedHere.text.includes('second words') && removedHere.text.includes('new there'), 'an entry removed here and left alone on main stays removed');
  const changedThere = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}`, ours: `# Transcript\n\n${T1('🔨 ruling')}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}- **Lesson:** added there.\n` });
  assert.ok(changedThere.clean && changedThere.text.includes('added there'), 'removed here but changed on main, it is kept: nothing changed is lost');
  const renumbered = T2.replace('T-002', 'T-009').replace('A-002', 'A-009');
  const copy = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}`, ours: `# Transcript\n\n${T1('🔨 ruling')}\n${renumbered}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}` });
  assert.ok(copy.clean && copy.text.split('second words').length === 2 && copy.text.includes('### T-002 ·'), "a sorted entry main holds under other numbers is kept once, as main numbers it");
  // 2026-10-30 (cc3b5320): base and main held an entry under one number, this chat under
  // another (an earlier merge moved it here). Main's was read as removed here, this chat's
  // as main's, and both went: six remarks lost. Now main's is kept, once.
  const movedHere = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}`, ours: `# Transcript\n\n${T1('🔨 ruling')}\n${renumbered}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}` });
  assert.ok(movedHere.clean && movedHere.text.split('second words').length === 2, 'an entry this chat holds under other numbers is kept once, never lost from both sides');
  // A copy removed here beside the one kept under its own number is still a removal.
  const dedupe = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}\n${renumbered}`, ours: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${T2}\n${renumbered}` });
  assert.ok(dedupe.clean && dedupe.text.split('second words').length === 2, 'a copy removed by hand stays removed');
  // Whatever the cause, a merge that would lose a remark either side holds is a conflict, never a write.
  const doubled = `### T-002 · 2026-10-27 · 📋 task\n> second words\n- **Gist:** sorted.\n### T-003 · 2026-10-27 · 📋 task\n> second words\n- **Gist:** sorted.\n`;
  const lossy = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}`, ours: `# Transcript\n\n${T1('🔨 ruling')}\n${doubled.replace('T-002', 'T-008').replace('T-003', 'T-009')}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}` });
  assert.ok(lossy.clean && lossy.text.split('second words').length === 3, 'two remarks of the same words on one day, both kept');
  const yes = (n) => `### T-00${n} · 2026-10-27 · ❔ unsorted\n> Yes\n`;
  const twoYes = mergeTranscript({ base: `# Transcript\n\n${T1('🔨 ruling')}`, ours: `# Transcript\n\n${T1('🔨 ruling')}\n${yes(2)}`, theirs: `# Transcript\n\n${T1('🔨 ruling')}\n${yes(5)}` });
  assert.equal(twoYes.text.split('> Yes').length, 3, 'two unsorted "Yes" from two chats on one day are two remarks, both kept');
  // The shape of cc3b5320 (2026-10-30), whole: base and main hold two remarks under their
  // numbers, this chat the same two under others (an earlier merge moved them here), and each
  // side adds its own, main's new one taking a number this chat's moved copy holds. Every
  // remark found on either side is in the result exactly once.
  {
    const sorted = (id, date, words) => `### ${id} · ${date} · 🔨 ruling\n> ${words}\n- **Gist:** ${words}.\n`;
    const alpha = (id) => sorted(id, '2026-10-29', 'can I ask why it is still in dev mode');
    const beta = (id) => sorted(id, '2026-10-29', 'rename code upkeep to code maintenance');
    const head = `# Transcript\n\n${T1('🔨 ruling')}\n`;
    const sides = {
      base: `${head}${alpha('T-002')}\n${beta('T-003')}`,
      theirs: `${head}${alpha('T-002')}\n${beta('T-003')}\n${sorted('T-005', '2026-10-29', "main's own new remark")}`,
      ours: `${head}${alpha('T-005')}\n${beta('T-006')}\n${sorted('T-004', '2026-10-29', "this chat's own new remark")}\n${sorted('T-007', '2026-10-30', "this chat's second")}`,
    };
    const m = mergeTranscript(sides);
    assert.ok(m.clean, 'the cc3b5320 shape merges without a conflict');
    const words = ['first words', 'can I ask why it is still in dev mode', 'rename code upkeep to code maintenance', "main's own new remark", "this chat's own new remark", "this chat's second"];
    for (const w of words) assert.equal(m.text.split(`> ${w}\n`).length - 1, 1, `the cc3b5320 shape: "${w}" is in the result exactly once`);
  }
  // f5041f36 (3 Nov): a merge kept one side of the dialogue folder whole, and remarks only
  // the other side had added since they parted went with it. No parent but one held them,
  // so the both-parents rule never saw it. A remark one side added, and the other never
  // removed, must survive; one a side removed since the base may go.
  {
    const repo = join(dir, 'one-side-kept');
    const tdir = join(repo, 'dev', 'dialogue', 'transcript');
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const put = (text, msg) => { writeFileSync(join(tdir, '2026-10.md'), text); g('add', '-A'); g('commit', '-qm', msg); return g('rev-parse', 'HEAD').trim(); };
    const say = (id, words) => `### ${id} · 2026-10-29 · 🔨 ruling\n> ${words}\n`;
    const head = `# Transcript\n\n${say('T-001', 'first words')}\n`;
    mkdirSync(tdir, { recursive: true });
    g('init', '-q', '-b', 'main');
    g('config', 'core.hooksPath', '/dev/null');
    const base = put(`${head}${say('T-002', 'to be moved out')}`, 'base');
    g('checkout', '-qb', 'other');
    const other = put(`${head}${say('T-002', 'to be moved out')}\n${say('T-003', 'only the other side added this')}`, 'other');
    g('checkout', '-q', 'main');
    put(`${head}${say('T-002', '[moved to his record]')}\n${say('T-004', 'this side added this')}`, 'this side');
    spawnSync('git', ['merge', '-q', '--no-commit', '-s', 'ours', other], { cwd: repo });
    g('commit', '-qm', 'merge keeping one side');
    const kept = g('rev-parse', 'HEAD').trim();
    assert.deepEqual([...droppedByMerges(repo, base, kept)].map((r) => r.slice(11)), ['> only the other side added this'], 'a remark one side added, lost by a merge keeping the other side, is found; one a side moved out is not');
    assert.equal(mergeLosses({ gitRoot: repo, since: base }).length, 1, 'check names the merge that kept one side');
    put(`${head}${say('T-002', '[moved to his record]')}\n${say('T-004', 'this side added this')}\n${say('T-005', 'only the other side added this')}`, 'put back');
    assert.deepEqual(mergeLosses({ gitRoot: repo, since: base }), [], 'once put back, the merge is no longer a fault');
  }
  // The other three of cc3b5320's six: a merge on this chat's side (d9bd8082) had lost them
  // though both its parents held them, and the next merge read their absence as a removal
  // here. A remark lost so is put back from main, and `check` names a merge under way or
  // not yet pushed that lost one.
  {
    const repo = join(dir, 'lost-in-merge');
    const tdir = join(repo, 'dev', 'dialogue', 'transcript');
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const month = () => readFileSync(join(tdir, '2026-10.md'), 'utf8');
    const put = (text, msg) => { writeFileSync(join(tdir, '2026-10.md'), text); g('add', '-A'); g('commit', '-qm', msg); return g('rev-parse', 'HEAD').trim(); };
    const say = (id, words) => `### ${id} · 2026-10-29 · 🔨 ruling\n> ${words}\n`;
    const head = `# Transcript\n\n${T1('🔨 ruling')}\n`;
    mkdirSync(tdir, { recursive: true });
    g('init', '-q', '-b', 'main');
    g('config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(repo, '.gitattributes'), 'dev/dialogue/transcript/*.md merge=dialogue\n');
    const base = put(`${head}${say('T-002', 'the letter is philosophy')}`, 'base');
    g('checkout', '-qb', 'side');
    const side = put(`${head}${say('T-002', 'the letter is philosophy')}\n${say('T-003', 'side words')}`, 'side');
    g('checkout', '-qb', 'theirs', base);
    put(`${head}${say('T-002', 'the letter is philosophy')}\n${say('T-005', 'main words')}`, 'theirs');
    g('checkout', '-q', 'main');
    put(`${head}${say('T-002', 'the letter is philosophy')}\n${say('T-004', 'ours words')}`, 'ours');
    // The lossy merge on this chat's side: both parents hold the remark; the result does not.
    spawnSync('git', ['merge', '-q', '--no-commit', side], { cwd: repo });
    writeFileSync(join(tdir, '2026-10.md'), `${head}${say('T-003', 'side words')}\n${say('T-004', 'ours words')}`);
    g('add', '-A');
    g('commit', '-qm', 'lossy merge');
    const lossy = g('rev-parse', 'HEAD').trim();
    assert.deepEqual([...droppedByMerges(repo, base, lossy)].map((r) => r.slice(11)), ['> the letter is philosophy'], 'a remark a merge lost though both its parents held it is found');
    assert.equal(mergeLosses({ gitRoot: repo, since: base }).length, 1, 'check names a merge not yet pushed that lost a remark both parents held');
    setMergeDriver(repo, fileURLToPath(new URL('./dialogue.mjs', import.meta.url)));
    const run = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'merge', '-q', '--no-edit', 'theirs'], { cwd: repo, encoding: 'utf8' });
    assert.equal(run.status, 0, `the next merge goes through: ${run.stderr}`);
    for (const w of ['first words', 'the letter is philosophy', 'side words', 'ours words', 'main words']) assert.equal(month().split(`> ${w}\n`).length - 1, 1, `a remark an earlier merge lost comes back from main: "${w}" exactly once`);
    assert.deepEqual(mergeLosses({ gitRoot: repo, since: base }), [], 'once the remark is back in the tree, the old merge is no longer a fault');
    // A merge under way is read from the tree: a driver that keeps only the base stands in
    // for one that loses, both sides having added "shared" under their own numbers.
    g('checkout', '-qb', 'both-ours');
    const now = month();
    put(`${now}\n${say('T-010', 'shared')}`, 'shared here');
    g('checkout', '-qb', 'both-theirs', 'HEAD~1');
    put(`${now}\n${say('T-011', 'shared')}`, 'shared there');
    g('checkout', '-q', 'both-ours');
    g('config', 'merge.dialogue.driver', 'cp %O %A');
    spawnSync('git', ['merge', '-q', '--no-commit', '--no-edit', 'both-theirs'], { cwd: repo });
    const underWay = mergeLosses({ gitRoot: repo, since: 'HEAD' });
    assert.ok(underWay.length === 1 && /merge under way loses the remark of 2026-10-29 "shared"/.test(underWay[0]), `check names a merge under way that loses a remark both sides hold: ${underWay}`);
    spawnSync('git', ['merge', '--abort'], { cwd: repo });
    g('config', 'merge.dialogue.driver', 'cp %B %A');
    spawnSync('git', ['merge', '-q', '--no-commit', '--no-edit', 'both-theirs'], { cwd: repo });
    assert.deepEqual(mergeLosses({ gitRoot: repo, since: 'HEAD' }), [], 'a merge under way that keeps every remark both sides hold passes');
  }

  // The same, through git: the merge driver wired by .gitattributes, so the pull never stops,
  // and the Agreements, generated (the index and every page, T-768), rebuilt from the merged Transcript in the same merge.
  // Each case on its own throwaway repository.
  const clashRepo = (name, driver, sides = { base: mBase, ours: mOurs, theirs: mTheirs }) => {
    const repo = join(dir, name);
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const tdir = join(repo, 'dev', 'dialogue', 'transcript');
    // An eval card checking the card both sides carry, so agreements.md has a Checked by line to keep:
    // a merge that rebuilt it without the cards dropped every one (2026-10-30).
    const cdir = join(repo, 'dev', 'evals', 'cards');
    const write = (text) => {
      writeFileSync(join(tdir, '2026-10.md'), text);
      writeAgreements(readTranscript(tdir), readCards(cdir), join(repo, 'dev', 'dialogue'));
      writeIndex(readTranscript(tdir), join(repo, 'dev', 'dialogue', 'index'));
    };
    mkdirSync(tdir, { recursive: true });
    mkdirSync(cdir, { recursive: true });
    writeFileSync(join(cdir, 'E-001.md'), '---\nid: E-001\ntitle: The first words hold\nwhy: [A-002]\nwhen: before-landing\nstatus: runnable\n---\n# E-001\n');
    g('init', '-q', '-b', 'main');
    g('config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(repo, '.gitattributes'), readFileSync(join(DIALOGUE_DIR, '..', '..', '.gitattributes'), 'utf8'));
    if (driver) setMergeDriver(repo, fileURLToPath(new URL('./dialogue.mjs', import.meta.url)));
    write(sides.base);
    g('add', '-A');
    g('commit', '-qm', 'base');
    g('checkout', '-qb', 'theirs');
    // A page of the Agreements new on one side is a file of its own (T-768): added, not only changed.
    write(sides.theirs);
    g('add', '-A');
    g('commit', '-qm', 'theirs');
    g('checkout', '-q', 'main');
    write(sides.ours);
    g('add', '-A');
    g('commit', '-qm', 'ours');
    const run = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'merge', '-q', '--no-edit', 'theirs'], { cwd: repo, encoding: 'utf8' });
    const month = () => readFileSync(join(tdir, '2026-10.md'), 'utf8');
    const agreementsOff = () => agreementsStale(readTranscript(tdir), readCards(cdir), join(repo, 'dev', 'dialogue'));
    const indexOk = () => indexStale(readTranscript(tdir), join(repo, 'dev', 'dialogue', 'index')).length === 0;
    return { repo, g, run, month, agreementsOff, indexOk };
  };
  {
    const { repo, run, month, agreementsOff, indexOk } = clashRepo('with-driver', true);
    assert.equal(run.status, 0, `the pull does not stop on a Transcript clash: ${run.stdout}${run.stderr}`);
    assert.equal(month(), merged.text, 'git lands the same merge');
    assert.deepEqual(agreementsOff(), [], 'agreements.md is rebuilt from the merged Transcript');
    assert.ok(indexOk(), 'and the pages by way and topic with it');
    const pagesDir = join(repo, 'dev', 'dialogue', 'agreements');
    assert.ok(readdirSync(pagesDir).map((f) => readFileSync(join(pagesDir, f), 'utf8')).join('\n').includes('Checked by'), 'and keeps the Checked by line its eval card gives it');
  }
  {
    // Only this chat's side changed agreements.md, so git takes it without any driver; but its
    // card's entry moved number in the merge, and the card cites it. The remark count on the file
    // changed on both sides, so git hands it to the driver all the same, which rebuilds it.
    const theirsNoCard = `# Transcript\n\n${T1('❔ unsorted')}\n### T-002 · 2026-10-27 · 💭 want\n> theirs words\n`;
    // Since the Agreements are kept in parts (T-768), this chat's card is on a group page only
    // this side has, which git takes as it is, citing the old number: the index is rebuilt by the
    // driver, and the page new on one side by the rebuild git's post-merge hook runs.
    const { repo, g, run, agreementsOff } = clashRepo('one-sided', true, { base: mBase, ours: mOurs, theirs: theirsNoCard });
    assert.equal(run.status, 0, `the pull does not stop: ${run.stderr}`);
    assert.ok(!agreementsOff().includes('agreements.md'), 'the index, changed on both sides, is rebuilt by the driver');
    assert.equal(g('status', '--porcelain').trim(), '', 'in the merge commit itself, nothing left over');
    const rebuilt = rebuildAfterMerge(repo);
    assert.deepEqual(agreementsOff(), [], `after the merge, every page matches the merged Transcript (rebuilt: ${rebuilt.join(', ')})`);
    assert.deepEqual(rebuildAfterMerge(repo), [], 'and a second rebuild finds nothing left to do');
  }
  {
    // Where the driver is not configured, the pull stops as before, and resolve settles it.
    const { repo, g, run, month, agreementsOff, indexOk } = clashRepo('without-driver', false);
    assert.notEqual(run.status, 0, "without the driver, git's own merge stops on the clash");
    assert.equal(resolveConflicts(repo), 0, 'resolve settles it');
    assert.equal(g('diff', '--name-only', '--diff-filter=U').trim(), '', 'nothing is left conflicted');
    assert.equal(month(), merged.text, 'resolve lands the same merge as the driver');
    assert.deepEqual(agreementsOff(), [], 'and rebuilds agreements.md');
    assert.ok(indexOk(), 'and the pages by way and topic');
  }
  // After the 27 Oct review: what the merge moves is followed outside the Transcript too.
  // Each case on its own throwaway repository, sides given as { path: text }.
  const sidesRepo = (name, sides, driver = true) => {
    const repo = join(dir, name);
    const git = ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false'];
    const g = (...a) => execFileSync('git', [...git, ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const tdir = join(repo, 'dev', 'dialogue', 'transcript');
    const put = (files) => {
      for (const [p, t] of Object.entries(files)) {
        mkdirSync(join(repo, p, '..'), { recursive: true });
        writeFileSync(join(repo, p), t);
      }
      writeFileSync(join(repo, 'dev', 'dialogue', 'agreements.md'), renderAgreements(readTranscript(tdir)));
    };
    mkdirSync(tdir, { recursive: true });
    g('init', '-q', '-b', 'main');
    g('config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(repo, '.gitattributes'), readFileSync(join(DIALOGUE_DIR, '..', '..', '.gitattributes'), 'utf8'));
    if (driver) setMergeDriver(repo, fileURLToPath(new URL('./dialogue.mjs', import.meta.url)));
    put(sides.base);
    g('add', '-A');
    g('commit', '-qm', 'base');
    g('checkout', '-qb', 'theirs');
    put(sides.theirs);
    g('add', '-A');
    g('commit', '-qm', 'theirs');
    g('checkout', '-q', 'main');
    put(sides.ours);
    g('add', '-A');
    g('commit', '-qm', 'ours');
    const run = spawnSync('git', [...git, 'merge', '-q', '--no-edit', 'theirs'], { cwd: repo, encoding: 'utf8' });
    const read = (p) => (existsSync(join(repo, p)) ? readFileSync(join(repo, p), 'utf8') : null);
    return { repo, g, run, read, tdir };
  };
  const MONTH = 'dev/dialogue/transcript/2026-10.md';
  {
    // (a) This chat's spec trace and backlog cite its card A-002, which the merge moves to A-003;
    // main's own line citing its A-002 is left alone.
    const trace = '# Trace\n\n| `AAA` | x | A-001 |\n| `DDD` | x | A-001 |\n| `EEE` | x | A-001 |\n';
    const { repo, run, read } = sidesRepo('moved-references', {
      base: { [MONTH]: mBase, 'dev/dialogue/trace.md': trace, 'dev/for-you.md': '# For you\n' },
      theirs: { [MONTH]: mTheirs, 'dev/dialogue/trace.md': trace.replace('# Trace\n', "# Trace\n| `BBB` | main's | A-002 |\n") },
      ours: { [MONTH]: mOurs, 'dev/dialogue/trace.md': `${trace}| \`CCC\` | ours | A-002 |\n`, 'dev/for-you.md': '# For you\n- for-you · prove A-002 and T-002 · opened 2026-10-27 · chat none\n' },
    });
    assert.equal(run.status, 0, `the pull does not stop: ${run.stderr}`);
    assert.match(run.stderr, /moved --fix/, 'the driver says how to move the references');
    const found = movedReferences({ gitRoot: repo });
    assert.deepEqual(found.map((h) => `${h.path}:${h.line}`).sort(), ['dev/dialogue/trace.md:7', 'dev/for-you.md:2'], "this chat's lines citing a moved number are found, main's are not");
    assert.equal(movedReferences({ gitRoot: repo, fix: true }).length, 2, 'and moved with --fix');
    assert.ok(read('dev/dialogue/trace.md').includes("| `BBB` | main's | A-002 |") && read('dev/dialogue/trace.md').includes('| `CCC` | ours | A-003 |'), "main's line keeps A-002, this chat's follows to A-003");
    assert.ok(read('dev/for-you.md').includes('prove A-003 and T-004'), 'both moved numbers on one line follow');
    assert.deepEqual(movedReferences({ gitRoot: repo }), [], 'once moved, nothing is left and the note is gone');
    // A merge given up (aborted, or refused at its commit) moved nothing: its note does not count.
    const { g } = { g: (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim() };
    const never = g('commit-tree', 'HEAD^{tree}', '-m', 'main, never merged');
    recordMoves(repo, [['A-002', 'A-009']], { base: g('rev-parse', 'HEAD~1'), ours: g('rev-parse', 'HEAD^1'), theirs: never });
    assert.deepEqual(movedReferences({ gitRoot: repo }), [], 'a note from a merge that never landed is not counted');
  }
  {
    // (b) Two chats both added eval card E-002: main's keeps it, this chat's moves to E-003
    // with its scenario, its runs in the history and its references.
    const card = (id, title) => `---\nid: ${id}\ntitle: ${title}\n---\n# ${id} · ${title}\n\n**How it runs:** node dev/evals/runner.mjs ${id}\n`;
    const run1 = (id, d) => `{"kind":"card","date":"${d}","card":"${id}","verdict":"pass"}\n`;
    const { repo, g, run, read } = sidesRepo('eval-clash', {
      base: { [MONTH]: mBase, 'dev/evals/cards/E-001.md': card('E-001', 'one'), 'dev/evals/history/2026-10-27.jsonl': run1('E-001', '1'), 'dev/for-you.md': '# For you\n' },
      theirs: { 'dev/evals/cards/E-002.md': card('E-002', 'theirs'), 'dev/evals/history/2026-10-27.jsonl': run1('E-001', '1') + run1('E-002', '2') },
      ours: { 'dev/evals/cards/E-002.md': card('E-002', 'ours'), 'dev/evals/scenarios/E-002.json': '{"card":"E-002"}\n', 'dev/evals/history/2026-10-27.jsonl': run1('E-001', '1') + run1('E-002', '3'), 'dev/for-you.md': '# For you\n- for-you · run E-002 weekly · opened 2026-10-27 · chat none\n' },
    }, false);
    assert.notEqual(run.status, 0, 'git stops on one card added twice');
    const stopped = readCards(join(repo, 'dev', 'evals', 'cards')).find((c) => c.conflict);
    assert.ok(stopped && cardFaults(stopped)[0].includes('dialogue.mjs resolve'), 'evals check names the clash and its fix');
    assert.equal(resolveConflicts(repo), 0, 'resolve settles it');
    assert.equal(g('diff', '--name-only', '--diff-filter=U').trim(), '', 'nothing is left conflicted');
    assert.equal(read('dev/evals/cards/E-002.md'), card('E-002', 'theirs'), "main's card keeps its number, word for word");
    assert.equal(read('dev/evals/cards/E-003.md'), card('E-003', 'ours'), "this chat's takes the next free number, its id inside moved too");
    assert.ok(read('dev/evals/scenarios/E-003.json') && read('dev/evals/scenarios/E-002.json') === null, 'its scenario moves with it');
    assert.ok(read('dev/evals/history/2026-10-27.jsonl').includes('"card":"E-003","verdict":"pass"') && read('dev/evals/history/2026-10-27.jsonl').includes('"date":"2","card":"E-002"'), "its runs follow it; main's stay");
    assert.ok(read('dev/for-you.md').includes('run E-003 weekly'), 'and its references');
    g('commit', '-qm', 'merge');
    assert.equal(g('status', '--porcelain').trim(), '', 'everything settled is in the merge commit');
  }
  {
    // (c) Across a month boundary. Where the driver runs, main's other months' numbers count as taken.
    const ours = `${mBase}\n### T-002 · 2026-10-31 · 📋 task\n> late in October\n${cardOf('A-002', 'ours card.')}`;
    const m = mergeTranscript({ base: mBase, ours, theirs: `${mBase}- **Lesson:** main's.\n`, floor: { T: 2, A: 2 }, taken: { T: ['T-002'], A: ['A-002'] } });
    assert.deepEqual(m.moved, ['T-002 → T-003', 'A-002 → A-003'], "a number main gave out in another month moves in this one");
    // Where it does not (main never touched October), the merge is clean and check refuses the
    // repeat; renumber keeps main's and moves this chat's, references with it.
    const nov = `# Transcript\n\n### T-002 · 2026-11-01 · 💭 want\n> early in November\n`;
    const { repo, run, read, tdir } = sidesRepo('month-boundary', {
      base: { [MONTH]: mBase, 'dev/for-you.md': '# For you\n' },
      theirs: { 'dev/dialogue/transcript/2026-11.md': nov },
      // A third chat's own entry, merged in from elsewhere, carrying the number: its heading is its remark, never a citation (2026-11-04).
      ours: { [MONTH]: `${ours}\n### T-003 · 2026-10-31 · 🔨 ruling\n> again\n- **Became:** see T-002\n`, 'dev/for-you.md': '# For you\n- for-you · do T-002 · opened 2026-10-31 · chat none\n', 'dev/dialogue/transcript/2026-12.md': '# Transcript\n\n### T-002 · 2026-12-01 · 💭 want\n> a third chat\n' },
    }, true);
    assert.equal(run.status, 0, 'the months merge without a stop');
    assert.ok(idFaults(readTranscript(tdir)).some((f) => f.startsWith('T-002 names ') && f.includes('renumber')), 'check refuses the repeat, naming renumber');
    const files = Object.fromEntries(['2026-10.md', '2026-11.md'].map((f) => [f, readFileSync(join(tdir, f), 'utf8')]));
    const { files: out, moved } = renumber(files, nov);
    for (const [f, t] of Object.entries(out)) writeFileSync(join(tdir, f), t);
    const pairs = renumberedPairs(moved);
    assert.deepEqual(pairs, [['T-002', 'T-004']], "main's November T-002 is kept, this chat's October one moves");
    movedReferences({ gitRoot: repo, fix: true, notes: [{ pairs, base: execFileSync('git', ['merge-base', 'HEAD', 'theirs'], { cwd: repo, encoding: 'utf8' }).trim(), ours: null, theirs: 'theirs', everywhere: true }] });
    assert.ok(read('dev/for-you.md').includes('do T-004') && read(MONTH).includes('see T-004') && read('dev/dialogue/transcript/2026-11.md') === nov, "this chat's references follow; main's month is untouched");
    assert.ok(read('dev/dialogue/transcript/2026-12.md').includes('### T-002 · 2026-12-01'), "an entry's own heading is never rewritten as a reference");
    rmSync(join(tdir, '2026-12.md'));
    assert.deepEqual(idFaults(readTranscript(tdir)), [], 'no number repeats after');
  }
  // T-499: a month kept in parts, `2026-10.md`, then `2026-10-2.md`, `-3.md`… each under the one-read line.
  {
    // (d) A month in two parts (and a tenth, to be sure -10 follows -2) reads as one, in order.
    const pdir = makeTemp('dear-dialogue-parts-');
    const e = (n) => `### T-0${String(n).padStart(2, '0')} · 2026-10-2${n % 9} · 💭 want\n> remark ${n}\n`;
    writeFileSync(join(pdir, '2026-10.md'), `# Transcript · October 2026\n\n---\n\n${e(1)}\n${e(2)}`);
    writeFileSync(join(pdir, '2026-10-2.md'), `${partHeader('2026-10', 2, 'October 2026')}\n${e(3)}\n${e(4)}`);
    writeFileSync(join(pdir, '2026-10-10.md'), `${partHeader('2026-10', 10, 'October 2026')}\n${e(5)}`);
    writeFileSync(join(pdir, '2026-11.md'), `# Transcript · November 2026\n\n---\n\n${e(6)}`);
    const read = readTranscript(pdir);
    assert.deepEqual(read.map((x) => x.id), ['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006'], "a month's parts read as one, in part order, before the next month");
    assert.deepEqual(read.map((x) => x.quote), [1, 2, 3, 4, 5, 6].map((n) => `remark ${n}`), 'every entry word for word');
    assert.deepEqual(sortParts(['2026-11.md', '2026-10-10.md', '2026-10.md', '2026-10-2.md', 'README.md', '2026-10-1.md']), ['2026-10.md', '2026-10-2.md', '2026-10-10.md', '2026-11.md'], 'parts sort by month, then part, never by text; anything else is no part');
    const root = makeTemp('dear-dialogue-parts-root-');
    mkdirSync(join(root, 'dev', 'dialogue'), { recursive: true });
    execFileSync('cp', ['-r', pdir, join(root, 'dev', 'dialogue', 'transcript')]);
    assert.deepEqual(transcriptQuotes(root).map((x) => x.id), read.map((x) => x.id), 'the typed check reads every part too');
    rmSync(pdir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
  {
    // (e) The driver merges a later part as it merges a month: two chats appending to 2026-10-2.md.
    const P1 = 'dev/dialogue/transcript/2026-10.md';
    const P2 = 'dev/dialogue/transcript/2026-10-2.md';
    const head2 = `${partHeader('2026-10', 2, 'October 2026')}\n### T-002 · 2026-10-27 · 💭 want\n> in part two\n`;
    const { run, read, tdir } = sidesRepo('part-merge', {
      base: { [P1]: mBase, [P2]: head2 },
      theirs: { [P2]: `${head2}\n### T-003 · 2026-10-28 · 💭 want\n> main's remark\n` },
      ours: { [P2]: `${head2}\n### T-003 · 2026-10-28 · 📋 task\n> this chat's remark\n` },
    });
    assert.equal(run.status, 0, `a part merges without a stop: ${run.stderr}`);
    assert.ok(read(P2).includes("### T-003 · 2026-10-28 · 💭 want\n> main's remark") && read(P2).includes("### T-004 · 2026-10-28 · 📋 task\n> this chat's remark"), "main's keeps its number, this chat's moves past it, in the part");
    assert.ok(read(P2).startsWith('# Transcript · October 2026 · part 2'), "the part's heading is kept");
    assert.deepEqual(idFaults(readTranscript(tdir)), [], 'no number repeats across the parts');
    // A number main gave out in the month's other part counts as taken too.
    const side = sidesRepo('part-sibling', {
      base: { [P1]: mBase, [P2]: head2 },
      theirs: { [P1]: `${mBase}- **Lesson:** main's.\n`, [P2]: `${head2}\n### T-003 · 2026-10-28 · 💭 want\n> main's remark\n` },
      ours: { [P1]: `${mBase}\n### T-003 · 2026-10-28 · 📋 task\n> this chat's, in part one\n` },
    });
    assert.equal(side.run.status, 0, `the pull does not stop: ${side.run.stderr}`);
    assert.ok(side.read(P1).includes("### T-004 · 2026-10-28 · 📋 task\n> this chat's, in part one"), "a number main gave out in the other part moves");
    assert.deepEqual(idFaults(readTranscript(side.tdir)), [], 'no number repeats');
  }
  {
    // (f) Main cut the month into parts while this chat appended to the one file: nothing is lost
    // or doubled, and the pull does not stop.
    const whole = `# Transcript\n\n${T1('🔨 ruling')}\n### T-002 · 2026-10-27 · 💭 want\n> second\n\n### T-003 · 2026-10-28 · 💭 want\n> third\n`;
    const cut1 = `# Transcript\n\n${T1('🔨 ruling')}\n### T-002 · 2026-10-27 · 💭 want\n> second\n`;
    const cut2 = `${partHeader('2026-10', 2, 'October 2026')}\n### T-003 · 2026-10-28 · 💭 want\n> third\n`;
    const P1 = 'dev/dialogue/transcript/2026-10.md';
    const P2 = 'dev/dialogue/transcript/2026-10-2.md';
    const { run, read, tdir } = sidesRepo('part-cut', {
      base: { [P1]: whole },
      theirs: { [P1]: cut1, [P2]: cut2 },
      ours: { [P1]: `${whole}\n### T-004 · 2026-10-30 · ❔ unsorted\n> said while the month was cut\n` },
    });
    assert.equal(run.status, 0, `the pull does not stop on a month cut into parts: ${run.stderr}`);
    const all = readTranscript(tdir);
    assert.deepEqual(all.map((x) => x.id).sort(), ['T-001', 'T-002', 'T-003', 'T-004'], 'every entry once: none lost, none doubled');
    assert.ok(read(P2) === cut2 && read(P1).includes('> said while the month was cut'), "main's parts kept whole, this chat's new remark kept");
    // An entry main moved to another part that this chat changed meanwhile is never guessed.
    const changed = mergeTranscript({ base: whole, ours: whole.replace('> third\n', '> third\n- **Gist:** sorted here.\n'), theirs: cut1, elsewhere: cut2 });
    assert.ok(!changed.clean, 'one changed here and moved to another part on main stays a conflict');
  }
  {
    // (g) The hook appends to the month's last part, and starts the next part before it would pass PART_LINES.
    const root = makeTemp('dear-dialogue-part-hook-');
    const hdir = join(root, 'dev', 'dialogue', 'transcript');
    const state = join(root, '.claude', 'hooks', 'state');
    mkdirSync(hdir, { recursive: true });
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, 'dev-mode-parts-test'), 'on');
    const month = new Date().toISOString().slice(0, 7);
    const filler = Array.from({ length: PART_LINES - 8 }, (_, i) => `> line ${i}`).join('\n');
    writeFileSync(join(hdir, `${month}.md`), `# Transcript\n\n### T-010 · ${month}-01 · 💭 want\n${filler}\n`);
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
    for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID', 'DEAR_HOOK_STRICT']) delete env[k];
    const say = (prompt) => spawnSync(process.execPath, [fileURLToPath(new URL('../../.claude/hooks/session/dialogue-record.mjs', import.meta.url))], { env, input: JSON.stringify({ session_id: 'parts-test', prompt }), encoding: 'utf8', timeout: 20000 }).stdout ?? '';
    const before = readFileSync(join(hdir, `${month}.md`), 'utf8');
    const out = say('one line that still fits');
    assert.ok(readFileSync(join(hdir, `${month}.md`), 'utf8').includes('### T-011 ') && !existsSync(join(hdir, `${month}-2.md`)), 'an entry that fits goes on the last part');
    const said = say('a remark\nof\nseveral\nlines\nthat would carry it past');
    const second = join(hdir, `${month}-2.md`);
    assert.ok(existsSync(second) && readFileSync(second, 'utf8').includes('### T-012 ') && readFileSync(second, 'utf8').startsWith(`# Transcript · `), 'one that would pass the line starts the next part, with its heading');
    assert.ok(readFileSync(join(hdir, `${month}.md`), 'utf8').startsWith(before) && !readFileSync(join(hdir, `${month}.md`), 'utf8').includes('T-012'), 'the full part is left as it was');
    assert.ok(lineCount(readFileSync(join(hdir, `${month}.md`), 'utf8')) <= PART_LINES, 'and stays under the line');
    assert.ok(out.includes(`${month}.md`) && said.includes(`${month}-2.md`), 'the agent is told which part holds the remark');
    say('the next remark');
    assert.ok(readFileSync(second, 'utf8').includes('### T-013 '), 'later remarks follow on the new part, numbered on across the parts');
    rmSync(root, { recursive: true, force: true });
  }
  {
    // (h) A part grown past the line after it was cut (sorting added lines; a merge appended to it, 88446169):
    // check names it, and recut packs it and the parts after it again, every entry word for word, in order.
    const body = (id, n) => `### T-${String(id).padStart(3, '0')} · 2026-10-0${1 + (id % 9)} · 💭 want\n${Array.from({ length: n }, (_, i) => `> line ${i}`).join('\n')}`;
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    const p1 = `# Transcript · October 2026\n\nThe month's opening words.\n\n---\n\n${ids.slice(0, 20).map((i) => body(i, 50)).join('\n\n')}\n`;
    const p2 = `${partHeader('2026-10', 2, 'October 2026')}\n${ids.slice(20).map((i) => body(i, 50)).join('\n\n')}\n`;
    assert.ok(lineCount(p1) > ONE_READ, 'the invented first part is past the line');
    assert.deepEqual(oversizeParts({ '2026-10.md': p1, '2026-10-2.md': p2 }).map(([f]) => f), ['2026-10.md'], 'check names the part past the line, and only it');
    const out = recut([['2026-10-2.md', p2], ['2026-10.md', p1]]);
    assert.ok(out.every(([, t]) => t !== null && lineCount(t) <= PART_LINES), 'every part comes back under PART_LINES');
    assert.ok(out[0][1].startsWith("# Transcript · October 2026\n\nThe month's opening words.\n\n---\n\n### T-001 "), "the first part keeps the month's own heading");
    assert.ok(out.slice(1).every(([f, t], i) => f === `2026-10-${i + 2}.md` && t.startsWith(partHeader('2026-10', i + 2, 'October 2026'))), 'later parts are named in order, each with its heading');
    const rdir = makeTemp('dear-dialogue-recut-');
    const readAs = (files) => { rmSync(rdir, { recursive: true, force: true }); mkdirSync(rdir, { recursive: true }); for (const [f, t] of files) if (t !== null) writeFileSync(join(rdir, f), t); return readTranscript(rdir).map(({ file, ...e }) => e); };
    assert.deepEqual(readAs(out), readAs([['2026-10.md', p1], ['2026-10-2.md', p2]]), 'every entry word for word, in order, none lost or doubled');
    const fine = [['2026-10.md', p1.replace(/^### T-0(1[1-9]|20) [\s\S]*$/m, '')], ['2026-10-2.md', p2]];
    assert.deepEqual(recut(fine), fine, 'a month with no part past the line is left exactly as it is');
    const one = (n, id) => `${partHeader('2026-10', n, 'October 2026')}\n${body(id, 50)}\n`;
    const shrunk = recut([['2026-10.md', p1], ['2026-10-2.md', one(2, 21)], ['2026-10-3.md', one(3, 22)]]);
    assert.deepEqual(shrunk.map(([f, t]) => [f, t === null]), [['2026-10.md', false], ['2026-10-2.md', false], ['2026-10-3.md', true]], 'a part left with nothing to hold comes back as null, never a stale copy');
    assert.equal(readAs(shrunk).length, 22, 'and its entry is held once, in the part before');
    rmSync(rdir, { recursive: true, force: true });
  }
  // A-131: an agreement says the want, never how it is built or one particular thing without a reason.
  {
    const wdir = makeTemp('dear-dialogue-wording-');
    const cardWith = (says, failed = 'it went.', more = '', status = 'agreed') => `### T-001 · 2026-10-29 · 🤝 agreement\n> yes\n- **Card A-001** · status: ${status} · emoji: 🎯 · group: 1 Test · order: 1\n  - **Says:** ${says}\n  - **Failed if:** ${failed}\n${more}`;
    const wordOf = (text) => { writeFileSync(join(wdir, '2026-10.md'), `# Transcript\n\n${text}`); return wordingFaults(readTranscript(wdir)); };
    assert.deepEqual(wordOf(cardWith('I want my messages readable at a glance.')), [], 'a card that says only the want passes');
    assert.equal(wordOf(cardWith('Keep it in `data/core/me/chats.md`.')).length >= 1, true, 'a file in backticks fails');
    assert.ok(wordOf(cardWith('The list lives in data/core/state/chats.md.')).some((f) => /a path|a file name/.test(f)), 'a path fails');
    assert.ok(wordOf(cardWith('As HBT-010 says, it goes.')).some((f) => /ID/.test(f)), 'a spec row ID fails');
    assert.ok(wordOf(cardWith('Open https://claude.ai/code/session_x to carry on.')).some((f) => /address/.test(f)), 'an address fails');
    assert.ok(wordOf(cardWith('Send it as HTML through the API.')).some((f) => /mechanism/.test(f)), 'a mechanism fails');
    // The wordings that went in before the check existed (T-345): each is caught.
    assert.ok(wordOf(cardWith('I want my Telegram messages easy to read at a glance on my phone.')).some((f) => /a product/.test(f)), 'a product with no reason fails');
    assert.ok(wordOf(cardWith('Keep my calendar.', 'an event in the next two weeks is missing.')).some((f) => /fixed span/.test(f)), 'a fixed span in Failed if fails');
    assert.ok(wordOf(cardWith('The morning check-in links to ☀️ Sunny days chat.')).some((f) => /particular chat/.test(f)), 'one particular chat fails');
    assert.ok(wordOf(cardWith('Every morning at 9am, a message.')).some((f) => /fixed time/.test(f)), 'a fixed time fails');
    // A reason makes a particular the want; it never excuses how something is built.
    assert.deepEqual(wordOf(cardWith('A copy runs on just GitHub and Claude.', 'it needs another service.', '  - **Names:** GitHub and Claude, because which services is the want\n')), [], 'a product with its reason passes');
    assert.ok(wordOf(cardWith('Run `npm ci` on GitHub.', 'it fails.', '  - **Names:** GitHub, because it is the want\n')).some((f) => /built/.test(f)), 'a reason never lets how it is built through');
    // What is not read: his own words in Why, a merged card, and a drafted card is read like an agreed one.
    assert.deepEqual(wordOf(cardWith('I want it simple.', 'it is not.', '  - **Why:** "send it on Telegram at 9am, every two weeks"\n')), [], 'his words quoted in Why are not read');
    assert.deepEqual(wordOf(`### T-001 · 2026-10-29 · 🤝 agreement\n> yes\n- **Card A-002** · status: merged · into: A-003 · emoji: 🎯\n  - **Says:** on Telegram in \`x.md\`\n  - **Failed if:** it went.\n`), [], 'a merged card is not read');
    assert.ok(wordOf(cardWith('Keep `x.md`.', 'it went.', '', 'drafted')).length >= 1, 'a drafted card is read too');
    // Every card standing today passes, so the check refuses nothing he agreed.
    assert.deepEqual(wordingFaults(readTranscript()), [], 'every standing card in the real Transcript passes');
    rmSync(wdir, { recursive: true, force: true });
  }

  {
    // A-147: growing, never capped, and reviewed at several timings.
    const card = (id, date, checked = '', status = 'agreed') => ({ id: `T-${id}`, date, cards: [{ id: `A-${id}`, status, ...(checked ? { checked } : {}) }] });
    const many = Array.from({ length: 300 }, (_, i) => card(i, '2026-10-01'));
    assert.deepEqual(clashFaults(many), [], 'no cap: three hundred cards made before the clash check are refused nothing');
    assert.equal(clashFaults([card(1, CHECKED_SINCE)]).length, 1, 'a new card with no Checked against line is refused');
    assert.deepEqual(clashFaults([card(1, CHECKED_SINCE, 'A-007, A-065 · no clash')]), [], 'a new card that records its clash check passes');
    assert.deepEqual(clashFaults([card(1, CHECKED_SINCE, '', 'merged')]), [], 'a merged card is not checked again');
    const fresh = Array.from({ length: REVIEW_EVERY }, (_, i) => card(i, '2026-11-02'));
    assert.ok(reviewDue(fresh, ['2026-11-01'], '2026-11-03').due, 'twenty new cards since the last review make one due');
    assert.ok(!reviewDue(fresh.slice(1), ['2026-11-01'], '2026-11-03').due, 'nineteen do not');
    assert.ok(reviewDue([], ['2026-10-01'], '2026-10-31').due, 'thirty days since the last review make one due');
    assert.ok(reviewDue([], [], '2026-10-31').due, 'no review ever written is due');
    assert.ok(statusLines([], { today: '2026-11-03', review: { due: true, why: ['no review yet'] } })[0].includes('agreements review due'), 'a review due is said in the opening line');
    assert.deepEqual(clashFaults(readTranscript()), [], 'the real Transcript passes the clash check');
    // A-093: none repeats. A lesson in the same words as an earlier one is refused from CHECKED_SINCE on.
    const taught = (id, date, text) => ({ id: `T-${id}`, date, lesson: { text, style: 'principle' } });
    assert.equal(lessonFaults([taught(1, '2026-10-01', 'A cap answers how many'), taught(2, CHECKED_SINCE, 'a cap answers how many ')]).length, 1, 'a new lesson repeating an old one, case and spaces aside, is refused');
    assert.deepEqual(lessonFaults([taught(1, '2026-10-01', 'one'), taught(2, CHECKED_SINCE, 'two')]), [], 'a new lesson in new words passes');
    assert.deepEqual(lessonFaults([taught(1, '2026-10-01', 'one'), taught(2, '2026-10-02', 'one')]), [], 'a repeat recorded before the check began is left to the report');
    assert.deepEqual(lessonFaults(readTranscript()), [], 'the real Transcript passes the lesson check');
    const grouped = ['1 🧭 A', '2 🧱 B', '3 🤖 C'].map((g, i) => ({ id: `T-g${i}`, date: '2026-10-01', cards: [{ id: `A-g${i}`, status: 'agreed', group: g, order: 1 }] }));
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16'].map((d) => weeklyGroup(grouped, d).group);
    assert.equal(new Set(weeks).size, 3, 'three weeks running read three different groups');
    assert.equal(weeklyGroup(grouped, '2026-11-02').group, weeklyGroup(grouped, '2026-11-23').group, 'the turn comes round again');
    assert.deepEqual(digestsOwed(['2026-09', '2026-10', '2026-11'], ['2026-09'], '2026-11-03'), ['2026-10'], 'a closed month with no digest is owed; the open month is not');
    assert.deepEqual(digestsOwed(['2026-10'], [], '2026-10-30'), [], 'the month under way owes nothing');
    assert.ok(statusLines([], { today: '2026-11-03', digests: ['2026-10'] })[0].includes('month digest owed: 2026-10'), 'a digest owed is said in the opening line');
  }

  // 2026-11-03: a merge kept two copies of one remark, the old and the newly sorted,
  // under two numbers, and no check saw it. Same day and words: refused from then on;
  // a short one ("Yes") or one before the check began is never called a duplicate.
  {
    const long = 'Shouldn\u2019t the hook to pull the latest changes be at the start of each turn?';
    const twin = (id, date, quote) => ({ id, date, way: '❓ question', quote, topics: ['saving'], also: [] });
    const dup = transcriptFaults([twin('T-666', '2026-11-03', long), twin('T-667', '2026-11-03', long)], '2026-11-04');
    assert.ok(dup.some((f) => /T-666 and T-667 hold the same remark/.test(f)), 'two copies of one remark on one day are refused');
    assert.equal(duplicateRemarks([twin('T-1', '2026-11-03', 'Yes'), twin('T-2', '2026-11-03', 'Yes')]).length, 0, 'a short reply typed twice is not a duplicate');
    assert.equal(duplicateRemarks([twin('T-1', '2026-11-03', long), twin('T-2', '2026-11-04', long)]).length, 0, 'the same words on another day are not a duplicate');
    assert.ok(!transcriptFaults([twin('T-1', '2026-10-29', long), twin('T-2', '2026-10-29', long)], '2026-11-04').some((f) => /same remark/.test(f)), 'one from before the check began is not refused');
    assert.ok(DUPLICATES_SINCE === '2026-11-03');
  }

  // 2026-11-06 (A-052, T-981): research answered and kept nowhere was done again from
  // nothing three days later. A remark marked researched names where it is kept.
  {
    const said = (id, date, became) => ({ id, date, way: '📋 task', quote: 'research it', topics: ['agents'], also: [], became });
    const faults = (e) => transcriptFaults([e], '2026-11-07');
    assert.ok(faults(said('T-1', '2026-11-06', 'researched worktrees and merge queues')).some((f) => /researched but names no place/.test(f)), 'research kept nowhere is refused');
    assert.ok(!faults(said('T-2', '2026-11-06', 'researched, kept in dev/projects/parallel-chats/notes.md')).some((f) => /researched/.test(f)), 'research named on a desk passes');
    assert.ok(!faults(said('T-3', '2026-11-06', 'researched, kept in modules/fitness/knowledge/practices.md')).some((f) => /researched/.test(f)), 'research in an evidence base passes');
    assert.ok(!faults(said('T-4', '2026-11-03', 'researched worktrees')).some((f) => /researched/.test(f)), 'a remark from before the check began is not refused');
    assert.ok(!faults(said('T-5', '2026-11-06', 'answered from the record')).some((f) => /researched/.test(f)), 'a remark that was not researched is not asked for a place');
  }
  {
    // T-839: mid-merge, the references --fix moved are staged, so the merge commit carries them.
    const repo = join(dir, 'stage-mid-merge');
    mkdirSync(repo, { recursive: true });
    const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    g('init', '-q', '-b', 'main');
    for (const [k, v] of [['user.email', 't@t'], ['user.name', 't'], ['core.hooksPath', '/dev/null']]) g('config', k, v);
    writeFileSync(join(repo, 'a.md'), 'one\n'); g('add', '-A'); g('commit', '-qm', 'base');
    g('checkout', '-qb', 'other'); writeFileSync(join(repo, 'b.md'), 'theirs\n'); g('add', '-A'); g('commit', '-qm', 'theirs');
    g('checkout', '-q', 'main'); writeFileSync(join(repo, 'c.md'), 'ours\n'); g('add', '-A'); g('commit', '-qm', 'ours');
    writeFileSync(join(repo, 'a.md'), 'cites A-002\n');
    assert.deepEqual(stageDuringMerge(repo, ['a.md']), [], 'outside a merge, nothing is staged');
    assert.ok(g('diff', '--cached', '--name-only') === '', 'and the index is untouched');
    g('merge', '-q', '--no-commit', 'other');
    assert.deepEqual(stageDuringMerge(repo, ['a.md']), ['a.md'], 'mid-merge, a moved file is staged');
    assert.ok(g('diff', '--cached', '--name-only').split('\n').includes('a.md'), 'and the merge commit will carry it');
  }

  console.log('dialogue test: the weekly recheck of the method due by its log and carried by the daily loop (A-153); remarks tagged with every way and topic, sixteen ways and a closed topic list, pages by way and topic generated, newest first, and stale ones caught (A-070); no cap, every new card clash-checked, a new lesson repeating an old one refused (A-093), a review due by count or days, closed months owed a digest (A-147); word stems joined by rule; every card listed by ask, spec rows read whole; the 26 Oct query lists A-015 and the skill rows; owner quotes no card carries found; repeated numbers failed and renumbered, the one on main kept, merged cards moving with their card; unsorted and unknown ways caught; sorted entries passed; trace gaps caught, a full trace passed; cards agreed without a yes refused, and with a yes he never typed, unless from before the record; desk decisions, numbered or titled, missing from the Transcript listed; evals found with their latest run; several cards on one remark each read; merged cards kept but not standing, and a merged card still cited found; an agreed card no eval names reported, refused once agreed after the check began, unless it says why it has none; gate-2 holds found; a late loop called out; unproven agreements found, proven only when every check naming one passes (T-840); two chats appending one month at once merged by git without stopping, clashing numbers and their references moved, agreements rebuilt; references outside the Transcript found and moved, main\'s left; an eval card added twice settled with its scenario, runs and references; a clash across a month boundary moved by the driver, or refused and renumbered; a month in parts read as one, a part merged by the driver, a month cut into parts on main merged without loss, and an append past the line starting the next part, a part grown past the line named and cut again word for word (T-499); the cc3b5320 shape merged with every remark once, a remark an earlier merge lost put back from main, and a merge losing a remark both parents hold named by check, under way or not yet pushed; two copies of one remark on one day refused');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
