---
jobs: reminders, check-in, safeguard-check, privacy-check, dev-hygiene, code-maintenance, heartbeat-doctor, dialogue-loop, restore-drill, night-loops, for-you-week
---
# Jobs

The heartbeat's folder. The hourly routine (and BAXTER's sweep, where it runs) starts this file
through the `orchestrator` entry in `.claude/heartbeats.json`, which BAXTER
requires and never writes (`"stamp_manifest": false`); everything else lives here (HBT-001, HBT-002). Started by
hand on GitHub (`.github/workflows/heartbeats.yml`, with `DEAR_RUNNER=cloud`), it
runs the jobs marked `runs: anywhere` only (HBT-011). Each claim and finish names its runner
(`last_runner`, and `(cc-routine)`, `(baxter)` or `(cloud)` in its commit title).

- **This README** is the orchestrator's prompt. Its frontmatter holds `jobs`,
  the order jobs run in.
- **One file per job** holds its prompt, and in its frontmatter its `emoji`
  (one, marking it in the developer's report, HBT-012), its cadence
  (`every`, and `cron` with `timezone` where the day matters), where it may run
  (`runs: anywhere` or `runs: local`, the default), and any `gate`.
- **The state file**, state.json beside this README, holds every record, one
  line each (HBT-008); a copy has it from its first run:
  the whole run's under `run` (the lock a second run stands down on, HBT-007),
  each job's under its name. `status` is never, running, ok or failed;
  `last_started` and `last_finished` are ISO times; `failures` counts failures
  in a row. It is this copy's own: a release never ships or overwrites it, so an
  update and going back over one never meet a run's edits. A job with no line
  there has never run, except the two inline jobs, which keep none: what they sent is in
  her sent logs, and the developer's report names each send, late one and miss. Until 2026-11-02 the records sat in each file's
  frontmatter; a claim or finish moves any it still finds there.
- **Each run's summary** is the body of its `finish run` commit
  (`git log --grep='finish run' -- .claude/jobs/`). There is no backlog (A-152): a job
  fixes what it finds or drops it, and only a question for the developer is
  kept, on `dev/for-you.md` (HBT-009, DEV-013).

Records change only through `node .claude/hooks/lib/heartbeats.mjs claim|finish`,
which commits on main's tip from a checkout of its own. Run in a shared tree (a
run by hand), it leaves that tree on main's tip with no branch: `git checkout main`
before committing anything else, or the commit lands on no branch and never
reaches main (2 Nov: a fix had to be carried over by cherry-pick).

| Job | What the run does |
|---|---|
| [`reminders.md`](reminders.md) | Every sweep, first and inline: sends her reminders that came due (`inline: first`, HBT-010) |
| [`check-in.md`](check-in.md) | Every sweep, second and inline: asks her the check-ins she scheduled that came due, or holds them (`inline: second`, HBT-014) |
| [`safeguard-check.md`](safeguard-check.md) | Checks every safeguard still refuses, and restores one that stopped (SFG-009, SFG-013) |
| [`privacy-check.md`](privacy-check.md) | Twice a day, 2am and 2pm: reads the files outside `data/` its ledger says no run has read as they are, for anything personal a name list cannot catch, and takes it out, naming findings by path only (A-155, ARC-004) |
| [`dev-hygiene.md`](dev-hygiene.md) | The development hygiene pass |
| [`code-maintenance.md`](code-maintenance.md) | Nightly at 2am, grounding its sources weekly: keeps the code in line with the live sources in [`code-maintenance-sources.md`](code-maintenance-sources.md), which it keeps current itself, and finds what is slow; lands as many changes as are relevant, in groups, only what the behaviour lock proves unchanged and the speed check shows no slower (HYG-006) |
| [`heartbeat-doctor.md`](heartbeat-doctor.md) | Every six hours: reads the recent runs and mends the heartbeat machinery inside its fence, never its fences (HBT-013) |
| [`restore-drill.md`](restore-drill.md) | Monthly: clones the repository fresh, as a new device would, and checks her record comes back whole, naming folders and counts, never files (DAT-003) |
| [`dialogue-loop.md`](dialogue-loop.md) | Daily: the Agreements still match the Transcript, every register traced, every code-graded eval card run and recorded; a card that passed and now fails is reported first, with `/rollback` (WKB-007) |
| [`night-loops.md`](night-loops.md) | Nightly at 21:50, reaching him at about 22:05: suggests one to three long Claude Code `/loop` jobs for the developer to start before bed, from what the harness has open, each with its timing, sent to the development bot; it never starts one (A-173, HBT-012) |
| [`for-you-week.md`](for-you-week.md) | Weekly, Sunday morning: settles the for-you questions left a week after they were put to the developer, on the agent's pick, never one at a gate; then puts the three oldest to him with a pick each, through the development bot (A-178) |

