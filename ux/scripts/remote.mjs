#!/usr/bin/env node
// `node scripts/remote.mjs <start|stop|status>`: the way in to the dashboard
// (and the admin app under /admin) from the owner's other computer, through one
// Cloudflare quick tunnel (DPV-009, "When the interface is reached from another
// machine, the way in opens only on the owner's request, closes when they close
// it, and nothing between them keeps a copy of what crosses it.").
//
// The servers stay bound to 127.0.0.1 (DPV-008, design 1); cloudflared forwards
// a public https://<random>.trycloudflare.com address to the loopback port.
// While it is open the sign-in faces the internet, with DPV-007's growing delay
// as the lock, and Cloudflare reads each page in transit; proxy.js forbids it to
// store one (design 2). Started only by hand: check-remote.mjs fails the gate on
// any other place that opens a tunnel, scheduled or otherwise (design 3).
//
// One tunnel per session. Quick tunnels are rate-limited per address, and
// BAXTER found on 2026-07-05 that respinning them on a timer throttles the
// address until none will start. So `start` reuses a tunnel that is up.
//
//   start    open the tunnel to the running dashboard, and print its address
//   stop     close it: end the process, leave nothing listening
//   status   say whether it is open, and where
//
//   DEAR_PORT   the dashboard's port, as dev.mjs reads it, defaults to 3220

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.DEAR_PORT) || 3220;
const TEMP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'temp');
// Kept in .claude/hooks/state/, not temp/: a later stop or status relies on it,
// and a swept temp/ would leave a tunnel open with nothing to close it (ARC-014).
const STATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'state');
const STATE = join(STATE_DIR, 'remote.json');
const LOG = join(TEMP, 'remote.log');
const ADDRESS = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const action = process.argv[2] || 'status';

const say = (line) => console.log(line);
const fail = (line) => {
  console.error(line);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// On PATH, or where its installer and another project's setup put it on Windows.
function findCloudflared() {
  for (const bin of [
    'cloudflared',
    join(homedir(), '.cloudflared', 'cloudflared.exe'),
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ]) {
    if (bin.includes('\\') || bin.includes('/')) {
      if (existsSync(bin)) return bin;
      continue;
    }
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', windowsHide: true });
      return bin;
    } catch {
      // not on PATH
    }
  }
  return null;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readState = () => {
  try {
    const s = JSON.parse(readFileSync(STATE, 'utf8'));
    return s.pid && alive(s.pid) ? s : null;
  } catch {
    return null;
  }
};

const answers = () =>
  new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port: PORT });
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

function end(pid) {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch {
      // already gone
    }
  } else if (alive(pid)) process.kill(pid, 'SIGTERM');
}

if (action === 'start') {
  const open = readState();
  if (open) {
    say(`Already open, at ${open.url} (since ${open.startedAt}). Reused rather than respun: quick tunnels are rate-limited.`);
    process.exit(0);
  }
  const bin = findCloudflared();
  if (!bin) fail('cloudflared is not installed here. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ and run this again.');
  if (!(await answers())) fail(`Nothing is answering on 127.0.0.1:${PORT}. Start the dashboard first (npm run dev in ux/), then run this again.`);

  mkdirSync(TEMP, { recursive: true });
  writeFileSync(LOG, '');
  const out = openSync(LOG, 'a');
  const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { detached: true, stdio: ['ignore', out, out], windowsHide: true });
  child.unref();

  let url = null;
  for (let i = 0; i < 60 && !url; i++) {
    await sleep(500);
    url = readFileSync(LOG, 'utf8').match(ADDRESS)?.[0] ?? null;
    if (!alive(child.pid)) break;
  }
  if (!url) {
    end(child.pid);
    fail(`The tunnel did not come up (see ${LOG}). If it hangs at "Requesting new quick Tunnel", the address is rate-limited: wait an hour rather than retrying.`);
  }
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify({ pid: child.pid, url, port: PORT, startedAt: new Date().toISOString() }, null, 2));

  // The address resolves a few seconds after cloudflared prints it.
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) {
    try {
      reached = (await fetch(`${url}/login`, { redirect: 'manual' })).status < 500;
    } catch {
      // not resolving yet
    }
    if (!reached) await sleep(1000);
  }
  // DPV-005 checked where it matters, at the relay: a page must come back
  // uncached. Next's own Cache-Control wins over proxy.js on pages, so the
  // proof is Cloudflare's answer, not the header. A cached page closes it.
  if (reached) {
    const cached = (await fetch(`${url}/login`, { redirect: 'manual' })).headers.get('cf-cache-status');
    if (cached && !/^(DYNAMIC|BYPASS|MISS|EXPIRED)$/i.test(cached)) {
      end(child.pid);
      rmSync(STATE, { force: true });
      fail(`Closed: Cloudflare answered a page from its cache (${cached}), which DPV-005 forbids.`);
    }
  }
  say(`Open at ${url}`);
  say(`The admin app is at ${url}/admin. Sign in as you do here.`);
  say(reached ? 'Checked: it answers from outside.' : 'Not yet answering from outside; give it a minute before opening it.');
  say('It is public while open. Close it when you are done: npm run remote -- stop');
} else if (action === 'stop') {
  const open = readState();
  if (open) end(open.pid);
  rmSync(STATE, { force: true });
  say(open ? `Closed ${open.url}. It answers on this machine only again.` : 'Nothing was open. It answers on this machine only.');
} else if (action === 'status') {
  const open = readState();
  say(open ? `Open at ${open.url}, since ${open.startedAt}. Public while open; close it with: npm run remote -- stop` : 'Closed. It answers on this machine only.');
} else {
  fail('Usage: node scripts/remote.mjs <start|stop|status>');
}
