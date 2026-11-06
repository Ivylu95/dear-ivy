// The opening flags fire when they should, and stay quiet when they should.
//
//   node .claude/hooks/session/test-opening.mjs
//
// Run by the hook self-test (selftest.mjs). Each case is a situation a cold
// walk of the check-in skill got wrong before the flags existed (the skill's
// log.md, Scenarios 1, 2, 5 and 6). Invented text only.

import { crisisMarker, openingFlags, snapshotDate } from '../lib/opening.mjs';

const TZ = 'Asia/Singapore';
const at = (iso) => new Date(iso);
const log = (...lines) => ['# Session log', '', ...lines.map((l) => `| ${l} |`)].join('\n');
const now = (updated) => `# Now\n\n_Last updated: ${updated}_\n`;

const has = (flags, word) => flags.some((f) => f.startsWith(word));

const CASES = [
  [
    'a crisis last session: soft, and it comes first',
    { log: log('2026-09-20 · check-in · work', '2026-09-25 · check-in · ended: crisis'), now: now('2026-09-25'), at: at('2026-09-26T10:00:00+08:00') },
    (f) => f[0].startsWith('LAST SESSION ENDED BADLY'),
  ],
  [
    'a panic session is ended badly too',
    { log: log('2026-09-25 · check-in · a bad week · ended: panic'), now: now('2026-09-25'), at: at('2026-09-26T10:00:00+08:00') },
    (f) => has(f, 'LAST SESSION ENDED BADLY'),
  ],
  [
    'a session cut short leaves its line ongoing, and that counts',
    { log: log('2026-09-25 · check-in · new job offer · ongoing'), now: now('2026-09-25'), at: at('2026-09-26T10:00:00+08:00') },
    (f) => has(f, 'LAST SESSION ENDED BADLY'),
  ],
  [
    'a steady session after the crisis clears it: no freeze',
    { log: log('2026-09-25 · check-in · ended: crisis', '2026-09-26 · check-in · better, a run with a friend · ended: steady'), now: now('2026-09-26'), at: at('2026-09-27T10:00:00+08:00') },
    (f) => !has(f, 'LAST SESSION ENDED BADLY'),
  ],
  [
    'an upkeep line is not a session',
    { log: log('2026-09-25 · check-in · ended: crisis', '2026-09-26 · upkeep · rewrote Eras'), now: now('2026-09-26'), at: at('2026-09-27T10:00:00+08:00') },
    (f) => has(f, 'LAST SESSION ENDED BADLY') && f.some((l) => l.includes('ended: crisis')),
  ],
  [
    'late at night by her clock, not the machine\'s (19:10 UTC is 03:10 in Singapore)',
    { log: log('2026-09-25 · check-in · work'), now: now('2026-09-25'), at: at('2026-09-26T19:10:00Z') },
    (f) => has(f, 'LATE AT NIGHT'),
  ],
  [
    'midday her time is not late, whatever UTC says (23:30 UTC is 07:30)',
    { log: log('2026-09-25 · check-in · work'), now: now('2026-09-25'), at: at('2026-09-26T23:30:00Z') },
    (f) => !has(f, 'LATE AT NIGHT'),
  ],
  [
    'no session yet: first conversation, never "welcome back"',
    { log: log('2026-09-27 · import · record moved in'), now: now('27 Sep 2026 (from the imported record)'), at: at('2026-10-20T10:00:00+08:00') },
    (f) => has(f, 'FIRST CONVERSATION') && !has(f, 'LONG GAP'),
  ],
  [
    'a snapshot three weeks old is stale, in either date shape',
    { log: log('2026-10-15 · check-in · work'), now: now('27 Sep 2026 (from the imported record)'), at: at('2026-10-20T10:00:00+08:00') },
    (f) => has(f, 'SNAPSHOT STALE'),
  ],
  [
    'a gap of weeks is named, once',
    { log: log('2026-08-01 · check-in · work'), now: now('2026-08-01'), at: at('2026-09-01T10:00:00+08:00') },
    (f) => has(f, 'LONG GAP') && has(f, 'SNAPSHOT STALE'),
  ],
  [
    'an ordinary day raises nothing but the last opener',
    { log: log('2026-09-25 · check-in · work · ended: steady'), now: now('2026-09-25'), at: at('2026-09-26T10:00:00+08:00') },
    (f) => f.length === 1 && has(f, 'LAST OPENER'),
  ],
  [
    'the words "cut short" in a steady gist would still count: the log line says how it ended in plain words',
    { log: log('2026-09-25 · check-in · a quiet one · ended: steady'), now: now('2026-09-25'), at: at('2026-09-26T10:00:00+08:00') },
    (f) => !has(f, 'LAST SESSION ENDED BADLY'),
  ],
];

let failed = 0;
for (const [name, input, ok] of CASES) {
  const flags = openingFlags({ timeZone: TZ, ...input });
  if (!ok(flags)) {
    failed++;
    console.log(`FAIL  ${name}\n      ${flags.join('\n      ') || '(no flags)'}`);
  }
}
for (const [text, want] of [
  ['_Last updated: 2026-09-14_', '2026-09-14'],
  ['_Last updated: 27 Sep 2026 (imported)._', '2026-09-27'],
  ['_Last updated: —_', null],
]) {
  if (snapshotDate(text) !== want) {
    failed++;
    console.log(`FAIL  snapshot date of "${text}": got ${snapshotDate(text)}, want ${want}`);
  }
}
// SAF-005's marker, written by safety/crisis-floor.mjs: a crisis in the very first
// message, with nothing else written, still softens the next opener.
const base = log('2026-09-20 · check-in · work · ended: steady');
const marked = `${base}\n${crisisMarker(base, '2026-09-26')}`;
const MARKER_CASES = [
  ['the marker is one line, nothing personal', crisisMarker(base, '2026-09-26') === '| 2026-09-26 · crisis · ongoing |'],
  ['a second match the same day adds nothing', crisisMarker(marked, '2026-09-26') === null],
  ['a match the next day adds a new line', crisisMarker(marked, '2026-09-27') !== null],
  [
    'the marker alone softens the next opener',
    has(openingFlags({ timeZone: TZ, log: marked, now: now('2026-09-20'), at: at('2026-09-27T10:00:00+08:00') }), 'LAST SESSION ENDED BADLY'),
  ],
  [
    'a steady session after it clears it',
    !has(
      openingFlags({ timeZone: TZ, log: `${marked}\n| 2026-09-27 · check-in · better · ended: steady |`, now: now('2026-09-27'), at: at('2026-09-28T10:00:00+08:00') }),
      'LAST SESSION ENDED BADLY',
    ),
  ],
];
for (const [name, ok] of MARKER_CASES) {
  if (!ok) {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}
console.log(failed ? `opening tests: ${failed} failed` : `opening tests: ${CASES.length + 3 + MARKER_CASES.length} cases pass`);
process.exit(failed ? 1 : 0);
