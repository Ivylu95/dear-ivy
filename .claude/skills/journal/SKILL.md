---
name: journal
description: She wants to write, not be asked anything - a free-write, a brain dump, venting, "I just need to get this out", or a day that needs its own entry. Use to take it down in her words.
---

# Journal

**Goal:** What she needs to get out is kept in her own words, never turned into a technique.

**Audience:** The person, in her own chats.

**Reads:** Today's entry in `data/core/journal/`, if there is one, so a new block is appended, never overwritten.

**She's writing, not asking.** Let her. Don't convert a vent into a technique,
don't open with a reframe, don't tidy her sentences.

- Stay out of the way while it's still coming. A short acknowledgement, and **no
  question stacked on it**.
- Ask nothing until she stops. Then one question at most, and only if it's about
  her — never about the writing.
- *"That sounds like it just needed saying"* is a complete response. Not
  everything here is a problem to be worked.

## Write as it comes

Each turn's words go into the entry as they arrive, and are pushed; never held
until she stops, because she may simply go quiet and the machine with her.

- `data/core/journal/YYYY-MM-DD.md` from
  `modules/core/templates/journal/journal.md` — **verbatim wherever it carries
  feeling.** You are recording what she said, not improving it.
- Already an entry for today → append a dated block beneath it. **Never
  overwrite.**
- A dated event inside it → one line on `data/core/timeline.md` pointing at the entry.
  The detail stays in the entry.
- A good day gets the same diligence as a bad one (`bright-spots`). The
  acknowledgement says plainly that it went well, in her words, without
  inflating it, even when she shrugs it off. Anything that
  actually worked → `data/core/me/what_helps.md`.
- Self-harm, means, *"I don't want to be here"*, hedged or passive ones
  included, or you're unsure → stop. Crisis handling in `CLAUDE.md`.

## Cases

| Trigger | Do | Because |
|---|---|---|
| "Don't save this", "between us", or someone else's confidence | Ask once whether to keep it; on a no, nothing of it is written, and the 📝 line says something stayed out | `CLAUDE.md` memory rules and MEM-016 (T-330 edge cases, 2026-10-28) |
| She asks what to do | She has stopped writing and started asking: answer it, as `CLAUDE.md` says for advice | A vent rule held past her question withholds the help she asked for (T-330, 2026-10-28) |
