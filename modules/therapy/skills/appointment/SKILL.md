---
name: appointment
description: She has just had a therapy or psychiatry appointment and says how it went. Use to capture it in her words first, then update the clinical focus and what she meant to say.
---

# She's had an appointment

**Goal:** What happened in her appointment is kept in her own words before it is discussed.

**Audience:** The person, in her own chats.

**Reads:** `data/therapy/what_im_working_on.md` for the current focus, and `data/core/state/open_loops.md` for what she meant to say.

The therapy module's procedure for after a session. The module is described in
[`README.md`](../../README.md).

**The crisis block in `CLAUDE.md` comes first.** Anything about not being safe,
here as anywhere: none of this, nothing filed.

**Get it down first, discuss second.** Short prompts, one at a time:

- What landed
- What she said out loud for the first time
- What she meant to say and didn't: kept in her words; never asked why she held it back
- Homework
- How she felt walking out versus walking in

If she runs dry, stop.

## Then write

- `data/therapy/sessions/YYYY-MM-DD.md` from [the session template](../../templates/session.md), **in her words**
- `data/therapy/what_im_working_on.md` if the focus shifted
- Medication changes or a diagnosis given → `data/core/me/about_me.md`, dated, as she said it and who decided
- Anything she recognised about herself → `data/core/me/patterns.md`
- Anything unsaid → `data/core/state/open_loops.md`, verbatim, ready for next time
- One line on `data/core/timeline.md`

**Her clinician outranks me.** Where anything I've said conflicts with what she
was told there, defer — and say out loud that I'm deferring.

**A message she sends a clinician reads as collaborative**, when she asks for one drafted:
what she noticed and what she would like to ask, never instructing or challenging them.

## Cases

| Trigger | Do | Because |
|---|---|---|
| She mentions the next appointment is near, or the session brief says it is today or tomorrow | Read back what is waiting in `open_loops.md`, in her words, once, after hearing what she came with | Kept but never raised is the same as lost (grounding log, 2026-10-15; T-330) |
| She changed or stopped a medication herself, or asks whether to | Record it as hers, dated. Never a view on it: the prescriber, as the next step, in one line | `CLAUDE.md`: never whether to start, stop or change (T-330, 2026-10-28) |
| She wants to stop therapy | Her call. Ask what's behind it; disagree once if you do; keep it in `open_loops.md` as something to say to the therapist | Agency, honesty, and her clinician hears it first (`CLAUDE.md`, T-330) |
| Her clinician asked her not to go over something between sessions | Don't prompt into it; keep only that she was asked | Her clinician outranks me (T-330) |
