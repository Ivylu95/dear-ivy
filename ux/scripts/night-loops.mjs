#!/usr/bin/env node
// The night's loop suggestions for the developer (A-173): what the harness has
// open tonight, gathered for the night-loops job to choose from, and the one
// message it sends to the development bot.
//
//   node ux/scripts/night-loops.mjs facts           what is open tonight, as plain lines
//   node ux/scripts/night-loops.mjs check <plan>    tonight's plan (JSON) in form, and the message it makes
//   node ux/scripts/night-loops.mjs send <plan>     checks it, then sends the short message to the dev bot
//   node ux/scripts/night-loops.mjs show [n]        the newest plan in dev/night-shift/, or its loop n,
//                                                   for the /night-shift command (A-174)
//   node ux/scripts/night-loops.mjs until           the shift's clock-out, the next 07:00 Singapore time, as ISO
//   node ux/scripts/night-loops.mjs handover <file> the morning handover, checked, to the dev bot (A-179)
//
// Harness only: it reads nothing under data/ and its message names no person.
// The message is the developer's choice to act on; nothing here starts a loop.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegramPost } from '../../.claude/hooks/lib/telegram-post.mjs';
import { chatLine } from '../../.claude/hooks/lib/chat-link.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
  } catch (e) {
    return String(e.stdout ?? '');
  }
};
const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), 'utf8');
  } catch {
    return '';
  }
};

/** What is open tonight, one fact a line, each with where it came from. */
export function facts() {
  const lines = [];
  const failing = run('node', ['ux/scripts/evals.mjs', 'list']).split('\n').filter((l) => /✗/.test(l));
  lines.push(`failing evals (${failing.length}): ${failing.map((l) => l.trim().split(/\s+/)[0]).join(', ') || 'none'}`);
  const unproven = run('node', ['ux/scripts/dialogue.mjs', 'unproven']).match(/A-\d+/g) ?? [];
  lines.push(`agreed cards not every eval naming them passes (${new Set(unproven).size}): ${[...new Set(unproven)].join(', ') || 'none'}`);
  const forYou = read('dev/for-you.md').split('\n').filter((l) => l.startsWith('- for-you · '));
  lines.push(`waiting on the developer: ${forYou.length}`);
  const ideas = read('dev/ideas.md').split('\n').filter((l) => l.startsWith('- idea · ') && / · open · /.test(l));
  lines.push(`open ideas (${ideas.length}): ${ideas.slice(0, 5).map((l) => l.split(' · ')[1]).join(' | ') || 'none'}`);
  try {
    const state = JSON.parse(read('.claude/jobs/state.json') || '{}');
    const bad = Object.entries(state).filter(([k, v]) => k !== 'run' && v && v.status === 'failed').map(([k, v]) => `${k} (${v.failures} in a row)`);
    lines.push(`heartbeat jobs failing: ${bad.join(', ') || 'none'}`);
  } catch {
    lines.push('heartbeat jobs failing: unreadable');
  }
  const commits = run('git', ['log', '--since=24 hours ago', '--no-merges', '--format=%s']).split('\n').filter(Boolean);
  lines.push(`commits in the last day (${commits.length}): ${commits.slice(0, 8).join(' | ') || 'none'}`);
  lines.push(`suggested last night: ${lastNight(run('git', ['log', '--since=36 hours ago', '--format=%B']))}`);
  return lines;
}

/** What the last night's run said it suggested, from the run summaries in the commit bodies, so
 *  the same loops are not sent again night after night (T-811). 'nothing found' when none ran. */
export function lastNight(log) {
  const line = String(log ?? '').split('\n').find((l) => /night-loops\b.*\bsuggest/i.test(l));
  return line ? line.replace(/^[-*\s]+/, '').trim().slice(0, 300) : 'nothing found';
}

