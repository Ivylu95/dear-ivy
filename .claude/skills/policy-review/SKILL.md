---
name: policy-review
description: Reviewing policies/ (privacy, safety, terms) against current law - on "POLICY REVIEW DUE", check-policies.mjs --due, or "review the policies", "check the legal side". Harness work; not legal advice.
---

# Policy review

**Goal:** The policies in `policies/` are checked against current law and comparable services, and changed only by the register's rules.

**Audience:** The developer in development mode; never one of her chats, and never a heartbeat (A-015).

**Reads:** `policies/review-log.md`, which carries the status, watch list and carried items between reviews, then `dev/specs/legal/policies.md` and the three policies.

The policies are what the person relies on and what stands between the owner and
a claim. Law in this area is moving — AI disclosure, AI-therapy bans, chatbot
crisis protocols — so a policy right when written drifts wrong without anyone
touching it. This skill binds `POL-013`, `POL-014` and `POL-015` in
[`dev/specs/legal/policies.md`](../../../dev/specs/legal/policies.md); the rest of that
register is what each policy is checked against.

**It is not legal advice, and it never says a policy is legally sound.** It says
what the law and comparable services show, and what changed. `POL-012`'s line on
each policy stays *not yet reviewed by a lawyer* until a lawyer has.

```
- [ ] 1. Read the tracker and the register — not last run's findings
- [ ] 2. Research the law, fresh
- [ ] 3. Benchmark against comparable services
- [ ] 4. A verdict for every POL row
- [ ] 5. Change what the verdicts require
- [ ] 6. Record the review
- [ ] 7. Commit, push, report
```

**1. Read.** `policies/review-log.md` (status, watch list, *Carried to the next
review*), the register, the three policies. **Do not read the last review's
sources list until step 3 is done.** A research run primed with its last answer
confirms it (`MNT-004`).

**2. Research the law, fresh.** For each jurisdiction, what has come into force,
been amended or been proposed since the last review. Search in this order and
record every source with the date it was read:

| Order | Source | Why this order |
|---|---|---|
| 1 | Statute and regulator: Singapore Statutes Online, PDPC, HSA, MOH; EUR-Lex and the AI Office; the state legislature's own bill page | The law itself; a summary can be wrong |
| 2 | Guidance from the regulator: advisory guidelines, FAQs, enforcement decisions | How the regulator reads its own law |
| 3 | Client alerts from established law firms, dated | Fast and usually right on what changed; never the only source for a requirement |
| 4 | Professional bodies: APA, safe-messaging guidance | Practice, not law — for the safety policy |

In scope: Singapore first, the default country. Then any law that reaches an AI
wellbeing or journaling service used by an adult. These include the EU AI Act and
GDPR, and US state chatbot and AI-therapy laws. Add every new date found to the watch list.
The person's details never go in a query.

**What the model remembers is not a source** (A-101): its training stops
at a date, and this law moves after it. A requirement with no source read today
is not used for a verdict. Where a jurisdiction's sources cannot be reached
(the network refuses, the site blocks reads), try the other rows of the table
above. Try a second route too: a search, a cached copy or a mirror of the statute.
If none answers, its rows read *not reached*, never *held*. The review is recorded
as partial, with what blocked it. Its **Last review** and **Next due** stay where
they were, so the review stays due. The developer is told in one line, with what
you recommend and what he would have done.

**3. Benchmark.** Read the current privacy policy, terms and safety or crisis page
of **at least three comparable services**. These are AI mental-wellbeing, AI
journaling or AI companion apps, preferring ones regulated or scrutinised in
Singapore, the EU or the US. For each clause they carry that ours lack, one line: what it is, and
whether it transfers. A clause does not transfer just because a large company
has it — their scale, business model and risk appetite are not this system's.

**4. A verdict for every POL row**: *held*, or *gap* with the evidence. A gap can be
in the rule itself, where the register misses something the law now asks. That
gap is a spec finding, drafted with `spec-writer` and put to the developer,
never an edit to the register.

**5. Change what the verdicts require.**

| Rule | Because |
|---|---|
| Only the part written for the person, in the register's plain words, with the change listed in its *Changes to* table and **Last updated** moved | `POL-002`, `POL-003` |
| Never a promise the system does not keep; a new promise names its row or check in the developer part | `POL-011` |
| Never weaken a protection the person has — a shorter carve-out, a wider limit, a lower age — without the owner's yes in this session | The policies protect the person first |
| A change to the crisis wording or numbers also passes `SAF-002` and carries a hazard-log entry | The safety policy is read on bad nights |

Then `node ux/scripts/check-policies.mjs` must pass.

**6. Record the review** in `policies/review-log.md`. Add a new row at the top of
*Reviews* (date, trigger, everything benchmarked against, outcome, what changed).
Set its **Last review** to today and **Next due** to today plus the interval.
Update the watch list and *Carried to the next review*. A review that changed
nothing is still a row. The check refuses a tracker whose dates disagree.

**7. Commit, push, report.** With the `commit` skill: `docs(legal): policy
review YYYY-MM-DD`, naming the rows with gaps. Report in the conversation: the
verdicts as a two-column table (ID | verdict), what changed, what waits on the
owner, and — every time — whether a lawyer's review is still owed.

## Where this falls short

An agent's reading of law is not a lawyer's, and a benchmark copies other
companies' judgement along with their wording. The review finds what changed in
the sources it reached; a statute site that refuses automated reads leaves that
law read second-hand, which the row must say. And it runs only when the skill is
used: no heartbeat starts it (A-015), so a project with no development sessions
is never reviewed. The notice on `/dev-mode` is what keeps a due review in view.
