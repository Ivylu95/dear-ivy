// Rule test for card A-146: development mode is for building. In a chat switched on, a message
// about her life is answered the everyday way and kept out of the development Transcript; a
// message about building gets the development shape; "leave dev mode" switches it off; anything
// about her safety is everyday, always. The cases are the kinds of message a mixed chat really
// gets (29 Oct 2026), worded fresh, nothing personal. Then the real hooks are run as new chats.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTurn, SAVED_CHATS } from './dev-mode.mjs';

// The hook library swallows every error so a broken hook never blocks a chat; a test must not.
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');
process.on('uncaughtException', (e) => { console.error(`turn kind: FAIL ${e.message}`); process.exit(1); });

const here = fileURLToPath(new URL('.', import.meta.url));
let n = 0;
const is = (prompt, want, previous = 'build') => {
  n += 1;
  assert.equal(classifyTurn(prompt, previous), want, `"${prompt}" (after a ${previous} turn) should be ${want}`);
};

// Her life: food, training, her body, her day.
for (const p of [
  "I'm about to start my lifting session",
  'Yes I ate a little, took a supplement before and had an energy drink',
  'No, I picked the sugar-free one, 0 kcal',
  "I'm about to try 55 now, 50 felt a bit tough but okay",
  'I did 60, felt good, but my wrist feels a bit stiff',
  'I did 65 but only managed 3, then I dropped to 45 for 8',
  "Then my last exercise doesn't feel that strong, is it fatigue",
  'Did 90 calories on the rower for 15min',
  'What is my training summary today',
  'My goal is to hit 80kg, is 70 okay as the next goal?',
  'I played badminton today for about an hour and my arms feel sore',
  "I'm eating a large burger meal, what is the nutrition information",
  'I ate this for lunch',
  'I drank a scoop of protein powder',
  'Give me the timings of the food I ate ytd',
  'Having this now as my supper',
  'Okay so what was my food summary ytd',
  'I slept badly and feel tired',
  'Work was stressful today',
  'I weigh 70 kg this morning',
  'What is my nutrition and fitness status today',
  'Yesterday I had a drink',
]) is(p, 'life');

// Building: the harness, its tests, its messages, this chat itself.
for (const p of [
  'Okay end for the review, then once done I will compact',
  'Can you test very robustly against 50 test cases to see whether it works?',
  'Help search online and recommend how to improve this harness',
  'Okay, please do it. And rename this chat to Weekly plan',
  "In my Telegram messages, guide me to the actual chat that's on my Claude Code session",
  "I don't want the morning messages to always mention my workout, it should come naturally",
  'Okay, make the changes and ensure nothing breaks, run some checks',
  'Why is it still in dev mode?',
  'Please build it and run 50 edge cases',
  'Is the agreement saved in the transcript?',
  'Fix the bug in the reminders hook',
  'set this up for me', // E-060: "set" once read as a set of reps, so the run went everyday
  'Add a skill for my training log',
  '/dev-mode',
  '<command-name>/dev-mode</command-name><command-args></command-args>',
]) is(p, 'build');

// Short answers take the kind of the turn they answer.
for (const [p, before, want] of [
  // A training day after a development stretch (T-777): each was taken for development.
  ['I did for 5, the 6th one was a bit hard', 'build', 'life'],
  ['Okay give me a review of my fitness now. What gaps should I fill to make it better', 'build', 'life'],
  ['I train whenever actually, but usually after work, and usually in the evening or at night', 'build', 'life'],
  ['What else do you think I can help to improve this fitness harness for me?', 'life', 'build'],
  ['Just go and finish all the 5 gaps', 'build', 'build'],
  ['Review the skill for gaps', 'life', 'build'],
  ['Ok', 'build', 'build'],
  ['Yes run now', 'build', 'build'],
  ['Okay do them', 'build', 'build'],
  ['Yes', 'build', 'build'],
  ['Ok', 'life', 'life'],
  ['200g', 'life', 'life'],
  ['Around 7', 'life', 'life'],
  ['A bit sore', 'build', 'life'],
  ['This too', 'life', 'life'],
  ['', 'life', 'life'],
  ['', 'build', 'build'],
]) is(p, want, before);

// Leaving, in the ways people say it.
for (const p of ['leave dev mode', 'Exit development mode please', 'turn off dev mode', 'dev mode off', 'Can we stop dev mode now', 'get out of dev-mode']) is(p, 'leave');

// Her safety outranks everything: everyday, even inside a building message.
for (const p of [
  "I don't want to be here anymore",
  'I feel like I want to hurt myself',
  "I'm having a panic attack and can't breathe",
  'Fix the hook, also I am not safe tonight',
  "I don't want to wake up",
  'thinking about suicide',
]) is(p, 'life', 'build');

