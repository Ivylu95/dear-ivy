# Repair: check-ins late or twice, heartbeats, the routine

**Read when** check-ins or reminders come late or twice, heartbeat jobs read failed, stuck or run twice, or the hourly routine misbehaves; stopped altogether, or a test message, is [`repair-messages.md`](repair-messages.md). Doctor first and last; in her chat, `her-side.md` answers. A *heartbeat job* is one of the background tasks in `.claude/jobs/`; the *routine* is the Claude scheduled task that runs them hourly and sends her messages (`telegram-routine.md`).

## Symptom to part

| What is seen | Part | What separates it from its neighbour |
|---|---|---|
| The check-in late, or missing | `routine` | The hourly routine has not run (its last run on claude.ai, the last `(cc-routine)` finish commit); a check-in goes within the hour after its time. Its page says why: GitHub disconnected (runs skipped, off after 72 hours: reconnect, turn it on) or a usage limit (`code.claude.com/docs/en/routines`, 2026-10-29) |
| Heartbeat jobs read failed or stuck | `heartbeats` | The job's tracker; a claim older than three hours clears itself, but a job `capped` after repeated failures never runs again until, its failure read, one run is started by hand |
| Every reminder twice | `routine` | Two Claude routines with her repository: **reminders take no claim, so both send to her phone; the person deletes one now on claude.ai**, not a pause (a paused one can be turned back on) |
| Heartbeats run twice | `heartbeats` | Two schedulers (BAXTER on the desktop, commits in the developer's timezone; the Routine, by *Claude* in UTC). The claim lock (`HBT-007`) stops a clash of jobs, wasting runs: offer to switch one off; never touch the locks |

## What the person does, and how they know it worked

Each at claude.ai/code/routines, signed in as the routine's owner, its click path from that page fetched now (`running.md`).

- **Reconnect and turn it on** (GitHub disconnected): on the task's own page, as it names. **You should see** the task on again and, within the next hour, its run there and a `(cc-routine)` finish commit on main. **If not:** its last run's page says why; a usage limit waits for the limit to reset.
- **Delete the second routine** (every reminder twice): either one, keeping the one with this repository attached and the `claude-routine` prompt. **You should see** one task left with this repository, and the next reminder arrive once. **If not:** a third (one made by `/schedule` may not show its repository): the doctor and the list again.

## Fixes the agent makes

Each one, then the doctor again.

- **A stuck heartbeat claim whose work already landed**: record it with `node .claude/hooks/lib/heartbeats.mjs finish <job> ok` from a clean checkout. Otherwise leave it to clear itself.