// Tonight's plan: dev/night-shift/<YYYY-MM-DD>.json, written by the night-loops job and read
// by /night-shift (A-174). The message carries only a line and a `/night-shift <n>` per loop, set
// as code so one tap copies it; the prompts stay in the plan, so nothing is edited on a phone.
export const PLANS = 'dev/night-shift';
const FIELDS = ['what', 'prompt', 'finish', 'start_by', 'round', 'rounds', 'weight'];
const MAX = 3500;

/** What is wrong with a plan, or [] when it is in form. */
export function faults(plan) {
  const out = [];
  if (!plan || typeof plan !== 'object') return ['the plan is not JSON'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(plan.date ?? ''))) out.push('no date');
  const loops = Array.isArray(plan.loops) ? plan.loops : [];
  if (loops.length > 3) out.push(`${loops.length} loops; one to three`);
  if (!loops.length && !String(plan.none ?? '').trim()) out.push('no loops, and no line saying why');
  loops.forEach((l, i) => {
    const missing = FIELDS.filter((f) => !String(l?.[f] ?? '').trim());
    if (missing.length) out.push(`loop ${i + 1} has no ${missing.join(', ')}`);
    if (!/stop the loop when/i.test(l?.prompt ?? '') || !/07:00/.test(l?.prompt ?? '')) out.push(`loop ${i + 1}'s prompt does not end on its stop, or 07:00`);
    if (!/^(light|medium|heavy)$/.test(String(l?.weight ?? ''))) out.push(`loop ${i + 1}'s weight is not light, medium or heavy`);
  });
  const text = JSON.stringify(plan);
  if (/\bdata\//.test(text)) out.push('names a path in her record');
  if (/--dangerously-skip-permissions|bypassPermissions/.test(text)) out.push('switches permissions off');
  if (message(plan).length > MAX) out.push(`the message runs over ${MAX} characters`);
  return out;
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The chat every night-shift message links to (A-128): dev/night-shift/chat.json, or none. */
export function nightChat() {
  try {
    const c = JSON.parse(read(`${PLANS}/chat.json`) || 'null');
    return c ? { url: c.url, title: c.title } : null;
  } catch {
    return null;
  }
}

const withChat = (text, chat) => {
  const line = chat ? chatLine({ id: 'night-shift', chat }) : '';
  return line ? `${text}\n\n${line}` : text;
};

/** The phone message, in Telegram's HTML: tonight's roster, and the one line that clocks the shift
 *  in, set as code so one tap copies it (A-179); a single job still starts by its number; it ends
 *  with a link to the night-shift chat, where the line is pasted (A-128). */
export function message(plan, chat = nightChat()) {
  return withChat(roster(plan), chat);
}

function roster(plan) {
  const loops = Array.isArray(plan?.loops) ? plan.loops : [];
  if (!loops.length) return `🌙 <b>Night shift</b>\n\n${esc(plan?.none ?? 'Nothing worth a night tonight.')}`;
  const order = ['light', 'medium', 'heavy'];
  const heaviest = loops.map((l) => l.weight).sort((x, y) => order.indexOf(y) - order.indexOf(x))[0];
  const roster = loops.map((l, i) => `${i + 1} · ${esc(l.what)} · ${esc(l.rounds)}`);
  return `🌙 <b>Night shift ready</b> · ${loops.length} job${loops.length > 1 ? 's' : ''} · ${esc(heaviest)}\n\n${roster.join('\n')}\n\nTap to clock in, then paste it in the night-shift chat:\n<code>/night-shift</code>\n\nJust one: <code>/night-shift 2</code>`;
}

/** The shift's clock-out: the next 07:00 Singapore time after now, as ISO. */
export function until(now = new Date()) {
  const sg = new Date(now.getTime() + 8 * 3600e3);
  const out = new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate(), 7 - 8, 0, 0));
  if (out.getTime() <= now.getTime()) out.setUTCDate(out.getUTCDate() + 1);
  return out.toISOString();
}