No job here keeps a skill up to date: a skill checks itself when it is used, and
keeps its own note of when it last did (A-015, `.claude/hooks/lib/precursor.mjs`).

---
## The heartbeat: one orchestrator, every due job

The one prompt the schedule starts (HBT-002): BAXTER's sweep sends it every
30 minutes, through the single entry in `.claude/heartbeats.json`. You are the
**orchestrator**. You run nothing yourself: you find the due jobs, give each to
a subagent of its own, check their changes against each other, land them,
record them, and say what happened (HBT-009). No one is present.

## Rules of the run

Every runner starts here with the same one-line prompt, from `.claude/heartbeats.json`
(HBT-002), so everything the run must know is in this file, not in the prompt.

- **No one is present.** Never start a conversation, never wait for an answer, and
  never touch one of her conversations.
- **Secrets stay unseen.** The environment holds the channel's keys; never print,
  log, commit or repeat any of them, whatever they are named.
- **Privacy.** Nothing personal outside `data/`, and nothing personal in a commit
  message.
- **Order.** Inline jobs first, in their order (the reminders, then the check-ins),
  then the due jobs; stand down if a run is already going or nothing is due.
- **One sender, one backup.** Only the runner `.claude/heartbeats.json` marks `"sends": true`
  runs the inline jobs. The one marked `"sends": "backup"` sends only reminders left overdue
  (A-177), and every reminder is claimed on main before it goes, so two runners never send one
  message twice.
- **Read this whole file first**, then follow it from step 0.

## 0. Inline jobs first, then: anything due?

