// Rule test for dev-done-notify.mjs (card A-162): a development turn that ran a while tells his
// phone in one line which chat is waiting, its name a link back, and what it did; a short one does not; the real hook sends
// nothing without development mode, and sends once per turn.
//
// Run: node .claude/hooks/session/test-dev-done-notify.mjs

import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chatOf, plainText, notice, turnStart, didOf, lastReply, titleOf, MIN_MINUTES, pending, FALLBACK_MS, isPermissionPrompt, waited } from './dev-done-notify.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const chats = [{ url: 'https://claude.ai/code/session_01ABCdevchat', title: '📨 Telegram Notifications', kind: 'dev', state: 'open' }];
check('the chat is found by its session, either prefix', chatOf('cse_01ABCdevchat', chats)?.title === '📨 Telegram Notifications' && chatOf('session_01ABCdevchat', chats) && !chatOf('cse_other', chats));
const now = Date.parse('2026-11-02T02:00:00Z');
const long = notice({ id: 'cse_01ABCdevchat', chats, startedMs: now - 10 * 60e3, nowMs: now });
check('one line, no bell: the chat\'s name its link, a dash, then done when the reply says nothing (T-753)', long === '<a href="https://claude.ai/code/session_01ABCdevchat">📨 Telegram Notifications</a> – done and ready for you');
check('the name the app shows wins over an older one on the list (A-158, 2026-11-05)', (notice({ id: 'cse_01ABCdevchat', chats, startedMs: now - 60e3, nowMs: now, title: '🧑‍🏫 Renamed Since' }) ?? '').includes('>🧑‍🏫 Renamed Since</a>'));
check('every turn sends, a short one too (T-718)', MIN_MINUTES === 0 && /done and ready for you$/.test(notice({ id: 'cse_01ABCdevchat', chats, startedMs: now - 20e3, nowMs: now }) ?? ''));
check('a raised bar still holds back a shorter turn', notice({ id: 'cse_01ABCdevchat', chats, startedMs: now - 60e3, nowMs: now, minMinutes: 3 }) === null);
check('a chat not on his list still gets a link back', /session_01XYZ"/.test(notice({ id: 'cse_01XYZ', chats, startedMs: now - 5 * 60e3, nowMs: now }) ?? ''));
const list = [
  { type: 'user', timestamp: '2026-11-02T01:00:00Z', uuid: 'a', message: { content: 'first' } },
  { type: 'user', timestamp: '2026-11-02T01:50:00Z', uuid: 'b', message: { content: [{ type: 'tool_result', content: 'x' }] } },
  { type: 'user', timestamp: '2026-11-02T01:40:00Z', uuid: 'c', isMeta: true, message: { content: 'meta' } },
];
// What the turn did, from the reply's own tracker lines (T-716).
const tracker = '🛠️ **Dev Mode · Tracker**\n> Turn 5\n\n---\n# 🎯 Goal\n> **X**: y\n\n- **Last turn:** built the `button`, pushed it.\n- **What\'s next:** pick a colour.\n';
check('what was done is the reply\'s Last turn line, formatting dropped; else its first plain paragraph; long ones clipped', didOf(tracker) === 'built the button, pushed it.' && didOf('🛠️ **Dev Mode · View**\n\n---\n\nIt is **all** done.\n\nMore') === 'It is all done.' && didOf('- **Last turn:** ' + 'x'.repeat(400)).length === 120);
const withDid = notice({ id: 'cse_01XYZ', chats: [], startedMs: now - 5 * 60e3, nowMs: now, title: '🧪 Own <title>', reply: tracker });
check('a View with a diagram gives its title, never the diagram\'s code (T-761)', didOf('🛠️ **Dev Mode · View**\n> Turn 1\n\n---\n# 📨 How your messages flow\n\n```mermaid\nflowchart TD\n  A --> B\n\n  B -->|sends| C\n```\n\nMore text.') === '📨 How your messages flow');
// The incident (T-771): a View with no summary line sent its first list item, cut mid-word.
const incident = '🛠️ **Dev Mode · View**\n> Turn 183\n\n---\n## 🔍 What I saw go wrong\n\n1. 🔀 **Training messages were filed as development work.** "I did for 5…", your fitness review question and your training-times answer each landed in the development record.\n\n---\n## ❓ Which of these do you want built?\n\nI would start with 1.';
check('the incident: a reply ending on a question sends that question, never its first list item (T-771)', didOf(incident) === 'your answer needed: Which of these do you want built?');
check('a tracker that asks sends the ask, not the Last turn line', didOf(tracker + '\n---\n## ❓ Shall I go ahead?\n') === 'your answer needed: Shall I go ahead?');
check('a list is never the summary: the first plain paragraph after it is', didOf('1. one thing\n\n- another\n\nAll done here. And more after.') === 'All done here.');
check('a long line is cut on a word, never mid-word', (() => { const d = didOf('- **Last turn:** ' + 'word '.repeat(60)); return d.endsWith('word…') && d.length <= 120; })());
check('code is skipped even with no title', didOf('```\nx --> y\n\nz --> w\n```\n\nAll done.') === 'All done.');
check('the line carries what was done, escaped, the chat\'s own title its link', withDid === '<a href="https://claude.ai/code/session_01XYZ">🧪 Own &lt;title&gt;</a> – built the button, pushed it.');
check('nothing but the Last turn line reaches it: not the goal or what is next', !withDid.includes('pick a colour') && !withDid.includes('🎯'));
check('a chat with no name anywhere is called a development chat', />A development chat<\/a>/.test(notice({ id: 'cse_01XYZ', chats: [], startedMs: now - 60e3, nowMs: now })));
check('a joined emoji in the title reaches the line joined, as the app shows it (2026-11-05)', titleOf([{ type: 'custom-title', customTitle: '\u{1F9D1} \u{1F3EB} Lab' }]) === '\u{1F9D1}‍\u{1F3EB} Lab');
check('the last reply and the title are read from the transcript', lastReply([{ type: 'assistant', message: { content: [{ type: 'text', text: 'old' }] } }, { type: 'assistant', message: { content: [{ type: 'text', text: 'new' }] } }, { type: 'assistant', message: { content: [{ type: 'tool_use' }] } }]) === 'new' && titleOf([{ type: 'custom-title', customTitle: 'A' }, { type: 'custom-title', customTitle: 'B' }]) === 'B');
check('the plain-text fallback keeps the link and drops the tags', plainText('<b>Hi</b> &lt;x&gt; <a href="https://u">Chat</a>') === 'Hi <x> Chat: https://u');
check('the turn starts at the last message he typed, not a tool result or a note', turnStart(list)?.uuid === 'a');

// Only once the chat is idle (T-801): work it started and that has not reported back holds the line.
const bg = (id, extra = {}) => ({ type: 'user', timestamp: '2026-11-02T01:00:00Z', toolUseResult: { backgroundTaskId: id, ...extra }, message: { content: [{ type: 'tool_result', content: 'running' }] } });
const ag = (id) => ({ type: 'user', timestamp: '2026-11-02T01:00:00Z', toolUseResult: { isAsync: true, status: 'async_launched', agentId: id }, message: { content: [{ type: 'tool_result', content: 'launched' }] } });
const tn = (id, status) => ({ type: 'user', message: { content: `<task-notification>\n<task-id>${id}</task-id>\n<status>${status}</status>\n</task-notification>` } });
check('a background shell or agent still out is pending; one that reported back is not', pending([bg('b1'), ag('a1'), tn('b1', 'completed')]).map((o) => o.id).join() === 'a1');
check('a failed or killed job counts as back, a stopped one too', pending([bg('b1'), bg('b2'), ag('a1'), tn('b1', 'failed'), tn('a1', 'killed'), { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'TaskStop', input: { task_id: 'b2' } }] } }]).length === 0);
check('a progress note is not the end of the job; an ordinary tool result is no job', pending([bg('m1'), tn('m1', 'running'), { type: 'user', toolUseResult: { stdout: 'x' } }]).map((o) => o.id).join() === 'm1');
check('a notice that came as a queued wake or only in the queue log counts as back (2026-11-05: this chat\'s own history)', pending([bg('q1'), bg('q2'), { type: 'queue-operation', operation: 'remove', content: tn('q1', 'completed').message.content }, { type: 'attachment', attachment: { type: 'queued_command', prompt: tn('q2', 'failed').message.content } }]).length === 0);
check('an assistant quoting a notice does not end the job', pending([bg('q3'), { type: 'assistant', message: { content: [{ type: 'text', text: tn('q3', 'completed').message.content }] } }]).length === 1);
check('a permission prompt is told apart from an idle notice (T-813)', isPermissionPrompt({ notification_type: 'permission_prompt' }) && !isPermissionPrompt({ notification_type: 'idle_prompt', message: 'permission' }) && isPermissionPrompt({ message: 'Claude needs your permission to use Bash' }) && !isPermissionPrompt({ message: 'Claude is waiting for your input' }));
check('the watcher looks every half hour', FALLBACK_MS === 30 * 60e3);
check('the time so far reads as he would say it: 30 min, 1 hr, 1 hr 30 min (T-838)', waited(30 * 60e3) === '30 min' && waited(60 * 60e3) === '1 hr' && waited(90 * 60e3) === '1 hr 30 min' && waited(150 * 60e3) === '2 hr 30 min');

