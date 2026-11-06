#!/usr/bin/env node
// Rule test for card A-163: a line that reads like a rule for everyone is found in a standing
// file of the record, a line of hers is not, unfilled template text in a day's log is found,
// and a reviewed line is never raised again. Everything is made up; nothing personal.

import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findings, ruleLike } from './record-rules.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let n = 0;
const is = (line, want, why) => { n += 1; assert.equal(ruleLike(line), want, why); };

is('- Never open a reply with a label-style opener.', true, 'a do-and-do-not line is a rule');
is('- Show the reminders as a table, newest first.', true, 'a format line is a rule');
is('- Check-ins should go before meals, never after a long gap.', true, 'a check-in rule');
is('- Don\'t push on the topic of moving house; she said "not now" on 12 Oct.', false, 'her words and a date make it hers');
is('- I hate being asked twice.', false, 'the first person is hers');
is('- Squat 95 kg, a new best.', false, 'a fact is not a rule');
is('- Fibre goal 30 g every day.', false, 'a number with a unit is hers');
is('Short.', false, 'too short to judge');
is('|---|---|', false, 'a table rule is not a rule');

const dir = makeTemp('record-rules-');
try {
  mkdirSync(join(dir, 'core', 'me'), { recursive: true });
  mkdirSync(join(dir, 'fitness', 'days'), { recursive: true });
  mkdirSync(join(dir, 'core', 'journal'), { recursive: true });
  writeFileSync(join(dir, 'core', 'me', 'how_to_talk_to_me.md'), '# How\n\n_What lands badly, and what to do instead._\n\n- Never open a reply with a label-style opener.\n- She said "slow down" on 3 Oct.\n\n```\n- Always format code as a table, inside a fence.\n```\n');
  writeFileSync(join(dir, 'core', 'journal', '2026-01-01.md'), '- Always write the journal as a table.\n');
  writeFileSync(join(dir, 'fitness', 'days', '2026-01-02.md'), '**Day so far:** kcal · protein. Then, only once asked, the rest\n');
  const found = findings(dir);
  assert.equal(found.filter((f) => f.kind === 'rule').length, 1, 'one rule found: not her quote, not the italic note, not the fenced line, not the journal'); n += 1;
  assert.equal(found.filter((f) => f.kind === 'unfilled').length, 1, 'template text left in a day log is found'); n += 1;
  assert.ok(found.every((f) => /^[0-9a-f]{16}$/.test(f.print)), 'each finding carries a fingerprint, not just words'); n += 1;
  const again = findings(dir, new Set(found.map((f) => f.print)));
  assert.equal(again.length, 0, 'a reviewed line is never raised again'); n += 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`record rules: ${n} cases hold (rules found, hers left alone, template text found, reviewed lines quiet)`);
