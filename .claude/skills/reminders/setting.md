# Setting one

Read when she asks to be reminded of something, once or on repeat, and for a check-in after `check-ins.md`. The must-holds in `SKILL.md` apply to every step.

**After her yes, she gets one plain sentence with the time and the first date, then the 📝 line, and nothing else** (step 9 says how).

1. **Get the what and the when from her words.** Ask only what her words leave
   open, about her life, once: "tomorrow" with no time, "the morning" with no
   hour. "At 3" in an afternoon conversation is 3 pm. A time already past today
   means the next one. A time on another place's clock ("9am London time", or
   she is away) gets that entry's own `"timezone"`, said in the draft. Never
   pick a time for her medication, nor offer one as an example ("morning or
   evening?"): that is her prescriber's, and she says it.
2. **Write what it is for, not the message.** No reminder is a fixed message
   (HBT-010). Each time it falls due, the sweep writes fresh words from this
   purpose and what is current in her record. It never sends the same words twice. So `text`
   is the purpose, short, in her own words where she gave them: "Take your
   evening tablet", "Bin night". What goes shows on her lock screen. The first
   time she sets one, offer a plainer purpose in the draft for anything she
   might not want seen. Say once that it shows there, in the line that says it
   back (step 9).
3. **Once or repeating, from her words.** A date or a day with no "every"
   ("on Friday", "the 30th", "tomorrow at 3") is **once**: `at`. "Every",
   "daily", "each", a plural day ("Thursdays") or a span ("for the next
   month") **repeats**: `cron` or `every`. Unsure, ask once: _"Just this
   Friday, or every Friday?"_ The draft always says which, in its first
   words: _"Once, Fri 30 Oct at 8 pm"_ or _"Every Thursday at 7:30 pm"_. A
   one-off leaves for the archive by itself two days after it went.
4. **Choose one schedule**, all times local, `YYYY-MM-DD HH:MM`:

   | She says | Write |
   |---|---|
   | Once: "at 3pm tomorrow", "on the 20th at 9" | `"at": "2026-10-20 15:00"` |
   | "Every day at 9pm" | `"cron": "0 21 * * *"` |
   | "Every Thursday at 7:30pm" | `"cron": "30 19 * * thu"` |
   | "Weekdays at 8" · "Mon, Wed, Fri at noon" | `"cron": "0 8 * * 1-5"` · `"cron": "0 12 * * mon,wed,fri"` |
   | "On the 1st of every month" · "the last day of every month" | `"cron": "0 9 1 * *"` · `"cron": "0 9 L * *"` |
   | "The 31st of every month" (or 29th, 30th) | `"every": "1 month"`, `"start"` on that day: a short month takes its last day |
   | "Every 15 minutes between 9 and 5 today" | `"cron": "*/15 9-16 * * *"` with `"start"` and `"until"` today |
   | "Every two weeks from Sunday" · "every 3 days" · "every 90 minutes" · "every year on her birthday" | `"every": "2 weeks"` (or `3 days`, `90 minutes`, `1 year`) with `"start": "<first time>"` |
   | "…until Christmas" · "…for the next month" · "…from next Monday" | add `"until": "2026-12-25"` (a date runs through that day), or `"start"` |

   Cron reads minute, hour, day of month, month, day of week; with both day
   fields set, either day will do. Anything a cron cannot say, `every` with a
   `start` can.
5. **Show her the draft and wait for her yes.** Nothing is written before it.
   The draft is short and in her terms. It gives the emoji and what it is for.
   It gives one example of how it might read, said as an example, since each
   one is written fresh. Then it says when it comes, and the first date. For
   example: _"🗑️ Bin night, every Thursday at 7:30 pm, first on the 22nd.
   Something like "Bins out tonight, before the rain". Shall I set it?"_ A change she asks for is a
   new draft; only a plain yes ("yes", "ok", "go ahead") approves it. Before
   the draft, run `node ux/scripts/setup-doctor.mjs --json`. If its `routine`
   reads `off` or `missing`, the draft says in the same line that it won't reach
   her phone yet. A setup note is left for the developer (`set-up`, `SKILL.md`
   § 1), never steps for her.
6. **Add it to the file.** If the file does not exist, copy the template there.
   Either way, before the first entry: its `timezone` is hers from
   `data/PROFILE.yaml` (a blank file reads `UTC`), and `data/README.md` lists
   it. Each entry:
   `{ "id": "<short-slug>", "emoji": "<one emoji>", "text": "<what it is for>", <schedule>, "set": "<now, YYYY-MM-DD HH:MM>" }`.
   The time in `set` keeps it from falling due for a time already past today.
   Several times a day are one reminder, one cron (`"0 12,18,23 * * *"`), not one
   per time. When what it says depends on a file of her record, name it in
   `"reads"`, such as `["data/fitness/supplements.md"]` for supplements. A
   module's own reminder, such as the nutrition updates, also carries
   `"module": "<name>"`, and is paused or stopped like any other. The sweep
   reads the file each time and says what fits that hour. So the reminder never
   needs editing when the list changes.
   The id is short, unique and plain (`evening-tablet`), never a name or a detail.
   The emoji fits what it is for (💊 a tablet, 🗑️ bin night, 🎂 a birthday);
   it marks the reminder in her table and is never added to the text.
7. **Check it:** `node ux/scripts/reminders.mjs check`. Fix every problem it
   prints. Read the `next:` times: they are when the sweep will find it due. If the
   first one is not what she meant, the entry is wrong, not her.
8. **Push it to main now**, as any record write (the `commit` skill,
   `record: update reminders`). An entry that never reaches main never goes out:
   if the push fails, retry, and until it lands say plainly it is not set yet.
9. **Say it back in one line, with the first date, and nothing else before
   the 📝 line:** _"Every Thursday at 7:30 pm, starting next week on the 22nd."_
   One sentence, not a paragraph: no second line of how it works, of the push
   or of the check. The first date is a date, even when it is tonight. The first
   time she sets one, that same sentence also says the words show on her lock
   screen. With `"send": "routine"`, it also says that it comes within the hour
   after its time. For example: _"Every Thursday at 7:30 pm, from tonight, Thu
   5 Nov, on your lock screen within the hour after 7:30."_ Then the 📝 line, as for any record
   write. Nothing more to do: the sweep sends it.

