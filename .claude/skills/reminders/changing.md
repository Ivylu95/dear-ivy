# Moving, pausing, stopping

Read when she asks to move, change, pause, resume, stop or cancel a reminder, or to stop the messages. The must-holds in `SKILL.md` apply. For a move, read `setting.md` for steps 1, 3, 4 and 6 only. Its draft (step 5) and its say-back (step 9) are for a new reminder. This page's two turns replace them.

**Two turns, in this order, every time. Her asking for it is not the yes.**

1. **The turn she asks: one line of draft, and nothing changed.** What changes
   and from when, ending on the question, nothing else: _"💊 Tablet reminder:
   9 pm → 10 pm, from tonight. Shall I change it?"_ No entry is ended, added,
   paused, archived or pushed in this turn. A change she makes to the draft
   (*"make it 11"*) is a new one-line draft, never the yes.
2. **The turn she says a plain yes**, such as "yes", "ok" or "go ahead". Only
   now make the change below. Then run `node ux/scripts/reminders.mjs check`,
   and fix every problem it prints. Push to main at once. If the push fails,
   retry it, because until it lands nothing has changed. Then send one line
   back naming the new time and from when (_"Done: 10 pm from tonight."_),
   followed by the 📝 line.

**The change, on her yes:**

- **Move or change one:** add `"ended": "<today>"` to the old entry. Add the
  new one beside it with a new id. Then run `node ux/scripts/reminders.mjs
  archive` straight away. An ended entry still sends for the rest of its day.
  If it were left in place, the old time and the new could both go the same
  evening.
  Never rewrite an entry in place: it is her record of what she asked for. The
  new entry is written as a new one is: its schedule and fields from
  `setting.md`, steps 1, 3, 4 and 6.
- **Pause:** `"paused": true`; resume by removing it. **Stop or cancel:**
  `"ended": "<today>"`, then `node ux/scripts/reminders.mjs archive`, which
  moves it, and any one-off sent over two days ago, to
  `data/archive/reminders-<year>.json`. Nothing is ever deleted; the archive
  keeps the ended mark. A move ends the old entry the same way.
- **A module's own reminder** (one carrying `"module": "<name>"`, such as the
  nutrition updates) is paused or stopped like any other.
- **"Stop the messages"**, while reminders are live. Switching the nudge off
  only stops check-ins. Ask once whether she means her reminders too.
