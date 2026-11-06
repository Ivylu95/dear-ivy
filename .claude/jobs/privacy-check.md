---
emoji: 🔐
runs: local
every: 12 hours
cron: 0 2,14 * * *
timezone: Asia/Singapore
governs: ARC-004 in dev/specs/system/ARCHITECTURE.md
---
# Heartbeat: privacy check

An unattended run, twice a day, with no one present (A-155, *"Everything personal
lives in the data folder, and nothing outside it is personal"*). The test it holds:
take `data/` away and hand the rest of the repository to a stranger, and they cannot
tell who it is for or anything about her life. The privacy check on every commit
matches only the names it knows; this run reads with judgement, for everything a
name list cannot catch.

**The guarantees, not yours to loosen**
- Nothing personal is ever written anywhere you write: not in your reply, a commit
  message, the for-you list, or a log. A finding is named by **path and line only**,
  and by kind (a name, a place, a date of something that happened to her, her words,
  a health detail, a person's detail), never by what it says.
- You change files outside `data/` only to take a personal detail out of them, and
  write into `data/` only to keep that detail where it belongs. You never delete a
  file, never touch the safety core (the `CORE` list in
  `.claude/hooks/safety/guard-safety-core.mjs`), and never rewrite history.
- The Transcript (`dev/dialogue/transcript/`) is kept word for word, with one
  exception, since A-155 outranks verbatim: his words about his own life move,
  verbatim, into `data/core/dev-chats/<YYYY-MM>.md` under a `## T-nnn · <date>`
  heading for the entry they came from, and leave `[moved to his record]` in their
  place, the rest of the remark untouched; a Gist, Became or card line carrying the
  detail is reworded generally, and a card whose agreed wording changes is named, by
  ID only, for the owner. Nothing else in it changes. You never edit
  `dev/dialogue/agreements.md` or `dev/dialogue/index/`: run `node ux/scripts/dialogue.mjs build`, then
  `check`, instead.
- `data-sample/` and the safety benchmark's personas (`dev/skills/safety-eval/`) are
  invented, not hers: a match there is no finding. `data-sandbox/` is not: a chat is
  played there by a real person, so it is read like any other file outside `data/`.
- Never send anything you read to the web.

1. **Know what is hers.** Read, and keep only in mind: `data/PROFILE.yaml`,
   `data/core/me/about_me.md`, the names of the files in `data/core/people/`, the
   Eras and the last month of `data/core/timeline.md`, and `data/README.md`. From
   these, what would give her away: her name and the names of people in her life,
   the places she goes, her work, the dates and shape of things that happened to
   her, her clinicians, her own phrasing where it is distinctive.
2. **Run the name check** on the whole tree: `node ux/scripts/check-privacy.mjs`.
   Each hit is a finding.
3. **Read the files the ledger says are unread** (ARC-004 design 4, T-562): run
   `node ux/scripts/privacy-ledger.mjs prune`, then note the unread count from
   `node ux/scripts/privacy-ledger.mjs status`, then `node
   ux/scripts/privacy-ledger.mjs slices`. It lists the files outside `data/` whose
   content in the last commit no run has read yet, the longest-waiting first, cut
   into slices one reader can read whole. You cannot start agents (a job's agent
   cannot, `.claude/jobs/README.md` step 3), so the orchestrator starts one reader
   per slice before you and pastes their replies into your prompt: take the files
   each read to the end, and its findings, as read. Where no replies are given (a
   run by hand, or a reader that did not reply), read the slices yourself, in
   order, one at a time, marking each slice's clean files before the next, for as
   many slices as you can read whole; the rest wait for the next run, and that is
   not a failure. A file not read to the end is not read. For each, ask: could a stranger learn from this who she is, or
   something of her life? Her words quoted in a spec or a test, a date that is hers,
   a place, a health detail, a person described, a case written from her week, all
   count, even with no name in it. Three-letter row IDs, invented examples and the
   harness's own words do not. Where it says this copy has no ledger (no `dev/`),
   read instead every text file changed outside `data/` since this job's
   `last_finished` (on its first run, the last seven days): `git log
   --since=<that time> --name-only --format= -- . ':!data'`.
   Read with the same question, since `last_finished` (T-560, "fix everything"):
   - **every commit message** on every branch: `git log --all --since=<that time>
     --format='%h %B'`. History is never rewritten, so a finding there cannot be
     taken out; it is a one-line question for the owner, by commit hash only, and a
     reminder that only a share copy (`dev/skills/release/share.mjs`) is handed on;
   - **every image and PDF** among the files listed, and any outside `data/` that
     changed (look at each: a photo, a screenshot of her chats or a scanned page
     counts like text);
   - **every name on file of two letters or fewer**, which the name check cannot
     match safely: look for each, as a word, in the files you read;
   - **a second reader, where it is installed**: if `python3 -c 'import
     presidio_analyzer'` succeeds, run `python3 ux/scripts/presidio-scan.py` (with no
     files named, it takes the ledger's `next` list). It prints path, line and kind
     only (a person, a place, a date, a phone number, an email), never the text.
     Each hit is a line to look at with judgement, not a finding: most are invented
     examples or the harness's own words. Where it is not installed, say so in the
     reply and carry on; nothing waits on it.
4. **Fix each finding**, the smallest change: reword it to something general, or,
   where the detail is worth keeping, move it into the right file in `data/` and
   leave the general wording behind. Run `node ux/scripts/check-privacy.mjs` again.
   Commit the fixes with the `commit` skill, in one commit, its message naming files
   only (`privacy: take a personal detail out of <path>`), never the detail. A
   finding in the safety core, or one you cannot fix without changing what something
   does, is a one-line question for the owner, by path and line only, and that file
   is not marked.
   Then **mark what you read**: `node ux/scripts/privacy-ledger.mjs mark <path>…`,
   for every file read whole that holds nothing personal, a fixed one included once
   its fix is committed. It records the committed content, so it refuses a file with
   uncommitted changes. Never mark a file you did not read whole, or one left with a
   question open. Commit `dev/privacy-ledger/` as the run's commit
   (`chore(privacy): mark <N> files read`); it holds only paths, blob ids and dates.
5. **If the backlog grew**: where the unread count after marking is higher than
   the one noted at the start of step 3, files are changing faster than the read
   clears them; say so in your reply under `For you:`, with both counts, as one
   plain question (more slices a run, or fewer files changed), never a second
   line for the same thing.
6. **Reply** with: read N, unread left M (from `node ux/scripts/privacy-ledger.mjs
   status`), the findings (path, line, kind), each fix made (commit), any question
   for the owner, or "nothing personal outside data/", and whether the second
   reader ran.

The crisis block in `CLAUDE.md` outranks everything here.
