// Rule test: the development reply shape reaches the model whole.
//
// Claude Code saves additionalContext over CONTEXT_LIMIT to a file and shows a
// 2,000-character preview, so the tracker shape after it was never read and
// every tracker fell short for a whole chat (2026-10-03). The for-you listing
// is what grows; it must give way, never the shape. Runs dev-reply-shape.mjs
// against a throwaway folder whose for-you list is far too long to list whole, and
// against this repository as it stands. Exits non-zero on any failure. Run by
// selftest.mjs.
//
// MEM-001 design 2 is held here too: the snapshot and the Eras arrive on their own.
//
// The same holds for SessionStart (session-context.mjs), which ran 15.1k on
// 2026-10-03: the snapshot stays whole and the timeline gives way, to its last
// ten entries and a pointer to the file. Run against a copy of data-sample/
// whose timeline is far too long to list whole.
//
// The throwaway folder is its own git repository, holding harness commits from
// more earlier chats than the shape names, none reviewed, so the REVIEWS OWED
// line is at its longest wherever this runs. Without it the folder had no git
// history: here the line read "unreadable" and was short, while the commit gate
// (DEAR_GIT_ROOT set to the real repository) printed the full owed list, so the
// long-note case passed by hand and failed only inside the gate, twice in one
// chat, each costing trims found one commit at a time (chat of 2026-10-12 to 10-15).

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const hook = join(root, '.claude', 'hooks', 'session', 'dev-reply-shape.mjs');
const dir = makeTemp('dear-ctxsize-');
process.env.CLAUDE_PROJECT_DIR = dir;
const { CONTEXT_LIMIT } = await import(pathToFileURL(join(root, '.claude', 'hooks', 'lib', 'hook.mjs')).href);
const { noteMarker, DIALOGUE_FIRST } = await import(pathToFileURL(join(root, '.claude', 'hooks', 'lib', 'dev-reply.mjs')).href);

let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};
// The context a /dev-mode switch puts in front of the model, opened with the full shape.
const shapeFor = (project) => {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: project, DEAR_GIT_ROOT: project === dir ? dir : process.env.DEAR_GIT_ROOT || project };
  for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID']) delete env[k];
  const out = spawnSync(process.execPath, [hook], {
    cwd: project, env, input: JSON.stringify({ session_id: 'test-context-size', prompt: '/dev-mode' }), encoding: 'utf8', timeout: 90000,
  }).stdout;
  try {
    return JSON.parse(out).hookSpecificOutput.additionalContext;
  } catch {
    return '';
  }
};

