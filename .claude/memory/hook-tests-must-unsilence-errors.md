# A hook test must turn the hook library's silence off

**Seen 2026-10-30.** `.claude/hooks/lib/hook.mjs` installs `uncaughtException` and
`unhandledRejection` handlers that exit 0, so a broken hook never blocks a chat. A rule test
that imports anything from the hook library inherits them: a failing `assert` exits 0 with no
output, and the selftest counts it as passing. A new test (`test-turn-kind.mjs`) "passed" this
way, printing nothing, until the missing last line gave it away.

- **At the top of every rule test that imports from `.claude/hooks/lib/`**, after the imports:
  `process.removeAllListeners('uncaughtException'); process.removeAllListeners('unhandledRejection');`
  and a handler that prints the failure and exits 1.
- **A test that prints nothing has not run to its end.** End every test with one summary line
  and look for it.
- **Prove a new test can fail**: break the rule it guards, see it fail, put it back.

**A break that breaks nothing (seen 2026-11-05).** To prove a new test, a rule was "broken" with
`[] && […]`, which in JavaScript still returns the array, so the test passed and looked weak.
Before judging a test by a break, run the broken code on the incident's input and see its output
change; break the condition itself (`asks.length ?` to `false ?`), never wrap it.
