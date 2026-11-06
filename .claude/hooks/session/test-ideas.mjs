// Rule tests for lib/ideas.mjs, the idea list (A-125, WKB-017), against
// invented ideas: each is kept with whose it is, none leaves "open" but on a
// remark he typed, a 💡 what-if no idea comes from is caught, and the dev menu
// is handed the open ones, with what was found, once in each month. The last is
// read from the real reply-shape hook run in a scratch folder. Run by
// selftest.mjs, and by eval card E-105.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIdeas, ideaFaults, putBackDue, ideasMenu, checkIdeas, transcriptRemarks, IDEAS_ROOM } from '../lib/ideas.mjs';
import { repoRoot } from '../lib/hook.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const HAS_DEV = existsSync(join(repoRoot, 'dev'));

const line = (what, whose, from, status, found = 'nothing like it was said or agreed before', opened = '2026-11-02') =>
  `- idea · ${what} · ${whose} · from ${from} · ${status} · found: ${found} · opened ${opened}`;
const list = (lines, putBack = 'never') => `# Ideas\n\nPut back: ${putBack}\n\n${lines.join('\n')}\n`;

// An invented Transcript: T-1 his idea, T-2 a remark an agent's idea answered,
// T-3 his typed yes, T-4 an agent-written "yes" no typed line stands behind, T-5 a what-if.
const remarks = [
  { id: 'T-1', date: '2026-11-02', ways: ['💡 what-if'] },
  { id: 'T-2', date: '2026-11-02', ways: ['❓ question'] },
  { id: 'T-3', date: '2026-11-03', ways: ['🔨 ruling'] },
  { id: 'T-4', date: '2026-11-03', ways: ['🔨 ruling'] },
  { id: 'T-5', date: '2026-11-04', ways: ['❓ question', '💡 what-if'] },
  { id: 'T-0', date: '2026-10-01', ways: ['🔨 ruling'] },
];
const typed = new Set(['T-3']);
const faults = (lines, rs = remarks) => ideaFaults(parseIdeas(list(lines)).ideas, rs, typed);
const his = line('a weekly digest of what changed', 'his', 'T-1', 'open');
const mine = line('a dashboard tile for open ideas', "agent's", 'T-2', 'open');
const whatIf = line('a reply in voice', 'his', 'T-5', 'open');
const kept = parseIdeas(list([his, mine, whatIf]));

