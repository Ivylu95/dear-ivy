# Remove a part, move, retire

**Read when** a part is taken out, the copy moves (a new phone, computer, country or helper), it is retired, or she starts using it again (`SKILL.md` § 3, `DEP-016`). Each part's order and proof are in [`components.md`](components.md); in her chat, a retire or a new phone is `her-side.md`'s row, a move of country or computer `repair.md`'s.

- **Remove a part**: each part's *Removed by* below, in the reverse of its order, then the doctor. Taking out anything the check-in nudge needs ends it, so it needs her yes, as switching off does (`CON-009`). She gives it in her chat, or the developer relays it that day. For the developer's own record, the yes is theirs. No yes, nothing is removed.
- **Move**: the steps are `new-copy-finish.md`'s, `new-copy-close.md`'s and `new-copy-download.md`'s. A new phone takes steps 11 and 12. A new computer takes step 14, the old folder left to its owner. A new helper takes step 16 for the old one first. A new country updates `- country ·` in the setup notes and runs step 7 again, with the old lines archived (`SAF-017`). With no entry, the doctor reads failed. Her timezone comes from her own words (as `first-contact` keeps answers). In her chat, `repair.md`'s row.
- **Retire**, with her yes as above. First prove her own copy of the record (a clone that pulls, with its history). Then switch the check-in nudge off through `nudge.md`, do every *Removed by* in reverse order, and run the doctor. **Nothing is deleted by the agent**: no file, no branch, no repository. The repository is hers, never suggested for deletion, and how to delete it is said plainly only if she asks. Every retire message, one stopped to wait for her yes included, ends below any question with its own last line on where copies remain. That line is said now, never promised for later. It names the Telegram chat with the bot, which she can clear, and GitHub's run logs, which expire within 90 days or she can delete run by run. It names the conversations in her Claude account (the phone app's included), which she can delete there. It names the second copy on her computer, which stays until she deletes that folder. It also names an old repository the setup notes name (`- old copy ·`), and her repository, both hers.
- **Coming back** (*"start using it again"*): follow `another-copy.md`'s *Bringing her copy up to date*, then each part as `components.md` sets it up. The check-in nudge stays off until she asks.

## Removed by

Each removal below is done in a browser, signed in as the account that holds it, its path checked against that service's page fetched now (`running.md`). **You should see** the item gone from that page (a disabled workflow marked disabled in the **Actions** tab), then the doctor reading that part as no longer set up. **If not:** still listed, ask for a screenshot (`running.md`) before anything else is tried.

| Id | Removed by |
|---|---|
| `remote` | Hers to delete or keep; never the agent |
| `hooks` | Stays |
| `history` | Stays |
| App + write | Settings → Applications → Installed GitHub Apps → Claude → Configure → Repository access: remove this one (uninstalling reaches every repository) |
| `merge-workflow` | Stays |
| `carry` | Goes with the App |
| `push` | Nothing |
| `profile` | Hers |
| `safety-plan` | Hers |
| `heartbeats` | The routine paused or deleted; BAXTER's entry off |
| `routine` | claude.ai Routines → delete it, only if it serves this copy alone; the bot's key out of its environment |
| `heartbeat-workflows` | Actions → each workflow → ⋯ → Disable workflow, or its runs keep starting and are billed |
| `secrets` | The repository's Settings → Secrets and variables → Actions → delete each; the bot with @BotFather `/deletebot` (it asks for a typed confirmation). Deleting the secret leaves the Claude token valid: its owner removes it in claude.ai Settings → Account (Claude Code sign-ins, `setup-token` ones included) or, if not listed there, Settings → Claude Code, the trash icon ([help article](https://support.claude.com/en/articles/10310342-how-do-i-log-out-of-all-active-sessions), read 2026-11-01). Whether a new `claude setup-token` ends the old one, the docs do not say ([authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token), read 2026-11-01): remove the old one too, never assume it ended |
| `pipe` | Goes with the secrets |
| `reminders` | The bot's key out of the routine's environment. Her reminders file stays in her record |
| `switch` | Hers: `nudge: off` |
| `hold` | Nothing |
| calendar | Disconnecting it there; the fortnight's copy stays in her record |
| second copy | Its owner's: the scheduled pull removed; the folder theirs |
| no access left | — |
| `rescue` | After a look (`repair.md`) |
| `leftovers` | `git-reconcile`'s, after a look |
