// Whether a skill is due its re-check, asked the moment the skill is used.
//
// The owner's agreement A-015, "No heartbeats for keeping a skill up to date":
// a skill checks its own pages and steps only when it is used, keeps a note of
// when it last checked and whether it is due again, and when due, checks first,
// then does the job. Two trackers say so, both kept beside the skill:
//
//   log.md        its re-check (PMM-006): Next due, and anything that brought
//                 it forward since its Last run, as currency.mjs reads it
//   precursor.md  a smaller check of its own, where it has one, in
//                 dev/skills/<name>/: frontmatter `every: 30 days` and
//                 `last_run: YYYY-MM-DD`, the steps in its body
//
//   node .claude/hooks/lib/precursor.mjs <skill>   what is due, one line each
//
// It changes nothing; the skill-precursor hook reads it after a skill loads.

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { currentModel, forward, logs, practiceMoved } from './currency.mjs';
import { intervalMs } from './heartbeats.mjs';
import { SKILLS_DIR } from './paths.mjs';

const DAY = 86400e3;

/** A precursor file's { every, lastRun, path }, or null when the skill has none. */
export function readPrecursor(root, name) {
  const path = join(root, SKILLS_DIR, name, 'precursor.md');
  if (!existsSync(path)) return null;
  const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))?.[1] ?? '';
  const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(front)?.[1].trim() ?? null;
  return { path: `${SKILLS_DIR}/${name}/precursor.md`, every: field('every'), lastRun: field('last_run')?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null };
}

/**
 * { due, reasons: [{ what, why }] } for one skill. `today` is YYYY-MM-DD;
 * `opts.model` the session's model id, when the caller has it.
 */
export function skillDue(root, name, today = new Date().toISOString().slice(0, 10), opts = {}) {
  const reasons = [];
  const mine = logs(root).filter((e) => basename(dirname(e.what)) === name);
  const ctx = { model: currentModel(root, opts.model), practice: practiceMoved(root), skills: new Set([name]), today };
  for (const e of mine) {
    if (!e.due || e.due <= today) reasons.push({ what: e.what, why: e.due ? `re-check was due ${e.due}` : 'no re-check date recorded' });
    for (const f of forward(root, e, ctx)) reasons.push({ what: e.what, why: `brought forward, ${f.why}: ${f.detail}` });
  }
  const pre = readPrecursor(root, name);
  if (pre) {
    const every = intervalMs(pre.every);
    if (!pre.lastRun) reasons.push({ what: pre.path, why: 'never run' });
    else if (every && Date.parse(pre.lastRun) + every <= Date.parse(today) + DAY - 1) reasons.push({ what: pre.path, why: `last run ${pre.lastRun}, due every ${pre.every}` });
  }
  return { due: reasons.length > 0, reasons, precursor: pre };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const name = process.argv[2];
  if (!name) {
    console.log('usage: precursor.mjs <skill>');
    process.exit(1);
  }
  const { due, reasons } = skillDue(process.env.CLAUDE_PROJECT_DIR || process.cwd(), name);
  if (!due) console.log(`${name}: nothing due`);
  for (const r of reasons) console.log(`${name}: due · ${r.what} · ${r.why}`);
}
