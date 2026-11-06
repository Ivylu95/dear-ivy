# Noticed: a to-do with a time, set unasked

Read when the person, in any chat, shows they clearly need or mean to do something by a
certain time. It may be an everyday chat or a development one. They did not ask to be
reminded (card A-172).
The must-holds in `SKILL.md` apply, with this kind's own carve-out there. Nothing else from
this skill is read on this route.

**Set first, then tell, in the same reply.** There is no draft and no question: the reply's
📝 line says what was set and when, so they can move or stop it.

## Only a real to-do with a time

Set one only when all of these hold. Any doubt, set nothing: a reminder they never needed is
the worse failure (*"I'm reminded of something I didn't say needed doing"*).

| It is | It is not |
|---|---|
| Something they said they will do, need to do, or must do: *"I have to send the forms by Friday"*, *"I need to renew it before the 20th"* | A feeling, a worry, a wish, an open question, a maybe (*"I might call her"*), or something someone else will do |
| Tied to a time they named or that the to-do fixes: a day, a date, a deadline, *"before the meeting"* | Undated (*"someday"*, *"at some point"*) |
| Theirs to do | Someone else's safety, or anything a crisis raised |

**Never**, whatever was said:

- **In a crisis, or on a hard day**, nothing is set. It counts as one when the session's
  brief or the last line of `data/core/state/log.md` reads crisis or panic, today or
  yesterday. It also counts when this chat has been hard. The crisis block in `CLAUDE.md` is all that runs.
- **About medicine**: when to take one, a dose, a refill timed to a dose. That is the
  prescriber's; `check` refuses one whose purpose names a medicine.
- **A topic they asked to drop.** First read *Handle with care* in `data/core/state/now.md`
  and `data/core/me/how_to_talk_to_me.md`. Anything there is left alone.
- **Asked for already**: a reminder they asked for goes by `setting.md`, with its draft.
  Already in `reminders.json` (the same to-do and day): nothing new.

## When: a sensible time

Before it is due, at a time they can act on it, in their timezone (`data/PROFILE.yaml`):

- A deadline on a day gets 9 am that day.
- A deadline at a time gets two hours before it, but never before 8 am or after 9 pm.
- *"Before Friday"*, *"by the end of the week"*: 9 am the day before.
- *"Tomorrow"* with no time: 9 am tomorrow. A time already past means the next sensible one;
  a deadline already past means nothing is set.

## Write it

1. `node ux/scripts/reminders.mjs this-chat` prints this chat's `chat` link and its `bot`
   (`dev` in a development chat, else `main`). If it asks for a name, give the chat's own,
   from `get_session` (no id), with `--title "<name>"`. If it still fails, set nothing, and say
   in the reply that it could not be set.
2. Add one entry to `data/core/calendar/reminders.json` (the template copied there if it is
   missing, its `timezone` theirs, listed in `data/README.md`):
   `{ "id": "<short-slug>", "emoji": "<one>", "text": "<what is to be done>", "at": "YYYY-MM-DD HH:MM", "set": "<now, YYYY-MM-DD HH:MM>", "inferred": true, "bot": "<from this-chat>", "chat": <from this-chat> }`.
   `text` is plain and shows on a lock screen: the task alone, no name of anyone, no place,
   nothing private (*"Post the forms"*, never who they are for). The id is plain, never a name.
   Once only: always `at`, never `cron` or `every`. One to-do, one entry.
3. `node ux/scripts/reminders.mjs check`: fix every problem it prints.
4. Push to main at once (the `commit` skill, `record: update reminders`). Until the push lands
   it is not set: say so plainly.
5. **The reply:** answer what they said, as the chat would anyway. Then the 📝 line names what
   was set and when, and that they can move or stop it, in their terms. For example: *"📝
   I've set a reminder for 9 am Thursday 5 Nov to post the forms. Say if you'd like it moved
   or dropped."* In a
   development chat, the same one line closes the reply. Never the file, the bot, the sweep or
   the link.

Asked to move or stop it, that is `changing.md`, as for any reminder.
