#!/usr/bin/env node
// Rule test for the gap finder (card A-180), on invented records in a throwaway folder,
// never her record: gaps are found and ranked; nothing under "Handle with care", nothing
// she asked to drop and nothing about safety is ever a gap; no question is about how the
// system works; what she answered is never asked again and a "not now" waits; never a
// second gap question in a day; nothing on a hard day, late at night, in a development
// chat or while a profile question is owed. Last, the session brief itself, on a throwaway
// copy, gives the one line, and gives none on a crisis day.
//
// Run: node .claude/hooks/lib/test-gaps.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { withCurrentHeader } from './profile-schema.mjs';
import {
  SYSTEM_WORDS,
  addDays,
  askedRecently,
  briefGap,
  datesIn,
  due,
  findGaps,
  hardDay,
  heldBy,
  readState,
  settle,
  STATE_PATH,
} from './gaps.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const harness = join(here, '..', '..', '..');
const cli = join(here, 'gaps.mjs');
const dir = makeTemp('gaps-');
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const TODAY = '2026-03-20';
const longDate = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** An invented record, every name and event made up, dated around `today`. */
function record(root, today = TODAY, { careNow = '', talkPush = '', loops = '', log = '' } = {}) {
  const ago = (n) => addDays(today, -n);
  put(root, 'core/state/now.md', [
    '# Now',
    '',
    `_Last updated: ${ago(1)}_`,
    '',
    '## What\'s live right now',
    '',
    '- **Person-W**: they have been close lately.',
    '- **Person-O**: back from the coast; the new flatmate arrives (date not given).',
    '- **Pottery class**: her first term, the kiln booking not yet known.',
    '- Her brother says "not yet known" about the move, in his words.',
    '',
    '## Handle with care',
    '',
    '- **Her old job is not the question** (her request).',
    `- The recital: start date not yet confirmed. ${careNow}`,
    '',
  ].join('\n'));
  put(root, 'core/state/open_loops.md', [
    '# Open loops',
    '',
    '## Raise next session',
    '',
    '- [ ] The garden allotment waiting list.',
    '- [ ] Whether the teacher replied about the timetable.',
    '- [ ] The crisis on the bridge, when she is ready.',
    `- [ ] ${ago(30)}: the choir audition: she asked to drop it. Don't reopen it.`,
    '- [ ] The quarterly bills for the studio.',
    '- [x] The bicycle repair.',
    loops,
    '',
    '## Before her next appointment',
    '',
    '- [ ] The headaches, unchanged.',
    '',
  ].join('\n'));
  put(root, 'core/calendar/calendar.md', [
    '# Calendar',
    '',
    '## Coming up',
    '',
    '| Date | What | Notes |',
    '|---|---|---|',
    `| ${longDate(ago(3))} | Lantern festival with Person-W | Told ${ago(10)} |`,
    `| ${longDate(ago(20))} | Pottery open day | Told ${ago(25)} |`,
    `| ${longDate(ago(5))} | Choir audition at the hall | |`,
    `| ${longDate(ago(8))} | Dinner with Person-O | **Done: went well** |`,
    `| ${longDate(ago(6))} | Museum trip with Person-W | |`,
    `| ${longDate(ago(90))} | Old ferry trip | |`,
    `| ${longDate(addDays(today, 10))} | Studio move | Time not given |`,
    '',
    '## Recurring — the hard ones',
    '',
    '| Date | What | How she wants it handled |',
    '|---|---|---|',
    '| 02 Feb | The day of the accident | Not recorded |',
    '',
  ].join('\n'));
  put(root, 'core/me/how_to_talk_to_me.md', [
    '# How to talk to me',
    '',
    '## Don\'t push on',
    '',
    '| Date | Topic | Her words |',
    '|---|---|---|',
    `| ${ago(40)} | The teacher and whether to complain about him. | she said leave it |`,
    talkPush,
    '',
  ].join('\n'));
  put(root, 'core/timeline.md', [
    '# Timeline',
    '',
    '## Entries',
    '',
    '| Date | Type | Tags | What happened | File |',
    '|---|---|---|---|---|',
    `| ${ago(5)} | good | friends | Museum trip with Person-W, a good afternoon | → core/journal/x.md |`,
    `| ${ago(60)} | health | medication | Started the new dose, 20 mg | → therapy/x.md |`,
    `| ${ago(2)} | good | friends | Coffee with Person-W | → core/journal/y.md |`,
    '',
  ].join('\n'));
  put(root, 'core/people/person-w.md', `# Person-W\n\nA close friend. Last spoke ${ago(2)}.\n`);
  put(root, 'core/people/person-o/README.md', `# Person-O\n\nHer cousin. Back from the coast, ${ago(40)}.\n`);
  put(root, 'core/people/person-o/history.md', `# History\n\nGrew up next door; a long trip in ${longDate(ago(45))}.\n`);
  put(root, 'core/people/person-m.md', `# Person-M\n\nAn old neighbour, last heard of ${ago(200)}.\n`);
  put(root, 'core/state/log.md', `# Session log\n\n${log}\n`);
  return root;
}

