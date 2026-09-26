---
name: commit
description: About to commit in this repository - after a material write to data/, after a change to the harness or the dashboard, or when asked to save, commit or push. Use to get the type, scope, summary and body right, because every commit is rendered as a row in the Changes tab for a person to read and is the only place a future session can find why something changed. Also covers when to push and why never to open a pull request. Harness work, never her record.
---

# Writing a commit

A commit here has two readers, and it used to have none.

`.claude/CLAUDE.md` still says commit messages "are read by no one". That was
true when the only way to see the log was a terminal. It is not true now: the
dashboard has a **Changes** tab — `/changes`, built from `ux/lib/git.js` — that
renders `git log` as a list a person reads at a glance. A message written as a
note to nobody now shows up as a row on a surface.

The second reader is a later session. The log is the only place in this
repository that says **why** something changed. Specs say what is meant to be
true; code says what is; the commit is where the argument between those two got
settled, and it is the only record of it that is addressable — `git log --grep=`
finds it, `git show <hash>` proves it.

So: write for both. A summary a person can scan, a body an agent can search.

## The two rules that are not style

**Nothing personal goes in a message.** `data/` is committed — privacy here comes
from who can open the repository, not from what is left out of it
(**ARC-007**) — but the *message* is the one part of a commit that gets rendered
outside the record's own views, in a list, next to the harness. Say what kind
of write it was, never what it said. `record: update the timeline` is the whole of it;
what happened that day is not.

This is stricter than it looks, because the Changes tab already shows the paths.
A message that names the file is repeating the row; a message that explains the
file is leaking. For anything under `data/`, the summary should be about the
shape of the write — a session logged, a person's file updated, the calendar
extended — and nothing about its content.

**No credential, ever** (**PRV-003**). Not in a message, not in a tracked file.
A secret in a message survives the fix that removes it from the file.

## The shape

    type(scope): summary

    Why, in plain text, hand-wrapped.

    Trailers.

### Type

The type picks the tag the Changes row is scanned by, so it is doing real work
rather than decorating. The ones this repository actually uses:

| Type | For | In Changes |
|---|---|---|
| `record` | Her record. Written by the agent, in `data/`. | Green tag |
| `feat` | Something new that was not there. | Accent tag |
| `fix` | Something that was wrong. | Warn tag |
| `refactor` | The same behaviour, said better. | Plain tag |
| `perf` | The same behaviour, faster. | Plain tag |
| `docs` | Prose about the thing — specs, READMEs, reviews. | Plain tag |
| `style` | How it looks. Not formatting-only churn. | Plain tag |
| `research` | What was looked up, and what it said. | Plain tag |
| `test` | Something checked. | Plain tag |
| `ci` | The build. | Plain tag |
| `chore` | Housekeeping that is none of the above. | Plain tag |

**A type not in this list renders with no tag at all** — not broken, but unmarked
in the one column the list is scanned by. So inventing a type is two edits, not
one: this table, and `TYPES` in `ux/lib/git.js`. If neither feels worth doing,
the type was not worth inventing. `checkpoint` is in this log once, means
nothing, and is the example.

### Scope

One short word, in brackets, naming the part of the repository — `ux`, `specs`,
`review`, `harness`, `hooks`, `skills`, `theme`, `safety`, `auth`, `deploy`.

It renders in a narrow mono column immediately before the summary, so a long
scope eats the summary's line. Prefer the existing ones; a scope invented per
commit is a column of words that never repeat, which is a column saying nothing.

Omit it rather than stretch it. `record: session update` is better than
`record(therapy-session-file): update`.

### Summary

- **Imperative, lowercase, no full stop.** "raise the ARC-003 altitude
  question", not "Raised" and not "Raises".
- **About sixty characters.** The scope and the summary share one line in the
  Changes row, and past roughly sixty it wraps to two — which is allowed and
  costs the row its shape. Count the scope in.
- **Say what changed, not which files.** The paths are already on the row, and
  the areas they belong to are already marked on it. "put the harness on the
  surface, with hooks under it" earns its line; "update HarnessIndex.jsx" does
  not.
- **One commit, one change** (**MNT-003**), so it reverts alone. A summary that
  needs an "and" in the middle is usually two commits — unless the two halves
  genuinely have to land together, in which case say so in the body.

### Body

