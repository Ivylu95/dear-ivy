# Settling a record merge without reading its history

The session-start hook hands over branches that "conflict with main; its saves
must reach main", often a `rescue/…` or another chat's branch touching `data/`.
The guard refuses `git show`, `git diff` and `git checkout` on a record file
(DAT-005), so neither side can be read from history.

**Do.** Merge in a worktree of GitHub's main. Read the conflicted file as it is
on disk: split each conflict block into its two sides, parse both, and keep the
union (for a JSON list, every item from both, deduplicated by content, in time
order; for prose, every line). Then compare each record file the merge touched
with main's current copy, by items or lines, and land only if nothing of main's
is missing. Never take one side whole without that comparison.

**The Transcript collides by number.** Each chat's hook numbers a remark from its
own copy of `dev/dialogue/transcript/<month>.md`, so two chats saving at once write
the same T-number. Keep both entries: drop only an exact duplicate, give the later
clash the next free number, run `node ux/scripts/dialogue.mjs build` and `check`.
It happened four times on 2026-10-20 alone (backlog: number at merge time), and eight times
in one hour on 2026-10-27, when two chats worked the same review: card numbers and eval card
numbers clashed too (E-068 and E-069 each taken twice). Since 2026-10-27 the `dialogue` merge
driver settles Transcript and card clashes inside the pull, and `dialogue.mjs resolve` settles a pull
that stopped anyway (eval card numbers still clash by hand). By hand: take main's text whole and
add your own entry back at the end; a hand-written resolver that split entries on headings once
dropped one and glued a remark onto the other chat's entry. `renumber` now moves a merged card's
pointer with the card it points at, when the pointer is your own unpublished work.

**A worktree needs its packages.** The commit gate in a fresh worktree fails on
missing modules until `npm --prefix ux ci` and `node dev/ui/scripts/link-deps.mjs`
have run there.
