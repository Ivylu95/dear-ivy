---
name: commit
description: About to commit in this repository - after a material write to data/, after a change to the harness or the dashboard, or when asked to save, commit or push. Use to get the type, scope, summary and body right, because every commit is rendered as a row in the Changes tab for a person to read and is the only place a future session can find why something changed. Also covers when to push and why never to open a pull request. Harness work, never her record.
---

# Writing a commit

**Goal:** Every commit says what kind of change it was and why, carries nothing personal, and is pushed.

**Audience:** The agent, committing in any session; written for the developer scanning the Changes view and for a later session searching the log.

**Reads:** The staged diff, and `TYPES` in `dev/ui/lib/git.js` for the types the Changes view tags.

**Every run reads all of this page, then only the part its row below names.**

Write for two readers. One is a person scanning the **Changes** view (`/changes`,
built from `dev/ui/lib/git.js`), whatever `CLAUDE.md` says of "read by no one".
The other is a later session. For it, the log is the only place that says **why**
something changed (`git log --grep=`, `git show <hash>`).

## The two rules that are not style

**Nothing personal goes in a message.** `data/` is committed — privacy comes from
who can open the repository (**ARC-012**) — but the *message* is rendered outside
the record's own views, next to the harness. Say what kind of write it was, never
what it said. The Changes row already shows the paths. A message naming the
file repeats the row, and one explaining the file leaks.

**A save of her record is `record: <the shape of the write>`**, such as a session
logged, a person's file updated, the calendar extended, or `record: update the timeline`.
It says nothing about its content. Its scope is one short word or none, usually
with no body.
Name the kind of file, never a name or word taken from a path under `data/`: a
person's file is "a person's file updated", never its file name.

**Read your own diff outside `data/` once, before you commit it** (A-155). The gate
catches a name or a copied line. It cannot catch her life retold in new words. It
misses a test built from her week, an example with her lift or her drink in it, or a
quoted remark of hers in a commit body. Ask of each added line: could a stranger learn from this who
she is, or anything of her life? If so, make it invented or general, or move it into
`data/`, before the commit, because a message is never rewritten afterwards.

**No credential, ever** (**PRV-003**). Not in a message, not in a tracked file.
A secret in a message survives the fix that removes it from the file.

## Saving is not optional, and it is not at the end

**DEP-005**: anything written to the record is saved off the machine as soon as
it is written. **The moment a write to `data/` is finished, `git add`, commit and
push to the default branch** — not at the close; the session may not have one.

**Never open a pull request.** A person who has to approve a diff to save a
journal entry will not save journal entries. In a development chat, asked for
one, say this repository commits to main, and offer to commit and push. In her
chat nobody is ever asked about git: commit and push without mentioning it.

**If the push fails, say so in the conversation, plainly, and try again.** A
silent failure to save is the one failure she cannot see. `git pull --ff-only`
just before committing keeps most rejections from happening.

**In a development chat, a harness commit runs alongside the reply** (A-164, *"I
don't wait on the machinery"*). Start the commit, pull and push as one background
command. Reply, and read its result on the next turn. A failure is the next
reply's first line, fixed before anything else. Her record is never saved this way:
its save stays first and in the turn.

**Never `--no-verify`, `--force`, a reset or a rebase.** History is never rewritten.

## Every commit, in order

**A subagent commits only from its own worktree** (`DEV-017` design 6; `shared-tree.md`).

1. `git diff --cached --name-only` first: another session may have staged files.
2. Stage by path, never `git add -A` or `git add .`.
3. Commit with `git commit -- <your paths>`, unless a file also holds another
   session's uncommitted edit: then stage only your lines (`shared-tree.md`).
4. After committing and **before pushing**, `git show --stat HEAD` lists only
   this session's files. Another session's file that fails a check is named,
   never fixed or removed; its edits are left alone, since stashing them moves
   work that is not yours.

## Which part to read

**Every run reads:** nothing beyond this page.

| Situation | Read |
|---|---|
| Saving her record | Nothing more; the line above is its message |
| Any other commit: harness, dashboard, spec, test, dialogue; *"what type and scope?"* | [`message.md`](message.md) |
| The push is rejected or fails, the pull conflicts, or you are on a branch that is not `main` | [`push.md`](push.md) |
| Another session's work is staged or in a file you changed; a commit was refused; the Transcript was edited; one change across many files | [`shared-tree.md`](shared-tree.md) |

## Before you say it is committed

1. Does the message name any content from `data/`? Rewrite it.
2. Is there a credential, token or `.env` value anywhere in the change?
3. If `ux/` moved: `npm run lint` and `npm run check`, from `ux/`. Never
   `--no-verify`.
4. Is the type in the table in `message.md`, so the row is tagged?
5. Does the body cite the spec ID, if this changed a design?
6. `git show --stat HEAD` lists only this session's files.
7. Pushed — not just committed: the branch you are on as well as main, and
   before ending a turn that committed, `git status` reads up to date with
   'origin/…'.
8. After a refused commit, run `git diff --cached --name-only` before committing
   anything else. A refusal leaves every file staged, and the next commit takes
   them under the wrong message (2026-10-01, a gate fix and a spec edit).

## What this skill is not

Not a router row: `CLAUDE.md`'s table dispatches **her** session types, and this
is harness work, loaded when a commit is being written. Nor does it decide
**whether** to commit: **DEP-005** and `CLAUDE.md` say after a material write,
immediately, without asking.
