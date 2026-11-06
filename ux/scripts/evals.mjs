#!/usr/bin/env node
// The eval cards (WKB-007, D49; A-012): every eval is a card in dev/evals/cards/
// answering six questions from closed sets, with its run history kept beside it.
//
//   node ux/scripts/evals.mjs list                 every card, its answers and latest verdict
//   node ux/scripts/evals.mjs run --all | E-NNN    run the cards graded by code; append to history/<day>.jsonl
//   node ux/scripts/evals.mjs run --personas       run the cards a persona acts in (dev/evals/runner.mjs)
//   node ux/scripts/evals.mjs run --personas --oldest <n>   only the n whose last run is oldest (the daily loop)
//   node ux/scripts/evals.mjs stale                cards whose last run is too old: a check that stopped running (A-007)
//   node ux/scripts/evals.mjs model <model id>     record the model; exit 3 when it changed, so everything re-runs (D46)
//   node ux/scripts/evals.mjs coverage             the combinations no card covers; fails on an agreement with none
//   node ux/scripts/evals.mjs check                every card's answers from the closed sets (commit gate)
//   node ux/scripts/evals.mjs drift                cards that passed their run before last and fail now
//   node ux/scripts/evals.mjs last-pass            the last commit where every code-graded card passed, clean (/rollback)
//
// A card graded by code names a command, `node <path> [args]`, run from the
// repository root: only node, only a file that exists, never a shell, so a card
// cannot run anything a reviewer would not see. Its exit status is the verdict.
// History is append-only, one JSON line per card run and one per whole run,
// each with the commit it ran on, so `/rollback` can find the last all-pass.
//
// It lives in ux/scripts/ so the commit gate can run `check`, and does nothing
// where dev/evals/ is absent, so a copy without dev/ works whole (ARC-008).

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { readTranscript, standingCards } from './dialogue.mjs';
import { appendHistory, readHistory as readDays } from './eval-history.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EVALS = join(REPO, DEV_DIR, 'evals');
const CARDS = join(EVALS, 'cards');
const PERSONAS = join(EVALS, 'personas');
export const HISTORY = join(EVALS, 'history');

/** The closed answer sets (proposal, "Evals: one card per eval"). */
export const ANSWERS = {
  what: ['one-response', 'one-run', 'system', 'world'],
  where: ['words', 'code', 'running', 'records'],
  who_acts: ['nobody', 'script', 'persona', 'troublemaker'],
  who_grades: ['code', 'judge', 'person'],
  when: ['before-landing', 'scheduled', 'real-use'],
  how: ['exact', 'must-never', 'rubric', 'vs-last-run'],
  status: ['runnable', 'not-runnable-yet'],
};
/** The 14 aspects (notes/evals-research.md, P8): ISO/IEC 25010, NIST AI RMF, and her life. */
export const ASPECTS = ['does-what-it-should', 'reliable', 'fast', 'works-with-others', 'easy-to-use', 'secure', 'easy-to-change', 'adapts', 'safe', 'accountable', 'explainable', 'private', 'fair', 'her-life'];
const REQUIRED = ['id', 'title', 'why', 'what', 'where', 'who_acts', 'who_grades', 'when', 'how', 'runs', 'pass_mark', 'status'];
const KNOWN = new Set([...REQUIRED, 'persona', 'command', 'blocked_by']);

/**
 * Whether a card can run (T-273): an agreement counts as having an eval only when a card naming
 * it can run. A card missing its status is read as runnable, as `check` refuses it anyway.
 */
export const runnable = (card) => card.status !== 'not-runnable-yet';

/** The frontmatter of a card or persona: `key: value` lines, `[a, b]` read as a list. */
export function parseFront(text) {
  const m = String(text ?? '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    out[kv[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v;
  }
  return out;
}

const listFiles = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort() : []);

export function readCards(dir = CARDS) {
  return listFiles(dir, /^E-\d{3}\.md$/).map((file) => {
    const text = readFileSync(join(dir, file), 'utf8');
    // Two chats both added this number, and a merge left git's markers in it.
    if (/^<{7} /m.test(text)) return { file, conflict: true };
    return { file, ...(parseFront(text) ?? {}) };
  });
}

export function readPersonas(dir = PERSONAS) {
  return listFiles(dir, /^[PX]-\d{2}\.md$/).map((f) => parseFront(readFileSync(join(dir, f), 'utf8'))?.id).filter(Boolean);
}

