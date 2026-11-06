# Hooks

Deterministic guarantees. Everything in `CLAUDE.md` is an instruction the model
may follow; everything here is something that happens whether it follows it or
not. A rule belongs in a hook when it is **absolute, mechanical, and expensive
to get wrong once** — never when it needs judgement, because a hook has none.

Each file is a short program reading one JSON object on stdin and writing at most
one on stdout. `lib/hook.mjs` holds the plumbing they share. The `_why` for each
one — why it exists, what rule it enforces — lives beside its wiring in
`../settings.json`, whether it is switched on or parked, so the reason is visible
where the decision to turn it on is made. The header comment in each file says
the same thing at length.

## Layout

Folders are by **what the hook protects**, not by which event fires it — an event
is a scheduling detail, and two hooks on the same event usually have nothing to
do with each other. A one-file folder is not an accident; it is where the next
hook of that kind goes.

```
hooks/
├── selftest.mjs   run every hook, prove it still decides
├── lib/       hook.mjs — stdin, the four decisions, repo helpers;
│              profile-schema.mjs — the profile's one set of rules
├── safety/    the floor that must not depend on dispatch
├── privacy/   nothing personal leaves data/
├── record/    it saves, it is never destroyed, it stays findable
└── session/   what runs at the edges of a session
```

## What is active

Only these run today.

**No switch.** Every guard refuses outright, and the git gates refuse a failing commit, except that the pre-commit link check reports without blocking while it carries the imported record's backlog. The `build`/`locked` file that once let guards only warn was removed on the owner's instruction, 2026-09-27. End-of-turn checks hold the turn; they refuse no edit.

