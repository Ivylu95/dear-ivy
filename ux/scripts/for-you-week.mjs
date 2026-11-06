#!/usr/bin/env node
// The weekly short list for the developer's for-you list (A-178): the oldest few questions are put
// to him once, each with the agent's pick and what happens if he says nothing; one still unanswered
// a week after it was put is settled on its pick and named in his report. A question at a gate
// (safety, privacy, money, what cannot be undone) is never settled this way: it waits for him.
//
//   node ux/scripts/for-you-week.mjs plan [--today YYYY-MM-DD]   JSON: what to settle, what to ask
//   node ux/scripts/for-you-week.mjs pick <n> --text "<pick>" [--gate]   writes the agent's pick on item n
//   node ux/scripts/for-you-week.mjs settle [--today …]          removes the ones due, into the closed ledger
//   node ux/scripts/for-you-week.mjs ask <n> <n> … [--today …]   marks them asked and sends the short list
//                                                                to the development bot
// Items are numbered as `plan` prints them: their order in dev/for-you.md, from 1.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseForYou } from '../../.claude/hooks/lib/for-you.mjs';
import { telegramPost } from '../../.claude/hooks/lib/telegram-post.mjs';

export const ASK_EACH_WEEK = 3;
const WAIT_DAYS = 7;
// Belt and braces beside the agent's own `gate` mark: words that put a question at a gate.
const GATE_WORDS = /\b(safety|crisis|privacy|private|personal|dollars?|spend|paid|billing|subscription|delete|deleted|irreversib|cannot be undone|can.t be undone|secret|token|password|unlock)/i;
export const atGate = (item) => item.gate || GATE_WORDS.test(item.what);

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const root = flag('--root') ?? join(import.meta.dirname, '..', '..');
const LIST = join(root, 'dev', 'for-you.md');
const CLOSED = join(root, 'dev', 'for-you-closed.md');
const today = flag('--today') ?? new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);

/** What to settle and what to ask this week, from the list's items. Pure, for the tests. */
export function planWeek(items, day, n = ASK_EACH_WEEK) {
  const numbered = items.map((it, i) => ({ n: i + 1, ...it }));
  const settle = numbered.filter((it) => it.asked && days(it.asked, day) >= WAIT_DAYS && it.pick && !atGate(it));
  const ask = numbered.filter((it) => !it.asked && !settle.includes(it)).sort((a, b) => a.opened.localeCompare(b.opened) || a.n - b.n).slice(0, n);
  return { settle, ask };
}

/** The short list as it arrives on his phone, in Telegram's HTML. */
export function shortList(asked, day) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const by = new Date(Date.parse(day) + WAIT_DAYS * 86400e3).toISOString().slice(0, 10);
  const lines = [`<b>📋 For you this week</b> – ${asked.length} of your oldest. Answer in any development chat.`, ''];
  asked.forEach((it, i) => {
    lines.push(`${i + 1}. ${esc(it.what)}`);
    lines.push(atGate(it) ? `   My pick: ${esc(it.pick)}. This one waits for you, however long.` : `   My pick: ${esc(it.pick)}. Say nothing by ${by} and I go with it.`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

const text = () => readFileSync(LIST, 'utf8');
const items = () => parseForYou(text()).items;
const cmd = args[0];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === 'plan') {
    const { settle, ask } = planWeek(items(), today);
    console.log(JSON.stringify({ today, settle: settle.map(({ n, what, pick }) => ({ n, what, pick })), ask: ask.map(({ n, what, opened, pick, gate }) => ({ n, what, opened, pick, gate: gate || atGate({ what, gate }) })) }, null, 2));
  } else if (cmd === 'pick') {
    const n = Number(args[1]);
    const pick = String(flag('--text') ?? '').replace(/\s+/g, ' ').replace(/·/g, '-').trim();
    const it = items()[n - 1];
    if (!it || !pick) { console.log('pick: give an item number from plan and --text "<your pick>"'); process.exit(1); }
    const base = it.line.replace(/ · pick [^·]+?(?= · |$)/, '').replace(/ · gate(?= · |$)/, '');
    const m = base.match(/^(- for-you · .+? · opened \d{4}-\d{2}-\d{2} · chat \S+?)((?: · asked \d{4}-\d{2}-\d{2})?)$/);
    writeFileSync(LIST, text().replace(it.line, `${m[1]} · pick ${pick}${m[2]}${args.includes('--gate') ? ' · gate' : ''}`));
    console.log(`pick: item ${n} has a pick${args.includes('--gate') ? ', at a gate' : ''}`);
  } else if (cmd === 'settle') {
    const { settle } = planWeek(items(), today);
    let t = text();
    if (!existsSync(CLOSED)) writeFileSync(CLOSED, '# For you, settled\n\nQuestions put to the developer on the weekly short list and left unanswered a week after, settled on the agent\'s pick (A-178). Git keeps the rest.\n\n');
    for (const it of settle) {
      t = t.replace(`${it.line}\n`, '');
      appendFileSync(CLOSED, `- settled ${today} · on the pick: ${it.pick} · ${it.what} · opened ${it.opened} · asked ${it.asked}\n`);
      console.log(`for-you: settled on the pick: ${it.what.slice(0, 80)}`);
    }
    writeFileSync(LIST, t);
    if (!settle.length) console.log('for-you: nothing to settle');
  } else if (cmd === 'ask') {
    const all = items();
    const chosen = args.slice(1).filter((a) => /^\d+$/.test(a)).map(Number).map((n) => all[n - 1]).filter(Boolean);
    if (!chosen.length || chosen.some((it) => !it.pick)) { console.log('ask: give item numbers from plan, each with a pick'); process.exit(1); }
    const token = process.env.TELEGRAM_DEV_BOT_TOKEN;
    const chat = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) { console.log('for-you: short list not sent: this environment holds no development bot key; nothing marked asked'); process.exit(0); }
    const api = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TELEGRAM_API_TEST ?? '') ? process.env.TELEGRAM_API_TEST : 'https://api.telegram.org';
    const res = await telegramPost(`${api}/bot${token}/sendMessage`, { body: JSON.stringify({ chat_id: chat, text: shortList(chosen, today), parse_mode: 'HTML' }) });
    if (!res.ok) { console.log(`for-you: short list refused (${res.status}); nothing marked asked`); process.exit(0); }
    let t = text();
    for (const it of chosen) t = t.replace(it.line, `${it.line.replace(/ · asked \d{4}-\d{2}-\d{2}/, '').replace(/( · gate)?$/, ` · asked ${today}$1`)}`);
    writeFileSync(LIST, t);
    console.log(`for-you: short list sent, ${chosen.length} asked`);
  } else {
    console.log('usage: for-you-week.mjs plan | pick <n> --text "<pick>" [--gate] | settle | ask <n…>');
    process.exit(2);
  }
}
