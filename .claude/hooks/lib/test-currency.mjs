// Rule tests for lib/currency.mjs, against invented entries and an invented
// copy in a temporary folder, never the live logs or registers. Run by the hook
// self-test.
//
// oldestDue: the dev menu offers the oldest overdue register (MNT-008 design
// 3), because a count of 36 due, shown every session, got none reviewed
// (2026-10-07).
//
// Brought forward (PMM-006 clause 2, design 4): a re-check is due sooner when
// the model, the practice cache or a failure in use moves after a skill's last
// run; the procedure is only shown as due, never stopped; and recording the
// re-check, even one that changed nothing, clears it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { currency, currentModel, evalsHashes, normalModel, oldestDue, PRACTICE, summary, unlogged, UNPROVEN } from './currency.mjs';
import { CACHE } from '../../../ux/scripts/check-procedures.mjs';
import { testHashes } from '../../../ux/lib/skill-evals.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const reg = (what, last, overdue = true) => ({ kind: 'register', what, last, overdue });

check('nothing due offers nothing', oldestDue([reg('a.md', '2026-09-01', false)]) === null);
check('a never-reviewed register comes before a reviewed one', oldestDue([reg('a.md', '2026-01-01'), reg('b.md', null)]).what === 'b.md');
check('of the never reviewed, the first in index order', oldestDue([reg('a.md', null), reg('b.md', null)]).what === 'a.md');
check('of the reviewed, the earliest last review', oldestDue([reg('a.md', '2026-05-01'), reg('b.md', '2026-02-01')]).what === 'b.md');
check('a register not yet due is passed over', oldestDue([reg('a.md', '2025-01-01', false), reg('b.md', '2026-02-01')]).what === 'b.md');
check('a skill log is never offered as a register', oldestDue([{ kind: 'log', what: 'x/log.md', overdue: true }]) === null);

// ── brought forward ─────────────────────────────────────────────────────────

check('the practice path is the one check-procedures reads', PRACTICE === CACHE);
const t0 = { shouldFire: [{ q: 'a' }], shouldNotFire: [{ q: 'b' }], scenarios: [{ id: 'S1' }] };
check('the evals hash is the one skill-evals ties results to', JSON.stringify(evalsHashes(t0)) === JSON.stringify(testHashes(t0)));
check('a model id loses its context suffix and date stamp', normalModel('claude-opus-5-5[1m]') === 'claude-opus-5-5' && normalModel('claude-sonnet-5-5-20260901') === 'claude-sonnet-5-5');
check('an alias is not a model id', normalModel('opus') === null && normalModel('') === null);