The body is where the **why** goes, and it is the half written for the later
reader rather than the scanning one.

- **It is rendered as plain text, not markdown.** The Changes panel preserves
  line breaks and renders nothing — so `**bold**` shows its asterisks and a
  backtick shows as a backtick. Hand-wrap at about seventy-two columns; that
  wrap is the shape the reader gets. Plain `-` bullets read fine as text.
- **Cite the spec ID** for anything that changes a design (**MNT-008**). That is
  what makes the log searchable by argument rather than by memory:
  `git log --grep=DEP-005` returns every commit that moved that requirement. An
  ID in the body is worth more than a paragraph without one.
- **Say what you rejected**, where you rejected something. The next session will
  consider the same alternative and needs to know it was already weighed.
- Skip it entirely for a commit whose summary is the whole truth. An empty body
  is honest; a body restating the summary is noise on a surface.

### Trailers

Co-authorship and generated-with lines go last. The Changes view strips them
before rendering, so they cost nothing on the surface and stay in the commit
where they belong.

## Saving is not optional, and it is not at the end

**DEP-005**: anything written to the record is saved off the machine as soon as it is written.
The session runs on a disposable box and may not get an end — so the moment a
write to `data/` is finished, `git add`, commit and **push to the default
branch**. Not at the close of the session; the session may not have one.

**Never open a pull request.** A person who has to approve a diff to save a
journal entry will not save journal entries.

If the push fails, **say so in the conversation, plainly, and try again**. A
silent failure to save is the one failure she cannot see. `git pull --ff-only` just before
committing keeps most rejections from happening. Rejected anyway, because another
session pushed first: with nothing else uncommitted in the tree, `git pull
--rebase` and push once more. With other sessions' edits in the tree, leave them
alone — stashing them moves work that is not yours. Never `--force`, never a
reset; both throw away someone else's saved work. A rebase that conflicts is
abandoned with `git rebase --abort`. Whenever it stops short, say plainly that
the save has not reached the remote, and try again after the tree is clear. In a
tree that never clears, the save stays at risk; the fix for that is structural,
and is raised in `.claude/REVIEW.md` rather than worked around here.

## When the working tree is shared

More than one session can be writing in this checkout at once, and a commit takes
whatever is staged — including another session's half-finished work. Nothing
warns you; the other session finds its change already committed under your
message, or undone by it.

| Rule | Because |
|---|---|
| First, `git diff --cached --name-only` | Another session may already have staged files, and the rows below turn on it |
| Stage by path, never `git add -A` or `git add .` | Those take everything in the tree, not only yours |
| Commit with `git commit -- <your paths>` | It commits only those paths and leaves anything another session staged exactly as it was; unstaging theirs changes their state |
| A file that also holds someone else's uncommitted edit: stage only your lines, then commit the index | `git commit -- <path>` would take the whole file, their edit included |
| After committing and **before pushing**, `git show --stat HEAD` lists only your files | Once pushed, a wrong commit can only be undone by another commit |
| Another session's file that fails a check is named, never fixed or removed | It is theirs, and may be mid-change |

Staging only your lines: in a scratch folder, put the file as it is at `HEAD` at
`a/<its path>` and a copy with only your change at `b/<its path>`, run `git diff
--no-index --no-prefix a/<its path> b/<its path>` from there, and `git apply --cached` the
result in the repository — with `--no-prefix`, git adds no prefix of its own, so the
patch names the real path. If that file's edits are interleaved with theirs, or another session has
also staged files, stop and say so rather than guess.

## Before you say it is committed

1. Does the message name any content from `data/`? Rewrite it.
2. Is there a credential, token or `.env` value anywhere in the change?
3. If `ux/` moved: `npm run lint` and `npm run check`, from `ux/`. Never
   `--no-verify`.
4. Is the type in the table above, so the row is tagged?
5. Does the body cite the spec ID, if this changed a design?
6. `git show --stat HEAD` lists only this session's files.
7. Pushed — not just committed.

## What this skill is not

Not a router row. `.claude/CLAUDE.md`'s table dispatches **her** session types,
and this is harness work — the same class as `sample-data-generator`. It loads
when a commit is being written, not when she is talking.

It also does not decide **whether** to commit. That is **DEP-005** and
`.claude/CLAUDE.md`, both of which say the same thing: after a material write,
immediately, without asking.