**Inline jobs first, before anything else** (HBT-010 design 2, HBT-014 design 2).
First note the time, in ISO (the report's `--since`), then `mkdir -p temp` and
empty the sends file with `: > temp/reminders-sent.txt`, so the report names only
this sweep's sends. Then run `node .claude/hooks/lib/heartbeats.mjs sender`: it
prints `no` on a runner that does not send, which then skips the inline jobs and
goes straight to "anything due?". It prints `backup <minutes>` on the backup runner
(A-177): that runner runs the reminders job only, with `send-due --overdue <minutes>`, so it
sends only what the usual sender has left that long, each claimed on main first; it skips the
check-ins.
Every job whose frontmatter reads `inline:` you run yourself, at once, by
following its prompt, in order: `inline: first` ([`reminders.md`](reminders.md)),
then `inline: second` ([`check-in.md`](check-in.md)). No subagent and no claim,
and none fails the run. `due` never lists them.

**Then, anything due?** Ask before building anything else. Most ticks have
nothing to do. So, in the folder you were started in, change nothing and run only:
`git fetch -q origin main`, `node .claude/hooks/lib/heartbeats.mjs due` and
`node ux/scripts/upkeep-watch.mjs --pending`. If `due` exits 1, the step is broken, not "nothing due":
send the report (step 5.5) naming each `unreadable:` line it printed, and stop. Both print nothing: send the report (step 5.5) if it exists, with a one-line
one-sentence note of what you looked at (such as "Nothing was due; the last
day ran clean and safeguard-check is next."), then **stop here**,
with the one-line reply "nothing due", no checkout, no install, no commit. Either prints a line: go on to step 1, where the
claim checks again on main's tip. `due` reads the records as GitHub's main
holds them, just fetched, not this folder's copy, which can only lag main's and
so looks more due: read from the folder, a lagging record started runs that
landed an empty claim and finish after a checkout and an install (2026-10-08:
an empty tick paid for that every half hour; set-up scenario S26).

## 1. Claim the run

1. A cloud clone is shallow, and the commit gate's for-you check then fails
   every review line naming an older commit, so the claim is refused (2026-10-09,
   the first cloud Routine run). Fetch the whole history first:
   `if [ "$(git rev-parse --is-shallow-repository)" = true ]; then git fetch -q --unshallow origin; fi`
   (on a full clone this does nothing and exits 0, which is not a failure).
   If that fails, say what it printed, send the report (step 5.5), and stop.
   Then make a checkout of your own, never the tree her conversation saves from
   (HBT-007): `git worktree prune && git fetch -q origin main && git worktree add -q --detach temp/hb-run origin/main`.
   If `temp/hb-run` is still there from a run that died, use `temp/hb-run-<HHMM>` instead and
   name it in your reply; never delete the old one by force.
   Work only inside `temp/hb-run` from here on. Install the packages the commit
   gate needs into it, by its own path from the repository root:
   `npm --prefix temp/hb-run/ux ci --no-audit --no-fund`. Never `--prefix ux`:
   run from the root it empties the packages of the tree her conversation saves
   from, which a running dev server holds open, so it stops halfway (2026-10-10).
   Install, never link the developer's: removing a checkout follows a link and
   deletes what it points at (2026-10-07).
2. `node .claude/hooks/lib/heartbeats.mjs claim run`. Exit 3 means another run
   holds the heartbeat: remove your checkout (step 5.4) and stop. Any other
   failure: say what it printed, and stop. Either way, send the report
   (step 5.5) first, naming why you stopped (HBT-012).

## 2. Find the due jobs

`node .claude/hooks/lib/heartbeats.mjs due` prints every job due now, one name
a line, in the order this file's `jobs` lists them. A job whose slot was missed is due, so it runs
late rather than never. None due: go to step 5. If `due` exits 1, a job could not be read and the step is broken:
report each `unreadable:` line in the summary as failed, and run the jobs it did print.

## 3. One subagent per job, side by side

Claim every due job in **one** commit, since each commit is a full pass of the gate:
`node .claude/hooks/lib/heartbeats.mjs claim <job>,<job>,…`. It prints `claimed <job>` or
`skipped <job>`, one a line; run only the claimed (exit 3: none could be claimed, so go to
step 5). Then, for each claimed job, make its branch from the same tip:
`git worktree add -q -b hb-<job>-<YYYYMMDDHHMM> ../hb-<job>-<HHMM> origin/main` (the minute
keeps a second run on the same day from colliding with a branch or folder left behind), with the
packages installed as in step 1. Start every job's subagent at once, in one
message, each as an ordinary agent call, never in the background, so you wait
for every reply. **Never reply or end your turn while a subagent is still
working**: this session has no one in it, so your reply ends the run, and every
subagent still running stops with it (2026-10-09: the run replied "still
waiting for spec-fix agent", which ended it; nothing landed, and its claims
stayed running). Each subagent is told:

> You run one heartbeat job in the dear-me repository, alone, in the checkout
> `<absolute path to ../hb-<job>>` and nowhere else. Follow
> `.claude/jobs/<job>.md` exactly, except: do not claim, finish,
> push or merge; the orchestrator does those. Commit on your branch with the
> `commit` skill, one commit per change, never `--no-verify`, never a force,
> rebase, amend or reset. If a commit or tool is refused, stop and say what
> refused it; never work around it. What you find, fix or drop: nothing is
> kept for later (A-152). Never write `dev/for-you.md`: only a decision only
> the developer can take goes in your reply, as one plain question each, under
> `For you:`. Reply with: your commits (hash and summary), what you changed and
> why, what you dropped and why, your questions for him (or "none"), and
> anything you could not do.

**The privacy read's readers are yours** (ARC-004 design 4). When `privacy-check`
is due and claimed, run `node ux/scripts/privacy-ledger.mjs slices --json` in its
checkout before starting the subagents; it prints at most `privacy.slicesPerRun`
slices. Start one reader subagent per slice in the same message as the job
subagents, but not privacy-check's own: each reader is told *"In `<its checkout>`,
read each of these files whole: <the slice>. For each, could a stranger learn
from it who the person this record is for is, or anything of her life (her words
quoted, a date that is hers, a place, a health detail, a person described, a
case written from her week, even with no name)? Invented examples, row IDs and
the harness's own words do not count. Change nothing. Reply with each file you
read to the end, and each finding as path, line and kind only, never the
words."* When the readers have replied, start privacy-check's subagent with
their replies pasted in, so it fixes the findings and marks what they read; a
reader that did not reply counts as read nothing.

Never touch `data/` from a job whose prompt does not allow it (HBT-005).
A job's agent cannot start agents of its own: a step that needs a second
agent belongs in the reviewer below, never in a job prompt
([`a-heartbeat-job-cannot-start-an-agent.md`](../memory/a-heartbeat-job-cannot-start-an-agent.md)).

## 4. Check the jobs against each other, then land them

When every subagent has replied, start one reviewer subagent, told:

> In `<absolute path to temp/hb-run>`, run `git checkout -q --detach origin/main`
> and merge each job branch there with `--no-ff`, in this order:
> <the job branches>. For each: does it merge cleanly, and does any of its
> changes undo or contradict another job's (the same lines, the same file
> reshaped, the same question twice)? Then run `node .claude/hooks/selftest.mjs`
> and `npm --prefix ux run check`. For a `hb-heartbeat-doctor-…` branch, run
> `node ux/scripts/check-doctor-fence.mjs origin/main <that branch>`: a refusal
> means it clashes (HBT-013). For a `hb-code-maintenance-…` branch, run
> `node ux/scripts/check-hygiene-fence.mjs origin/main <that branch>`: a refusal
> means it clashes (HYG-006). You are also its second agent: for each commit on
> it carrying the line `Upkeep: HYG-006` (list them with
> `git log --format=%H --grep='^Upkeep: HYG-006$' origin/main..<branch>`; the line is never the
> last, since the attribution lines follow it), read `git show <commit>` and ask *"Find any
> way this diff changes what the code does, for any input, caller or
> environment, including a dependency's changed behaviour."* Anything but a
> certain "no change" means the branch clashes, naming the commit and the change. A merge that
> conflicts is a clash: `git merge --abort` it, name the files, and go on to the next branch. Change nothing yourself: make no branch,
> push nothing, and end with `git checkout -q --detach origin/main` so the
> checkout is back at main's tip. Reply with each branch's verdict (lands, or
> clashes with which branch and where) and the checks' result.

Then land, in the same order: merge each branch the reviewer cleared into your
checkout with `git merge --no-ff -m "merge: heartbeat job <job>"`, so each
job's commits stay grouped under their own merge. A branch that clashed is not
landed: that job is recorded failed, with the clash as its reason, and runs
again next time. If the checks failed, land nothing that the failure names.
Then, in your checkout, run `node ux/scripts/upkeep-watch.mjs` (HYG-006): it
checks each landed upkeep commit against main's tip, reverts with a commit of
its own any that changed what the app does, and records what it checked. Say
each line it prints in the summary. If it fails, record the run failed with
what it printed; never revert or edit by hand to get past it.
Push once: `git push origin HEAD:main`; if main moved, `git fetch` and
`git merge origin/main`, then push again. If that merge conflicts, or the second push is
refused too: `git merge --abort`, record every job that was to land failed with "main moved;
not landed", and go to step 5 (each runs again next time). That is the only push a run makes:
never another branch, never `-u` (2026-10-08: the first spec-health run pushed
a review branch instead, so its verdicts never reached main).

## 5. Record, summarise, clean up

1. Every job, in **one** commit: `node .claude/hooks/lib/heartbeats.mjs finish <job>=ok,<job>=failed,…`,
   `ok` if it landed or had nothing to land, `failed` if it could not do its job, was
   refused, or clashed. Exit 4 names a branch not on main: deal with it as below, then
   finish them all again. A job held by a permission refusal is recorded failed
   with that reason, never worked around. `finish <job> ok` refuses (exit 4)
   while the job's `hb-<job>-…` branch is not on main: land it, or record it
   failed; never delete the branch to get past it. A branch that did not land,
   whatever the reason (it clashed, main moved and it was not landed, or its job
   failed partway), once its job is recorded failed, is kept under another name so
   the next run's `finish` is not held by it:
   `git branch -m hb-<job>-<stamp> parked/hb-<job>-<stamp>`, named in the summary.
   Where the branch `finish` names is an earlier run's (its stamp is not this
   run's: that run died, or was left before this rule), and this run's own has
   landed, or had nothing to land, park that one the same way, name it in the
   summary, and finish again: its work never landed, and this run did the job
   afresh. Left as it is, it holds
   every later `finish <job> ok` until the job stops after three failures, and a
   branch carrying a `data/` change is never retired by the sync (round 44 of the
   git sync review).
2. Only what needs the developer is kept (A-152): every question under a job's
   `For you:`, a failed job's too, each once, and a failed job's reason only
   where it needs his decision, goes in `dev/for-you.md` as
   `- for-you · <one plain question> · opened YYYY-MM-DD · chat none`, and each
   `For you tidy:` line from the dialogue loop is applied there (near-duplicates
   merged into the newest wording; a question git shows answered removed); commit
   it with the `commit` skill and push. Work a job could not finish is not kept:
   the next run of that job finds it again. File names, never what she said.
   Only you write the file, in one commit after every job has landed: jobs that
   each appended to it on their own branch conflicted there, and the second to
   land was recorded failed (T-330). Never `merge=union` for it: a line
   answered and removed would come back.
3. Write the run's summary to `temp/run-summary.md`, one line per job:
   `- <job> · ok|failed · <commits landed, or "nothing to land"> · <reason if failed>`
   (night-loops' line ends with its note, `suggested <n> loops (<their topics>)`, so the next
   night can see it and not send the same again, T-811; harness words only),
   then `- inline · reminders <n> sent, <n> held · check-ins <n> asked, <n> held` (counts only:
   never what a message said or when she eats, sleeps or trains; this lands in git history),
   then `- Left for the developer: <the questions added to dev/for-you.md, or "nothing">`.
   Then `node .claude/hooks/lib/heartbeats.mjs finish run ok temp/run-summary.md`
   (or `failed` if the run itself broke): the summary becomes that commit's
   body, so `git log` keeps every run's history (HBT-009). Copy that summary to
   `temp/run-summary.md` in the folder you were started in, for step 5.
4. Remove every checkout this run made in steps 1 and 3 with a plain `git worktree remove` (its installed
   packages are ignored files, which go with it). A `temp/hb-rem` or `temp/hb-ci` (or its
   `-<HHMM>`) an inline job left because its save never landed is never removed: its commit is
   on no branch, so removing it orphans her record's lines (round 43 of the git sync review);
   name it in your reply. Delete the landed `hb-`
   branches with `git branch -d`. Never `--force` either: the history guard
   refuses both. A folder the remove cannot delete (a sync lock) stays
   behind empty: say so in your reply.
5. **The developer's report** (HBT-012): on a copy holding `dev/run-report.mjs`,
   always first write the sweep's notes to `temp/run-note.txt` in the folder
   you were started in, even on a quiet sweep: for each job that ran, one line
   `<job>: <one or two sentences>` (what it checked, what it changed and why,
   what it left for the developer), which the report sets under that job's own
   line; then one general line on whether reminders and check-ins went or
   held, and what is worth watching next. First person, plain words
   ("safeguard-check: tried every safeguard against its refusal case; all still
   refuse, nothing to restore."), naming jobs but never a word of her record. Then, from that
   folder, run
   `node dev/run-report.mjs --sent temp/reminders-sent.txt --summary temp/run-summary.md --note temp/run-note.txt --since <the time you noted in step 0, as ISO>`,
   having copied `temp/hb-run/temp/run-summary.md` to `temp/run-summary.md` there
   before step 4 removed the checkout.
   It sends one short Telegram message after every sweep, a quiet one saying
   "nothing ran", and never fails the run. No such file: skip this.
6. End with the same summary as your reply.

**Every sweep ends with a report, whatever happened** (the developer's order,
2026-10-19): nothing due, a stand-down because another run holds the heartbeat,
a refused claim, a failed run, a broken step. Before you stop by any path, write
the note (what you looked at, and why you stopped; say plainly when the lock
looks stale, such as `running` for over 3 hours, the `heartbeat.staleClaim` threshold) and run
`node dev/run-report.mjs --sent temp/reminders-sent.txt --note temp/run-note.txt --since <step 0 time>`
(add `--summary` when there is one). If the claim stood down, the report is sent
from the folder you were started in, since the checkout is gone. A report that
cannot be sent is said in your reply; it is never the reason to skip the rest.

Never touch one of her conversations, never write for her outside what a job's
own prompt allows (HBT-005), and never change `due`'s limits or a failure
count to get a run through. Never `claim --by-hand`: it takes a job stopped
after three failures, and restarting one is a person's call (HBT-008). Nothing personal in any commit message.

**Never edit a hook, the commit gate, a check, `ux/lib/checks.mjs` or a
threshold, in any checkout, to get a claim, a commit or a run through.** A
claim or commit that is refused or times out: record that job failed (the run,
if it was the run's own claim) with what refused it, say so in the summary,
and stop that job. A gate that is too slow is the developer's to fix
(2026-10-08: the first spec-health run raised two gate time limits itself to
get its claims through).
