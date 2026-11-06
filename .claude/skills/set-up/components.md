# Components

**Read when** adding or checking one part (`SKILL.md` § 3).

Each step's file is its row in `SKILL.md` § 3 (15.1 to 15.4 `telegram.md`, 15.5 `telegram-routine.md`). A part that evidently worked before needs only its verification. A part not here is not guessed at. Under another name, use that. If unbuilt, it is `harness-writer`'s, its entry here once built. A part that would send anything from `data/` to another service goes to the spec skills first (`SFG-012`, `ARC-004`), and is hers to choose.

## Order

Set up in this order; a part is not started before what it needs is ✅.

```
remote ─► hooks ─► history
   │
   ├─► App + Actions write ─► merge-workflow ─► carry (phone saves reach main)
   │
   ├─► profile · safety-plan            (her first conversation; the numbers)
   │
   ├─► heartbeats ◄── routine or BAXTER (the scheduler)
   │                     └─► reminders · switch (hers)   (her bot's key in the routine's environment)
   │
   └─► heartbeat-workflows ─► secrets ─► pipe (test_nudge, by hand)
```

## The parts

| Id | What it is | Needs | Set up | Proved by | Who |
|---|---|---|---|---|---|
| `remote` | Her private repository on GitHub, one member | A GitHub account of her own | step 1 | Doctor: origin is on GitHub | Person |
| `hooks` | The commit gate (`core.hooksPath`) | A clone | `git config core.hooksPath .claude/hooks/git`; a session's start hook also sets it | Doctor | Agent |
| `history` | Full git history | A clone | `git fetch --unshallow origin` | Doctor | Agent |
| App + write | The Claude GitHub App on that one repository, and Actions read and write | `remote` | steps 9 and 10 | Only `carry` proves them | Person |
| `merge-workflow` | Carries a phone session's branch into main | `remote` | In the repository already; a cloud push may be refused for workflow files, then from a computer | Doctor | Agent, or person from a computer |
| `carry` | Phone saves reach main | App + write, `merge-workflow` | steps 11 to 13 | Doctor: a session branch merged into main, and none stranded | Person (one conversation), agent (the check) |
| `push` | The last save left the machine | `remote` | Nothing to set up | Doctor: no `PUSH_FAILED.md` | Agent |
| `profile` | Who it is for | A first conversation | `first-contact`, in her own words | Doctor: no question not yet raised | Her |
| `safety-plan` | Crisis numbers right for where she lives | The record | step 7 | Doctor: the recorded country's checked entry in the catalogue, held in her plan; with no country, the shipped ones with her timezone Singapore's | Person |
| `heartbeats` | The background jobs in `.claude/jobs/`: the hourly routine runs them and is the one sender; BAXTER may too, on the developer's machine, sending nothing (HBT-011); `heartbeats.yml`, its backup every two hours (`telegram.md` 15.2) or by hand, takes only the `runs: anywhere` jobs and sends nothing | `routine` or BAXTER | step 15.5; BAXTER on the developer's machine | Doctor: jobs have run, none failing or stuck; each finish commit names `(cc-routine)`, `(baxter)` or `(cloud)` | Person (scheduler), agent (the rest) |
| `routine` | The Claude scheduled task (formerly Routine) that starts the jobs and sends her reminders, check-ins and nudge; the doctor reads it `off` in her copy until something has run, `missing` when the nudge is on or a reminder live and none ever has | `remote`, her bot | step 15.5, at claude.ai/code/routines with the repository attached; one made by `/schedule` or an API may have none: check | Routines list shows the repository; a run lands a `chore(heartbeats)` commit naming `(cc-routine)` | Person |
| `heartbeat-workflows` | `check-in.yml`, `heartbeats.yml` | `remote` | step 15.2 | Doctor | Agent, or person from a computer |
| `secrets` | `CLAUDE_CODE_OAUTH_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `heartbeat-workflows`, her bot | steps 15.1 and 15.3, signed in as her | Run logs (`remote-evidence.md`) | Person |
| `pipe` | GitHub reaches her Telegram | `secrets` | step 15.4 | `nudge: sent from GitHub`, and the line on her phone | Agent starts it in a development chat with the phone owner's yes (`repair-messages.md`, *Proving the Telegram pipe*; `telegram.md` 15.4); person confirms |
| `reminders` | Her reminders reach Telegram within the hour after the time she asked for | `routine` | step 15.5 | Doctor: the file reads clean in her timezone, with `"send": "routine"`; delivery in `node ux/scripts/reminders.mjs list --shape` (row numbers, states, counts, any missed; never `--json` in a development chat: it prints her text) | Person (the routine), agent (the file) |
| `switch` | The check-in nudge on or off | `routine` | Her request, in her own conversation (`CON-009`) | Doctor | Her |
| `hold` | The pause the safety rule sets for a day (`HBT-005`); its reason is never said | Nothing | Never set up or lifted by hand | Doctor: `paused` | Nobody |
| calendar | Her Google Calendar, read and written from her chats | Her Claude account | The Google Calendar connector in her Claude account's Connectors, by her | Her chat reads it (`calendar` skill; with none, its *Reading* step 4) | Person |
| second copy | A clone on her own computer, pulled on a schedule, disk encrypted | `remote` | step 14 | Her word only | Person |
| no access left | The helper signed out everywhere, every setup token revoked, nobody else a collaborator | The whole setup | step 16 | Her GitHub sessions and collaborators lists | Person |
| `rescue` | A rescue branch from a detached or development checkout touching the record | Nothing | Never merged without a look (`repair.md`) | Doctor | Person |
| `leftovers` | Branches main lacks with no record change | Nothing | Nothing of hers at stake; tidying is `git-reconcile`'s, after a look | Doctor | Person |
