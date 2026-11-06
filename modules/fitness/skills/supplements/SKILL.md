---
name: supplements
description: She asks to see, add, change or stop a supplement - "show my supplements", "what do I take today", "I've started taking X", "I stopped X", or sends a photo or list of them. Never advises on doses or mixing.
---

# Supplements

**Goal:** One list of her supplements, kept in her record and shown the same way every time.

**Audience:** The person, in her own chats.

**Reads:** `data/fitness/supplements.md` (copied from `modules/fitness/templates/supplements.md` if missing), and the chat's narrow or wide view.

**One list, the same two views every time.** The list lives in
`data/fitness/supplements.md`. If it doesn't exist yet, copy
`modules/fitness/templates/supplements.md` there first. What she takes on a given day is
logged by `fitness:log`, in `data/fitness/days/`.

## Which part to read

**Every run reads:** nothing beyond this page.

**Every rule on this page holds on every route**: her rules before any supplement is named,
and what it never does.

| She... | Read |
|---|---|
| asks to see her supplements, or what she takes today | [`showing.md`](showing.md) |
| adds, changes or stops one, or sends a photo or list of them | [`changing.md`](changing.md), then `showing.md` for the new list |
| mentions one on or past its pack's re-check date | `changing.md` (*Brand and label*) |

**Never on the list without a brand and label** (card A-017): a supplement named without them
waits under **Waiting for brand and label**, and nothing is filled from a product she has not
shown (`changing.md`).

## Her rules

Under **Her rules** in the list, her own words on when she takes each and when she never does
("never before bed", "with water only", "only in winter", "not every day"), kept verbatim
and dated (card A-045). Every time a supplement might be named, by this skill or in a
nutrition update, these are read first; one is never suggested outside them, and "not every
day" is checked against her last two weeks of days.

## What it never does

This is a record of what she takes, not advice.

- **Never** suggest a dose, a timing, or a new supplement, and never stopping one for good.
- **Food first, the one exception** (card A-045). A supplement is a top-up to her
  diet, not something to finish: it earns a mention only where food leaves a need unmet. for a supplement taken for a nutrient (a
  multivitamin, vitamin D, fish oil, magnesium, protein), the day's update may say that what
  she has eaten today already covers what it is for, so it adds little on top today ("sardines
  at lunch cover the omega-3 your fish oil is for"). Facts from her logged food and the
  label, never a dose. The other way too: where a nutrient is still short late in the day and a
  supplement already on her list carries it, say so ("your multivitamin's magnesium
  would cover part of today's shortfall"), never beyond the label's serving and never past an
  upper limit. Not for herbal or hormonal ones (a herbal extract, a hormone-support
  blend), whose purpose food does not cover; those are only said back as her list has
  them. Never for a prescription.
- **Never** say whether a supplement is safe to combine with her prescriptions.
  If she asks, say in one line that her prescribing doctor answers that, and
  offer to put the question in `data/core/state/open_loops.md` for her next
  appointment.
- Prescription medicines are not tracked here. They stay where her record keeps
  them (`data/core/me/about_me.md`).
