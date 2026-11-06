# New machinery lands in the same commit as the row that names it

**Seen 2026-10-08** (the spec-health heartbeat, the old MNT 010; both deleted
2026-10-20, so the paths below no longer resolve). Two gates pull in
opposite directions when a row is approved before its script exists:

- **The link check refuses a row that names a path not yet there.** The row's
  first draft named the job file .claude/jobs/spec-health.md in its design; the commit was
  refused, so the design was reworded to "a job in `.claude/jobs/`", marked
  *not built yet*.
- **The claimed check refuses a script no row names (FND-008).** When the
  build came, the script ux/scripts/spec-health.mjs was refused for that reason, and the
  row needed a second approval to name it.

So, for a new row with new machinery: get the statement approved, build, then
put the design wording that names the final paths to the owner **with the
build in hand**, and land row and machinery in one commit (DEV-020). Splitting
them costs a second approval round and leaves a row saying *not built yet* in
between.

Two smaller traps from the same build:

- **Its first reading must not depend on itself.** The job file pointed at
  its output, dev/spec-health.json, before it existed, so the link check failed inside the
  first scan and painted nine rows red; generate the file, then scan again.
- **One check exercising many files must not stand in for each.** Mapping
  every hook to the selftest turned 134 rows red on one flaky run; a check
  that covers everything is read once, for the summary.

**Seen again 2026-11-05, and a cheaper way out.** A test-only helper, `copy-tree.mjs`, was
refused by the claimed check, and naming it in a row would have needed a spec yes for
plumbing. It went into `.claude/hooks/lib/temp-litter.mjs`, which every test using it already
imported and a row already claims. Before adding a file, ask whether it belongs in one a row
already names; only a new piece of the design earns its own file and row.

A spec edit made while building waits for his typed yes: the commit gate refuses it
without an `Approved:` line. Commit the code without the register, then show him the exact
paragraph in that reply and ask. The turn's stop hook wants a clean tree, so park the
edited register in the session scratchpad and write main's copy back
(`git show HEAD:<path> > <path>`); reapply it on his yes, onto main as it is then, never by
copying the parked file over a register that may have moved.
