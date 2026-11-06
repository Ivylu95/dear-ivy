#!/usr/bin/env node
// The remote check (DPV-009 design 3): a tunnel anywhere but remote.mjs is
// caught, by any tool and in the forms a script or skill would write it; a
// standing start is caught; the one script, and plain prose, pass.

import assert from 'node:assert/strict';
import { THE_WAY_IN, problemsIn } from './check-remote.mjs';
import { noCopyProblems } from './check-remote.mjs';

const elsewhere = 'ux/scripts/other.mjs';
const caught = [
  [elsewhere, '& "$env:USERPROFILE\\.cloudflared\\cloudflared.exe" tunnel --url http://localhost:3220'],
  ['ux/package.json', '"tunnel": "cloudflared tunnel --url http://127.0.0.1:3220"'],
  [elsewhere, "spawn(bin, ['tunnel', '--no-autoupdate', '--url', url])"],
  [elsewhere, 'ngrok http 3220'],
  [elsewhere, 'tailscale funnel --bg 3220'],
  ['.claude/jobs/remote.md', 'Each morning, run npm run remote -- start'],
  ['scripts/keepalive.ps1', 'Register-ScheduledTask -Action (node ux/scripts/remote.mjs start)'],
];
const passed = [
  [THE_WAY_IN, "spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`])"],
  ['dev/skills/remote-dev/SKILL.md', 'npm run remote -- start     open the tunnel, and print the address'],
  [elsewhere, 'never a Cloudflare or ngrok tunnel, never a public funnel'],
  [elsewhere, 'tailscale serve --bg --https=443 http://127.0.0.1:3220'],
];

for (const [rel, text] of caught) assert.equal(problemsIn(rel, text).length, 1, `should be caught in ${rel}: ${text}`);
for (const [rel, text] of passed) assert.deepEqual(problemsIn(rel, text), [], `should pass in ${rel}: ${text}`);
// The relay keeps no copy (DPV-009 design 2): the gate sets no-store on a
// tunnelled response, and the admin app's gate is that same function.
const gate = "if (tunnelled) headers.set('Cache-Control', 'private, no-store');\nexport async function proxy(request) {}";
assert.deepEqual(noCopyProblems('ux/proxy.js', gate), [], 'the real gate passes');
assert.equal(noCopyProblems('ux/proxy.js', "export async function proxy(request) {}").length, 1, 'no no-store at all');
assert.equal(noCopyProblems('ux/proxy.js', "if (tunnelled) headers.set('Cache-Control', 'public, max-age=60');").length, 1, 'a cache-friendly header');
assert.equal(noCopyProblems('ux/proxy.js', "headers.set('Cache-Control', 'no-store');").length, 1, 'not tied to the tunnel');
assert.deepEqual(noCopyProblems('dev/ui/proxy.js', "export { proxy } from '../../ux/proxy.js';"), [], 'the admin app borrows the gate');
assert.equal(noCopyProblems('dev/ui/proxy.js', "export async function proxy() {}").length, 1, 'an admin gate of its own');
console.log(`remote check test: ${caught.length} ways in caught, ${passed.length} allowed lines passed`);
