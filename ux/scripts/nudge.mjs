#!/usr/bin/env node
// The check-in's one channel to her: a nudge, sent only on her request.
//
// HBT-005, "A heartbeat never speaks to her, except the nudge she asked for: by default it
// says only that something waits, and if she chose, it carries the check-in's question
// itself." Design 4: by default it is one line the check-in writes fresh each run, saying
// only that something waits, never the same words twice and never a fixed line (HBT-010:
// no Telegram message is fixed); while her switch also reads `detail: question`, it is the
// check-in's one question and nothing else. Either goes only while her record reads `nudge: on`, never after a session
// that ended in crisis or panic (design 2), and only to the bot named by the
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets.
//
//   node ux/scripts/nudge.mjs                    send it, if every condition holds
//   node ux/scripts/nudge.mjs --dry              say whether it would, send nothing
//   (no queue)                                   nothing else sends from her reminders file,
//                                                so it goes straight to her bot with this
//                                                environment's key, or not at all; the old
//                                                --queue flag is ignored (2026-10-26)
//   … --line "<fresh words>"                    the line the check-in wrote this run: says
//                                                only that something waits. Without it, or
//                                                repeating a recent one, nothing is sent.
//   … --question "<the check-in's question>"     the question, sent in place of the line
//                                                only while she chose `detail: question`
//
// Always exits 0: a nudge not sent is never a failed check-in. Prints why it did or didn't.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionLines } from '../../.claude/hooks/lib/opening.mjs';
import { readProfile, zonedDateTime } from '../../.claude/hooks/lib/profile-schema.mjs';
import { telegramPost } from '../../.claude/hooks/lib/telegram-post.mjs';

/** The line once sent every time. Kept only so it is never sent again: no message is fixed. */
export const RETIRED = "Something's waiting for you in Dear.";
export const SENT = 'data/core/calendar/reminders-sent.json';
const SENT_KEEP = 5;
export const SWITCH = 'data/core/me/nudge.md';
const LOG = 'data/core/state/log.md';

const read = (root, path) => {
  const file = join(root, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const front = (root) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(root, SWITCH))?.[1] ?? '';

/** Her switch: the frontmatter of her nudge file says `nudge: on`. Anything else is off. */
export const switchedOn = (root) => /^nudge:\s*on\s*$/m.test(front(root));

/** She chose to hear the check-in's question itself (HBT-005 design 4): `detail: question`. */
export const wantsQuestion = (root) => /^detail:\s*question\s*$/m.test(front(root));

const flat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => flat(a).toLowerCase() === flat(b).toLowerCase();

/** The last check-in lines sent, newest last, so the next differs. */
export function recentLines(root) {
  try { return (JSON.parse(read(root, SENT) || '{}').sent ?? []).filter((m) => m.id === 'check-in').map((m) => m.text); } catch { return []; }
}

/**
 * The text that goes: her question when she chose it and one was given, else the fresh line.
 * Null when there is nothing fresh to send: no line, the retired fixed line, or a repeat.
 */
export function textFor(root, question, line) {
  const q = flat(question);
  if (wantsQuestion(root) && q) return q.slice(0, 300);
  const l = flat(line).slice(0, 300);
  if (!l || same(l, RETIRED) || recentLines(root).some((t) => same(t, l))) return null;
  return l;
}

function logSent(root, text, at) {
  let data = { sent: [] };
  try { data = JSON.parse(read(root, SENT) || '{"sent":[]}'); } catch { /* start afresh */ }
  const mine = (data.sent ?? []).filter((m) => m.id === 'check-in');
  const rest = (data.sent ?? []).filter((m) => m.id !== 'check-in');
  data.sent = [...rest, ...[...mine, { id: 'check-in', at: at.toISOString(), text }].slice(-SENT_KEEP)];
  mkdirSync(join(root, 'data', 'core', 'calendar'), { recursive: true });
  writeFileSync(join(root, SENT), `${JSON.stringify(data, null, 2)}\n`);
}

/** She switched the hard-session hold off herself (HBT-005 design 2): `hold: off`. */
export const holdOff = (root) => /^hold:\s*off\s*$/m.test(front(root));

/**
 * The last session's line carries the crisis marker (SAF-005), or panic, and it was
 * today or yesterday in her timezone: nothing goes out. HBT-005 design 2 holds through
 * the day after, then lifts by itself: the marker over-triggers by design, and a hold
 * that waited for her next chat silenced her for days on markers dev talk had written.
 */
export function lastSessionHard(root, at = new Date()) {
  const last = sessionLines(read(root, LOG)).at(-1);
  if (!last || !/^(crisis|panic)\b/i.test(last.kind)) return false;
  const timeZone = readProfile(read(root, 'data/PROFILE.yaml')).value.timezone ?? 'UTC';
  const today = zonedDateTime(at, timeZone).slice(0, 10);
  const yesterday = zonedDateTime(new Date(at.getTime() - 86400e3), timeZone).slice(0, 10);
  return last.date >= yesterday && last.date <= today;
}

/** Every reason not to send, in order; an empty list means send. */
export function reasons(root, env, at = new Date()) {
  const out = [];
  if (!switchedOn(root)) out.push('she has not asked for the nudge');
  if (!holdOff(root) && lastSessionHard(root, at)) out.push('her last session ended hard');
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) out.push('no bot is set up for this copy');
  return out;
}

export const REMINDERS = 'data/core/calendar/reminders.json';

/** Sends the fresh line, or her question when she chose it. `post` is curl shaped like fetch
 *  (Node's fetch ignores a cloud machine's proxy, T-748), or a stand-in under test. */
export async function nudge(root, env, { dry = false, post = telegramPost, at = new Date(), question, line } = {}) {
  // HBT-005 design 4: nothing is queued for another sender. It goes from here, with this
  // environment's key, or not at all, and the reason is said (2026-10-26).
  const why = reasons(root, env, at);
  if (why.length) return { sent: false, why };
  const text = textFor(root, question, line);
  if (!text) return { sent: false, why: ['no fresh line was given (a fixed or repeated one is never sent)'] };
  if (dry) return { sent: false, why: ['dry run: it would send'] };
  const res = await post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
  if (!res.ok) return { sent: false, why: [`Telegram refused it (${res.status})`] };
  logSent(root, text, at);
  return { sent: true, why: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const qi = process.argv.indexOf('--question');
  const question = qi >= 0 ? process.argv[qi + 1] : undefined;
  const li = process.argv.indexOf('--line');
  const line = li >= 0 ? process.argv[li + 1] : undefined;
  const { sent, why } = await nudge(root, process.env, { dry: process.argv.includes('--dry'), question, line }).catch((e) => ({ sent: false, why: [`could not reach Telegram (${e.message})`] }));
  console.log(sent ? 'nudge: sent' : `nudge: not sent: ${why.join('; ')}`);
}
