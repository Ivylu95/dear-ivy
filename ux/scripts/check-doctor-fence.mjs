#!/usr/bin/env node
// The doctor's fence (HBT-013, "The sweep mends its own machinery, never its
// fences"): the heartbeat-doctor job lands its fixes with no one approving them,
// so where it may reach is checked by machine. Run by the orchestrator's reviewer
// on every hb-heartbeat-doctor-… branch, and by the job itself before it replies.
//
//   node ux/scripts/check-doctor-fence.mjs <base> [<head>]   (head: HEAD)
//
// Inside the fence, and nothing else: the job prompts in .claude/jobs/ (never the
// orchestrator's README, the doctor's own prompt, or a file on the safety surface),
// .claude/hooks/lib/heartbeats.mjs, ux/scripts/reminders.mjs, ux/scripts/nudge.mjs
// and dev/run-report.mjs. No file inside it may be deleted or renamed. Never
// dev/for-you.md: a job passes a question for the developer in its reply, and
// only the orchestrator writes it there (A-152).

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { changesBetween, corePaths } from './check-only-strengthens.mjs';

export const MACHINERY = ['.claude/hooks/lib/heartbeats.mjs', 'ux/scripts/reminders.mjs', 'ux/scripts/nudge.mjs', 'dev/run-report.mjs'];
const OWN_RULES = ['.claude/jobs/README.md', '.claude/jobs/heartbeat-doctor.md'];

/** What a change set breaks of the fence. `changes`: { status, path }; `core`: the safety paths. */
export function outsideFence(changes, core) {
  const out = [];
  for (const { status, path: p } of changes) {
    const safety = core.some((k) => (k.endsWith('/') ? p.startsWith(k) : p === k));
    const job = /^\.claude\/jobs\/[\w-]+\.md$/.test(p) && !OWN_RULES.includes(p);
    if (safety) out.push(`${p}: safety is the developer's, never the doctor's`);
    else if (OWN_RULES.includes(p)) out.push(`${p}: the doctor never rewrites its own rules`);
    else if (!job && !MACHINERY.includes(p)) out.push(`${p}: outside the heartbeat machinery`);
    else if (/^[DR]/.test(status)) out.push(`${p}: ${status.startsWith('D') ? 'deleted' : 'renamed'}`);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) {
    console.error('usage: check-doctor-fence.mjs <base> [<head>]');
    process.exit(2);
  }
  const found = outsideFence(changesBetween(base, head), corePaths());
  const messages = execFileSync('git', ['log', '--format=%s', `${base}..${head}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const m of messages) if (/\b(SAF|SPL)-\d{3}\b/.test(m)) found.push(`"${m}": cites a safety row, which only the developer changes`);
  if (found.length) {
    console.error(`DOCTOR FENCE CHECK FAILED (HBT-013)\n\n  - ${found.join('\n  - ')}\n\n  Leave it for the developer: one plain question in your reply, which the orchestrator puts on dev/for-you.md, and "needs you" in the report.`);
    process.exit(1);
  }
  console.log('doctor fence check: the branch stays inside the heartbeat machinery');
}
