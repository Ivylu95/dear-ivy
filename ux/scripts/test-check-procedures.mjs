// Rule test for check-procedures.mjs (PMM-015, PMM-017, PMM-018): a small tree
// built in a temporary folder, its own practice cache beside skills made to
// break each value, so a rule that stopped refusing, or began refusing where it
// may only warn, shows here first.
//
// Run from ux/: node scripts/test-check-procedures.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkProcedures, estimateTokens } from './check-procedures.mjs';
import { routing } from './check-procedures.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const cache = (rows, due = '2099-01-01') =>
  [`**Last grounded:** 2026-01-01 · **Next due:** ${due} · **Interval:** 3 months`, '', '| Key | Value | Enforce | Source |', '|---|---|---|---|', ...rows].join('\n') + '\n';
const skill = (name, description, body = 'Do the thing.\n') => `---\nname: ${name}\ndescription: ${description}\n---\n${body}`;

// The earlier cases test the practice values alone, so the standard's own
// refusals (goal, audience, reads, grounding log) are set aside there.
const limits = (root, opts) => {
  const r = checkProcedures(root, opts);
  return { ...r, refused: r.refused.filter((x) => !x.endsWith('(standard)')) };
};

const roots = [];
const tree = (files) => {
  const root = makeTemp('dear-procedures-');
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
};