/** What is wrong with a morning handover, or [] when it is fit to send. */
export function handoverFaults(text) {
  const t = String(text ?? '').trim();
  const out = [];
  if (!t) return ['the handover is empty'];
  if (t.length > MAX) out.push(`over ${MAX} characters`);
  if (/\bdata\//.test(t)) out.push('names a path in her record');
  return out;
}

const readPlan = (file) => {
  try {
    return JSON.parse(read(file) || readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** The newest plan in dev/night-shift/, with its file name, or null. */
export function newest(dir = join(ROOT, PLANS)) {
  let names = [];
  try {
    names = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {
    return null;
  }
  const name = names.at(-1);
  return name ? { name, plan: readPlan(join(dir, name)) } : null;
}

/** What /night-shift shows: the list, or loop n with how old the plan is. */
export function show(found, n, now = new Date()) {
  if (!found?.plan) return 'night-shift: no plan yet. The first is sent at about 23:05.';
  const { plan } = found;
  const loops = plan.loops ?? [];
  const today = new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() + 8 * 3600e3 - 86400e3).toISOString().slice(0, 10);
  const age = plan.date === today || plan.date === yesterday ? 'current' : `old: from ${plan.date}`;
  if (!n || n === 'plan') return [`plan ${plan.date} (${age}) · ${PLANS}/${found.name}`, ...loops.map((l, i) => `${i + 1} · ${l.what} · ${l.rounds} · ${l.weight}`), loops.length ? '' : plan.none ?? ''].filter(Boolean).join('\n');
  const l = loops[Number(n) - 1];
  if (!l) return `night-shift: plan ${plan.date} has no loop ${n}; it has ${loops.length}.`;
  return [`plan ${plan.date} (${age}) · loop ${n}`, `what: ${l.what}`, `timing: start by ${l.start_by} · ${l.round} a round · ${l.rounds} · ${l.weight}`, `prompt: ${l.prompt}`, `finish: ${l.finish}`].join('\n');
}

async function post(text, html) {
  const token = process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token || !process.env.TELEGRAM_CHAT_ID) return 'NOT SENT, no bot key in this environment';
  const res = await telegramPost(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, ...(html ? { parse_mode: 'HTML' } : {}), link_preview_options: { is_disabled: true } }),
  });
  return res?.ok ? 'sent' : `NOT SENT, Telegram refused it (${res?.description ?? 'no answer'})`;
}

async function send(file) {
  const plan = readPlan(file);
  const bad = faults(plan);
  if (bad.length) {
    console.error(`night-loops: NOT SENT, ${bad.join('; ')}`);
    process.exit(1);
  }
  console.log(`night-loops: ${await post(message(plan), true)}`);
}

async function handover(file) {
  const text = read(file) || (() => { try { return readFileSync(file, 'utf8'); } catch { return ''; } })();
  const bad = handoverFaults(text);
  if (bad.length) {
    console.error(`night-shift: handover NOT SENT, ${bad.join('; ')}`);
    process.exit(1);
  }
  const body = withChat(`🌅 <b>Night shift handover</b>\n\n${text.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`, nightChat());
  console.log(`night-shift: handover ${await post(body, true)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'facts') console.log(facts().join('\n'));
  else if (cmd === 'check') {
    const plan = readPlan(arg);
    const bad = faults(plan);
    console.log(bad.length ? `night-loops: ${bad.join('; ')}` : `night-loops: the plan is in form; its message:\n\n${message(plan)}`);
    process.exit(bad.length ? 1 : 0);
  } else if (cmd === 'send') await send(arg);
  else if (cmd === 'show') console.log(show(newest(), arg));
  else if (cmd === 'until') console.log(until());
  else if (cmd === 'handover') await handover(arg);
  else {
    console.error('usage: night-loops.mjs facts | check <plan> | send <plan> | show [n|plan] | until | handover <file>');
    process.exit(2);
  }
}
