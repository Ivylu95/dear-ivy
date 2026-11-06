// The end-of-session review's state is judged from pushed history (DEV-020).
//
//   node .claude/hooks/session/test-dev-review.mjs
//
// Run by the hook self-test (selftest.mjs). Pure: no git, no files.

import { decide, ownUncommitted } from '../lib/dev-review.mjs';

// Commits a..d in order; a review "at c" covers a, b and c, not d.
const order = ['a', 'b', 'c', 'd'];
const coveredBy = (commit, reviewed) => order.indexOf(commit) <= order.indexOf(reviewed);
const base = { commits: [], reviewed: '', coveredBy, uncommitted: false, confirmed: false };

const CASES = [
  ['no harness work owes nothing', { ...base }, 'none'],
  ['harness commits and no review owe one', { ...base, commits: ['a'] }, 'owed'],
  ['a review covering every commit is done, then announced', { ...base, commits: ['a', 'b'], reviewed: 'c' }, 'confirm'],
  ['once announced it is settled', { ...base, commits: ['a', 'b'], reviewed: 'c', confirmed: true }, 'settled'],
  ['a commit after the review owes it again', { ...base, commits: ['a', 'd'], reviewed: 'c', confirmed: true }, 'owed'],
  ['uncommitted harness edits owe it too', { ...base, commits: ['a'], reviewed: 'c', uncommitted: true }, 'owed'],
  ['a machine that lost its marker still reads the pushed review', { ...base, commits: ['a'], reviewed: 'c', confirmed: false }, 'confirm'],
];

let failed = 0;
for (const [what, input, want] of CASES) {
  const got = decide(input);
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: expected ${want}, got ${got}`);
  }
}

// Whose unsaved change it is: this chat touched x.mjs at 1000 ms.
const touched = new Set(['.claude/hooks/x.mjs', 'ux/lib']);
const OWN = [
  ['an edit touched here and never committed is this chat\'s', { dirty: ['.claude/hooks/x.mjs'], touched, touchedAt: new Map([['.claude/hooks/x.mjs', 1000]]), committedAt: () => 0 }, true],
  ['an edit touched here after its last commit is this chat\'s', { dirty: ['.claude/hooks/x.mjs'], touched, touchedAt: new Map([['.claude/hooks/x.mjs', 3000]]), committedAt: () => 2999 }, true],
  ['another chat\'s edit to a file this chat touched and committed is not', { dirty: ['.claude/hooks/x.mjs'], touched, touchedAt: new Map([['.claude/hooks/x.mjs', 1000]]), committedAt: () => 1999 }, false],
  ['a file this chat never touched is not', { dirty: ['README.md'], touched, touchedAt: new Map(), committedAt: () => 0 }, false],
  ['a touch with no time kept still counts', { dirty: ['.claude/hooks/x.mjs'], touched, touchedAt: new Map(), committedAt: () => 1999 }, true],
  ['a folder touched after the file\'s commit counts for the file in it', { dirty: ['ux/lib/a.js'], touched, touchedAt: new Map([['ux/lib', 5000]]), committedAt: () => 1999 }, true],
  // 2026-10-06: "dev" named in a grep claimed another chat's new dev/specs/META.md.
  ['another chat\'s new file deep under a folder named here is not', { dirty: ['dev/specs/META.md'], untracked: new Set(['dev/specs/META.md']), touched: new Set(['dev']), touchedAt: new Map([['dev', 5000]]), committedAt: () => 0 }, false],
  // Then an ls of dev/specs claimed another chat's dev/specs/image, written a day before.
  ['another chat\'s new folder, its folder only read here later, is not', { dirty: ['dev/specs/image'], untracked: new Set(['dev/specs/image']), touched: new Set(['dev/specs']), touchedAt: new Map([['dev/specs', 90_000_000]]), committedAt: () => 0, modifiedAt: () => 1000 }, false],
  ['a new file a command put in a folder named in it is this chat\'s', { dirty: ['ux/lib/new.js'], untracked: new Set(['ux/lib/new.js']), touched, touchedAt: new Map([['ux/lib', 5000]]), committedAt: () => 0, modifiedAt: () => 4000 }, true],
  ['a new file written here by name is this chat\'s', { dirty: ['dev/specs/new.md'], untracked: new Set(['dev/specs/new.md']), touched: new Set(['dev/specs/new.md']), touchedAt: new Map([['dev/specs/new.md', 5000]]), committedAt: () => 0 }, true],
  ['a new folder holding a file written here is this chat\'s', { dirty: ['dev/specs/image'], untracked: new Set(['dev/specs/image']), touched: new Set(['dev/specs/image/a.png']), touchedAt: new Map([['dev/specs/image/a.png', 5000]]), committedAt: () => 0 }, true],
  ['a tracked file deep under a folder named here still counts', { dirty: ['dev/specs/x.md'], touched: new Set(['dev']), touchedAt: new Map([['dev', 5000]]), committedAt: () => 1999 }, true],
];
for (const [what, input, want] of OWN) {
  const got = ownUncommitted(input);
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: expected ${want}, got ${got}`);
  }
}
if (failed) process.exit(1);
console.log(`dev review tests: ${CASES.length + OWN.length} cases pass`);
