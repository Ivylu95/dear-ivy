# Build in a worktree on a named branch, and land it by merge

**Hit 2026-10-03**, building `/dev-approve` (WKB-007, design 6) while other chats edited
the same working tree. A worktree keeps unfinished work out of the shared tree,
and four things about it were found the hard way:

- **Never `--detach`.** A commit on a detached HEAD in a worktree set off the
  save path: it pushed a `rescue/detached-…` branch and wrote
  a push-failure note into the worktree's copy of the record.
  Start with `git -c core.longpaths=true worktree add -b <name> <dir> origin/main`,
  after a fetch, on a short `<dir>`. Without long paths the checkout dies on a
  record file past Windows' 260-character limit ("Filename too long") and leaves
  the branch made but the worktree empty (2026-10-03; `git worktree prune`, then
  add the existing branch).
- **Read the commit's result before the next step.** A refused commit leaves
  the change staged; a merge run next fast-forwards the branch beneath it and
  looks like success (2026-10-03, hidden by filtering the commit's output).
  `git log -1` after every commit in a scripted landing.
- **`next build` will not run on the link.** Turbopack refuses a symlink that
  points out of the project root ("Symlink [project]/ux/node_modules is
  invalid", 2026-10-08, splitting the read layer). Prove a change there with
  eslint (its undefined-name rule covers every function) and the tests, which
  load the module graph; the gate and CI do the rest. Build only in the main
  checkout, or in a worktree with its own `npm --prefix ux ci`.
- **`ux/` has no `node_modules` there.** Link the real one before running a
  check that imports a package:
  `node -e "require('fs').symlinkSync('<repo>/ux/node_modules','ux/node_modules','junction')"`.
  The commit gate's own snapshot finds packages through `DEAR_GIT_ROOT`, the
  worktree, so without the link every check that loads react, next, marked or
  js-yaml failed (3 to 4 Nov, each agent brief had to say it). Since 4 Nov the
  gate makes the ux link itself in a worktree that has none
  (`linkPackages` in `.claude/hooks/lib/gate-queue.mjs`); link the admin app's dev/ui node_modules by hand
  (or by `node dev/ui/scripts/link-deps.mjs`) to run the admin app's checks.
  The link is to a folder other chats reinstall: on 2026-10-03 one reinstall
  dropped eslint mid-build, and lint could not run. If a package is missing,
  `npm --prefix ux ci` in the worktree after removing the link (`cmd /c rmdir`,
  which removes the link only), rather than repairing the shared one.
- **`git worktree remove` follows a junction and deletes what it points at.**
  Proven on a scratch repository (2026-10-07): an ignored `node_modules`
  junction in the worktree, a plain remove, and the folder it pointed to was
  gone. That is how the shared install under ux/ was emptied that evening, by
  the session-start prune clearing a finished worktree; both apps answered 500,
  then would not start. `clearFinished` in `.claude/hooks/lib/branches.mjs`
  now takes every link out first (tested in `test-branches.mjs`), and
  `npm run dev` says "packages are missing… npm ci" instead of a stack. By
  hand, take the link out first (`cmd /c rmdir <worktree>\ux\node_modules`)
  and never `rm -r` or `Remove-Item -Recurse` a worktree. From Git Bash,
  `cmd //c rmdir "<path>"` fails on its quoting ("The filename, directory
  name, or volume label syntax is incorrect") and leaves the link in place, so
  the remove after it may have been what emptied ux/ that evening too
  (2026-10-07, the Timeline + Calendar chat, at about 17:40). From Bash,
  unlink with Node instead, which removes the link only (`fs.lstatSync(p)
  .isSymbolicLink()`, then `fs.unlinkSync(p)`), for the ux and dev/ui
  node_modules links, then `git worktree remove`; for a folder git cannot
  delete, `fs.rmSync` after unlinking every link inside it, then
  `git worktree prune`. If it happens anyway,
  `npm ci` in the shared `ux/` restores it; check that before calling the
  servers stale (the first diagnosis that night was "stale", and wrong).
- **Land by merge, never squash or cherry-pick.** A branch whose work reached
  main as copies never counts as merged, so it never clears and every session
  start warns about it (`.claude/memory/leftover-chat-branches-clear-themselves.md`). If it was
  squashed already, record it with `git merge -s ours origin/<branch>` on a
  branch from main, and push.
- **A red gate on files you did not touch may not be yours.** Another chat's
  commit can leave main briefly inconsistent, and the gate in the shared tree
  failed on it (the thresholds check). Apply your patch to a clean worktree of
  the latest origin/main and run the check there before changing anything.
- **The developer's folder does not move when you land.** A push from a
  worktree leaves the shared tree behind, and the developer asked "where is
  the AGENTS.md" for a file already on main (2026-10-03). After landing, run
  `git pull --ff-only` in the shared tree and say whether it moved; it refuses
  when local main holds record saves not yet on main, and then say that.
- **A refused push leaves the branch whole.** Main moves often; after
  `! [rejected]`, add a worktree on the same branch (not `-b`), merge
  origin/main, push again. Removing the worktree takes no `--force` (a hook
  refuses it): remove the node_modules link under ux first, then a plain
  `git worktree remove`. On OneDrive the emptied folder can stay locked; leave
  it for the developer to delete in PowerShell. A worktree under the session's
  scratchpad (outside OneDrive) avoids the lock.
- **Staged work onto a newer main: a patch, never a discard.** A worktree whose
  commit the gate refused holds its work staged, and clearing it for a merge
  is refused by a hook (it discards work). Save it with
  `git diff --cached --binary`, add a fresh worktree from origin/main,
  `git apply --3way` it there, and leave the old worktree for the developer to
  remove (2026-10-03). The same hook also fires on a command whose text only
  names that git verb, so write such notes with the file tools. It fires in a
  throwaway worktree under the scratchpad too: `git checkout HEAD -- <file>`
  there, to clear a conflicted `git apply`, was refused (2026-11-04). That is
  right, since the guard cannot tell scratch from work; make another fresh
  worktree and apply again, never ask for an exception.
- **The branch can move under you.** A session hook merged origin/main into the
  worktree's branch mid-task (2026-10-03, building the shared spec-row parser),
  so a before-and-after snapshot of a check's output differed by another chat's
  new rows, not by the change. Prove "same output as before" by running the old
  code (`git show HEAD:<file>` into a scratch copy) against the same tree, not
  against a snapshot taken earlier.
- **Neither app builds through a linked install; both build on a real one.** The
  `node_modules` link (`ux/`'s, and `dev/ui`'s through it) points outside the
  worktree, and Turbopack panics on a symlink out of its root: "Symlink
  [project]/ux/node_modules is invalid, it points out of the filesystem root"
  (2026-10-03, both apps). A real `npm ci` inside the worktree's `ux/`, with
  the dev/ui node_modules linked to that (inside the root), builds both
  (2026-10-07, twice), and also sidesteps the shared install when it is broken.
  With only a link, check by lint, the checks and running the changed functions
  directly, and build on main after landing.
- **The Agent tool's own worktree can refuse to start.** `isolation: "worktree"`
  refused once because a stale locked worktree in the .claude worktrees folder
  resolved to the shared checkout (2026-10-07). Make the worktree yourself
  under the session's scratchpad (`git -c core.longpaths=true worktree add -b
  <name> <dir> origin/main`) and give the agent that path, with "run every
  command from there".
  A change that needs a live test (both servers, a sign-in) is built in the shared
  tree instead, committing only its own files, and the report says so.
- **Files check out with CRLF, in a worktree and in the shared tree alike.** A
  scripted find-and-replace whose search text has bare `\n` silently misses
  (2026-10-03, three times in one session; 2026-10-07, in the shared tree, on
  two dashboard pages, while a new file written the same way stayed LF). A regex is caught the same way: `.` stops at `\r`, so
  `\|.*\n` never matches a CRLF table row (2026-10-04, two index rows). Normalise
  to `\n` before matching and restore the file's own ending on write, or use
  the Edit tool.
- **A script passed inline to the shell loses its backslashes.** `node -e`
  and heredoc scripts reached node with `\\` collapsed, so a search for
  `<\/h` + a byte, or for a `\1`, never matched (2026-10-04, four misses).
  Write the script to a file with the Write tool and run that, or use Edit.
- **Slicing a file between two markers needs both found, once, in order.** A
  search for `/* ── Narrowing` matched an earlier "Narrowing a long contents
  list" section, so end came before start and the write duplicated ~4,800
  lines of `globals.css` (2026-10-04; caught by the line count, repaired
  before commit). Throw unless `start >= 0`, `end > start`, and each marker
  occurs once; check `git diff --stat` after any scripted write.
- **To see why pre-commit refused, run the hook, not a probe commit.** On
  2026-10-04 `git commit -m probe` was used to read a refusal, the hook passed
  that time, and the staged fix landed under the message "probe"; history is
  never rewritten, so it took a revert and a third commit to put right. Run
  `node .claude/hooks/git/pre-commit` against the staged index instead: same
  checks, no commit.
- **A replay never chains `cd` after a step that can half-fail.** On
  2026-10-06 `git clone . <dir> && cd <dir> && …` hit "Filename too long" on
  record files, the clone exited non-zero, the `cd` never ran, and the rest ran
  in the worktree itself: it committed there with `--no-verify` and wrote the
  replay's edits into the real files (undone with `git reset --soft HEAD~1`
  before anything was pushed). A local clone cannot check out this repository
  on Windows at all; replay in a second worktree made with `core.longpaths`,
  and run `pwd` before the first write.
- **A scratch repository for a replay cannot use a folder named `data/`.**
  The record guard refuses any write into a path with `data/` in it, scratch
  or not; name the folder something else when the path is not the point.
- **`next build` refuses the node_modules junction** ("Symlink … points out of
  the filesystem root"), though lint and the checks run through it. Before a
  build, remove the link (`cmd /c rmdir ux\node_modules`) and `npm --prefix ux ci`
  in the worktree; then `node dev/ui/scripts/link-deps.mjs` links the admin app
  to that local copy.
- **Parallel workers leave `dev/for-you.md` to the parent.** Six worker
  branches on 2026-10-04/05 each moved their own lines in the old backlog, and
  every merge after the first conflicted there, eight times in one session.
  Tell each worker to report its questions for the developer; the parent writes
  them once, after merging.
- **A worker's worktree saves and pushes on its own.** Its save hook pushed
  each worker branch to GitHub and, on a push that worked, deleted the
  record's push-failed note in that branch; merging the branch then shows a
  record file deleted (2026-10-05, twice). That is the note clearing by
  design, not a loss: check the name with `--stat` before alarm.
- **Auto mode may refuse a spec edit pushed straight to main.** A commit and
  push of approved spec wording was refused as "Modify Shared Resources"
  (2026-10-04) while code pushes went through; it landed after the developer
  said in their own words to go ahead. Never route around it: give the
  commands and ask.
- **Start in the worktree, even before the approval.** Edits drafted in the
  shared tree and then carried into a worktree by patch are left behind once
  the work lands, and the agent cannot discard them: the hook blocks
  `git restore` on unsaved work, so the developer had to run it by hand
  (2026-10-03). Draft in a worktree from the first edit.
- **A search that reaches build output floods the context.** `grep -rn` over
  `dev/ui` or `ux` also matches the minified bundles under `.next/`, one line
  of which can run to tens of thousands of characters (2026-10-07). Search
  source only: name the source folders, or pass `--include` with
  `--exclude-dir=.next --exclude-dir=node_modules`, or use the Grep tool.
- **Never `git stash` the shared tree to compare before and after.** On 2026-10-30 a full
  check run was compared with and without a change by stashing it; while the stash held
  the files away, a session start's background selftest ran and ten hook tests failed
  with "Cannot find module", a false alarm the next session opened with. Compare in a
  worktree of the commit before instead, or run the baseline first and the change after.
- **To set aside an edit that is not approved yet,** save a patch of your own lines
  only to the session's scratchpad and reverse it with `git apply -R`; `git checkout -- <file>` is
  refused as discarding work. Put it back with `git apply` once the yes comes. In the
  shared tree, `git diff <file>` also holds another chat's unsaved lines in that file,
  and reversing it took theirs out too (round 42 of the git sync review): use it only
  when `git diff <file>` shows nothing but yours, and otherwise build the patch from
  your own change alone (`.claude/skills/commit/shared-tree.md`, *Staging only your lines*).

**A worktree's commit runs the main checkout's gate (4 Nov).** `core.hooksPath` points at the main
checkout's `.claude/hooks/git`, so a worktree's pre-commit imports the main checkout's
`ux/lib/checks.mjs`. A change that moves a check's script is then refused as deleting it (SFG-014),
however right the worktree's own list is, and pointing git at the worktree's hooks is refused as
skipping the gate. Land such a change from the main checkout: export it as a patch
(`git diff --cached --binary`), `git apply --index` it there, and commit with the same message.