const root = makeTemp('dear-currency-');
const put = (rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const log = (last, extra = '') => `# x log\n\n## Status\n\n| | |\n|---|---|\n| **Last run** | ${last} |\n| **Next due** | 2027-06-01 (6 months) |\n${extra}\n## Runs\n`;
const skill = (dir, name) => put(`${dir}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: x\n---\n`);
const TODAY = '2026-11-01';
const git = (...a) => execFileSync('git', a, { cwd: root, env: { ...process.env, GIT_COMMITTER_DATE: '2026-10-20T12:00:00Z', GIT_AUTHOR_DATE: '2026-10-20T12:00:00Z' }, stdio: 'ignore' });

try {
  put(PRACTICE, '# cache\n\n**Last grounded:** 2026-10-05 · **Next due:** 2027-01-05\n\n## Changes\n\n- 2026-10-05 · first\n- 2026-10-12 · a value tightened\n');
  // Each skill isolates one trigger; all are checked after the practice cache's last move unless the test is about it.
  for (const n of ['steady', 'model', 'nomodel', 'source', 'failrow', 'oldfail', 'cases', 'evalsfail', 'evalspass', 'stale', 'rechecked']) skill('.claude/skills', n);
  put('.claude/skills/steady/log.md', log('2026-10-15', '| **Model** | claude-opus-5-5 |\n'));
  put('.claude/skills/model/log.md', log('2026-10-15', '| **Model** | claude-sonnet-5-5 |\n'));
  put('.claude/skills/nomodel/log.md', log('2026-10-15'));
  put('.claude/skills/source/log.md', log('2026-10-10'));
  put('.claude/skills/failrow/log.md', log('2026-10-15', '| **Failed in use** | 2026-10-20 · a step skipped |\n'));
  put('.claude/skills/oldfail/log.md', log('2026-10-15', '| **Failed in use** | 2026-10-14 · a step skipped |\n'));
  put('.claude/skills/cases/log.md', log('2026-10-15'));
  put('dev/skills/cases/cases.md', '# cases\n\n## Open\n\n### 2026-10-18 · 3 · a gap met\n- **Status:** open\n\n## Fixed\n\n### 2026-10-25 · 4 · fixed one\n');
  put('dev/skills/oldfail/cases.md', '# cases\n\n## Open\n\n### 2026-10-01 · 2 · an older gap\n');
  const tests = { shouldFire: [{ q: 'a' }], shouldNotFire: [{ q: 'b' }], scenarios: [{ id: 'S1' }, { id: 'S2' }] };
  const h = evalsHashes(tests);
  const results = (pass, date = '2026-10-21', hs = h) => JSON.stringify({ firing: { date, right: 2, total: 2, hash: hs.firing }, scenarios: { date, hash: hs.scenarios, results: [{ id: 'S1', with: { pass: true } }, { id: 'S2', with: { pass } }] } });
  for (const n of ['evalsfail', 'evalspass', 'stale']) {
    put(`.claude/skills/${n}/log.md`, log('2026-10-15'));
    put(`dev/skills/${n}/evals.json`, JSON.stringify(tests));
  }
  put('dev/skills/evalsfail/evals-results.json', results(false));
  put('dev/skills/evalspass/evals-results.json', results(true));
  put('dev/skills/stale/evals-results.json', results(true, '2026-10-12', { firing: 'old', scenarios: 'old' }));
  put('.claude/skills/rechecked/log.md', log('2026-10-25', '| **Model** | claude-opus-5-5 |\n| **Failed in use** | 2026-10-20 · fixed at the re-check |\n'));
  put('dev/skills/rechecked/cases.md', '## Open\n\n### 2026-10-20 · 1 · a gap the re-check took up\n');
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'fixture');

  const all = currency(root, TODAY, { model: 'claude-opus-5-5[1m]' });
  const of = (n) => all.find((e) => e.what === `.claude/skills/${n}/log.md`);
  const why = (n) => of(n).forward.map((f) => f.why).join(',');
  check('nothing moved: not due before its date', !of('steady').overdue && why('steady') === '');
  check('model: a log checked under another model is due today', of('model').overdue && why('model') === 'model');
  check('model: a log with no Model row is unknown, never due on that count', !of('nomodel').overdue);
  check('model: an alias in place of a model id skips the trigger', !currency(root, TODAY, { model: 'sonnet' }).find((e) => e.what.includes('/model/')).overdue);
  check('model: the session id outranks settings', currentModel(root, 'claude-opus-5-5').from === 'the session');
  check('source: the practice cache changed after the last run', of('source').overdue && why('source') === 'source');
  check('failure: a Failed in use row after the last run', of('failrow').overdue && why('failrow') === 'failure');
  check('failure: one before the last run, and an older open case, are already taken up', !of('oldfail').overdue);
  check('failure: an open case after the last run; a fixed one is not counted', why('cases') === 'failure' && of('cases').forward.length === 1);
  check('failure: a recorded evals run that failed a scenario', why('evalsfail') === 'failure' && /S2/.test(of('evalsfail').forward[0].detail));
  check('failure: a recorded evals run that passed is not', !of('evalspass').overdue);
  check('failure: an evals result gone stale after the last run', why('stale') === 'failure' && /stale/.test(of('stale').forward[0].detail));
  // PMM-006 clauses 1 and 3: the interval alone makes a log due, with no trigger, and the notice still says it keeps running.
  const late = currency(root, '2027-07-01', { model: 'claude-opus-5-5' }).find((e) => e.what === '.claude/skills/steady/log.md');
  check('interval: a log past its next-due date is due with no trigger moved', late.overdue && late.forward.length === 0);
  check('interval: the notice for it says it keeps running as written', /steady/.test(summary(root, '2027-07-01', { model: 'claude-opus-5-5' }).join('\n')) && /keeps running as written/.test(summary(root, '2027-07-01', { model: 'claude-opus-5-5' }).join('\n')));
  check('a recorded re-check, even one that changed nothing, clears every trigger', !of('rechecked').overdue);
  check('a non-skill log is not held to the practice cache', (() => {
    put('modules/core/knowledge/log.md', log('2026-10-01'));
    return !currency(root, TODAY).find((e) => e.what === 'modules/core/knowledge/log.md').overdue;
  })());
  // SAF-017: the crisis-lines catalogue, flagged to the developer only, numbers invented.
  const lines = (due, rows) => `# Crisis lines\n\n**Interval:** 3 months · **Next due:** ${due}\n\n## Roles\n\n| Role | What it is for |\n|---|---|\n| first | x |\n\n## Testland\n\n| Role | Line | Number | Hours | Source | Read | Checked |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## No entry for her country\n\nx\n\n## Changes\n\n- 2026-10-01 · first\n`;
  const crisis = (day) => currency(root, day).find((e) => e.kind === 'crisis-lines');
  put('modules/core/knowledge/crisis-lines.md', lines('2026-12-20', ['| first | Test Line | 0000 0001 | 24 hours | its own page | full | 2026-09-20 |', '| emergency | Emergency | 000 | 24 hours | its own page | summary | 2026-09-20 |']));
  check('crisis lines: in date, and every line sourced and checked, nothing is said', !crisis(TODAY).overdue && !/crisis numbers/.test(summary(root, TODAY).join('\n')));
  check('crisis lines: past Next due, due to the developer, and the numbers keep showing', crisis('2026-12-21').overdue && /crisis numbers re-check due \(SAF-017\): due 2026-12-20[^\n]*keep showing to her as written/.test(summary(root, '2026-12-21').join('\n')));
  put('modules/core/knowledge/crisis-lines.md', lines('2027-06-01', ['| first | Test Line | 0000 0001 | 24 hours | its own page | full | 2026-07-01 |', '| text | Test Text | 0000 0002 | 24 hours |  | full | 2026-10-01 |', '| emergency | Emergency | 000 | 24 hours | its own page | summary |  |']));
  const flagged = summary(root, TODAY).join('\n');
  check('crisis lines: a line checked over three months ago is due before the Next due date', /Testland first: checked 2026-07-01/.test(flagged));
  check('crisis lines: a line with no source, or no checked date, is due now', /Testland text: no source/.test(flagged) && /Testland emergency: no checked date/.test(flagged));
  check('crisis lines: a copy without the catalogue has nothing to flag', (() => {
    rmSync(join(root, 'modules/core/knowledge/crisis-lines.md'));
    return !currency(root, TODAY).some((e) => e.kind === 'crisis-lines');
  })());

  const notice = summary(root, TODAY, { model: 'claude-opus-5-5' }).join('\n');
  check('the notice names each one with why, and says it keeps running', /model \(model\)/.test(notice) && /source \(source\)/.test(notice) && /failrow \(failure\)/.test(notice) && /keeps running as written/.test(notice));
  check('the notice leaves out what is not due', !/steady|evalspass|rechecked/.test(notice));
  check('past its date it says so alongside a trigger', summary(root, '2027-07-01', {}).join('\n').includes('source (due 2027-06-01, source)'));

  // PMM-011 design 2: the unproven skills are listed beside what is due.
  check('no unproven list, nothing said of it', !/unproven/.test(summary(root, TODAY).join('\n')));
  put(UNPROVEN, '# Unproven skills\n\n**Measured against:** x · **Unproven:** 3 of 5 · **Proven:** 2\n');
  check('an unproven list names its count beside what is due', /unproven \(PMM-011\): 3 of 5 skills/.test(summary(root, TODAY).join('\n')));
  put(UNPROVEN, '# Unproven skills\n\n**Measured against:** x · **Unproven:** 0 of 5 · **Proven:** 5\n');
  check('none unproven, nothing said', !/unproven \(PMM-011\)/.test(summary(root, TODAY).join('\n')));
  put('dev/skills/loopy/SKILL.md', '---\nname: loopy\n---\n');
  put('dev/skills/loopy/log.md', '# loopy log\n');
  put('.claude/skills/dev-loopy/SKILL.md', '---\nname: dev-loopy\n---\n');
  check('a dev- entry whose body keeps a log is not called unlogged (T-479)', !unlogged(root).includes('.claude/skills/dev-loopy'));
  put('.claude/skills/dev-orphan/SKILL.md', '---\nname: dev-orphan\n---\n');
  check('a dev- entry with no body and no log still is', unlogged(root).includes('.claude/skills/dev-orphan'));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
