# Work from origin/main, never the local main

**Hit 2026-10-01.** A cloud session starts on a detached HEAD. The obvious fix,
`git checkout main`, landed on a local `main` whose history was unrelated to
the remote main (left over from before the history was re-rooted): 60 commits
against 91, "refusing to merge unrelated histories", and half the harness
missing from the tree. Start every piece of work with
`git checkout -b <branch> origin/main` after a fetch, and push with
`git push origin HEAD:main` plus the branch itself (the commit skill says why).

**A throwaway repository still reaches the real one through
`CLAUDE_PROJECT_DIR`.** Hooks find the repository from that variable before the
working directory, and the session sets it. A hook run inside a scratch clone
therefore acted on the live checkout until the test set
`CLAUDE_PROJECT_DIR` to the clone
(`.claude/hooks/record/test-merge-in-progress.mjs` does).

**The running dashboard serves the shared folder, not `main`.** `npm run dev`
in `ux/` runs whatever the working tree holds; when other chats' unsaved edits
block a fast-forward, it falls behind while every change you land through a
worktree is copied in by hand, so a live test checks a mix that exists nowhere
else (2026-10-03: 82 commits behind for hours; a reviewer then reported a
landed route as uncommitted). Before trusting a live test, check
`git log HEAD..origin/main`; to catch up, put your own landed files that match
the remote main's copy aside as the stalled-sync note does
(`uncommitted-files-that-match-github-are-a-stalled-sync.md`: a stash naming only
those files), then `git merge --ff-only origin/main`. If another chat's unsaved edit
still blocks it, leave that edit where it is and live-test from a worktree of
origin/main with its own install instead. Never back it up and re-apply it: a
`git diff --cached` backup holds only its staged half, and its unstaged lines in
the same file were lost when the file was cleared for the fast-forward (round 42
of the git sync review).

**A merge between reading a file and rewriting it makes the rewrite stale.**
On 2026-10-07 a chat read a component with `cat`, merged main (which brought
another chat's newer version of it), then wrote the whole file from the old
read: the other chat's change vanished with no conflict to show it, and was
found only when a later merge conflicted in a neighbouring stylesheet. After
any merge or pull, re-read a file before writing it whole, or change it with
the Edit tool, which fails on text that is no longer there. And before
committing a file another chat touched today, `git log -p -1 origin/main -- <file>`
shows what you would overwrite.