/** The command's parts, or why it cannot run: `node <existing file> [args]` only. */
export function commandParts(command, root = REPO) {
  const parts = String(command ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts[0] !== 'node' || !parts[1]) return { error: `the command must be "node <path> [args]", not "${command}"` };
  if (parts[1].startsWith('-') || parts[1].startsWith('/') || parts[1].includes('..')) return { error: `the command's script must be a path inside the repository, not "${parts[1]}"` };
  if (!existsSync(join(root, parts[1]))) return { error: `the command's script ${parts[1]} does not exist` };
  return { script: parts[1], args: parts.slice(2) };
}

/**
 * What a card gets wrong, as plain sentences: a missing field, an answer from
 * none of the closed sets, an agreement or persona that does not exist, and a
 * card graded by code that cannot run, or runs with nothing to grade it.
 */
export function cardFaults(card, { agreements = [], personas = [], root = REPO } = {}) {
  const id = card.id ?? card.file;
  if (card.conflict) return [`${card.file}: two chats both added this card and the merge stopped on it; run node ux/scripts/dialogue.mjs resolve, which keeps main's card at this number and moves this chat's, with its scenario, runs and references, to the next free one`];
  const f = [];
  if (card.file && card.id && card.file !== `${card.id}.md`) f.push(`${card.file}: its id is ${card.id}; the file is named after its id`);
  for (const k of REQUIRED) if (card[k] === undefined || card[k] === '') f.push(`${id}: no ${k}`);
  for (const k of Object.keys(card)) if (k !== 'file' && !KNOWN.has(k)) f.push(`${id}: "${k}" is no field of a card`);
  for (const [k, set] of Object.entries(ANSWERS)) if (card[k] !== undefined && !set.includes(card[k])) f.push(`${id}: ${k} is "${card[k]}"; it is one of ${set.join(' · ')}`);
  const why = Array.isArray(card.why) ? card.why : card.why ? [card.why] : [];
  const cited = why.filter((w) => /^A-\d+$/.test(w));
  if (!cited.length) f.push(`${id}: why names no agreement (A-NNN)`);
  for (const a of cited) if (!agreements.includes(a)) f.push(`${id}: ${a} is no agreement card`);
  const aspects = why.filter((w) => !/^A-\d+$/.test(w));
  if (!aspects.length) f.push(`${id}: why names none of the 14 aspects`);
  for (const a of aspects) if (!ASPECTS.includes(a)) f.push(`${id}: "${a}" is none of the 14 aspects (${ASPECTS.join(' · ')})`);
  if (['persona', 'troublemaker'].includes(card.who_acts) && !personas.includes(card.persona)) f.push(`${id}: a ${card.who_acts} acts, so persona names one in personas/ (not "${card.persona ?? ''}")`);
  const runs = Number(card.runs);
  if (card.runs !== undefined && !(Number.isInteger(runs) && runs >= 1)) f.push(`${id}: runs is "${card.runs}"; a whole number, 1 or more`);
  const mark = Number(card.pass_mark);
  if (card.pass_mark !== undefined && !(mark > 0 && mark <= 1)) f.push(`${id}: pass_mark is "${card.pass_mark}"; a share above 0, up to 1`);
  if (card.command !== undefined) {
    // A judge grades only through the runner that tests the judge first (dev/evals/runner.mjs),
    // on the card's own scenario; anything else naming a command is graded by code.
    const runner = `node ${DEV_DIR}/evals/runner.mjs ${card.id}`;
    if (card.who_grades === 'judge') {
      if (card.command !== runner) f.push(`${id}: a judge grades it, so its command is exactly "${runner}"`);
      else if (!existsSync(join(root, DEV_DIR, 'evals', 'scenarios', `${card.id}.json`))) f.push(`${id}: a judge grades it, but ${DEV_DIR}/evals/scenarios/${card.id}.json, the turns the persona plays, is missing`);
    } else if (card.who_grades !== 'code') f.push(`${id}: it names a command, so code or the judge's runner grades it (who_grades: code or judge)`);
    const parts = commandParts(card.command, root);
    if (parts.error) f.push(`${id}: ${parts.error}`);
  }
  if (card.status === 'runnable' && card.command === undefined) f.push(`${id}: runnable, but names no command; mark it not-runnable-yet until it can run`);
  if (card.status === 'not-runnable-yet' && card.command !== undefined) f.push(`${id}: names a command, so it is runnable`);
  // A card that cannot run says, in one line, what it waits on (T-273), so "written" never passes for "running".
  if (card.status === 'not-runnable-yet' && !String(card.blocked_by ?? '').trim()) f.push(`${id}: not runnable yet, so blocked_by says in one line what it waits on (an account, a device, a real person)`);
  if (card.status === 'runnable' && card.blocked_by !== undefined) f.push(`${id}: runnable, so nothing blocks it; drop blocked_by`);
  return f;
}

