// The new-chat tip fires only on a chat compacted often enough, never twice,
// never on a crisis day, and never on a missing threshold (CON-021).
//
//   node .claude/hooks/session/test-new-chat-tip.mjs
//
// Run by the hook self-test (selftest.mjs). Pure: no files written.

import { compactions, eligible, lastReplyText, tipFile, tipShown, TIP_PATTERN } from '../lib/new-chat-tip.mjs';

const typed = (text = 'hi') => ({ type: 'user', message: { content: text } });
const said = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const summary = () => ({ type: 'user', isCompactSummary: true, message: { content: 'This session is being continued...' } });
const chat = (n) => [typed(), said('ok'), ...Array.from({ length: n }, () => [summary(), typed(), said('ok')]).flat()];
const date = '2026-10-09';
const base = { tipText: '', log: '', date, need: 2 };

const CASES = [
  ['a fresh chat gets no tip', eligible({ ...base, list: chat(0) }), false],
  ['one compaction is not enough', eligible({ ...base, list: chat(1) }), false],
  ['two compactions offer it', eligible({ ...base, list: chat(2) }), true],
  ['once shown, never again', eligible({ ...base, list: chat(5), tipText: tipFile(date) }), false],
  ['a crisis day holds it back', eligible({ ...base, list: chat(3), log: `| ${date} · crisis · ongoing |` }), false],
  ['an earlier crisis day does not', eligible({ ...base, list: chat(3), log: '| 2026-10-01 · crisis · ongoing |' }), true],
  ['a missing threshold does nothing', eligible({ ...base, list: chat(9), need: null }), false],
  ['compactions are counted', compactions(chat(3)), 3],
  ['the written file reads as shown', tipShown(tipFile(date)), true],
  ['the last reply is read, not an earlier one', lastReplyText([typed(), said('a new chat is fine'), typed(), said('ok')]), 'ok'],
  ['the tip is recognised', TIP_PATTERN.test('You can start a new chat any time.'), true],
  ['ordinary talk is not', TIP_PATTERN.test('We had a chat about it.'), false],
];

let failed = 0;
for (const [what, got, want] of CASES) {
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
if (failed) process.exit(1);
console.log(`new-chat tip: ${CASES.length} cases pass`);
