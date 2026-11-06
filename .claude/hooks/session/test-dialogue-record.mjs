// Rule test: the developer's words reach the Transcript by code (D35, WKB-007
// design 10), and nothing else does.
//
// In development mode a message is appended verbatim as a `❔ unsorted` entry
// with the next T number; outside development mode, in the sandbox, for a
// relayed frame, a slash command, an empty message or one carrying a key or an
// approval phrase, nothing is written. A number another chat already pushed to
// main counts, so two chats do not take the same one. Each message kept leaves
// one line in the typed record (lib/typed.mjs): a hash of the words as the
// Transcript quotes them, never the words, staged for the next commit; a message
// not kept leaves none.
// Run against a throwaway folder (CLAUDE_PROJECT_DIR), never this repository.
// Exits non-zero on any failure. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTyped, sha, transcriptQuotes, typedCounts, typedFile } from '../lib/typed.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';
import { claudeAncestors } from '../lib/nested-claude.mjs';

const hooks = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = makeTemp('dear-dialogue-record-');
const id = 'test-dialogue-record';
const state = join(dir, '.claude', 'hooks', 'state');
const transcript = join(dir, 'dev', 'dialogue', 'transcript');
const sessions = join(dir, 'data-sandbox', '.sessions');
const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID', 'DEAR_HOOK_STRICT']) delete env[k];

let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};

const month = new Date().toISOString().slice(0, 7);
const file = join(transcript, `${month}.md`);
const read = () => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};
const say = (prompt) =>
  spawnSync(process.execPath, [join(hooks, 'session', 'dialogue-record.mjs')], {
    env, input: JSON.stringify({ session_id: id, prompt }), encoding: 'utf8', timeout: 20000,
  }).stdout || '';
const unchanged = (name, prompt) => {
  const before = read();
  say(prompt);
  expect(name, read() === before);
};

