# A branch main cannot merge is settled first

**Hit 2026-10-30 to 31**, in a long development chat. The session start said
"main could not be merged into this branch", and the work went on regardless.
By the time it was merged, main was 325 commits ahead and had changed underneath
it three times: the backlog retired for `dev/for-you.md`, the eval history split
into one file a day, the dev rows moved to the workbench register, and the
Transcript's month split into parts. Twenty-eight files clashed, then nine, then
one, over three merges in one evening.

- **Settle it before the next piece of work.** Every commit made on a branch main
  cannot merge makes the merge larger, and main reorganises often. Merge
  GitHub's main in, settle it, and only then build.
- **When the driver cannot line entries up, replay instead.** Main moved remarks
  this branch had edited into other parts, so the three-way merge stopped on
  "changed here and removed on main". What worked: take main's Transcript whole,
  then replay this branch's changes onto it by content: each card block that
  differs, by its A number; each remark main lacks, matched by date and words,
  appended to the newest part under the next free number; tags put back by date,
  words and gist (a bare "Yes" or "Ok" matches several remarks, so the gist is
  part of the key).
- **Files a script writes must be named when staged.** `dialogue.mjs build` writes
  the pages in `dev/dialogue/index/`; the touched-files record never saw them, so
  the gate refused them as another chat's. Stage them by name in the command
  (`git add -- dev/dialogue/index/README.md …`), and the gate knows them.
- **A test over the live Transcript asserts only its rule's scope.** One asserting
  every remark carried a topic broke the moment another chat's untagged remark
  merged in; the rule itself starts on a date, and so does the test now.
- **A red unit test on code identical to main** was a stale install (a library
  four majors behind the lockfile): `npm install` from `ux/`, never `npm ci` in
  the shared tree.
