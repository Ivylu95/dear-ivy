# A skill line can overrule CLAUDE.md without anyone seeing it

**Seen 2026-11-04.** E-055 failed for days: replies in a pattern conversation
read her motives for her. The cause was one line of `pattern-work`, "Ask what
it protects", which asks the very thing CLAUDE.md's *…name a pattern* rule
says never to do ("never read her motives for her (not what a habit was
protecting…)"). The skill loads after CLAUDE.md and is more specific, so the
model followed the skill. Fixed at its cause in a0409b3f.

**Why no check.** A machine check would have to know that "ask what it
protects" and "never read her motives" are the same act in other words. A
word list of CLAUDE.md's *never* lines matched against skills is either too
loose to trust or too narrow to have caught this one. So it stays a note.

**Do.**
- When a judged eval fails on a rule CLAUDE.md states, read the skill that
  was running for a line that says the opposite in other words, before tuning
  the eval, the prompt or the rule.
- Before landing a skill line that tells the agent what to ask or say, read
  the CLAUDE.md section on the same act (*When you're about to…*, the
  *Must hold regardless* column) and check the line does not ask for what a
  *never* there forbids.
