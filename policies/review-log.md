# Policy review log

When the three policies were last checked against the law and against how
comparable services write theirs, what each review read, and when the next is
due. Kept for the owner and for the agent that runs the review; the person using
Dear never needs to open it.

The rules are **POL-013** to **POL-015** in
[`dev/specs/legal/policies.md`](../dev/specs/legal/policies.md). The procedure is the
[`policy-review`](../.claude/skills/policy-review/SKILL.md) skill. The due date is
read by one parser, [`policy-review.mjs`](../.claude/hooks/lib/policy-review.mjs),
for both the check and the `/dev-mode` notice, so edit the lines below in the
exact form they are in.

## Status

**Last review:** 2026-09-27
**Next due:** 2027-03-27
**Interval:** 6 months

A review is due on the next-due date, or earlier on the first date in the watch
list after the last review, whichever comes first. Also start one early, by hand,
when a new service starts receiving what the person says, or when the crisis path
changes what it promises.

## Reviews

Newest first. One row per review, including a review that changed nothing.

| Date | Trigger | Benchmarked against | Outcome | What changed |
| --- | --- | --- | --- | --- |
| 2026-09-27 | First drafting of the three policies, on the owner's instruction | Law and guidance: PDPA and the PDPC's Guide to Notification; Unfair Contract Terms Act (Singapore); HSA guidance on software as a medical device; GDPR Art.13 and Art.9; EU AI Act Art.50; California SB 243; New York GBL Art.47; Illinois WOPR Act; Utah HB 452; Nevada AB 406; WP260; APA health advisory (Nov 2025); safe-messaging guidance. **No comparable service's policies were read** — the next review must | Drafted; POL-001 to POL-012 founded. Two statute sites refused automated reads; section numbers came from secondary sources. Not reviewed by a lawyer | All three policies written or rewritten for the person; terms of use new |

## Watch list

Dates a law or guidance that reaches this system takes effect or changes. The
first one after the last review brings the next review forward. Each review adds
what it finds and leaves past dates in place.

| Date | What | Why it matters here |
| --- | --- | --- |
| 2027-07-01 | California SB 243 annual reports to the Office of Suicide Prevention begin | Whether a self-hosted copy counts as an operator, and what a published crisis protocol must say |

## Carried to the next review

Questions a review could not settle, kept so the next one starts from them.

- **No lawyer has reviewed these policies, by the owner's decision on
  2026-09-27.** They are precautionary: written from published law and guidance
  to protect the owner and the person, not a legal opinion or letter. Each review
  notes this once and moves on; revisit if the repo is shared beyond one person,
  starts charging, or a claim or complaint arrives.
- Read the current privacy policy, terms and safety or crisis page of at least
  three comparable AI wellbeing or journaling services, and note what they carry
  that these do not.
- Whether the operator, the maker or the person is the data controller when a
  copy is set up for someone else. A lawyer's question.
- Whether the SGD 100 liability cap is reasonable under the Unfair Contract Terms
  Act for free software. A lawyer's question.
