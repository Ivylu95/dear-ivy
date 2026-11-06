---
emoji: 💬
inline: second
every: 1 hour
governs: HBT-014, and HBT-001..005 in dev/specs/system/heartbeats.md
runs: anywhere
---
# Heartbeat: check-in

Run by the orchestrator itself (`.claude/jobs/README.md`), inline, every sweep,
**second**, straight after the reminders: no subagent and no claim, and it never
fails the run. It binds `HBT-014` and every `HBT` row in
`dev/specs/system/heartbeats.md`.

A reminder carries out what she decided. A check-in is different: she chose only
**when**; at each of those times it reads her record and asks the one thing worth
asking now, or holds back (`HBT-014`). Her check-ins and their times are in
`data/core/calendar/check-ins.json`, set only on her yes, like her reminders.

1. **What is due?** In the folder you were started in, run
   `node ux/scripts/reminders.mjs send-due --kind check-ins`. It prints JSON:
   `through`, and each check-in `due`, with its `emoji`, its focus as `for` (it
   may be open), the files it `reads`, and its `lastSent` questions; and once,
   `saidLately`, every check-in sent in the last six days, whichever it was. Nothing due:
   append `check-ins: none due` to `temp/reminders-sent.txt` (`>>`, never `>`) and you are done.
   Something due: make the checkout every write goes into now, before anything
   else: `git fetch -q origin main` and `git worktree add temp/hb-ci origin/main`
   (`temp/hb-ci-<HHMM>` instead, named in the summary, if `temp/hb-ci` is still there:
   a run whose save never landed keeps it, so never remove it; use it wherever a step
   below says `temp/hb-ci`).
