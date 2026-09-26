---
name: set-up-from-scratch
description: Standing up a new record from nothing, or picking up a setup left half-finished - "set this up for me", "set it up for someone", "start a new record", "walk me through the setup", "where did we get to", or a first conversation that did not save. Reads the setup steps out of README.md and walks the developer through them one at a time, keeping a tracker, stopping at each step until it is confirmed. Not for changing an existing record, and not for setting up one piece of the harness - a hook, a skill, a spec. Harness work, asked for by the developer. Never for anything under data/.
---

# Set up from scratch

Standing up a whole instance: a repository, a record, a phone, a second copy.
It is done rarely and by someone who has not done it before, so the failure is
never that a step was hard — it is that a step was skipped and nothing said so
for a week.

## The steps are not in this file

They are in [`README.md`](../../../README.md) § *Setting it up from scratch*, and
they are **read fresh at the start of every run**, never recalled. `ARC-013`,
*"Every fact has one authoritative home; everything else points to it."* — the
README is where a person setting this up will look, so it is where the steps
live. This file is only how to walk someone through them.

Its numbered headings are the steps, one tracker line each. Anything else in that
section — what not to do, and the riders inside a step, like *no collaborators*,
*leave the default branch unprotected*, *encrypt that disk* — is **not** a step
and gets no line of its own. Each rider is a pass condition of the step it sits
in, and a step is not marked done while one of its riders is unmet.

If the README's section is missing or has been rewritten into something else, say
so and stop. Reconstructing the steps from memory is how a setup acquires a step
that was retired and loses one that was added.

## Before the first step

Every check here is about the **instance being created**, never the checkout this
session is running in — which is nearly always a working record, and is the thing
being copied from rather than the thing being set up.

| Ask | Then |
|---|---|
| Is the new instance already part-built? | Three answers, not two: **nothing yet** — walk it from the top · **partly** — the resume below · **a finished record that already holds someone's life** — stop, and ask what they actually want changed |
| Who is it for — them, or someone else? | The repository, the GitHub account and the Claude account must all be the person's own. Setting it up for someone else, say once that they will not be able to open it afterwards, and carry on |
| Which repository does a check answer about? | This checkout, or theirs. Someone else's instance cannot be read at all, so every mark there rests on the developer's word — say which of the two a mark came from, rather than letting a local check stand for theirs |

The first message carries the outcome of these, above the tracker, and then the
first step. One short paragraph, not a preamble.

**Two things the README does not say, and both are decided in the first two steps.**

- **The repository name.** A name in it sits in a URL, a remote, `.git/config`
  and every clone command — all outside `data/`. Say that once, then let whoever
  is setting it up choose: the owner of this instance named it after her
  knowingly, on a repository only she can open. The system never reads the name.
- **The history.** Cloning from a record that holds someone else's life, its
  history is not the trade-off the README frames it as: it must not follow, so
  the clone starts from a fresh `git init`. What is lost is a past that was never
  theirs.

## Where the file work happens

**Only the record folder carries over.** The evidence base, the sandbox and the
harness's own notes are not hers and are not copied: a new instance starts them
fresh, and `PRD-009` is about the record folder alone.

Four of the steps — emptying the record, the profile, the crisis numbers, the
commit — are file edits in the **new** clone, which does not exist until step 2
and which this session cannot reach. Do not describe them as agent work from
here.

Say so at step 2: once the clone exists, they open a session in it and this skill
resumes there, where those four are the agent's to do; or they stay here and take
the commands by hand. Either is fine, and the choice is made once, at step 2.

## Resuming

Read the repository before asking anything. Most of a setup leaves evidence, and
a question the repository can answer is a question that should not be asked:

| Evidence | What it settles |
|---|---|
| `git remote -v` | Which repository this is |
| The `unfilled:` markers, and `data/profile.yaml` | Whether the record is still blank, and whether the person has been named. `about_me.md` keeping its marker is the setup done right, not half-done |
| `data/safety/safety_plan.md`, read against where the person actually is | Whether the crisis numbers are theirs. The shipped ones are Singapore's — right for someone in Singapore, so the test is the place, never whether the file was edited |
| A session branch that is an ancestor of the default branch | The strongest proof there is that the GitHub App, the workflow and the Actions write permission all work — a cloud session cloned, pushed, and the merge carried it across |
| A commit authored by a cloud session | That a phone or browser session has run at all |

**Ask only for what leaves no evidence**: the phone, the second copy and its
scheduled pull, the disk encryption, and whether anyone else has access. A step
already proved by evidence is never re-walked, including the two below.

## Walking it