/** The whole history, oldest first, from its day files (ux/scripts/eval-history.mjs). */
export function readHistory(dir = HISTORY) {
  return readDays(dir);
}

/** Each card's verdicts, oldest first. A run that could not run (`not run`) graded nothing, so it is left out. */
const verdicts = (history) => {
  const by = new Map();
  for (const h of history) if (h.kind === 'card' && h.verdict !== NOT_RUN) by.set(h.card, [...(by.get(h.card) ?? []), h]);
  return by;
};

export const latest = (history) => new Map([...verdicts(history)].map(([id, hs]) => [id, hs.at(-1)]));

/**
 * What a card tests, as a short hash: its test line and, for a judged card, the scenario
 * the persona plays. Kept on each card line of the history, so a pass is read against the
 * test it passed.
 */
export function testHash(card, root = REPO) {
  const id = card.id ?? '';
  const file = join(root, DEV_DIR, 'evals', 'cards', `${id}.md`);
  const text = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  const line = text.match(/^\*\*The test:\*\*.*$/m)?.[0] ?? '';
  const scenario = join(root, DEV_DIR, 'evals', 'scenarios', `${id}.json`);
  const turns = existsSync(scenario) ? readFileSync(scenario, 'utf8').replace(/\r\n/g, '\n') : '';
  return createHash('sha256').update(`${line}\n${turns}`).digest('hex').slice(0, 12);
}

/**
 * Cards whose run before last passed and whose last run failed: drift (How: vs-last-run).
 * A pass against a test since rewritten is no "passed before": where both lines carry the
 * test they ran and it differs, the card has not regressed, it has never passed its new test
 * (E-047 and E-052, 2026-11-03: passes on placeholder cards, fails on the cards that replaced
 * them). A line written before the hash was kept is compared as before.
 */
export function regressions(history) {
  const sameTest = (a, b) => !a.test || !b.test || a.test === b.test;
  return [...verdicts(history)].filter(([, hs]) => hs.length > 1 && hs.at(-2).verdict === 'pass' && hs.at(-1).verdict === 'fail' && sameTest(hs.at(-2), hs.at(-1))).map(([id]) => id);
}

/** The last whole run (`run --all`) that passed every card, on a clean tree: where /rollback returns to. */
export function lastAllPass(history) {
  return history.filter((h) => h.kind === 'run' && h.scope === 'all' && h.verdict === 'pass' && !h.dirty).at(-1) ?? null;
}

/** The combinations that matter (D49): a run with these answers is what a gap looks like. */
export const MATTERS = [
  ['a persona using the running system', { who_acts: 'persona', where: 'running' }],
  ['a troublemaker trying to get in', { who_acts: 'troublemaker' }],
  ['an AI judge, tested on known cases', { who_grades: 'judge' }],
  ['drift, compared with the last run', { how: 'vs-last-run' }],
  ['from real use', { when: 'real-use' }],
  ['the world outside the system', { what: 'world' }],
  ['the running system, checked by code', { where: 'running', who_grades: 'code' }],
  ['its records (logs, history)', { where: 'records' }],
];

export function coverage(cards, agreements) {
  const runnable = cards.filter((c) => c.status === 'runnable');
  const has = (list, test) => list.some(test);
  const why = (c) => (Array.isArray(c.why) ? c.why : []);
  const combos = MATTERS.map(([name, want]) => {
    const fits = (c) => Object.entries(want).every(([k, v]) => c[k] === v);
    return { name, any: has(cards, fits), runnable: has(runnable, fits) };
  });
  return {
    unprotected: agreements.filter((a) => !has(cards, (c) => why(c).includes(a))),
    onPaper: agreements.filter((a) => has(cards, (c) => why(c).includes(a)) && !has(runnable, (c) => why(c).includes(a))),
    aspects: ASPECTS.filter((a) => !has(cards, (c) => why(c).includes(a))),
    answers: Object.entries(ANSWERS).filter(([k]) => k !== 'status').flatMap(([k, set]) => set.filter((v) => !has(cards, (c) => c[k] === v)).map((v) => `${k}: ${v}`)),
    combos,
  };
}

