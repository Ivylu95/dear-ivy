// Rule test for the weekly for-you short list (A-178): only questions, never twice; the oldest
// few put to the developer with a pick; one left a week after settled on its pick, never one at
// a gate. A made-up list in a throwaway folder, and a stand-in Telegram on this machine.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { parseForYou, sameQuestion } from '../../.claude/hooks/lib/for-you.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { atGate, planWeek, shortList } from './for-you-week.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const line = (q, opened, extra = '') => `- for-you · ${q} · opened ${opened} · chat none${extra}`;

// The list's own rules.
check('a task is refused: it is done or dropped', parseForYou(line('Pick up: tidy the walkers', '2026-10-01')).problems.some((p) => /a task, not a question/.test(p)));
check('a question asked twice in nearly the same words is refused', parseForYou([line('Shall the nightly job rebuild the dialogue index pages after every merge of the transcript?', '2026-10-01'), line('Shall the nightly job rebuild the dialogue index pages after each merge of the transcript?', '2026-10-02')].join('\n')).problems.some((p) => /asked twice/.test(p)));
check('two questions about different rows are not the same question', !sameQuestion('Spec fix: SAF-004 needs the safety-core unlock (spec-fix.md bars all safety rows)', 'Spec fix: SAF-014 needs the safety-core unlock (spec-fix.md bars all safety rows)'));
const read = parseForYou(line('Shall the menu show ideas?', '2026-10-01', ' · pick yes, monthly · asked 2026-11-01 · gate')).items[0];
check('a line keeps its pick, the day it was asked and its gate', read?.pick === 'yes, monthly' && read?.asked === '2026-11-01' && read?.gate === true);

// The plan.
const items = parseForYou([
  line('Shall the menu show ideas monthly?', '2026-10-05', ' · pick yes · asked 2026-10-26'),
  line('Shall the privacy read run twice a day?', '2026-10-04', ' · pick yes · asked 2026-10-26'),
  line('Shall the night loops stop at seven?', '2026-10-06', ' · pick yes · asked 2026-11-03'),
  line('Shall the old drafts be archived?', '2026-10-01'),
  line('Shall the doctor run every six hours?', '2026-10-02'),
  line('Shall the review run weekly?', '2026-10-03'),
  line('Shall the hygiene job run monthly?', '2026-10-09'),
].join('\n')).items;
const plan = planWeek(items, '2026-11-02');
check('one asked a week ago, with a pick, is settled', plan.settle.map((i) => i.what).join() === 'Shall the menu show ideas monthly?');
check('one at a gate is never settled, however long it waits', atGate(items[1]) && !plan.settle.includes(items[1]));
check('one asked under a week ago waits', !plan.settle.includes(items[2]));
check('the three oldest never asked are chosen, oldest first', plan.ask.map((i) => i.opened).join() === '2026-10-01,2026-10-02,2026-10-03');
const msg = shortList([{ ...items[3], pick: 'yes' }, { ...items[1], pick: 'yes' }], '2026-11-02');
check('the short list gives the pick and the day to answer by', /My pick: yes\. Say nothing by 2026-11-09 and I go with it\./.test(msg));
check('a gated one says it waits for him', /waits for you, however long/.test(msg));

// End to end, in a throwaway copy.
const root = makeTemp('dear-for-you-week-');
mkdirSync(join(root, 'dev'), { recursive: true });
const list = join(root, 'dev', 'for-you.md');
writeFileSync(list, `# For you\n\n${items.map((i) => i.line).join('\n')}\n`);
const got = [];
const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { got.push(JSON.parse(b)); res.end('{"ok":true}'); }); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const script = new URL('./for-you-week.mjs', import.meta.url).pathname;
const run = (args, env = {}) => new Promise((r) => { const p = spawn(process.execPath, [script, ...args, '--root', root, '--today', '2026-11-02'], { env: { ...process.env, ...env } }); let o = ''; p.stdout.on('data', (c) => { o += c; }); p.on('close', (code) => r({ code, o })); });
const settled = await run(['settle']);
check('settle names what it settled, for his report', /for-you: settled on the pick: Shall the menu show ideas monthly\?/.test(settled.o));
check('it leaves the list, into the settled ledger, with its pick', !readFileSync(list, 'utf8').includes('show ideas monthly') && /settled 2026-11-02 · on the pick: yes · Shall the menu show ideas monthly\?/.test(readFileSync(join(root, 'dev', 'for-you-closed.md'), 'utf8')));
const nums = () => { const it = parseForYou(readFileSync(list, 'utf8')).items; return planWeek(it, '2026-11-02').ask.map((a) => a.n); };
const [a, b] = nums();
check('asking without a pick is refused', (await run(['ask', String(a)])).code === 1);
await run(['pick', String(a), '--text', 'yes, archive them']);
await run(['pick', String(b), '--text', 'yes', '--gate']);
const noKey = await run(['ask', String(a), String(b)], { TELEGRAM_DEV_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' });
check('with no development bot key, nothing is sent or marked asked', /not sent/.test(noKey.o) && !readFileSync(list, 'utf8').includes('asked 2026-11-02'));
const sent = await run(['ask', String(a), String(b)], { TELEGRAM_DEV_BOT_TOKEN: 'DEV', TELEGRAM_CHAT_ID: '1', TELEGRAM_API_TEST: `http://127.0.0.1:${server.address().port}` });
const after = parseForYou(readFileSync(list, 'utf8')).items;
check('the short list goes to the development bot, and each is marked asked', /short list sent, 2 asked/.test(sent.o) && got.length === 1 && after.filter((i) => i.asked === '2026-11-02').length === 2);
check('a pick marked at a gate keeps its gate', after.some((i) => i.gate && i.asked === '2026-11-02'));
check('the list still passes its own check', parseForYou(readFileSync(list, 'utf8')).problems.length === 0);
server.close();

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
