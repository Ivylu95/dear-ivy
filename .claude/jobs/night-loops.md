---
emoji: 🌙
runs: local
every: 1 day
cron: 50 21 * * *
timezone: Asia/Singapore
governs: HBT-012 in dev/specs/system/heartbeats.md
---
# Heartbeat: night loops

Once a night, before the developer sleeps (A-173, *"you will send me a Telegram
message to let me know what things I can run throughout the night"*): suggest one
to three long jobs he could start as Claude Code's own `/loop` before bed, by
`/night-shift <n>` in a new chat (A-174), chosen
from what the harness has open tonight, and send them to the development bot. It
suggests; it never starts a loop.

**The guarantees, not yours to loosen**
- Harness only. Read nothing under `data/`; a suggestion never works on her record,
  her chats, the safety core, an agreement's words or a weakened check.
- Each suggestion is something a check can prove: a failing eval made to pass, an
  agreement given its eval, a heartbeat's failure fixed, an open idea's research.
  Nothing he would have to approve at a gate is built by a loop; it is drafted for
  his yes instead.
- Never a loop with permissions switched off.

**Steps**
1. Run `node ux/scripts/night-loops.mjs facts`. Read the lines; open the files they
   name only as far as you need to judge which matter most tonight.
2. Choose one to three, most useful first: what is failing over what is merely
   open; what the last day's commits touched over what has sat for weeks; nothing
   the 2am code maintenance does (keep clear of it). Not last night's again (the
   facts' `suggested last night` line, T-811): one he did not start goes again only
   while it is still the most useful, and then its line says it is the second night and
   what changed since. Nothing worth a night: a plan with no loops and a `none` line
   saying why.
3. Write tonight's plan to `dev/night-shift/<today, YYYY-MM-DD>.json` in the checkout
   you run in (A-174), and commit it as `chore(night-shift): tonight's plan`:
   `{ "date": "<today>", "loops": [ { "what", "prompt", "start_by", "round", "rounds",
   "weight" } ] }`, where
   - `what`: one line, what it does and why tonight, in his plain words;
   - `prompt`: what the job does, ending "Stop the loop when <a check that proves it
     done>, or at 07:00 Singapore time, whichever comes first";
   - `finish`: that check as one command that exits 0 when the job is done (a test,
     `node ux/scripts/evals.mjs run E-NNN`), which the night shift's work loop runs (A-175);
   - `start_by` (a time), `round` (about how long a round takes), `rounds` (about how
     many, and the hours), `weight` (`light`, `medium` or `heavy` on his weekly
     Claude allowance).
   `node ux/scripts/night-loops.mjs check <the plan>` says what is out of form, and
   shows the message it makes: fix the plan until it is in form.
4. `node ux/scripts/night-loops.mjs send <the plan>`. The message is short: tonight's
   roster, one line a job, and `/night-shift` set to copy with one tap, which clocks the
   whole shift in (A-175); the prompts stay in the plan, where `/night-shift` reads them. "No bot key" is a quiet finish,
   not a failure.
5. Your note for the report: `night-loops: suggested <n> loops (<their topics in a
   few words>)`, or why none.