try {
  const long = 'x'.repeat(40);
  const ok = tree({
    '.claude/skills/practice.md': cache(['| description.maxChars | 30 | refuse | [BP] "Maximum" |']),
    '.claude/skills/short/SKILL.md': skill('short', 'Short enough.'),
  });
  check('a skill within every limit passes', limits(ok).refused.length === 0);

  const over = tree({
    '.claude/skills/practice.md': cache(['| description.maxChars | 30 | refuse | [BP] "Maximum" |']),
    '.claude/skills/wordy/SKILL.md': skill('wordy', long),
  });
  check('a description over a sourced refuse value refuses', limits(over).refused.some((r) => r.includes('wordy')));

  const warnOnly = tree({
    '.claude/skills/practice.md': cache(['| description.maxChars | 30 | warn | [BP] "Maximum" |', '| main.maxLines | 1 | warn | [BP] "under" |']),
    '.claude/skills/wordy/SKILL.md': skill('wordy', long, 'one\ntwo\nthree\n'),
  });
  const w = limits(warnOnly);
  check('a warn-only value never refuses', w.refused.length === 0 && w.warned.length === 2);

  const unsourced = tree({
    '.claude/skills/practice.md': cache(['| log.maxLines | 2 | refuse | no source for skills |', '| description.maxChars | 30 | refuse | no source |']),
    '.claude/skills/wordy/SKILL.md': skill('wordy', long),
    '.claude/skills/wordy/log.md': 'a\nb\nc\nd\n',
  });
  const u = limits(unsourced);
  check('an unsourced value never refuses, even marked refuse (PMM-018)', u.refused.length === 0 && u.warned.filter((x) => x.includes('unsourced')).length === 2);

  const deep = tree({
    '.claude/skills/practice.md': cache(['| reference.maxDepth | 1 | refuse | [BP] "one level deep" |']),
    '.claude/skills/router/SKILL.md': skill('router', 'Routes.', 'Read [a](a.md) or [b](b.md).\n'),
    '.claude/skills/router/a.md': 'See [b](b.md) and then [c](c.md).\n',
    '.claude/skills/router/b.md': 'B.\n',
    '.claude/skills/router/c.md': 'C.\n',
  });
  const d = limits(deep).refused;
  check('a reference sending on to one SKILL.md does not name refuses', d.length === 1 && d[0].includes('c.md'));

  // Routing (PMM-015): a reference nothing links to is a part no situation leads to.
  const orphan = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/split/SKILL.md': skill('split', 'Splits.', 'Read [a](a.md) when asked for A.\n'),
    '.claude/skills/split/a.md': 'A.\n',
    '.claude/skills/split/b.md': 'B, which no situation leads to.\n',
    '.claude/skills/split/log.md': 'grounded\n',
  });
  const o = limits(orphan).refused;
  check('a reference no situation leads to refuses, a linked one and a log do not (PMM-015)', o.length === 1 && o[0].includes('split/b.md') && o[0].includes('PMM-015'));
  check('a reference reached only through another reference is the depth rule\'s, not counted unrouted twice', limits(deep).refused.length === 1);

  // Routing and split tested together (PMM-015): a part the router leads to must
  // say when to read it, near its top, or the router leads to a file that cannot
  // tell the reader whether it is the right one.
  const mute = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/split/SKILL.md': skill('split', 'Splits.', 'Read [a](a.md) when asked for A, or [b](b.md) for B.\n'),
    '.claude/skills/split/a.md': '# A\n\n**Read when** asked for A.\n',
    '.claude/skills/split/b.md': '# B\n\nB steps, with no word on when they apply.\n',
  });
  const bareRun = limits(mute).refused.length === 0;
  routing.whenToRead = true;
  const m = limits(mute).refused;
  routing.whenToRead = false;
  check('the when-to-read rule is the gate\'s to switch on, and off in a bare call', bareRun);
  check('a part the router leads to with no "read when" near its top refuses, one with it does not (PMM-015)', m.length === 1 && m[0].includes('split/b.md') && m[0].includes('PMM-015') && m[0].includes('when to read'));

  // One goal (PMM-002): a goal written as two sentences is two goals under one name.
  const twoGoals = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/one/SKILL.md': skill('one', 'One.', '**Goal:** She is heard, and it is kept.\n\n**Audience:** her.\n\n**Reads:** now.\n'),
    '.claude/skills/two/SKILL.md': skill('two', 'Two.', '**Goal:** She is heard.\nSeparately, the harness is tidied.\n\n**Audience:** her.\n\n**Reads:** now.\n'),
    'dev/skills/one/log.md': 'g\n',
    'dev/skills/two/log.md': 'g\n',
  });
  const tg = checkProcedures(twoGoals).refused;
  check('a goal of two sentences refuses, naming PMM-002; one sentence does not', tg.length === 1 && tg[0].includes('two/SKILL.md') && tg[0].includes('PMM-002') && tg[0].includes('one goal'));

  // Names what it reads (PMM-012): a **Reads:** line with nothing after it names nothing.
  const emptyReads = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/named/SKILL.md': skill('named', 'Named.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:** now.\n'),
    '.claude/skills/blank/SKILL.md': skill('blank', 'Blank.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:**\n\nThen act.\n'),
    '.claude/skills/heading/SKILL.md': skill('heading', 'Heading.', '**Goal:** one.\n\n**Audience:** her.\n\n## Reads\n\n- now.md\n'),
    'dev/skills/named/log.md': 'g\n',
    'dev/skills/blank/log.md': 'g\n',
    'dev/skills/heading/log.md': 'g\n',
  });
  const er = checkProcedures(emptyReads).refused;
  check('a **Reads:** line that names nothing refuses, naming PMM-012; one that names something, or a Reads heading with a list, does not', er.length === 1 && er[0].includes('blank/SKILL.md') && er[0].includes('PMM-012'));

  // Finished items archived (PMM-012): a state file carries only open work.
  const finished = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/open/SKILL.md': skill('open', 'Open.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:** log.md\n'),
    '.claude/skills/open/log.md': '- [ ] still to do\n',
    '.claude/skills/done/SKILL.md': skill('done', 'Done.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:** log.md\n'),
    '.claude/skills/done/log.md': '- [ ] still to do\n- [x] finished long ago\n',
    'dev/skills/open/log.md': 'g\n',
    'dev/skills/done/log.md': 'g\n',
  });
  const fin = checkProcedures(finished).refused;
  check('a state file still carrying a finished item refuses, naming PMM-012; one with open items only does not', fin.length === 1 && fin[0].includes('done/log.md') && fin[0].includes('PMM-012') && fin[0].includes('archive'));

  const missing = tree({ '.claude/skills/x/SKILL.md': skill('x', 'X.') });
  let error = '';
  try {
    checkProcedures(missing);
  } catch (e) {
    error = e.message;
  }
  check('a missing cache is a clear error naming the file', error.includes('.claude/skills/practice.md'));

  const due = tree({
    '.claude/skills/practice.md': cache(['| description.maxChars | 30 | refuse | [BP] "Maximum" |'], '2026-01-01'),
    '.claude/skills/short/SKILL.md': skill('short', 'Short.'),
  });
  const r = limits(due, { today: '2026-10-15' });
  check('a passed due date warns, and refuses nothing (PMM-017)', r.refused.length === 0 && r.warned.some((x) => x.includes('re-grounding (PMM-017)')));

  const std = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/full/SKILL.md': skill('full', 'Full.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:** now.\n'),
    'dev/skills/full/log.md': 'grounded\n',
    '.claude/skills/bare/SKILL.md': skill('bare', 'Bare.'),
  });
  const sr = checkProcedures(std);
  const s = sr.standard;
  check('the standard line counts goal, audience, reads and grounding log', s.skills === 2 && s.goal === 1 && s.audience === 1 && s.reads === 1 && s.log === 1);
  const bare = sr.refused.filter((x) => x.includes('bare'));
  check('a skill missing its goal, audience, reads or grounding log refuses, each named', bare.length === 4 && ['PMM-002', 'PMM-009', 'PMM-012', 'PMM-005'].every((id) => bare.some((x) => x.includes(id))));
  check('a skill meeting the standard is not refused for it', !sr.refused.some((x) => x.includes('full')));

  const herCopy = tree({
    '.claude/skills/practice.md': cache([]),
    '.claude/skills/hers/SKILL.md': skill('hers', 'Hers.', '**Goal:** one.\n\n**Audience:** her.\n\n**Reads:** now.\n'),
  });
  check('in a copy with no dev/ folder the grounding log is not asked for (DEP-017)', checkProcedures(herCopy).refused.length === 0);

  // The token estimate errs high: set-up's SKILL.md measured 6,365 tokens at
  // 17,817 characters (2.80 a token); chars/4 called it 4,454 and let it pass.
  check('the token estimate is never below a measured count (2.80 chars a token)', estimateTokens('x'.repeat(17817)) >= 6365 && estimateTokens('x'.repeat(2552)) >= 835);
  const heavy = tree({
    '.claude/skills/practice.md': cache(['| main.maxTokens | 5000 | warn | [OV] "Under 5k tokens" |']),
    // 15,000 characters: ~3,750 by chars/4, over 5,000 by any measured rate.
    '.claude/skills/heavy/SKILL.md': skill('heavy', 'Heavy.', `${'word '.repeat(3000)}\n`),
  });
  check('a body chars/4 would pass but measured counts put over main.maxTokens warns', limits(heavy).warned.some((x) => x.includes('heavy') && x.includes('main.maxTokens')));

  // The listing budget (T-330 edge cases, 2026-10-28): the cache said warn and the check only reported,
  // counting dev/ bodies and commands the model never lists.
  const budget = '| listing.budgetFraction | 0.01 | warn | [CC] "scales at 1% of the context window" |';
  const wide = 'x'.repeat(3000);
  const listed = tree({ '.claude/skills/practice.md': cache([budget]), '.claude/skills/a/SKILL.md': skill('a', wide), '.claude/skills/b/SKILL.md': skill('b', wide) });
  check('listed descriptions over the listing budget warn', limits(listed, { contextTokens: 200000 }).warned.some((x) => x.includes('listing.budgetFraction')));
  const unlisted = tree({
    '.claude/skills/practice.md': cache([budget]),
    '.claude/skills/a/SKILL.md': skill('a', wide),
    'dev/skills/b/SKILL.md': skill('b', wide),
    '.claude/commands/c.md': `---\nname: c\ndescription: ${wide}\ndisable-model-invocation: true\n---\nDo.\n`,
  });
  check('a dev/ body and a command the model may not start do not count against the listing budget', !limits(unlisted, { contextTokens: 200000 }).warned.some((x) => x.includes('listing.budgetFraction')));

  // A dev- pointer (ARC-005, T-479) in a copy made for someone else, which has no dev/:
  // it only says the skill is the developer's, so it is not a procedure to measure
  // (first commit test, 2026-10-30). With dev/ there and its body missing, it still is.
  const pointer = skill('dev-x', 'Development mode only.', 'In a copy without dev/, say it is the developer\'s and stop.\n');
  const noDev = tree({ '.claude/skills/practice.md': cache([]), '.claude/skills/dev-x/SKILL.md': pointer });
  check('a dev- pointer in a copy without dev/ is not measured', !checkProcedures(noDev).refused.some((x) => x.includes('dev-x')));
  const lost = tree({ '.claude/skills/practice.md': cache([]), '.claude/skills/dev-x/SKILL.md': pointer, 'dev/skills/other/SKILL.md': skill('other', 'Other.', '**Goal:** one.\n\n**Audience:** dev.\n\n**Reads:** now.\n') });
  check('a dev- pointer whose body is missing from dev/ is still measured, and refused', checkProcedures(lost).refused.some((x) => x.includes('dev-x') && x.includes('Goal')));
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
