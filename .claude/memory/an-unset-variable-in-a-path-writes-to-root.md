# An unset variable in a path writes to the machine's root

**Seen 2026-10-30.** A backup was written as `cp file "$CLAUDE_SCRATCH/ci.bak"`. The variable was
not set, so the copy went to `/ci.bak`, the next `cp` back read the wrong path, and the job file
under test was left broken until the stray copy was found. Deleting `/ci.bak` afterwards was
refused, rightly, as a removal at the root.

- **Write the scratchpad path out in full** (the one the session's environment names), never
  through a variable you have not just echoed.
- **Before a break-and-restore test, check the backup exists** (`ls` it) before breaking anything.
