# Pushing a chat's work to main: merge without a timeout, fix references, then commit

**Seen 2026-11-05, five times in one chat.** Main moves every few minutes, so a chat's push
usually needs a merge first, and a hand-written retry loop around it went wrong three ways:

- **A `timeout` around `git merge` killed it partway.** The merge then took about ten minutes
  (fixed the same day, T-821: a merge now takes seconds), and `timeout 900` left `MERGE_HEAD`
  with half the files settled. Never put a time limit on a merge; run it in the background with
  no limit, and if one was cut off, check `git diff --diff-filter=U` before committing it.
- **The merge commit was refused** because the merge driver renumbered this chat's remark and
  its code still cited the old number. Order: `git merge --no-commit origin/main`, then
  `node ux/scripts/dialogue.mjs moved --fix` (mid-merge it stages what it moved, T-839), `build`,
  `git add dev/dialogue` for the rebuilt pages, then commit. Never `git add` a guessed list of
  your own files: the next renumber touches others.
  If the gate says main's incoming files were "left staged", run the same commit again: in a
  merge they are meant to be carried.
- **Writing during a merge is lost.** The Transcript hook wrote two of the developer's remarks
  while a merge ran; the merge's result overwrote the file. `dialogue.mjs check` names a typed
  message with no entry (A-047); restore it word for word by piping it to
  `.claude/hooks/session/dialogue-record.mjs`, as `{session_id, prompt}` on stdin.

The Stop hook's "uncommitted changes" or "untracked files" during a merge is the cloud's own
check, not this repo's: the `.merge_file_*` files are the merge driver's, gone when it ends.

**Seen again the same day:** a quiet retry loop (`-q`, output to `/dev/null`) printed nothing
and pushed nothing, because a changed tracked file (the chat list, rewritten by a hook) made
`git merge` refuse to start. Run `git status --short` before the loop, commit what is there, and
let the merge's own error print.