/** How old a card's last run may be: a day's run missed once is allowed, a week's too. */
// Persona checks run daily since T-248, the oldest PERSONA_BATCH each day since T-340 (the owner:
// "Okay do as u recommend"), since all of them could not finish inside one sweep (4 and 5 of 30,
// 2026-10-26 and 28): each comes round about every nine days, so ten allows one missed day.
export const PERSONA_BATCH = 4;
export const STALE_DAYS = { daily: 2, weekly: 10 };

/** The `n` runnable persona cards whose last run is oldest, never-run first: a daily rotation. */
export function oldestPersonas(cards, history, n) {
  const last = latest(history);
  const age = (c) => (last.get(c.id) ? Date.parse(last.get(c.id).date) : -Infinity);
  return cards.filter((c) => c.status === 'runnable' && actsAsPerson(c)).sort((a, b) => age(a) - age(b) || a.id.localeCompare(b.id)).slice(0, n);
}

/**
 * Watching the watchers (A-007, *Failed if:* a check stopped running and nobody told me):
 * every runnable card whose last run is older than its cadence allows, or that never ran.
 * The daily cards are graded by code; the persona ones run weekly.
 */
export function staleCards(cards, history, now = Date.now()) {
  const last = latest(history);
  return cards.filter((c) => c.status === 'runnable').flatMap((c) => {
    const limit = STALE_DAYS[actsAsPerson(c) ? 'weekly' : 'daily'];
    const run = last.get(c.id);
    const age = run ? (now - Date.parse(run.date)) / 86_400_000 : Infinity;
    return age > limit ? [{ id: c.id, weekly: actsAsPerson(c), age: Number.isFinite(age) ? Math.floor(age) : null }] : [];
  });
}

/** A card a persona or troublemaker acts in: slow and paid, so it runs apart from the code cards. */
export const actsAsPerson = (card) => ['persona', 'troublemaker'].includes(card.who_acts);

/**
 * Whether the model differs from the one last recorded (D46, A-013): the first one seen
 * counts as a change, since nothing has been checked on it yet. Returns the line to record.
 */
export function modelChange(history, model) {
  const last = history.filter((h) => h.kind === 'model').at(-1);
  if (last?.model === model) return null;
  return { kind: 'model', date: new Date().toISOString(), model, previous: last?.model ?? null };
}

/** The runner's exit 2: it could not run (no `claude`, an untrusted judge), so nothing was graded. */
export const NOT_RUN = 'not run';

/**
 * Runs one card graded by code, `runs` times; it passes when the share passing reaches its pass mark.
 * A try that exits 2 could not run, so it counts neither way; a card none of whose tries ran is `not run`.
 */
