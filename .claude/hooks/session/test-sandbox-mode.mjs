// Rule test: sandbox mode inside development mode (WKB-013).
//
// While a development-mode chat is in the sandbox it plays her everyday
// conversation, so the development reply checks stand down and the everyday
// ones decide; switched off, development mode is back. And only `/dev-mode
// sandbox [on|reset|sample]` counts as entering it, typed or expanded.
// Run against a throwaway folder (CLAUDE_PROJECT_DIR), never this repository.
// Exits non-zero on any failure. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hooks = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = makeTemp('dear-sbxmode-');
const id = 'test-sandbox-mode';
const state = join(dir, '.claude', 'hooks', 'state');
const sessions = join(dir, 'data-sandbox', '.sessions');
const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID', 'DEAR_RECORD_READONLY']) delete env[k];
Object.assign(process.env, { CLAUDE_PROJECT_DIR: dir });
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_CODE_REMOTE_SESSION_ID;

let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};

// A hook's printed context for a payload.
const run = (hook, payload) =>
  spawnSync(process.execPath, [join(hooks, 'session', hook)], { env, input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000 }).stdout || '';

// A reply with a heading: the everyday check notes it, the development one stays silent on it.
const transcript = join(dir, 'turn.jsonl');
const everydayNoted = () => {
  const note = join(state, `everyday-reply-note-${id}`);
  rmSync(note, { force: true });
  spawnSync(process.execPath, [join(hooks, 'session', 'everyday-shape-check.mjs')], {
    env, input: JSON.stringify({ session_id: id, transcript_path: transcript }), timeout: 20000,
  });
  return existsSync(note) && readFileSync(note, 'utf8').includes('CON-014');
};

try {
  mkdirSync(state, { recursive: true });
  mkdirSync(dirname(sessions), { recursive: true });
  writeFileSync(transcript, [
    { type: 'user', message: { content: 'hi' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: '## A heading\nThat sounds hard.' }] } },
  ].map((e) => JSON.stringify(e)).join('\n'));
  const { devModeActive, devModeMarker, entersSandbox } = await import(pathToFileURL(join(hooks, 'lib', 'dev-mode.mjs')).href);
  const input = { session_id: id };

  writeFileSync(join(state, devModeMarker(input)), 'on');
  expect('development mode is active when switched on', devModeActive(input));
  expect('the everyday check stands aside in development mode', !everydayNoted());

  writeFileSync(sessions, `${id}\n`);
  expect('development mode stands down in the sandbox', !devModeActive(input));
  expect('the everyday check decides in the sandbox', everydayNoted());

  const voice = run('everyday-voice.mjs', { session_id: id, prompt: 'hello' });
  expect('in the sandbox, the everyday voice forbids switching modes', voice.includes('/dev-mode sandbox off') && !voice.includes('switch into development mode'));

  writeFileSync(sessions, '');
  expect('switching the sandbox off brings development mode back', devModeActive(input));

  // The turn that enters the sandbox gets no development shape, though development mode is on.
  expect('no development shape on the turn entering the sandbox', !run('dev-reply-shape.mjs', { session_id: id, prompt: '/dev-mode sandbox' }).includes('THREE SHAPES'));
  expect('the development shape still comes on /dev-mode sandbox off', run('dev-reply-shape.mjs', { session_id: id, prompt: '/dev-mode sandbox off' }).includes('THREE SHAPES'));

  const enters = [
    ['/dev-mode sandbox', true],
    ['/dev-mode sandbox on', true],
    ['/dev-mode sandbox reset', true],
    ['/dev-mode sandbox sample', true],
    ['/dev-mode sandbox off', false],
    ['/dev-mode', false],
    ['/dev-mode work on the sandbox', false],
    ['<command-name>/dev-mode</command-name>\n<command-args>sandbox sample</command-args>', true],
    ['<command-name>/dev-mode</command-name>\n<command-args>sandbox off</command-args>', false],
  ];
  for (const [prompt, want] of enters) expect(`entersSandbox(${JSON.stringify(prompt.replace(/\n/g, ' '))}) is ${want}`, entersSandbox(prompt) === want);
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}

process.exit(failed ? 1 : 0);
