// Rule test for check-links.mjs (SFG-007 design 5): a small repository built in
// a temporary folder, each kind of dangling pointer planted beside one the
// check must leave alone. The incident (2026-10-09 audit): the check walked the
// repository it sat in and could not be tested at all, so a rule that stopped
// catching would have gone on passing.
//
// Run from ux/: node scripts/test-check-links.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findBrokenLinks } from './check-links.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const BASE = {
  'CLAUDE.md': '# Rules\n',
  'AGENTS.md': 'Read [CLAUDE.md](CLAUDE.md).\n',
  'docs/a.md': '# A\n',
  'dev/specs/system/one.md': '## **ABC-001 • 🔐📁🧳**\n\nA row.\n',
};
const tree = (files, base = BASE) => {
  const root = makeTemp('dear-links-');
  for (const [rel, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
};
const from = (findings, file) => findings.filter((f) => f.from === file).map((f) => f.what);

const roots = [];
try {
  const clean = tree({
    'README.md': 'See [a](docs/a.md), `docs/a.md`, ABC-001, and `now.md`, a name in prose.\n',
  });
  roots.push(clean);
  const ok = findBrokenLinks(clean);
  check('a clean tree passes', ok.findings.length === 0);
  check('rows are read from the specs', ok.defined === 1);

  // T-768: a link to a card's anchor on a page that names its anchors must land on one.
  const anchored = tree({
    'agreements.md': '<a id="a-001"></a>[A-001](agreements/1-group.md#a-001)\n',
    'agreements/1-group.md': '<a id="a-001"></a>\n\n> a card\n',
    'README.md': 'See [A-001](agreements.md#a-001), [its page](agreements/1-group.md#a-001), [a heading](docs/a.md#a), and [A-099](agreements.md#a-099).\n',
  });
  roots.push(anchored);
  const anchorHits = from(findBrokenLinks(anchored).findings, 'README.md');
  check('a link to an anchor the page has passes, and one into a page naming none is not read', anchorHits.length === 1);
  check('a link to a card anchor the page does not have is found', anchorHits.some((w) => w.includes('agreements.md#a-099')));

  const broken = tree({
    'README.md': [
      'A link to [gone](docs/gone.md), and `docs/missing.md` in backticks.',
      'A bare link [now](now.md) is a pointer; a bare `now.md` in prose is a name.',
      'Cites ABC-099, which no row defines, and XYZ-001, from no family here.',
      'A route `/safety` and a shape `data/core/people/<name>.md` are not paths.',
    ].join('\n'),
    'dev/notes.md': 'Points at `data/core/people/someone.md`.\n',
    'data/archive/old.md': 'Sealed: [then](no/longer/here.md).\n',
    '.claude/worktrees/agent-1/README.md': '[x](nowhere.md)\n',
  });
  roots.push(broken);
  const { findings } = findBrokenLinks(broken);
  const readme = from(findings, 'README.md');
  check('a markdown link to nothing is found', readme.some((w) => w.includes('docs/gone.md')));
  check('a backticked path to nothing is found', readme.some((w) => w.includes('docs/missing.md')));
  check('a bare name is a pointer in a link, a name in prose', readme.filter((w) => w.includes('now.md')).length === 1);
  check('a row ID no spec defines is found', readme.some((w) => w.includes('ABC-099')));
  check('an ID past the last row names how a draft is written', readme.some((w) => w.includes('ABC-099') && w.includes('"new ABC (99)"')));
  check("another family's ID, a route and a shape are left alone", !readme.some((w) => /XYZ|safety|<name>/.test(w)));
  check('a missing person is reported without their name', from(findings, 'dev/notes.md').some((w) => w.includes('data/core/…') && !w.includes('someone')));
  check('the printed line is cut, the path as written kept for code only', findings.some((f) => f.from === 'dev/notes.md' && f.target === 'data/core/people/someone.md' && !f.what.includes('someone')));
  check('a sealed archive and an agent worktree are not read', !findings.some((f) => /archive|worktrees/.test(f.from)));

  const DIV = '| --- | --- |';
  const ledger = tree({
    'policies/SAFETY_POLICY.md': ['# Safety', '', '## Results', '', '| Date | x |', DIV, '| 2026-10-09 | `docs/gone-a.md` ABC-077 |', '',
      '## The hazard log', '', '| Date | x |', DIV, '| 2026-10-09 | `docs/gone-b.md` ABC-088 |', '| note | `docs/gone-c.md` |', '', '## After', '`docs/gone-d.md`', ''].join('\n'),
  });
  roots.push(ledger);
  const pol = from(findBrokenLinks(ledger).findings, 'policies/SAFETY_POLICY.md');
  check('a dated hazard-log row keeps the paths and numbers of its day', !pol.some((w) => w.includes('gone-b') || w.includes('ABC-088')));
  check('outside the dated hazard rows, the policy file is still checked', ['gone-a', 'ABC-077', 'gone-c', 'gone-d'].every((s) => pol.some((w) => w.includes(s))));

  const bare = tree({}, { 'README.md': '# Hi\n' });
  roots.push(bare);
  const stub = findBrokenLinks(bare).findings.map((f) => f.what);
  check('a missing CLAUDE.md and AGENTS.md stub are found (FND-010)', stub.some((w) => w.includes('no CLAUDE.md')) && stub.some((w) => w.includes('no AGENTS.md')));
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
