# Agents share one scratchpad

**Seen 2026-10-30.** Five backlog agents ran at once and two wrote their commit
messages to the same scratchpad file, msg1.txt; the coordinator then tried to commit
one agent's work under the other's message. The gate refused it for another
reason, so nothing wrong landed.

**Do.** In a brief for parallel agents, give each a name to put in every file
it writes to the shared scratchpad (msg-batch-1.txt), and give each its own
verdict file path. Read a hand-back's message file before committing with it.

**Seen again 2026-11-01.** Eval agents in parallel shared a message file name
and a commit went under another agent's message. The brief now names each
agent's own file (`<group>-msg.txt`); keep that line in every parallel brief.

**Seen a third time 2026-11-03.** A coordinator's shared brief for seven split agents did not name each one's message file; one agent's commit went in under another's message (`72c579f2`), and it was landed by squash under the right one. A prose note was not enough: **every parallel brief says, in its rules, "write your commit message to a scratchpad file with your own unique prefix"**, and a hand-back's commit subject is checked against its report before it is merged.
