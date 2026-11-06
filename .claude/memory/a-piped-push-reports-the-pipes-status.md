# A piped push reports the pipe's status

**The trap.** A shell pipeline exits with its last command's status. A retry
loop written `git push -u origin main 2>&1 | tail -1 && break` breaks on the
first try whatever git did, because `tail` succeeded. The same holds for a
`git commit … | tail` that the commit gate refused.

**Seen.** In the chat of 2026-10-12 to 10-15: the loop reported the push done; the push had been
rejected, and the branch was found "ahead 1, behind 37" afterwards. A save that
only looks pushed is the failure CLAUDE.md names as the one she cannot see.

**Do instead.** Run `git push` and `git commit` unpiped and read their own exit
status (`git push origin main; echo "exit $?"`), or put `set -o pipefail; `
first, or read `${PIPESTATUS[0]}`. After any push, `git status -sb` should not
say "ahead".

A guard that refuses the piped form is drafted and waits on a spec row (dev
backlog, 2026-10-15): new machinery lands with the row that claims it
(`.claude/memory/new-machinery-lands-with-its-row.md`).
