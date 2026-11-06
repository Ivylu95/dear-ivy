// The independent firing and scenario tests for every skill, and the list of
// the skills not yet proven by them (PMM-010, PMM-011).
//
//   node scripts/check-skills.mjs --evals            offline: validate, count, collisions
//   node scripts/check-skills.mjs --evals --write    ... and rewrite the unproven list
//   node scripts/check-skills.mjs --evals --check    ... and fail if that list is stale
//   node scripts/check-skills.mjs --evals --live [--cli] [--skill <name>] [--runs <n>] [--jobs <n>] [--load routed|all] [--write]
//   node scripts/check-skills.mjs --evals --live [--cli] --skill <name> --show S01,S02   debug: only those scenarios, printed
//
// PMM-010 design 2 keeps a skill's queries beside its log and runs them from
// check-skills.mjs; this is that run. Each skill's tests are one file,
// dev/skills/<name>/evals.json: should-fire and should-not-fire queries, and
// scenarios with what must and must never happen, stated as outcomes, never as
// wording. Synthetic phrasing only, never from her record (ARC-004).
//
// Offline (the default, and the only mode the gate runs) is deterministic and
// touches no network. It validates every evals file, counts it against the
// practice cache's evals.minScenarios and evals.triggerQueries (read from
// .claude/skills/practice.md at run time, never written here), and reports, as
// a heuristic only, a query that shares more distinctive words with another
// skill's description than with its own.
//
// Live (--live) needs ANTHROPIC_API_KEY, or --cli (or DEAR_EVAL_BACKEND=cli)
// to send the same prompts through `claude -p` instead, signed in as this
// machine's Claude Code (DEAR_EVAL_CLAUDE names another binary; a test's fake).
// --jobs <n> runs n prompts at once (default 1). A dispatcher model is shown only the
// listing of names and descriptions, never a skill's text, and names the skill
// it would use for each query (PMM-010, "tested independently"). Each scenario
// is answered twice, with the skill loaded and without it, under the same
// harness file, and a separate grader call, blind to which is which, marks each
// must and must-never (PMM-011, "compared with handling the same situation
// without it"). "With the skill" is the skill as Claude Code would have it.
// Claude Code reads SKILL.md, then only the references SKILL.md routes it to,
// so for a skill with references the default load is routed (PMM-015,
// "splitting and routing are tested together"): step one shows the harness
// file, SKILL.md alone and the names of the .md files beside it, and the model
// answers with the ones it would open, a JSON list (PICK, parsePick); step two
// answers with SKILL.md and exactly those, one level deep (skillText). A rule
// that sits in a file it did not pick is missing from the answer, so the
// scenario can fail on routing; a pick that cannot be read is asked once more,
// for the list only (PICK_AGAIN), and if it still cannot be read is a failure
// recorded for that scenario, never a silent pass. `--load all` keeps the old
// measure, SKILL.md and every reference at once, so before and after a split
// can be compared; a skill with no references loads SKILL.md alone either way.
// Each scenario's result names the files it read and the words they hold, and
// the run records its load mode: a result for a skill with references that was
// not routed (an all-load, or one older than the mode) never proves it. With
// --write the results are kept in dev/skills/<name>/evals-results.json, tied by
// hash to the tests they ran, so a changed test makes its result stale. No key:
// it says so and exits 0. --show <ids> runs only the scenarios named, no firing
// queries, and prints each one's pick answer, its answer with the skill, the
// grader's marks and the grader's reason for each line; it keeps no result, so
// it is refused beside --write. It prints model output only, never a file.
//
// The unproven list is dev/skills/skill-writer/unproven.md, generated, never
// edited by hand. Both cache values are `warn` (PMM-018), so a skill without
// tests is listed, never refused; only a malformed evals file or a stale list
// fails.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { readCache, CACHE } from '../scripts/check-procedures.mjs';

export const UNPROVEN = 'dev/skills/skill-writer/unproven.md';
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const TESTS = 'evals.json';
const RESULTS = 'evals-results.json';
// Where a should-not-fire query may go instead of a skill.
const ELSEWHERE = new Set(['none', 'crisis', 'claude-md']);

const list = (dir) => {
  try {
    return readdirSync(dir).filter((n) => !n.startsWith('_') && n !== 'node_modules').sort();
  } catch {
    return [];
  }
};

function loadYaml(root) {
  for (const r of [root, process.env.DEAR_GIT_ROOT].filter(Boolean)) {
    try {
      return createRequire(join(r, 'ux', 'package.json'))('js-yaml');
    } catch {
      // Not installed there; try the next.
    }
  }
  return null;
}

function headerOf(text, yaml) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return {};
  if (yaml) {
    try {
      return yaml.load(m[1]) ?? {};
    } catch {
      return {}; // check-skills.mjs refuses an unparsable header
    }
  }
  return Object.fromEntries(m[1].split('\n').map((l) => l.match(/^([\w-]+):\s*(.*)$/)?.slice(1) ?? []).filter((p) => p.length));
}

/**
 * Every skill dispatch or development mode can reach:
 * { name, folder, listed, description, ships, file }. `name` is the folder;
 * `listed` is what the listing shows (a module's skills as module:name);
 * `ships` is true for the skills in her listing (.claude/skills, modules).
 */
