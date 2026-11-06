// Rule test for card A-158: an area she uses with no chat of its own is offered once, a chat
// already on her list covers its area, an answer kept stops the offer, and this chat is
// found on her list by its session id. Everything is made up; nothing personal.

import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { appName, chatGaps, covers, inUse, liveTitle, nameCheckDue, readList, RENAMED, syncTitle, thisChat, thisChatLine } from './chats.mjs';
import { readModules } from './modules.mjs';
import { repoRoot } from './hook.mjs';
import { makeTemp } from './temp-litter.mjs';

process.removeAllListeners('uncaughtException');
process.on('uncaughtException', (e) => { console.error(`chats: FAIL ${e.message}`); process.exit(1); });

let n = 0;
const ok = (v, why) => { n += 1; assert.ok(v, why); };
const mod = (name, chat, grows = []) => ({ name, manifest: chat ? { chat } : {}, grows });
const core = mod('core', { emoji: '☀️', title: 'How I am', for: 'her days' });
const food = mod('nutrition', { emoji: '🏋️', title: 'Food and training', for: 'food' }, ['nutrition/days']);
const talk = mod('therapy', { emoji: '🛋️', title: 'Therapy', for: 'appointments' }, ['therapy/sessions']);
const quiet = mod('quiet', null, ['quiet/notes']);

