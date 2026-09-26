// The profile rules catch what they should, and pass what they should.
//
//   node .claude/hooks/record/test-profile.mjs
//
// Run by the hook self-test (selftest.mjs) and by `npm run check`.
//
// Each case breaks a valid profile in one way and names the error it must
// produce. A rule that stops firing fails here before it fails on her record.

import { migrateLegacyProfile, readProfile, renderProfile } from '../lib/profile-schema.mjs';

const T = '2026-09-25T20:02:00+08:00';
const good = renderProfile({
  name: { value: 'Sam', status: 'answered', last_updated: T },
  pronouns: { value: 'they', status: 'answered', last_updated: T },
  timezone: { value: 'Asia/Singapore', status: 'answered', last_updated: T },
  wants_from_this: { value: 'Think things through: "out loud"\nand some advice', status: 'answered', last_updated: T },
  how_to_speak_to_me: { status: 'asked', status_reason: 'session ended first', last_updated: T },
  bad_night_person: { status: 'declined', status_reason: 'rather not: say', revisit_when: 'a hard night comes up', last_updated: T },
});

const swap = (a, b) => {
  if (!good.includes(a)) throw new Error(`test setup: "${a}" not in the profile`);
  return good.replace(a, b);
};

const CASES = [
  ['a valid profile', good, null],
  ['the blank template', renderProfile({}), null],
  ['a status outside the five', swap('status: answered', 'status: rejected'), /must be one of/],
  ['a date with no time', swap(`last_updated: ${T}`, 'last_updated: 2026-09-25'), /date and time with an offset/],
  ['a time with no offset', swap(`last_updated: ${T}`, 'last_updated: 2026-09-25T20:02:00'), /date and time with an offset/],
  ['an impossible date', swap(`last_updated: ${T}`, 'last_updated: 2026-09-31T20:02:00+08:00'), /not a real date/],
  ['a future date', swap(`last_updated: ${T}`, 'last_updated: 2099-01-01T00:00:00+08:00'), /in the future/],
  ['answered with no value', swap('value: Sam', 'value:'), /answered but its value is empty/],
  ['a value on a question not answered', swap('status: asked', 'status: asked\n    value: x'), /appears twice|only answered carries a value/],
  ['declined with no revisit_when', swap('revisit_when: a hard night comes up', 'revisit_when:'), /no revisit_when/],
  ['revisit_when when not declined', swap('status: asked', 'status: asked\n    revisit_when: later'), /only declined carries one/],
  ['an unquoted colon', swap('status_reason: session ended first', 'status_reason: ended: early'), /contains ": "/],
  ['a pronoun outside the three', swap('value: they', 'value: him'), /"she", "he" or "they"/],
  ['an unknown time zone', swap('value: Asia/Singapore', 'value: Mars/Base'), /not a time zone/],
  ['an unknown question', swap('  lives_with:', '  lives:'), /not a question/],
  ['a question in the wrong section', swap('recommended:\n', 'recommended:\n\n  name:\n    value: x\n'), /wrong section|appears twice/],
  ['an unknown section', swap('optional:', 'extras:'), /not a section/],
  ['sections out of order', good.replace(/^mandatory:/m, 'mandatoryX:').replace(/^optional:/m, 'mandatory:').replace(/^mandatoryX:/m, 'optional:'), /out of order|wrong section/],
  ['a tab', swap('    status: answered', '\tstatus: answered'), /tab/],
  ['an unknown key', swap('status: asked', 'status: asked\n    mood: fine'), /not a key/],
  ['a missing key', swap(`    status_reason:\n    last_updated: ${T}\n\n  # she`, `    last_updated: ${T}\n\n  # she`), /has no "status_reason"/],
];

let failed = 0;
for (const [label, text, expect] of CASES) {
  const { errors } = readProfile(text);
  const ok = expect ? errors.some((e) => expect.test(e)) : errors.length === 0;
  if (!ok) {
    failed += 1;
    console.error(`  ✗ ${label}: ${expect ? `expected ${expect}` : 'expected no errors'}, got ${JSON.stringify(errors)}`);
  }
}

// The old flat shape migrates to a valid profile, losing nothing.
const legacy = 'name: Sam\npronouns: they\ntimezone: Asia/Singapore\nwants_from_this: |\n  Think: out loud\nhow_to_speak_to_me: |\n  asked 2026-09-25, no answer yet\nbad_night_person: |\n  declined 2026-09-25, ask again if a hard night comes up\n';
const migrated = readProfile(migrateLegacyProfile(legacy, new Date('2026-09-25T12:00:00Z')));
const q = migrated.questions;
if (
  migrated.errors.length || q.name.value !== 'Sam' || q.wants_from_this.value !== 'Think: out loud' ||
  q.how_to_speak_to_me.status !== 'asked' || q.bad_night_person.status !== 'declined' ||
  q.bad_night_person.revisit_when !== 'ask again if a hard night comes up' || q.name.last_updated !== '2026-09-25T20:00:00+08:00'
) {
  failed += 1;
  console.error(`  ✗ migration from the old shape: ${JSON.stringify({ errors: migrated.errors, q }, null, 1).slice(0, 600)}`);
}

if (failed) {
  console.error(`\n  PROFILE TESTS FAILED: ${failed} of ${CASES.length + 1}\n`);
  process.exit(1);
}
console.log(`profile tests: ${CASES.length + 1} cases pass`);