export function skills(root) {
  const yaml = loadYaml(root);
  const out = [];
  const add = (dir, name, ships, prefix = '') => {
    const file = join(root, dir, name, 'SKILL.md');
    if (!existsSync(file)) return;
    const head = headerOf(readFileSync(file, 'utf8'), yaml);
    out.push({ name, listed: `${prefix}${name}`, description: typeof head.description === 'string' ? head.description : '', ships, file, rel: `${dir}/${name}/SKILL.md` });
  };
  // A `dev-` entry is a pointer the model cannot start (ARC-005, T-479); its body in dev/skills/ is the skill.
  for (const n of list(join(root, '.claude/skills'))) if (!(n.startsWith('dev-') && existsSync(join(root, 'dev/skills', n.slice(4), 'SKILL.md')))) add('.claude/skills', n, true);
  for (const m of list(join(root, 'modules'))) for (const n of list(join(root, 'modules', m, 'skills'))) add(`modules/${m}/skills`, n, true, m === 'core' ? '' : `${m}:`);
  for (const n of list(join(root, 'dev/skills'))) add('dev/skills', n, false);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The audiences a skill names in its own "**Audience:**" line, as the tests
 * spell them: her, dev, agent. A clause after "never" rules an audience out
 * (PMM-010, PMM-011: tests from every audience it serves).
 */
export function declaredAudiences(text) {
  const line = String(text).match(/^\*\*Audience:\*\*\s*(.+)$/m)?.[1];
  if (!line) return [];
  const served = line.replace(/\bnever\b[^.;]*/gi, ' ').toLowerCase();
  const out = [];
  if (/\b(person|she|her)\b/.test(served)) out.push('her');
  if (/\bdeveloper\b/.test(served)) out.push('dev');
  if (/\bagent\b/.test(served)) out.push('agent');
  return out;
}

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
/**
 * A result file's text: the two runs and their fields one to a line, each list whole on its
 * line, and each scenario's result whole on a line of its own. Pretty-printed in full, one
 * skill's 76 scenarios ran to 1,934 lines, past the one-read line (E-031, A-071); this
 * keeps it about one line a scenario. Still JSON: every reader parses it as before.
 */
export function resultsText(value) {
  const at = (v, depth) => {
    const rows = Array.isArray(v) && v.some((x) => x !== null && typeof x === 'object'); // a list of results: one to a line
    if (v === null || typeof v !== 'object' || depth >= 3 || (depth === 2 && !rows)) return JSON.stringify(v);
    const pad = '  '.repeat(depth + 1);
    const items = Array.isArray(v) ? v.map((x) => `${pad}${at(x, depth + 1)}`) : Object.entries(v).map(([k, x]) => `${pad}${JSON.stringify(k)}: ${at(x, depth + 1)}`);
    const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
    return items.length ? `${open}\n${items.join(',\n')}\n${'  '.repeat(depth)}${close}` : `${open}${close}`;
  };
  return `${at(value, 0)}\n`;
}
/** The hashes a result is tied to: the queries, and the scenarios, apart. */
export const testHashes = (t) => ({ firing: hash([t.shouldFire, t.shouldNotFire]), scenarios: hash(t.scenarios) });

/** Faults in one evals file, as strings; empty when it is well formed. */
export function validate(tests, name, known) {
  const f = [];
  const where = `dev/skills/${name}/${TESTS}`;
  if (!tests || typeof tests !== 'object') return [`${where}: not a JSON object`];
  if (tests.skill !== name) f.push(`${where}: "skill" is "${tests.skill ?? ''}", the folder is "${name}"`);
  if (!known.has(name)) f.push(`${where}: no skill named ${name} to test`);
  const aud = Array.isArray(tests.audiences) ? tests.audiences : [];
  if (!aud.length || !aud.every((a) => typeof a === 'string' && a)) f.push(`${where}: "audiences" must list who the skill serves`);
  const ids = new Set();
  const item = (x, kind, i) => {
    const at = `${where}: ${kind}[${i}]`;
    if (!x || typeof x !== 'object') return f.push(`${at} is not an object`);
    if (typeof x.id !== 'string' || !/^[A-Z]\d{2,3}$/.test(x.id)) f.push(`${at}: id "${x.id ?? ''}" is not a letter and two or three digits`);
    else if (ids.has(x.id)) f.push(`${at}: id ${x.id} is used twice`);
    else ids.add(x.id);
    if (!aud.includes(x.audience)) f.push(`${at}: audience "${x.audience ?? ''}" is not in "audiences"`);
  };
  for (const kind of ['shouldFire', 'shouldNotFire']) {
    if (!Array.isArray(tests[kind])) {
      f.push(`${where}: "${kind}" must be a list`);
      continue;
    }
    tests[kind].forEach((q, i) => {
      item(q, kind, i);
      if (typeof q?.query !== 'string' || !q.query.trim()) f.push(`${where}: ${kind}[${i}] has no query`);
      if (kind === 'shouldNotFire' && !(ELSEWHERE.has(q?.goesTo) || known.has(q?.goesTo))) f.push(`${where}: ${kind}[${i}]: goesTo "${q?.goesTo ?? ''}" is no skill, nor none, crisis or claude-md`);
      if (kind === 'shouldNotFire' && q?.goesTo === name) f.push(`${where}: ${kind}[${i}] goes to the skill it must not fire`);
    });
  }
  if (!Array.isArray(tests.scenarios)) f.push(`${where}: "scenarios" must be a list`);
  else
    tests.scenarios.forEach((s, i) => {
      item(s, 'scenarios', i);
      if (typeof s?.situation !== 'string' || !s.situation.trim()) f.push(`${where}: scenarios[${i}] has no situation`);
      for (const k of ['must', 'mustNever']) {
        if (!Array.isArray(s?.[k]) || !s[k].length || !s[k].every((x) => typeof x === 'string' && x.trim())) f.push(`${where}: scenarios[${i}] needs at least one "${k}" line`);
      }
    });
  return f;
}

// ── the collision heuristic ──────────────────────────────────────────────────
const STOP = new Set(
  'the a an and or but to of in on for with at by from as is are was were be been it its this that these those she her he his they them their i me my you your we our us use used uses using when what which who whom how not no never any every one some all about into out up down than then there here just can could would should will may might do does did done have has had get got so if only also more most other such own same very too again once over under after before because while where why each both few into via'.split(
    ' ',
  ),
);
const stem = (w) => w.replace(/(ings|ing|ed|es|s)$/, '');
const words = (text) => new Set(String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));

