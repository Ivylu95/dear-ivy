---
name: look-it-up
description: She asks something whose answer turns on evidence rather than on her record - "does this actually work", "is it normal to", "should I try", "what does the research say", or a question about sleep, food, exercise, money, work or relationships where a general fact would change what she does. Use to check the knowledge base before searching, say how well the answer is known, and file what was found so the next session has it. Not for medication, diagnosis or legal questions, and never in a crisis.
---

# Look it up

**Her record first, then the knowledge base, then a search.** What has actually
worked for her, in `data/me/what_helps.md`, outranks anything general. Evidence
is for the question her record can't answer.

This skill only answers a question she asked. **Knowing a subject is never a
reason to raise it** (**KNW-001**) — if she didn't ask, nothing here runs.

## Not this skill

| She… | Instead |
|---|---|
| is unsafe, or you're unsure | Crisis, in `CLAUDE.md`. No searching, no filing |
| wants to vent | Let her. A fact offered to someone venting is a correction |
| asks about medication, a diagnosis, the law | One line saying so, and who actually answers it |

## Before answering

**If the subject can harm, ask why she's asking first** (**KNW-003**). Weight,
calories, tracking her own body or mood, sleep scores, anything touching
self-harm. The same fact is useful for one reason and damaging for another —
the reason decides the answer, not the topic.

## Order

| # | Look in | Then |
|---|---|---|
| 1 | `data/me/what_helps.md`, and the timeline if she's tried this before | Her own evidence leads |
| 2 | [`knowledge/practices.md`](../../../knowledge/practices.md), or `knowledge/<subject>/practices.md` | A row checked within 12 months is usable as it stands |
| 3 | A search, when there is no row or it's older than 12 months | Her details never go in the query. Current research over the popular technique |

## Saying it

**How well it's known goes with the claim** (**KNW-002**). Say the tier and
whether the source was read, in plain words:

- *"A large review of trials, and I read it"* — tier 1, `full`
- *"One study, and I only reached its summary"* — tier 2, `record`
- *"Widely said, and I couldn't find anything behind it"* — `—`

Then **one** recommendation, what it costs her, and hers to take or leave. Check
it against her actual problem, not the one the literature is good at. Where the
evidence is thin, say so rather than borrowing confidence from the topic.

## Filing it

After she has her answer, not before. **Only what a search found and a source
backs** — an uncited line does not belong in the base.

1. **Pick the subject** from the folders already in `knowledge/`. Cross-cutting
   stance goes in `knowledge/practices.md`. If none fits, create one from
   [`templates/practices.md`](templates/practices.md) and add it to the
   subject list in [`knowledge/README.md`](../../../knowledge/README.md) —
   the name is fixed before anything is filed under it (**KNW-005**).
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