try {
  mkdirSync(join(dir, 'dev'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });
  const long = 'a question for the developer worded at the length real ones run to, naming the files and the rows it touches and why it waits '.repeat(2);
  writeFileSync(join(dir, 'dev', 'for-you.md'), `# For you\n\n${Array.from({ length: 80 }, (_, n) => `- for-you · ${n} ${long} · opened 2026-10-01 · chat none`).join('\n')}\n`);

  // Earlier chats that changed the harness and never ran their review: one more
  // than the shape names, with ids as long as real ones, so the owed line is at its longest.
  const g = (...args) => spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });
  g('init', '-q');
  for (let n = 0; n < 5; n += 1) {
    writeFileSync(join(dir, '.claude', `harness-${n}.md`), `${n}\n`);
    g('add', '-A');
    g('commit', '-q', '-m', `harness ${n}\n\nClaude-Session: https://claude.ai/code/session_01${String(n).repeat(22)}`);
  }

  const big = shapeFor(dir);
  expect('a long for-you list leaves the shape under the limit', big.length > 0 && big.length <= CONTEXT_LIMIT);
  expect('and the tracker shape is in it', big.includes('TRACKER (DEV-002'));
  expect('and every request starts at the dialogue (WKB-007)', big.includes(DIALOGUE_FIRST) && !big.includes('SPEC FIRST'));
  expect('and the for-you items left out are named by count', /…and \d+ more: read dev\/for-you\.md/.test(big));

  // The worst a real turn adds: a note from the last reply's check, as long as one runs.
  writeFileSync(join(dir, '.claude', 'hooks', 'state', noteMarker({ session_id: 'test-context-size' })), 'x'.repeat(1500));
  const noted = shapeFor(dir);
  expect('with a long note from the last check, still under the limit', noted.length > 0 && noted.length <= CONTEXT_LIMIT && noted.includes('TRACKER (DEV-002'));
  expect('and that case carries the owed line at its longest', /REVIEWS OWED by 5 earlier chat\(s\)[^\n]*, and 2 more: /.test(noted));
  // Trimmed 2026-11-02: an ordinary turn after the first carries only what changes the reply: no for-you
  // count, no view line, no reviews owed, and a short dev-skills line; the rules stay.
  writeFileSync(join(dir, '.claude', 'hooks', 'state', 'dev-mode-test-context-size'), new Date().toISOString());
  const plainEnv = { ...process.env, CLAUDE_PROJECT_DIR: dir, DEAR_GIT_ROOT: dir };
  for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID']) delete plainEnv[k];
  let plain = '';
  try {
    plain = JSON.parse(spawnSync(process.execPath, [hook], { cwd: dir, env: plainEnv, input: JSON.stringify({ session_id: 'test-context-size', prompt: 'what is a hook?' }), encoding: 'utf8', timeout: 90000 }).stdout).hookSpecificOutput.additionalContext;
  } catch {}
  expect('an ordinary turn keeps the rules', plain.includes(DIALOGUE_FIRST) && plain.includes('DEVELOPMENT REPLY SHAPE'));
  expect('and drops the for-you count, the view line and the reviews owed', plain.length > 0 && !/FOR YOU|VIEW \(FIT-001\)|REVIEWS OWED/.test(plain));
  expect('and stays small', plain.length > 0 && plain.length < 2500);
  // A-125: the month's showing of open ideas, a long list of them, on top of all that.
  writeFileSync(join(dir, 'dev', 'ideas.md'), `# Ideas\n\nPut back: never\n\n${Array.from({ length: 40 }, (_, n) => `- idea · ${n} ${long} · his · from T-1 · open · found: ${long} · opened 2026-11-02`).join('\n')}\n`);
  const ideas = shapeFor(dir);
  expect('with forty open ideas due as well, still under the limit', ideas.length > 0 && ideas.length <= CONTEXT_LIMIT && ideas.includes('TRACKER (DEV-002') && ideas.includes('IDEAS (A-125)'));

  // SessionStart: the snapshot whole, the timeline cut to its tail and a pointer.
  const record = join(dir, 'start');
  cpSync(join(root, 'data-sample'), join(record, 'data'), { recursive: true });
  const nowText = readFileSync(join(record, 'data', 'core', 'state', 'now.md'), 'utf8').replace(/\r\n/g, '\n').trim();
  const entry = (n) => `2026-0${1 + (n % 9)}-${String(1 + (n % 28)).padStart(2, '0')} · event · work · entry ${n} ${long} · → data/core/journal/x.md`;
  writeFileSync(join(record, 'data', 'core', 'timeline.md'), `# Timeline\n\n## Entries\n\n${Array.from({ length: 300 }, (_, n) => entry(n)).join('\n')}\n`);
  // MEM-001: the same timeline with an Eras section above the entries.
  const eraLine = 'Era marker: the shape of a quarter, read before any entry.';
  const timelinePath = join(record, 'data', 'core', 'timeline.md');
  writeFileSync(timelinePath, readFileSync(timelinePath, 'utf8').replace('## Entries', `## Eras\n\n${eraLine}\n\n## Entries`));
  const env = { ...process.env, CLAUDE_PROJECT_DIR: record };
  const startOut = spawnSync(process.execPath, [join(root, '.claude', 'hooks', 'session', 'session-context.mjs')], {
    cwd: record, env, input: JSON.stringify({ session_id: 'test-context-size', hook_event_name: 'SessionStart', source: 'startup' }), encoding: 'utf8', timeout: 90000,
  }).stdout;
  let start = '';
  try {
    start = JSON.parse(startOut).hookSpecificOutput.additionalContext;
  } catch {}
  expect('SessionStart with a long timeline stays under the limit', start.length > 0 && start.length <= CONTEXT_LIMIT);
  expect('and keeps now.md whole', nowText.length > 0 && start.includes(nowText));
  expect('and shows only the last ten timeline entries', (start.match(/ · entry \d+ /g) ?? []).length === 10 && start.includes(' · entry 299 ') && !start.includes(' · entry 289 '));
  // MEM-001 design 2: the snapshot and the timeline's Eras reach the model before she says anything, so she never re-explains what the record holds.
  expect('and carries the timeline Eras before the entries (MEM-001)', start.includes(eraLine) && start.indexOf(eraLine) < start.indexOf(' · entry 299 '));
  expect('and points to the timeline for the rest', /For the 290 earlier entries, read data\/core\/timeline\.md/.test(start));
  // D14 (round 3): once split, the latest year file's entries are the tail.
  mkdirSync(join(record, 'data', 'core', 'timeline'), { recursive: true });
  writeFileSync(join(record, 'data', 'core', 'timeline', '2027.md'), '# 2027\n\n2027-01-02 · event · work · a split year entry · → data/core/journal/x.md\n');
  let split = '';
  try {
    split = JSON.parse(spawnSync(process.execPath, [join(root, '.claude', 'hooks', 'session', 'session-context.mjs')], {
      cwd: record, env, input: JSON.stringify({ session_id: 'test-context-size', hook_event_name: 'SessionStart', source: 'startup' }), encoding: 'utf8', timeout: 90000,
    }).stdout).hookSpecificOutput.additionalContext;
  } catch {}
  expect('a split timeline\'s latest year file ends the tail (D14)', /a split year entry/.test(split) && !split.includes(' · entry 290 '));

  const live = shapeFor(root);
  expect(`this repository's shape is under the limit (${live.length} of ${CONTEXT_LIMIT})`, live.length > 0 && live.length <= CONTEXT_LIMIT);
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  // The live run leaves this chat-less marker in the real tree; take it back.
  rmSync(join(root, '.claude', 'hooks', 'state', 'dev-shape-sent-test-context-size'), { force: true });
}

process.exit(failed ? 1 : 0);