try {
  mkdirSync(state, { recursive: true });
  mkdirSync(transcript, { recursive: true });
  mkdirSync(dirname(sessions), { recursive: true });
  writeFileSync(join(transcript, '2026-01.md'), '# Transcript\n\n### T-041 · 2026-01-05 · 💭 want\n> earlier\n');
  // A newer month holding no entry yet: the reading, newest first, carries on past it.
  writeFileSync(join(transcript, '2026-02.md'), '# Transcript · February 2026\n\n---\n');

  unchanged('records nothing outside development mode', 'make the export faster');

  writeFileSync(join(state, `dev-mode-${id}`), 'on');
  const out = say('make the export faster\n\nand tell me when it is done');
  const text = read();
  expect('records the message in development mode, numbered on from every month', text.includes(`### T-042 · ${new Date().toISOString().slice(0, 10)} · ❔ unsorted`));
  expect('keeps it verbatim, every line quoted', text.includes('> make the export faster\n>\n> and tell me when it is done\n'));
  expect('starts a new month file with its heading', text.startsWith('# Transcript · '));
  expect('tells the agent it is already kept', out.includes('T-042') && out.includes('do not write it again'));
  expect('an undo reruns the checks it touched before asking why (A-006, E-010)', out.includes('rerun the checks it touched, showing them pass, then ask what bothered him'));
  const lines = () => [...typedCounts(dir).values()].reduce((a, b) => a + b, 0);
  const typedText = () => {
    try {
      return readFileSync(typedFile(dir), 'utf8');
    } catch {
      return '';
    }
  };
  expect('leaves one line in the typed record', lines() === 1 && typedCounts(dir).has(sha('make the export faster\n\nand tell me when it is done')));
  expect('the line is a hash, never the words', !/export|faster/.test(typedText()) && /^\{"at":"[^"]+","sha":"[0-9a-f]{64}"\}\n$/.test(typedText()));
  expect('the hash is of the words the Transcript quotes', isTyped(transcriptQuotes(dir).find((e) => e.id === 'T-042')?.quote, dir));
  say('second remark');
  expect('each message kept leaves its own line', lines() === 2);
  expect('the next message takes the next number', read().includes('### T-043 · '));

  mkdirSync(join(dir, 'data', 'core', 'people'), { recursive: true });
  writeFileSync(join(dir, 'data', 'core', 'people', 'person-w.md'), '# Person-W\n');
  say('ask Person-W and person-wish about the calendar');
  expect('a name from her record is set aside before it is written', read().includes('> ask [a name] and person-wish about the calendar') && !/\bPerson-W\b/.test(read()));
  expect('the typed record hashes the words as written', isTyped('ask [a name] and person-wish about the calendar', dir));
  writeFileSync(join(dir, 'data', 'PROFILE.yaml'), 'mandatory:\n  name:\n    value: Ownerly\n    status: answered\n');
  say('this copy is called dear-Ownerly now');
  expect('the owner\'s own name is set aside too (T-485)', read().includes('> this copy is called dear-[a name] now') && !/Ownerly/.test(read()));
  expect('so a message carrying it can still approve', isTyped('this copy is called dear-[a name] now', dir));

  unchanged('records no relayed frame', '[Subagent hand-back] The report follows:\nall done');
  unchanged('records no task notification', '<task-notification>\nfinished\n</task-notification>');
  unchanged('records no slash command', '/dev-mode sandbox');
  unchanged('records no expanded slash command', '<command-name>/dev-approve</command-name>\n<command-args></command-args>');
  unchanged('records no empty message', '   \n ');
  unchanged('records no approval phrase', 'update to version 1.4 7F2K');
  unchanged('records no key', `use this ${['github', 'pat', 'B'.repeat(30)].join('_')} for the push`);

  // A Claude started inside another Claude (T-577, T-612): stand-ins named
  // `claude` (links to node) above the hook bring the Claudes over it to two, so
  // its process tree looks like an agent's `claude -p` probe. Run from his chat
  // (one real Claude above) or from CI (none). Linux only, where /proc shows it.
  const above = claudeAncestors();
  let extra = 0;
  if (process.platform === 'linux' && above < 2) {
    const bin = join(dir, 'fake-bin');
    mkdirSync(bin, { recursive: true });
    const claude = join(bin, 'claude');
    symlinkSync(process.execPath, claude);
    const relay = join(bin, 'relay.mjs');
    writeFileSync(relay, [
      "import { spawnSync } from 'node:child_process';",
      "const [depth, hook, input] = process.argv.slice(2);",
      "const next = Number(depth) > 1 ? [process.argv0, [process.argv[1], String(Number(depth) - 1), hook, input]] : [process.execPath, [hook]];",
      "const r = spawnSync(next[0], next[1], { input: Number(depth) > 1 ? undefined : input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });",
      "process.stdout.write(r.stdout || '');",
    ].join('\n'));
    const nested = (prompt) => {
      const before = read();
      spawnSync(claude, [relay, String(2 - above), join(hooks, 'session', 'dialogue-record.mjs'), JSON.stringify({ session_id: id, prompt })], { env, encoding: 'utf8', timeout: 20000 });
      return read() === before;
    };
    const typedBefore = lines();
    expect('records nothing from a Claude run inside another Claude', nested('approve all of it'));
    expect('and leaves no typed line for it, so it can approve nothing', lines() === typedBefore);
    // One Claude above, as in his own chat: from CI a stand-in supplies it; from
    // a chat the real one already does, and the cases above recorded under it.
    if (above === 0) spawnSync(claude, [relay, '1', join(hooks, 'session', 'dialogue-record.mjs'), JSON.stringify({ session_id: id, prompt: 'one claude above is him' })], { env, encoding: 'utf8', timeout: 20000 });
    else say('one claude above is him');
    expect('still records under a single Claude, as in his own chat', read().includes('> one claude above is him'));
    extra = 1;
  }

  writeFileSync(sessions, `${id}\n`);
  unchanged('records nothing in the sandbox', 'i had a rough day at work');
  writeFileSync(sessions, '');
  const back = read();
  say('out of the sandbox again');
  expect('records again once the sandbox is off', read().length > back.length);
  expect('a message not kept leaves no line in the typed record', lines() === 5 + extra);

  // Another chat already pushed a higher number to main: it counts too (2026-10-26 collisions).
  const sh = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  const origin = join(dir, 'origin.git');
  const other = join(dir, 'other-chat');
  sh(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  sh(dir, 'clone', '-q', origin, other);
  mkdirSync(join(other, 'dev', 'dialogue', 'transcript'), { recursive: true });
  writeFileSync(join(other, 'dev', 'dialogue', 'transcript', `${month}.md`), '# Transcript\n\n### T-090 · 2026-01-05 · 💭 want\n> filed by another chat\n');
  sh(other, 'add', '-A');
  sh(other, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-verify', '-m', 'other chat');
  sh(other, 'push', '-q', 'origin', 'HEAD:main');
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'remote', 'add', 'origin', origin);
  say('numbered past what main holds');
  expect('fetches main first, and numbers past the highest there', read().includes('### T-091 · '));
  expect('stages the typed record for the next commit', sh(dir, 'diff', '--cached', '--name-only').stdout.split('\n').includes(['dev', 'dialogue', 'typed.jsonl'].join('/')));

  rmSync(join(dir, 'dev'), { recursive: true, force: true });
  say('a copy without dev/');
  expect('does nothing in a copy without dev/ (ARC-008)', read() === '');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
