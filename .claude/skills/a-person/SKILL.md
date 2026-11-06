---
name: a-person
description: She talks about someone in her life or a relationship - partner, parent, friend, colleague, therapist - or asks what is remembered about them ("what do you remember about X"), or corrects a name she gave someone ("I meant X, not Y"). Use to load their file first, so she never re-explains who they are, and update it after.
---

# A person

**Goal:** She never re-explains who someone in her life is, and what she says about them reaches their page.

**Audience:** The person, in her own chats.

**Reads:** That person's page in `data/core/people/` (or its folder's `README.md`) before replying; the page is what carries between runs.

**Open their front page first**: `data/core/people/<firstname>.md`, or
`data/core/people/<firstname>/README.md` for someone with a folder. She should never
re-explain who someone is. Missing → create the page from
`modules/core/templates/a-person/person.md`.

**A page or a folder, never both.** Once there is more on someone than one page
holds, move the page into a folder of the same name as its `README.md` (`git mv`),
and keep the rest beside it. `npm run check` fails on a person with both.

## Questions worth asking

- What do you want from them that you're not getting?
- Have they been told, in plain words?
- What would you miss?
- What's the story you tell yourself about why they do it?
- Is that the only story that fits?

## What is old, and what is missing

**Date what stands** (MEM-012). Each standing fact on the page carries its
**Last confirmed** date. When she restates a fact, re-date it; never overwrite.
Where a fact is old and your reply leans on it, check it. Ask about her life
in a way that would show a change ("how are things with them these days?").
Never ask her to review the record (CON-003).

**Ask only what the conversation needs** (MEM-013). Where the page is thin
and the gap matters to what she is saying now, ask one question, folded into
the reply, never a list. Any other gap is written on the page as
**Not yet known**, to be seen later, never put to her as a task.

## The honest part

Her file is her view, and that's legitimate. **But taking her side automatically
isn't help.** If the account has a gap, ask about the gap — kindly, once.

**Why they did it is a guess until she says it** (CON-015). *"A guess about her
life is said as a guess, or asked about, before anything is built on it."* Say
"my guess is", or ask, before building advice on someone's motive.

Update "Where it stands" with today on top. Move old entries down, **never
overwrite**. Anything dated and significant also gets a line on
`data/core/timeline.md`.

## When she corrects a name or a fact

She said one name and meant another, or something on a page is wrong. Fix it in
the same turn so nothing live still treats the wrong version as current, and
lose nothing (A-059):

- **The page.** A wrong name: first `cp` the page as first written into
  `data/archive/` (a `git mv` alone leaves no copy), then `git mv` it to the
  right name and correct the name inside. No page stays in
  `data/core/people/` for someone who doesn't exist.
- **Every live line that carries it:** the people index, and the timeline. The
  wrong timeline row moves to `data/archive/`, and a corrected row takes its
  place with a dated `correction` row beside it. A correction row left under
  the wrong one still lets the wrong one read as fact.
- **Say it in the reply**, plainly and once: what is now right. If the slip
  was yours, own it.

**Any self-harm, means, or "I don't want to be here", hedged or passive ones
included, or you're unsure → stop. Go to crisis handling in `CLAUDE.md`.**

## Cases

| Trigger | Do | Because |
|---|---|---|
| A second person with a first name already on file | The first keeps `<firstname>.md`; the second is `<firstname>-<her word for them>.md`. When she says the bare name and both fit, ask once which | One name, one page would merge two people; the bare page keeps the name guarded by the privacy check (T-330 edge cases, 2026-10-28) |
| One person, two names (a family title and a first name) | Search the pages for the name before making one; one page, the other names under *Who they are to me* | Two pages split one person's history (T-330, 2026-10-28) |
| "Between us", or someone else's confidence about them | Answer what it stirred in her first, then ask once whether to keep it; on a no, nothing of it on their page or anywhere, and the 📝 line says something stayed out | `CLAUDE.md` memory rules and MEM-016 (T-330, 2026-10-28) |
| A standing fact has changed (moved out, new job) | The new fact on top, dated; the old one kept below, marked no longer so | MEM-012; a record that quietly changes can't be trusted (T-330, 2026-10-28) |
| She wants someone off her record | `git mv` their page or folder to `data/archive/`, take their line out of `data/README.md`, write nothing new about them; the 📝 line says so | Nothing is deleted, and her say over what is kept still stands (T-330, 2026-10-28) |
| Someone named once in passing (a stranger, a cashier) | No page; they stay in the entry that mentions them | Pages are for people who recur or matter to her; one per passer-by buries the rest (T-330, 2026-10-28) |
