// Retrieval from the record, scored against questions whose answers are known
// (dev/specs/system/hygiene.md).
//
// HYG-004, "Retrieval from the record is tested against questions whose answers are known."
// It gives evidence to DAT-002 (the record stays findable) and CTX-002 (the
// opening read stays flat), which both admit nothing measures them.
//
//   node ux/scripts/check-retrieval.mjs                 run every case
//   node ux/scripts/check-retrieval.mjs --case <id>     run one case
//   node ux/scripts/check-retrieval.mjs --model <id>    another model (default haiku)
//   node ux/scripts/check-retrieval.mjs --json          machine output
//   node ux/scripts/check-retrieval.mjs --log           also append to the growth log
//   (--log=<path> writes the log somewhere else, for a trial run)
//
// This is the structural set only: the questions in retrieval-cases.json are
// about the invented record in data-sample/, and the run reads nothing else.
// The real set lives inside data/ and is run there (HYG-004's design note).
//
// Each case is a fresh headless agent with read-only tools, its working
// directory a temporary copy of data-sample/ so nothing can write the folder
// itself. It is told the session's retrieval order (CLAUDE.md, "Retrieval
// order") and nothing else. Scored: right (every expected keyword in its one-line
// answer, case-insensitive), files opened (distinct Read paths), tool calls,
// tokens (input + output + cache read + cache creation), seconds.
//
// It costs tokens, so it runs on the hygiene heartbeat's cadence, never in
// `npm run check` or the commit gate. A fall is a warning that starts a
// proposal, never a block (HYG-005): the exit code is 0 whatever happens.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { appendPart } from './append-part.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HYGIENE_LOG_FILE } from '../../.claude/hooks/lib/paths.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SAMPLE = join(repoRoot, 'data-sample/');
const CASES_FILE = join(repoRoot, 'ux', 'scripts', 'retrieval-cases.json');
const LOG_FILE = join(repoRoot, HYGIENE_LOG_FILE);
const FOLDER = 'retrieval:sample';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const CONCURRENCY = 3;
const MAX_TURNS = 15;
const TIMEOUT_MS = 5 * 60 * 1000;
const RISE = 0.25; // reads, tokens or seconds up by more than this is a fall

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const model = valueOf('--model') || DEFAULT_MODEL;
const onlyCase = valueOf('--case');
const logArg = args.find((a) => a === '--log' || a.startsWith('--log='));
const logPath = logArg ? (logArg.includes('=') ? resolve(logArg.slice(6)) : LOG_FILE) : null;

// The order is read from CLAUDE.md each run, never copied here: a copy would
// keep testing the old order after CLAUDE.md changed (ARC-013).
const ORDER = (() => {
  const text = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
  const m = text.match(/\*\*Retrieval order, every time:\*\*([\s\S]*?)\n\n/);
  if (!m) throw new Error('No "Retrieval order" paragraph in CLAUDE.md');
  return m[1].replace(/\s+/g, ' ').trim();
})();

const PROMPT = (question) => `This folder is one person's private record. Answer one question from it.

Follow this retrieval order, and nothing else (now.md is core/state/now.md, timeline.md is core/timeline.md):
${ORDER}
Never search everything in the hope of a hit; search only for a specific file or word you already have reason to expect.

Paths written in the record as data/<path> are at <path> in this folder (for example data/core/people/person-w.md is core/people/person-w.md).

Question: ${question}

Reply with the answer in one line and nothing else, giving any date as YYYY-MM-DD. If the record does not hold the answer, reply exactly: not recorded.`;

function runCase(c) {
  return new Promise((done) => {
    const dir = makeTemp('retrieval-');
    cpSync(SAMPLE, dir, { recursive: true });
    const started = Date.now();
    const child = spawn(
      'claude',
      [
        '-p', PROMPT(c.question),
        '--output-format', 'stream-json', '--verbose',
        '--max-turns', String(MAX_TURNS),
        '--allowedTools', 'Read,Grep,Glob',
        '--tools', 'Read,Grep,Glob',
        '--strict-mcp-config',
        '--no-session-persistence',
        '--model', model,
      ],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    let buf = '';
    let stderr = '';
    const reads = new Set();
    const calls = { Read: 0, Grep: 0, Glob: 0 };
    let result = null;
    const onLine = (line) => {
      if (!line.trim()) return;
      let ev;
      try { ev = JSON.parse(line); } catch { return; }
      if (ev.type === 'assistant') {
        for (const part of ev.message?.content ?? []) {
          if (part.type !== 'tool_use') continue;
          if (part.name in calls) calls[part.name]++;
          if (part.name === 'Read' && part.input?.file_path) {
            reads.add(resolve(dir, part.input.file_path));
          }
        }
      } else if (ev.type === 'result') {
        result = ev;
      }
    };
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', () => {
      clearTimeout(timer);
      onLine(buf);
      rmSync(dir, { recursive: true, force: true });
      const u = result?.usage ?? {};
      const tokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0)
        + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      const answer = String(result?.result ?? '').trim();
      const lower = answer.toLowerCase();
      const right = !!answer && c.expect.every((k) => lower.includes(k.toLowerCase()));
      done({
        id: c.id,
        right,
        answer: answer || (result?.subtype ?? `no result${stderr ? `: ${stderr.trim().split('\n').pop()}` : ''}`),
        expect: c.expect,
        file: c.file,
        reads: reads.size,
        calls: calls.Read + calls.Grep + calls.Glob,
        grep: calls.Grep,
        glob: calls.Glob,
        tokens,
        seconds: (Date.now() - started) / 1000,
        cost: result?.total_cost_usd ?? 0,
      });
    });
  });
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

