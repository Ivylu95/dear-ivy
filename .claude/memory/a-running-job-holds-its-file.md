# A running heartbeat job holds its file

**Seen 2026-10-30.** The code-upkeep job was renamed to code-maintenance while
its run was going. The rename was pushed only to this chat's own branch, to
wait for the run to end, but another chat's session settle brought the branch
into main within minutes. The run landed its change and then could not record
its finish (`heartbeats.mjs finish code-upkeep`: no such file); its claim sat
as "running" until it was finished by hand.

**Do.** Before renaming or moving a job file, read its `status` on
origin/main. If it is `running`, keep the change as a local commit, never
pushed to any branch, until the status is not `running`. A pushed branch is as
good as on main.