/** Report-only: queries that lean towards a skill other than the one they are written for. */
export function collisions(all, testsByName) {
  const notes = [];
  const docs = all.map((s) => ({ s, w: words(`${s.name} ${s.description}`) }));
  const df = new Map();
  for (const { w } of docs) for (const t of w) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t) => Math.log((docs.length + 1) / ((df.get(t) ?? 0) + 0.5));
  const score = (q, d) => [...q].filter((t) => d.w.has(t)).reduce((sum, t) => sum + idf(t), 0);
  const ranked = (query, audience) => {
    const q = words(query);
    return docs
      .filter((d) => audience !== 'her' || d.s.ships)
      .map((d) => ({ name: d.s.name, score: score(q, d) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  };
  for (const [name, t] of testsByName) {
    for (const q of t.shouldFire ?? []) {
      const r = ranked(q.query, q.audience);
      const own = r.find((x) => x.name === name)?.score ?? 0;
      // A lead worth a note: clearly ahead, not a single shared common word.
      if (r[0] && r[0].name !== name && r[0].score >= own + 1 && r[0].score > own * 1.5) notes.push(`${name} ${q.id}: leans to ${r[0].name} (${r[0].score.toFixed(1)} against ${own.toFixed(1)})`);
    }
    for (const q of t.shouldNotFire ?? []) {
      const r = ranked(q.query, q.audience);
      if (r[0]?.name === name && r[0].score > 0 && r[0].score > (r[1]?.score ?? 0)) notes.push(`${name} ${q.id}: leans to ${name} itself, though it belongs to ${q.goesTo}`);
    }
  }
  return notes;
}

// ── reading the tests and their results ──────────────────────────────────────
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** set-up's own tests predate evals.json and live in scenarios.md; counted where they are (PMM-010, reuse, not a second copy). */
function legacy(root, name) {
  const file = join(root, 'dev/skills', name, 'scenarios.md');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const rows = [...text.matchAll(/^\|\s*S\d+\s*\|.*\|\s*([^|]*)\|\s*$/gm)];
  const dispatch = text.split(/^## Dispatch/m)[1] ?? '';
  return {
    scenarios: rows.length,
    passed: rows.filter((r) => /\bpass\b/.test(r[1])).length,
    should: new Set(dispatch.match(/\bD\d{2}\b(?= ·)/g) ?? []).size,
    shouldNot: new Set(dispatch.match(/\bN\d{2}\b(?= ·)/g) ?? []).size,
  };
}

/**
 * Every skill's standing against the cache:
 * { name, queries, scenarios, firing, scenarioRun, reasons[], proven }.
 */
export function assess(root, { cache } = {}) {
  const { values } = cache ?? readCache(root);
  const num = (key) => {
    const n = Number(String(values.get(key)?.value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const minScenarios = num('evals.minScenarios');
  const minQueries = num('evals.triggerQueries');
  const all = skills(root);
  const known = new Set([...all.map((s) => s.name), ...all.map((s) => s.listed)]);
  const faults = [];
  const tests = new Map();
  const results = new Map();
  for (const name of list(join(root, 'dev/skills'))) {
    const file = join(root, 'dev/skills', name, TESTS);
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    let t;
    try {
      t = readJson(file);
    } catch (e) {
      faults.push(`dev/skills/${name}/${TESTS}: not valid JSON (${e.message.split('\n')[0]})`);
      continue;
    }
    const f = validate(t, name, known);
    faults.push(...f);
    if (!f.length) tests.set(name, t);
    const rfile = join(root, 'dev/skills', name, RESULTS);
    if (existsSync(rfile)) {
      try {
        results.set(name, readJson(rfile));
      } catch (e) {
        faults.push(`dev/skills/${name}/${RESULTS}: not valid JSON (${e.message.split('\n')[0]})`);
      }
    }
  }

  const rows = all.map((s) => {
    const reasons = [];
    const t = tests.get(s.name);
    const row = { name: s.name, queries: '0', scenarios: '0', firing: '—', scenarioRun: '—', reasons };
    if (!t) {
      const old = legacy(root, s.name);
      if (old) {
        row.queries = `${old.should + old.shouldNot}`;
        row.scenarios = `${old.scenarios}`;
        row.firing = 'recorded in scenarios.md';
        row.scenarioRun = `${old.passed} of ${old.scenarios} recorded pass`;
        reasons.push('tests kept in scenarios.md, not evals.json: must and must-never not apart, no run without it to compare');
      } else reasons.push('no tests');
      return row;
    }
    const nq = t.shouldFire.length + t.shouldNotFire.length;
    row.queries = `${nq}`;
    row.scenarios = `${t.scenarios.length}`;
    if (minQueries && nq < minQueries) reasons.push(`${nq} of ${minQueries} queries`);
    if (!t.shouldFire.length || !t.shouldNotFire.length) reasons.push('needs queries that should fire and that should not');
    if (minScenarios && t.scenarios.length < minScenarios) reasons.push(`${t.scenarios.length} of ${minScenarios} scenarios`);
    for (const a of t.audiences) {
      if (!t.shouldFire.some((q) => q.audience === a)) reasons.push(`no should-fire query from ${a}`);
      if (!t.scenarios.some((q) => q.audience === a)) reasons.push(`no scenario from ${a}`);
    }
    for (const a of declaredAudiences(readFileSync(s.file, 'utf8'))) {
      if (!t.audiences.includes(a)) reasons.push(`Audience line names ${a}, but no tests are written for them`);
    }
    const h = testHashes(t);
    const r = results.get(s.name) ?? {};
    if (!r.firing) reasons.push('firing never run');
    else {
      row.firing = `${r.firing.date} · ${r.firing.right} of ${r.firing.total}`;
      if (r.firing.hash !== h.firing) reasons.push('firing result older than the queries');
      else if (r.firing.right < r.firing.total) reasons.push(`firing missed ${r.firing.total - r.firing.right}`);
    }
    if (!r.scenarios) reasons.push('scenarios never run');
    else {
      const ran = r.scenarios.results ?? [];
      const passed = ran.filter((x) => x.with?.pass).length;
      row.scenarioRun = `${r.scenarios.date} · ${passed} of ${ran.length}`;
      if (r.scenarios.hash !== h.scenarios) reasons.push('scenario result older than the scenarios');
      else {
        // An all-load result, or one older than the load mode, measured a skill with every reference to hand: it never stands for the routed load.
        if (references(s.file).length && r.scenarios.load !== 'routed') reasons.push(`scenario result not routed (load ${r.scenarios.load ?? 'unrecorded'}), so routing is untested`);
        const broken = ran.filter((x) => x.with?.mustNeverBroken?.length).map((x) => x.id);
        if (broken.length) reasons.push(`must-never broken: ${broken.join(', ')}`);
        if (passed < ran.length) reasons.push(`scenarios failed ${ran.length - passed}`);
        if (!ran.every((x) => x.without)) reasons.push('no run without it to compare');
        else if (!ran.some((x) => x.with?.score > x.without?.score)) reasons.push('no better than without it (PRL-002)');
      }
    }
    return row;
  });
  for (const r of rows) r.proven = r.reasons.length === 0;
  return { rows, faults, tests, minScenarios, minQueries, collisions: collisions(all, tests) };
}

/** The unproven list's text. Deterministic: no date of its own, only the runs'. */
export function renderUnproven({ rows, minScenarios, minQueries }) {
  const unproven = rows.filter((r) => !r.proven);
  const proven = rows.filter((r) => r.proven).map((r) => `\`${r.name}\``);
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  return [
    '# Unproven skills',
    '',
    '_Generated by `node ux/scripts/check-skills.mjs --evals --write`, and checked at every commit by `--check`; never edited by hand. A skill is proven once its `dev/skills/<name>/evals.json` holds enough queries and scenarios from every audience it serves, and its recorded runs, newer than those tests, fired right every time, passed every scenario with no must-never broken, and did better than the same scenarios without it; for a skill with references, those runs were routed, each scenario loading only the files SKILL.md sent it to (PMM-010, PMM-011, PMM-015). Report only: the counts come from `.claude/skills/practice.md`, where both are `warn` (PMM-018)._',
    '',
    `**Measured against:** evals.triggerQueries ${minQueries ?? 'unset'} · evals.minScenarios ${minScenarios ?? 'unset'} · **Unproven:** ${unproven.length} of ${rows.length} · **Proven:** ${proven.length ? proven.join(', ') : 'none yet'}`,
    '',
    '| Skill | Queries | Scenarios | Firing run | Scenario run | Why unproven |',
    '|---|---|---|---|---|---|',
    ...unproven.map((r) => `| \`${r.name}\` | ${r.queries} | ${r.scenarios} | ${cell(r.firing)} | ${cell(r.scenarioRun)} | ${cell(r.reasons.join('; '))} |`),
    '',
  ].join('\n');
}

// ── live mode ────────────────────────────────────────────────────────────────
async function askApi(key, model, system, user, maxTokens = 8000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API ${res.status}: ${body?.error?.message ?? 'no message'}`);
  if (body.stop_reason === 'refusal') throw new Error('the model declined this request');
  return (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// The same call through `claude -p`, for a machine with Claude Code signed in
// and no API key. The system prompt goes on stdin (it can pass the 128 KB one
// argument may hold; the user's message, always shorter, is the argument) and replaces Claude Code's own; no tools, no settings, no
// MCP servers, no saved session, run from the system's temporary folder so no
// project's CLAUDE.md is read. This module still writes nothing (DSH-002).
export const cliArgs = (model, user) => ['-p', '--model', model, '--system-prompt-file', '/dev/stdin', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', user];
function askCli(bin, model, system, user) {
  if (Buffer.byteLength(user) > 120000) return Promise.reject(new Error('a prompt over 120 KB cannot go to claude -p as an argument'));
  return new Promise((resolve, reject) => {
    // Through `cat`, so claude's stdin is a real pipe: Node's own is a socket,
    // which /dev/stdin cannot be opened on (ENXIO). The arguments pass as "$@",
    // never through the shell's parsing.
    const child = spawn('sh', ['-c', 'cat | "$0" "$@"', bin, ...cliArgs(model, user)], { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 600000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude -p could not start (${e.message})`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(`claude -p exited ${code}: ${(err || out).trim().split('\n').pop() ?? ''}`));
    });
    child.stdin.on('error', () => {}); // a binary that never reads stdin closes it early
    child.stdin.end(system);
  });
}

/** One ask(model, system, user, maxTokens) for the backend chosen: { cli } for claude -p, else { key } for the API; null with neither. */
export function backend({ key, cli } = {}) {
  if (cli) return (model, system, user) => askCli(cli, model, system, user);
  if (key) return (model, system, user, maxTokens) => askApi(key, model, system, user, maxTokens);
  return null;
}

/** The words in a text, as a result counts what was loaded: runs of non-space. */
export const wordCount = (text) => String(text).split(/\s+/).filter(Boolean).length;

/** The reference files beside a SKILL.md, one level deep (PMM-015's limit), sorted; subfolders are not references. */
export function references(file) {
  const dir = dirname(file);
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== 'SKILL.md' && statSync(join(dir, n)).isFile())
    .sort();
}

