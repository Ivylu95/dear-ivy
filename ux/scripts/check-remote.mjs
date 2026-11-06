#!/usr/bin/env node
// `node scripts/check-remote.mjs`: the way in from another machine opens only
// on the owner's request (DPV-009, "When the interface is reached from another
// machine, the way in opens only on the owner's request, closes when they close
// it, and nothing between them keeps a copy of what crosses it.", design 3).
//
// Two things fail it:
//   a tunnel opened anywhere but scripts/remote.mjs, the one script the owner
//     runs by hand, by any tool (Cloudflare, ngrok, Tailscale's public funnel);
//   a standing way in: remote.mjs started from anything that runs unattended,
//     a scheduled task, a heartbeat or job, a workflow, the dev launcher.
//   (A third: a gate that lets a relay keep a copy: ux/proxy.js must forbid caching on a
//     tunnelled response, and dev/ui/proxy.js must be that gate re-exported.)
//
// It reads the files that run or instruct: scripts, configs, skills, commands,
// hooks. The specs are left out, since they name these tools to govern them,
// and so is the record. It walks the tree rather than asking git, so it runs
// the same in the commit gate's snapshot, which has no .git. It matches
// commands by name, so a tool it does not know is not caught.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skipped } from '../lib/walk-skip.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The one script allowed to open a tunnel.
export const THE_WAY_IN = 'ux/scripts/remote.mjs';

const TUNNELS = [
  { re: /\bcloudflared(?:\.exe)?\b[^\n]{0,80}\btunnel\b/i, name: 'a Cloudflare tunnel' },
  { re: /['"]tunnel['"]\s*,[^\n]{0,40}['"]--url['"]/i, name: 'a Cloudflare tunnel' },
  { re: /\bngrok(?:\.exe)?["']?\s+(?:http|https|tcp|tls|start)\b/i, name: 'an ngrok tunnel' },
  { re: /\btailscale(?:\.exe)?["']?\s*,?\s*\[?\s*["']?funnel\b/i, name: "Tailscale's public funnel" },
];
const STARTS_IT = /\bremote(?:\.mjs)?["']?\s*(?:--\s*)?["']?start\b/i;
const UNATTENDED_FILE = /^(?:\.claude\/jobs\/|\.claude\/heartbeats\.json$|\.github\/workflows\/|ux\/scripts\/dev\.mjs$)/;
const SCHEDULES = /\b(?:schtasks|Register-ScheduledTask|New-ScheduledTask|crontab|launchctl)\b/i;

const READ = new Set(['.mjs', '.js', '.cjs', '.jsx', '.ts', '.json', '.md', '.ps1', '.sh', '.bat', '.cmd', '.yml', '.yaml', '.toml']);
const LEFT_OUT = ['data', 'data-sample', 'data-sandbox', 'dev/specs', 'ux/scripts/check-remote.mjs', 'ux/scripts/test-check-remote.mjs'];

/** What a file at `rel` does that DPV-009 forbids, worded for a person. */
export function problemsIn(rel, text) {
  const found = [];
  if (rel !== THE_WAY_IN) for (const { re, name } of TUNNELS) if (re.test(text)) found.push(`opens ${name}`);
  if (STARTS_IT.test(text) && (UNATTENDED_FILE.test(rel) || SCHEDULES.test(text))) found.push('starts the remote tunnel unattended');
  return [...new Set(found)];
}

// Design 2: nothing in the path keeps a copy. The gate every request passes
// (ux/proxy.js) forbids storing a tunnelled response, and the admin app's gate
// is that same function, re-exported, so it has no header of its own to forget.
const GATE = 'ux/proxy.js';
const ADMIN_GATE = 'dev/ui/proxy.js';
const FORBIDS_COPY = /if\s*\(\s*tunnelled\s*\)\s*headers\.set\(\s*['"]Cache-Control['"]\s*,\s*['"][^'"]*\bno-store\b[^'"]*['"]\s*\)/;
const BORROWS_GATE = /export\s*\{\s*proxy\s*\}\s*from\s*['"]\.\.\/\.\.\/ux\/proxy\.js['"]/;

/** Where the gate at `rel` would let a relay keep a copy, worded for a person. */
export function noCopyProblems(rel, text) {
  if (rel === GATE && !FORBIDS_COPY.test(text)) return [`does not forbid caching (no-store) on a tunnelled response`];
  if (rel === ADMIN_GATE && !BORROWS_GATE.test(text)) return [`is not the dashboard's gate re-exported, so it may not forbid caching`];
  return [];
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(root, abs).split(sep).join('/');
    if (skipped(rel) || LEFT_OUT.includes(rel)) continue;
    if (entry.isDirectory()) yield* walk(abs);
    else if (READ.has(extname(entry.name).toLowerCase())) yield [rel, abs];
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const found = [];
  for (const [rel, abs] of walk(root)) {
    if (statSync(abs).size > 2 * 1024 * 1024) continue;
    for (const p of problemsIn(rel, readFileSync(abs, 'utf8'))) found.push(`${rel} ${p}`);
  }
  for (const rel of [GATE, ADMIN_GATE]) {
    if (existsSync(join(root, rel))) for (const p of noCopyProblems(rel, readFileSync(join(root, rel), 'utf8'))) found.push(`${rel} ${p}`);
  }
  if (found.length) {
    console.error('\n  REMOTE CHECK FAILED\n');
    for (const f of found) console.error(`  - ${f}`);
    console.error(`\n  The way in from another machine is ${THE_WAY_IN}, started by hand. Anything else`);
    console.error('  needs DPV-009 changed first (dev/specs/ux/perimeter.md).\n');
    process.exit(1);
  }
  console.log('remote check: the tunnel opens only from remote.mjs, by hand');
}
