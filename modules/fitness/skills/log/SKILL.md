---
name: log
description: She says or shows what she ate, drank or took - a photo of a meal, a wrapper or a label, "I just had X", "took my supplements" - or asks how her day looks - "what have I eaten today", "nutrition summary", "how's my protein", "how am I doing today" after logging food, or asks when she will be checked in with about food, or sets up nutrition updates. Use to log each item with where its numbers come from, and to show the day's summary.
---

# Log what she ate or took

**Goal:** Every day keeps what she ate, drank and took, each number marked by where it came
from, and she can see the day at a glance.

**Audience:** The person, in her own chats.

**Reads:** `data/fitness/days/<today>.md` (copied from `modules/fitness/templates/day.md`
if missing), and **Targets** in `data/fitness/README.md`.

## Which part to read

**Every run reads:** nothing beyond this page; then the table names each part.

**The first item logged in a chat also reads `day.md`** (or `week.md`, below). Every rule here holds on every route.

| She... | Read |
|---|---|
| logs food, drink, the usual, a supplement, a session or a total | [`logging.md`](logging.md) |
| asks about her day or what next; an update; the first item in a chat | [`day.md`](day.md), and `fasting-window.md` inside a fasting window |
| the day shown while **Targets** is empty | [`no-targets.md`](no-targets.md) with `day.md`, and `fasting-window.md` inside a fasting window |
| first item in a chat, no **Targets** | [`goals-ask.md`](goals-ask.md) with `day.md`, and `fasting-window.md` inside a fasting window |
| the updates offer is due | [`updates-offer.md`](updates-offer.md) |
| the day shown with a usual meal passed unlogged | [`day-gaps.md`](day-gaps.md) with `day.md`, and `fasting-window.md` inside a fasting window |
| asks for more | [`day-detail.md`](day-detail.md) with `day.md`, and `fasting-window.md` inside a fasting window |
| sets, changes or asks about a target | [`goals.md`](goals.md) |
| asks when she will be checked in with about food, answers the updates offer, or changes updates | [`updates.md`](updates.md) |
| sets a fast, or a target over several days | [`fasting.md`](fasting.md) |
| the day shown inside a fasting window | [`fasting-window.md`](fasting-window.md) with `day.md` |
| "How was my week"; first log after a Sunday, if asked weekly, in place of the day view | [`week.md`](week.md) |
| nothing logged, or a meal not logged, the day not shown | [`missing.md`](missing.md) |

## On every route

- **Estimates speak only through ~, in every reply, the logging one too** (card A-145): no
  sentence saying a figure is estimated, approximate or rough ("about ~23 g" included), no
  figure broken down by item ("~19 from the eggs and ~4 from the toast"), no assumption spelled
  out (egg size, oil, portion, "treat it as"). Those go under Notes in the day file, and to the
  chat only when she asks how a figure was worked out.
- **Every number keeps its source** (Label, Looked up, Estimate), so a guess never passes for a
  fact.
- **Unreadable is asked, never guessed.** One question, only when the answer moves the
  numbers: "did you finish it?", "about how much rice?".
- **Nothing logged is never zero** (cards A-049, A-100): `day-gaps.md`, `missing.md`, `week.md`.

## Hers to shape, within bounds

She changes it by talking (card A-046), into her record (`data/fitness/`), never here; the
most specific wins: this harness, the standards in `../../knowledge/practices.md`, then hers.

- **Grounded, and honest.** A change is checked against the standards; an unsound one is
  questioned once, kindly, with the reason and the source; then it is her call, in her words.
- **Safety bounds she cannot talk past** (card A-046). Each stays in the harness; she is
  pointed to a doctor or dietitian, without arguing it twice:
  - a calorie budget or target below 1,500 kcal a day for a man or 1,200 for a woman (1,500
    where her profile gives neither), or a fast longer than 24 hours, without a clinician named
    as supervising it;
  - any supplement taken, or suggested, past its upper limit in the standards;
  - anything that starts, stops or changes a prescription.

## What it never does

- **No verdicts.** Food is never good or bad, never earned, never a cheat. No praise or blame
  for an amount.
- **No targets she hasn't set.** A target lives in `data/fitness/README.md` in her words,
  dated; until then the summary measures against the standard, marked `std`.
- **Nothing about her body.** Weight, shape and size come up only when she raises them, and
  then her words are heard and kept, never assessed: no verdict on her body, even asked for one.
- **No advice on supplements.** Dose, timing and mixing with prescriptions are her
  prescribing doctor's or a pharmacist's; offer to put the question in
  `data/core/state/open_loops.md`.
- **Talk of not eating, purging, or fear around food** sets the log, its targets and changes
  aside, never the rules in this list: the crisis rules in `CLAUDE.md` come first where it may
  be about safety; stay with her.
