#!/usr/bin/env node
// A heartbeat job's own agent cannot start agents (.claude/jobs/README.md step 3,
// .claude/memory/a-heartbeat-job-cannot-start-an-agent.md). A job prompt that tells it
// to never runs that step, and nothing reports it: code-maintenance's second-agent
// review landed nothing for a week (19 to 26 Oct), and the privacy read's slice readers
// read nothing (2 Nov), the second time with the note already written. So this reads
// every job prompt except the orchestrator's own README, and refuses a sentence that
// tells the job to start, give work to, or hand off to an agent, unless the same
// sentence says it cannot or that the orchestrator does it.
//
//   node ux/scripts/check-job-agents.mjs [file…]     exit 1 on a finding

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ASKS = /\b(start|starts|spawn|launch|give|hand|send)\b[^.;]{0,80}\b(sub-?agents?|agents?)\b/i;
// Excused only where the sentence says the job cannot start one, or that the
// orchestrator does: a "cannot" about something else is no excuse (2 Nov: "one
// session cannot read a few megabytes, so give each slice to its own reader agent").
const EXCUSED = /\b(cannot|can't|can not|never)\s+(start|spawn|launch|give|hand)\b|\b(orchestrator|sweep)\b[^.;]{0,40}\b(starts?|gives?|hands?)\b/i;

/** Pure: the sentences in `text` that tell a job to start an agent, with their line numbers. Prose wraps, so a paragraph is read whole. */
export function agentAsks(text) {
  const out = [];
  let inFence = false;
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const joined = para.map((p) => p.text.trim()).join(' ');
    let at = 0;
    for (const sentence of joined.split(/(?<=[.;])\s+/)) {
      const start = joined.indexOf(sentence, at);
      at = start + sentence.length;
      if (!ASKS.test(sentence) || EXCUSED.test(sentence)) continue;
      let used = 0;
      let line = para[0].line;
      for (const p of para) {
        if (used + p.text.trim().length + 1 > start) { line = p.line; break; }
        used += p.text.trim().length + 1;
      }
      out.push({ line, sentence: sentence.trim() });
    }
    para = [];
  };
  text.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { flush(); inFence = !inFence; return; }
    if (inFence) return;
    if (!raw.trim() || /^\s*([-*+]|\d+\.|#|\|)/.test(raw)) flush();
    if (raw.trim()) para.push({ line: i + 1, text: raw });
  });
  flush();
  return out;
}

function main(argv) {
  const dir = join(root, '.claude', 'jobs');
  const files = argv.length ? argv : readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => join(dir, f));
  const found = [];
  for (const f of files) for (const a of agentAsks(readFileSync(f, 'utf8'))) found.push(`${relative(root, f)}:${a.line} ${a.sentence.slice(0, 140)}`);
  if (!found.length) {
    console.log(`job agents check: ${files.length} job prompt(s), none asks its agent to start an agent`);
    return 0;
  }
  console.error('JOB AGENTS CHECK FAILED: a job prompt asks its own agent to start an agent, which it cannot (.claude/jobs/README.md step 3)\n');
  for (const l of found) console.error(`  - ${l}`);
  console.error('\n  Move the step to the orchestrator (step 3 or its reviewer, step 4), or say in that sentence that the job cannot.');
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)));
