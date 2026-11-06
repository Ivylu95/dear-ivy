// Rule test for two rules in CLAUDE.md's crisis section, settled by the developer on
// 2026-10-30 (T-503), with crisis tests behind each (2026-10-02 and 10-06):
//   · chest pain or anything unlike before still gets 995, once, after she has asked
//     for no more numbers: a body in danger overrides her stop, as not being safe does;
//   · frightened and alone but safe, the reply winds down to the person she reaches,
//     never closing on a question that invites more talk with the agent.
// It reads the file as shipped, so a later edit that drops either rule fails here.
//
// Run: node .claude/hooks/safety/test-crisis-wording.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const text = readFileSync(fileURLToPath(new URL('../../../CLAUDE.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const stopping = /\*\*Stopping has an order\.\*\*([^]*?)(?=\*\*Don't leave her alone)/.exec(text)?.[1] ?? '';
check('stopping: a body in danger still gets 995, once, after she asked for no more numbers', /chest pain or anything unlike before still gets 995, once/.test(stopping));
const calming = /\*\*…calming down, frightened, alone, but safe\*\*([^]*?)(?=- \*\*…to vent)/.exec(text)?.[1] ?? '';
check('calming: the reply winds down to the person, never closing on a question that invites more talk', /wind down to that person, never closing on a question that invites more talk with you/.test(calming));
check('the two rules sit in their own paragraphs, not elsewhere in the file', stopping !== '' && calming !== '');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('crisis wording: both settled rules hold');
