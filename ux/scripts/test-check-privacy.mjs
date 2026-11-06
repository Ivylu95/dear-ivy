// Rule test for check-privacy.mjs (SFG-007 design 5): a record and a harness
// built in a temporary folder, each leak the check exists to catch planted
// beside a clean twin. The names are the invented record's (data-sample/), so
// nothing here is hers. The incidents (2026-10-09 audit): the check walked the
// repository it sat in and could not be tested at all, and it skipped every
// folder named `data`, so the spec group dev/specs/data/ was never read.
//
// Run from ux/: node scripts/test-check-privacy.mjs

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkPrivacy } from './check-privacy.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const QUOTE = 'Walked the long way home along the canal and felt lighter by the bridge.';
const RECORD = {
  'data/PROFILE.yaml': 'mandatory:\n  name:\n    value: Person-J\n    status: answered\n',
  'data/core/people/person-b.md': '# Person-B\n\nA friend from the pottery class.\n',
  'data/core/journal/2026-01-02.md': `# A walk\n\n${QUOTE}\n`,
};
const tree = (files) => {
  const root = makeTemp('dear-privacy-');
  for (const [rel, text] of Object.entries({ ...RECORD, ...files })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
};
const has = (findings, file, what) => findings.some((f) => f.replace(/\\/g, '/').startsWith(file) && f.includes(what));

const roots = [];
try {
  const clean = tree({
    'README.md': '# Dear\n\nA private space to think out loud.\n',
    'modules/core/templates/blank-record/core/journal/entry.md': `# A walk\n\n${QUOTE}\n`,
    'FEEDBACK.md': '# Feedback\n\n## Entries\n\n- Rule: Check the record before asking about the past.\n  Why: She should never re-explain.\n',
  });
  roots.push(clean);
  const ok = checkPrivacy(clean);
  check('a clean tree passes, its template sharing a line with the record', ok && ok.findings.length === 0);
  // person-b.md guards "person-b" and its first part, "person", the way firstname-word.md guards the first name.
  check('the people and her own name are both on file', ok && ok.names === 3);

  const leaky = tree({
    '.claude/skills/x/SKILL.md': 'Ask how Person-B is doing.\n',
    '.claude/skills/x/evals.json': '{"prompts": ["Person-B rang me today"]}\n',
    'ux/app/page.jsx': '// Hello, Person-J\n',
    'dev/notes.md': `${QUOTE}\n`,
    'dev/specs/data/access.md': 'An example: Person-B rang.\n',
    'modules/core/templates/blank-record/core/people/x.md': 'Person-B\n',
    'temp/hb-job/.git': 'gitdir: elsewhere\n',
    'data-sandbox/core/me/about_me.md': '- Person-J, told in a test chat.\n',
    'temp/hb-job/data/core/journal/2026-01-02.md': `${QUOTE} Person-B\n`,
    'FEEDBACK.md': '# Feedback\n\n## Entries\n\n- Rule: Ask before 2026-01-02.\n  Why: Person-B said so.\n',
    // Every text type outside data/ is read (A-155, 2026-11-01): until then these were not.
    'dev/logs/run.jsonl': '{"turn": 1, "note": "Person-B rang"}\n',
    'ux/scripts/x.sh': '#!/bin/sh\n# ask Person-J first\n',
    'dev/notes.csv': `when,what\n${QUOTE}\n`,
    '.claude/hooks/git/post-x': '#!/usr/bin/env node\n// Person-B\n',
    '.env.example': 'NOTE=Person-J\n',
    '.env': 'NOTE=Person-J\n',
    'dev/blob': 'Person-B\0\u0001',
  });
  roots.push(leaky);
  const { findings } = checkPrivacy(leaky);
  check('a person on file named in a skill is found', has(findings, '.claude/skills/x/SKILL.md', '"person-b"'));
  check('a name in a procedure\'s test prompts is found (PRL-001)', has(findings, '.claude/skills/x/evals.json', '"person-b"'));
  check('her own name in code is found', has(findings, 'ux/app/page.jsx', '"person-j"'));
  check('a long line copied from the record is found', has(findings, 'dev/notes.md', 'repeats a line'));
  check('the incident: a name in dev/specs/data/ is found', has(findings, 'dev/specs/data/access.md', '"person-b"'));
  check('a template is held to the name rule', has(findings, 'modules/core/templates/blank-record/core/people/x.md', '"person-b"'));
  check('another checkout, with its record copy, is not read', !findings.some((f) => f.includes('hb-job')));
  check('FEEDBACK.md is held to its stricter tier', findings.some((f) => f.includes('FEEDBACK.md') && f.includes('date')));
  check('the sandbox is outside the record and held to the rule (A-155)', has(findings, 'data-sandbox/core/me/about_me.md', '"person-j"'));
  check('the record itself is never a finding', !findings.some((f) => f.replace(/\\/g, '/').startsWith('data/')));
  check('a name in a .jsonl log is found (A-155)', has(findings, 'dev/logs/run.jsonl', '"person-b"'));
  check('a name in a .sh script is found (A-155)', has(findings, 'ux/scripts/x.sh', '"person-j"'));
  check('a line of the record in a .csv is found, by path and line only (A-155)', findings.includes('dev/notes.csv:2 repeats a line verbatim from data/') && !findings.some((f) => f.includes(QUOTE)));
  check('a name in an extensionless git hook is found (A-155)', has(findings, '.claude/hooks/git/post-x', '"person-b"'));
  check('a name in .env.example is found, and .env itself is never read', has(findings, '.env.example', '"person-j"') && !findings.some((f) => /^\.env /.test(f)));
  check('an extensionless file holding a NUL byte is passed over as not text', !findings.some((f) => f.startsWith('dev/blob')));

  // Everyday words that are also names (ux/lib/everyday-names.json):
  // only the listed context passes; the same name anywhere else is still a leak.
  // The names are assembled at run time, so this file names no one
  // (test-example-names.mjs).
  const COLOUR = ['Ro', 'se'].join('');
  const HERB = ['Jo', 'hn'].join('');
  const FONT = ['Geor', 'gia'].join('');
  const withPerson = (name, files) => tree({ [`data/core/people/${name.toLowerCase()}.md`]: `# ${name}\n`, ...files });
  const findingsOf = (root) => (roots.push(root), checkPrivacy(root).findings);
  const named = (findings, file, name) => has(findings, file, `"${name.toLowerCase()}"`);

  const KEYWORD = ['Vio', 'let'].join('');
  let f = findingsOf(withPerson(KEYWORD, { 'ux/app/x.css': `.chip { color: ${KEYWORD.toLowerCase()}; }\n`, 'ux/app/y.jsx': `<b className="text-${KEYWORD.toLowerCase()}-600" />\n` }));
  check('a record holding the colour\'s name passes a CSS colour value and a utility class', !named(f, 'ux/app/x.css', KEYWORD) && !named(f, 'ux/app/y.jsx', KEYWORD));
  f = findingsOf(withPerson(COLOUR, { 'ux/app/y.jsx': `<b className="text-${COLOUR.toLowerCase()}-600 bg-${COLOUR.toLowerCase()}-50/50" />\n` }));
  check('a utility class of the other colour passes too', !named(f, 'ux/app/y.jsx', COLOUR));
  f = findingsOf(withPerson(COLOUR, { 'dev/notes.md': `Ask ${COLOUR} about it.\n` }));
  check('the same name in prose is still found', named(f, 'dev/notes.md', COLOUR));
  f = findingsOf(withPerson(KEYWORD, { 'ux/app/x.css': `.chip { color: ${KEYWORD.toLowerCase()}; } /* ask ${KEYWORD} about it */\n` }));
  check('the name beside its allowed context, in the same file, is still found', named(f, 'ux/app/x.css', KEYWORD));
  // C26 (round 2): the colour and class rules hold in the dashboard's code only, and
  // only with the value ending there; the second colour is no CSS keyword at all.
  f = findingsOf(withPerson(COLOUR, { 'dev/notes.md': `Her sister's favourite color: ${COLOUR}\n` }));
  check('"favourite color: <name>" in prose is found (C26)', named(f, 'dev/notes.md', COLOUR));
  // Since 2026-10-31 a name that is an everyday word counts only capitalised mid-sentence,
  // so the colour in lower case passes and the name as a name is still held.
  f = findingsOf(withPerson(COLOUR, { 'ux/app/x.css': `.chip { color: ${COLOUR.toLowerCase()}; }\n` }));
  check('the other colour in lower case, as a colour, passes (word-name rule)', !named(f, 'ux/app/x.css', COLOUR));
  f = findingsOf(withPerson(COLOUR, { 'ux/app/x.css': `/* ask ${COLOUR} about the chip */\n` }));
  check('the same word as a name mid-sentence, even in CSS, is found', named(f, 'ux/app/x.css', COLOUR));
  f = findingsOf(withPerson(KEYWORD, { 'dev/notes.md': `background: ${KEYWORD}\n` }));
  check('a style value in a notes file is found (C26)', named(f, 'dev/notes.md', KEYWORD));
  f = findingsOf(withPerson(KEYWORD, { 'ux/app/x.css': `.chip { color: ${KEYWORD}-ish; }\n` }));
  check('a value that does not end at the keyword is found (C26)', named(f, 'ux/app/x.css', KEYWORD));
  f = findingsOf(withPerson(COLOUR, { 'dev/notes.md': `Text-${COLOUR.toLowerCase()}-500 is how she spells her name\n` }));
  check('a utility class in prose, lower case, passes (word-name rule)', !named(f, 'dev/notes.md', COLOUR));

  f = findingsOf(withPerson(HERB, { '.claude/skills/x/SKILL.md': `Never advise on St ${HERB}'s wort with a prescription.\n` }));
  check('a record holding the herb\'s name passes the herb', !named(f, '.claude/skills/x/SKILL.md', HERB));
  f = findingsOf(withPerson(HERB, { '.claude/skills/x/SKILL.md': `${HERB} said the wort helped.\n` }));
  check('the same name as a person is still found', named(f, '.claude/skills/x/SKILL.md', HERB));

  f = findingsOf(withPerson(FONT, { 'ux/app/z.css': `body { font-family: ui-serif, ${FONT}, "Times New Roman", serif; }\n` }));
  check('a record holding the font\'s name passes a font stack', !named(f, 'ux/app/z.css', FONT));
  f = findingsOf(withPerson(FONT, { 'ux/app/z.css': `/* ${FONT} picked this */\n` }));
  check('the font\'s name in a comment about a person is still found', named(f, 'ux/app/z.css', FONT));

  const ATTR = ['Ar', 'ia'].join('');
  f = findingsOf(withPerson(ATTR, { 'ux/app/b.jsx': `<button ${ATTR.toLowerCase()}-label="Close" />\n` }));
  check('a record holding the attribute\'s name passes an aria-label attribute', !named(f, 'ux/app/b.jsx', ATTR));
  f = findingsOf(withPerson(ATTR, { 'ux/app/b.jsx': `// for ${ATTR}\n` }));
  check('the same name alone is still found', named(f, 'ux/app/b.jsx', ATTR));
  f = findingsOf(withPerson(ATTR, { 'ux/app/b.jsx': `<div ${ATTR.toLowerCase()}-labelledby="t" ${ATTR.toLowerCase()}-pressed="false" ${ATTR.toLowerCase()}-valuenow="1" />\n` }));
  check('every real attribute name passes (C26)', !named(f, 'ux/app/b.jsx', ATTR));
  f = findingsOf(withPerson(ATTR, { 'dev/notes.md': `Her daughter is ${ATTR.toLowerCase()}-mae.\n` }));
  check('a hyphenated name after it is found, not taken for an attribute (C26)', named(f, 'dev/notes.md', ATTR));
  f = findingsOf(withPerson(ATTR, { 'ux/app/b.jsx': `<b ${ATTR.toLowerCase()}-labelx="1" />\n` }));
  check('an attribute name with more letters after it is found (C26)', named(f, 'ux/app/b.jsx', ATTR));

  // The safety benchmark's personas pass only in its own table and the rows of its
  // results tables; a real person sharing a persona's name, named in prose there,
  // is still found (backlog, 2026-10-29). The name is read from the benchmark's
  // table at run time, so this file names no one. A copy without dev/ (a new copy made
  // for someone else, ARC-008) has no benchmark and so no persona to pass: the gate
  // there crashed reading the table (first commit test, 2026-10-30), so these are skipped.
  const PERSONAS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dev', 'skills', 'safety-eval', 'vera-mh', 'personas.tsv');
  if (!existsSync(PERSONAS)) console.log('skip the benchmark personas: no dev/ in this copy, so no persona to pass');
  else {
    const PERSONA = readFileSync(PERSONAS, 'utf8').split('\n')[1].split('\t')[0];
    f = findingsOf(withPerson(PERSONA, { 'policies/SAFETY_POLICY.md': `| 2026-01-02 | run | ${PERSONA} (None) | 100 |\n`, 'dev/skills/safety-eval/log.md': `| run | ${PERSONA} |\n` }));
    check('a persona in a results table row passes', !named(f, 'policies/SAFETY_POLICY.md', PERSONA) && !named(f, 'dev/skills/safety-eval/log.md', PERSONA));
    f = findingsOf(withPerson(PERSONA, { 'policies/SAFETY_POLICY.md': `Ask ${PERSONA} about the next run.\n` }));
    check('a persona\'s name in the policy\'s prose is still found', named(f, 'policies/SAFETY_POLICY.md', PERSONA));
    f = findingsOf(withPerson(PERSONA, { 'dev/skills/safety-eval/SKILL.md': `${PERSONA} said to rerun it.\n` }));
    check('a persona\'s name in the benchmark folder\'s prose is still found', named(f, 'dev/skills/safety-eval/SKILL.md', PERSONA));
    // The policy ships; the table does not. A copy without dev/ read no persona and held
    // the policy's own results rows for a person sharing one's name (first commit test,
    // 2026-10-30), so the rule names every persona the policy quotes, kept level here.
    const here = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const policy = readFileSync(join(here, 'policies', 'SAFETY_POLICY.md'), 'utf8').toLowerCase().split('\n').filter((l) => l.startsWith('|')).join('\n');
    const rule = JSON.parse(readFileSync(join(here, 'ux', 'lib', 'everyday-names.json'), 'utf8')).allowed.find((r) => (r.files ?? []).includes('policies/SAFETY_POLICY.md') && r.namesFrom);
    const quoted = readFileSync(PERSONAS, 'utf8').split('\n').slice(1).map((l) => l.split('\t')[0].trim().toLowerCase()).filter((n) => n && new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, 'u').test(policy));
    const hash = (w) => createHash('sha256').update(w.normalize('NFC').toLowerCase()).digest('hex').slice(0, 16);
    const missing = quoted.filter((n) => !(rule?.nameHashes ?? []).includes(hash(n)));
    check(`every persona the shipped policy quotes is held in its rule, for a copy without dev/ (${missing.length} missing)`, quoted.length > 0 && missing.length === 0);
    const { withoutEverydayNames: hide, EVERYDAY_NAMES } = await import('../lib/everyday-names.mjs');
    const shippedRules = EVERYDAY_NAMES.map((r) => ({ ...r, names: new Set(r.files?.includes('policies/SAFETY_POLICY.md') ? [] : r.names) }));
    const row = `| 2026-01-02 | run | ${PERSONA} (None) | 100 |`;
    check('with no table to read, a quoted persona in a policy row still passes', !hide(row, PERSONA.toLowerCase(), 'policies/SAFETY_POLICY.md', shippedRules).includes(PERSONA));
    check('and in its prose is still held', hide(`Ask ${PERSONA} about it.`, PERSONA.toLowerCase(), 'policies/SAFETY_POLICY.md', shippedRules).includes(PERSONA));
  }

  // T-330: a page named firstname-word.md guarded only the whole slug, so the first name alone
  // passed anywhere. Made-up name, assembled so this file names no one.
  const FIRST = ['Mari', 'sol'].join('');
  f = findingsOf(tree({ [`data/core/people/${FIRST.toLowerCase()}-work.md`]: `# ${FIRST}\n`, 'dev/notes.md': `Ask ${FIRST} about the rota.\n`, 'dev/other.md': `${FIRST.toLowerCase()}-work rang.\n` }));
  check('a page named firstname-word.md guards the first name alone', named(f, 'dev/notes.md', FIRST));
  check('and the whole file name still', named(f, 'dev/other.md', `${FIRST}-work`));
  f = findingsOf(tree({ [`data/core/people/${FIRST.toLowerCase()}-work.md`]: `# ${FIRST}\n`, 'dev/notes.md': 'Ask about the rota.\n' }));
  check('a tree not naming them passes', !f.some((x) => x.includes(FIRST.toLowerCase())));

  // C25 (round 3): the shipped tree itself, as a copy for her holds it (no dev/, no
  // record), passes for a person named each everyday name the list allows, and for a
  // few names that are common words the harness happens not to use. Each name is built
  // at run time, never written here, so this file never names one. The tree is the
  // tracked files of this checkout, copied; her record is an invented one-person folder.
  // Names that are everyday words count only capitalised mid-sentence (the developer's
  // yes, 2026-10-31). Built from parts so this file names no one.
  {
    const { withoutEverydayNames } = await import('../lib/everyday-names.mjs');
    const nm = ['w', 'ill'].join('');
    const held = (s) => new RegExp(`(?<![\\p{L}])${nm}(?![\\p{L}])`, 'iu').test(withoutEverydayNames(s, nm, 'x.md'));
    const Cap = nm[0].toUpperCase() + nm.slice(1);
    check('a word-name in ordinary use passes ("you ... see")', !held(`you ${nm} see`));
    check('a word-name opening a question passes', !held(`${Cap} it work?`));
    check('a word-name capitalised mid-sentence is held', held(`ask ${Cap} about it`));
    check('a word-name after a comma is held', held(`thanks, ${Cap}`));
  }
  {
    const here = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const shipped = makeTemp('dear-privacy-shipped-');
    roots.push(shipped);
    // The tracked files where git can list them; the commit gate's snapshot has no .git,
    // so there the tree itself is walked, skipping what never ships.
    const skip = /^(data|data-sandbox|dev|temp|node_modules|\.git)(\/|$)|\/node_modules(\/|$)/;
    const walk = (dir, rel = '') => readdirSync(join(here, dir)).flatMap((n) => {
      const r = rel ? `${rel}/${n}` : n;
      if (skip.test(r)) return [];
      try { return statSync(join(here, r)).isDirectory() ? walk(r, r) : [r]; } catch { return []; }
    });
    let tracked;
    try { tracked = execFileSync('git', ['ls-files', '-z'], { cwd: here, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).split('\0'); }
    catch { tracked = walk(''); }
    tracked = tracked.filter((p) => p && !skip.test(p));
    for (const p of tracked) {
      if (!existsSync(join(here, p))) continue;
      mkdirSync(dirname(join(shipped, p)), { recursive: true });
      cpSync(join(here, p), join(shipped, p));
    }
    const people = join(shipped, 'data', 'core', 'people');
    mkdirSync(people, { recursive: true });
    const listed = JSON.parse(readFileSync(join(here, 'ux', 'lib', 'everyday-names.json'), 'utf8')).allowed.flatMap((e) => e.names ?? []).concat(JSON.parse(readFileSync(join(here, 'ux', 'lib', 'everyday-names.json'), 'utf8')).wordNames ?? []);
    const words = [['gr', 'ace'], ['j', 'oy'], ['fai', 'th'], ['sum', 'mer'], ['ho', 'pe'], ['s', 'ky']].map((p) => p.join(''));
    check('the everyday-names list names someone to test (C25)', listed.length >= 3);
    for (const name of [...new Set([...listed, ...words])]) {
      for (const f of readdirSync(people)) rmSync(join(people, f));
      writeFileSync(join(people, `${name}.md`), '# A person\n');
      const r = checkPrivacy(shipped);
      check(`the shipped tree passes for a person whose name is a ${listed.includes(name) ? 'listed everyday word' : 'common word'} (C25, ${r?.findings.length ?? 'no'} finding(s))`, r && r.findings.length === 0);
    }
  }

  const none = makeTemp('dear-privacy-');
  roots.push(none);
  check('a tree with no record has nothing to check', checkPrivacy(none) === null);
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

// A file named on the command line is refused, never read as checked (4 Nov).
{
  let code = 0;
  try { execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'check-privacy.mjs'), 'some-page.html'], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  if (code !== 2) { failed++; console.error('FAIL a file named on the command line is refused with exit 2, not passed as checked'); }
  else console.log('ok   a file named on the command line is refused with exit 2, not passed as checked');
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
