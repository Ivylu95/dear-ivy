# The commit gate has no git history

**The trap.** `.claude/hooks/git/pre-commit` runs every check in a copy of the
staged tree (`git checkout-index` into a temp folder). That copy has **no
`.git`**, so anything a check asks git (a commit hash, an ancestor, a log, the
repository's root) fails there, while the same check passes when run by hand.

**Seen three times.** 2026-09-29: `commit-msg`, run by the selftest inside the gate,
crashed on `git rev-parse --show-toplevel`. 2026-10-01: the dev backlog check
reported every Done commit as unknown and refused the commit. In the chat of
2026-10-12 to 10-15, twice: `test-context-size.mjs` passed by hand and failed only in the gate,
because its throwaway folder had no history (a short "unreadable" REVIEWS OWED
line) while the gate's DEAR_GIT_ROOT gave the full owed list. The test now
builds its own history, so the long line shows wherever it runs.

**Do instead.** A test that runs a hook against a throwaway folder gives that
folder its own git history and sets DEAR_GIT_ROOT to it, so the hook reads the
same thing by hand and in the gate. Read history from `process.env.DEAR_GIT_ROOT || repoRoot`: the
gate sets `DEAR_GIT_ROOT` to the real repository (see `.claude/hooks/lib/for-you.mjs`
and `.claude/hooks/selftest.mjs`). After adding or changing a check that touches git, run
`node .claude/hooks/git/pre-commit` with the change staged, not only the check
itself.

**Seen again 2026-10-30.** A new test listed the repository's scripts with `git ls-files`;
it passed by hand and failed in the gate with "not a git repository". A test that needs the
repository's files walks the folder instead (skipping `node_modules`, `.git`, `data`,
`temp`), as `.claude/hooks/session/test-temp-litter.mjs` does.
