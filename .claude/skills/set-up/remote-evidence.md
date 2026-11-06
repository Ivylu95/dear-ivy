# What a remote part shows

**Read when** resuming (*"where did we get to?"*), checking, or settling a `remote` part's `unknown` or a run log (`SKILL.md` § 3).

`unknown` means look elsewhere, or a person must (who acts: `agent`, `person` or `remote`). **Settle a `remote` unknown only when the request needs it**; a resume, a check or a setup of that part always needs it. A part no past run proves (`SKILL.md` § 2) is ❔, with where to look. **A check** gives the doctor by area, worst first, then which to fix first. Read-only; a run log is read before anyone is asked:

| What | Evidence |
|---|---|
| Phone saves reach main | `merge-sessions` runs: green after a session's push |
| The secrets | The Claude secret missing: a `heartbeats` log line `heartbeats: inert, no CLAUDE_CODE_OAUTH_TOKEN`; present but expired: the run fails red at *Run the heartbeat*, and only when a job is due. Telegram: a `test_nudge` run ending `nudge: sent from GitHub` |
| The hourly clock | The routine's last runs on claude.ai, and a `chore(heartbeats): finish run … (cc-routine)` commit on main within the last two hours |
| A merge that failed | The `merge-sessions` run log: `403` or *denied* is the Actions write permission; `CONFLICT` is a merge to hand over |
| The scheduled task (formerly Routine) | The list at claude.ai/code/routines: the one sending `.claude/jobs/README.md` has this repository attached |

**From a run log, read only the named lines**, never the whole log, because a run once printed record text into one. Use `gh run view <id> --log | grep -E 'heartbeats:|nudge:|CONFLICT|403|denied'`. Where `gh` is not signed in, use the GitHub tools, quoting nothing but those lines. With neither, ask the person to open the run. `SIGNED_IN` is in every log (the workflow prints its script): it proves nothing. A scheduled task's run that "succeeded" and changed nothing: read its last run's session for an empty source list or *not a git repository* (no repository attached).

**Resuming** a new copy: run the doctor in the copy itself. Ask only for what leaves no evidence (the phone, the second copy and its pull, the disk encryption, whether anyone else has access). A step already proved is never re-walked.
