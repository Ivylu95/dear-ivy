# set-up-from-scratch log

What this skill was grounded on, and when it is next checked (`SKL-004`,
`SKL-005`). Findings are not kept in full — a fresh search recovers them, and a
pile of them biases the next run toward confirming itself. What is kept is what
a search never returns: the dates, the scenarios, what was tried and reverted,
and a prediction for the next run to grade.

## Status

| | |
|---|---|
| **Last run** | 2026-09-26 |
| **Next due** | 2027-03-26 (6 months) |
| **Interval** | 6 months, or whenever a rule in the skill is disputed on its own grounds |

## Scenarios

The requests the skill was tested against, written before it was drafted.

| # | Request | Without the skill | With the draft |
|---|---|---|---|
| 1 | *"Set this up for my sister on her own GitHub. Walk me through it."* | The steps are improvised from memory, in one long message. The Actions write permission and the crisis numbers are the two most often lost that way, and neither failure shows for days | Tracker, first step and its result all came out right, and the tester found the steps unaided. Three faults, all fixed: the opening gate read as a hard stop on the commonest case, because the tester read it against the checkout rather than the instance being built; four steps are file work in a clone that does not exist yet, which the draft promised as the agent's; and the repository name needs a name before `first-contact` has asked for one |
| 2 | *"Where did we get to with the setup?"*, in a new session days later | Nothing records progress, so the run either starts again or asks the developer to remember; what the repository could have answered is asked anyway | Eleven of twelve steps settled from evidence, one question asked — the intended result. Faults fixed: the draft told the run to ask about the App and the Actions permission, which it had just proved from a merged session branch; three tracker states could not say *unknown*; and the evidence a resume is made of was not among the parts a message may carry |
| 3 | *"She had her first conversation on her phone but nothing showed up on main."* | A diagnosis starts from nothing, when the symptom names its own step | Routed to the right step in one read, with no speculation about hooks or credentials. Faults fixed: it answered only *stop it happening again* and not *repair what is stranded*; running the merge workflow by hand looks like the repair and is not, because its merge step runs on a push; and a one-to-one symptom table gave nothing to separate two causes |

## Runs

One line each. A run that found nothing is still recorded.

| Date | Grounded on | What it changed |
|---|---|---|
| 2026-09-26 | [Anthropic's skill authoring best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) — body under 500 lines, description carrying both what and when, progressive disclosure to linked files; silent on a skill that walks a person through a procedure in someone else's interface. [Google's procedures guidance](https://developers.google.com/style/procedures) — one action per step, the result stated separately; written for documentation read at leisure, not for a conversation, so the tracker is this skill's own. [NN/g on wizards](https://www.nngroup.com/articles/wizards/) — a step is not reachable before the ones before it, and a progress tracker keeps a multi-step flow finishable; it is about screens, and a chat has no progress bar, so the tracker is re-printed each message instead | First version, then amended against three fresh-context test runs — the faults and the fixes are in **Scenarios** above, and what came out again is under **Tried and reverted** |

## Tried and reverted

| Date | Rule | Why it was reverted | What would reopen it |
|---|---|---|---|
| 2026-09-26 | Restating the setup steps inside the skill | Two copies of a twelve-step procedure drift, and the README is where a person setting this up looks first (`ARC-013`) | The README losing its setup section, which the skill would then have to stop rather than replace |
| 2026-09-26 | *"Three things and nothing else"* in a message | Two other rules in the same skill required a fourth, and every tester broke it — one to say a stranded conversation was not lost. An absolute a run cannot keep teaches it to ignore the rest | A message that has grown into a wall of prose, which the rule was written against |
| 2026-09-26 | A three-state tracker | On a resume most marks are neither done nor to do but unprovable, and `⬜` said the opposite of the truth | Nothing: `❔` is what makes the finish condition honest |

## Prediction

The next run grades this **before** writing its own.

| Left on | Claim | How to falsify | Outcome |
|---|---|---|---|
| 2026-09-26 | The step most often confirmed without being done is the Actions write permission, because it is the only one whose failure is silent and whose evidence is in a settings page nobody revisits. A setup that later loses a phone save will trace to it | Set up an instance, then check whether the first lost save traces to anything else — the GitHub App, a protected branch, a parked hook | |
