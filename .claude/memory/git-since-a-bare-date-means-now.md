# `git log --since=<date>` means that date at the current time

**The trap.** Given a bare date, git's date parser fills in the *current* time
of day: `--since=2026-09-30` run at 16:05 means 2026-09-30 16:05, and every
commit from earlier that day is silently left out.

**Seen 2026-09-30.** The owed-review check read the harness commits since
DEV-020 began; it found none of a chat's commits made before the time the check
ran, so that chat was never told it owed a review.

**Do instead.** Pin the time: `--since=2026-09-30T00:00:00Z`. Any bare
`--since=`/`--until=` date in a hook or script is this bug waiting.

**Seen again 2026-10-03**, in the admin Changes activity chart
(`dev/ui/lib/git.js`): written with a bare date despite this note; harmless
only because the window started a day early. A template like
`` `--since=${…slice(0, 10)}` `` is the same bug and no grep finds it, so pin
`T00:00:00Z` whenever a date reaches `--since`.
