# The behaviour lock sees only what is printed

`ux/scripts/behaviour-snapshot.mjs` (HYG-006) compares what the app prints before
and after a change. Building and proving it on 18 to 26 October found six ways it
lies, each now handled, and one it cannot fix.

- **Run order is not behaviour.** The selftest and the rule tests run cases side
  by side; their lines arrive in any order, with a timing prefix on whichever
  comes first. Such probes are `unordered`: prefix off, lines sorted.
- **The clock is behaviour unless pinned.** The hooks print which jobs are due,
  so two recordings minutes apart differ by the hour. Every probe's process gets
  one pinned start (`@clock` in the snapshot), and `lock` reuses the baseline's.
  A baseline from an older script, without `@clock`, cannot be compared: record
  it again.
- **Some tests print differently run to run.** The changed side is recorded twice;
  a probe that differs between those two is noise, set aside and named.
- **A shared checkout moves under you.** Another chat's push fast-forwards the
  main checkout mid-recording, and the two sides are then two codebases. `@head`
  is compared and a moved HEAD refused. Run the lock in a checkout of its own.
- **Probes tidy `temp/`.** An empty folder under `temp/` can vanish mid-run;
  write snapshots to the system's temp folder, never `temp/`.
- **A bad test case proves nothing.** Upper-casing journal slugs "passed" because
  every sample slug is a date. Pick a test change the sample data can show.

**Two recordings must see one world (2 Nov).** The lock records once, then twice
more with the clock pinned to the first recording's instant, so anything a probe
compares against real time drifts. A hook test checked a file's real modified time
against `Date.now()` and failed under the pinned clock, so every change was refused,
an unchanged tree included. Measure from a stamp the test set itself, never from
`Date.now()` against the file system. And in a live chat the turn-end sync can pull
files in mid-recording: run the lock in a separate worktree there. Before trusting a
refusal, record and lock unchanged code once; it must pass.

**What it cannot fix.** A line can run under coverage while its effect is printed
nowhere: changing a returned string that no test or reader shows passes both the
lock and the watch. Only the second agent's reading catches that. More printed
probes widen the lock's reach; nothing else does.
