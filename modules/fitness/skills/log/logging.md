# Logging an item

**Read when:** she logs anything: food, drink, the usual, a supplement, a session, a day's
total. Part of [`SKILL.md`](SKILL.md). One row per item in the day file, oldest first; totals
rewritten.

**Food and drink**
- **Meal:** Breakfast, Lunch, Dinner or Snack, from her words or the time; a drink before
  breakfast is a Snack unless she says otherwise. Never asked for on its own.
- **Water:** drinks add to the **Water** line, in litres, from her words ("a bottle" is 0.5 L
  unless she says otherwise, marked ~).
- **When:** her words ("this morning", "8am"); with no time given, her message's clock time,
  marked "(as sent)", so updates learn when she eats. Never ask only for a time.
- **After midnight**, no time given: the food goes on the day she is still in, before she
  slept, its time "not given": the hour sent says when she wrote, not when she ate, and a
  drink sent in the early hours may have been had hours earlier.
- **Source**, one of three:
  - **Label**: a nutrition panel she photographed. Every figure as printed, per what she had;
    lines beyond the table's columns under Notes.
  - **Looked up**: any branded, packaged or chain item she names, photo or not, searched
    first, every time (card A-120): maker's or retailer's page, then a nutrition database, by
    the `look-it-up` rules (her details never in the query), cited in Notes. Only a near item
    published: scale from it, say so under Notes, mark it ~. Estimate only where nothing published fits.
  - **Estimate**: home, hawker or restaurant food, from the photo and her words, all ~.
- Her words, if any, go under Notes verbatim.
- **A day total that looks high is re-checked item by item** before it is shown: labelled
  figures are the floor, each estimate re-weighed against a published near item, not rounded
  up. Because a day total can come out well above what it is once each estimate is redone.

**The usual, or a past meal**
- "Same as yesterday's breakfast", "the usual", "what I had Tuesday": its rows copied from
  `data/fitness/days/` with today's time, Source as it was, said back in one line. More than
  one match: ask which, once.
- **Usual meals**, in `data/fitness/usual_meals.md` (from its template in
  `modules/fitness/templates/` if missing): her name for it, contents, per-serving figures
  and source; logged in one line by her name.
- **Keeping one:** logged three times, or "save this": offer once to keep it under her name for
  it; her no is kept in Notes, never offered again for that meal.

**A supplement taken**
- A row under **Supplements taken**: what, how much in her words, the product, Source; figures
  from its entry under **Labels and packs** in `data/fitness/supplements.md`.
- **No brand or label yet:** log it as she said it, then ask once for its brand and a photo of
  the front and the label; it waits under **Waiting for brand and label**, never on her list
  (`fitness:supplements`, *Brand and label*).
- **Re-check:** on or past the pack's re-check date, not yet asked for this pack, ask once,
  last: "Still the same <product>?" Yes: the pack starts today. No: ask for the new front and
  label; the old one moves under **Earlier labels** with its dates, never overwritten.
- Her amount differs from the label's serving: record both, plainly, without comment, unless it
  takes her past an upper limit (read it in `../../knowledge/practices.md` before saying so):
  then the safety bound in `SKILL.md`, once.

**A session, or a day's total**
- **Exercise:** a session she mentions (treadmill, cardio, a class, her lifts) is logged in
  `data/fitness/training.md`, and its calories, where she or the machine gives them, on the
  **Activity** line; nothing estimated for a session she gives no figure for. For a sport with
  no figure, start from her own sense of it; a research rate (METs) assumes steady play and runs
  high for a casual game with breaks, so it is a check, never the logged figure, which can sit
  well above what she judges.
- **Totals she gives** ("yesterday I had 2,000 kcal and 150 g protein"): one row in that day's
  file (creating it), "day total, her figures", Source Estimate, her words under Notes.
