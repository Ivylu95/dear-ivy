---
name: training
description: She tells you about a lift, a set, a workout or a training session - "did 60 for 1", "45 for 2, couldn't get the third", "squats 50 for 5, 2 left in the tank" - or her bodyweight - "I weigh 64 kg today" - or asks how her lifts or her strength are going, when a heavier attempt is due, or what her protein comes to per kilogram.
---

# Training

**Goal:** Every set and weigh-in she tells you kept as numbers, so a chat can show where each lift's estimated max stands and what her protein comes to per kilogram.

**Audience:** The person, in her own chats.

**Reads:** `data/fitness/training.md` (its `## Sets`, `## Machines` and `## Bodyweight` tables, added from `modules/fitness/templates/training.md` if missing), `data/fitness/README.md` for her protein goal, and `node modules/fitness/scripts/fitness.mjs summary`.

Her lifts and her bodyweight, kept so a session can say where each lift stands (card A-132).
Everything lives in `data/fitness/training.md`; nothing here is personal.

## Logging a set

One row per set under `## Sets`, oldest first:

`| YYYY-MM-DD | Lift | kg | Reps | Left | Note |`

- **Lift:** her name for it, the same spelling each time ("Squat").
- **kg** and **Reps:** as she says them. Pounds are converted and the note says so.
- **Left:** reps she says she had left in the tank ("2 left", "could've done one more" is 1,
  "max", "couldn't get another" or a failed rep is 0). Not said: leave it blank. Never ask
  only for it; ask once a session at most, and only on a heavy set: "how many did you have left?"
- **Note:** her words when they carry something: "grip slipped a bit", "felt good".
- Warm-ups she does not mention are not logged. A set she failed is logged as the reps she got.
- Then run `node modules/fitness/scripts/fitness.mjs check`; fix any row it names.
- Her prose line in `## Log` stays as before: the table is for numbers, the log for her words.
- Say back what was kept, plainly, without praise or a verdict on the set. Where the lift
  stands, and any heavier attempt, only when she asks.

## Machines

A machine's settings (seat, pad, handle) go in `## Machines`, one row a machine, so a session
finds them again (T-777): `| Machine | Setting | Date | Note |`. A new setting for the same
machine is a new row; the old one stays. Her log line still says what she did.

## Reps left unsaid

A set told mid-session without its reps ("trying 80 now", "did 80") is kept in `## Log`
with "reps not given". When the session ends (she moves on to food, says she is done, or the
day turns), `node modules/fitness/scripts/fitness.mjs owed` lists the ones no `## Sets` row covers yet: ask
once, all in one line ("Before I forget: how many reps on the 80?"), and fill in only what she
answers. Never asked mid-set, never twice.

## Bodyweight

One row per weigh-in under `## Bodyweight`: `| YYYY-MM-DD | kg | Note |`, as she says it.
Never asked more than once a week, never on a hard day, and never with a comment on her body.
A weight is a number for protein per kilogram and, later, her energy burn; nothing else.

## Saying where a lift stands

`node modules/fitness/scripts/fitness.mjs summary` gives each lift's best estimated max (Epley on reps
done plus reps left; a true single is the max itself) and its best per session, and protein
per kilogram once a weigh-in exists.

- Call it an **estimated** max; only a lifted single is a best. Her bests table stays hers.
- A heavier attempt is due when recent sessions estimate at or above it with reps to spare,
  not because time has passed. Say what the numbers show; whether to try is hers, and no
  weight to try instead or work up to is named for her.
- Protein per kg is set against 1.6 to 2.2 g per kg a day (`modules/fitness/knowledge/practices.md`).
  Outside that range: say so once, and leave the goal hers to change.

## Never

- Never a verdict on her body, her weight or her shape.
- Never a training plan or a load for a hurt back: pain that is sharp, runs down a leg or
  brings numbness goes to a doctor or physio, said once.