try {
  // ── finding and ranking ────────────────────────────────────────────────────
  const r1 = record(join(dir, 'one'));
  const gaps = findGaps(r1, TODAY);
  const byKind = (k) => gaps.filter((g) => g.kind === k);
  const q = (re) => gaps.find((g) => re.test(g.question));
  check('dates read in both shapes, a range read as its later day', datesIn('7 to 8 Nov 2026 and 2026-01-02').sort().join() === '2026-01-02,2026-11-08');

  check('a passed date with nothing said of it is a gap', Boolean(q(/Lantern festival/)));
  check('the passed gap asks how it went, with the day', /^How did it go: Lantern festival with Person-W \(\w{3} \d+ \w{3}\)\?$/.test(q(/Lantern/)?.question ?? ''));
  check('a passed date the timeline already tells is not a gap', !q(/Museum trip/));
  check('a passed date marked done is not a gap', !q(/Dinner with Person-O/));
  check('a date long past is not a gap', !q(/ferry/));
  check('the more recent passed date ranks first', gaps.indexOf(q(/Lantern/)) < gaps.indexOf(q(/Pottery open day/)));
  check('a person in the snapshot with nothing new for weeks is a gap', /^How are things with Person-O these days\?$/.test(byKind('person')[0]?.question ?? ''));
  check('a person spoken of two days ago is not a gap', !q(/with Person-W these days/));
  check('a person not in the snapshot is not a gap', !q(/Person-M/));
  check('medication unmentioned for six weeks is a gap', /^Has anything changed with your medication since/.test(byKind('clinical')[0]?.question ?? ''));
  check('a line marked not given is a gap, asked as a question about when', Boolean(q(/^Do you know when yet: .*flatmate arrives/)));
  check('a line marked not yet known is a gap', Boolean(q(/^Where do things stand now: .*first term, the kiln booking\?$/)));
  check('a topic she asked not to be pushed on fences only its own words', Boolean(q(/Pottery open day/)));
  check('no question carries a stray bracket', gaps.every((g) => !/\(\s*\?|\(\?$/.test(g.question) && (g.question.match(/\(/g) ?? []).length === (g.question.match(/\)/g) ?? []).length));
  check('her quoted words are never turned into a gap', !q(/brother/));
  check('an undated open thread is a gap', Boolean(q(/garden allotment/)));
  check('a date still ahead with no time given is a gap', Boolean(q(/Studio move/)));
  check('the notes for her clinician are not gaps (their own skill raises them)', !q(/headaches/));
  check('a closed thread is not a gap', !q(/bicycle/));
  const kinds = gaps.map((g) => g.kind);
  check('ranked: passed, then clinical, then person, then unknown, then loop', kinds.indexOf('passed') < kinds.indexOf('clinical') && kinds.indexOf('clinical') < kinds.indexOf('person') && kinds.indexOf('person') < kinds.indexOf('unknown') && kinds.indexOf('unknown') < kinds.lastIndexOf('loop') && kinds.lastIndexOf('passed') < kinds.indexOf('person'));
  check('ids are stable from run to run', JSON.stringify(findGaps(r1, TODAY).map((g) => g.id)) === JSON.stringify(gaps.map((g) => g.id)));
  check('every gap has an id, a question, why it matters and where it came from', gaps.every((g) => /^[0-9a-f]{8}$/.test(g.id) && g.question.endsWith('?') && g.why && g.source));

  // ── never asked ────────────────────────────────────────────────────────────
  check('nothing under "Handle with care" is a gap', !q(/recital/));
  check('a topic under "Don\'t push on" is never asked, wherever it turns up', !gaps.some((g) => /teacher/i.test(g.question)));
  check('a thread she asked to drop is never asked', !gaps.some((g) => /choir/i.test(g.question)));
  check('a passed date on a dropped topic is not asked either', !q(/audition/));
  check('nothing about safety is ever a gap', !gaps.some((g) => /crisis|bridge/i.test(g.question)));
  check('a hard date is never a gap', !gaps.some((g) => /accident/i.test(g.question)));
  check('no question is about how the system works', gaps.every((g) => !SYSTEM_WORDS.test(g.question)));
  const r1b = record(join(dir, 'one-b'), TODAY, { careNow: '\n- **Money is not the question** (her request).', talkPush: `| ${TODAY} | Her medication, until she brings it up. | |`, loops: '- [ ] The file of old letters from the session.' });
  const gapsB = findGaps(r1b, TODAY);
  check('with money fenced, a thread about bills is never asked', !gapsB.some((g) => /bills/i.test(g.question)) && gaps.some((g) => /bills/i.test(g.question)));
  check('with medication fenced, the medication question is never asked', !gapsB.some((g) => g.kind === 'clinical'));
  check('a thread worded about files or sessions is left out, not asked', !gapsB.some((g) => /letters/i.test(g.question)));

  // ── what she said is kept ──────────────────────────────────────────────────
  const top = gaps[0];
  settle(r1, top.id, 'asked', { today: TODAY, session: 'chat-a', question: top.question });
  let state = readState(r1);
  check('asking it is kept, with the day and the chat', state.gaps[top.id]?.asked === TODAY && state.gaps[top.id]?.session === 'chat-a');
  check('a question asked today means no second one today, in any chat', askedRecently(state, TODAY, 'chat-b'));
  check('the same chat gets none the morning after either', askedRecently(state, addDays(TODAY, 1), 'chat-a') && !askedRecently(state, addDays(TODAY, 1), 'chat-b'));
  check('asked and never settled, it waits two weeks', heldBy(state.gaps[top.id], addDays(TODAY, 13)) && !heldBy(state.gaps[top.id], addDays(TODAY, 14)));
  settle(r1, top.id, 'answered', { today: TODAY });
  state = readState(r1);
  check('answered, it is never asked again, a year on included', heldBy(state.gaps[top.id], addDays(TODAY, 365)) === 'answered' && !due(findGaps(r1, TODAY), state, TODAY).some((g) => g.id === top.id));
  const second = gaps[1];
  settle(r1, second.id, 'not_now', { today: TODAY, askAfter: addDays(TODAY, 3) });
  state = readState(r1);
  check('"not now" waits until the day she named', heldBy(state.gaps[second.id], addDays(TODAY, 2)) && !heldBy(state.gaps[second.id], addDays(TODAY, 3)));
  settle(r1, gaps[2].id, 'not_now', { today: TODAY });
  check('"not now" with no day waits two weeks', readState(r1).gaps[gaps[2].id].ask_after === addDays(TODAY, 14));
  settle(r1, gaps[3].id, 'declined', { today: TODAY });
  check('declined, it is never asked again', heldBy(readState(r1).gaps[gaps[3].id], addDays(TODAY, 400)) === 'declined');
  check('the state lives in her record, as JSON', JSON.parse(readFileSync(STATE_PATH(r1), 'utf8')).gaps[top.id].status === 'answered');

  // ── the brief's one line, and its gates ───────────────────────────────────
  const r2 = record(join(dir, 'two'));
  const noon = `${TODAY}T12:00:00+00:00`;
  const line = briefGap({ dataDir: r2, local: noon, session: 's1' });
  check('an everyday chat on an ordinary day gets one gap line', Boolean(line.line) && line.gap.id === findGaps(r2, TODAY)[0].id);
  check('the line names one question, its id and how to keep the answer', (line.line.match(/"[^"]+\?"/g) ?? []).length === 1 && line.line.includes(`asked ${line.gap.id}`) && line.line.includes(`answered ${line.gap.id}`) && line.line.includes(`not-now ${line.gap.id}`) && line.line.includes(`declined ${line.gap.id}`));
  check('the line says hear her first, at a natural pause, at most one, never in a crisis or hard moment', /hear what she came with first/.test(line.line) && /natural pause/.test(line.line) && /At most one gap question/.test(line.line) && /crisis, on a hard day or in a hard moment/.test(line.line));
  check('a development chat gets none', !briefGap({ dataDir: r2, local: noon, everyday: false }).line);
  check('none while a profile question is owed', !briefGap({ dataDir: r2, local: noon, profileOwed: 1 }).line);
  check('none late at night', !briefGap({ dataDir: r2, local: `${TODAY}T23:30:00+00:00` }).line && !briefGap({ dataDir: r2, local: `${TODAY}T03:00:00+00:00` }).line);
  for (const [log, what] of [
    [`| ${TODAY} · crisis · ongoing |`, 'a crisis today'],
    [`| ${addDays(TODAY, -1)} · crisis · ongoing |`, 'a crisis yesterday'],
    [`${TODAY} · panic · shaking at work`, 'panic today'],
    [`${TODAY} · something-happened · a hard day at the office`, 'a session that says it was a hard day'],
  ]) {
    check(`none on a hard day: ${what}`, hardDay(log, TODAY) && !briefGap({ dataDir: r2, local: noon, log }).line);
  }
  check('a crisis three days ago no longer holds it', !hardDay(`| ${addDays(TODAY, -3)} · crisis · ongoing |`, TODAY) && Boolean(briefGap({ dataDir: r2, local: noon, log: `| ${addDays(TODAY, -3)} · crisis · ongoing |` }).line));

  // The command the line names, run as a session would.
  const run = (...args) => spawnSync(process.execPath, [cli, ...args, '--data', r2, '--today', TODAY], { encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: 's1', CLAUDE_CODE_REMOTE_SESSION_ID: '' } });
  const asked = run('asked', line.gap.id);
  check('`asked <id>` keeps it', asked.status === 0 && readState(r2).gaps[line.gap.id]?.status === 'asked');
  check('after one is asked, the brief gives no second line that day', !briefGap({ dataDir: r2, local: noon, session: 's2' }).line);
  check('a mistyped id is refused, nothing kept', run('answered', 'deadbeef').status === 1 && !readState(r2).gaps.deadbeef);
  check('a bad date for not-now is refused', run('not-now', line.gap.id, 'next week').status === 1);
  check('`answered <id>` keeps it', run('answered', line.gap.id).status === 0 && readState(r2).gaps[line.gap.id].status === 'answered');
  const tomorrow = briefGap({ dataDir: r2, local: `${addDays(TODAY, 1)}T12:00:00+00:00`, session: 's3' });
  check('the next day, a new chat gets the next gap, never the answered one', Boolean(tomorrow.line) && tomorrow.gap.id !== line.gap.id);
  check('`list` prints the gaps with their ids', run('list').stdout.includes(tomorrow.gap.id));

  // ── the session brief itself, on a throwaway copy ─────────────────────────
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && !k.startsWith('CLAUDE_CODE_REMOTE') && k !== 'CCR_AGENT_PROXY_ENABLED' && k !== 'DEAR_RECORD_READONLY' && k !== 'CLAUDE_CODE_SESSION_ID'));
  const sh = (cwd, ...args) => execFileSync('git', args, { cwd, env: base, stdio: 'ignore' });
  const root = join(dir, 'copy');
  sh(dir, 'init', '-q', '--bare', '-b', 'main', 'copy.git');
  mkdirSync(root);
  sh(root, 'init', '-q', '-b', 'main');
  sh(root, 'remote', 'add', 'origin', join(dir, 'copy.git'));
  cpSync(join(harness, 'modules'), join(root, 'modules'), { recursive: true });
  const brief = (sid = 'brief-chat') => spawnSync(process.execPath, [join(harness, '.claude', 'hooks', 'session', 'session-brief.mjs')], { cwd: root, env: { ...base, CLAUDE_PROJECT_DIR: root }, input: JSON.stringify({ session_id: sid }), encoding: 'utf8', timeout: 120000 }).stdout ?? '';
  brief();
  // A zone where it is about noon now, so the late-night gate never decides this case.
  const offset = Math.max(-12, Math.min(14, 12 - new Date().getUTCHours()));
  const zone = offset >= 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const answered = (key, value) => `  ${key}:\n    value: ${value}\n    status: answered\n    status_reason:\n    last_updated: ${today}T09:00:00+00:00\n`;
  put(root, 'data/PROFILE.yaml', withCurrentHeader([
    'mandatory:',
    '',
    answered('name', 'Person-Q'),
    answered('pronouns', 'she'),
    answered('timezone', zone),
    'recommended:',
    '',
    answered('wants_from_this', 'a record'),
    answered('how_to_speak_to_me', 'plainly'),
    answered('professional_involved', 'no one'),
    answered('bad_night_person', 'a friend'),
    'optional:',
    '',
    '  work_or_study:\n    value:\n    status: not_asked\n    status_reason:\n    last_updated:\n',
    '  lives_with:\n    value:\n    status: not_asked\n    status_reason:\n    last_updated:\n',
  ].join('\n')));
  rmSync(join(root, 'data', 'core', 'state', 'gaps.json'), { force: true });
  put(join(root, 'data'), `core/journal/${addDays(today, -2)}.md`, '# An invented day\n\nCoffee, then the market.\n');
  put(join(root, 'data'), 'core/me/about_me.md', '# About me\n\nAn invented line, so this is no first contact.\n');
  record(join(root, 'data'), today);
  let out = brief();
  check('the brief prints no profile question, so the gate under test is the gap\'s own', !/PROFILE INCOMPLETE|PROFILE INVALID/.test(out));
  check('a new everyday session\'s brief carries one gap line', (out.match(/A GAP TO ASK ABOUT \(A-180\)/g) ?? []).length === 1 && /How did it go: Lantern festival/.test(out));
  record(join(root, 'data'), today, { log: `| ${today} · crisis · ongoing |` });
  out = brief();
  check('on a crisis day the brief carries none', !/A GAP TO ASK ABOUT/.test(out) && out.length > 0);
  record(join(root, 'data'), today);
  settle(join(root, 'data'), findGaps(join(root, 'data'), today)[0].id, 'asked', { today, session: 'other-chat' });
  check('once one was asked today, a second session\'s brief carries none', !/A GAP TO ASK ABOUT/.test(brief('third-chat')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
