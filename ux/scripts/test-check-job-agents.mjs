#!/usr/bin/env node
// check-job-agents.mjs: catches the two real incidents, passes the fixed wording and
// the job prompts as they stand. Invented text only.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentAsks } from './check-job-agents.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// 2 Nov, the privacy read's step as first written: refused.
const wrapped = agentAsks('   read a few megabytes, so give each\n   slice to its own reader agent, all at once.');
assert.equal(wrapped.length, 1, 'the 2 Nov wording, wrapped across two lines as it was, is refused');
assert.equal(wrapped[0].line, 1, 'and named at the line it starts on');
assert.equal(agentAsks('so give each slice to its own reader agent, all at once, each told to read it.').length, 1, 'the 2 Nov wording is refused');
const real = 'read a few megabytes (1 Nov: one read 15 of 168 files and stopped), so give each\n   slice to its own reader agent, all at once, each told to read every file in it\n   whole and to report path, line and kind only, never the\n   words; read a slice yourself only where no agent can be started.';
assert.equal(agentAsks('One session cannot ' + real).length, 1, 'a "cannot" about something else in the same sentence is no excuse (the 2 Nov text as it stood)');
// 19 Oct, code-maintenance's second-agent step: refused.
assert.equal(agentAsks('Then start a subagent with only the diff.').length, 1, 'the 19 Oct wording is refused');
// The fixed wording: passes.
assert.equal(agentAsks('You cannot start agents, so the orchestrator starts one reader per slice before you.').length, 0, 'a sentence saying it cannot passes');
assert.equal(agentAsks('The sweep starts one reader agent per slice.').length, 0, 'the orchestrator doing it passes');
assert.equal(agentAsks('```\nstart a subagent\n```').length, 0, 'a code block is not an instruction');
assert.equal(agentAsks('Agents share one scratchpad.').length, 0, 'naming agents without asking for one passes');

// The real job prompts as they stand.
const r = spawnSync('node', [join(here, 'check-job-agents.mjs')], { encoding: 'utf8' });
assert.equal(r.status, 0, `the job prompts on disk pass: ${r.stderr}`);

console.log('job agents check test: both incidents refused, the fixed wording and the job prompts pass');