const dir = makeTemp('chats-');
try {
  mkdirSync(join(dir, 'core', 'state'), { recursive: true });
  mkdirSync(join(dir, 'nutrition', 'days'), { recursive: true });
  mkdirSync(join(dir, 'therapy', 'sessions'), { recursive: true });
  writeFileSync(join(dir, 'therapy', 'sessions', 'README.md'), '# sessions\n');
  const mods = [core, food, talk, quiet];
  const list = (chats, offers = {}) => ({ chats, offers });
  const gaps = (l) => chatGaps(mods, dir, l).map((g) => g.module);

  ok(inUse(core, dir), 'core is always in use');
  ok(!inUse(food, dir), 'a module with an empty folder is not in use');
  ok(!inUse(talk, dir), 'a folder holding only its README is not in use');
  assert.deepEqual(gaps(list([])), ['core'], 'a new record is offered the chat for how she is'); n += 1;

  writeFileSync(join(dir, 'nutrition', 'days', '2026-01-02.md'), '# a day\n');
  ok(inUse(food, dir), 'a module with an entry is in use');
  assert.deepEqual(gaps(list([])), ['core', 'nutrition'], 'a module she uses with no chat is a gap'); n += 1;

  const general = { url: 'https://claude.ai/code/session_aaaaaaaaaa', kind: 'everyday', state: 'open', general: true };
  assert.deepEqual(gaps(list([general])), ['nutrition'], 'the general chat covers core'); n += 1;
  const fit = { url: 'https://claude.ai/code/session_bbbbbbbbbb', kind: 'everyday', state: 'open', modules: ['nutrition'] };
  assert.deepEqual(gaps(list([general, fit])), [], 'a chat naming a module covers it'); n += 1;
  assert.deepEqual(gaps(list([general, { ...fit, state: 'closed' }])), ['nutrition'], 'a closed chat covers nothing'); n += 1;
  assert.deepEqual(gaps(list([general, { ...fit, kind: 'dev' }])), ['nutrition'], 'a development chat covers nothing'); n += 1;
  assert.deepEqual(gaps(list([general], { nutrition: { date: '2026-01-02', answer: 'no' } })), [], 'a no is kept, and never offered again'); n += 1;
  assert.deepEqual(gaps(list([general], { nutrition: { date: '2026-01-02', answer: 'not yet' } })), [], 'any answer stops a second offer'); n += 1;
  assert.deepEqual(covers({ modules: ['core', 'therapy'] }), ['core', 'therapy'], 'one chat may cover two areas'); n += 1;
  ok(!gaps(list([])).includes('quiet'), 'a module naming no chat is never offered');
  const g = chatGaps(mods, dir, list([general]))[0];
  ok(g.title === 'Food and training' && g.emoji === '🏋️', 'a gap carries the chat the module names');

  ok(thisChat(list([general, fit]), 'cse_bbbbbbbbbb') === fit, 'this chat is found by its cloud id');
  ok(thisChat(list([general, fit]), 'session_aaaaaaaaaa') === general, 'and by its session id');
  ok(thisChat(list([general]), 'cse_zzzzzzzzzz') === null, 'a chat not on her list is null');
  ok(thisChat(list([general]), '') === null, 'no id, no chat');

  // A topic another chat holds: a short answer, that chat named, nothing carrying it on here.
  const fitNamed = { ...fit, title: '🏋️ Food and training', for: 'training and food' };
  const day = { ...general, title: '☀️ Days', for: 'how she is' };
  const said = thisChatLine(fitNamed, [day]);
  ok(said.startsWith('THIS CHAT (A-158): 🏋️ Food and training, for training and food.'), 'the line names this chat and what it is for');
  ok(said.includes('☀️ Days (how she is)'), 'and her other chats, with what each holds');
  ok(/briefly/.test(said) && /few lines/.test(said), 'a topic another chat holds is answered briefly, never in full');
  ok(/then name that chat/.test(said), 'and the chat it lives in is named');
  ok(/no question that carries it on here/.test(said), 'with no question that keeps it going here');
  ok(!/answer it fully|still answered here, and where/.test(said), 'the old answer-in-full wording is gone');
  ok(thisChatLine(fitNamed, []) === 'THIS CHAT (A-158): 🏋️ Food and training, for training and food.', 'with no other chat, no redirect is said');

  // The router row holds even if the skill never loads, so it must say the same (found stale, 2026-11-03).
  const row = readModules(repoRoot).flatMap((m) => m.manifest.router ?? m.manifest.skills ?? []).find((r) => /chats$/.test(r.skill ?? ''));
  ok(row && /briefly/.test(row.must) && /no question that carries it on/.test(row.must), "the chats router row says brief, that chat named, no question carrying it on");
  ok(row && !/still answered here, and where it lives said once/.test(row.must), 'the router row has no old answer-here wording');

  // A-158, 2026-11-05: renamed in the app, the list follows, keeping the old name; nothing else moves.
  {
    const p = join(dir, 'core', 'state', 'chats.json');
    const kept = { chats: [{ url: 'https://claude.ai/code/session_01Renamed', title: '🎓 Old Name', kind: 'dev', state: 'open' }, { url: 'https://claude.ai/code/session_01Other', title: '☀️ Other', kind: 'everyday', state: 'open' }], offers: { x: { answer: 'kept' } } };
    writeFileSync(p, `${JSON.stringify(kept, null, 2)}\n`);
    ok(liveTitle([{ type: 'custom-title', customTitle: 'First' }, { type: 'user' }, { type: 'custom-title', customTitle: ' 🧑‍🏫 New Name ' }]) === '🧑‍🏫 New Name', 'the live title is the latest the app set, trimmed');
    ok(liveTitle([{ type: 'user' }]) === '', 'a chat never named has no live title');
    ok(liveTitle([{ type: 'custom-title', customTitle: '\u{1F9D1} \u{1F3EB} Dev Lab' }]) === '\u{1F9D1}‍\u{1F3EB} Dev Lab', 'a joined emoji the transcript kept with a space is joined again');
    ok(liveTitle([{ type: 'custom-title', customTitle: '\u{1F4A1} Idea Factory' }]) === '\u{1F4A1} Idea Factory', 'a space between an emoji and a word stays a space');
    const changed = syncTitle(dir, 'cse_01Renamed', '🧑‍🏫 New Name', '2026-11-05');
    const after = JSON.parse(readFileSync(p, 'utf8'));
    ok(changed && after.chats[0].title === '🧑‍🏫 New Name', 'a renamed chat takes the name the app shows');
    ok(JSON.stringify(after.chats[0].formerly) === JSON.stringify([{ title: '🎓 Old Name', until: '2026-11-05' }]), 'its old name is kept, never dropped');
    ok(after.chats[1].title === '☀️ Other' && after.offers.x.answer === 'kept', 'no other chat and no answer changes');
    const text = readFileSync(p, 'utf8');
    ok(syncTitle(dir, 'cse_01Renamed', '🧑‍🏫 New Name') === null && readFileSync(p, 'utf8') === text, 'the same name again writes nothing');
    ok(syncTitle(dir, 'cse_01Renamed', '') === null && syncTitle(dir, 'cse_01Renamed', 'two\nlines') === null && syncTitle(dir, 'cse_01NotListed', 'X') === null && readFileSync(p, 'utf8') === text, 'no title, a broken one, or a chat not on the list writes nothing');
    syncTitle(dir, 'cse_01Renamed', '🧑‍🏫 Third', '2026-11-06');
    ok(JSON.parse(readFileSync(p, 'utf8')).chats[0].formerly.length === 2, 'each rename adds to the old names');
  }

  // A stale transcript title never undoes the app's (T-795).
  {
    const listPath = join(dir, 'core', 'state', 'chats.json');
    const put = (entry) => writeFileSync(listPath, JSON.stringify({ chats: [entry], offers: {} }));
    const base = { url: 'https://claude.ai/code/session_cccccccccc', kind: 'everyday', state: 'open', modules: ['nutrition'] };
    put({ ...base, title: '🏋️ Lift', title_from: 'app' });
    ok(syncTitle(dir, 'cse_cccccccccc', '🍏 Old name') === null && readList(dir).chats[0].title === '🏋️ Lift', "a title read from the app is never overwritten by the transcript's");
    put({ ...base, title: '🏋️ Lift', formerly: [{ title: '🍏 Old name', until: '2026-01-01' }] });
    ok(syncTitle(dir, 'cse_cccccccccc', '🍏 Old name') === null && readList(dir).chats[0].title === '🏋️ Lift', 'a name the chat already left is never taken back');
    put({ ...base, title: '🏋️ Lift' });
    ok(syncTitle(dir, 'cse_cccccccccc', '🎯 New name')?.title === '🎯 New name' && readList(dir).chats[0].formerly[0].title === '🏋️ Lift', 'a real rename still reaches the list, the old name kept');
  }

  // The app's name, on two events and no clock (T-829).
  for (const said of ['I renamed this chat', 'I changed the emoji of this chat', 'just renamed it', "the chat's name is different now", 'changed its name'])
    ok(RENAMED.test(said), `"${said}" is his rename`);
  for (const said of ['I did 140 for 2', 'what is my name in the record', 'change my water goal'])
    ok(!RENAMED.test(said), `"${said}" is not a rename`);
  ok(nameCheckDue({ prompt: 'hi', checked: false, remote: true }) === 'first', "a chat's first turn here owes a check");
  ok(nameCheckDue({ prompt: 'hi', checked: true, remote: true }) === null, 'once checked, an ordinary turn owes nothing');
  ok(nameCheckDue({ prompt: 'I renamed this chat', checked: true, remote: true }) === 'renamed', 'his rename owes one, checked or not');
  ok(nameCheckDue({ prompt: 'I renamed this chat', checked: false, remote: false }) === null, 'a copy with no remote-session tool owes none');
  ok(nameCheckDue({ prompt: 'I renamed this chat', checked: false, remote: true, unsafe: true }) === null, 'never in a message about safety');
  {
    const listPath = join(dir, 'core', 'state', 'chats.json');
    const base = { url: 'https://claude.ai/code/session_dddddddddd', kind: 'everyday', state: 'open', modules: ['nutrition'] };
    writeFileSync(listPath, JSON.stringify({ chats: [{ ...base, title: '🍏 Stale' }], offers: {} }));
    const e = appName(dir, 'cse_dddddddddd', '🏋️ Lift', '2026-01-02');
    ok(e?.title === '🏋️ Lift' && e.title_from === 'app' && e.formerly[0].title === '🍏 Stale', "the app's name goes on, marked, the old one kept");
    ok(appName(dir, 'cse_dddddddddd', '🏋️ Lift') === null, 'the same name again changes nothing');
    ok(syncTitle(dir, 'cse_dddddddddd', '🍏 Stale') === null && readList(dir).chats[0].title === '🏋️ Lift', "and the transcript's stale one cannot undo it");
  }

  // T-928: what reaches his phone names the chat as the list does now, never a name a reminder
  // or the transcript kept from before (the 🍏 seen on 4 and 5 Nov).
  {
    const { chatFor, messageFor } = await import('./chat-link.mjs');
    const url = 'https://claude.ai/code/session_eeeeeeeeee';
    const listed = [{ url, title: '🏋️ Lift', kind: 'everyday', state: 'open', title_from: 'app' }];
    const stale = { id: 'water', emoji: '💧', text: 'Water', chat: { url, title: '🍏 Stale' } };
    const linked = chatFor(stale, {}, listed);
    const msg = messageFor({ ...stale, chat: linked.chat }, 'A big glass now');
    ok(msg.includes('🏋️ Lift') && !msg.includes('🍏'), "a reminder's link takes the list's name, never the one it stored");
    const { notice } = await import('../session/dev-done-notify.mjs');
    const line = notice({ id: 'cse_eeeeeeeeee', chats: listed, startedMs: 0, nowMs: 1, title: '🍏 Stale', reply: '- **Last turn:** done.' });
    ok(line.includes('🏋️ Lift') && !line.includes('🍏'), "the turn-finished line takes the list's name over the transcript's");
  }

  writeFileSync(join(dir, 'core', 'state', 'chats.json'), '{ broken');
  assert.deepEqual(readList(dir), { chats: [], offers: {} }, 'a broken list reads as empty, never a crash'); n += 1;

  // The real modules: each that names a chat names all three parts.
  for (const m of readModules(repoRoot)) if (m.manifest.chat) ok(['emoji', 'title', 'for'].every((k) => m.manifest.chat[k]), `${m.name}'s chat names an emoji, a title and what it is for`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`chats: ${n} cases hold (gaps, cover, answers kept, this chat, and every module's chat)`);
