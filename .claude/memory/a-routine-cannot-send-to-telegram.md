# A Routine cannot send to Telegram, and GitHub's clock drops runs

**Superseded in part.** On 2026-10-17 the developer widened the routine
environment's network access to `api.telegram.org` and chose routines as the
sender (`send: routine`, HBT-010 design 2); on 2026-10-26 the outside clock and
sender this note once pointed to was removed (A-054). The first trap still holds
for a routine whose environment does not allow `api.telegram.org`.

**The trap.** It looks simple to have the hourly heartbeat Routine send the
check-in nudge to Telegram itself: put the bot token in the Routine and call the API.
That fails twice over.

- **The network refuses it.** Routines run in the cloud environment, and its
  network policy denies `api.telegram.org`: the proxy answers the CONNECT with a
  403. A token in the Routine changes nothing until the environment's Network
  access is widened, which is a setting only the developer can change.
- **The design refuses it.** A Routine is a model session from end to end, with
  no step the model cannot see. A token in its environment is a token the model
  holds, which SFG-012 design 3 rules out: the switch and the
  hard-session check in `ux/scripts/nudge.mjs` would become instructions instead
  of locks.

**The second trap.** GitHub's own `schedule:` is not a reliable clock either.
An hourly heartbeat workflow (cron `5 * * * *`) went live about 00:42 SGT on 2026-10-09 and in
the next sixteen hours GitHub started it on schedule once, nearly an hour late.
Every run started through `workflow_dispatch` ran at once. GitHub's docs say
scheduled runs can be delayed and, under load, dropped; a dropped run leaves no
failure behind.

**Seen 2026-10-09**, in a development chat that tried both.

**Do instead.**
- Send from the hourly routine, whose environment holds the bot's key and
  allows `api.telegram.org`, through `ux/scripts/reminders.mjs send-one` and
  `ux/scripts/nudge.mjs`, which keep the switch and the hard-session hold as
  code, not instructions.
- Never rely on GitHub's own `schedule:` as the clock.
- Judge a check-in by its log's `nudge:` line, never by the run's green tick: a
  run on 2026-10-09 went green and sent nothing, its `nudge:` line saying why.
