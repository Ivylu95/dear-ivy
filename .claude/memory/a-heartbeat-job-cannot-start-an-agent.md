# A heartbeat job cannot start an agent

**What happened.** The code-maintenance job's prompt said "start a subagent with only
the diff… On 'no change', commit it". Every nightly run from 19 to 26 October
found cleanups, passed them through the behaviour lock, and landed none: each
run reported "this run had no way to start the second-agent reviewer", and the
backlog filled with the same finding four times before anyone looked.

**Why.** The orchestrator (`.claude/jobs/README.md`) gives each job to an agent
of its own, and an agent started that way cannot start agents of its own. A step
in a job prompt that needs a second agent therefore never runs, and nothing
reports it as a failure: the job finishes `ok`, having done nothing.

**Do instead.** Put any second-agent step where an agent can start one: the
orchestrator's reviewer, which already reads every job branch before it lands
(step 4). Code maintenance commits each lock-passing change, and the reviewer asks the
diff the breaking question (fixed 2026-10-26). A job may still try a subagent
first, but never depend on one.

**Tell.** A job that keeps reporting the same "could not" while finishing `ok`.

**Again, 2 Nov, with this note already here.** The privacy read was told to "give
each slice to its own reader agent"; its run read no slice and failed. The sweep now
starts the readers itself (`.claude/jobs/README.md` step 3). Since a note did not
stop it twice, `ux/scripts/check-job-agents.mjs` now refuses, at commit, any job
prompt sentence asking its agent to start, give work to or hand off to an agent,
unless that sentence says it cannot or that the orchestrator does it.