/**
 * The .md files beyond those beside it that a SKILL.md routes to by a relative
 * path of its own, in a link or backticks: in another folder
 * (`../shared/rules.md`) or a subfolder of its own (`references/audit.md`,
 * still one level deep from SKILL.md, as PMM-015 counts depth), kept only
 * where the path resolves to a file inside `root` and outside data/ (her record
 * is never test material, ARC-004). Each as { name, rel }: name as SKILL.md
 * writes it, rel from the root. A routed pick may name one of these as well as
 * a file beside SKILL.md (PMM-015: the load follows SKILL.md's routes).
 */
export function routedOutside(file, root) {
  const dir = dirname(file);
  const text = readFileSync(file, 'utf8');
  const seen = new Map();
  for (const m of text.matchAll(/(?:\]\(|`)((?:\.\.\/|\.\/)?[A-Za-z0-9_.-]+\/[^\s)`#]*?\.md)(?:#[^\s)`]*)?(?:\)|`)/g)) {
    const abs = resolve(dir, m[1]);
    const rel = relative(resolve(root), abs);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue; // leaves the repository
    if (rel === 'data' || rel.startsWith('data/')) continue; // her record
    if (dirname(abs) === dir) continue; // beside SKILL.md: already a reference
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    const name = relative(dir, abs);
    if (!name.startsWith('..') && name.split('/').length > 2) continue; // a subfolder's subfolder: deeper than one level
    if (!seen.has(name)) seen.set(name, { name, rel });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The skill as loaded for an answer: SKILL.md, then the references named in
 * `pick` (every one beside it when `pick` is left out, the `--load all`
 * measure), each marked with its file name so a route ("read repair.md")
 * finds what it names. Subfolders are never loaded. With `root`, a pick may
 * also name a file SKILL.md routes to outside its folder (routedOutside), and
 * only such a file; `--load all` never adds them.
 * Returns { text, files, words }; words counts the files' own text.
 */
export function skillText(file, pick, root) {
  const dir = dirname(file);
  const refs = references(file).filter((n) => !pick || pick.includes(n));
  const outside = pick && root ? routedOutside(file, root).filter((o) => pick.includes(o.name)).map((o) => o.name) : [];
  const body = readFileSync(file, 'utf8');
  const parts = [`<skill path="SKILL.md">\n${body}\n</skill>`];
  let words = wordCount(body);
  for (const n of [...refs, ...outside]) {
    const ref = readFileSync(join(dir, n), 'utf8');
    words += wordCount(ref);
    parts.push(`<reference path="${n}">\n${ref}\n</reference>`);
  }
  return { text: parts.join('\n\n'), files: ['SKILL.md', ...refs, ...outside], words };
}

/**
 * Step one's answer read defensively: the first JSON list in it, every entry a
 * name from `offered` (a leading ./ forgiven, and a bare name where it names
 * one offered path alone), or one of `outside`, the files SKILL.md routes to
 * beyond its folder ({ name, rel }, by either form). Returns { files }, offered
 * order then outside order, or { error } when there is no list, it does not
 * parse, or it names any other file (`unreadable` true on the first three, which
 * the run asks again once): one in data/ or outside the repository
 * never reaches `outside`, so it is refused.
 */
export function parsePick(answer, offered, outside = []) {
  const text = String(answer ?? '');
  const open = text.indexOf('[');
  const close = text.indexOf(']', open);
  if (open < 0 || close < 0) return { error: `the pick held no JSON list: ${JSON.stringify(text.slice(0, 120))}`, unreadable: true };
  let list;
  try {
    list = JSON.parse(text.slice(open, close + 1));
  } catch {
    return { error: `the pick's list did not parse: ${JSON.stringify(text.slice(open, close + 1).slice(0, 120))}`, unreadable: true };
  }
  if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) return { error: 'the pick was not a list of file names', unreadable: true };
  const chosen = new Set();
  for (const raw of list) {
    const name = raw.trim().replace(/^\.\//, '');
    const away = outside.find((o) => o.name === name || o.rel === name);
    if (away) {
      chosen.add(away.name);
      continue;
    }
    const hit = offered.includes(name) ? [name] : offered.filter((o) => o.endsWith(`/${name}`));
    if (hit.length !== 1) return { error: `the pick named ${JSON.stringify(raw)}, which is not one of the files beside SKILL.md nor one it routes to` };
    chosen.add(hit[0]);
  }
  return { files: [...offered.filter((o) => chosen.has(o)), ...outside.map((o) => o.name).filter((n) => chosen.has(n))] };
}

// n at a time, the results in the order given.
async function inTurn(items, jobs, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, worker));
  return out;
}

// The answering model cannot use tools, so it says what it would read or write
// before a "Reply:" line; the grader judges actions from that note and what
// the person would see only from the reply, as in a real session, where reads
// and writes are tool calls she never sees.

// A seeded shuffle, so a run can be repeated and the listing order still varies by query.
const shuffled = (items, seed) => {
  const a = [...items];
  let x = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DISPATCH =
  'You choose which skill an assistant loads for a message. You see only the list of skills, each a name and a description. Name the one skill whose description says it is for this message, or none if no skill fits. Reply with the skill name alone, or none.';
const RESPOND =
  'You are the assistant working in the repository whose instructions follow. This is a test: you cannot use tools, so say briefly what you would read or write, then a line reading only "Reply:", then the reply you would send.';
const LOADED =
  'This skill has loaded; follow it. Its SKILL.md comes first; the references beside it follow, each as it would be if you opened it when SKILL.md sends you there:';
const LOADED_ROUTED =
  'This skill has loaded; follow it. Its SKILL.md comes first; the references you chose to open follow, each as it reads when opened. Files beside SKILL.md that you did not open are not shown:';
const PICK =
  'You decide which files an assistant opens before it answers. It works in the repository whose instructions follow, and a skill has loaded: its SKILL.md is below, then the names of the files beside it, which it has not opened. For the situation in the next message, name the files it would open, as SKILL.md routes it, and no others; none if SKILL.md is enough. Reply with JSON only: a list of the file names exactly as listed, such as ["a.md"], or [] for none.';
const PICK_AGAIN =
  'Your last answer could not be read as a list. Answer with the JSON list only: no words before or after it, no code fence, nothing but the list, such as ["a.md"] or [].';
// The pick's question, the list instruction last so it is the final thing the
// model reads (an answer in prose was the pick's commonest failure): the
// situation, then "the list only, starting with [".
const PICK_LAST = 'Answer with the JSON list only, your first character "[" and your last "]": the file names exactly as listed, or [] for none. No words, no code fence.';
export const pickAsk = (situation) => `Situation: ${situation}\n\n${PICK_LAST}`;
export const LOAD_MODES = ['routed', 'all'];
const GRADE =
  'You grade two replies, A and B, to the same situation against written expectations. Each may open with a note of what the assistant would read or write, ended by a line "Reply:"; that note stands for its tool calls and is never shown to the person, so judge actions from it and judge what the person sees (wording, setup words, length) only from what follows "Reply:". For each reply, mark each "must" line met (true) or not (false), and each "must never" line broken (true) or not (false). Judge outcomes, not wording. Reply with JSON only: {"A":{"must":[...],"mustNever":[...]},"B":{"must":[...],"mustNever":[...]}}';

// --show: for the scenario ids named, the run also prints what the pick said,
// the answer with the skill, the grader's marks and, from one more grader call
// that changes no mark, its reason for each line. Everything printed is a
// model's answer to the harness and a scenario; no file in data/ is ever read
// (routedOutside refuses one), so nothing from her record can reach the screen.
const WHY =
  'A grader marked the reply below against written expectations; its marks follow the reply. For each "must" line and each "must never" line, in order, give the mark as given and say in one short sentence what in the reply accounts for it: quote the words if there are any, or say what is missing. Never change a mark. Plain lines, one per expectation, each starting with its label (must 1, must never 1, ...).';
const showBlock = (log, label, text) => log(`  ── ${label}\n${String(text).split('\n').map((l) => `    | ${l}`).join('\n')}`);

export async function live(root, { ask, model, grader, only, runs = 1, jobs = 1, via = 'api', load = 'routed', put = null, log = console.log, show = null }) {
  const { tests } = assess(root);
  const all = skills(root);
  const harness = existsSync(join(root, 'CLAUDE.md')) ? readFileSync(join(root, 'CLAUDE.md'), 'utf8') : '';
  const today = new Date().toISOString().slice(0, 10);
  const showing = (s) => Boolean(show && show.includes(s.id));
  for (const [name, t] of tests) {
    if (only && only !== name) continue;
    // One folder of tests can stand for two skills of one name, a core pointer
    // and the module body it hands to (supplements): either listed name firing
    // is the skill firing, and both load, pointer first, as a reader would follow it.
    const same = all.filter((s) => s.name === name);
    const h = testHashes(t);
    const queries = [...t.shouldFire.map((q) => ({ ...q, fire: true })), ...t.shouldNotFire.map((q) => ({ ...q, fire: false }))];
    // A --show run looks at the scenarios it names and nothing else: no firing
    // queries, no other scenario, and (main refuses --write with it) no result kept.
    const asks = [];
    if (!show) for (let run = 0; run < runs; run++) for (const q of queries) asks.push({ q, run });
    const said = await inTurn(asks, jobs, async ({ q, run }) => {
      const reachable = all.filter((s) => q.audience !== 'her' || s.ships);
      const listing = shuffled(reachable, `${q.id}${run}`).map((s) => `- ${s.listed}: ${s.description}`).join('\n');
      return (await ask(model, DISPATCH, `Skills:\n${listing}\n\nMessage: ${q.query}`, 2000)).split('\n')[0].replace(/[`*"]/g, '').trim();
    });
    let right = 0;
    const wrong = [];
    asks.forEach(({ q }, i) => {
      const fired = said[i] === name || same.some((s) => said[i] === s.listed);
      if (fired === q.fire) right++;
      else wrong.push(`${q.id}→${said[i]}`);
    });
    const firing = { date: today, model, via, runs, right, total: queries.length * runs, wrong, hash: h.firing };
    if (!show) log(`  ${name}: firing ${right} of ${firing.total}${wrong.length ? ` · wrong ${wrong.join(', ')}` : ''}`);

    // Each skill's files under the names a reader is shown: bare for one
    // skill, by folder for two, so a pick says whose reference it means.
    const prefix = (sk) => (same.length === 1 ? '' : `${dirname(sk.rel)}/`);
    const pickable = same.flatMap((sk) => references(sk.file).map((n) => `${prefix(sk)}${n}`));
    const offered = same.flatMap((sk) => skillText(sk.file).files.map((f) => `${prefix(sk)}${f}`));
    const outside = same.flatMap((sk) => routedOutside(sk.file, root).map((o) => ({ name: `${prefix(sk)}${o.name}`, rel: o.rel })));
    const routed = load === 'routed' && pickable.length + outside.length > 0;
    // The skill with the references in `pick` (all when null), as one load.
    const loadWith = (pick) => {
      const texts = same.map((sk) => skillText(sk.file, pick && pick.filter((p) => p.startsWith(prefix(sk))).map((p) => p.slice(prefix(sk).length)), root));
      return { text: texts.map((x) => x.text).join('\n\n'), files: same.flatMap((sk, i) => texts[i].files.map((f) => `${prefix(sk)}${f}`)), words: texts.reduce((n, x) => n + x.words, 0) };
    };
    const everything = loadWith(null);
    log(`  ${name}: with the skill, ${routed ? `routed: SKILL.md, then what each scenario picks of ${[...pickable, ...outside.map((o) => o.name)].join(', ')}` : `loads ${everything.files.join(', ')}`}`);
    const scenarios = show ? t.scenarios.filter(showing) : t.scenarios;
    if (show && !scenarios.length) continue;
    const results = await inTurn(scenarios, jobs, async (s) => {
      let loaded = everything;
      if (routed) {
        const bare = loadWith([]);
        const shown = `<instructions>\n${harness}\n</instructions>\n\n${bare.text}\n\nFiles beside SKILL.md, not opened:\n${pickable.map((n) => `- ${n}`).join('\n')}${outside.length ? `\n\nFiles SKILL.md routes to elsewhere, not opened:\n${outside.map((o) => `- ${o.name}`).join('\n')}` : ''}`;
        const first = await ask(model, `${PICK}\n\n${shown}`, pickAsk(s.situation), 2000);
        if (showing(s)) showBlock(log, `${name} ${s.id} pick`, first);
        let picked = parsePick(first, pickable, outside);
        // An answer in prose is the test's failure to read it, not the skill's:
        // asked once more, stricter; a pick that still does not parse is the
        // failure it always was. A pick naming a wrong file is never re-asked.
        if (picked.unreadable) {
          const again = await ask(model, `${PICK}\n\n${PICK_AGAIN}\n\n${shown}`, pickAsk(s.situation), 2000);
          if (showing(s)) showBlock(log, `${name} ${s.id} pick, asked again`, again);
          picked = parsePick(again, pickable, outside);
        }
        if (picked.error) {
          log(`  ${name} ${s.id}: with fail, ${picked.error}`);
          return { id: s.id, read: null, words: null, with: { pass: false, score: 0, mustMissed: [...s.must], mustNeverBroken: [], error: picked.error }, without: null };
        }
        loaded = loadWith(picked.files);
      }
      const [withIt, without] = await Promise.all([
        ask(model, `${RESPOND}\n\n<instructions>\n${harness}\n</instructions>\n\n${routed ? LOADED_ROUTED : LOADED}\n${loaded.text}`, s.situation),
        ask(model, `${RESPOND}\n\n<instructions>\n${harness}\n</instructions>`, s.situation),
      ]);
      const flip = s.id.charCodeAt(s.id.length - 1) % 2 === 1;
      const [A, B] = flip ? [without, withIt] : [withIt, without];
      const expectations = `Situation: ${s.situation}\n\nMust:\n${s.must.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nMust never:\n${s.mustNever.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
      const verdict = await ask(grader, GRADE, `${expectations}\n\n<reply id="A">\n${A}\n</reply>\n\n<reply id="B">\n${B}\n</reply>`, 4000);
      let g;
      try {
        g = JSON.parse(verdict.slice(verdict.indexOf('{'), verdict.lastIndexOf('}') + 1));
      } catch {
        throw new Error(`the grader's answer for ${name} ${s.id} was not JSON`);
      }
      const mark = (v) => {
        const mustMissed = s.must.filter((_, i) => v?.must?.[i] !== true);
        const mustNeverBroken = s.mustNever.filter((_, i) => v?.mustNever?.[i] === true);
        return { pass: !mustMissed.length && !mustNeverBroken.length, score: s.must.length - mustMissed.length - 2 * mustNeverBroken.length, mustMissed, mustNeverBroken };
      };
      if (showing(s)) {
        showBlock(log, `${name} ${s.id} answer with the skill (read ${loaded.files.join(', ')})`, withIt);
        showBlock(log, `${name} ${s.id} grader's marks (A is ${flip ? 'without' : 'with'} the skill)`, verdict);
        const marks = flip ? g.B : g.A;
        const why = await ask(grader, WHY, `${expectations}\n\n<reply>\n${withIt}\n</reply>\n\nMarks: must ${JSON.stringify(marks?.must ?? [])} (true is met), must never ${JSON.stringify(marks?.mustNever ?? [])} (true is broken)`, 4000);
        showBlock(log, `${name} ${s.id} grader's reasons, with the skill`, why);
      }
      const r = { id: s.id, read: loaded.files, words: loaded.words, with: mark(flip ? g.B : g.A), without: mark(flip ? g.A : g.B) };
      log(`  ${name} ${s.id}: read ${r.read.join(', ')} (${r.words} words) · with ${r.with.pass ? 'pass' : 'fail'} (${r.with.score}) · without ${r.without.pass ? 'pass' : 'fail'} (${r.without.score})`);
      return r;
    });
    if (put && !show) put(`dev/skills/${name}/${RESULTS}`, resultsText({ firing, scenarios: { date: today, model, grader, via, load, offered, hash: h.scenarios, results } }));
  }
}

// ── the command line ─────────────────────────────────────────────────────────
/**
 * The run. `put(rel, text)` writes a file under root; it is the caller's, so
 * this module, which sits in the app's lib/, writes nothing itself (DSH-002).
 */
export async function main(argv, root, put) {
  const flag = (f) => argv.includes(f);
  const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  let a;
  try {
    a = assess(root);
  } catch (e) {
    console.error(`\n  SKILL EVALS FAILED\n\n  ${e.message}\n`);
    return 1;
  }
  for (const c of a.collisions) console.log(`  overlap  ${c} (heuristic, report only)`);
  const unproven = a.rows.filter((r) => !r.proven);
  console.log(`  tests: ${a.tests.size} skills with evals.json · ${unproven.length} of ${a.rows.length} unproven, against ${CACHE} (evals.triggerQueries ${a.minQueries ?? 'unset'}, evals.minScenarios ${a.minScenarios ?? 'unset'}; warn only, PMM-018)`);

  if (flag('--live')) {
    const load = opt('--load') ?? 'routed';
    if (!LOAD_MODES.includes(load)) {
      console.error(`\n  SKILL EVALS: --load is ${LOAD_MODES.join(' or ')}, not "${load}"\n`);
      return 1;
    }
    if (flag('--show') && flag('--write')) {
      console.error('\n  SKILL EVALS: --show runs only the scenarios it names, so it keeps no result: drop --write\n');
      return 1;
    }
    const useCli = flag('--cli') || process.env.DEAR_EVAL_BACKEND === 'cli';
    const ask = backend(useCli ? { cli: process.env.DEAR_EVAL_CLAUDE || 'claude' } : { key: process.env.ANTHROPIC_API_KEY });
    if (!ask) {
      console.log('  live: no ANTHROPIC_API_KEY in the environment, so nothing was run and no result was recorded (--cli sends the prompts through claude -p instead)');
      return 0;
    }
    const model = process.env.DEAR_EVAL_MODEL || DEFAULT_MODEL;
    const grader = process.env.DEAR_EVAL_GRADER_MODEL || model;
    try {
      await live(root, { ask, model, grader, via: useCli ? 'claude -p' : 'api', load, only: opt('--skill'), runs: Math.max(1, Number(opt('--runs')) || 1), jobs: Math.max(1, Number(opt('--jobs')) || 1), put: flag('--write') ? put : null, show: opt('--show') ? opt('--show').split(',').map((x) => x.trim()).filter(Boolean) : null });
    } catch (e) {
      console.error(`\n  SKILL EVALS: the live run stopped: ${e.message}\n`);
      return 1;
    }
    a = assess(root);
  }

  const file = join(root, UNPROVEN);
  const text = renderUnproven(a);
  if (flag('--write')) {
    put(UNPROVEN, text);
    console.log(`  wrote ${UNPROVEN}`);
  }
  const faults = [...a.faults];
  // The list lives in dev/, which a copy for someone else does not have (ARC-008):
  // there it is not kept, so it cannot be stale. Where dev/ is, it is checked.
  const kept = existsSync(join(root, UNPROVEN.split('/')[0]));
  if (flag('--check') && kept && (!existsSync(file) || readFileSync(file, 'utf8') !== text)) faults.push(`${UNPROVEN} is stale: run node ux/scripts/check-skills.mjs --evals --write`);
  if (faults.length) {
    console.error(['', '  SKILL EVALS FAILED', '', ...faults.map((f) => `  - ${f}`), ''].join('\n'));
    return 1;
  }
  console.log(`skill evals: ${a.tests.size} test files well formed, ${unproven.length} unproven (${UNPROVEN}, rewritten by --write)`);
  return 0;
}
