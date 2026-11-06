// One way to reach Telegram from any machine here (T-742, T-748): through curl, never Node's
// fetch. A cloud machine reaches the web only through its proxy, which curl follows and Node
// 22's fetch ignores, so fetch failed on every chat's machine. The address, with its key, goes
// to curl on its standard input, never on its command line, so no other process can read it.
//
// Shaped like fetch for the callers that took fetch: post(url, { body }) resolves to
// { ok, status, description }, ok only when Telegram itself said ok. It never throws.

import { execFile } from 'node:child_process';

export function telegramPost(url, { body = '{}', timeoutSec = 6 } = {}) {
  return new Promise((resolve) => {
    const p = execFile('curl', ['-sS', '--max-time', String(timeoutSec), '-H', 'content-type: application/json', '--data-binary', String(body), '-K', '-'], { timeout: (timeoutSec + 2) * 1000 }, (err, out) => {
      let json = null;
      try { json = JSON.parse(out); } catch { /* no answer, or not Telegram's */ }
      if (json && typeof json.ok === 'boolean') resolve({ ok: json.ok, status: json.ok ? 200 : json.error_code ?? 0, description: json.description ?? '' });
      else resolve({ ok: false, status: 0, description: err ? `curl ${err.code ?? 'failed'}` : 'no answer' });
    });
    p.on('error', () => resolve({ ok: false, status: 0, description: 'curl missing' }));
    p.stdin.on('error', () => {});
    p.stdin.end(`url = "${String(url).replace(/["\\\n]/g, '')}"\n`);
  });
}