const cases = [
  ['reads every idea line with whose it is', kept.ideas.length === 3 && !kept.problems.length && kept.ideas[0].whose === 'his' && kept.ideas[1].whose === "agent's"],
  ['an idea is kept with the remark it came from, so it can be found again', kept.ideas[0].from === 'T-1' && kept.ideas[1].from === 'T-2'],
  ['refuses a line with no owner: an agent\'s idea cannot pass as his by leaving it out', parseIdeas(list(['- idea · a thing · from T-1 · open · found: x · opened 2026-11-02'])).problems.length === 1],
  ['refuses an owner other than his or an agent\'s', parseIdeas(list([line('a thing', 'ours', 'T-1', 'open')])).problems.length === 1],
  ['refuses "built" with no remark named', parseIdeas(list([line('a thing', 'his', 'T-1', 'built')])).problems.length === 1],
  ['a list with no Put back line is a problem', parseIdeas('# Ideas\n\n' + his).problems.length === 1],
  ['the same idea twice is a warning', parseIdeas(list([his, his])).warnings.length === 1],
  ['a list kept right has no faults', faults([his, mine, whatIf]).length === 0],
  ['an idea from a remark the Transcript lacks is a fault: it could not be found again', faults([line('lost', 'his', 'T-99', 'open'), mine, whatIf]).some((f) => /T-99/.test(f))],
  ['built on his typed yes passes', faults([line('a weekly digest', 'his', 'T-1', 'built T-3'), mine, whatIf]).length === 0],
  ['built on a remark he did not type is refused: never built without his yes', faults([line('a weekly digest', 'his', 'T-1', 'built T-4'), mine, whatIf]).some((f) => /not a message he typed/.test(f))],
  ['built on a remark the Transcript lacks is refused', faults([line('a weekly digest', 'his', 'T-1', 'built T-98'), mine, whatIf]).some((f) => /T-98/.test(f))],
  ['built on a yes said before the idea is refused', faults([line('a weekly digest', 'his', 'T-1', 'built T-0'), mine, whatIf]).some((f) => /before the idea/.test(f))],
  ['parked or dropped also needs his typed word', faults([line('a', 'his', 'T-1', 'dropped T-4'), line('b', "agent's", 'T-2', 'parked T-4'), whatIf]).length === 2],
  ['an idea with nothing found about it is a fault', faults([line('a', 'his', 'T-1', 'open', 'none'), mine, whatIf]).some((f) => /nothing of what was found/.test(f))],
  ['a 💡 what-if no idea comes from is a fault: an idea he gave is not lost', faults([his, mine]).some((f) => /T-5/.test(f))],
  ['a what-if before the list began is not asked for', ideaFaults([], [{ id: 'T-7', date: '2026-10-01', ways: ['💡 what-if'] }], typed).length === 0],
  ['due when open ideas wait and none were put back yet', putBackDue(kept, new Date('2026-11-05'))],
  ['not due again in the month they were put back', !putBackDue(parseIdeas(list([his], '2026-11-02')), new Date('2026-11-30'))],
  ['due again in the next month', putBackDue(parseIdeas(list([his], '2026-11-02')), new Date('2026-12-01'))],
  ['not due when nothing is open', !putBackDue(parseIdeas(list([line('a', 'his', 'T-1', 'built T-3')])), new Date('2026-12-01'))],
  ['the menu lines show each open idea, whose it is, and what was found', (() => {
    const m = ideasMenu(kept.ideas);
    return m.length === 4 && /yours/.test(m[1]) && /mine/.test(m[2]) && m.slice(1).every((l) => /found: /.test(l));
  })()],
  ['a long list stays inside its room, the rest named by count', (() => {
    const many = Array.from({ length: 40 }, (_, n) => line(`idea ${n}`, 'his', 'T-1', 'open'));
    const m = ideasMenu(parseIdeas(list(many)).ideas);
    const shown = m.length - 2;
    return m.join('\n').length <= IDEAS_ROOM && shown > 0 && new RegExp(`${40 - shown} more`).test(m.at(-1));
  })()],
  ['with almost no room, one short line still says the showing is due', (() => {
    const m = ideasMenu(kept.ideas, 300);
    return m.length === 1 && m[0].length <= 300 && /IDEAS \(A-125\)/.test(m[0]) && /ideas\.mjs open/.test(m[0]);
  })()],
  ['the menu shows nothing that is built, parked or dropped', ideasMenu(parseIdeas(list([line('a', 'his', 'T-1', 'built T-3')])).ideas).length === 0],
  // The real Transcript and list are the developer's (dev/), which a copy never has (ARC-008).
  ['reads the real Transcript\'s ways, Also lines included', !HAS_DEV || transcriptRemarks(repoRoot).some((r) => r.ways.length > 1)],
  ['the real list is kept right', !HAS_DEV || (() => {
    const r = checkIdeas(repoRoot);
    if (r.problems.length) console.error(r.problems.join('\n'));
    return !r.problems.length;
  })()],
];

// The reply-shape hook hands the menu the open ideas when they are due, and not after they were put back.
function hookContext(putBack) {
  const scratch = makeTemp('dear-ideas-');
  try {
    mkdirSync(join(scratch, 'dev'), { recursive: true });
    mkdirSync(join(scratch, '.claude', 'hooks', 'state'), { recursive: true });
    writeFileSync(join(scratch, 'dev', 'for-you.md'), '# For you\n');
    writeFileSync(join(scratch, 'dev', 'ideas.md'), list([his, mine], putBack));
    const { CLAUDE_CODE_SESSION_ID: _a, CLAUDE_CODE_REMOTE_SESSION_ID: _b, ...env } = process.env;
    const r = spawnSync(process.execPath, [join(repoRoot, '.claude', 'hooks', 'session', 'dev-reply-shape.mjs')], {
      cwd: scratch,
      encoding: 'utf8',
      env: { ...env, CLAUDE_PROJECT_DIR: scratch, DEAR_GIT_ROOT: scratch },
      input: JSON.stringify({ session_id: `ideas-${putBack}`, prompt: '/dev-mode', hook_event_name: 'UserPromptSubmit' }),
      timeout: 60_000,
    });
    try {
      return String(JSON.parse(r.stdout).hookSpecificOutput?.additionalContext ?? '');
    } catch {
      return '';
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
const due = hookContext('never');
const thisMonth = hookContext(new Date().toISOString().slice(0, 10));
cases.push(
  ['the dev menu is given every open idea when the month\'s showing is due', /IDEAS \(A-125\)/.test(due) && /weekly digest/.test(due) && /dashboard tile/.test(due)],
  ['the dev menu marks his as his and an agent\'s as the agent\'s', /weekly digest of what changed · yours/.test(due) && /dashboard tile for open ideas · mine/.test(due)],
  ['the dev menu is not given them again once put back this month', thisMonth.includes('MENU') && !/IDEAS \(A-125\)/.test(thisMonth)],
);

let failed = 0;
for (const [what, ok] of cases) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
