// Rule test for the skill tests and the unproven list (PMM-010, PMM-011,
// PMM-018), run by `check-skills.mjs --evals` from lib/skill-evals.mjs: small
// trees built in a temporary folder, each with its own practice cache, so a
// count read from somewhere other than the cache, a stale result passing as
// current, or a missing key passing as a run shows here first.
//
// Run from ux/: node scripts/test-skill-evals.mjs

import { chmodSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as evals from '../lib/skill-evals.mjs';
const { assess, main, renderUnproven, skillText, testHashes, UNPROVEN } = evals;
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const cache = (queries, scenarios) =>
  [
    '**Last grounded:** 2026-01-01 · **Next due:** 2099-01-01 · **Interval:** 3 months',
    '',
    '| Key | Value | Enforce | Source |',
    '|---|---|---|---|',
    `| evals.minScenarios | ${scenarios} | warn | [BP] "At least three" |`,
    `| evals.triggerQueries | ${queries} | warn | [SC] "20 eval queries" |`,
  ].join('\n') + '\n';
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\nDo the thing.\n`;
// The words of one file in a tree, as a result counts them.
const wordsOf = (root, rel) => (evals.wordCount ?? (() => NaN))(readFileSync(join(root, rel), 'utf8'));
const tests = (over = {}) => ({
  skill: 'pantry',
  audiences: ['her'],
  shouldFire: [
    { id: 'F01', audience: 'her', query: 'show my pantry list' },
    { id: 'F02', audience: 'her', query: 'add rice to the pantry' },
  ],
  shouldNotFire: [{ id: 'N01', audience: 'her', query: 'plan my garden beds', goesTo: 'garden' }],
  scenarios: [{ id: 'S01', audience: 'her', situation: 'She asks to see the pantry.', must: ['Shows the list'], mustNever: ['Invents an item'] }],
  ...over,
});

const roots = [];
const tree = (files) => {
  const root = makeTemp('dear-evals-');
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
};
const base = (q, s, extra = {}) => ({
  '.claude/skills/practice.md': cache(q, s),
  '.claude/skills/pantry/SKILL.md': skill('pantry', 'She asks to see or change her pantry list - what food is in the cupboard.'),
  '.claude/skills/garden/SKILL.md': skill('garden', 'She plans her garden beds, seeds and planting.'),
  ...extra,
});
const result = (t, over = {}) => ({
  firing: { date: '2026-10-01', model: 'm', runs: 1, right: 3, total: 3, wrong: [], hash: testHashes(t).firing },
  scenarios: {
    date: '2026-10-01',
    model: 'm',
    grader: 'g',
    hash: testHashes(t).scenarios,
    results: [{ id: 'S01', with: { pass: true, score: 1, mustMissed: [], mustNeverBroken: [] }, without: { pass: false, score: 0, mustMissed: ['Shows the list'], mustNeverBroken: [] } }],
  },
  ...over,
});
const row = (root, name = 'pantry') => assess(root).rows.find((r) => r.name === name);
const putIn = (root) => (rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const quiet = async (fn) => {
  const [log, error] = [console.log, console.error];
  console.log = console.error = () => {};
  try {
    return await fn();
  } finally {
    [console.log, console.error] = [log, error];
  }
};

try {
  const none = tree(base(20, 3));
  check('a skill with no tests is unproven, never a fault', row(none, 'garden').reasons.includes('no tests') && assess(none).faults.length === 0);

  const t = tests();
  const counted = tree(base(30, 4, { 'dev/skills/pantry/evals.json': t }));
  const c = row(counted).reasons.join('; ');
  check('the counts come from the cache, not the code', c.includes('3 of 30 queries') && c.includes('1 of 4 scenarios'));
  check('a test never run is unproven', c.includes('firing never run') && c.includes('scenarios never run'));

  const bad = tree(
    base(1, 1, {
      'dev/skills/pantry/evals.json': tests({
        shouldNotFire: [{ id: 'F01', audience: 'dev', query: 'x', goesTo: 'nowhere' }],
        scenarios: [{ id: 'S01', audience: 'her', situation: 'y', must: ['z'], mustNever: [] }],
      }),
      'dev/skills/ghost/evals.json': { ...tests(), skill: 'ghost' },
    }),
  );
  const f = assess(bad).faults.join('\n');
  check('a malformed tests file is a fault naming each problem', ['used twice', 'audience "dev"', 'goesTo "nowhere"', '"mustNever"', 'no skill named ghost'].every((s) => f.includes(s)));

  const proven = tree(base(3, 1, { 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': result(t) }));
  check('current passing runs that beat the baseline prove a skill', row(proven).proven === true);

  const changed = { ...t, shouldFire: [...t.shouldFire, { id: 'F03', audience: 'her', query: 'what is in the cupboard' }] };
  const stale = tree(base(3, 1, { 'dev/skills/pantry/evals.json': changed, 'dev/skills/pantry/evals-results.json': result(t) }));
  const s = row(stale).reasons.join('; ');
  check('a result older than its queries no longer counts, but scenarios still do', s.includes('firing result older') && !s.includes('scenario result older'));

  const brokenRun = result(t);
  brokenRun.scenarios.results[0].with = { pass: false, score: -1, mustMissed: [], mustNeverBroken: ['Invents an item'] };
  const broken = tree(base(3, 1, { 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': brokenRun }));
  check('a broken must-never is named', row(broken).reasons.some((r) => r.includes('must-never broken: S01')));

  const sameRun = result(t);
  sameRun.scenarios.results[0].without = { ...sameRun.scenarios.results[0].with };
  const same = tree(base(3, 1, { 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': sameRun }));
  check('no better than without it is unproven (PRL-002)', row(same).reasons.some((r) => r.includes('no better than without it')));

  // PMM-010 and PMM-011 say "every audience it serves": the audiences a skill
  // names in its own Audience line must be the ones its tests cover.
  const dual = (line) => ({ '.claude/skills/pantry/SKILL.md': `${skill('pantry', 'She asks to see or change her pantry list - what food is in the cupboard.')}\n**Audience:** ${line}\n` });
  const both = tree(base(3, 1, { ...dual('The developer or the person, in her own chats.'), 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': result(t) }));
  check('an Audience line naming the developer, with tests from her alone, is unproven', row(both).proven !== true && row(both).reasons.some((r) => r.includes('Audience line names dev')));
  const only = tree(base(3, 1, { ...dual('The person, in her own chats; never the developer.'), 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': result(t) }));
  check('an audience the line rules out with "never" is not owed tests', row(only).proven === true);

  const lean = tree(base(1, 1, { 'dev/skills/pantry/evals.json': tests({ shouldFire: [{ id: 'F01', audience: 'her', query: 'plan the garden beds and seeds for planting' }] }) }));
  check('a query worded like a neighbour is reported as an overlap', assess(lean).collisions.some((n) => n.includes('pantry F01: leans to garden')));

  const text = renderUnproven(assess(counted));
  check('the list carries no date of its own', !text.includes(new Date().toISOString().slice(0, 10)) && text.includes('| `pantry` |'));

  const gate = tree(base(20, 3, { 'dev/skills/pantry/evals.json': t }));
  const before = await quiet(() => main(['--check'], gate, putIn(gate)));
  const wrote = await quiet(() => main(['--write'], gate, putIn(gate)));
  const after = await quiet(() => main(['--check'], gate, putIn(gate)));
  check('--check fails on a missing or stale list, and passes once --write has run', before === 1 && wrote === 0 && after === 0 && existsSync(join(gate, UNPROVEN)));

  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const liveCode = await quiet(() => main(['--live', '--write'], gate, putIn(gate)));
  if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  check('--live with no key runs nothing, records nothing and exits 0', liveCode === 0 && !existsSync(join(gate, 'dev/skills/pantry/evals-results.json')) && readFileSync(join(gate, UNPROVEN), 'utf8').includes('firing never run'));

  // The live path against a stand-in for the API: the dispatcher sees only the
  // listing, the two replies differ only by the skill, and the grader is blind.
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages[0].content;
    seen.push(body);
    let text;
    if (body.system.startsWith('You choose')) text = /Message: .*pantry/.test(user) ? 'pantry' : 'garden';
    else if (body.system.startsWith('You decide')) text = '["stock.md"]';
    else if (body.system.startsWith('You grade')) {
      const a = user.split('<reply id="A">')[1].split('</reply>')[0];
      const good = { must: [true], mustNever: [false] };
      const poor = { must: [false], mustNever: [false] };
      text = JSON.stringify(a.includes('WITH SKILL') ? { A: good, B: poor } : { A: poor, B: good });
    } else text = body.system.includes('<skill ') ? 'WITH SKILL' : 'BARE';
    return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }) };
  };
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  // A rule the skill keeps in a reference: the run must load it beside SKILL.md.
  const refs = {
    '.claude/skills/pantry/stock.md': '# Stock\n\n**Read when** counting tins.\n\nSTOCK RULE: count every tin twice.\n',
    '.claude/skills/pantry/deep/too-far.md': 'TOO FAR: two levels down.\n',
  };
  const liveRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': t, ...refs }));
  const ran = await quiet(() => main(['--live', '--skill', 'pantry', '--load', 'all', '--write'], liveRoot, putIn(liveRoot)));
  globalThis.fetch = realFetch;
  if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = key;
  const dispatched = seen.filter((b) => b.system.startsWith('You choose'));
  check(
    'a live run asks a dispatcher that sees only the listing, grades blind and records',
    ran === 0 && dispatched.length === 3 && dispatched.every((b) => !b.messages[0].content.includes('Do the thing')) && existsSync(join(liveRoot, 'dev/skills/pantry/evals-results.json')),
  );

  // --load all, the old measure kept for comparison: SKILL.md and every
  // reference one level deep, no pick step; "without" has neither.
  const answered = seen.filter((b) => b.system.startsWith('You are the assistant'));
  const withArm = answered.filter((b) => b.system.includes('<skill '));
  const bareArm = answered.filter((b) => !b.system.includes('<skill '));
  check(
    '--load all loads SKILL.md and every reference one level deep, with no pick step; the run without has neither',
    withArm.length === 1 && bareArm.length === 1 && !seen.some((b) => b.system.startsWith('You decide')) &&
      withArm[0].system.includes('Do the thing') && withArm[0].system.includes('<reference path="stock.md">') && withArm[0].system.includes('STOCK RULE') &&
      !withArm[0].system.includes('TOO FAR') && !bareArm[0].system.includes('STOCK RULE') && !bareArm[0].system.includes('Do the thing'),
  );
  const recorded = JSON.parse(readFileSync(join(liveRoot, 'dev/skills/pantry/evals-results.json'), 'utf8'));
  check(
    'an all-load result says so, and names the files each scenario read and their words',
    recorded.scenarios.load === 'all' && JSON.stringify(recorded.scenarios.offered) === JSON.stringify(['SKILL.md', 'stock.md']) &&
      JSON.stringify(recorded.scenarios.results[0].read) === JSON.stringify(['SKILL.md', 'stock.md']) && recorded.scenarios.results[0].words === wordsOf(liveRoot, ".claude/skills/pantry/SKILL.md") + wordsOf(liveRoot, ".claude/skills/pantry/stock.md"),
  );
  check('an all-load result for a skill with references is not taken for a routed one', row(liveRoot).proven !== true && row(liveRoot).reasons.some((r) => r.includes('not routed')));
  const loaded = skillText(join(liveRoot, '.claude/skills/pantry/SKILL.md'));
  check('skillText puts SKILL.md first and marks each reference by name', loaded.files[0] === 'SKILL.md' && loaded.text.indexOf('Do the thing') < loaded.text.indexOf('STOCK RULE'));

  // --cli: the same prompts through claude -p, here a fake that keeps what it
  // was given. It picks references by a word in the situation: TINS picks
  // stock.md, SHELF shelf.md, NONE nothing, GARBLE answers in prose. Its answer
  // with the skill carries STOCK only when stock.md was loaded, and the grader
  // passes only that, so a rule in a file it did not pick can fail.
  const fakeIn = (root) => {
    const file = join(root, 'fake-claude.mjs');
    writeFileSync(
      file,
      [
        '#!/usr/bin/env node',
        "import { appendFileSync, readFileSync } from 'node:fs';",
        "const system = readFileSync(0, 'utf8');",
        'const args = process.argv.slice(2);',
        'const user = args[args.length - 1];',
        `appendFileSync(${JSON.stringify(join(root, 'calls.jsonl'))}, JSON.stringify({ args, user, system: system.slice(0, 40), pick: system.startsWith('You decide'), withSkill: system.includes('<skill '), skillMd: system.includes('Do the thing'), stock: system.includes('STOCK RULE'), shelf: system.includes('SHELF RULE'), shared: system.includes('SHARED RULE'), secret: system.includes('PRIVATE NOTE'), names: system.includes('stock.md') && system.includes('shelf.md'), cwd: process.cwd() }) + '\\n');`,
        'let text;',
        "if (system.startsWith('You choose')) text = /Message: .*pantry/.test(user) ? 'pantry' : 'garden';",
        "else if (system.startsWith('You decide')) text = /DEEPREF/.test(user) ? '[\"references/deep.md\"]' : /SHOWME/.test(user) ? '[\"stock.md\"]' : /SHARED/.test(user) ? '[\"stock.md\", \"../shared/rules.md\"]' : /PRIVATE/.test(user) ? '[\"../../../data/notes.md\"]' : /AWAY/.test(user) ? '[\"../../../../away.md\"]' : /ONCE/.test(user) ? (system.includes('could not be read as a list') ? '[\"stock.md\"]' : 'I would open the stock file first.') : /GARBLE/.test(user) ? 'I would open the stock file first.' : /NONE/.test(user) ? '[]' : /SHELF/.test(user) ? 'Files: [\"shelf.md\"]' : '```json\\n[\"stock.md\"]\\n```';",
        "else if (system.startsWith('You grade')) {",
        "  const reply = (id) => user.split(`<reply id=\"${id}\">`)[1].split('</reply>')[0];",
        "  const mark = (id) => ({ must: [reply(id).includes('STOCK')], mustNever: [false] });",
        "  text = JSON.stringify({ A: mark('A'), B: mark('B') });",
        "} else if (system.startsWith('A grader marked')) text = 'must 1: REASON GIVEN';",
        "else if (/SHOWME/.test(user) && system.includes('<skill ')) text = 'WITH SKILL STOCK, AND ALL I WAS GIVEN:\\n' + system;",
        "else text = system.includes('<skill ') ? (system.includes('STOCK RULE') ? 'WITH SKILL STOCK' : system.includes('DEEP RULE') ? 'WITH SKILL STOCK DEEP' : 'WITH SKILL') : 'BARE';",
        'process.stdout.write(text);',
        '',
      ].join('\n'),
    );
    chmodSync(file, 0o755);
    return file;
  };
  const viaFake = async (root, args) => {
    const savedClaude = process.env.DEAR_EVAL_CLAUDE;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.DEAR_EVAL_CLAUDE = fakeIn(root);
    globalThis.fetch = async () => {
      throw new Error('--cli must not reach the API');
    };
    try {
      return await quiet(() => main(['--live', '--cli', '--skill', 'pantry', ...args, '--write'], root, putIn(root)));
    } finally {
      globalThis.fetch = realFetch;
      if (savedClaude === undefined) delete process.env.DEAR_EVAL_CLAUDE;
      else process.env.DEAR_EVAL_CLAUDE = savedClaude;
      if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
    }
  };
  const callsIn = (root) => (existsSync(join(root, 'calls.jsonl')) ? readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  const resultIn = (root) => (existsSync(join(root, 'dev/skills/pantry/evals-results.json')) ? JSON.parse(readFileSync(join(root, 'dev/skills/pantry/evals-results.json'), 'utf8')) : {});
  const PANTRY = '.claude/skills/pantry/';

  const tins = { id: 'S01', audience: 'her', situation: 'She asks to count her TINS', must: ['Counts every tin twice'], mustNever: ['Invents an item'] };
  const cliRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [tins] }), ...refs }));
  const viaCli = await viaFake(cliRoot, ['--jobs', '2']);
  const calls = callsIn(cliRoot);
  const cliResult = resultIn(cliRoot);
  const flags = calls[0]?.args ?? [];
  check(
    '--cli with no key sends every prompt through claude -p, system prompt on stdin, no tools or settings, outside the repository, and proves',
    viaCli === 0 && calls.length === 3 + 1 + 3 && row(cliRoot).proven === true && cliResult.scenarios?.via === 'claude -p' &&
      flags.includes('-p') && flags[flags.indexOf('--system-prompt-file') + 1] === '/dev/stdin' && flags[flags.indexOf('--tools') + 1] === '' &&
      flags.includes('--no-session-persistence') && calls.every((c) => !c.cwd.startsWith(cliRoot)) && calls.some((c) => c.withSkill && c.stock),
  );

  // Routed, the default for a skill with references (PMM-015, "splitting and
  // routing are tested together"): first SKILL.md alone and the names beside
  // it, and the model says which it would open; then the answer with exactly
  // those. Two references, so a pick of one leaves the other out.
  const shelf = { [`${PANTRY}shelf.md`]: '# Shelf\n\n**Read when** labelling shelves.\n\nSHELF RULE: label left to right.\n' };
  const also = (id, situation) => ({ id, audience: 'her', situation, must: ['Counts every tin twice'], mustNever: ['Invents an item'] });
  const routedTests = tests({ scenarios: [tins, also('S02', 'She asks what to read about GARBLE'), also('S03', 'She asks to count her tins, NONE'), also('S04', 'She asks about the SHELF')] });
  const routedRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': routedTests, ...refs, ...shelf }));
  const routedCode = await viaFake(routedRoot, []);
  const rc = callsIn(routedRoot);
  const rr = resultIn(routedRoot);
  const by = (id) => rr.scenarios?.results?.find((x) => x.id === id) ?? {};
  const picks = rc.filter((c) => c.pick);
  check(
    'routed is the default: each scenario first sees SKILL.md and the reference names, never their text (four picks, and the prose one asked once more)',
    routedCode === 0 && rr.scenarios?.load === 'routed' && picks.length === 5 && picks.filter((c) => c.user.includes('GARBLE')).length === 2 && picks.every((c) => c.skillMd && c.names && !c.stock && !c.shelf),
  );
  const answeredWith = (word) => rc.filter((c) => !c.pick && c.withSkill && c.user.includes(word));
  check(
    'the picked files, and only those, are loaded for the answer',
    answeredWith('TINS').length === 1 && answeredWith('TINS')[0].stock && !answeredWith('TINS')[0].shelf &&
      answeredWith('SHELF').length === 1 && answeredWith('SHELF')[0].shelf && !answeredWith('SHELF')[0].stock &&
      answeredWith('NONE').length === 1 && !answeredWith('NONE')[0].stock && !answeredWith('NONE')[0].shelf,
  );
  check(
    'the result records which files each scenario read and the words loaded',
    JSON.stringify(by('S01').read) === JSON.stringify(['SKILL.md', 'stock.md']) && JSON.stringify(by('S03').read) === JSON.stringify(['SKILL.md']) &&
      by('S01').words === wordsOf(routedRoot, `${PANTRY}SKILL.md`) + wordsOf(routedRoot, `${PANTRY}stock.md`) && by('S03').words === wordsOf(routedRoot, `${PANTRY}SKILL.md`) &&
      JSON.stringify(rr.scenarios?.offered) === JSON.stringify(['SKILL.md', 'shelf.md', 'stock.md']),
  );
  check(
    'an unparsable pick is a recorded failure for that scenario, never a silent pass, and nothing is answered with the skill',
    by('S02').with?.pass === false && /pick/.test(by('S02').with?.error ?? '') && by('S02').read === null && answeredWith('GARBLE').length === 0,
  );
  // A pick in prose is the test's failure to read it, not the skill's: asked
  // once more for the list only. Prose then a list is routed as the list says;
  // prose twice is still the recorded failure above.
  const onceRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [also('S01', 'She asks to count her tins, ONCE'), also('S02', 'She asks what to read about GARBLE')] }), ...refs, ...shelf }));
  const onceCode = await viaFake(onceRoot, []);
  const oncePicks = (word) => callsIn(onceRoot).filter((c) => c.pick && c.user.includes(word));
  const onceWith = (word) => callsIn(onceRoot).filter((c) => !c.pick && c.withSkill && c.user.includes(word));
  const onceBy = (id) => resultIn(onceRoot).scenarios?.results?.find((x) => x.id === id) ?? {};
  check(
    'a pick answered in prose is asked once more: prose then a list is routed as the list says',
    onceCode === 0 && oncePicks('ONCE').length === 2 && JSON.stringify(onceBy('S01').read) === JSON.stringify(['SKILL.md', 'stock.md']) &&
      onceBy('S01').with?.pass === true && onceWith('ONCE').length === 1 && onceWith('ONCE')[0].stock,
  );
  check(
    'a pick in prose twice is asked no third time and stays a recorded failure, nothing answered with the skill',
    oncePicks('GARBLE').length === 2 && onceBy('S02').read === null && onceBy('S02').with?.pass === false && /pick/.test(onceBy('S02').with?.error ?? '') && onceWith('GARBLE').length === 0,
  );
  check(
    'a scenario whose rule sat in a file it did not pick fails',
    by('S01').with?.pass === true && by('S03').with?.pass === false && by('S04').with?.pass === false && row(routedRoot).proven !== true && row(routedRoot).reasons.some((r) => r.includes('scenarios failed 3')),
  );

  // A file SKILL.md routes to outside its own folder (a shared rules file two
  // skills read first) may be picked and is loaded; one in data/, or a path
  // that leaves the repository, is still refused even when SKILL.md names it.
  const routesOut = {
    [`${PANTRY}SKILL.md`]: `${skill('pantry', 'She asks to see or change her pantry list - what food is in the cupboard.')}\nRead [the rules](../shared/rules.md) first. Never \`../../../data/notes.md\`, nor \`../../../../away.md\`.\n`,
    '.claude/skills/shared/rules.md': '# Rules\n\nSHARED RULE: tins before jars.\n',
    'data/notes.md': 'PRIVATE NOTE: not test material.\n',
  };
  const outRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [also('S01', 'She asks to count her tins, SHARED'), also('S02', 'She asks about PRIVATE notes'), also('S03', 'She asks about AWAY')] }), ...refs, ...routesOut }));
  const outs = evals.routedOutside(join(outRoot, `${PANTRY}SKILL.md`), outRoot);
  check(
    'routedOutside keeps a route SKILL.md names outside its folder inside the repository, and drops data/ and a path leaving the repository',
    JSON.stringify(outs) === JSON.stringify([{ name: '../shared/rules.md', rel: '.claude/skills/shared/rules.md' }]),
  );
  check(
    'parsePick takes a routed outside file by either form, and refuses data/ and a path leaving the repository',
    JSON.stringify(evals.parsePick('["stock.md", "../shared/rules.md"]', ['stock.md'], outs).files) === JSON.stringify(['stock.md', '../shared/rules.md']) &&
      JSON.stringify(evals.parsePick('[".claude/skills/shared/rules.md"]', ['stock.md'], outs).files) === JSON.stringify(['../shared/rules.md']) &&
      /not one of the files/.test(evals.parsePick('["../../../data/notes.md"]', ['stock.md'], outs).error ?? '') &&
      /not one of the files/.test(evals.parsePick('["../../../../away.md"]', ['stock.md'], outs).error ?? '') &&
      /not one of the files/.test(evals.parsePick('["../shared/other.md"]', ['stock.md'], outs).error ?? ''),
  );
  check('skillText without a root never loads an outside file, even when picked', !skillText(join(outRoot, `${PANTRY}SKILL.md`), ['../shared/rules.md']).text.includes('SHARED RULE'));
  const outCode = await viaFake(outRoot, []);
  const oc = callsIn(outRoot);
  const or = resultIn(outRoot);
  const outBy = (id) => or.scenarios?.results?.find((x) => x.id === id) ?? {};
  const outWith = (word) => oc.filter((c) => !c.pick && c.withSkill && c.user.includes(word));
  check(
    'a routed run loads a picked outside route beside the picked reference, and records it as read',
    outCode === 0 && outWith('SHARED').length === 1 && outWith('SHARED')[0].shared && outWith('SHARED')[0].stock &&
      JSON.stringify(outBy('S01').read) === JSON.stringify(['SKILL.md', 'stock.md', '../shared/rules.md']) &&
      outBy('S01').words === wordsOf(outRoot, `${PANTRY}SKILL.md`) + wordsOf(outRoot, `${PANTRY}stock.md`) + wordsOf(outRoot, '.claude/skills/shared/rules.md'),
  );
  check(
    'a routed run refuses a pick in data/ and one leaving the repository: a recorded failure, nothing answered with the skill, nothing from data/ loaded',
    outBy('S02').with?.pass === false && /pick/.test(outBy('S02').with?.error ?? '') && outBy('S02').read === null && outWith('PRIVATE').length === 0 &&
      outBy('S03').with?.pass === false && /pick/.test(outBy('S03').with?.error ?? '') && outBy('S03').read === null && outWith('AWAY').length === 0 &&
      !oc.some((c) => c.secret),
  );

  // The pick's question ends on the list instruction, after the situation, so
  // the last thing the model reads asks for a bracket and nothing else.
  const pickUsers = rc.filter((c) => c.pick).map((c) => c.user);
  check(
    'the pick is asked with the situation first and the list-only instruction last, starting with a bracket',
    pickUsers.length > 0 && pickUsers.every((u) => u.startsWith('Situation: ') && /JSON list only, your first character "\["/.test(u.split('\n').pop())) &&
      evals.pickAsk('X').startsWith('Situation: X') && evals.pickAsk('X').trim().endsWith('No words, no code fence.'),
  );

  // A part in a subfolder of the skill's own (references/x.md), linked from
  // SKILL.md, is one level deep as PMM-015 counts it: offered, pickable and
  // loaded; a subfolder's subfolder is not.
  const deepRefs = {
    [`${PANTRY}SKILL.md`]: `${skill('pantry', 'She asks to see or change her pantry list - what food is in the cupboard.')}\nFor tins read [deep](references/deep.md); never \`references/x/too.md\`.\n`,
    [`${PANTRY}references/deep.md`]: '# Deep\n\nDEEP RULE: tins on the left.\n',
    [`${PANTRY}references/x/too.md`]: 'TOO DEEP\n',
  };
  const deepRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [also('S01', 'She asks to count tins, DEEPREF')] }), ...deepRefs }));
  check(
    'routedOutside offers a part in a subfolder of its own that SKILL.md links, and never a subfolder of that',
    JSON.stringify(evals.routedOutside(join(deepRoot, `${PANTRY}SKILL.md`), deepRoot)) === JSON.stringify([{ name: 'references/deep.md', rel: `${PANTRY}references/deep.md` }]),
  );
  const deepCode = await viaFake(deepRoot, []);
  const deepCalls = callsIn(deepRoot);
  const deepBy = resultIn(deepRoot).scenarios?.results?.[0] ?? {};
  check(
    'a skill whose only parts sit in references/ is routed: the pick lists them, and the one picked is loaded and recorded',
    deepCode === 0 && resultIn(deepRoot).scenarios?.load === 'routed' && deepCalls.some((c) => c.pick) &&
      JSON.stringify(deepBy.read) === JSON.stringify(['SKILL.md', 'references/deep.md']) && deepBy.with?.pass === true,
  );

  // --show S01: only that scenario, no firing queries, nothing kept; prints the
  // pick, the answer with the skill, the marks and the reasons, and never a
  // word of data/, even when the answer echoes all it was given.
  const showRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [also('S01', 'She asks to count her tins, SHOWME'), also('S02', 'She asks about the SHELF')] }), ...refs, ...shelf, ...routesOut }));
  const showRun = async (args) => {
    const savedClaude = process.env.DEAR_EVAL_CLAUDE;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.DEAR_EVAL_CLAUDE = fakeIn(showRoot);
    const out = [];
    const [log, error] = [console.log, console.error];
    console.log = console.error = (...a) => out.push(a.join(' '));
    try {
      const code = await main(['--live', '--cli', '--skill', 'pantry', ...args], showRoot, putIn(showRoot));
      return { code, out: out.join('\n') };
    } finally {
      [console.log, console.error] = [log, error];
      if (savedClaude === undefined) delete process.env.DEAR_EVAL_CLAUDE;
      else process.env.DEAR_EVAL_CLAUDE = savedClaude;
      if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
    }
  };
  const shown = await showRun(['--show', 'S01']);
  const showCalls = callsIn(showRoot);
  check(
    '--show runs only the scenarios named, asks no firing query and keeps no result',
    shown.code === 0 && !showCalls.some((c) => c.system.startsWith('You choose')) && !showCalls.some((c) => c.user.includes('SHELF')) &&
      !existsSync(join(showRoot, 'dev/skills/pantry/evals-results.json')),
  );
  check(
    '--show prints the pick, the answer with the skill, the grader\'s marks and its reasons',
    /S01 pick/.test(shown.out) && shown.out.includes('["stock.md"]') && /S01 answer with the skill/.test(shown.out) && shown.out.includes('STOCK RULE') &&
      /S01 grader's marks/.test(shown.out) && /S01 grader's reasons/.test(shown.out) && shown.out.includes('REASON GIVEN'),
  );
  check('--show never prints anything from data/, even from an answer that echoes all it was given', !shown.out.includes('PRIVATE NOTE') && !callsIn(showRoot).some((c) => c.secret));
  const showWrite = await showRun(['--show', 'S01', '--write']);
  check('--show beside --write is refused, since it keeps no result', showWrite.code === 1 && !existsSync(join(showRoot, 'dev/skills/pantry/evals-results.json')));

  const allRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': routedTests, ...refs, ...shelf }));
  const allCode = await viaFake(allRoot, ['--load', 'all']);
  const ac = callsIn(allRoot);
  const ar = resultIn(allRoot);
  check(
    '--load all is the old measure: no pick, every reference loaded for every scenario, and recorded as all',
    allCode === 0 && !ac.some((c) => c.pick) && ac.filter((c) => c.withSkill).length === 4 && ac.filter((c) => c.withSkill).every((c) => c.stock && c.shelf) &&
      ar.scenarios?.load === 'all' && (ar.scenarios.results ?? []).every((x) => JSON.stringify(x.read) === JSON.stringify(['SKILL.md', 'shelf.md', 'stock.md'])),
  );
  const badLoad = await viaFake(allRoot, ['--load', 'some']);
  check('an unknown --load is refused', badLoad === 1);

  // A skill with no references runs as before: no pick step, and its result is not held to a load mode.
  const plainRoot = tree(base(3, 1, { 'dev/skills/pantry/evals.json': tests({ scenarios: [tins] }) }));
  const plainCode = await viaFake(plainRoot, []);
  check(
    'a skill with no references has no pick step, and an older result with no load mode still counts',
    plainCode === 0 && !callsIn(plainRoot).some((c) => c.pick) && JSON.stringify(resultIn(plainRoot).scenarios?.results?.[0]?.read) === JSON.stringify(['SKILL.md']) && row(proven).proven === true,
  );
  const oldResult = tree(base(3, 1, { 'dev/skills/pantry/evals.json': t, 'dev/skills/pantry/evals-results.json': result(t), ...refs }));
  check('an older result with no load mode, for a skill with references, is not taken for a routed one', row(oldResult).reasons.some((r) => r.includes('not routed')));
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

// E-031 (A-071): a result file stays readable in one go, about one line a scenario,
// and reads back exactly what was written.
{
  const many = Array.from({ length: 400 }, (_, i) => ({ id: `S${i}`, read: ['SKILL.md'], words: 10, with: { pass: true, score: 1, mustMissed: [], mustNeverBroken: [] }, without: { pass: false, score: 0, mustMissed: ['x'], mustNeverBroken: [] } }));
  const value = { firing: { date: '2026-01-01', right: 3, total: 3, wrong: [] }, scenarios: { date: '2026-01-01', offered: ['SKILL.md', 'a.md'], hash: 'h', results: many } };
  const text = evals.resultsText(value);
  check('a result file reads back exactly as written', JSON.stringify(JSON.parse(text)) === JSON.stringify(value));
  check('a result file of 400 scenarios stays under the one-read line', text.split('\n').length < 1000);
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
