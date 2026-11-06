# An agent's commit to the harness may be held as self-modification

**Seen 2026-10-07.** In auto mode, the permission classifier refused two
commits that changed `.claude/hooks/git/commit-msg` and a skill, as
"Self-Modification". The developer's yes in the chat ("Do it as u
recommend") did not clear it: the second try was refused the same way. Other
commits that night touching hooks and prompts went through, so it is not
predictable from the paths.

**Do instead.**
- Never work around it: no retry with other quoting, no split commit, no
  subagent, no script that commits. The denial covers the outcome.
- Keep the work where it is: a worktree on a named branch, uncommitted, with
  the commit message saved inside it (`temp/` there is ignored).
- Write one line to `dev/for-you.md` (A-152), asking him to run the exact
  PowerShell: link the packages, regenerate anything generated, `git add` the
  named files, `git commit -F` the saved message. Push the list.
- When the developer has committed, land it as usual (merge main in, push),
  then clean up and remove the line: git history keeps it.

A chat's yes is not a permission rule. Only the developer's own settings, or
their own hands at the keyboard, clear it; never edit their permission
settings for them.

**Seen again 2026-10-16 to 17, and worse in the working tree.** An edit to
`.claude/hooks/git/pre-commit` was refused halfway, after "unlock safety core"
and "Allow editing the commit gate" in the chat. The half-edited gate stayed in
the working tree, and git runs the hook from the working tree, not from the
commit: it called a helper with the wrong arguments, so **every** commit on
that machine crashed, record saves included.

- A held edit to a hook in `.claude/hooks/git/` never stays in the working
  tree: `git stash push -m "<what, and why held>" -- <its files>` at once,
  which puts the committed gate back. Write the plan into `dev/for-you.md`
  as a question for him (a stash dies with the machine) and push that. Unstage everything else
  first: a pathspec stash taken while other files were staged carried those
  too, and its pop on 2026-10-17 clashed in five files that main had moved on.
- Asking the developer to switch to Accept edits mode is the way through; a
  typed unlock alone did not clear it either time.
- **Safety-core work stays in the main session.** A subagent briefed to edit the
  core under the developer's unlock was refused by auto mode outright
  (2026-10-16), and rightly: the unlock is the developer's word to this session,
  not something to pass on. Make core edits yourself, here, one visible step at
  a time; give agents the work around the core (tests, specs, evals).
