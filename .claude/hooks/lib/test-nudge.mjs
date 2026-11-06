// Rule test for ux/scripts/nudge.mjs, the check-in's one channel to her (HBT-005, design 4).
// Against a throwaway record: nothing goes out unless she asked, nothing after a hard
// session, nothing without a bot, and what does go out is the check-in's fresh line and only
// that: never a fixed line, never one sent recently (HBT-010).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { nudge, RETIRED, SWITCH, REMINDERS } from '../../../ux/scripts/nudge.mjs';
import { makeTemp } from './temp-litter.mjs';

const root = makeTemp('dear-nudge-');
const write = (path, text) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
};
const bot = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' };
let posted = [];
const post = async (url, init) => {
  posted.push(JSON.parse(init.body));
  return { ok: true, status: 200 };
};

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
// The day the crisis line below is written; the hold is judged against it, in the
// profile's default zone (Singapore), since this throwaway record has no profile.
const NOW = new Date('2026-10-02T12:00:00Z');
// Each run writes a new line, as the check-in does; LINE is the last one written.
let n = 0;
let LINE = '';
const fresh = () => { n += 1; LINE = `Line ${n}: something new is waiting.`; return LINE; };
const run = async (env = bot, at = NOW) => {
  posted = [];
  return nudge(root, env, { post, at, line: fresh() });
};

