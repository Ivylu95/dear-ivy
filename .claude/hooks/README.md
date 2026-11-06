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

| Event | Script | What it guarantees |
|---|---|---|
| `UserPromptSubmit` | `safety/crisis-floor.mjs` | Every prompt is matched against the crisis list; a hit puts the protocol in front of the model before it answers. Names no phone numbers — points at `data/safety/safety_plan.md`. Over-triggers by design, and only adds context, so it cannot block, write or commit. `SAF-001`, *"Safety outranks everything else the system is doing."*, names it as the detector at the turn boundary. |
| `Stop` | `record/save-record.mjs` | Everything written to `data/` is committed and pushed to the branch the session is on the moment the turn ends. The machine is disposable; this is the only persistence the record has. |
| `PostToolUse(Write\|Edit\|MultiEdit\|NotebookEdit\|Bash)`, `Stop` | `record/check-profile.mjs` | Every `profile.yaml` (her record, the sandbox, the invented samples, the blank template) obeys the rules in `lib/profile-schema.mjs`, checked the moment it changes, by an edit tool or the shell, and again before a turn ends. A broken one comes straight back to the model with the line and the rule. `MEM-014`, *"A fixed minimum about her is known before any conversation goes further."* |
| `SessionStart` | `session/session-brief.mjs` | Main is merged into a session branch first. A failed save, an unpushed commit, or an earlier session branch that never reached main is said out loud before the first word, and first contact is announced. The profile is read through `lib/profile-schema.mjs`: owed questions are listed with why each is empty, and a profile in the old flat shape is migrated, the old file kept in `data/archive/`. |
| `SessionStart`, `PreCompact` | `session/session-context.mjs` | `now.md` and the tail of the timeline are read before the first word, and again after a compaction, and the days to a hard anniversary are counted — the one thing reading cannot do. Switched on 2026-09-26: a session that has forgotten where she is cannot be gentle in the fortnight before a date. |

**A phone session saves in two steps.** Its git proxy accepts a push only to the session's own branch, named claude/…, so the save hook pushes there, and [`.github/workflows/merge-sessions.yml`](../../.github/workflows/merge-sessions.yml) merges that branch into `main` within seconds, with no pull request. A merge that conflicts fails the workflow and changes nothing; the next session's brief lists the branch. At a desk, on `main`, the save is one push, as before. The workflow must be committed from a computer — a cloud session cannot push files under `.github/workflows/`.

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

### `privacy/`

| Event | Script | What it would guarantee |
|---|---|---|
| `PreToolUse(Write\|Edit)` | `guard-harness-privacy.mjs` | A name from `data/people/`, or a long line already in `data/`, cannot be written to a file outside `data/`. Same checks as `ux/scripts/check-privacy.mjs`, one write earlier. |

### `record/`

| Event | Script | What it would guarantee |
|---|---|---|
| `PreToolUse(Bash)` | `guard-record-deletion.mjs` | No `rm`, `git clean`, `sed -i`, `find -delete`, truncating `>`, or `mv` out of `data/`. Nothing is ever deleted; it moves to `data/archive/`. |
| `PreToolUse(Write\|Edit)` | `guard-protected-files.mjs` | `CLAUDE.md` cannot be edited by the agent (proposals go to `data/state/proposals.md`), and `data/archive/**` is read-only. |
| `Stop` | `timeline-before-close.mjs` | If `data/` moved today and `timeline.md` did not, the turn does not end quietly. Asks once per session, never twice. |
| `Stop` | `record-gate.mjs` | Runs the three `ux/scripts/check-*.mjs` when `data/` or `ux/` changed, and blocks on failure. Their whole value is being early. |

### `session/`

| Event | Script | What it would guarantee |
|---|---|---|
| `SessionEnd` | `session-log.mjs` | One line in `data/state/log.md`, which is what the upkeep / review / research thresholds are counted in. |

## Turning one on

Move its object out of `hooks["//"]` in `../settings.json` and up into `hooks`,
under the same event name, and delete its `_why`. If that event already has
entries, append to the array — hooks on one event all run, in parallel.

Test it first without enabling it:

```sh
export CLAUDE_PROJECT_DIR="$PWD"
echo '{"tool_input":{"command":"rm data/timeline.md"}}' | node .claude/hooks/record/guard-record-deletion.mjs
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
  a marker in `temp/hooks/`. She is waiting on the other side of the turn.
