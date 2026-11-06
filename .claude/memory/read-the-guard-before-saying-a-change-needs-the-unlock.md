# Read the guard before saying a change needs the unlock

On 2026-10-28 and 29 a development chat told the developer three times that
the crisis section of `CLAUDE.md` needed his unlock phrase. It does not: the
owner took it out of the lock on 2026-09-27. What holds it is the hazard log
(a dated entry before the turn can end) and his yes to the exact words.

What is locked is the list at the top of
`.claude/hooks/safety/guard-safety-core.mjs`. Read it before naming what a
change needs; a wrong "needs your unlock" stalls work and teaches him a rule
that isn't there.
