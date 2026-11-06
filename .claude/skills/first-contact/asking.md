# Asking the profile questions

Read when any profile question is asked, answered, skipped or put off, or a
declined one's moment comes. `SKILL.md`'s *Every run* rules hold here too.

## The three sections

`data/PROFILE.yaml` holds its questions in three sections, and the section
decides when each is asked (MEM-014):

- **mandatory** (name, pronouns): before anything else. Timezone is mandatory
  too but carries a default, Asia/Singapore, so it is never asked: write her
  answer the day she says she has moved somewhere else. A trip is not a move:
  her timezone stays, as set-up's `repair.md` says.
- **recommended** (what she wants from this, how she wants to be spoken to,
  whether anyone professional is involved, one person for a bad night): in the
  opening, straight after mandatory. If she arrives with something on her mind,
  these can wait for a natural pause in that session; mandatory cannot.
- **optional**: never asked up front (`SKILL.md`).

The `SessionStart` hook lists every mandatory and recommended question still
owed, in order, with why each is empty.

## Asking

- **The file's own header is its manual.** Read it before the first edit. Each
  question has `value`, `status`, `status_reason`, `last_updated`, and
  `revisit_when` when declined. Every edit sets `last_updated` to now in her zone
  (`TZ=<her zone> date -Iseconds`, e.g. `2026-09-25T21:14:00+08:00`). Her words go
  in `value` as a `|` block for the recommended and optional questions.
- **Every edit is checked the moment it is saved**, by the edit tools or by the
  shell. A broken file comes straight back with the line and the rule it breaks.
  Fix it before anything else. Then commit and push as usual.
- **Every question carries its reason and her permission, in one message**
  (MEM-014). The message holds one line on what it does for her, then "is it
  okay if I ask?", the question, and a way out. Never what the system needs; always what she gets.
  Example, for how she wants to be spoken to:
  > One thing that'd help me: knowing how you like to be spoken to. Some people
  > want it gentle, some want it straight, and I'd rather get it right than
  > guess. Is it okay if I ask? Gentle or direct, and more questions or more
  > advice? Totally fine to skip.
- **A two-part question keeps both parts.** How she wants to be spoken to is
  gentle-or-direct *and* questions-or-advice. If she has already answered one
  half (she said she wants advice), reflect it back and ask the other; never
  drop it silently.
- **The bridge from mandatory to recommended, on a first visit:** *"Thanks,
  [name]. A few more that'll help me get this right for you, and then they're out
  of the way."* Said once, before the first recommended question; the rest follow
  in the usual shape without it.
- **Set `status: asked` the moment you ask**, with `last_updated`, and save. If
  she answers, set `status: answered` and her words in `value`; if the session
  ends first, the next one knows it was asked, not skipped. **A removed answer**
  (she asks for it to go) moves to `data/archive/` first; then `value` is emptied
  and `status: removed`. The session-start brief shows both beside the question;
  the app reads anything not answered as blank.
- **Asked before, not answered:** say so rather than asking as if new, e.g.
  *"Last time I asked what you want from this space, and we didn't get to it. Is
  now okay?"* Never "a few things I haven't asked you yet" when all of them have
  been asked; say "a couple of things from last time" instead.

## When she skips, puts it off, or moves on

- **"Skip", "rather not say", or no to the permission is an answer.** Reply
  *"No problem at all, I'll leave it."* and move on. Set `status: declined`,
  `status_reason` to what she said about it (her words, or empty), and
  `revisit_when` to the moment it would matter again, from the list below. The
  session-start brief then lists it as declined, not owed. **Ask it again only
  when that moment comes**, in the conversation, with its reason, and once; never
  as an opener, never mid-crisis.
- **"Not now", "maybe later", "I don't know yet" is not a refusal.** Reply *"Sure,
  no rush. We can come back to it."* It stays `status: asked`, with
  `status_reason: said not now` (or "not sure yet") and `ask_after` set to a
  date two weeks on, or the one she names. The brief leaves it alone until that
  date, then it is offered once as a follow-up: *"Last time you said maybe later on who you'd reach on
  a bad night. Is now any better? Still fine to skip."* A second "not now" makes
  it `declined`; she is never asked a third time.
- **Ignored, or she changes the subject:** follow her, say nothing about it. It
  stays `asked`, `status_reason: moved on`, and comes back next session as above.
- **After any skip:** never explain again why it matters (the reason was given
  when asking), and never "are you sure?". A skip is final for the session.

## Each question's reason, and when a declined one matters again

- **Pronouns** — so what I write about her sounds like her. Again: if she
  corrects how she's referred to.
- **Where she is** — never asked; it defaults to Asia/Singapore so "today"
  means hers. Written as *mandatory*, above, says.
- **What she wants from this** — so I give her what she came for, not what I
  guess. Again: if she seems to want something different from what I'm giving.
- **How to speak to her** — so I get the tone right first time. Again: if
  something I say lands badly.
- **Anyone professional involved** — so I know whose word comes before mine.
  Again: if she mentions medication, a diagnosis or an appointment.
- **A bad-night person** — so there's someone to point to if a night gets hard.
  Again: if she describes a hard night once she's steady. In a crisis, the
  rules in `CLAUDE.md` ask who she can be with, and this question is not asked.
  Her answer also goes to the safety plan, as `SKILL.md` says.

## When the last owed question is done

**Write `now.md` as soon as the profile is done**, not at a close that may never
come. Write two or three lines on how she seems and what she came for, in her words.
The machine can be reclaimed the moment she goes quiet, and a blank snapshot is
what the next session would read first.

**The opening has already said what this is.** Once the profile is done, ask what
brought her here — and *wait*. What follows is `after-profile.md`'s.
