# .claude/memory/

What a past session learned the hard way and a future session cannot rediscover
by reading the code. Nothing personal lives here — this folder is about the
harness and the dashboard, never about her. Her record is `data/`.

| File | What it is |
|---|---|
| `a-chat-sees-its-environment-at-start.md` | A key or domain added to a cloud environment is seen only by chats started after the save: check from a fresh helper chat. |
| `stash-pop-pops-whatever-is-on-top.md` | `git stash pop` takes the newest entry, not yours: an empty stash pops an old one. Name it, or skip both when the tree is clean; never pull with `--autostash`. |
| `a-cloud-loop-sleeps-when-the-chat-does.md` | A self-paced loop in a cloud chat may not wake while no one is there; long unattended work goes on a scheduled task instead. |
| `a-routed-skills-test-must-state-its-route.md` | A scenario for a route gated by a mode must say the mode is on, and hold what it asks drawn; keep the per-check grading on every live run. |
| `a-running-job-holds-its-file.md` | Never push a rename of a heartbeat job's file while its run is going: a pushed branch reaches main within minutes. |
| `a-template-change-misses-published-pages.md` | A see-it template change does not reach pages already published: redraw each from `dev/diagrams/`, and keep a reusable page's sources there the day it is published. |
| `agents-share-one-scratchpad.md` | Parallel agents write to one scratchpad: give each a name for its files, and read a message file before committing with it. |
| `grain-stays-svg-turbulence.md` | The dashboard's paper texture is an SVG filter, and must not be baked to a bitmap again. |
| `css-rule-splicing-breaks-globals.md` | Two ways `ux/app/globals.css` was broken silently, and the gate that catches both. |
| `pinned-columns-slide-for-three-reasons.md` | Why a `position: sticky` column drifts, the causes, and when to use a frame instead. |
| `a-lagging-pinned-band-is-the-scroller.md` | A pinned heading that trails the scroll is a compositing fault — promote the scroller, never the band. |
| `the-chat-app-renders-little-html.md` | What the chat app does to `<br>`, stacked lines, spaces and `<sub>`, and what to use instead. |
| `a-routine-that-succeeded-may-have-done-nothing.md` | A Routine made by the tool has no repository attached, and "succeeded" only means its session ran; judge a run by what reached main. |
| `say-a-run-happened-only-from-its-record.md` | Before telling the developer a scheduled job sent or ran, read its record on GitHub's main; none there means it has not run yet. |
| `leftover-chat-branches-clear-themselves.md` | `claude/…` branches on GitHub are removed a week after they land (DEP-011); never script a remote sweep (the local, on-demand pass is `git-reconcile`, WKB-015), and a cloud session cannot delete one anyway. |
| `unpushed-saves-may-already-be-safe.md` | Record commits ahead of main may already sit on a `rescue/` branch; check before calling them unsaved, and how rescue branches reach main.; and a paused rebase keeps the tree detached so every save fails. |
| `the-commit-gate-has-no-git-history.md` | The commit gate's checks run in a copy with no `.git`; read history via `DEAR_GIT_ROOT`. |
| `git-since-a-bare-date-means-now.md` | `--since=<date>` means that date at the current time of day; pin it to midnight. |
| `work-from-origin-main-never-local-main.md` | A session's local main may share no history with origin; branch from origin/main. And a scratch clone's hooks still act on the live checkout unless `CLAUDE_PROJECT_DIR` points at the clone. And a merge between reading a file and rewriting it whole loses the other chat's change. |
| `build-in-a-worktree-on-a-named-branch.md` | Isolating a change in a worktree: a named branch from origin/main, linked `node_modules`, land by merge, and a red gate that may be another chat's. |
| `a-branch-main-cannot-merge-is-settled-first.md` | When main cannot merge into a session branch, settle it before more work; replay a Transcript main reorganised; stage script-written files by name. |
| `a-list-question-may-be-answered-in-another-chat.md` | Before building an answer to a for-you question, confirm on main it is still open; his answer to that question alone beats a blanket yes. |
| `a-long-spec-pass-meets-a-moved-main.md` | A mass rewrite of spec rows: keep it as data, merge main just before applying, compare the whole folder, and brief agents to name skills, not paths. |
| `paths-in-prose-are-from-the-root.md` | The link check reads a backticked path in a spec or note from the repository root; the full path, never the short hooks-folder form. |
| `a-slow-dev-server-is-usually-its-watcher.md` | A laggy app with fast readers: time the server's login page first, then look for worktrees inside the repo; and why timing readers outside Next needs a request-scoped cache(). |
| `colour-emoji-make-the-spec-graph-stutter.md` | Why the spec graph draws emojis as pictures and moves as one layer, and how the stutter was found. |
| `scripted-spec-edits-anchor-to-the-row.md` | Bulk edits to the specs: anchor to the row, carry a row's limits when folding it, and write retired IDs plainly. |
| `rewriting-a-whole-json-file-reflows-it.md` | Editing a value in a hand-formatted JSON file: replace the exact string, never dump the whole file. |
| `pushing-a-chat-to-main-merges-in-order.md` | Pushing to a moving main: no timeout on a merge, `moved --fix` before the merge commit, and a remark written mid-merge is lost and restored through the record hook. |
| `take-the-next-id-from-disk.md` | Other chats add cards and entries mid-chat: take the next ID from disk right before writing, and check git shows the file as added, not modified; a Transcript clash settles in the pull (merge driver) or by `dialogue.mjs resolve`; by hand, as a union, never one side, moving a renumbered card's references. |
| `check-a-hook-with-node-check.md` | A hook is a script: importing it runs it; check its syntax with `node --check`, try it through its test or the selftest. |
| `a-script-write-is-not-yours-to-the-gate.md` | Files a script changed are not on the session's list: the gate refuses them as unowned, then as left staged, in turns; touch one line with Edit, rerun once, read the whole log. |
| `test-fixtures-go-through-the-parser.md` | Build test fixtures as Transcript text read by the parser, not hand-made objects; read cards through `cardEntries`, never `e.card`. |
| `an-eval-must-agree-with-the-gates.md` | An eval's "then" must respect the five gates; when a judged eval fails, check the test first, and correct it in the open; read a new persona eval's first run by hand, its card's "How it runs" before changing a scenario, and commit a fix before rerunning. |
| `a-limit-needs-its-reason-first.md` | Before capping something that grows, name what actually goes wrong; a count is rarely it, and a number needs a source. |
| `two-locks-guard-the-safety-core.md` | The repository's unlock and Claude Code's permission classifier are separate locks; when the classifier refuses, stop and ask; in auto mode it asks nobody, so a guard that would ask for less needs a mode change or the developer's own edit. And the unlock phrase counts only at the start of a typed message; a non-safety settings line is edited with the Edit tool, since a script naming the file is refused. |
| `git-bash-rewrites-colon-paths.md` | Git Bash turns a rev:path argument into a Windows path; and rewriting JSON in another indent makes a two-line change look like a hundred. |
| `an-agent-commit-to-the-harness-may-be-held.md` | Auto mode may refuse an agent's commit to hooks or skills as self-modification, chat yes or not; park it with exact commands for the developer, never work around it; and never leave a half-edited git hook in the working tree, since git runs it from there. |
| `baxter-stamps-the-manifest-in-the-working-tree.md` | BAXTER no longer writes the manifest (`stamp_manifest: false`): its write-back reverted a pulled edit; where its record lives now; never land a jobs change while a job is running; why an hourly job says `every: 50 minutes`. |
| `new-machinery-lands-with-its-row.md` | A new script and the row naming it land in one commit: the link check refuses the row first, the claimed check the script; and a scan must not depend on its own output. |
| `read-the-guard-before-saying-a-change-needs-the-unlock.md` | The crisis section of `CLAUDE.md` is not in the lock: it needs his yes to the exact words and a hazard-log entry; read the guard's list before naming what a change needs. |
| `uncommitted-files-that-match-github-are-a-stalled-sync.md` | Changed files that are byte-for-byte GitHub's are an interrupted sync, not another chat's work: test with `cmp`, stash and fast-forward; and why the end-of-turn check made every reply repeat. |
| `the-code-graph-animates-cheap.md` | The code map's graph draws flat while it moves and crisp at rest, and its history never blocks the page; why both. |
| `the-shared-tree-blocks-in-six-ways.md` | Another chat's files blocking every pull (and her saves), swapped commit messages, a stale index lock, builder worktrees filling the disk, a Windows-only test failure, your own background agent's half-done work read as yours, and a chat's own agents colliding in one tree (brief them each a worktree): what each looks like and the way round it. |
| `a-piped-push-reports-the-pipes-status.md` | `git push … \| tail` succeeds when the push was rejected; read git's own status, or set pipefail. |
| `a-heartbeat-on-github-has-its-own-traps.md` | A secret set empty by a hidden paste, the runner's missing git name, never printing the model's output, why GitHub jobs stay listed, and the crisis hold clearing only at a chat's end. |
| `a-routine-cannot-send-to-telegram.md` | A Routine can't reach Telegram (network policy) and mustn't hold the bot token (SFG-012); GitHub's own schedule drops runs. Superseded in part: since 2026-10-17 the routine's environment allows Telegram and the routine sends. |
| `a-loaded-machine-times-out-the-gate.md` | Parallel agents or a persona run push the hook tests past their 60 s and refuse every commit: make the slow test fast, never raise the limit; commit before starting agents. |
| `search-agreements-by-what-it-does.md` | Ask the agreements on what a proposal would do, not only its name (a re-grounding heartbeat broke A-015); and an "on use" check must cover every way a thing is used. |
| `pgrep-f-matches-its-own-shell.md` | `pkill -f` and `pgrep -f` match the shell running them: stop a job by its task id, or bracket a letter of the pattern. |
| `photograph-a-view-without-the-login.md` | Photographing a view behind the login: a login-free preview of the component and headless Chrome; three interaction traps; measure warm. |
| `a-heartbeat-job-cannot-start-an-agent.md` | A job runs as an agent that cannot start agents, so a second-agent step in its prompt never runs and the job still finishes ok; put that step in the orchestrator's reviewer. |
| `the-behaviour-lock-sees-only-what-is-printed.md` | Six ways the behaviour lock misread change (run order, the clock, noisy tests, a moving checkout, a tidied temp/, a test case the sample can't show), and the one it can't fix: an effect printed nowhere. |
| `settling-a-record-merge-without-reading-history.md` | A conflicted record merge settled by reading both sides from the conflict markers, keeping the union and proving nothing of main's is lost; and Transcript numbers that collide across chats. |

**What earns a file here.** A decision that was made, reversed, and would be
made again by a session that only had the code in front of it — because the code
after a revert looks exactly like code that was never changed. The reasoning
belongs in a comment at the site as well; this folder is what remains findable
when nobody thinks to open that file.

**What does not.** Anything a fresh read of the repo would turn up — how a
component is built, what a spec says, why a commit was made. And research
findings, which have their own home and their own rule about staleness in
[`../../modules/core/knowledge/`](../../modules/core/knowledge/).

**Nothing about the person this is kept for, in any form.** Not her name, not a
quotation of her, not an event, not a preference, and not a paraphrase of any of
them — a line that names nobody can still be about her, and that is the one this
folder gets wrong. This folder is for the machinery and its mistakes. Everything
else has a home in the record: how she wants to be spoken to and what landed
badly in `data/core/me/how_to_talk_to_me.md`, what has actually helped in
`data/core/me/what_helps.md`, an event on `data/core/timeline.md`, a correction where it
was made. A lesson about the harness that can only be written by describing her
is a record entry wearing a harness file's clothes, and it goes to the record.

**One file, one lesson,** named for the lesson rather than for the file it is
about — the next session is searching for the mistake it is midway through
making, not for a path it already knows. Add a row above in the same change.

Nothing here is deleted. A lesson that stops being true is rewritten in place
with a dated line saying what changed, so a file that has been superseded still
says so to whoever arrives holding the old belief.
| `hook-tests-must-unsilence-errors.md` | The hook library exits 0 on any error, so a rule test importing it passes silently when it fails; turn that off, end with a summary line, and prove the test can fail. |
| `an-unset-variable-in-a-path-writes-to-root.md` | A path built on an unset variable starts at the root: write the scratchpad path in full, and check a backup exists before breaking anything. |
| `a-skill-line-can-overrule-claude-md.md` | A skill line that asks for what CLAUDE.md forbids, in other words, wins in the session (E-055); no check can see it, so read the running skill first when an eval fails on a CLAUDE.md rule, and read CLAUDE.md before landing a line that says what to ask. |
