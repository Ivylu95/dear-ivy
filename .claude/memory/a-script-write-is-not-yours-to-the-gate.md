# A file a script wrote is not "yours" to the commit gate

**Seen 2026-11-04.** Test files changed by a Python one-off were refused at commit with "this session
never touched these staged files", then, run again, with "a refused commit left these staged", in
turns. The gate's list of this session's files is filled by the Edit and Write tools (and a script's
output only after the command); when the unowned-files check passes on a retry it clears its note,
so the next failed check refuses the same files again.

- **Edit at least one line of each such file with the Edit tool**, or stage it in a command of its
  own, before the commit; then the gate knows it as yours.
- **Rerun the same commit** once after a "never touched" refusal you have checked; if it alternates,
  a check in between is failing: read the whole log, not its first line.
- **Checked means each path, not the count.** Seen 2026-11-06: a rename staged 140 files by script;
  among the refused list sat `data-sandbox/PROFILE.yaml`, staged by something else, and a later
  `git add -A dev/dialogue …` commit carried it, resetting another chat's test profile. Before a
  rerun, `git diff --cached --name-only` and unstage (`git restore --staged -- <path>`) every path
  your own change does not explain; commit by name (`git commit -- <paths>`) when the tree is shared.
- **Changing the message resets the cycle.** A new message (an Approved line fixed, a note added)
  is a new commit to the gate, so the "never touched" refusal comes once more: rerun it once more.
