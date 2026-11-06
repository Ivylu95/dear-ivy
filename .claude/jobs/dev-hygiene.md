---
emoji: 🧹
runs: local
gate: dev
every: 7 days
governs: WKB-004 in dev/specs/system/workbench.md, and PMM-006 in dev/specs/system/skills.md (the spec registers due their review)
---
# Heartbeat: development hygiene

An unattended run, in a fresh session with no one present. It keeps a failing
check or a stale item from becoming normal between development chats (`WKB-004`,
*"A failing check is never left to become normal."*), so the next development
chat opens on whatever needs attention without anyone looking for it.

There is no backlog (A-152). This run is an audit, so it changes nothing it
audits (`MNT-009`): what it finds is dropped, named in the reply and met again
next week, unless it needs the developer, when it becomes one plain question for
him, passed in the reply under `For you:` for the orchestrator to put on
`dev/for-you.md`, and never one already there. The fixing is done by the jobs
fenced for it (`heartbeat-doctor`, `code-maintenance`) and by development chats.

1. Run `npm run check` from `ux/`, and `node .claude/hooks/selftest.mjs`.
1a. Measure growth and retrieval (`HYG-001`..`HYG-005`, `dev/specs/system/hygiene.md`):
   from `ux/`, `npm run hygiene -- --log` and `npm run retrieval -- --log` (about
   $0.20 and a minute). The log keeps the measure. A crossed line is a proposal
   only someone may accept (`HYG-005`), so it is one question for the developer
   per file outside `data/` (`<file> is past the one-pass line: split it where it
   reads in two?`), and one per FALL warning from the retrieval run; for
   repetition, **one question in all**, naming the count and the three largest
   pairs, never one per pair (2026-10-28: one per pair added 275 lines); for
   `data/`, one giving only the count per folder, never a file name. Skip one
   already on the list, matching by file, never by line number.
2. A check that fails is never fixed here, and never added to a ratchet's known
   list. The commit gate already holds it red for the next development chat, so
   it is dropped, named in the reply; only one whose cause needs the developer's
   decision is one question for him.
3. Read the warnings `node ux/scripts/check-for-you.mjs` prints. A question
   waiting over two weeks, or listed twice, is named in the reply. Chats that owe
   an end-of-session review are not filed: the next development chat is told of
   each (`DEV-021`) and runs it there
   (`node .claude/hooks/lib/dev-review.mjs done <id>`).
4. Run `node .claude/hooks/lib/currency.mjs` for the spec registers due their
   review (`PMM-006`) and name the count in the reply; the dev menu offers the
   oldest (`MNT-008`). No line for a skill past its re-check: a skill checks
   itself the next time it is used (A-015). Never review here: it needs a
   person's judgement.
5. Nothing to commit but the hygiene and retrieval logs: commit those with the
   `commit` skill, and push.
6. Record the outcome: `node .claude/hooks/lib/heartbeats.mjs finish dev-hygiene ok`,
   or `failed` if the run could not do its job (`HBT-004`, `HBT-008`). A run
   started by hand claims first with `claim dev-hygiene`, from a checkout of its
   own (`HBT-007`).

Never during one of her conversations, never touching `data/`, and nothing
personal in a question.
