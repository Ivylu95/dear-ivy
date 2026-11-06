---
name: reminders
description: She asks to set a reminder for a time, once or on repeat - "remind me to call the clinic at 3pm tomorrow", "every Thursday tell me it's bin night" - or to be checked in with on a schedule - "check in with me every morning", "ask me how I'm doing on weekday afternoons" - or to list, move, pause, stop or cancel either. Also, unasked, when any chat shows something she clearly has to do by a time - "I have to send the forms by Friday", "I need to renew it before the 20th" - set once, then told. Arrives on her Telegram. Not being told when a check-in is waiting (the nudge), nor check-ins about food, which are the fitness module's (`fitness:log`).
---

# Reminders

**Goal:** What she asks to be reminded of reaches her Telegram at the time she named, once she says yes, and a clear to-do she mentions is reminded once, unasked.

Nothing else is asked of her.

**Audience:** The person, in her own chats; for a to-do noticed in passing, the developer's development chats too.

**Reads:** this page, every run, then the part the table below names. Her reminders file, `reminders.json` in `data/core/calendar/` (copied from `modules/core/templates/reminders/reminders.json` on first use), her timezone in `data/PROFILE.yaml`, and the chat's narrow or wide view (FIT-001).

**Every run reads:** nothing beyond this page; then the table names each part.

**How it reaches her** (HBT-010): her one hourly routine is the heartbeat
sweep. First thing in each run, it writes and sends every reminder that fell
due since the last run. The words are fresh each time, and the bot key is in
its environment. It goes within the
hour after its time. A reminder is live the moment it is pushed to main, and not
before. Only a file reading `"send": "routine"` (the template's) is sent: nothing
else sends one, so `check` names a file without it as a problem.

## Must hold, on every route

- **Never in a crisis.** Nothing is filed then; a reminder can wait. If she may
  be unsafe, or you're unsure, stop: the crisis block in `CLAUDE.md` is all that runs.
- **Never chooses timing for medication**, a dose, or whether to take something.
  Never pick a time for her medication, nor offer one as an example ("morning or
  evening?"), when setting or moving one: that is her prescriber's, and she says it.
  It reminds her of what she and her prescriber decided.
- **Drafted for her yes.** Nothing is written, moved, paused, resumed or stopped
  before she has seen a short draft and said a plain yes ("yes", "ok", "go
  ahead"). A change she asks for is a new draft. Except a to-do noticed in
  passing (`noticed.md`, A-172): set, then told.
- **Pushed to main at once**, as any record write (the `commit` skill,
  `record: update reminders`). An entry that never reaches main never goes out:
  if the push fails, retry, and until it lands say plainly it is not set yet.
- **Said back in one line, with the first date** (or, for a change, from when),
  then the 📝 line, as for any record write.
- **Nothing is ever deleted.** A stopped one is marked `"ended"` and moved to the
  archive; a moved one ends the old entry and adds a new one. Never rewrite an
  entry in place: it is her record of what she asked for.
- **Never names the machinery to her.** Words like the routine, the sweep, the
  heartbeat, a job, a schedule, a file, a command or an environment are for
  this skill, never for her. She hears when it comes, such as "within the hour
  after its time". She never hears what sends it.
- **Never asks her to set anything up.** If she says reminders are not arriving,
  that is the `set-up` skill's (`components.md`, `reminders`), and anything
  needing an account goes to the developer.
- Never offers a reminder unasked. A to-do noticed in passing is set only by
  `noticed.md`'s rules: never on a hard day, medicine, or a dropped topic.
- One set in a development chat goes to the development bot (`"bot": "dev"`).
- An id is short, unique and plain (`evening-tablet`), never a name or a detail.
- A reminder about a dated event (an appointment, a birthday) also gets its date
  in `data/core/calendar/calendar.md`, as the record rules ask.

## Route: read the part for what she asked

| She… | Read |
|---|---|
| asks to be reminded of something, once or on repeat | [`setting.md`](setting.md) |
| didn't ask, but says she has to do something by a time | [`noticed.md`](noticed.md) |
| asks to be checked in with on a schedule (*"check in with me every morning"*) | [`check-ins.md`](check-ins.md), then [`setting.md`](setting.md) |
| asks what reminders she has, or what reaches her | [`seeing.md`](seeing.md); for check-ins too, [`check-ins.md`](check-ins.md) |
| asks to move, change, pause, resume, stop or cancel one, or *"stop the messages"* | [`changing.md`](changing.md); for a move or change, [`setting.md`](setting.md) too; for a check-in, [`check-ins.md`](check-ins.md) too |

One routine per reminder (`node ux/scripts/reminders.mjs routine <id>`) is
an unused option, kept beside the sweep; never create one unless the
developer turns it on.
