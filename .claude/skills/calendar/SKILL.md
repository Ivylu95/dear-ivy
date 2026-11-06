---
name: calendar
description: She asks what is on - "what's on this week", "am I free Thursday", "what have I got in December" - or asks to add, move or cancel something in her Google Calendar - "put dinner on Friday at 7 in my calendar", "move the dentist to Monday", "cancel Saturday's lunch". Not for being reminded or messaged at a time, which is reminders. Reads live through the Google Calendar connector; never writes without her yes to a draft.
---

# Calendar

**Goal:** She knows what is on without opening another app, and what she asks to add lands in her Google Calendar exactly as she said, once she says yes.

**Audience:** The person, in her own chats. Never a heartbeat: no run with no one present writes to her calendar (A-121).

**Reads:** her calendar live, through the Google Calendar connector's tools (`list_calendars`, `list_events`, `search_events`, `get_event`), and the copy the morning check-in keeps (`data/core/calendar/google.json`, the next fortnight). Her timezone is in `data/PROFILE.yaml`.

**The crisis block in `CLAUDE.md` comes first.** In a crisis, none of this.

## Reading

1. **Within the next two weeks:** the copy is enough, unless she says something
   changed today; then read live.
2. **Further ahead, or a search** ("when is the wedding"): read live, one call
   at a time (Google refuses calls made together), `pageSize` 10, following
   `nextPageToken`. Nothing read this way is written anywhere: it answers her,
   and the copy stays the fortnight.
3. **Answer as she would read it:** day, time, what. Another person's event on
   a shared calendar is said plainly, not interpreted.
4. **No connector in this chat:** say in one plain line that the calendar isn't
   reachable here, and answer from the copy, saying how old it is.

## Writing, only on her yes (A-121)

1. **Only what she asked.** Add an event she describes; move or cancel an event
   she names, found by reading first, always with `notificationLevel` "NONE" so
   no guest already on it is emailed. Never touch an event she did not name,
   never clear or tidy her calendar, never answer an invitation for her.
2. **Show the draft, every field**, so a yes is a real yes: _"Add to Personal:
   Dinner, Fri 30 Oct, 7:00 to 9:00 pm, reminder 1 hour before. Yes?"_ Moving
   or cancelling: name the event as it stands, then what changes.
3. **Never anyone else on it.** No guests, no attendees, no invitations: a
   write that would reach another person is refused by the guard, and is not
   tried. If she wants someone invited, she adds them in Google Calendar.
4. **Her yes, then write once**, then say it back in one line with the day. A
   no, or a change: redraft. Nothing is written on a guess or a maybe.
5. **Health and other sensitive events** go in her words, no more: never a
   diagnosis, a medication or a clinician's notes in a title or description.

## Cases

| Trigger | Do | Because |
|---|---|---|
| Her words match more than one event, or none exactly ("my Thursday stuff", "everything next week") | List what matches and ask which; write none until she names each. Never a sweep. If clearing everything sounds like more than a busy week, the crisis block in `CLAUDE.md` | An event she did not name is never changed (A-121, T-330) |
| A date or time that could be two things ("next Friday", "the 3rd", "7 her time"), or one that clashes | The draft gives weekday, full date and time; a zone she named goes in `timeZone` and is said in the draft beside hers; a clash is named, the other event left alone | A yes to a date she misread is not a real yes (T-330, 2026-10-28) |
| A repeating event, new or existing | A new one: the draft says how often and until when. An existing one: that one occurrence only, said so, unless she says the series | Changing a series by its id moves or cancels every week of it (T-330) |
| The event or search names someone in her life ("dinner with" a friend) | Use the name as she said it, in the draft she says yes to, or in a search she asked for; nothing else from her record goes in | A name in her own calendar is the one exception she agreed (A-127, T-344) |
| The privacy guard still refuses (her own name, or a line copied from her record) | Say so in one line and write it in her words without that; never respell it to get past | The guard is the record's, not the calendar's to bypass (SFG-012) |

## Must hold

Never in a crisis. Never a write without her yes to the draft in this chat.
Never a guest or an invitation. Never an event she did not name changed or
removed. Never from a heartbeat or any run with no one present.
`.claude/hooks/record/guard-calendar-writes.mjs` refuses guests, an invitation
answered, a change or cancellation that would email, and any unattended write,
by code.
