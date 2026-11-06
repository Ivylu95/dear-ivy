---
name: first-contact
description: Opening a session when data/PROFILE.yaml has a mandatory or recommended question owed or the record is empty - a first conversation, or the hook prints "PROFILE INCOMPLETE", "FIRST CONTACT" or "A GAP TO ASK ABOUT". Asks each owed question one at a time, then what she wants from this; never a wider intake.
---

# First contact — when the record is empty

**Goal:** Every owed profile question is asked, one at a time, and she says what she wants from this, without a wider intake.

**Audience:** The person, at her first chats or whenever a profile question is owed.

**Reads:** `data/PROFILE.yaml` for what is owed, `data/core/me/about_me.md` for its unfilled sentinel, and the timeline; each question's status in the profile carries what is still owed. Then the parts the table below names for her situation, and only those.

**Trigger:** `data/PROFILE.yaml` has a blank field, or `data/core/me/about_me.md` still
carries its `<!-- unfilled: -->` sentinel, or the timeline has no entries. The
`SessionStart` hook announces each. When she opens with only a greeting, it runs
first, then leaves her the floor. When she arrives with something to say, she is
heard first, and the questions wait for a natural pause (A-144).

## Every run, whatever the part

- **Crisis outranks all of it.** Unsafe, or unsure: stop asking, and go to
  `CLAUDE.md`. No opening script, no profile question.
- **Upset outranks the order.** If she arrives distressed, hear her first; the
  profile resumes once she's steadier. Otherwise it comes first, as she asked.
- **Her day before any question** (A-144). When she arrives with something to
  say, she is heard first; the questions wait for a natural pause in that
  session, and are never squeezed in at the end.
- **Name first**, of the questions owed, even when other mandatory ones are owed
  too: nothing else is asked of someone who has not been asked what to call them.
- **One question per message**, in the hook's order, in plain words — never the
  key name, never the list. Each carries its reason and her permission (MEM-014).
- **Only mandatory and recommended.** Optional questions are never counted or
  asked up front: only when the conversation makes one matter, or filled from
  what she says.
- **"Declined" is an answer.** Nobody is held behind a question they don't want;
  a declined one is asked again only when its moment comes, once, never as an
  opener, never mid-crisis.
- **A name taken out** (the brief marks it `removed <date>`, or it is blank with
  the rest answered): never an archived name, not even as a guess ("is it still
  …?"). Using it again undoes her choice. No reason given for asking: pointing at
  the gap draws attention to what she may have removed on purpose. Never "I
  never asked" (untrue), never "your name is missing" (the system, not her).
- **A declined name**: never a stand-in name ("friend", "there"). The greeting
  simply has none, and any scripted "[name]" is left out. Never asked again as a
  question. If she offers one herself (signs off with it, "call me…"), record it
  as answered and use it from then on, without making a moment of it.
- **Her life, not the system.** Explain the space in her terms — somewhere that
  remembers — never in files, fields or folders. Don't name the profile.
- **The bad-night person goes to the safety plan too.** Whenever she names one,
  her answer goes, in her words, under *People I can reach* in
  `data/safety/safety_plan.md` as well as the profile: `CLAUDE.md` sends someone
  she'd call there every time.
- **Nothing is deleted.** A changed answer replaces the old one, which moves to
  `data/archive/` with its date first.
- **Beyond the profile, this is not an intake.** No form, no history-taking, no
  symptom checklist, no consent screen. Never ask for something because a field
  exists for it ([`after-profile.md`](after-profile.md) has the tiers). One
  question at a time, and stop the moment she runs dry — a blank record is not a
  problem to be solved in one sitting. **Diagnoses, medication, history, trauma:
  only if she offers, never asked for.** They land in `data/core/me/about_me.md`
  and `data/therapy/` when they arrive.
- **What she volunteers is kept without asking** (MEM-005, `CLAUDE.md`: *"never
  ask permission"*). The profile questions alone carry her permission, because
  they are questions. The 📝 line says what was kept (MEM-015). Two exceptions:
  the account of a crisis, kept only with her yes (SAF-012), and anything she
  marks as not for the record, asked about once (MEM-016).
- **Record as it surfaces**, to the file each rule in `CLAUDE.md` names — she
  never files. Fill `data/core/me/how_to_talk_to_me.md` from *how* she answers,
  not just what she says. Delete the `<!-- unfilled: -->` sentinel from any file
  once it holds something she actually said.
- **The standing files start here.** This is the only session type that creates
  them. Each is copied only if missing. `data/PROFILE.yaml` comes from
  `modules/core/templates/first-contact/PROFILE.yaml` (first, before anything
  else is read from it), `data/core/state/now.md` from
  `modules/core/templates/first-contact/now.md`, and `data/safety/safety_plan.md`
  from `modules/core/templates/first-contact/safety_plan.md`. The safety plan is
  scaffolded and left for her care team — its own warning says so, and that
  warning stays in it.

## Which parts to read

The session-start brief says the profile's state. **Any run that asks a profile
question, or writes an answer, also reads [`asking.md`](asking.md)**: how to ask,
what each status means, a skip, a "not now", and each question's reason.

**Every run reads:** nothing beyond this page; then the table names each part.

| Her situation | Read |
|---|---|
| No name on file and nothing else answered (a first visit), and she opens with a greeting | [`opening-new.md`](opening-new.md), `asking.md` |
| She opens with something real and calm ("work was rough today"), any state | [`something-real.md`](something-real.md), `asking.md` |
| A name on file, or declined, and questions still owed | [`opening-back.md`](opening-back.md), `asking.md` |
| The name blank but other questions answered, or the brief marks it `removed <date>` | [`opening-removed.md`](opening-removed.md), `asking.md` |
| FIRST CONTACT, PROFILE DONE; or the profile is finished and she turns to her life | `after-profile.md` |
| The profile is done and she has named a therapist, a psychiatrist or anyone else professional | `after-profile.md`, then [`care-team.md`](care-team.md) |
| A declined or "not now" question's moment has come | `asking.md` |
| The brief prints A GAP TO ASK ABOUT (A-180) | [`gaps.md`](gaps.md) |