| Event | Script | What it guarantees |
|---|---|---|
| `UserPromptSubmit` | `safety/crisis-floor.mjs` | Every prompt is matched against the crisis list; a hit puts the protocol in front of the model before it answers. Names no phone numbers — points at `data/safety/safety_plan.md`. Over-triggers by design, and only adds context, so it cannot block, write or commit. `SAF-001`, *"Safety outranks everything else the system is doing."*, names it as the detector at the turn boundary. |
| `Stop` | `record/save-record.mjs` | Never touches a merge already under way (`record/test-merge-in-progress.mjs`). Everything written to `data/` is committed and pushed (to main first) the moment the turn ends. The machine is disposable; this is the only persistence the record has. Then, at most every three minutes, the same `reconcile()` as session start, so this copy and GitHub never drift. |
| `PostToolUse(Write\|Edit\|MultiEdit\|NotebookEdit\|Bash)`, `Stop` | `record/check-profile.mjs` | Every `PROFILE.yaml` (her record, the sandbox, the invented samples, the blank template) obeys the rules in `lib/profile-schema.mjs`, checked the moment it changes, by an edit tool or the shell, and again before a turn ends. A broken one comes straight back to the model with the line and the rule. `MEM-014`, *"A fixed minimum about her is known before any conversation goes further."* |
| `PreToolUse(Write\|Edit\|MultiEdit\|NotebookEdit)` | `privacy/guard-harness-privacy.mjs` | A write outside `data/` is refused if it carries her name, a name from `data/core/people/` (and from the sandbox's, in a test chat), or a line copied from the record. `SFG-004`, *"A write that would put anything personal outside the record is refused before it lands."* |
| `Stop` | `privacy/check-privacy-at-stop.mjs` | The whole tree outside `data/` is checked for the same at the end of every turn, including what a shell command wrote past the guard; a leak stops the turn until it is moved. A leak in a tracked file stops every session; one in an untracked file stops only the session that touched it, so another session's scratch file is left to its owner. About a tenth of a second. [`policies/PRIVACY_POLICY.md`](../../policies/PRIVACY_POLICY.md). |
| `PostToolUse(Write\|Edit\|MultiEdit\|NotebookEdit\|Bash)` | `session/track-touched.mjs` | Notes which files this session touched (every edit, and every existing path a writing shell command names) in `state/touched-<session>.json`, through `lib/touched.mjs`. The end-of-turn checks read it to block the session that made a change, not every session sharing the tree; the git `pre-commit` hook still checks every staged file, whoever wrote it. It also stamps which checkout each writer (the chat, or each of its agents) wrote in, and when, in `state/writer-<session>--<agent>.json` (`lib/shared-tree.mjs`), for `session/guard-agent-own-copy.mjs`. Never refuses. |
| `PreToolUse(Bash\|Write\|Edit\|MultiEdit\|NotebookEdit)` | `record/guard-git-history.mjs` | Git history, local and on GitHub, is never destroyed or rewritten: no force, delete or mirror push, `reset --hard`, `clean`, `--amend`, `rebase`, history filters, dropped stashes, discarding `checkout`/`restore`/`switch`, remote changes, writes inside `.git/`, or deleting or editing the GitHub repo. Commit, push, pull, merge and branch stay open, and everything else in the repository is the agent's to edit. Refuses whatever the switch says. |
| `PreToolUse(Bash\|Write\|Edit\|MultiEdit)` | `safety/guard-safety-core.mjs` | The safety core does not change unless the developer unlocked it: every `settings.json` line wiring a safety hook, `dev/specs/interaction/safety.md`, `dev/specs/ux/tabs/safety.md`, `ux/lib/safety.mjs`, `ux/scripts/check-safety.mjs`, everything in `safety/`, and the two anti-destruction guards, `record/guard-git-history.mjs` and `record/guard-record-deletion.mjs`, with their wiring. Each edit is simulated and refused only if the core text would differ, so the rest of `settings.json` stays open; the Crisis section of `CLAUDE.md` left the lock on the owner's instruction, 2026-09-27, and is held by the safety gate and history; a shell command that writes and names a core file is refused. `MNT-006`, *"Evolution may only strengthen the core — never soften, shorten or remove it."* Refuses whatever the switch says. |
| `UserPromptSubmit` | `safety/unlock-safety-core.mjs` | The developer typing `unlock safety core` opens the core for this session, for two hours. Written only from the person's own message; the guard refuses the agent writes to the record it leaves in `state/`. |
| `PreToolUse(.*)` | `privacy/guard-secrets.mjs` | No access key lands anywhere it stays: any tool call carrying a GitHub key (a file write or edit, the record included, a web request, a shell command) is refused, except the updater given the key in its own variable with nothing chained. A tool naming the record of a typed approval phrase is refused too, so no agent approves for a person, and so is any call that would write the record of what the developer typed in development mode (`lib/typed.mjs`), which an agreed card's yes and a commit's `Approved:` quote are checked against: an editor tool aimed at it, or a shell command that redirects, tees, edits in place, copies or moves onto, removes or checks out an older copy of it; reading it (Read, Grep, cat, grep, head, tail, wc, node or python reading) passes. Keys are recognised by `lib/update/secrets.mjs`; the commit gate scans for them again (`ux/scripts/check-secrets.mjs`, and every added line of a record-only commit). `PRV-003`, *"A credential never enters version control."* |
| `UserPromptSubmit` | `session/typed-phrase.mjs` | Records an approval phrase a person typed as the first line of their own message, never one relayed: the developer's `RELEASE v<version> <code>` and a person's `update to version <version> <code>`. The release tooling and the updater act only on this record. So does the sandbox: the developer's `/dev-mode sandbox <action>` is recorded here, and `ux/scripts/sandbox.mjs` refuses a switch it did not record, spending each once used (WKB-013, `session/test-sandbox-switch.mjs`). |
| `UserPromptSubmit` | `session/everyday-voice.mjs` | Outside development mode, on every message: reminds the agent that a technical request is done silently and answered in one plain line, naming no file, command, branch, count or tool. `/dev-mode` writes a per-session marker in `state/` that silences it for the rest of the session; on a plain request for development work it tells the agent to switch without asking, through `lib/dev-mode.mjs`, which writes the same marker. `CON-013`, *"A reply stays in the person's terms, even when the work behind it is technical."* |
| `UserPromptSubmit` | `session/dev-reply-shape.mjs` | In development mode only, on every message: names the Dev skills router in `dev/skills/README.md` (`ARC-005`), and puts the development reply shapes in front of the agent (the menu, the view and the tracker, each named in the header's first line, `DEV-003`; a `/dev-mode` with nothing named is told to open on the menu), with the conversation's figures (turn, start, last reply; no context share, which the app shows itself, T-450) read from the transcript by `lib/session-meta.mjs`, and what waits on the developer (`../../dev/for-you.md`, parsed by `lib/for-you.mjs`, A-152) item by item for the menu at a chat's start and as a count every turn — tracker first, one step, assumptions both ways, one ❓ with what it takes to answer, one phone screen. Silent outside development mode. The shape lives in `lib/dev-reply.mjs`. `DEV-002`, *"Every development reply can be picked up cold, from that reply alone."* The context figure behind the DEV-018 note comes from `sessionFigures` in `lib/session-meta.mjs`, which reads "Context just compacted" until a reply after a compaction is measured, and keeps the largest window the chat has shown (`DEV-007`, tested by `session/test-session-meta.mjs`). |
| `Stop` | `session/dev-reply-check.mjs` | In development mode only: judges the reply against the shape its header names in `lib/dev-reply.mjs`: a menu (title, numbered options ending in "Something new", one screen) or a view (no decision asked), each `DEV-003`, or else the tracker, whose label must name it; a label naming no shape or an unknown one is noted (the header and its details callout, the "Current dev goal" title and goal callout, the Progress bar and count, the breadcrumb of steps, Last turn and What's next, a rule and an emoji heading for every section, one question heading, last, so the reply ends on the ask, with no "Still open" while anything is asked, and the three-bullet "Still open" closing the reply once the work in hand is done and nothing is asked, a phone screen) and, while this session has changed the harness, that every "End chat" names the end-of-session review until `lib/dev-review.mjs done` records it, then that the reply says all is settled (`DEV-020`). Never sends a reply back, since a sent-back reply reaches the developer twice: a shortfall is noted and handed to the next message by `dev-reply-shape.mjs`. Never holds a reply about someone's safety to a format. Headings and rules inside fenced code are shown, not judged. Its rules are tested by `session/test-dev-reply.mjs`. `DEV-002`..`DEV-007`, `DEV-014`, `DEV-020`, `DEV-003`. |
| `UserPromptSubmit` | `session/policy-review-due.mjs` | On `/dev-mode` only: when `policies/review-log.md` says a legal review is due, the agent is told to offer the `policy-review` skill in its first reply. Silent on every other message, so her conversations never hear of it. Reads the due date through `lib/policy-review.mjs`, the parser `check-policies.mjs` also uses. `POL-014`, *"A policy review is started by the agent, never left waiting for someone to remember."* |
| `PreToolUse(Bash\|Write)` | `record/guard-record-deletion.mjs` | Nothing in `data/` is deleted, truncated or replaced whole: no `rm` (or `git rm`, `Remove-Item`, `del`), truncating `>`, `sed -i`, `truncate`, `find -delete`, `mv` out of `data/`, or `Write` over an existing record file. Moves into `data/archive/`, new files and `Edit` pass, and everything outside `data/` stays the agent's to delete. Closes the one gap git history leaves: a file destroyed before the turn's save commits it. `SFG-003`, *"A write that would lose part of the record is refused before it lands."* Refuses whatever the switch says. |
| `PreToolUse(Bash\|Write\|Edit\|MultiEdit\|NotebookEdit)` | `record/guard-harness-lock.mjs` | In a person's copy, the copy with no `dev/` at the root, a write anywhere outside `data/`, `temp/` and `FEEDBACK.md` is refused, by a file tool or a recognised shell write (redirect, `tee`, `sed -i`, `cp`, `mv`, `rm`, `git mv`/`rm`/`restore`/`checkout --`/`apply`); the updater's own command passes. With `dev/` present it passes everything. A script that opens a file itself is not seen. Tested by `record/test-harness-lock.mjs`. `DEP-013`, *"In a copy without the developer's folder, the harness changes only through a release she accepts."* |
| `PreToolUse(Bash)` | `session/guard-npm-ci.mjs` | No `npm ci` over the main tree's `ux/` while its packages are installed: it empties `node_modules` first, and a running dev server's open files stop it halfway (2026-10-09, 2026-10-10). Worked out from the command's own `cd` and `--prefix`; a checkout's `ux/` and `npm install`, which repairs in place, pass. `HBT-007`, *"A heartbeat runs apart from their conversation, never twice concurrently."* |
| `PreToolUse(Bash)` | `session/guard-piped-push.mjs` | No `git push` or `git commit` piped into another command unless `pipefail` is set or `PIPESTATUS` read: a pipeline reports its last command's status, so `git push … \| tail -1 && break` read a refused push as done (chat of 2026-10-12 to 10-15). `\|\|`, other git commands piped, and a `\|` inside quotes pass. `SFG-006`, *"Outside a crisis, a turn does not end with the record’s promises unkept."* |
| `PreToolUse(Bash)` | `session/guard-agent-own-copy.mjs` | No `git commit` from inside a subagent (the hook input's `agent_id`) in a checkout that is not a linked worktree while another session or agent has written there in the last half hour, read from the writer stamps `session/track-touched.mjs` keeps (`lib/shared-tree.mjs`): two agents sharing one checkout collided three ways on 2026-11-03. The chat's own commits, her record's saves (data/ only), worktree commits and a job alone pass. The git hooks cannot tell a subagent, so this is the only place it is refused. `DEV-017`, *"The developer never has to referee two agents."* |
| `PreToolUse(Bash)` | `record/guard-record-history.mjs` | No `git show`, `log -p`, `diff`, `blame`, `cat-file` or restore of `data/` from history, so a rebuilt record stays a fresh start (`DAT-005`). `--stat` and `--name-only` pass. Refuses whatever the switch says. |
| `Stop` | `safety/safety-at-stop.mjs` | The crisis numbers still check out, every turn (`SAF-002`); and a change to the safety surface without a hazard-log entry in `policies/SAFETY_POLICY.md` stops the turn once (`SFG-010`). |
| git `pre-commit` | `git/pre-commit` | The machine checks on every commit, whoever makes it (`SFG-007`). Record-only commits always pass. Refuses only when the switch is `locked`. Pointed at by `core.hooksPath`, which the session brief sets. |
| git `pre-merge-commit` | `git/pre-merge-commit` | A merge git commits by itself never runs `pre-commit`: before it is written, every Transcript remark both its parents hold must still be in it (`mergeLosses` in `ux/scripts/dialogue-merge.mjs`), or the merge stops uncommitted, naming each one (2026-10-29: two such merges each lost three). Tested by `git/test-pre-merge-commit.mjs`. |
| git `pre-push` | `git/pre-push` | Nothing is pushed anywhere but the copy's own `origin`, in any form of its address, and so never to the release repository pinned for the copy (`lib/release-source.mjs`: `data/core/setup/release-source.json`, else `../release/source.json`): releases reach it only through the release workflow. Guards the rename in which a new release repository took the development repository's old name. Tested by `git/test-pre-push.mjs`. And before a push to main, each merge it adds is made again from its parents (`lib/merge-sides.mjs`): one that holds a parent's version of a file whole while the other parent changed it is refused, naming paths only, with the fix (2026-11-03: f5041f36 lost a side that way). A `Kept one side: <path>` line in a pushed message excuses a path only where the dropped side's change is already in the kept version; said over a real loss, the push is still refused and the refusal says the line can't excuse it. `SFG-006`, tested by `git/test-merge-sides.mjs`. |
| `SessionStart` | `session/session-brief.mjs` | Never touches a merge already under way (`record/test-merge-in-progress.mjs`). A clean detached checkout already contained in main is moved onto an up-to-date main, so the session runs today's hooks; one with unsaved work stays put and warns (`session/test-detached-head.mjs`). Main is merged into a chat's own `claude/` branch first; at a desk, a folder left on a finished chat branch moves back onto main. A failed save or an unpushed commit is noted for the agent, as something the save and the sync retry; a session or `rescue/` branch still outside main is reported by `prune-branches.mjs`, after its pass. First contact is said out loud before the first word, and first contact is announced. Whatever of the record is missing — all of `data/`, or one standing file — is rebuilt blank from the modules' shapes before anything reads it, never over a file that exists, and the developer is told which commit last held it (`DAT-005`). The profile is read through `lib/profile-schema.mjs`: owed questions are listed with why each is empty, and a profile in the old flat shape is migrated, the old file kept in `data/archive/`. |
| `SessionStart` | `session/session-context.mjs` | `now.md` and the tail of the timeline are read before the first word, and again after a compaction (SessionStart runs again then; `PreCompact` takes no text, so it is not wired there, `PRC-005`), and the days to a hard anniversary are counted — the one thing reading cannot do. Switched on 2026-09-26: a session that has forgotten where she is cannot be gentle in the fortnight before a date. |
| `SessionStart` | `session/prune-branches.mjs` | Brings this copy and GitHub into agreement (DEP-011, `lib/branches.mjs` `reconcile()`): deepens a shallow clone, catches main up and pushes it, merges session and record-only branches into main, merges a rescue branch saved from main or a chat like a chat's own, retires a heartbeat run's or a detached rescue's branch idle a day into main's history, lists a person's own branch, clears merged local branches and idle clean worktrees. Never forces, rewrites or deletes on GitHub. Hands only a conflict to the agent. Under the selftest, local clearing only. Silent |
| `SessionStart` | `session/install-deps.mjs` | Installs `ux/` packages from the lockfile (`npm ci`, detached) when none are installed yet, so `npm run check` can run in a fresh clone. On Windows it goes through a shell, since Node refuses to spawn `npm.cmd` without one (`session/test-install-deps.mjs`). Silent |

**Every save goes to `main`.** From a chat's `claude/…` branch the save hook merges main in and pushes to `main` first; only if that is refused does it push the chat's own branch, then one `rescue/` branch. `reconcile()` (session start and turn end) and [`.github/workflows/merge-sessions.yml`](../../.github/workflows/merge-sessions.yml) carry any such branch into `main`, with no pull request; one that conflicts is handed to the agent to settle by merging. At a desk, on `main`, the save is one push, as before. The workflow must be committed from a computer — a cloud session cannot push files under `.github/workflows/`.

The save and the brief were inline shell one-liners in `settings.json` until they were moved here,
and then rewritten in Node. Same behaviour, proven against a throwaway repository
on all four paths: no-op, commit-and-push, push failure, recovery. Shell was the
one portability hole left — `.` to source a script, `$(…)`, `[ … ]` and `rm -f`
are a POSIX shell's, and on Windows they are one missing Git Bash away from a
save hook that silently never runs.

## Everything runs everywhere

Every hook is Node, launched as `node "$CLAUDE_PROJECT_DIR/…"`. Nothing shells
out, so nothing depends on which shell launched it: `git` is called as an
argument array rather than a command line, paths are built with `path.join`,
child processes use `process.execPath` rather than a `node` that must be found on
PATH, and files are read with CRLF normalised so a Windows checkout and a Linux
one compare equal. Node is the one interpreter this repository already requires
on every machine it runs on.

## Are they alive?

```sh
node .claude/hooks/selftest.mjs
```

Runs every hook against a payload it should act on and one it should ignore, with
failing-open switched off, and fails if any of them crashes, hangs, writes to
stderr, exits non-zero, or decides the wrong way. Run it after touching anything
here.

It exists because failing open has a price: a hook that loses an import goes
silently dead — every call passes, nothing is logged, the session looks normal
and the guarantee is simply gone. That is not hypothetical. It happened to
`record-gate.mjs` during the rewrite that produced this paragraph, and only a
timing run that came back suspiciously fast gave it away.

## What is written but switched off

All of these sit in `parked.json` beside this file, each in the exact shape it
takes inside `hooks` in `../settings.json`, so turning one on is a move, not a
rewrite. Claude Code never reads `parked.json`.

JSON has no comments, and **Claude Code will not accept one here**: a `//` or
`/* */` line makes it discard the whole settings file, permissions included, in
exactly the same silence as a missing brace. That was tested against the real
binary — a settings file whose only flaw was a comment behaved identically to a
malformed one, with both its `permissions` and its `env` ignored. An unrecognised
key is the opposite: tested the same way, the file loads and everything in it
still applies. That no longer holds inside `hooks`: event names are validated
now, and an unknown one takes the whole file down — which is why the parking
bay moved out.

### `record/`

| Event | Script | What it would guarantee |
|---|---|---|
| `PreToolUse(Write\|Edit)` | `guard-protected-files.mjs` | `CLAUDE.md`, `dev/specs/` and `data/archive/**` cannot be edited by the agent. Parked 2026-09-27: the developer opened the harness to edits. |
| `Stop` | `timeline-before-close.mjs` | If `data/` moved today and `timeline.md` did not, the turn does not end quietly. Asks once per session, never twice. |
| `Stop` | `record-gate.mjs` | Runs the three `ux/scripts/check-*.mjs` when `data/` or `ux/` changed, and blocks on failure. Their whole value is being early. |

### `session/`

| Event | Script | What it would guarantee |
|---|---|---|
| `SessionEnd` | `session-log.mjs` | One line in `data/core/state/log.md`, which is what the upkeep / review / research thresholds are counted in. |

## Turning one on

Move its object out of `parked.json` and into `hooks` in `../settings.json`,
under the same event name, and delete its `_why`. If that event already has
entries, append to the array — hooks on one event all run, in parallel.

Test it first without enabling it:

```sh
export CLAUDE_PROJECT_DIR="$PWD"
echo '{"tool_input":{"command":"git push --force"}}'    | node .claude/hooks/record/guard-git-history.mjs
echo '{"prompt":"i want to disappear"}'                 | node .claude/hooks/safety/crisis-floor.mjs
echo '{"hook_event_name":"SessionStart"}'               | node .claude/hooks/session/session-context.mjs
```

No output means the hook passed the call through. JSON output is the decision.

## House rules for anything added here

- **Put it in the folder for what it protects.** If it protects two things, it is
  probably two hooks; if it protects none of the four, add a folder and say in a
  line here what that folder is for.
- **Nothing personal.** These are harness: git-tracked, non-personal, read by a
  developer. They may read `data/` for shape — a filename, a date, a line length
  — never for meaning, and never echo it anywhere but back to the session.
- **Fail open.** A hook that crashes must not take the session with it. Return
  `pass()` on anything unexpected; a missing file is a pass, not a throw.
- **Say what to do instead.** A refusal that names the allowed move costs the
  turn nothing. One that just says no costs a retry and a guess.
- **Never block twice.** Anything on `Stop` checks `stop_hook_active` and leaves
  a marker in `.claude/hooks/state/`. She is waiting on the other side of the turn.
