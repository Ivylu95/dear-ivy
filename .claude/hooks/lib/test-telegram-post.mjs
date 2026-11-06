// Rule test for telegram-post.mjs (T-748): sends through curl, ok only on Telegram's own ok,
// a refusal's code and reason passed back, nothing thrown when nothing answers.
//
// Run: node .claude/hooks/lib/test-telegram-post.mjs

import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegramPost } from './telegram-post.mjs';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++; };
const got = [];
let reply = '{"ok":true,"result":{}}';
const server = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { got.push({ url: req.url, body: b }); res.end(reply); }); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  let r = await telegramPost(`${base}/botKEY/sendMessage`, { body: JSON.stringify({ chat_id: 1, text: 'hi' }) });
  check('a send Telegram accepts is ok, the body and address arriving whole', r.ok && got[0]?.url === '/botKEY/sendMessage' && JSON.parse(got[0].body).text === 'hi');
  reply = '{"ok":false,"error_code":400,"description":"Bad Request: can\'t parse entities"}';
  r = await telegramPost(`${base}/botKEY/sendMessage`, { body: '{}' });
  check('a refusal passes back its code and reason', !r.ok && r.status === 400 && /parse/.test(r.description));
  reply = 'not json';
  r = await telegramPost(`${base}/botKEY/sendMessage`, { body: '{}' });
  check('an answer that is not Telegram\'s is not ok', !r.ok && r.status === 0);
} finally {
  server.close();
}
const none = await telegramPost('http://127.0.0.1:1/botKEY/sendMessage', { body: '{}', timeoutSec: 2 });
check('nothing listening: not ok, and nothing thrown', !none.ok && /^curl/.test(none.description));

// The lesson of 4 Nov 2026 (T-742): a sender written with Node's fetch passed every test against
// a stand-in on this machine and failed on every cloud machine, which reaches the web only through
// a proxy fetch ignores. So no file outside this one posts to Telegram with fetch.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const scan = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    // worktrees: helper agents' scratch checkouts (gitignored), old copies of the code, not the code
    if (['node_modules', '.git', 'data', 'data-sandbox', 'temp', 'state', 'worktrees'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) scan(p, out);
    else if (/\.m?js$/.test(name) && !/^test-/.test(name)) out.push(p);
  }
  return out;
};
const viaFetch = (text) => /\bfetch\(\s*`[^`]*(api\.telegram\.org|\$\{api\}\/bot)/.test(text) || (/api\.telegram\.org/.test(text) && /\bpost\s*=\s*fetch\b/.test(text));
check('the check sees a fetch to Telegram, and passes the shared sender', viaFetch('await fetch(`https://api.telegram.org/bot${t}/sendMessage`)') && viaFetch('const api = "https://api.telegram.org"; await fetch(`${api}/bot${t}/x`)') && !viaFetch('await telegramPost(`https://api.telegram.org/bot${t}/x`)'));
const offenders = ['.claude', 'ux', 'dev', 'modules'].flatMap((d) => { try { return scan(join(root, d)); } catch { return []; } })
  .filter((p) => !p.endsWith('telegram-post.mjs') && viaFetch(readFileSync(p, 'utf8'))).map((p) => relative(root, p));
check(`no sender posts to Telegram with Node's fetch${offenders.length ? `: ${offenders.join(', ')}` : ''}`, offenders.length === 0);
console.log(failed ? `telegram post: ${failed} failed` : 'telegram post: all cases hold');
process.exit(failed ? 1 : 0);
