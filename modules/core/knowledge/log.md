# Research log

Deliberately thin. **It holds only what a fresh search cannot rediscover.**

Findings, citations and queries are *not* kept here — those are recoverable by
searching again, and a pile of old findings biases the next run toward
confirming itself. What is kept is local evidence about **this repo and this
person**, which no search will ever return.

## Status

| | |
|---|---|
| **Last run** | 2026-09-20 |
| **Next due** | 2026-11-15 (8 weeks) |
| **Interval** | 8 weeks or 30 sessions _(two no-change runs in a row → 12 weeks)_ |
| **No-change runs in a row** | 0 |

## Runs

One line each. Skipped runs are recorded, not silently missed.

| Date | Outcome | What changed in `CLAUDE.md` |
|---|---|---|
| 2026-09-20 | Targeted run: **design practices for the assistant itself**, not for what it says. `pmc.ncbi.nlm.nih.gov` was reachable this run (blocked on 2026-08-30), and the APA advisory PDF was read in full (14pp) where prior runs had only its press release. Four standing questions closed: **APA advisory** (now `full`, 8 recommendations), **sycophancy** (now evidenced — APA Recs 1/2/4 + Diel et al. 2026 scoping review of 119 articles), **self-monitoring and rumination** (Wright et al. 2025 meta-analysis, 77 studies / 16,165 participants: adverse events real but rare *and* almost never measured), and **memory design** (Jewell et al. 2026 four-type framework). Found a genuine conflict with the repo's own fourth principle — APA's named mitigation for dependency is *limiting* memory. Found no evidence for MI or for validation-before-change; both remain open. AI31 draft chatbot standards (FDA docket) returned 403 and were not read. | No change. New section in `practices.md` (*Designing the assistant itself*, 14 rows); 5 existing rows upgraded from `—`/`record` to `full`. Two proposals raised in `data/state/proposals.md` — the memory/dependency conflict, and deletion vs. *nothing is ever deleted*. |
| 2026-08-30 | Targeted run: what must be known about her before the record is useful, and how to ask for it. Primary sources unreachable (`nice.org.uk`, `ncbi.nlm.nih.gov`, `gdpr-info.eu` blocked by network egress proxy) — all new rows are `record`, none `full`. Found that NICE CG123, the obvious assessment guideline, was **withdrawn May 2024**; not cited. | No change to `CLAUDE.md`. New section in `practices.md` (*Getting to know her*); new playbook **4.9 First contact**; `SessionStart` hook now detects an empty record. |
| 2026-08-28 | First run. Ran before any session — seeds in `practices.md` replaced with read sources, or marked unverified. | §0: IMH Mental Health Helpline 6389 2222 (retired 18 Jun 2025) replaced with **national mindline 1771** (24h) and WhatsApp 6669 1771. One change. |

## Tried and reverted ⭐

The reason this file exists. A change that made sessions worse must not be
re-introduced by a later run unless new evidence specifically addresses **why it
failed here** — not merely that the literature likes it.

| Date | Change | Evidence it rested on | Why it was reverted |
|---|---|---|---|
|  |  |  |  |

## Standing questions for next run

_Only genuine gaps — things the last run couldn't resolve. Not a summary of what
was found._

- **Helplines: re-verify every run.** One number in the crisis block was already
  dead. Check
  1767, 9151 1767, 1771, 6669 1771, 995 against the operators' own pages.
- **No-suicide contracts** — the primary sources (PMC, NICE NG225) were 403 /
  CAPTCHA-blocked. The claim in `practices.md` → *Risk and safety* is currently
  unverified. `pmc.ncbi.nlm.nih.gov`
  was reachable on 2026-09-20 but this was not re-attempted — try it next run.
- **Validation before change** — no source located, two runs now. Find one or drop the
  claim to a stance rather than an evidence anchor.
- **Motivational interviewing** — effects found in search look small and shrink
  against active comparisons. Open a real meta-analysis and decide whether
  `practices.md` → *Therapeutic stance* should keep MI as an *evidence* anchor
  or demote it to a *manner*.
- ~~**Sycophancy**~~ — **closed 2026-09-20.** APA advisory Recs 1/2/4 read in full;
  Diel et al. (2026) scoping review names it as a harm class across 9 articles. The
  remaining gap is narrower: nothing found that *measures* sycophancy in a one-to-one
  long-running relationship with a named person. EUDAIMONIA (arXiv:2605.30654) is a
  benchmark for exactly this family of dynamics — open its methodology next run.
- ~~**Self-monitoring and rumination**~~ — **closed 2026-09-20**, with a caveat that
  changes the answer's shape. Wright et al. (2025), 77 studies / 16,165 participants:
  pooled adverse events 0.042 (95% CI 0.028–0.056), mood worsening 0.02 (0.01–0.02).
  **But only 19% of studies reported adverse events and 4% used a validated measure**,
  and no RCT compared monitoring to no-monitoring. So the honest reading is *not
  measured*, not *safe*. The `mood:` proposal in `data/state/proposals.md` should be
  settled on that basis.
- **Adverse events here are undefined.** Olisaeloka et al. (2026): no reviewed study
  defined what an adverse event was. Neither does this repo. What would going wrong
  look like, and where would it show up? Next run should propose a definition.
- **Crisis escalation is still untested here** — see the VERA-MH proposal, open since
  2026-08-28. APA Rec 5 now explicitly requires "rigorously tested crisis escalation
  pathways", which strengthens the case.
- **AI31 draft standards for mental health chatbots** (FDA docket FDA-2025-N-2338-0006,
  three pillars: Behavior, Safety, Data) — `downloads.regulations.gov` returned 403.
  This is the most directly actionable checklist found this run. Get it.
- **Intake evidence is second-hand.** Every row in *Getting to know her* is `record`, not `full`, because the guideline bodies are blocked from this environment. Open NG222, the CFI itself, and the goal-consensus meta-analysis when a run has reachable access, and correct the effect sizes if they differ.
- ~~**APA advisory**~~ — **closed 2026-09-20.** The HTML page is still JS-blocked, but
  the PDF at `apa.org/topics/artificial-intelligence-machine-learning/health-advisory-ai-chatbots-wellness-apps-mental-health.pdf`
  fetches and reads. 14 pages, 8 recommendations, expert panel named. Use that URL.