// The real hook, against a stand-in Telegram on this machine, in a throwaway copy.
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const dir = makeTemp('dear-dev-done-');
const got = [];
let refuseHtml = false;
const server = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const m = JSON.parse(b); got.push(m); res.end(refuseHtml && m.parse_mode ? '{"ok":false,"description":"Bad Request: can\'t parse entities"}' : '{"ok":true}'); }); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const api = `http://127.0.0.1:${server.address().port}`;
try {
  mkdirSync(join(dir, 'data', 'core', 'state'), { recursive: true });
  writeFileSync(join(dir, 'data', 'core', 'state', 'chats.json'), JSON.stringify({ chats }));
  const transcript = join(dir, 't.jsonl');
  writeFileSync(transcript, [{ type: 'user', timestamp: new Date(Date.now() - 6 * 60e3).toISOString(), uuid: 'turn1', message: { content: 'build it' } }, { type: 'assistant', message: { content: [{ type: 'text', text: tracker }] } }].map((e) => JSON.stringify(e)).join('\n'));
  const hook = join(repo, '.claude', 'hooks', 'session', 'dev-done-notify.mjs');
  const run = (id, env = {}) => new Promise((resolve) => {
    const p = spawn(process.execPath, [hook], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: id, TELEGRAM_API_TEST: api, TELEGRAM_CHAT_ID: '1', TELEGRAM_DEV_BOT_TOKEN: 't', ...env } });
    p.stdin.end(JSON.stringify({ session_id: id, transcript_path: transcript }));
    p.on('close', resolve);
  });
  await run('cse_01ABCdevchat');
  check('a personal chat (no development mode) sends nothing', got.length === 0);
  mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'hooks', 'state', 'dev-mode-cse_01ABCdevchat'), 'on');
  await run('cse_01ABCdevchat', { TELEGRAM_DEV_BOT_TOKEN: '' });
  check('with no development bot key, nothing is sent', got.length === 0);
  await run('cse_01ABCdevchat');
  check('a development chat that ran a while sends one message, with the link', got.length === 1 && got[0].text === '<a href="https://claude.ai/code/session_01ABCdevchat">📨 Telegram Notifications</a> – built the button, pushed it.' && got[0].parse_mode === 'HTML');
  await run('cse_01ABCdevchat');
  check('the same turn never sends twice', got.length === 1);
  check('what Telegram said is kept', /ok$/.test(readFileSync(join(dir, '.claude', 'hooks', 'state', 'dev-done-cse_01ABCdevchat-last'), 'utf8')));
  // A turn he did not type (a background agent handing back) ends with a new reply: it sends (T-781).
  const done = '## ✅ Nothing needed from you\n---\n## 🗂️ Still open\n- **In this chat:** nothing.';
  writeFileSync(transcript, [{ type: 'user', timestamp: new Date(Date.now() - 6 * 60e3).toISOString(), uuid: 'turn1', message: { content: 'build it' } }, { type: 'assistant', message: { content: [{ type: 'text', text: tracker }] } }, { type: 'user', isMeta: true, message: { content: '<agent-message>the build finished</agent-message>' } }, { type: 'assistant', message: { content: [{ type: 'text', text: done }] } }].map((e) => JSON.stringify(e)).join('\n'));
  await run('cse_01ABCdevchat');
  check('a turn woken without his typing, ending in a new reply, sends', got.length === 2);
  await run('cse_01ABCdevchat');
  check('and that reply never sends twice', got.length === 2);
  // A new turn whose HTML Telegram refuses goes again as plain text.
  writeFileSync(transcript, JSON.stringify({ type: 'user', timestamp: new Date(Date.now() - 6 * 60e3).toISOString(), uuid: 'turn2', message: { content: 'again' } }));
  refuseHtml = true;
  await run('cse_01ABCdevchat');
  check('a refused HTML message is sent again as plain text, and the refusal is not the last word', got.length === 4 && !got[3].parse_mode && /^📨 Telegram Notifications: https:\/\/claude\.ai/.test(got[3].text) && /ok$/.test(readFileSync(join(dir, '.claude', 'hooks', 'state', 'dev-done-cse_01ABCdevchat-last'), 'utf8')));
  // Work still out (T-801): no line at the turn's end; a still-running line each half hour with
  // the time so far (T-838); one done line once the job reports back and the next turn ends.
  const head = [{ type: 'user', timestamp: new Date(Date.now() - 61 * 60e3).toISOString(), uuid: 'turn3', message: { content: 'go' } }, { ...bg('bjob'), timestamp: new Date(Date.now() - 60 * 60e3).toISOString() }];
  writeFileSync(transcript, [...head, { type: 'assistant', message: { content: [{ type: 'text', text: '- **Last turn:** started the merge.' }] } }].map((e) => JSON.stringify(e)).join('\n'));
  refuseHtml = false;
  const before = got.length;
  const watchFrom = Date.now();
  // Waits by condition, not by a fixed sleep, so a loaded machine (the commit gate under other
  // chats' runs) never fails a case for being slow; each wait gives up after 15 s.
  const until = async (ok, ms = 15000) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await new Promise((r) => setTimeout(r, 50)); return ok(); };
  await run('cse_01ABCdevchat', { DEV_DONE_FALLBACK_TEST_MS: '500' });
  check('while a background job is out, nothing is sent at the turn\'s end (T-801)', got.length === before);
  check('work still out at the watcher\'s time says how long it has been out in all (T-832)', await until(() => got.length >= before + 1) && /still running after 1 hr, nothing needed yet$/.test(got[before].text));
  check('and it says so again at the next look, not only once (T-832)', await until(() => got.length >= before + 2) && /still running after 1 hr, nothing needed yet$/.test(got[before + 1].text));
  // A second run of the hook with the same work out starts no watcher: lines keep coming at one
  // per look, never two per look. Timed between two lines, so a slow machine only widens both.
  await run('cse_01ABCdevchat', { DEV_DONE_FALLBACK_TEST_MS: '500' });
  // Long enough after the second run that a second watcher would add several looks, not one.
  await new Promise((r) => setTimeout(r, 2000));
  const looks = got.length - before;
  // One watcher looks once per 0.5 s for as long as the test really ran, which on a loaded
  // machine is longer than the 2.25 s the waits add up to (6 lines in a busy gate, T-863). A
  // second watcher adds a look per 0.5 s on top, past this bound.
  const ran = Date.now() - watchFrom;
  const most = Math.floor(ran / 500) + 1;
  check(`the same work out never starts a second watcher (${looks} lines in ${(ran / 1000).toFixed(2)} s at one look per 0.5 s, at most ${most})`, looks >= 3 && looks <= most);
  const mark = got.length;
  await until(() => got.length >= mark + 2);
  const t0 = Date.now();
  await until(() => got.length >= mark + 3);
  await new Promise((r) => setTimeout(r, 200));
  check('the same work out never starts a second watcher (one line per look)', got.length === mark + 3 && Date.now() - t0 >= 300);
  writeFileSync(transcript, [...head, tn('bjob', 'completed'), { type: 'assistant', message: { content: [{ type: 'text', text: '- **Last turn:** merged and pushed.' }] } }].map((e) => JSON.stringify(e)).join('\n'));
  await run('cse_01ABCdevchat');
  check('once the job is back and that turn ends, the one done line goes', await until(() => /merged and pushed\.$/.test(got.at(-1)?.text ?? '')));
  const done1 = got.length;
  await new Promise((r) => setTimeout(r, 1200));
  check('and the watcher stops once the work is back', got.length === done1);
  // A job that comes back before the watcher wakes: the watcher stays quiet.
  writeFileSync(transcript, [{ type: 'user', timestamp: new Date().toISOString(), uuid: 'turn4', message: { content: 'next' } }, { ...bg('bjob2'), timestamp: new Date().toISOString() }].map((e) => JSON.stringify(e)).join('\n'));
  await run('cse_01ABCdevchat', { DEV_DONE_FALLBACK_TEST_MS: '1500' });
  writeFileSync(transcript, [{ type: 'user', timestamp: new Date().toISOString(), uuid: 'turn4', message: { content: 'next' } }, bg('bjob2'), tn('bjob2', 'completed')].map((e) => JSON.stringify(e)).join('\n'));
  await new Promise((r) => setTimeout(r, 2500));
  check('work back before the watcher wakes sends no still-running line', got.length === done1);
  // A permission prompt sends at once, even with work out, and once per prompt (T-813).
  const n0 = got.length;
  const runNote = (body) => new Promise((resolve) => {
    const p = spawn(process.execPath, [hook], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: 'cse_01ABCdevchat', TELEGRAM_API_TEST: api, TELEGRAM_CHAT_ID: '1', TELEGRAM_DEV_BOT_TOKEN: 't' } });
    p.stdin.end(JSON.stringify({ session_id: 'cse_01ABCdevchat', transcript_path: transcript, hook_event_name: 'Notification', ...body }));
    p.on('close', resolve);
  });
  writeFileSync(transcript, [{ type: 'user', timestamp: new Date().toISOString(), uuid: 'turn5', message: { content: 'go' } }, bg('bjob5')].map((e) => JSON.stringify(e)).join('\n'));
  await runNote({ notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' });
  check('a permission prompt sends at once, work out or not', got.length === n0 + 1 && /📨 Telegram Notifications<\/a> – waiting for your permission$/.test(got.at(-1).text));
  await runNote({ notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' });
  await runNote({ notification_type: 'idle_prompt', message: 'Claude is waiting for your input' });
  check('the same prompt never sends twice, and an idle notice sends nothing', got.length === n0 + 1);
} finally {
  server.close();
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `dev-done notify: ${failed} failed` : 'dev-done notify: all cases hold');
process.exit(failed ? 1 : 0);
