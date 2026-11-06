// What waits on the developer stays one short, readable list (A-152, DEV-013,
// DEV-014): every item line in dev/for-you.md is a for-you line, so a to-do, an
// in-progress or a done line (the backlog's kinds, retired by A-152) fails, as
// does any line that would be skipped. A question waiting more than two weeks,
// or listed twice, is named. The review ledger (dev/session-reviews.md) is held
// to its format, and a review naming a commit this repository lacks fails, since
// it would never count; owed reviews warn (DEV-020). Also in the commit gate.
// The idea list (dev/ideas.md, A-125) is held to its format and to the
// Transcript the same way. A desk under dev/projects/ missing a file or a filled Goal, Status or Next
// action fails too (WKB-011).
//
//   node ux/scripts/check-for-you.mjs      (runs in `npm run check`)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
process.env.CLAUDE_PROJECT_DIR ||= repoRoot;
const { FOR_YOU, parseForYou, parseReviews, overdue, owedReviewsRead, commitExists, HistoryUnreadable } = await import(pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib', 'for-you.mjs')).href);

const problems = [];
// A copy without dev/ has no list to hold; with dev/, the list must be there.
if (existsSync(join(repoRoot, 'dev')) && !existsSync(FOR_YOU)) problems.push('dev/for-you.md is missing: what waits on the developer has nowhere to be shown (A-152)');
const { items, problems: itemProblems, warnings } = parseForYou();
problems.push(...itemProblems);
const { reviews, problems: reviewProblems } = parseReviews();
problems.push(...reviewProblems.map((p) => `dev/session-reviews.md: ${p}`));

// A review names the commit it was made at; one this repository lacks is a
// typo or an unpushed rewrite, and never counts. A cloud checkout is often
// shallow: an old commit is missing from the clone, not from the repository,
// and the cure is a fetch, not an edit (2026-10-01).
const shallow = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot, encoding: 'utf8' }).trim() === 'true';
  } catch {
    return false;
  }
})();
// History that could not be read fails the check by name: a review's commit
// unchecked is not a commit found.
for (const r of reviews) {
  let held;
  try {
    held = commitExists(r.commit);
  } catch (err) {
    if (!(err instanceof HistoryUnreadable)) throw err;
    problems.push(`history could not be read (${err.message}), so no review's commit was checked`);
    break;
  }
  if (held) continue;
  problems.push(shallow
    ? `a review names commit ${r.commit}, which this shallow clone does not hold; run \`git fetch --unshallow origin\` and check again (chat ${r.chat})`
    : `a review names commit ${r.commit}, which this repository does not hold (chat ${r.chat})`);
}
// WKB-011: a desk under dev/projects/ is what a fresh chat resumes from alone,
// so each holds its four files and a cover sheet naming the goal, the status
// and the next action; a desk missing any of them cannot be resumed.
const desksDir = join(repoRoot, 'dev', 'projects');
if (existsSync(desksDir)) {
  for (const e of readdirSync(desksDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'archive') continue;
    const desk = join(desksDir, e.name);
    for (const f of ['README.md', 'plan.md', 'decisions.md', 'log.md']) {
      if (!existsSync(join(desk, f))) problems.push(`desk dev/projects/${e.name} has no ${f} (WKB-011)`);
    }
    if (!existsSync(join(desk, 'README.md'))) continue;
    const cover = readFileSync(join(desk, 'README.md'), 'utf8');
    for (const label of ['Goal', 'Status', 'Next action']) {
      if (!new RegExp(`^\\*\\*${label}:\\*\\*\\s*\\S`, 'm').test(cover)) {
        problems.push(`desk dev/projects/${e.name} cover sheet has no filled "**${label}:**" line (WKB-011)`);
      }
    }
  }
}
// A-125, WKB-017: the idea list, every line in format, each from a remark the
// Transcript holds, none built, parked or dropped but on a remark he typed.
const { checkIdeas } = await import(pathToFileURL(join(repoRoot, '.claude', 'hooks', 'lib', 'ideas.mjs')).href);
const ideaList = existsSync(join(repoRoot, 'dev')) ? checkIdeas(repoRoot) : { problems: [], warnings: [] };
problems.push(...ideaList.problems.map((p) => `dev/ideas.md: ${p}`));
for (const w of ideaList.warnings) console.warn(`  ideas: ${w}`);
for (const w of warnings) console.warn(`  for-you: ${w}`);
const stale = overdue(items);
if (stale.length) console.warn(`  for-you: ${stale.length} of ${items.length} waiting on the developer over two weeks; the oldest: ${stale.sort((a, b) => a.opened.localeCompare(b.opened))[0].what.slice(0, 70)} (since ${stale[0].opened})`);
const { chats: owedChats, unreadable } = owedReviewsRead();
if (unreadable) console.warn(`  for-you: history could not be read (${unreadable}), so whether any chat owes its end-of-session review is not known (DEV-020)`);
for (const id of owedChats) {
  console.warn(`  for-you: chat ${id} changed the harness and its end-of-session review never ran, or ran before later work (DEV-020)`);
}
if (problems.length) {
  console.error(`\n  FOR-YOU CHECK FAILED\n\n${problems.map((p) => `  - ${p}`).join('\n')}\n\n  The format is in dev/for-you.md's own header (A-152).\n`);
  process.exit(1);
}
console.log(`for-you check: ${items.length} waiting on the developer, ${reviews.length} reviews recorded, every line in format`);
