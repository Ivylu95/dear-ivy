#!/usr/bin/env node
// The name match behind a person's timeline mentions and the safety plan's dial
// row, and the privacy check's name scan (lib/name-match.mjs). Each used `\b`,
// which is ASCII-only, so a name ending in a non-ASCII letter never matched
// (backlog, 2026-10-04 and 2026-10-05). Placeholders only, never a name anyone is
// called: a real one here stops any copy whose record holds it (check-privacy.mjs).
//
// Run from ux/: node scripts/test-name-match.mjs

import { nameMatcher, wholeNameMatcher } from '../lib/name-match.mjs';

const cases = [
  ['Person-É matches at the end of a line', 'Person-É', 'Coffee with Person-É', true],
  ['Person-É matches before punctuation', 'Person-É Placeholder', 'Called Person-É, then slept', true],
  ['Person-Ë matches', 'Person-Ë', 'person-ë rang about the weekend', true],
  ['Person-Ë does not match inside a longer word', 'Person-Ë', 'Person-Ëlle came round', false],
  ['Person-Q matches alone', 'Person-Q', 'Walked with Person-Q.', true],
  ['Person-Q does not match Person-Qabel', 'Person-Q', 'Person-Qabel phoned', false],
  ['Person-Q does not match inside Xperson-Q', 'Person-Q', 'Xperson-Q phoned', false],
  ['a name after a digit is not a word', 'Person-Q', '2Person-Q', false],
  ['a name in another script matches', 'Пример', 'Talked to Пример today', true],
  ['regex characters in a name are literal', 'A.J.', 'Saw A.J. at lunch', true],
  ['regex characters do not wildcard', 'A.J.', 'Saw AxJx at lunch', false],
];

let failed = 0;
for (const [what, name, text, expected] of cases) {
  const ok = nameMatcher(name).test(text) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

// The privacy check's scan matches each full name the record holds, whole
// (scripts/check-privacy.mjs). It used `\b` too, so a name ending in ë passed.
const whole = [
  ['the check catches Person-Ë at the end of a line', 'person-ë', '// fixture for person-ë', true],
  ['the check catches Person-É before punctuation', 'person-é', 'Ask Person-É, then file it', true],
  ['the check catches a full name, space and all', 'person-q placeholder', 'cc Person-Q Placeholder on this', true],
  ['the check does not cut a full name to its first word', 'person-q placeholder', 'cc Person-Q Other on this', false],
  ['the check ignores Person-Ë inside a longer word', 'person-ë', 'Person-Ëlle came round', false],
  ['the check treats regex characters literally', 'a.j.', 'saw AxJx', false],
];
for (const [what, name, text, expected] of whole) {
  const ok = wholeNameMatcher(name).test(text) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

for (const empty of ['', '   ', null, undefined]) {
  const ok = nameMatcher(empty) === null && wholeNameMatcher(empty) === null;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} no matcher for ${JSON.stringify(empty)}`);
}

if (failed) {
  console.error(`\nname match: ${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nname match: every case passes');
