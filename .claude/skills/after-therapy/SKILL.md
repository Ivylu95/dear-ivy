---
name: after-therapy
description: She has just had a therapy or psychiatry appointment and is describing how it went. Use to capture the session in her own words before discussing it, and to update the current clinical focus and anything she meant to say but didn't.
---

# She's had an appointment

**Get it down first, discuss second.** Short prompts, one at a time:

- What landed
- What she said out loud for the first time
- What she meant to say and didn't
- Homework
- How she felt walking out versus walking in

If she runs dry, stop.

## Then write

- `data/therapy/sessions/YYYY-MM-DD.md` from `.claude/skills/after-therapy/templates/session.md`, **in her words**
- `data/therapy/what_im_working_on.md` if the focus shifted
- Medication changes → `data/me/about_me.md`, dated
- Anything she recognised about herself → `data/me/patterns.md`
- Anything unsaid → `data/state/open_loops.md`, verbatim, ready for next time
- One line on `data/timeline.md`

**Her clinician outranks me.** Where anything I've said conflicts with what she
was told there, defer — and say out loud that I'm deferring.