**One step per message. Stop after each one.** The next step is not shown until
the current one is confirmed — a person allowed to skip ahead arrives at the
verification step with three unknowns instead of one, which is the
[wizard rule](https://www.nngroup.com/articles/wizards/ "UX guidance for a
multi-step flow; it is about screens, not a conversation, so the tracker here
stands in for a progress bar").

Each message carries these and nothing else. While this skill is walking a setup,
this shape replaces any general reply layout, including a closing recap:

| Part | What it is |
|---|---|
| **The tracker** | Every step, one line each, with its state. First thing in the message. On a resume each mark carries the evidence it came from, or *your word* where that is what it rests on |
| **The step** | One action, in the words of whoever must take it. A click path for their browser, a command for their terminal, or nothing at all where the agent does it itself |
| **What they should see** | The result that means it worked, as its own line, so a confirmation means something ([Google's procedures guidance](https://developers.google.com/style/procedures "Says one action per step and to state the result; written for documentation rather than for a conversation")) |
| **One plain sentence**, where something has gone wrong | What is and is not lost. A person who has just seen a conversation vanish is owed that before anything procedural |

Four states, and a step is only ever marked from what was observed — never from
having said it:

```
✅ done · 🔵 now · ⬜ to do · ❔ can't be seen from here
```

`❔` is not a lesser `⬜`. It is a step that may well be done and cannot be
proved, and the difference decides whether the setup is finished.

Twelve lines in front of every message is a lot to re-read on a phone, so once
more than half are done the finished ones collapse to a count — `✅ 1–6` — with
the current step and those after it in full, and the whole list on request.

**Where a step has no observable at all** — an app installed, a setting saved —
say which later step catches the miss, so a confirmation given too readily is
caught rather than trusted.

**Do the work where it can be done.** A step that is a file edit, a commit, or a
check the repository can answer is the agent's, and it is done rather than
described. A step inside someone else's interface — GitHub's settings, an app
store, a phone — is theirs, and it gets the exact path, not a paraphrase.

## The two steps that are invisible when missed

Both are in the README with their reasons. What this skill adds is that neither
is bundled with a neighbouring step, and neither is passed on a setting alone:

- **The Actions write permission.** Without it every save from a phone stays on
  the session's own branch, the record looks saved, and nothing says otherwise
  until a later session cannot find what was said. A radio button is
  self-reporting, so it stays `🔵` until the **next** push is carried into the
  default branch — that is the only evidence that counts.
- **The crisis numbers.** A wrong number is discovered on the worst night there
  is, by the person least able to work around it. Judged against where the person
  is, not against whether the file was touched.

## When a save did not arrive

Name the step the symptom points at, then check the diagnosis before acting on
it. A one-to-one symptom table is a guess unless something separates its causes:

| What they see | Step | What separates it from its neighbour |
|---|---|---|
| A commit on the session's own branch, nothing on the default branch | The Actions write permission | The repository's Actions tab shows a **failed** merge run. No run at all is the GitHub App instead |
| No commit at all from the first conversation | The GitHub App, then whether the hooks are in the repository | A session that cloned but could not push says so in its own transcript |
| A second session that knows nothing | Whether the first session's commit reached the default branch | Read the default branch; if the commit is there, the problem is the session, not the save |

**Then repair what is already stranded**, which is a separate job from stopping it
happening again, and the developer is asking for both. Running the merge workflow
by hand does **not** do it: its merge step runs on a push, so a manual run tidies
branches, goes green, and leaves the default branch exactly as empty as before.
The repair is done from a computer — fetch the branch, merge it into the default
branch, push — and nothing she said is lost in the meantime, because the commit
is safe on the branch.

## Finish on evidence, not on the last step

The setup is done when a conversation has been saved and a second session has
read it back — the verification step in the README — and not when the steps run
out. A tracker with a `❔` on it is not a finished setup; say which marks rest on
nothing but a confirmation, and what would prove each one.

## Afterwards

The person's own answers — their name, what they want from this, who to call on a
bad night — are **not** collected here. They are `first-contact`'s, in her own
session, in her own words. A setup that fills the profile on her behalf has
written her record for her.

Close by saying what is now true and what is still outstanding: the second copy
if it was deferred, the dashboard if they want one, and any `git rm` step the
README leaves for a person to run.

## Where this falls short

It cannot click anything in GitHub, install an app, hold a phone, or watch a
cloud session. Those steps rest on the developer's word, and an optimistic
confirmation is indistinguishable from a real one — which is what `❔` and the
next-push rule above are for, and they only narrow it. It reads the README as
written, so a README that has drifted from the repository produces a setup that
matches the README rather than the repository.
