---
emoji: ⏰
inline: first
runs: local
every: 1 hour
governs: HBT-010
---
# Heartbeat: reminders

The one job the orchestrator runs **itself, first, every sweep**, before it asks
what else is due (`inline: first`; HBT-010 design 2). No subagent, no claim: a
reminder must not wait behind a checkout and an install. It never fails the run.

**Never a fixed line** (HBT-010, *"written fresh each time ... never the same words
twice"*). Each reminder's `text` in her file is what it is **for**; you write the
message.

1. In the folder you were started in, note the time, then run
   `node ux/scripts/reminders.mjs send-due` (on a backup runner, whose `sender` printed
   `backup <minutes>`, `send-due --overdue <minutes>`: it sends only what the usual sender has
   left that long, A-177). It prints JSON: `through`, and each
   reminder `due`, with its `emoji`, what it is `for`, the files it `reads`, and its
   `lastSent` messages.
   Nothing due: append `reminders: none due` to `temp/reminders-sent.txt` (`>>`, never `>`) and you are
   done.
   A line instead of JSON (`reminders: no reminders file`, or one starting `reminders: NOT SENT:`):
   append that line as it is to `temp/reminders-sent.txt`, so the report names it, and you are done.
2. **Write each one fresh.** Read `data/core/state/now.md`,
   `data/core/me/how_to_talk_to_me.md`, every file in its `reads`, and only what
   else the purpose touches (the calendar for an appointment). A reminder that
   reads her supplements list says what that list has for this time of day,
   training or rest day, and its notes (a supplement kept for one kind of day is
   said as that, never as a plain "take it"); one whose list holds nothing for
   this slot says so in a line. A reminder that reads `data/fitness/days/` reads
   today's file (and the days of any fasting window her targets name), her targets in
   `data/fitness/README.md` and her usual meals, and says where the day stands in the
   `fitness:log` skill's day summary (`modules/fitness/skills/log/day.md`, *Showing the
   day*): a bar and percentage for each target, what is left, and one or two foods that would
   close the gap. Nothing logged yet today: say so, and what the day's targets are. Telegram shows
   no tables, so here alone the message runs to a few short lines, one per target (emoji, bar,
   percentage, what is left), then the suggestion. Calories are net, eaten minus her logged exercise (card A-048). It shows one line per target she has set under
   **Targets** in `data/fitness/README.md`, and nothing without a target (card A-042). It ends with one plain paragraph
   for the next meal: the food, then a supplement from her list only if food will still leave
   a need unmet, as the skill's *What next* says (cards A-044, A-045); when food covers
   the day, no supplement is mentioned. A calorie budget reads as room, never as something to fill
   (card A-043). The suggestion follows the skill's
   *To close the gap* (card A-044): inside the calories left, favouring her own foods, and
   chosen to fill any other gap she has; estimates are one line, "~ some of today is
   estimated", never the items (card A-042); still nothing she would not want on a lock
   screen.
   - **`"timing": "judged"`** (the nutrition update, card A-099): it falls due every hour across
     her waking hours, and **sending nothing is the default**. Decide as a nutritionist checking
     in on a client would, from her day files in `data/fitness/days/` (today and the last
     week), her targets, her fitness log, and its `lastSent` and `lastSentAt`:
     - **Worth a message** only for one of these: a meal she usually eats is 30 to 90 minutes
       away, not yet logged today and not one she skips (help her plan it); she logged a meal in the last hour or two and the day has moved
       (a short note on where it now stands); she has gone five or more waking hours with
       nothing logged on a day she is tracking (a gentle "have you eaten?"); or a usual meal is
       two hours past with nothing logged (card A-100, asked once).
     - **Limits** come from *Check-ins* in `modules/fitness/knowledge/practices.md` (how many a
       day, how far apart, quiet hours, backing off when unanswered), overridden by her own under
       **Updates on Telegram** in `data/fitness/README.md` (a meal she skips, a cap she set),
       and read fresh each run, never fixed here. Within a day: `lastSentAt` keeps the spacing;
       a day with nothing logged gets one light message only (card A-049). Backing off starts
       after two in a row go unanswered: one unanswered message never holds the next. Once enough go
       unanswered that *Check-ins* says none, none goes until she writes or logs again (card A-099:
       they never keep coming once she has stopped responding). A hard day (below) changes how it
       is written, never whether it goes.
     - Not one of those, or a limit in the way: send nothing, and keep it as held, with the
       reason, so the list shows it held rather than a silent gap (a reminder once held for a hard-day
       mark and one unanswered message showed nowhere, and read as messages stopped):
       `node ux/scripts/reminders.mjs hold <id> --why "<the reason in a few words>" >> temp/reminders-sent.txt`.
     What she ate on past days shapes the judgement and the suggestion, and is never retold. It also goes, once, at the hour her
     supplement list gives a supplement with no meal (night, before bed), as the day's last
     word: what is left, and that supplement on its list's terms. Otherwise send nothing for it and
     keep it held: `node ux/scripts/reminders.mjs hold <id> --why "no meal near" >> temp/reminders-sent.txt`. What she ate on
     past days is used for the timing and the suggestion, never retold in the message. Then one or two sentences, second person, warm and plain, that do what it is for
   and fit today: what she has on, how the week has gone, the time of day.
   - **Lay it out for a phone** (card A-129): a short first line, under 60 characters and
     with no emoji at its start (send-one adds the reminder's emoji and puts that line in
     bold); a short line straight under it if there is something good to say first (send-one
     joins it to the heading after an en dash); a blank line; then short lines, one number per
     line, each opening with its emoji; any list (numbers, times, things to do) one item a line,
     which send-one turns into bullets; and the suggestion as its own paragraph. Pass the line breaks inside `--text`; send-one
     keeps them. One line is fine for a simple reminder: it is then sent as it is.
   - **Sound like a friend** (card A-149): warm and encouraging, the way a friend who knows
     her day would text, never a report. Say what went well before what is left ("a solid start
     today 💪"), and open each line with an emoji that fits it (🍗 a meal, 🥩 protein, 💧 water,
     🔥 calories): a few in all, never a string of them, never in place of words. After a hard
     day, or on anything about how she is really feeling, no cheer and no emoji beyond the
     reminder's own.
   - **Never** add advice on doses, timing, or whether to take something (the one exception:
     the nutrition update may say where today's food already covers a nutrient supplement,
     per the `fitness:supplements` skill's *Food first*, card A-045); never name
     anything her record says to hold or check first as if to take it (say instead
     to check with the pharmacist or doctor, if the purpose names it).
   - **Never** anything she would not want on a lock screen: no names of others, no
     crisis, no therapy, nothing from *Handle with care*.
   - After a hard day (the last line of `data/core/state/log.md` is crisis or panic,
     today or yesterday): still send it, shorter and gentler. A hard day is never a reason to
     hold a message: it is never written as the reason in `hold --why`, except for one set
     unasked (below).
   - Never the same words as any of its `lastSent`.
   - **Exact, live, and nothing said already** (T-811): name what is to be done and by when,
     from its purpose and what the record holds now (the form, the last day, what changed),
     never a vague "that thing" or "still open". A fact one of its `lastSent` already gave
     goes again only if it changed or is due today or tomorrow: a weekly one says this week's
     part, a nutrition update where the day stands now, never last time's line again. No
     question unless its purpose calls for one, and then about it: never one that would fit
     anyone ("how are you feeling?"), never one that assumes a hard day.
   - **`"inferred": true`** (card A-172: set unasked, from a to-do heard in a chat): one plain
     line of what is to be done, no name of anyone, no place or detail beyond its purpose, and
     nothing from *Handle with care* in `data/core/state/now.md` or what
     `data/core/me/how_to_talk_to_me.md` says to drop: if its purpose now touches one, hold it
     (`hold <id> --why "dropped topic"`) rather than send. After a hard day it is held, never sent,
     and send-one holds it by itself; a hold here may say so. It goes once, and links only its own
     chat: never `--chat` or `--no-chat` for it, and never `send_message` to that chat first (it is
     the chat it came from, already told). `"bot": "dev"` (it, or any reminder) goes to the
     development bot: send-one routes it.
3. **Claim each on main, then send it** (A-177): two runners can send, so a reminder is claimed
   on GitHub's main before it goes, and only one claim can land. Make the checkout step 4 uses
   now (as step 4 says, at `temp/hb-rem`), carry the sent log into it as step 4 does, and from it,
   for each due one:
   `node ux/scripts/reminders.mjs claim <id> --due "<its due>" --by "$(node .claude/hooks/lib/heartbeats.mjs runner)"`.
   Exit 3 means another runner has it: leave it, and append `reminders: <id> left to another runner`.
   Commit the sent log as `record: reminders claimed` and `git push origin HEAD:main`. Refused:
   `git fetch -q origin main && git merge -q --no-edit origin/main`, claim the rest again, push
   again. Still refused: send nothing this sweep, append `reminders: NOT SENT: main kept moving
   before the claim`, and stop here; the next sweep claims afresh.
   Then **send each one claimed**, from the folder you were started in:
   `node ux/scripts/reminders.mjs send-one <id> --text "<your words>" --due "<its due>" --by "$(node .claude/hooks/lib/heartbeats.mjs runner)" >> temp/reminders-sent.txt`.
   It looks at main once more just before sending, and leaves one another runner has.
   Each one in `send-due`'s `missed`, if any, append `reminders: <id> missed <its time>`, so the
   developer's report names it.
   It refuses a repeat or the purpose as written: write it again, fresh. Never print
   the key. The chat's link is added as its last line by send-one itself: never write a link
   or a chat's name into the words.
   **Which chat it links** (card A-128): her phone only tells her something; she answers in a
   Claude chat. Read her list, `data/core/state/chats.json` (what each chat is for, everyday or
   development, open or closed). A message that needs nothing back goes with `--no-chat`. One
   that needs an answer links the open everyday chat it belongs to, by what each is `for`,
   with `--chat <its url>` (an entry's own `chat` is the default); none fitting, the one marked
   `general`. Before the first linked send of a sweep, list her chats with `list_sessions`
   (mine only) and keep the list current in the checkout you commit from: a listed chat now
   archived is set `"state": "closed"`, never removed. If the general chat is closed, start
   one with `create_session` under the same name with " (2)", in everyday mode (no
   development), add it as `general`, and close the old. Start a chat for anything else only
   for a new lasting topic none covers, and say so in the report. Then **tell the chat first**:
   `send_message` to it, before `send-one`, with what is going to her phone and what it is for
   ("Sent to her phone just now: … If she replies here, this is what she is answering."). Any of
   these tools missing or refused: link as above anyway, and add `chat not told (<why>)` to
   that send's line in `temp/reminders-sent.txt`. send-one refuses a development, closed or
   unlisted chat by itself.
4. **Keep the mark and the messages on main**, if anything was sent, in the checkout step 3
   made. It is made like this: unshallow as in
   the orchestrator's step 1.1, make a checkout as step 1.1 does but at `temp/hb-rem`
   (`temp/hb-rem-<HHMM>` instead, named in the summary, if `temp/hb-rem` is still there: a run
   whose save never landed keeps it, so never remove it; use it wherever this step says `temp/hb-rem`),
   install into it with `npm --prefix temp/hb-rem/ux ci --no-audit --no-fund`, then from
   `temp/hb-rem` carry the sent log over, never by copying the file (the record guard refuses a
   copy laid over a record file, and it would drop what only the checkout holds; 2026-10-29):
   `node ux/scripts/reminders.mjs carry-sent <the folder you were started in>/data`, then run
   `node ux/scripts/reminders.mjs mark-sent "<through>"` (if any send printed
   `refused` or `not sent`, add `--before "<the earliest such one's due>"`, so it
   is tried again next sweep rather than skipped) and then
   `node ux/scripts/reminders.mjs archive` (a one-off sent over two days ago, or
   one she stopped, moves to `data/archive/`, so her file and table hold only
   what still runs), commit `data/core/calendar/reminders.json`,
   `data/core/calendar/reminders-sent.json` and anything it moved to
   `data/archive/` as `record: reminders sent`, `git push origin HEAD:main` (fetch and merge main
   first if refused). Still refused: push it as a rescue, `git push origin HEAD:refs/heads/rescue/main-<YYYYMMDDHHMM>`,
   which GitHub's merge-sessions carries into main. Only once one of those pushes landed,
   `git worktree remove` the checkout this step made from the root; if neither did, leave it and
   say so in the run's summary. Its commit is on no branch, so removing the checkout orphans it, and
   the sent log of what went to her phone with it (round 43 of the git sync review). Until a push
   lands, the next sweep may send those once more.
5. Keep `temp/reminders-sent.txt`: the developer's report reads it.
