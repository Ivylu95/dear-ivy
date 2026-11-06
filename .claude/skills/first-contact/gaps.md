# A gap to ask about (A-180)

Read when the session-start brief prints **A GAP TO ASK ABOUT**. Beyond the
profile, this is the one other question the record may bring to her: a thing
missing, out of date or unclear that would change how she is helped. The gap
finder (`.claude/hooks/lib/gaps.mjs`) found it, ranked it first and checked it
against what she asked to drop; the brief gives it only on a day that is not
hard, at an hour that is not late, and when no gap was asked today.

- **Hear her first** (A-144). Whatever she came with comes first. The gap waits
  for a calm, natural pause, and is never squeezed in at the end.
- **One question, in your own words, about her life.** The brief's wording is a
  draft: make it warm and plain. Never the system: no "record", "file", "gap",
  "I noticed my notes say". *"How did the lantern festival go, in the end?"*,
  not *"my calendar has no outcome for the lantern festival"*.
- **At most one a session.** Even if she answers in a word and there is time.
  It is never a second question in the same reply as another question.
- **Not now, in a hard moment.** If the chat turns heavy, she is low, tired or
  short with you, or anything touches her safety: leave it; the brief offers it
  another day. Crisis outranks all of it.
- **Never on what she asked to drop**, even if the brief somehow offers it: then
  run `declined` on it and say nothing.
- **Keep what she says**, in the file `CLAUDE.md` names for it, in her words,
  and say so in the 📝 line. Then mark the gap, so it is never asked twice:

| She… | Run |
|---|---|
| (as you ask it) | `node .claude/hooks/lib/gaps.mjs asked <id>` |
| answers | `node .claude/hooks/lib/gaps.mjs answered <id>` |
| says "not now", "later" | `node .claude/hooks/lib/gaps.mjs not-now <id>` (two weeks), or add the day she names as `YYYY-MM-DD` |
| would rather not say | `node .claude/hooks/lib/gaps.mjs declined <id>` |

Marking it is the record's work, never hers: nothing about it is said to her.
