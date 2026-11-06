---
name: looking-back
description: A review of the last few months - about every 3 months or 25 sessions, or she asks how far she has come. Use to lay her past words beside now.
---

# Looking back — every ~3 months

**Goal:** She sees her own past words beside the present, with no progress manufactured.

**Audience:** The person, in her own chats.

**Reads:** `data/core/state/log.md` for the last `review` line, which is what carries between runs. It also reads `data/core/state/now.md`, including anything she asked to drop, and the recurring section of `data/core/calendar/calendar.md`. Then it reads `data/core/me/patterns.md`, the last few sessions, and the standing files in `data/README.md`.

**Trigger:** 25+ sessions, or 3 months since the last `review` line in
`data/core/state/log.md`.

**Offer it, don't impose it** — and drop it if the day is heavy. *"It's been
about three months. Do you want to look at where things were versus now? Fine if
not."*

**Prepare first:** `data/core/state/now.md`, `data/core/me/patterns.md`, the last few
sessions, and the standing files in `data/README.md` filtered to three months ago.

## Show, don't conclude

- Read **her own words** from back then — verbatim, dated. That does more than
  any observation I could offer
- What's moved, with dates
- What hasn't, said plainly and without judgement
- **What she's stopped mentioning** — often the most interesting thing in the
  room. Ask; don't assume it resolved
- Then ask what *she* notices. Her read outranks mine

**If nothing has improved, don't manufacture progress.** She'll hear it as false
and it costs the alliance. *"This has been a hard three months"* is honest and
more useful.

Reviews land hard — **watch for crisis throughout** (`CLAUDE.md`). Don't end on a
target unless she wants one.

Write it to `data/core/journal/` (shape:
`modules/core/templates/journal/journal.md`). Date any change in `data/core/me/what_i_want.md`, and move
the old version down. Mark shifts under **Exceptions** in `data/core/me/patterns.md`.
Append `review` + date to `data/core/state/log.md`.

## Cases

| Trigger | Do | Because |
|---|---|---|
| Inside a fortnight of a hard anniversary | Don't offer it; if she asks, keep it gentle. Never say why | `CLAUDE.md`: be gentler, don't announce it (T-330, 2026-10-28) |
| Few sessions, or little of her own words from back then | Say the record is thin and show only what is there. Nothing inferred to fill it | A review built from guesses is manufactured progress or decline (T-330) |
| The record holds mostly hard days | Say that hard days are what got told, then ask what else the time held. Never read it as "the period was all bad" | A record of only bad days becomes evidence against her (`CLAUDE.md`, T-330) |
| What she stopped mentioning is something she asked to drop, or a pattern she didn't recognise | Leave it out | Nothing she asked to drop comes back; an unrecognised pattern isn't returned to (`CLAUDE.md`, T-330) |
