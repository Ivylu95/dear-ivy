# Take the next ID from disk, at the moment you write

**Seen 2026-10-26.** Other chats add eval cards, Transcript entries and agreement cards while a
long chat is running. A new eval card was written as E-060 from a number worked out earlier; another
chat's E-060 already sat on disk after a merge, and the write replaced it. Caught only because the
card count didn't move.

- **Read the highest ID on disk right before writing** (`ls dev/evals/cards`, the Transcript's last
  `Card A-`), never from a number held since earlier in the chat.
- **Check `git status` shows the new file as added, not modified.** A modified file you meant to create
  is someone else's work being overwritten: restore it with `git checkout` and take the next free ID.

**Seen again 2026-10-26 and 10-27, in a merge.** A Transcript conflict settled with
`git checkout --theirs` dropped this chat's own sorted entry, unseen until a grep for its
words came back empty; and an agreement card (A-098) and an eval card (E-069) this chat wrote
were taken by another chat first.

- **A Transcript clash settles itself** in the pull now (the `dialogue` merge driver, 2026-10-27);
  where a pull stops on one anyway, run `node ux/scripts/dialogue.mjs resolve`, which does the union
  below. By hand only if resolve says an entry was changed two ways.
- **Settle a Transcript conflict as a union**: main's file whole, then each entry of ours main lacks,
  appended; then `dialogue.mjs renumber` and `build`. Never one side alone. Match an entry by its quote
  **and** its Gist, never the quote alone: "Do it" is said many times, and matching on the words
  dropped a second one (2026-10-27). Grep for your own Became lines afterwards.
- **A card `renumber` moved takes its references with it**: `renumber` now moves your own lines
  citing it (main's kept); after a merge the driver moved numbers in, `dialogue.mjs check` refuses
  until `dialogue.mjs moved --fix` has moved yours. An eval card added on both sides: `resolve`.

**Seen again 2026-10-29, three times in one day** (A-123, E-069, E-078 each taken by another
chat between reading and writing). Read the highest ID from **both** disk and main on GitHub
(fetch first, then main's eval cards and main's Transcript) right before writing; and after the merge that lands it, grep for your card's words, not
its number, since `renumber` may have moved it.

**Seen again 2026-10-28 and 10-29**, on a branch main could not merge into: the disk was right, and
main had taken the same numbers for other things (E-072 to E-077, A-098, A-099, A-122 to A-125).
Reading the disk cannot see main's. **Now caught:** `ux/scripts/check-id-clash.mjs` runs in the
commit gate and names any ID both sides made since they parted for different things. When it fires,
renumber yours past main's highest, with a gap, and fix every citation in the same commit.

**Never settle a branch merge with `-X ours` (seen 2026-10-29).** It kept main's side of
thirteen clashes and silently dropped the branch's: three hazard-log entries, a skill
section, eval-card rewrites and runner tests, found only when the safety gate missed the
log. Merge plainly, and settle each clash by reading both sides; a union of both is usually right.

**Seen again 2026-11-03: `renumber` moved main's entry, not this chat's.** Two chats each had a
T-663; run by hand before pulling, `renumber` gave main's (in the month's second part) the new number,
so main's idea line, citing its old number, broke the ideas check, and the other chat's own later
pushes moved numbers again. **Pull first**, and let the merge driver settle a clash; run `renumber`
only on a clash still standing after the pull, then check with `grep` for your own entries' words
that it moved yours, and put main's back if not.

**Seen again 2026-11-05, twice in one hour** (E-121, then E-122, each taken by another chat while
this one built). The pull stopped on the card both times. The fix is `node ux/scripts/dialogue.mjs
resolve`, which keeps main's card and moves this chat's on; settling it by hand also works, but then
every reference to the old number (the Transcript's Became line, a test's comment) must be moved too.

**Seen again 2026-11-04, twice in one chat.** A card drafted as A-169 lost its number to another
chat, was renumbered A-170, and lost that too (A-172 in the end; its eval E-120 → E-121 → E-122);
the merge also moved this chat's T-753 and T-769 to T-780 and T-781. Renumbering by T-number in the
merged file then edited **another chat's** T-769, which kept that number: caught by a diff against
main and restored.

- **After a merge, find your own entry by its quoted words, never by its T-number**: the number you
  remember may now belong to someone else's entry.
- **Renumber in your own files only**: list them from your commits (`git show --stat`), and diff each
  renumbered block against GitHub's main before committing.
