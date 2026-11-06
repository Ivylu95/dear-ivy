# Repair: messages and check-ins stopped

**Read when** messages, check-ins or reminders stopped, or a test message is asked for; late or twice, or the heartbeats or the routine misbehaving, is [`repair-routine.md`](repair-routine.md). Doctor first and last; in her chat, `her-side.md` answers.

*"My messages stopped"* can mean Telegram or saving: when unclear, check both.

## Symptom to part

| What is seen | Part | What separates it from its neighbour |
|---|---|---|
| Telegram refused (`403`, `400`, `401`) in the routine's last run | `routine`, `secrets` | The reply's description: blocked by her (she unblocks the bot), chat gone (a new chat ID in the routine's environment), key revoked (a new key, `repair-access.md`'s `secrets` row) |
| No Telegram message at all | `switch`, `hold`, then `routine`, `reminders` | In that order: off (her switch, set in her own conversation, never here; name the doctor line it was read from); paused; no `(cc-routine)` finish commit in the last hours, or its environment lacks the bot's key or `api.telegram.org`; the file lacks `"send": "routine"` |
| A check-in run went green and sent nothing | `hold` or `switch` | The log's `nudge:` line says why. Nothing sent while the doctor reads `paused` is the pause working |

**A fix the person makes** is unblocking the bot in Telegram, or typing a new chat ID or key into the routine's environment at claude.ai/code/routines. Its click path is fetched now (`running.md`). **You should see** the next hour's run send with no refusal, and the doctor's line for that part ✅. **If not:** the run's named lines again (`remote-evidence.md`).

## Fixes the agent makes

Each one, then the doctor again.

- **Proving the Telegram pipe** (*"send a test message"*). First look for a past `test_nudge` run ending `nudge: sent from GitHub`, newer than the secrets and its log readable (`SKILL.md` § 2): it proves the pipe, and nothing is sent. Otherwise `check-in.yml` with `test_nudge` sends to the copy's Telegram chat, past her switch and the pause. Run it only in a development chat, with the phone owner's yes given that day, relayed by the developer when the phone is someone else's. Never run it while the doctor reads `paused` (its reason never said), unless that owner says to.