export function runCard(card, root = REPO) {
  const parts = commandParts(card.command, root);
  if (parts.error) return { verdict: 'fail', passes: 0, runs: 0, ms: 0, out: parts.error };
  const runs = Number(card.runs) || 1;
  let passes = 0;
  let ran = 0;
  let out = '';
  const t = Date.now();
  for (let i = 0; i < runs; i++) {
    // A persona's run talks to a whole session several turns long, so it gets half an hour.
    const timeout = actsAsPerson(card) ? 1_800_000 : 300_000;
    const r = spawnSync(process.execPath, [parts.script, ...parts.args], { cwd: root, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024 });
    if (r.status !== 2) ran += 1;
    if (r.status === 0) passes += 1;
    else out = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`.trim().split('\n').slice(-6).join('\n');
  }
  if (!ran) return { verdict: NOT_RUN, passes: 0, runs: 0, ms: Date.now() - t, out };
  const verdict = passes / ran >= Number(card.pass_mark || 1) ? 'pass' : 'fail';
  return { verdict, passes, runs: ran, ms: Date.now() - t, out };
}

const git = (...args) => { try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
// Every standing card, several to a remark where it carries them; a merged card no longer counts.
const agreementIds = () => standingCards(readTranscript()).map((e) => e.card.id);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && !existsSync(CARDS)) {
  console.log(`evals: no ${DEV_DIR}/evals/cards/ in this copy (ARC-008), nothing to do`);
  process.exit(0);
}
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const cards = readCards();
  const history = readHistory();
  if (cmd === 'check') {
    const agreements = agreementIds();
    const personas = readPersonas();
    const ids = cards.map((c) => c.id);
    const faults = cards.flatMap((c) => cardFaults(c, { agreements, personas }));
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) faults.push(`${id} is the id of two cards`);
    if (faults.length) {
      console.error(`evals: ${faults.length} fault(s) in the cards:\n${faults.map((f) => `  - ${f}`).join('\n')}`);
      process.exit(1);
    }
    console.log(`evals: all ${cards.length} cards answer the six questions from the closed sets`);
  } else if (cmd === 'list') {
    const last = latest(history);
    for (const c of cards) {
      const v = last.get(c.id);
      const mark = c.status !== 'runnable' ? '·  written, not running' : !v ? '?  never run (or could not)' : v.verdict === 'pass' ? `✓  pass ${v.date.slice(0, 10)}` : `✗  FAIL ${v.date.slice(0, 10)}`;
      console.log(`${c.id}  ${mark.padEnd(22)} ${[].concat(c.why).join(' ')} · ${c.what}/${c.where}/${c.who_acts}/${c.who_grades}/${c.when}/${c.how} · ${c.title}${c.blocked_by ? `\n      blocked by: ${c.blocked_by}` : ''}`);
    }
  } else if (cmd === 'run' && (rest.length === 1 || (rest[0] === '--personas' && rest[1] === '--oldest' && rest.length === 3))) {
    // `--all` is the fast daily run; `--personas` the slow weekly one, where a persona or a
    // troublemaker talks to a throwaway copy, which costs money per run, so the two never mix.
    const personas = rest[0] === '--personas';
    const all = rest[0] === '--all' || personas;
    const oldest = rest[1] === '--oldest' ? Number(rest[2]) : null;
    if (oldest !== null && !(Number.isInteger(oldest) && oldest > 0)) {
      console.error(`evals: --oldest takes a count, not "${rest[2]}"`);
      process.exit(2);
    }
    const chosen = oldest ? oldestPersonas(cards, readHistory(), oldest) : all ? cards.filter((c) => c.status === 'runnable' && actsAsPerson(c) === personas) : cards.filter((c) => c.id === rest[0]);
    if (!chosen.length) {
      console.error(`evals: no card ${rest[0]}`);
      process.exit(2);
    }
    if (!all && chosen[0].status !== 'runnable') {
      console.error(`evals: ${chosen[0].id} is not runnable yet (who grades: ${chosen[0].who_grades}); nothing run`);
      process.exit(2);
    }
    const commit = git('rev-parse', '--short', 'HEAD');
    const dirty = git('status', '--porcelain', '--', '.', `:(exclude)${DEV_DIR}/evals/history`) !== '';
    const date = new Date().toISOString();
    const lines = [];
    const failed = [];
    const notRun = [];
    for (const c of chosen) {
      const r = runCard(c);
      if (r.verdict === 'fail') failed.push(c.id);
      if (r.verdict === NOT_RUN) notRun.push(c.id);
      // Each card is recorded as it finishes, so a card that reads the history (E-030, which
      // watches for checks that stopped running) sees the ones run before it in this run.
      appendHistory(HISTORY, { kind: 'card', date, card: c.id, verdict: r.verdict, passes: r.passes, runs: r.runs, ms: r.ms, commit, dirty, test: testHash(c) });
      console.log(`${r.verdict === 'pass' ? 'pass' : r.verdict === NOT_RUN ? 'NOT RUN' : 'FAIL'}  ${c.id}  ${String(r.ms).padStart(6)} ms  ${c.title}${r.verdict !== 'pass' && r.out ? `\n      ${r.out.replace(/\n/g, '\n      ')}` : ''}`);
    }
    lines.push({ kind: 'run', date, scope: personas ? 'personas' : all ? 'all' : chosen[0].id, verdict: failed.length ? 'fail' : notRun.length ? NOT_RUN : 'pass', cards: chosen.length, failed, ...(notRun.length ? { notRun } : {}), commit, dirty });
    appendHistory(HISTORY, lines);
    const regressed = regressions(readHistory());
    console.log(`\nevals: ${chosen.length - failed.length - notRun.length} of ${chosen.length} passed${notRun.length ? `, ${notRun.length} could not run (${notRun.join(', ')})` : ''} on ${commit}${dirty ? ' (with uncommitted changes)' : ''}; recorded in ${DEV_DIR}/evals/history/`);
    if (regressed.length) console.log(`evals: regressed since the run before (passed then, fail now): ${regressed.join(', ')}`);
    process.exitCode = failed.length ? 1 : notRun.length ? 2 : 0;
  } else if (cmd === 'coverage') {
    // A drafted card binds nothing until the owner's yes, so coverage counts the agreed ones;
    // a card may still cite a drafted one (check, above, accepts every standing card).
    const agreements = standingCards(readTranscript()).filter((e) => e.card.status === 'agreed').map((e) => e.card.id);
    const g = coverage(cards, agreements);
    console.log(`evals: ${cards.length} cards (${cards.filter((c) => c.status === 'runnable').length} runnable, ${cards.filter((c) => !runnable(c)).length} written, not running) over ${agreements.length} agreements; ${agreements.length - g.unprotected.length - g.onPaper.length} with a runnable eval`);
    console.log(g.unprotected.length ? `🔴 agreements with no card: ${g.unprotected.join(', ')}` : '🟢 every agreement has a card');
    // T-273: a card that cannot run is an eval written, not one running; it never counts as cover.
    if (g.onPaper.length) console.log(`🟡 eval written, not running (every card naming it is not runnable yet): ${g.onPaper.join(', ')}`);
    if (g.aspects.length) console.log(`🟡 aspects no card serves: ${g.aspects.join(', ')}`);
    if (g.answers.length) console.log(`🟡 answers no card gives: ${g.answers.join(' · ')}`);
    const none = g.combos.filter((c) => !c.any);
    const paper = g.combos.filter((c) => c.any && !c.runnable);
    if (none.length) console.log(`🟡 combinations that matter with no card: ${none.map((c) => c.name).join(' · ')}`);
    if (paper.length) console.log(`🟡 combinations with cards that cannot run yet: ${paper.map((c) => c.name).join(' · ')}`);
    process.exitCode = g.unprotected.length ? 1 : 0;
  } else if (cmd === 'stale') {
    const stale = staleCards(cards, history);
    const daily = stale.filter((x) => !x.weekly);
    const weekly = stale.filter((x) => x.weekly);
    const say = (xs) => xs.map((x) => `${x.id} (${x.age === null ? 'never run' : `${x.age} days`})`).join(', ');
    if (weekly.length) console.log(`evals: personas due, run \`run --personas --oldest ${PERSONA_BATCH}\` (the oldest first): ${say(weekly)}`);
    console.log(daily.length ? `evals: 🔴 ${daily.length} daily card(s) stopped running: ${say(daily)}` : 'evals: every daily card ran within 2 days');
    process.exitCode = daily.length ? 1 : 0;
  } else if (cmd === 'model' && rest.length === 1) {
    const change = modelChange(history, rest[0]);
    if (!change) {
      console.log(`evals: still on ${rest[0]}; nothing to re-check for the model`);
    } else {
      appendHistory(HISTORY, change);
      console.log(`evals: MODEL CHANGED, ${change.previous ?? '(none recorded)'} → ${rest[0]}: run every card, \`run --all\` and \`run --personas\`, and hold anything that got worse (D46)`);
      process.exitCode = 3;
    }
  } else if (cmd === 'drift') {
    const regressed = regressions(history);
    console.log(regressed.length ? `evals: ${regressed.length} card(s) passed the run before and fail now: ${regressed.join(', ')}` : 'evals: no card that passed before fails now');
    process.exitCode = regressed.length ? 1 : 0;
  } else if (cmd === 'last-pass') {
    // Where /rollback returns to (D18): the last whole run, on a clean tree, that passed every card.
    const run = lastAllPass(history);
    if (!run) {
      console.error('evals: no whole run on a clean tree has passed every card yet; nothing to roll back to');
      process.exit(1);
    }
    console.log(`${run.commit} ${run.date} ${run.cards} cards passed`);
  } else {
    console.error('usage: evals.mjs list | run --all | run E-NNN | coverage | check | drift | last-pass');
    process.exit(2);
  }
}
