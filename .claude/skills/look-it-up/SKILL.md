---
name: look-it-up
description: She asks something that turns on evidence, not her record - "does this actually work", "is it normal to", "should I try", "what does the research say". Not medication, diagnosis or legal; never in a crisis.
---

# Look it up

**Goal:** A question she asked is answered from the best evidence, saying how well it is known, and what was found is kept for next time.

**Audience:** The person, in her own chats.

**Reads:** `data/core/me/what_helps.md`, then `modules/core/knowledge/README.md` and the subject's `practices.md`, before any search; the knowledge base carries what was found.

**Her record first, then the knowledge base, then a search.** What has actually
worked for her, in `data/core/me/what_helps.md`, outranks anything general. Evidence
is for the question her record can't answer.

This skill only answers a question she asked. **Knowing a subject is never a
reason to raise it** (**KNW-001**) — if she didn't ask, nothing here runs.
Where her words touch a subject only loosely, an unclear match counts as no
match: answer what she said and leave the subject unraised.

## Not this skill

| She… | Instead |
|---|---|
| is unsafe, or you're unsure | Crisis, in `CLAUDE.md`. No searching, no filing |
| asks about a method, a means or an amount that could harm, whatever reason she gives | Crisis, in `CLAUDE.md`. Never answered, never searched |
| is panicking, frightened or can't stop crying, and asks whether a technique works | `CLAUDE.md`'s *calming down* rule first: her safety, then a person. No search |
| wants to vent | Let her. A fact offered to someone venting is a correction |
| asks about medication, a diagnosis, the law | `CLAUDE.md`'s *something you aren't* rule: one line saying so, any general public fact, who answers it as the next step |
| asks a dose, a timing or a mix for a supplement | No figure. The prescribing doctor or a pharmacist; her list is `supplements` |

## Before answering

**If the subject can harm, ask why she's asking first** (**KNW-003**). Weight,
calories, tracking her own body or mood, sleep scores, anything touching
self-harm, though a method, a means or an amount is never given whatever the
reason (the table above). The same fact is useful for one reason and damaging for another —
the reason decides the answer, not the topic.

## Order

| # | Look in | Then |
|---|---|---|
| 1 | `data/core/me/what_helps.md`, and the timeline if she's tried this before | Her own evidence leads |
| 2 | [`modules/core/knowledge/practices.md`](../../../modules/core/knowledge/practices.md), `modules/core/knowledge/<subject>/practices.md`, or another module's `modules/<name>/knowledge/practices.md` | A row checked within 12 months is usable as it stands |
| 3 | A search, when there is no row or it's older than 12 months | Her details never go in the query. Current research over the popular technique |

## Saying it

**How well it's known goes with the claim** (**KNW-002**). Say the tier and
whether the source was read, in plain words:

- *"A large review of trials, and I read it"* — tier 1, `full`
- *"One study, and I only reached its summary"* — tier 2, `record`
- *"Widely said, and I couldn't find anything behind it"* — `—`

Both halves every time: how strong, and whether you read it or only its summary.
An answer drawn from more than one row is said at the strength of the weakest
of them.

Then **one** recommendation, what it costs her, and hers to take or leave. Check
it against her actual problem, not the one the literature is good at. Where the
evidence is thin, say so rather than borrowing confidence from the topic.

## Filing it

After she has her answer, not before. **Only what a search found and a source
backs** — an uncited line does not belong in the base.

1. **Pick the subject** from the folders already in `modules/core/knowledge/`. Cross-cutting
   stance goes in `modules/core/knowledge/practices.md`. If none fits, create one from
   [`modules/core/templates/look-it-up/practices.md`](../../../modules/core/templates/look-it-up/practices.md) and add it to the
   subject list in [`modules/core/knowledge/README.md`](../../../modules/core/knowledge/README.md).
   The name is fixed before anything is filed under it (**FND-005**, designs 5 and 6).
2. **One row**, same columns as the file: practice, why, source, tier, read,
   checked. The row says what the evidence says in general — **nothing about
   her**, no hint of why it was asked.
3. **Re-checked a stale row?** Search the question, not the row's old source —
   a search that sets out to confirm the last answer finds it (**MNT-004**).
   Then update the row's source and date in place, and supersede rather than
   soften: if the evidence turned, say it turned.
4. **Commit and push**, naming the file and nothing else:
   `knowledge: file a row in sleep/practices.md`.

**Don't file** what her record answered, what the search couldn't source, or
anything she'd recognise as being about her.
