---
name: recovery
description: She says how she slept, how sore or stiff she is, or how much energy she has - "slept 6 hours", "barely slept", "legs are sore", "shoulders are a bit sore", "feeling flat today", "slept well, full of energy" - or asks how her sleep or recovery has been this week, or whether she is rested enough for a heavy session.
---

# Recovery

**Goal:** Her sleep, soreness and energy kept one line a day, so a chat can read a week back and see whether she is rested enough for what she plans.

**Audience:** The person, in her own chats.

**Reads:** `data/fitness/training.md` (its `## Recovery` table, added from `modules/fitness/templates/training.md` if missing), and `node modules/fitness/scripts/fitness.mjs summary`.

Her recovery, kept beside her training (card A-154). Everything lives in
`data/fitness/training.md`; nothing here is personal.

## Logging a day

One row per day under `## Recovery`, oldest first, dated the morning she woke:

`| YYYY-MM-DD | Sleep h | Soreness | Energy | Note |`

- **Sleep h:** the hours she says, as a number: "6 hours or so" is 6, "about 8 and a half" is
  8.5, "barely slept" with no number stays blank and her words go in the note. Never worked
  out from the times of her messages: a late message is not a bedtime.
- **Soreness** and **Energy:** her own words, short ("a bit sore", "legs sore", "flat").
  Not said: blank. Never turned into a score she did not give.
- **Note:** where it was, if she said ("a knee"), and what came before when she named it
  ("after a long game", "after a drink").
- She tells more later the same day: fill that day's row, never a second row.
- Then run `node modules/fitness/scripts/fitness.mjs check`; fix any row it names.

## Asking

- At most once a day, and only when today's row is empty: the morning check-in asks it
  (`.claude/jobs/check-in.md`), or, in a chat, once, when she talks about training.
- Never on a hard day, never after she has said how she is really feeling, never in a crisis.
- One plain question: "How did you sleep, and how's your body today?"

## Reading it back

`node modules/fitness/scripts/fitness.mjs summary` gives the last seven days: nights logged, average
sleep, short nights (under 6 hours), and the soreness she named.

- Lay it beside what she plans ("three short nights this week, and the shoulders were sore
  Thursday"): the evidence, not a verdict. Whether to train heavy is hers.
- Most adults need 7 or more hours (`modules/fitness/knowledge/practices.md`); say it once
  if she asks, never as a warning.

## Never

- Never a comment on her body, her sleep habits or her drinking, a kind one included
  ("that's normal after a run", "good your energy held up"); the row is a record.
- Never a sleep aid, a supplement for sleep or a medicine: a pharmacist or her doctor.
- Pain that is sharp, runs down a leg or brings numbness goes to a doctor or physio, said once.
- Sleep that stays poor for weeks, or that she is worried about: her doctor, said once.
