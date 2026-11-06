# A heartbeat on GitHub Actions has its own traps

The check-in runs from `.github/workflows/` (HBT-006 design 4, HBT-011) so a
copy needs no always-on computer. Five things a session reading
only the workflow files would get wrong again, all met on 2026-10-08/09.

**A secret can be set and empty.** `gh secret set NAME` with its hidden prompt
saved a blank in PowerShell when the paste did not land; `gh secret list` still
shows the name and a date. The runs then read it as empty. Set secrets with
`Get-Clipboard | gh secret set NAME -R <repo>`, and read whether it arrived
from the gate step's printed length (`check-in: a Claude token is set (N
characters)`), never from the list. The first diagnosis blamed the job-level
`${{ secrets.X != '' }}` expression; that expression was fine, the secret was
empty. The gate is a step now anyway, because it can print the length.

**The runner needs a global git name.** A claim commits, the repo's commit gate
runs on it, and the gate's claim test makes commits in scratch repositories,
which have no repo-level `user.name`. Without `git config --global` in the
workflow the claim is refused (`test-heartbeat-claim.mjs  11 failing`) and
nothing runs.

**Never print the model's output.** `show_full_output: true` on
claude-code-action put text from her record into a run log. Read a failure from
the workflow's own steps (the claim is a step for this reason) and from what
reached main. `.claude/hooks/lib/test-workflows-quiet.mjs` refuses the setting.

**The claim accepts only listed jobs.** A job GitHub starts stays in the `jobs:`
list of `.claude/jobs/README.md`, marked `runner: github` so BAXTER's due list
skips it (`orchestrated()` in `heartbeats.mjs`). Taking it off the list breaks
the claim instead.

**The crisis hold clears when a chat ends, not while it runs.** The session line
in `data/core/state/log.md` is written by the SessionEnd hook
(`.claude/hooks/session/session-log.mjs`). The check-in nudge waits on the last line, so
an ordinary conversation lifts the hold only once that chat has ended.

Also: GitHub picks up a new `schedule:` late, sometimes hours, and runs it late;
every run bills at least a minute, so an hourly wake is about 720 minutes a
month; and a release never carries `.github/`, so each copy gets its workflows
once, from a computer.
