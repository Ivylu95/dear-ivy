# Updates on Telegram

**Read when:** she answers the offer of nutrition updates (made by `updates-offer.md`), or asks when she will be checked in with about food, or asks for, changes or stops nutrition updates. Part of [`SKILL.md`](SKILL.md), whose rules all still hold; one level deep, nothing further to open.

The nutrition area brings its own updates: she never has to think to ask for them.

- **Offered once, when the area is new to her:** if `data/core/calendar/reminders.json` holds
  no reminder with `"module": "fitness"` and **Updates on Telegram** in
  `data/fitness/README.md` holds no answer, ask once, after the first item logged in a chat:
  whether she would like nutrition check-ins. By default their timing is **judged** (card
  A-099): checked every hour, sent only when a nutritionist would check in (before or after a
  meal she usually eats, after a long gap with nothing logged), spaced and capped by *Check-ins*
  in `modules/fitness/knowledge/practices.md` or her own limits, and never as a fixed slot.
  Fixed times only if she names them as the times to send ("message me at 12"); when she
  usually eats is not that, it is what the judging reads. "None" is an answer, kept with its date.
- **Set by the `reminders` skill's rules** (drafted for her yes, pushed at once): one reminder,
  `"module": "fitness"`, `"timing": "judged"`, every hour across her waking hours
  (`"cron": "0 10-23 * * *"` unless she gives others), purpose "Nutrition before my next meal:
  where today stands against my goals, what's left, and what I could eat to close the gap"; or,
  where she named fixed times, one reminder per meal at its time. Each reads
  `data/fitness/days/`, `data/fitness/README.md` and `data/fitness/usual_meals.md`. Never
  folded into a supplement reminder.
- **Before the meal, never after it, and none for a meal she skips** (card A-099). An update
  for a meal goes out at an hourly run before her usual time for it, never late. Nothing goes for a
  meal already logged today, one she says she is skipping, or one her last week shows she
  skips. A meal whose time has already passed today gets none today; the first update is the
  next meal still ahead.
- **The draft says how it is judged, not a clock** (E-038, 2026-10-29: a draft of "daily at
  12 noon and 7 pm" failed). Unless she named send times, never a time per meal and never
  "daily at". In plain lines it says: one update covers food and every supplement on her list;
  it comes when it helps, before the meals she usually eats (named by her times) or after a
  long gap, checked against her day each time; none once a meal is logged or for one she skips;
  spaced, with how many a day and how far apart as *Check-ins* gives them now (or hers); and
  that once she stops answering they stop until she writes or logs again, said plainly in about
  those words: "they stop until you write or log again" (card A-099). Never "ease off", "thin
  out" or "slow down" alone: she must hear that they stop (E-047, 2026-11-03: one reply in three
  said "ease off"). Then it asks her yes; never
  "it may arrive nearer" or after.
- **Asked when she will be checked in with about food, the answer starts from her day so
  far** (E-047, 2026-11-03: one reply in three named her usual meal times and nothing of her
  day). First what is logged today in `data/fitness/days/`, or plainly that nothing is yet,
  and which of her usual meals are still ahead by her usual times; only then when the next
  check-in would come, judged from that, and the rest above. Never her meal times alone.
- Her answer goes under **Updates on Telegram**, in her words. Pausing, moving or stopping one
  is the `reminders` skill's, like any other.
