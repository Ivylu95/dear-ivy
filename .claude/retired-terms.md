# Retired terms

Names, labels and paths the harness has stopped using. `ux/scripts/check-retired-terms.mjs`
fails when one turns up again anywhere in the harness, so a rename reaches every file
that named the old thing, not only the ones remembered. The retrospective skill's sync
step adds a line here for every term a session retires (`DEV-020`).

Rule tests (`test-*.mjs`) are exempt: they hold retired forms on purpose, to prove a
check refuses them. So is this file. So is a dated table row (`| YYYY-MM-DD | …`, the
hazard log's) dated before the term's retirement: it records that day as it was.

One line per term: `- <term> · replaced by <new> · <date>`

- open-items.md · replaced by dev-backlog.md · 2026-09-30
- open-items.mjs · replaced by dev-backlog.mjs · 2026-09-30
- check-open-items · replaced by check-dev-backlog · 2026-09-30
- 🗂️ Later · replaced by 🗂️ Still open · 2026-09-30
- Still open in this chat · replaced by Still open · 2026-09-30
- To end this chat · replaced by End chat · 2026-09-30
- What's next for you · replaced by What's next · 2026-09-30
- Current progress · replaced by Progress • · 2026-09-30
- review under Later · replaced by review under "End chat" · 2026-09-30
- **This turn:** · replaced by **What's next:** · 2026-09-30
- ## Where we are · replaced by no heading: the two status bullets follow the steps · 2026-09-30
- resetting this same chat with /clear · replaced by /compact, or a new chat · 2026-10-01
- Dev Mode · Plain · replaced by Dev Mode · View · 2026-10-01
- plain reply · replaced by view · 2026-10-01
- .claude/dev-backlog.md · replaced by dev/backlog.md · 2026-10-03
- .claude/hygiene-log.jsonl · replaced by dev/hygiene-log.jsonl · 2026-10-03
- dev/specs/skills · replaced by dev/skills · 2026-10-03
- <sub>🛠️ Dev Mode · replaced by 🛠️ **Dev Mode** (WKB-009) · 2026-10-03
- .claude/skills/update-harness · replaced by .claude/skills/set-up/update.md · 2026-10-10
- .claude/skills/import-data · replaced by .claude/skills/set-up/import.md · 2026-10-10
- .claude/skills/set-up/cases.md · replaced by dev/skills/set-up/cases.md · 2026-10-10
- .claude/skills/set-up/scenarios.md · replaced by dev/skills/set-up/scenarios.md · 2026-10-10
- three blocks · replaced by part by part, the seven parts of a row (README anatomy, PRD-001) · 2026-10-05
- See the specs as a graph · replaced by the Folders | Graph switch · 2026-10-06
- spec-graph-entry · replaced by the seg class (Segmented) · 2026-10-06
- specs-switch · replaced by the seg class (Segmented) · 2026-10-07
- view-switch · replaced by the seg class (Segmented) · 2026-10-07
- components/ui/ViewSwitch · replaced by components/ui/Segmented · 2026-10-07
- .claude/limits.json · replaced by .claude/thresholds.json (FND-009) · 2026-10-03
- scripts/limits.mjs · replaced by scripts/thresholds.mjs (FND-009) · 2026-10-03
- lib/limits.mjs · replaced by lib/thresholds.mjs (FND-009) · 2026-10-03
- `limit <key> = · replaced by `threshold <key> = (FND-009) · 2026-10-03
- check-work · replaced by the /dev-approve reviewer (check two) · 2026-10-03
- /sandbox off · replaced by /dev-mode sandbox (WKB-013) · 2026-10-03
- /sandbox reset · replaced by /dev-mode sandbox (WKB-013) · 2026-10-03
- /sandbox sample · replaced by /dev-mode sandbox (WKB-013) · 2026-10-03
- commands/sandbox.md · replaced by /dev-mode sandbox (WKB-013) · 2026-10-03
- review-ux · replaced by the /dev-approve reviewer and spec-audit on dev/specs/ux/ · 2026-10-03
- .claude/skills/project-desk · replaced by dev/skills/project-desk, routed from development mode (ARC-005) · 2026-10-03
- ux/lib/git.js · replaced by dev/ui/lib/git.js · 2026-10-03
- ux/components/harness/ · replaced by dev/ui/components/harness/ · 2026-10-03
- ux/components/changes/ · replaced by dev/ui/components/changes/ · 2026-10-03
- ux/components/workflow/ · replaced by dev/ui/components/workflow/ · 2026-10-03
- ux/lib/harness.js · replaced by dev/ui/lib/harness.js · 2026-10-03
- Dear · admin · replaced by the dashboard's own title (DES-007) · 2026-10-03
- .claude/skills/spec-manager/ · replaced by the Spec jobs and Dev skills router in dev/skills/README.md · 2026-10-05
- .claude/skills/release/ · replaced by dev/skills/release/, routed from Dev skills · 2026-10-05
- run-due.md · replaced by heartbeat.md, the orchestrator (HBT-009) · 2026-10-07
- .claude/prompts/heartbeats/ · replaced by .claude/jobs/ · 2026-10-08
- heartbeat.md · replaced by .claude/jobs/README.md, the orchestrator's prompt and the run's record · 2026-10-08
- jobs.json · replaced by each job's own frontmatter in .claude/jobs/ · 2026-10-08
- .claude/jobs/runs.md · replaced by the body of each run's finish commit, and dev/backlog.md for what is left · 2026-10-08
- set-up-from-scratch · replaced by set-up · 2026-10-09
- .claude/skills/harness-writer/ · replaced by dev/skills/harness-writer/ · 2026-10-10
- .claude/skills/skill-writer/ · replaced by dev/skills/skill-writer/ · 2026-10-10
- .claude/skills/retrospective/ · replaced by dev/skills/retrospective/ · 2026-10-10
- .claude/skills/safety-eval/ · replaced by dev/skills/safety-eval/ · 2026-10-10
- .claude/skills/sample-data-generator/ · replaced by dev/skills/sample-data-generator/ · 2026-10-10
- .claude/skills/git-reconcile/ · replaced by dev/skills/git-reconcile/ · 2026-10-10
- the-shared-tree-blocks-in-five-ways.md · replaced by the-shared-tree-blocks-in-six-ways.md · 2026-10-15
- check-up-trigger.mjs · replaced by heartbeat-trigger.mjs · 2026-10-17
- gate: checkup-hours · replaced by nothing: check-ups were removed · 2026-10-17
- checkup-workflows · replaced by heartbeat-workflows · 2026-10-17
- deploy/cloudflare/heartbeat-trigger.mjs · replaced by .claude/hooks/lib/reminder-schedule.mjs for the schedule engine; the Cloudflare Worker itself is retired, the hourly Claude routine sends (A-054) · 2026-10-26
- wrangler · replaced by nothing: no Cloudflare Worker is deployed (A-054) · 2026-10-26
- "send": "worker" · replaced by "send": "routine", the only sender (HBT-010 design 2) · 2026-10-26
- judgeWorker · replaced by nothing: the doctor has no worker part (A-054) · 2026-10-26
- .claude/jobs/safeguards.md · replaced by .claude/jobs/safeguard-check.md, the owner's name for it (T-452) · 2026-10-30
- .claude/jobs/code-upkeep.md · replaced by .claude/jobs/code-maintenance.md, the owner's name for it (T-454); its sources, grounding and snapshot files follow (code-maintenance-sources.md, code-maintenance-grounding.md, code-maintenance-snapshot.json) · 2026-10-30
- CARD_CAP · replaced by clashFaults and reviewDue: the Agreements are not capped (A-147, T-464) · 2026-10-29
- boundFaults · replaced by clashFaults (A-147) · 2026-10-29
- dev/backlog.md · replaced by dev/for-you.md, what waits on the developer and nothing else (A-152); reviews in dev/session-reviews.md · 2026-10-30
- dev-backlog.mjs · replaced by for-you.mjs (A-152) · 2026-10-30
- check-dev-backlog · replaced by check-for-you (A-152) · 2026-10-30
- **Other chats:** · replaced by **For you:**, the count of dev/for-you.md (A-152) · 2026-10-30
- dev/evals/history.jsonl · replaced by dev/evals/history/, one file a day and a busy day in parts (E-031, T-494) · 2026-10-31
- keeps no stub · replaced by a typed dev- entry in .claude/skills/ (ARC-005, T-479) · 2026-10-31
- archive-ledgers.mjs · replaced by dev/for-you.md and one eval history file a day, which leave nothing to archive (A-152) · 2026-10-31
- still answered here, and where it lives said once · replaced by answered briefly here, that chat named, with no question that carries it on (A-158, T-671) · 2026-11-03
- .claude/skills/dev-diagram · replaced by .claude/skills/see-it, whose developer route runs only in development mode · 2026-11-04
- `dev-diagram` · replaced by `see-it`, its developer route (developer.md), only in development mode · 2026-11-04
- dev/skills/diagram · replaced by .claude/skills/see-it (parts, template, scripts, logos) and dev/skills/see-it (tests and log) · 2026-11-04
- for-you · Pick up: · replaced by a question only; a task is done or dropped, never kept on the for-you list (A-178) · 2026-11-05