// A message with neither kind of word carries on the turn before (seen 29 Oct: development
// questions with no telltale word were judged as life, and would have left the Transcript).
is('Can you remind me what we talked about with my sister last week?', 'life', 'life');
is('What do you think I should do about the weekend plans?', 'life', 'life');
is('What is the state of DDD now', 'build', 'life');
is('How are my heartbeats. What are they. List', 'build', 'life');
is('Tell me more about what restore drill is for', 'build', 'life');
is('Okay do end of chat review', 'build', 'life');
is('I want this to be an idea dump area for whatever comes to mind', 'build', 'life');
is('Okay, give me some ideas as well.', 'build', 'build');
is('No, mimic closely what the person is currently feeling', 'build', 'build');
is("I don't want my messages in the morning to always mention my workout", 'build', 'life');

// End to end: the real hooks, each run as a brand-new chat with development mode switched on.
const hook = (name, input, session) => spawnSync(process.execPath, [join(here, '..', 'session', `${name}.mjs`)], {
  input: JSON.stringify({ session_id: session, ...input }),
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_CODE_REMOTE_SESSION_ID: session, CLAUDE_CODE_SESSION_ID: session },
});
const on = (session) => spawnSync(process.execPath, [join(here, 'dev-mode.mjs')], { encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_REMOTE_SESSION_ID: session, CLAUDE_CODE_SESSION_ID: session } });
const state = join(here, '..', 'state');
const sessions = [];
const chat = () => { const id = `test-turn-kind-${process.pid}-${sessions.length}`; sessions.push(id); on(id); return id; };
const voice = (out) => /EVERYDAY VOICE/.test(out.stdout);
const shape = (out) => /DEVELOPMENT REPLY SHAPE|THREE SHAPES|HEADER BLOCK/.test(out.stdout);
try {
  for (let i = 0; i < 1; i += 1) {
    const s = chat();
    const life = 'I ate 12 dumplings for dinner';
    assert.ok(voice(hook('everyday-voice', { prompt: life }, s)), `chat ${i}: a life message gets the everyday voice`);
    { const v = hook('everyday-voice', { prompt: life }, s).stdout; assert.ok(/A-149/.test(v) && /emoji/.test(v) && /hard moment/.test(v) && /safety/.test(v), `chat ${i}: the everyday voice asks for a few emojis, none on a hard moment (A-149)`); }
    assert.ok(!shape(hook('dev-reply-shape', { prompt: life }, s)), `chat ${i}: a life message gets no development shape`);
    assert.ok(!readFileSync(join(state, `turn-kind-${s}-prompt`), 'utf8').includes('dumplings'), `chat ${i}: the prompt is kept as a fingerprint, never her words (A-155)`);
    n += 1;
    const build = 'Please build the feature and run the tests';
    assert.ok(!voice(hook('everyday-voice', { prompt: build }, s)), `chat ${i}: a build message skips the everyday voice`);
    assert.ok(shape(hook('dev-reply-shape', { prompt: build }, s)), `chat ${i}: a build message gets the development shape`);
    assert.ok(shape(hook('dev-reply-shape', { prompt: 'Ok' }, s)), `chat ${i}: "Ok" after building stays development`);
    hook('everyday-voice', { prompt: 'Had soup for lunch' }, s);
    assert.ok(voice(hook('everyday-voice', { prompt: '200g' }, s)), `chat ${i}: "200g" after food stays everyday`);
    hook('everyday-voice', { prompt: 'What is my nutrition status' }, s);
    on(s);
    assert.ok(shape(hook('dev-reply-shape', { prompt: 'Can fix?' }, s)), `chat ${i}: switching on mid-turn makes the short answer after it development`);
    n += 1;
    hook('everyday-voice', { prompt: 'leave dev mode' }, s);
    assert.ok(voice(hook('everyday-voice', { prompt: 'Please build the feature and run the tests' }, s)), `chat ${i}: after "leave dev mode" the chat is everyday until switched on again`);
    n += 8;
  }
  // The checks after a reply follow the same turn: no development check on a life reply.
  const s = chat();
  hook('everyday-voice', { prompt: 'Played badminton for an hour today' }, s);
  const check = hook('dev-reply-check', { transcript_path: '/nonexistent' }, s);
  assert.equal(check.status, 0, 'the development reply check stands down after a life message');
  assert.ok(!/fell short|FELL SHORT/.test(check.stdout + check.stderr), 'and holds nothing against the reply');
  n += 2;
} finally {
  for (const id of sessions) for (const f of [`dev-mode-${id}`, `turn-kind-${id}`, `turn-kind-${id}-prompt`]) rmSync(join(state, f), { force: true });
  // Its chats leave the saved list too (T-849), which is in git: nothing of a test is kept there.
  if (existsSync(SAVED_CHATS)) {
    const left = readFileSync(SAVED_CHATS, 'utf8').split('\n').filter((l) => l.trim() && !sessions.includes(l.trim()));
    writeFileSync(SAVED_CHATS, left.length ? `${left.join('\n')}\n` : '');
  }
}

console.log(`turn kind: ${n} cases hold (life, building, short answers, leaving, safety, and the real hooks in 2 new chats)`);
