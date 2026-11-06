---
emoji: 🔁
runs: local
gate: dev
every: 1 day
governs: WKB-007
---
# Heartbeat: the dialogue loop

An unattended run, with no one present. It keeps the dialogue and its evidence
true every day (WKB-007 designs 9 to 12; stage 4 of the dialogue build plan):
the Agreements still match the Transcript, every register is still traced,
every code-graded eval card still passes, and anything that got worse is
reported. It **checks and records; it never fixes by weakening** (A-007,
*"Keep checking everything, all the time, and never go easier on the
checks."*). It never opens `data/`, with one exception the owner approved (T-291): on the first run of a month, `node dev/evals/probes/her-life.mjs` reads her timeline's dates and types and the session log's dates, and prints four numbers; no word of her record leaves it.

**Where `dev/` is absent** (a copy given away, ARC-008), reply "no dev/ in this copy, nothing to do" and stop.

**It may change only:** `dev/evals/history/` (one file a day) (by running the
evals, never by hand), and one line a week appended to
`dev/projects/mission-driven-dev/notes/method-checks.md` (the method step below). Never an eval card, a command, a pass mark, a check, a
hook, a spec, the Transcript, the Agreements or `dev/for-you.md`: a card that
fails is reported, never edited to pass. There is no backlog (A-152): what this
run cannot fix it drops, named in the reply, and the next daily run finds it
again; only a decision that is the owner's alone becomes one plain question,
under `For you:` in the reply, for the orchestrator to put on `dev/for-you.md`.

0. **The model** (D46, A-007). Run `node ux/scripts/evals.mjs model <your model id>`,
   the exact model ID you are running on. Exit 3 means the model changed since the last
   record: this run re-checks everything, so in step 2 run the persona cards too
   (`run --personas`) whatever their age, and lead the reply with the change.
1. **The dialogue.** From the repository root, run each and note what it prints:
   - `node ux/scripts/dialogue.mjs check`: the Agreements match the Transcript,
     nothing left unsorted past its day, no card agreed without a recorded yes.
   - `node ux/scripts/dialogue.mjs coverage dev/projects/<desk>/decisions.md`, once for
     each desk in `dev/projects/`: every decision, numbered or titled, named by a
     Transcript entry.
   - `node ux/scripts/dialogue.mjs trace`: every register traced to its agreements.
   - `node ux/scripts/dialogue.mjs sort`: the entries still unsorted. Sorting
     them is a development session's job, with the developer's words in front
     of it; report how many wait, and their IDs, never their words.
   - **The weekly read of one group** (A-147, *"always reviewing the agreements… no gaps,
     no overlapping, no contradictions"*). On the first run of each week (Monday, Asia/Singapore),
     run `node ux/scripts/dialogue.mjs group`: it prints this week's group of cards whole,
     turning through every group in order. Read them side by side, and with the core group
     (🧭 How we agree) where they touch it: two cards saying the same thing (an overlap), two
     that cannot both hold (a contradiction), or a want the Transcript shows with no card
     (a gap). Each finding becomes one question for the owner under `For you:`, naming the
     cards and the finding in a sentence; never an edit to a card. None found: say so in one line.
   - `check` also says when a full review of the Agreements is due (twenty new cards or a
     month since the last one in `dev/dialogue/reviews/`): name it in the reply, for the next
     development chat; the review itself is that chat's, with the owner there.
2. **The evals.** `node ux/scripts/evals.mjs run --all` (every card graded by code,
   the inside-out scan of what the code sends out among them), then
   `node ux/scripts/evals.mjs coverage` and `node ux/scripts/evals.mjs drift`.
   - **Daily, outside in, a few at a time** (T-248 chose daily for every persona check;
     T-340 made it the oldest four each day, since all of them could not finish inside one
     sweep and loaded the machine past the commit gate's limits): every run, run
     `node ux/scripts/evals.mjs run --personas --oldest 4`: each of the four persona or
     troublemaker cards whose last run is oldest talks to a throwaway copy and a tested judge
     grades it (`dev/evals/runner.mjs`, which calibrates the judge on its known cases first
     and refuses to grade if it gets one wrong). Every card comes round about every nine
     days; the cost is recorded in the history (D43).
   - **Watching the watchers:** `stale` also fails when a code card has not run for two
     days, or a persona card for ten, a check that stopped running (A-007); name each in the reply. Once a week
     (the first run on or after Sunday, Asia/Singapore, that finds `node dev/evals/runner.mjs
     --calibrate` not in the last six days of `dev/evals/history/` (one file a day)), run `node dev/evals/test-runner.mjs` (the runner still reads verdicts
     strictly and catches canaries) and `node dev/evals/runner.mjs --calibrate` even if nothing
     changed, so the judge is re-proven on its known cases.
   `run` appends every verdict to `dev/evals/history/` (one file a day); commit that folder
   alone with the `commit` skill (`chore(evals): record the daily run`).
3. **Regressions first.** A card that passed its run before and fails now
   (`drift` names it) is a regression: it leads the reply, with the card's ID,
   title and the agreement it protects, and is one question for the owner under
   `For you:`, naming `/rollback` as the first remedy (D18: roll back first,
   then fix the reason). A card failing for the first time, or still failing,
   is named in the reply and dropped: the next daily run grades it again.
4. **The self-review samples** (D48), small and every day:
   - **Sorting.** Every Transcript entry dated in the last day (the newest
     month's file in `dev/dialogue/transcript/`), or three from the last week if
     none: does its way fit what was said, of the sixteen, do its topics name what it is about, and does its card say
     what the owner said, in their voice, and no more? A doubtful one is named in the
     reply with the entry's ID and what you would give it; never change the entry
     yourself.
   - **Gates.** `node ux/scripts/dialogue.mjs gates 24` lists the last day's commits that
     changed what she would notice (her instructions, skills, commands, modules, views)
     with neither an `Approved:` line nor an agreed card or recorded yes cited. Then read the
     last day's commits (`git log --since="24 hours ago" --format="%h %s%n%b"`) for any that
     changed an agreement card, the safety core or surface, or weakened a check, with no
     `Approved:` line. Each is one question for the owner under `For you:`, naming the commit.
   - **The build queue, daily** (T-243): `node ux/scripts/dialogue.mjs unproven` lists agreed
     cards not proven yet: proven only when every eval naming one passes (T-840). Name the count and the oldest few in the reply; a
     development chat builds what each asks, until every eval naming it passes. Never mark one done
     on paper.
   - **Her life, monthly** (T-291, CLAUDE.md Wellbeing): on the first run of a month, put
     `node dev/evals/probes/her-life.mjs` in the reply: good moments, hard moments, safety
     days and the days she talked, numbers only. More safety days than the month before
     leads the reply, and its remedy is a person, never the system.
   - **Growth, monthly** (A-063): on the first run of a month, put `node ux/scripts/dialogue.mjs
     growth` in the reply, so the owner sees how their asking changed. Evidence, never a grade.
   - **The for-you list, weekly** (the same run as the calibration above): `node ux/scripts/dialogue.mjs triage`.
     For each group of near-duplicates, and each month-old question `git log` shows already
     answered or built, put one line under `For you tidy:` in the reply (merge these into
     the newest wording; or remove this one, answered in <commit>), for the orchestrator to
     apply. Never one you have not read.
   - **The method, weekly** (A-153, *"I think maybe once every week for the DDD recheck?"*):
     when `node ux/scripts/dialogue.mjs check` says the weekly recheck of the method is due,
     search what is current on building software with agents from dialogue or from specs
     (spec-driven tools, agent workflows, long-running agent loops, eval-driven development,
     and research since the log's last line), each source read in full, and compare it with how
     we work: the ways he speaks, the five gates, `dev/dialogue/PHILOSOPHY.md`, and the loop
     skill, `dev/skills/work-loop/SKILL.md` (A-151). The line names what was found for loops. Append one line to
     `dev/projects/mission-driven-dev/notes/method-checks.md` in its format: what was found,
     or "nothing new", and each source as a link. Anything worth changing in the method is
     one question under `For you:` in the reply, with its source; never an edit to the method.
     Each week it also looks for whether Claude or Claude Code now joins hands-free voice to
     real work with no tunnel and no new paid service (a spoken mode, an official extension,
     voice mode acting on a repository): the parked voice idea in `dev/ideas.md` (T-939). If
     one has arrived, it is one question under `For you:`, with its source.
5. **Prove the fence:** `git diff --name-only origin/main...HEAD` (three dots: only this
   branch's own changes, not main's newer ones) lists only
   `dev/evals/history/` (one file a day), and the method log on a week its step ran. Anything else: undo it with
   a new commit (never a reset), and say so.
6. **Reply** with one line per step: what ran and its result; the regressions
   by ID; the coverage gaps by count (agreements with no card, then cards that
   cannot run yet); what the samples found; each question under `For you:` and each `For you tidy:` line. Nothing
   wrong is a good reply: "all 19 code-graded cards pass; no regression".

The crisis block in `CLAUDE.md` outranks everything here.
