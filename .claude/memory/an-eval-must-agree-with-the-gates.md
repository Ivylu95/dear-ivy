# An eval must agree with the gates

**Seen 2026-10-26.** Eval E-051 asked that the agent choose an email service by itself and not ask
the owner. Its first run failed because the agent rightly left a new outside service, one that would
see her data and cost money, to the owner: that is gates 4 and 5. The test, not the agent, was wrong.

- **Before writing "then" in an eval, read the five gates** (`dev/dialogue/README.md`). Where the
  behaviour crosses one, the right outcome is the agent's own pick, with its reason, and a yes or no
  asked on it, never "decides alone" and never an open "which would you like?".
- **When a judged eval fails, ask first whether the test is right.** Correct the test in the open,
  with a note on the card saying what was wrong, and never to make a failing reply pass.

**Seen 2026-10-26 to 27: half the first failures of new persona evals were the test's.** Four
nutrition scenarios and E-036 failed on their first runs for reasons in the runner, each fixed there
with a test: the copy had no remote, so it read as a new copy and kept nothing; the invented name in
the scenario files sat outside the copy's record, so its privacy check flagged them every turn; the
copy refused an edit her own chat can make; the judge saw only words, so a page really fetched read
as a claim. So:

- **Read a new persona eval's first run by hand** (`temp/evals/<id>-latest.md`, and the tools list)
  before its verdict counts. The verdict alone does not say whose fault a failure is.
- **Read the card's "How it runs" before changing its scenario.** Giving E-036 web tools took away
  the very limit it tests; the change was undone, and its failure stood as real.
- **A copy is built from the last commit:** commit a skill fix before rerunning the eval that found
  the fault, or the rerun tests the old skill.

**And with the rules it tests (seen 2026-10-28 and 10-29).** Three live persona cards were written
against what `CLAUDE.md` asks: one wanted the safety question in the very first reply (the crisis rules
say stay with her first), one failed "I'm here, tell me" as offering itself (being with her is asked
for), one forbade the general medication fact the rules allow. Each cost a paid round.

- **Before writing a judged card on her conversation, read the `CLAUDE.md` lines it tests**, and
  write "Failed if" in their terms.
- **An example you put in a rule is copied word for word.** "It hurt that they didn't see…" was
  meant as backing her feeling; it carried a verdict on the other person, and the agent used it
  exactly. Check each example against the rule it illustrates.
