// Rule test: a set-up run's end, end to end (DEP-014). S43 and S44 in
// dev/skills/set-up/scenarios.md end on their case and a "This run taught" line,
// which a one-reply test cannot reach: the line is owed only at the run's close,
// turns after the skill loaded. So the real Stop check (dev-reply-check.mjs) is
// run on invented two-turn transcripts of each run, in a throwaway folder with
// development mode switched on, and the note it leaves for the next message is
// read back, with the marker that carries a chat's last shortfall to the next
// session. Nothing here touches this repository's own markers. Run by selftest.mjs.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, 'dev-reply-check.mjs');
const dir = makeTemp('dear-setup-end-');
const state = join(dir, '.claude', 'hooks', 'state');
mkdirSync(state, { recursive: true });

// A closing reply in the tracker shape, invented, with nothing left open.
const closing = [
  '🛠️ **Dev Mode · Tracker**',
  '> Turn 2 · Started 2 Nov, 10:00 · Last reply 2 Nov, 10:20',
  '',
  '---',
  '## ✅ Done',
  '- The copy is running; its doctor is green.',
  '',
  '---',
  '## 🗂️ Still open',
  '- **In this chat:** nothing',
].join('\n');

const use = (id, name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
const ok = (id) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const says = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const typedMsg = (text) => ({ type: 'user', message: { content: text } });

let n = 0;
/** Run the Stop check on a two-turn run; returns the note left and the carried marker. */
function end(name, firstAsk, middle, lastReply) {
  n += 1;
  const id = `test-setup-end-${process.pid}-${n}`;
  writeFileSync(join(state, `dev-mode-${id}`), new Date().toISOString());
  writeFileSync(join(state, `turn-kind-${id}`), 'build');
  const file = join(dir, `${name}.jsonl`);
  const entries = [
    typedMsg(firstAsk),
    use('s1', 'Skill', { skill: 'set-up' }), ok('s1'),
    says('First step: run the doctor on her machine and paste what it prints.'),
    typedMsg('next'),
    ...middle,
    says(lastReply),
  ];
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n'));
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_SESSION_ID: id };
  delete env.CLAUDE_CODE_REMOTE_SESSION_ID;
  const r = spawnSync(process.execPath, [hook], { cwd: dir, env, input: JSON.stringify({ session_id: id, transcript_path: file }), encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, `${name}: the Stop check never refuses (${r.stderr})`);
  assert.equal(r.stdout.trim(), '', `${name}: the Stop check never sends a reply back`);
  const read = (f) => (existsSync(join(state, f)) ? readFileSync(join(state, f), 'utf8') : '');
  return { note: read(`dev-reply-note-${id}`), owed: read('set-up-learn-owed') };
}

const LEARN = /learning step/;
const S43 = 'help me move my friend onto the new harness; her old one is in her repo';
const S44 = 'turn on Telegram for my copy';

// S43: the run closes with no case and no line: the note is left, and carried past the chat.
{
  const r = end('s43-silent', S43, [], closing);
  assert.ok(LEARN.test(r.note), 'S43 closing with no case and no line leaves the learning-step note');
  assert.ok(LEARN.test(r.owed), 'and carries it to the next session, since a last reply has no next message');
}
// S43: the closing reply says what the run taught: no note, and what was carried is cleared.
{
  const r = end('s43-taught', S43, [use('c1', 'Read', { file_path: 'FEEDBACK.md' }), ok('c1')], `${closing}\n\nThis run taught: her open setup notes are read before the import.`);
  assert.ok(!LEARN.test(r.note), 'S43 closing on "This run taught" leaves no learning-step note');
}
// S44: the moved click path becomes a case and a fixed step, then the run closes: no note, nothing carried.
{
  const r = end('s44-case', S44, [
    use('w1', 'WebFetch', { url: 'https://example.com/routines' }), ok('w1'),
    use('e1', 'Edit', { file_path: `${dir}/dev/skills/set-up/cases.md` }), ok('e1'),
    use('e2', 'Edit', { file_path: `${dir}/.claude/skills/set-up/telegram.md` }), ok('e2'),
  ], closing);
  assert.ok(!LEARN.test(r.note), 'S44 closing after its case was written leaves no learning-step note');
  assert.equal(r.owed, '', 'and clears what an earlier chat carried');
}
// S44: an edit to the scenarios' own results is not a lesson: the note is left.
{
  const r = end('s44-evals-only', S44, [use('e3', 'Edit', { file_path: `${dir}/dev/skills/set-up/evals-results.json` }), ok('e3')], closing);
  assert.ok(LEARN.test(r.note), 'S44 closing with only its results file edited leaves the note');
}
// Mid-run, nothing is owed yet: a reply that is not closing is never held to the step.
{
  const r = end('mid-run', S44, [], 'Step 15: open the routines page and paste what it shows.');
  assert.ok(!LEARN.test(r.note), 'a mid-run reply is not held to the learning step');
}

console.log(`set-up run end: ${n} two-turn runs judged by the real Stop check (S43, S44: note left, carried, cleared)`);
