# Step 15.5: the routine that sends the check-ins

**Read when** a new copy reaches step 15.5, after [`telegram.md`](telegram.md)'s 15.1 to 15.4, or the `routine` or `reminders` part is added or renewed (`components.md`). Fresh each run, never recalled; every account here is theirs, signed in as them (`new-copy.md`'s opening). Only if they want messages between conversations; declined, `telegram.md`'s *Declined* line.

**Its click path comes from claude.ai's own page, fetched now, before it is handed over** (`running.md`). A question back on it (*"I don't see it"*) is answered from that page that same turn. Before the next step, it gets its dated case, the step fixed with the page's address and date, and a line *Gap noted:*.

**Words used here:** a *scheduled task* (formerly *routine*) is a Claude session claude.ai starts on a clock. `5 * * * *` is the clock written as a *cron* line, here five minutes past every hour. An *environment* is the settings such a session runs with: which websites it may reach, and values (*variables*) it can read.

### 15.5. The clock and sender: one Claude routine

`HBT-010`, `HBT-011`. **Where:** a browser, on their claude.ai, signed in as them. Make a scheduled task (formerly routine, claude.ai/code/routines) with this repository attached, hourly at five past (`5 * * * *`). Its prompt is the `claude-routine` one in `.claude/heartbeats.json`. Give it its own environment, never Default, because her chats use Default and every session there can read its variables. There they type `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Set network to **Custom**, adding `api.telegram.org` with the default list kept (`code.claude.com/docs/en/cloud-environments`, 2026-10-29). Their reminders file reads `"send": "routine"`.

**You should see** the task listed at claude.ai/code/routines with this repository attached; after the next hour, its run there, and a `chore(heartbeats): finish run … (cc-routine)` commit on main.

**If not:** with no commit after the hour, its last run's page says why (no repository attached, GitHub disconnected, a usage limit). Then follow [`repair-routine.md`](repair-routine.md)'s rows. A Telegram refusal in the run goes to `repair-messages.md`. Two tasks with this repository: one deleted now (`repair-routine.md`).

Then `new-copy-close.md` step 16.