2. **Refresh her Google Calendar copy first** (A-093), if the Google Calendar
   tools are there and `node ux/scripts/google-calendar.mjs stale --record temp/hb-ci/data`
   says `stale`: with `list_calendars`, then `list_events` on each of her own and
   birthday calendars for the next 14 days in two 7-day windows, one call at a
   time (calls made together hit Google's quota), `pageSize` 10, following each
   `nextPageToken`. Pipe the results, as one JSON array, to
   `node ux/scripts/google-calendar.mjs save --record temp/hb-ci/data` on stdin,
   never through a file. Read only: never create, change or answer an event. No
   tools, or a call refused: keep the old copy and append
   `calendar: not refreshed (<why>)` to `temp/reminders-sent.txt`.
   **Then read the record the way a session does**, and nothing more: `data/core/state/now.md`,
   `data/core/me/how_to_talk_to_me.md`, the Eras and the last month of
   `data/core/timeline.md`, the next fortnight of `data/core/calendar/calendar.md` and of her Google Calendar
   (`node ux/scripts/google-calendar.mjs show --record temp/hb-ci/data`),
   the last lines of `data/core/state/log.md`, and any file in its `reads`. Never
   sweep the folder.
3. **Hold back if her last session ended badly.** If the last line of `log.md`
   carries `crisis` or `panic` and is dated today or yesterday (her timezone),
   and `data/core/me/nudge.md` does not read `hold: off` (her own switch, HBT-005
   design 2, which `send-one` honours too), ask nothing: for each due one run
   `node ux/scripts/reminders.mjs hold <id> --kind check-ins --why "a hard day" >> temp/reminders-sent.txt`
   and go to step 6. A cheerful question after that is worse than none
   (HBT-005 design 2).
4. **Choose one question for each**, and **open with an update when its focus
   asks for one** (a morning check-in, "update me"): two or three short lines
   first, from `calendar.md`, her Google Calendar copy and `open_loops.md`, on today, tomorrow and
   anything in the next week worth a heads-up, a loose end she meant to do;
   nothing on: say so in a few words. **Every line new, live and exact** (T-811; HBT-010,
   never the same words twice; A-129, nothing said twice). Read `saidLately` first.
   - *Said already:* a coming date or open item that one of `saidLately` carried is not said
     again until the day before or the day itself, or until something about it changed
     (moved, booked, a new last day); then the line says what changed. A big date, two weeks
     or more away when it first showed up, also comes back a week before, its line saying
     "in a week" (A-176). send-one refuses a line
     an earlier check-in said, unless it is about today or tomorrow, and names the line: drop
     it, or say what is new. Today and tomorrow go every morning, new or not (A-124).
   - *Exact, never vague:* an open item says what is actually live in the record, what she
     would do and by when (the last useful day to book, send or pay), never that something
     "is still open". Two things on one day, or one in the way of another: one line says so.
     An item the record gives no date or next step for, or last named weeks ago, or that
     `now.md` says is done, stays out, unless it is the one thing below; then it is the question.
   - *The one thing that matters most today,* found before writing, in this order: what
     *Next session opens with* in `now.md` holds (not the check-in lines this job left there),
     something hard or big in the last few days of `timeline.md`, a loose end in
     `open_loops.md` due soon, then a coming date. The update leads with it. After something
     hard in the last few days: gently, and no cheer.
   For example (invented), on a Wednesday, never *"• 🧾 The tax form is due on the 14th.
   • 🏕️ The camping idea is still open."* (both said on Monday, the camping vague), but
   *"• 📅 Nothing on today or tomorrow • 🏕️ Camping and the tax form both land on the 14th;
   the campsite holds a booking until Friday"*, and the one question about that clash.
   **The update is the one fixed part** (A-124):
   on a morning one, today, tomorrow and what is coming always go, even on a day
   nothing else does. **A line of motivation or advice, her training or her food,
   only when something live calls for it** (A-123, A-124), never to fill the slot and never
   by habit. Live means a goal she is working on, something that helped her before, or a
   big day or worry she named for today or the next few days (nerves, a deadline, a move, a
   long run), even when the record holds no tip for it: then close the update with one line of either, from what is live
   in `now.md`, `data/core/me/what_i_want.md` and `data/core/me/what_helps.md`,
   in her words: specific to her day, never a poster quote. A day nothing calls
   for: leave it out. **How she slept** (A-154): where `data/fitness/training.md` keeps a
   `## Recovery` table and it has no row for today, a morning check-in's question is how she
   slept and how her body feels, unless something she named for today matters more; never
   on a hard day, and never a second time that day. If one item in
   `data/core/me/what_lifts_me.md` fits today, it may name it by her own
   description; never search for one, never a link she did not save. A sensitive date is named without
   detail ("your appointment Saturday", never who with or what for). When step 1's JSON
   carries `appointment` (`when`, `date`, `waiting`: notes she meant to bring to an
   appointment today or tomorrow), the update says so in one line, the same way: that
   something waits for her appointment, to see in a chat; never what it says (T-330). The
   question: warm, one sentence, in her words for
   things, about its focus if it has one, else the one thing picked above, so it could
   be sent to no one else: never one that fits any day for anyone (*"What would make
   today feel easier to get through?"*, *"How are you feeling?"*), and never one that
   assumes a hard day the record does not show; fitting the hour (a morning one looks ahead, an
   evening one looks back). It goes to her phone, so it must be safe on a locked
   screen: no one else's name, nothing from *Handle with care*, no crisis, no
   therapy, no medication. Never on anything under *Don't push on* or *What
   lands badly*, never on a topic she asked to drop (`now.md` names it, with no
   detail, after a crisis). Inside a fortnight of a hard anniversary: gentler,
   and not about it. Never the same as any of its `lastSent`. Nothing about the
   record, how it was read, or this run. **Nothing worth asking** (it would only
   fill the slot): one whose focus asks for an update still sends the update, with
   no question (A-124); any other runs `hold <id> --kind check-ins --why "nothing worth asking"`
   instead.
   **Lay it out for a phone** (card A-129): with an update, a short first line under 60
   characters with no emoji at its start (send-one adds the emoji and puts it in bold), a
   blank line, the update one item per line, a blank line, then the question alone. With no
   update, the question as one line. Pass the line breaks inside `--text`.
   **Sound like a friend** (card A-149): warm and encouraging, the way a friend who knows her
   week would text, never a report; each update line opens with an emoji that fits it (📅 a
   date, 🏋️ training, 🍽️ a meal), a few in all, never a string of them, never in place of
   words. Inside a fortnight of a hard anniversary, after a hard day, or on how she is really
   feeling: no cheer and no emoji beyond the check-in's own.
5. **Send it, then leave it waiting** (in the checkout step 1 made). A check-in always needs
   an answer, so it links a chat as `.claude/jobs/reminders.md` step 3 says (*Which chat it
   links*, card A-128): its own `chat`, or the general one, told first. Send:
   `node ux/scripts/reminders.mjs send-one <id> --kind check-ins --text "<the question>" >> temp/reminders-sent.txt`.
   It sends only while her switch reads `nudge: on`, never after a hard session
   (`HBT-005` design 5): either stop it keeps the check-in as held, by itself. It
   refuses a repeat: write it again, fresh. Never print the key. **Only if it
   printed `sent`**, in `temp/hb-ci`, under *Next session opens with* in
   `data/core/state/now.md`, write one dated line:
   `Check-in <id> (YYYY-MM-DD HH:MM): <the question>`, replacing that check-in's
   previous line there, which is first appended to
   `data/archive/check-in-questions.md` (made on first use, with a one-line
   heading); anything else in that section stays. Held, refused or not sent:
   leave `now.md` alone, so her next session never opens on a question she was
   never asked.
6. **Save it.** The calendar copy step 2 refreshed is already in `temp/hb-ci`. In `temp/hb-ci`, carry the
   sent log over from the folder you were started in, never by copying the file (the record guard
   refuses a copy laid over a record file, and it would drop what only the checkout holds;
   2026-10-29): `node ux/scripts/reminders.mjs carry-sent <the folder you were started in>/data --kind check-ins`, then run
   `node ux/scripts/reminders.mjs mark-sent "<through from step 1>" --kind check-ins`
   (with `--before "<the earliest such one's due>"` if a send printed `refused` or
   `not sent`; one stopped by her switch or a hard day is already kept as held)
   and `node ux/scripts/reminders.mjs archive --kind check-ins`; commit as
   `record: check-ins` and `git push origin HEAD:main` (fetch and merge main first
   if refused). Still refused: push it as a rescue, `git push origin HEAD:refs/heads/rescue/main-<YYYYMMDDHHMM>`,
   which GitHub's merge-sessions carries into main. Only once one of those pushes landed,
   `git worktree remove` the checkout step 1 made from the root, never one an earlier run kept;
   if neither did, leave the checkout and say so
   in the summary. Its commit is on no branch, so removing the checkout orphans it, and what
   she was asked with it (round 42 of the git sync review). This step
   runs whenever anything was due, even if all were held, so the holds and the
   mark are kept. Keep `temp/reminders-sent.txt` for the report.

A check-in by hand, outside the sweep, is the same steps from a checkout of its
own, never the tree a conversation saves from (`HBT-007`).

The crisis block in `CLAUDE.md` outranks everything here.
