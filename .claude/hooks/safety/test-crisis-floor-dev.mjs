// Rule test for crisis-floor.mjs in a development chat: what earlier turns would
// carry over (where it is, the question due, a person and a line still owed) is left
// out there, because those turns quote crisis words while building; a crisis word in
// the message itself still brings the whole floor; her chats keep the carry-over.
//
// Runs the real hook on a throwaway copy of the harness, with a sample record, so
// nothing reaches her record or the real markers.
//
// Run: node .claude/hooks/safety/test-crisis-floor-dev.mjs

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
const dir = makeTemp('dear-floor-dev-');
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

try {
  for (const p of ['.claude', 'modules', 'CLAUDE.md']) cpSync(join(repo, p), join(dir, p), { recursive: true });
  rmSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true, force: true });
  cpSync(join(repo, 'data-sample'), join(dir, 'data'), { recursive: true });
  const hook = join(dir, '.claude', 'hooks', 'safety', 'crisis-floor.mjs');

  // Earlier turns: a quoted crisis word, then the question asked and nothing named after it.
  const line = (type, text) => JSON.stringify({ type, message: { role: type, content: [{ type: 'text', text }] } });
  const transcript = join(dir, 'transcript.jsonl');
  writeFileSync(transcript, [
    line('user', 'the floor should catch "I feel hopeless" in her chat'),
    line('assistant', 'It does. The floor then asks "Are you safe right now?" in those words.'),
    line('user', 'ok'),
    line('assistant', 'Done, tests pass.'),
    line('assistant', 'Next step.'),
  ].join('\n'));

  const run = (id, prompt, { dev }) => {
    if (dev) {
      mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });
      writeFileSync(join(dir, '.claude', 'hooks', 'state', `dev-mode-${id}`), 'on');
    }
    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: id };
    const r = spawnSync(process.execPath, [hook], { cwd: dir, input: JSON.stringify({ session_id: id, prompt, transcript_path: transcript }), env, encoding: 'utf8', timeout: 30000 });
    return `${r.stdout}${r.stderr}`;
  };

  const built = run('dev-chat', 'now merge the branch', { dev: true });
  check('a development chat gets no carry-over from quoted turns', !/SAFETY FLOOR, continued/.test(built) && !/Are you safe right now/.test(built));
  const hurting = run('dev-chat', 'honestly i feel hopeless tonight', { dev: true });
  check('a crisis word in a development chat still brings the whole floor', /Are you safe right now\?/.test(hurting) && /AI, not a person/.test(hurting));
  const hers = run('her-chat', 'what should i cook', { dev: false });
  check('her chat keeps the carry-over from earlier turns', /SAFETY FLOOR, continued/.test(hers));

  // T-850: development mode switched off, the quoted turn typed while building. Its fingerprint in
  // the development record leaves it out of the carry-over; one she said herself still counts.
  const { sha } = await import(join(dir, '.claude', 'hooks', 'lib', 'typed.mjs'));
  const record = join(dir, ...['dev', 'dialogue'], ['typed', 'jsonl'].join('.'));
  mkdirSync(join(dir, 'dev', 'dialogue'), { recursive: true });
  writeFileSync(record, `${JSON.stringify({ at: '2026-11-05T00:00:00Z', sha: sha('the floor should catch "I feel hopeless" in her chat') })}\n`);
  const after = run('was-dev-chat', 'what should i cook', { dev: false });
  check('the incident: a turn typed while building brings no carry-over once development mode is off', !/SAFETY FLOOR, continued/.test(after));
  writeFileSync(record, `${JSON.stringify({ at: '2026-11-05T00:00:00Z', sha: sha('something else entirely') })}\n`);
  const still = run('her-chat-2', 'what should i cook', { dev: false });
  check('a turn not typed while building still carries over', /SAFETY FLOOR, continued/.test(still));
  const now = run('was-dev-chat', 'honestly i feel hopeless tonight', { dev: false });
  check('a crisis word in the message itself still brings the whole floor', /Are you safe right now\?/.test(now));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `crisis floor in development chats: ${failed} failed` : 'crisis floor in development chats: all cases hold');
process.exit(failed ? 1 : 0);