try {
  write('data/core/state/log.md', '| 2026-10-01 · session · a quiet one |\n');

  let r = await run();
  check('with no request of hers, nothing is sent', !r.sent && posted.length === 0);

  write(SWITCH, '---\nnudge: off\n---\n');
  r = await run();
  check('switched off, nothing is sent', !r.sent && posted.length === 0);

  write(SWITCH, '---\nnudge: on\n---\nHer words about it.\n');
  r = await run();
  check('switched on, the fresh line is sent, and only that', r.sent && posted.length === 1 && posted[0].text === LINE && Object.keys(posted[0]).sort().join() === 'chat_id,text');

  write(SWITCH, '---\nnudge: on\ndetail: full\n---\n');
  posted = [];
  r = await nudge(root, bot, { post, line: fresh(), text: 'A line from her record.' });
  check('nothing of hers is ever sent, whatever else the switch says', r.sent && posted[0].text === LINE);

  posted = [];
  r = await nudge(root, bot, { post, at: NOW, line: fresh(), question: 'How did the week land?' });
  check('a question without her choosing it is never sent: the fresh line goes', r.sent && posted[0].text === LINE);

  posted = [];
  r = await nudge(root, bot, { post, at: NOW });
  check('with no fresh line given, nothing is sent: there is no fixed fallback', !r.sent && posted.length === 0);
  r = await nudge(root, bot, { post, at: NOW, line: `  ${RETIRED.toLowerCase()} ` });
  check('the old fixed line is never sent again', !r.sent && posted.length === 0);
  r = await nudge(root, bot, { post, at: NOW, line: LINE });
  check('a line sent recently is never sent again', !r.sent && posted.length === 0);

  write(SWITCH, '---\nnudge: on\ndetail: question\n---\n');
  posted = [];
  r = await nudge(root, bot, { post, at: NOW, question: '  How did the\n week land?  ' });
  check('with detail: question, the check-in question alone is sent', r.sent && posted.length === 1 && posted[0].text === 'How did the week land?' && Object.keys(posted[0]).sort().join() === 'chat_id,text');
  posted = [];
  r = await nudge(root, bot, { post, at: NOW, line: fresh() });
  check('with detail: question but no question given, the fresh line goes', r.sent && posted[0].text === LINE);

  write(SWITCH, '---\nnudge: off\ndetail: question\n---\n');
  posted = [];
  r = await nudge(root, bot, { post, at: NOW, question: 'How did the week land?' });
  check('with the nudge off, not even the question goes', !r.sent && posted.length === 0);

  write(SWITCH, '---\nnudge: on\ndetail: question\n---\n');
  // Nothing is queued for another sender (2026-10-26): whatever her reminders file says, the
  // nudge goes straight to her bot with this environment's key, or not at all.
  write(REMINDERS, JSON.stringify({ send: 'routine', reminders: [] }));
  const kept = () => JSON.parse(readFileSync(join(root, REMINDERS), 'utf8')).reminders.length;
  posted = [];
  r = await nudge(root, bot, { post, at: NOW, question: 'How did the week land?' });
  check('with send: routine, the nudge goes straight to her bot', r.sent && posted.length === 1 && posted[0].text === 'How did the week land?' && kept() === 0);
  posted = [];
  r = await nudge(root, {}, { post, at: NOW, question: 'How did the week land?' });
  check('with send: routine and no key here, nothing is sent or queued', !r.sent && posted.length === 0 && kept() === 0);
  write(REMINDERS, JSON.stringify({ reminders: [] }));
  posted = [];
  r = await nudge(root, bot, { post, at: NOW, queued: true, question: 'How did the week land?' });
  check('a file with no "send", or the old queued flag, changes nothing: it goes straight to her bot', r.sent && posted.length === 1 && kept() === 0);
  posted = [];
  r = await nudge(root, {}, { post, at: NOW, queued: true, question: 'How did the week land?' });
  check('with no key, nothing is sent, it says why, and nothing is left for another sender', !r.sent && posted.length === 0 && kept() === 0 && r.why.includes('no bot is set up for this copy'));
  rmSync(join(root, REMINDERS));

  write(SWITCH, '---\nnudge: on\ndetail: full\n---\n');
  r = await run({});
  check('with no bot set up, nothing is sent', !r.sent && posted.length === 0);

  write('data/core/state/log.md', '| 2026-10-01 · session · a quiet one |\n| 2026-10-02 · crisis · ongoing |\n');
  r = await run();
  check('after a session that ended in crisis, nothing is sent', !r.sent && posted.length === 0);
  // HBT-005 design 2: through the day after, then it lifts by itself (2026-10-09).
  // Times in Singapore, the profile's default zone: 20:00 on 3 Oct, then 00:30 on 4 Oct.
  r = await run(bot, new Date('2026-10-03T12:00:00Z'));
  check('the day after a crisis, still nothing is sent', !r.sent && posted.length === 0);
  r = await run(bot, new Date('2026-10-03T16:30:00Z'));
  check('two days on, the hold has lifted by itself', r.sent && posted[0].text === LINE);
  // HBT-005 design 2: she can switch the hold off herself, and back on.
  write(SWITCH, '---\nnudge: on\nhold: off\n---\n');
  posted = [];
  r = await run();
  check('with hold: off, a crisis line does not stop the send', r.sent && posted.length === 1);
  write(SWITCH, '---\nnudge: on\nhold: on\n---\n');
  posted = [];
  r = await run();
  check('with hold back on, nothing is sent after a crisis', !r.sent && posted.length === 0);
  write(SWITCH, '---\nnudge: on\n---\nhold: off\n');
  r = await run();
  check('"hold: off" outside the frontmatter does not count', !r.sent && posted.length === 0);

  write('data/core/state/log.md', '| 2026-10-03 · session · a quiet one |\n');
  write(SWITCH, 'nudge: on\n');
  r = await run();
  check('"nudge: on" outside the frontmatter does not count as her asking', !r.sent && posted.length === 0);

  // No key, no queue (HBT-005 design 4): the gates still decide first, and nothing is
  // written into her reminders file for a sender that no longer exists.
  write(SWITCH, '---\nnudge: on\n---\n');
  posted = [];
  r = await nudge(root, {}, { post, at: NOW, line: fresh() });
  check('without a key it posts nothing and writes no reminders file', !r.sent && posted.length === 0 && !existsSync(join(root, REMINDERS)));
  write('data/core/state/log.md', '| 2026-10-02 · crisis · x |\n');
  r = await nudge(root, bot, { post, at: NOW, line: fresh() });
  check('after a hard session, nothing is sent even with a key', !r.sent && posted.length === 0 && r.why.includes('her last session ended hard'));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('nudge: all cases hold');
