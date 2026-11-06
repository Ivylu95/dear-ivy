// An everyday reply with headings is caught, and plain prose passes (CON-014).
//
//   node .claude/hooks/session/test-everyday-reply.mjs
//
// Run by the hook self-test (selftest.mjs). Invented text only.

import { headingProblem, sentenceProblem } from '../lib/everyday-reply.mjs';
import { relationshipProblem } from '../lib/everyday-reply.mjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planNumbers, roleNumbers, safetyReplyPattern } from '../lib/everyday-reply.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const CASES = [
  ['a reply with ## headings is caught', "## How you're feeling\nThat sounds exhausting.\n\n## Next steps\nMaybe talk to them tomorrow.", true],
  ['a single # heading is caught', '# Today\nThat sounds hard.', true],
  ['short prose with a ruled 📝 line passes', "That sounds exhausting.\n\nWhat part of today is sitting heaviest?\n\n---\n📝 I've kept that the deadline moved again.", false],
  ['a heading inside a code block passes', 'Here is the text:\n```\n## Not a heading\n```', false],
  ['a hashtag mid-line passes', 'We talked about #goals and it went fine.', false],
  ['a safety reply is never held to a format', '## Please call\nSOS on 1767 now.', false],
];

// CON-008: wording that claims feeling or waiting is caught; remembering is not.
const RELATIONSHIP = [
  ['"I missed you" is caught', "I missed you since Tuesday. How did the week go?", true],
  ['"I\'ve been waiting" is caught', "I've been waiting to hear how it went.", true],
  ['"I\'m so glad you\'re back" is caught', "I'm so glad you're back!", true],
  ['"I was thinking about you" is caught', "I was thinking about you after we last spoke.", true],
  ['"I\'m here for you, always" is caught', "I'm always here for you.", true],
  ['"our friendship" is caught', "Our friendship matters to me.", true],
  ['recalling the record passes', "Last Tuesday you told me the review was moved to Friday. Did it happen?", false],
  ['talking about her missing someone passes', "You said you missed your sister on Sunday.", false],
  ['a safety reply is never held to a format', "I'm here for you always. SOS on 1767 now.", false],
];

let failed = 0;
for (const [what, text, caught] of RELATIONSHIP) {
  if (Boolean(relationshipProblem(text)) !== caught) {
    failed += 1;
    console.error(`FAIL ${what}`);
  }
}
for (const [what, text, caught] of CASES) {
  if (Boolean(headingProblem(text)) !== caught) {
    failed += 1;
    console.error(`FAIL ${what}`);
  }
}
// SAF-016: a copy whose plan holds another country's lines (fictional numbers
// here) is judged the same way; with no plan, Singapore's alone, as before.
const dir = makeTemp('crisis-plan-');
const OTHER = join(dir, 'other.md');
const NONE = join(dir, 'absent.md');
writeFileSync(OTHER, [
  '# Safety plan', '', '## If you need help right now', '',
  '- **Test Crisis Line (TCL): 0000 0001** — 24 hours',
  '- **TCL Text: 0000 0002** — if talking is too much',
  '- **Test Helpline: 0000 0003** — 24 hours · **WhatsApp: 0000 0004**',
  '- **Emergency: 000**', '', '## My warning signs', '', '- **Not a number: words**', '',
].join('\n'));
const PLANS = [
  ['her plan: its numbers are read by role', () => JSON.stringify(planNumbers(OTHER)) === JSON.stringify({ first: '0000 0001', text: '0000 0002', later: '0000 0003', emergency: '000', all: ['0000 0001', '0000 0002', '0000 0003', '0000 0004', '000'] })],
  ['her plan: each role accepts hers and Singapore\'s', () => roleNumbers(OTHER).first.join() === '1767,0000 0001' && roleNumbers(OTHER).emergency.join() === '995,000'],
  ['no plan: Singapore\'s, by role', () => roleNumbers(NONE).first.join() === '1767' && roleNumbers(NONE).text.join() === '9151 1767' && planNumbers(NONE).all.length === 0],
  ['her plan: a heading reply giving her first line is not held to a format', () => !headingProblem('## Please call\nThe crisis line on 0000 0001 now.', OTHER)],
  ['a sentence strung with semicolons is noted (A-171)', () => /A-171/.test(sentenceProblem('That sounds like a lot; work, the gym; and dinner too.', OTHER))],
  ['plain short sentences are not noted (A-171)', () => sentenceProblem('That sounds like a full week. Which part weighed most?', OTHER) === ''],
  ['a safety reply is never held to the sentence check', () => sentenceProblem('Please call the line on 0000 0001 now; it is open; they will answer, and stay with you while you talk it through for as long as you need tonight.', OTHER) === ''],
  ['her plan: her emergency number alone marks it', () => !headingProblem('## Now\nCall 000.', OTHER)],
  ['her plan: her WhatsApp number marks it', () => !headingProblem('## Now\nMessage 0000 0004.', OTHER)],
  ['her plan: Singapore\'s numbers still mark it', () => !headingProblem('## Please call\nSOS on 1767 now.', OTHER)],
  ['her plan: an ordinary heading reply is still caught', () => Boolean(headingProblem('## Today\nThat sounds hard.', OTHER))],
  ['her plan: a bond claimed beside her number is not held', () => !relationshipProblem("I'm here for you always. Call 0000 0001 now.", OTHER)],
  ['her plan: a bond claimed without one is still caught', () => Boolean(relationshipProblem("I'm always here for you.", OTHER))],
  ['no plan: another country\'s number does not mark it', () => Boolean(headingProblem('## Please call\nThe crisis line on 0000 0001 now.', NONE))],
  ['no plan: Singapore\'s numbers mark it, as before', () => !headingProblem('## Please call\nSOS on 1767 now.', NONE) && !relationshipProblem("I'm here for you always. SOS on 1767 now.", NONE)],
  ['no plan: the pattern is Singapore\'s, unchanged', () => String(safetyReplyPattern(NONE)) === String(/\b(1767|995|1771)\b|are you safe/i)],
  ['no plan: "are you safe" still marks it', () => !headingProblem('## Now\nAre you safe right now?', NONE)],
];
for (const [what, ok] of PLANS) {
  if (!ok()) {
    failed += 1;
    console.error(`FAIL ${what}`);
  }
}
rmSync(dir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log(`everyday reply tests: ${CASES.length} cases pass`);
console.log(`crisis numbers by country: ${PLANS.length} cases pass`);
console.log(`relationship wording tests: ${RELATIONSHIP.length} cases pass`);
