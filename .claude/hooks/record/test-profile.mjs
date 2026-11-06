// The profile rules catch what they should, and pass what they should.
//
//   node .claude/hooks/record/test-profile.mjs
//
// Run by the hook self-test (selftest.mjs) and by `npm run check`.
//
// Each case breaks a valid profile in one way and names the error it must
// produce. A rule that stops firing fails here before it fails on her record.

import { migrateLegacyProfile, owedQuestions, readProfile, renderProfile } from '../lib/profile-schema.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const T = '2026-09-25T20:02:00+08:00';
const good = renderProfile({
  name: { value: 'Person-S', status: 'answered', last_updated: T },
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
  ['answered with no value', swap('value: Person-S', 'value:'), /answered but its value is empty/],
  ['a value on a question not answered', swap('status: asked', 'status: asked\n    value: x'), /appears twice|only answered carries a value/],
  ['declined with no revisit_when', swap('revisit_when: a hard night comes up', 'revisit_when:'), /no revisit_when/],
  ['revisit_when when not declined', swap('status: asked', 'status: asked\n    revisit_when: later'), /only declined carries one/],
  ['ask_after on an asked question', swap('status: asked', 'status: asked\n    ask_after: 2026-10-11'), null],
  ['ask_after that is not a date', swap('status: asked', 'status: asked\n    ask_after: next week'), /must be a date/],
  ['ask_after when not asked', swap('status: answered', 'status: answered\n    ask_after: 2026-10-11'), /only asked carries one/],
  ['an unquoted colon', swap('status_reason: session ended first', 'status_reason: ended: early'), /contains ": "/],
  ['a pronoun outside the three', swap('value: they', 'value: him'), /"she", "he" or "they"/],
  ['an unknown time zone', swap('value: Asia/Singapore', 'value: Mars/Base'), /not a time zone/],
  ['an unknown question', swap('  lives_with:', '  lives:'), /not a question/],
  ['a question in the wrong section', swap('recommended:\n', 'recommended:\n\n  name:\n    value: x\n'), /wrong section|appears twice/],
  ['an unknown section', swap('optional:', 'extras:'), /not a section/],
  ['sections out of order', good.replace(/^mandatory:/m, 'mandatoryX:').replace(/^optional:/m, 'mandatory:').replace(/^mandatoryX:/m, 'optional:'), /out of order|wrong section/],
  ['a tab', swap('    status: answered', '\tstatus: answered'), /tab/],
  ['an unknown key', swap('status: asked', 'status: asked\n    mood: fine'), /not a key/],
  ['a header edited by hand', good.replace('#   status_reason  Free text', '#   status_reason  Optional note'), /header comment is not the one/],
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
const legacy = 'name: Person-S\npronouns: they\ntimezone: Asia/Singapore\nwants_from_this: |\n  Think: out loud\nhow_to_speak_to_me: |\n  asked 2026-09-25, no answer yet\nbad_night_person: |\n  declined 2026-09-25, ask again if a hard night comes up\n';
const migrated = readProfile(migrateLegacyProfile(legacy, new Date('2026-09-25T12:00:00Z')));
const q = migrated.questions;
if (
  migrated.errors.length || q.name.value !== 'Person-S' || q.wants_from_this.value !== 'Think: out loud' ||
  q.how_to_speak_to_me.status !== 'asked' || q.bad_night_person.status !== 'declined' ||
  q.bad_night_person.revisit_when !== 'ask again if a hard night comes up' || q.name.last_updated !== '2026-09-25T20:00:00+08:00'
) {
  failed += 1;
  console.error(`  ✗ migration from the old shape: ${JSON.stringify({ errors: migrated.errors, q }, null, 1).slice(0, 600)}`);
}

// A question with a default is known without asking: a blank profile reads the
// default and does not owe the question (MEM-014, timezone).
const blank = readProfile(renderProfile({}));
if (blank.value.timezone !== 'Asia/Singapore' || owedQuestions(blank.questions).some((o) => o.key === 'timezone')) {
  failed += 1;
  console.error(`  ✗ a default is known, not owed: ${blank.value.timezone}`);
}

// The sweep reads the repository it lives in, from whatever folder it runs:
// ux/lib/checks.mjs runs it from ux/, where it once found no template.
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const sweepFrom = (cwd) => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('check-profile.mjs', import.meta.url)), '--all'], { cwd, env, encoding: 'utf8' });
  return `${r.status} ${r.stdout}${r.stderr}`;
};
const fromRoot = sweepFrom(repo);
const fromUx = sweepFrom(fileURLToPath(new URL('../../../ux/', import.meta.url)));
if (fromRoot !== fromUx) {
  failed += 1;
  console.error(`  ✗ the sweep reads the same from ux/ as from the root:\n    root: ${fromRoot.trim()}\n    ux/:  ${fromUx.trim()}`);
}

if (failed) {
  console.error(`\n  PROFILE TESTS FAILED: ${failed} of ${CASES.length + 3}\n`);
  process.exit(1);
}
console.log(`profile tests: ${CASES.length + 3} cases pass`);
