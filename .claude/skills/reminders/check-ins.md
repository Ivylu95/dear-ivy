# Check-ins

Read when she asks about a check-in, with the part for what she asked: `setting.md`, `seeing.md` or `changing.md`. She may ask to be checked in with on a schedule, or to see, move, pause or stop one. The must-holds in `SKILL.md` apply.

A reminder carries out what she decided. A check-in is the other way round. She
decides only **when**. At each time, the sweep reads her record and asks the
one thing worth asking, or holds back (HBT-014). "Check in with me every
morning", "ask me how the week went on Sundays", "weekday afternoons at 3".

- **Set the same way, in their own file:** `data/core/calendar/check-ins.json`,
  under `"check_ins"`. Each is `{ "id", "emoji", "text": "<its focus, or Open>",
  <schedule>, "set" }`. They use the same schedules and the same draft for her
  yes, such as _"🌤️ A check-in every weekday at 8 am, about how you slept and
  what's ahead. First tomorrow. Shall I set it?"_ Every command takes
  `--kind check-ins`, namely `check`, `list --json` and `archive`. Push to main the moment it is set.
- **It reaches her only while `data/core/me/nudge.md` reads `nudge: on`.** Her
  asking for a check-in on a schedule counts as asking to be told. If it reads
  off, the same write sets it on, in her words. CON-009 forbids offering the
  nudge, not doing what she asked. Never after a hard day; it holds instead.
- **Her table:** when she asks what reaches her, show one table, the reminders'
  columns, in two groups: ⏰ **You asked** (her reminders) then 💬 **It asks**
  (her check-ins). The check-ins' table calls its third column **Check-in**
  and its sixth **Times asked**. The rest match the reminders' columns. **Times
  asked** counts the questions asked. When the last one was held back, **Status**
  says _"Held 8:00 am · a hard day"_. That is not a fault, unlike a missed one.