function previousLine() {
  if (!logPath || !existsSync(logPath)) return null;
  const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(lines[i]);
      if (o.folder === FOLDER) return o;
    } catch { /* a malformed line is skipped, never fatal */ }
  }
  return null;
}

function falls(prev, now) {
  if (!prev) return [];
  const out = [];
  if (prev.cases === now.cases && now.right < prev.right) {
    out.push(`right answers ${prev.right} → ${now.right}`);
  } else if (prev.cases && now.cases && now.right / now.cases < prev.right / prev.cases) {
    out.push(`right answers ${prev.right}/${prev.cases} → ${now.right}/${now.cases}`);
  }
  for (const k of ['reads', 'tokens', 'seconds']) {
    if (prev[k] > 0 && now[k] > prev[k] * (1 + RISE)) {
      out.push(`${k} ${prev[k]} → ${now[k]} (+${Math.round((now[k] / prev[k] - 1) * 100)}%)`);
    }
  }
  return out;
}

async function main() {
  let cases = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
  if (onlyCase) {
    cases = cases.filter((c) => c.id === onlyCase);
    if (!cases.length) {
      console.error(`retrieval: no case "${onlyCase}" in retrieval-cases.json`);
      return;
    }
  }
  const started = Date.now();
  const results = await pool(cases, CONCURRENCY, runCase);
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    folder: FOLDER,
    model,
    cases: results.length,
    right: results.filter((r) => r.right).length,
    reads: round(mean(results.map((r) => r.reads))),
    tokens: Math.round(mean(results.map((r) => r.tokens))),
    seconds: round(mean(results.map((r) => r.seconds))),
  };
  const cost = round(results.reduce((a, r) => a + r.cost, 0), 4);
  const wall = round((Date.now() - started) / 1000);
  // Only a full run is a baseline: one case's numbers say nothing about a trend.
  const prev = onlyCase ? null : previousLine();
  const warnings = falls(prev, summary);

  if (asJson) {
    console.log(JSON.stringify({ summary, cost_usd: cost, wall_seconds: wall, previous: prev, warnings, results }, null, 2));
  } else {
    console.log(`retrieval (HYG-004) · ${model} · ${results.length} case(s)\n`);
    const rows = results.map((r) => [
      r.right ? 'ok' : 'WRONG', r.id, String(r.reads), String(r.calls),
      String(r.tokens), r.seconds.toFixed(1), r.answer.replace(/\s+/g, ' ').slice(0, 70),
    ]);
    const head = ['', 'case', 'reads', 'calls', 'tokens', 'secs', 'answer'];
    const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const fmt = (r) => r.map((x, i) => (i === r.length - 1 ? x : x.padEnd(w[i]))).join('  ');
    console.log(fmt(head));
    for (const r of rows) console.log(fmt(r));
    for (const r of results.filter((x) => !x.right)) {
      console.log(`\n  ${r.id}: expected [${r.expect.join(', ')}] from ${r.file}`);
    }
    console.log(`\nright ${summary.right}/${summary.cases} · mean reads ${summary.reads} · mean tokens ${summary.tokens} · mean ${summary.seconds}s · cost $${cost} · wall ${wall}s`);
    if (prev) console.log(`previous (${prev.date}, ${prev.model}): right ${prev.right}/${prev.cases} · reads ${prev.reads} · tokens ${prev.tokens} · ${prev.seconds}s`);
    for (const x of warnings) console.log(`FALL: ${x} — a proposal, not a block (HYG-005)`);
  }

  if (logPath && !onlyCase) {
    appendPart(logPath, [JSON.stringify(summary)]); // cut before the one-read line (T-768)
    if (!asJson) console.log(`logged to ${logPath === LOG_FILE ? HYGIENE_LOG_FILE : logPath}`);
  } else if (logPath && onlyCase) {
    console.log('not logged: --case is a single question, not a baseline');
  }
}

main().catch((e) => {
  console.error(`retrieval: ${e.message}`);
}).finally(() => { process.exitCode = 0; });
