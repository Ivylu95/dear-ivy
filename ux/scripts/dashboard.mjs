// First-run setup for the gate.
//
//   node scripts/dashboard.mjs ensure-accounts
//
// Runs before `npm run dev` and before a local build. If the .env at the
// repository root already has credentials it does nothing; otherwise it
// generates a password and a signing secret, writes them, and prints the
// password ONCE.
//
// The point is that there is no setup step. A fresh clone runs `npm run dev` and
// gets a working, closed gate with its own credentials — rather than an app that
// either refuses every sign-in with no explanation, or ships with a default
// password, which is the same as no gate at all.
//
// The file sits at the repository root, beside data/, rather than inside ux/:
// who may open this record is a property of the record, not of the app that
// displays it. Next only auto-loads .env files from ux/, so ux/config/env.mjs is
// what reads this one.
//
// It is gitignored (.env* matches at any depth). Nothing written here ever
// reaches the repository.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/ -> ux/ -> the repository. The same path config/env.mjs resolves, by
// the same route, so the writer and the reader cannot drift.
const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const envPath = join(repoRoot, '.env');

// Generic on purpose. A username is a credential, not a greeting: the record
// holds who this is for, and the harness has no business knowing her name.
// An account generated before this change keeps whatever username it was
// given — this only affects credentials issued from here on.
const DEFAULT_USER = 'me';

// Base64url, so the value can never contain a quote, a backslash or a character
// that would need escaping inside the JSON it is embedded in.
const secret = (bytes) => randomBytes(bytes).toString('base64url');

function ensureAccounts() {
  // An environment that already carries them wins — exported in the shell,
  // deliberately — and there is nothing to write.
  if (process.env.DEAR_ACCOUNTS && process.env.DEAR_SESSION_SECRET) {
    console.log('Credentials already in the environment. Nothing to do.');
    return;
  }

  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  if (existing.includes('DEAR_ACCOUNTS=') && existing.includes('DEAR_SESSION_SECRET=')) {
    console.log('.env already has credentials. Nothing to do.');
    return;
  }

  const password = secret(12);
  const lines = [
    '# Who may open this record. Written by ux/scripts/dashboard.mjs on first run.',
    '# Gitignored: this file never reaches the repository. Delete it and re-run',
    '# `npm run dev` in ux/ to issue new credentials.',
    // Single-quoted, and that is load-bearing rather than stylistic. A
    // double-quoted value in a .env file has its escapes processed by the
    // loader, which leaves the \" inside the JSON as literal backslash-quote —
    // JSON.parse then throws, config/accounts.mjs fails closed to an empty list,
    // and every sign-in answers 503 with nothing anywhere saying why. Single
    // quotes are taken literally, and the password is base64url, so it can never
    // contain one and close the quoting early.
    `DEAR_ACCOUNTS='${JSON.stringify([{ username: DEFAULT_USER, password }])}'`,
    `DEAR_SESSION_SECRET=${secret(32)}`,
    'DEAR_SESSION_DAYS=30',
    '',
  ];

  writeFileSync(envPath, `${existing ? `${existing.trimEnd()}\n\n` : ''}${lines.join('\n')}`, 'utf8');

  console.log('');
  console.log('  Sign in with');
  console.log(`    name      ${DEFAULT_USER}`);
  console.log(`    password  ${password}`);
  console.log('');
  console.log('  Shown once. It is in .env at the repository root if you lose it.');
  console.log('');
}

// ── The dashboard, pointed at the sample record ─────────────────────────────
//
//   node scripts/dashboard.mjs sample          (npm run dev:sample)
//
// Starts the dev server with the sample as the DEFAULT record — DEAR_RECORD,
// which lib/data-dir.js honours when no cookie has been set. The sample is read
// by the same resolver, the same parsers and the same views as the real record,
// which is the only arrangement that makes it worth having: a preview down its
// own code path would prove the preview works, not the design.
//
// A default rather than a lock: the switch in Settings still works from here,
// and flipping it to the real record sets a cookie that outranks this. That is
// the point of the flag being "what a browser with no cookie sees".
//
// This is now a convenience rather than the only way in. The switch in the
// running app is the way in — this just saves the first click.
//
// A spawn rather than a shell one-liner because `DEAR_RECORD=... next dev` is
// not a thing cmd.exe understands, and this repo is developed on Windows.
function sample() {
  const dir = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'samples');
  if (!existsSync(join(dir, 'IS_SAMPLE'))) {
    console.error(`No sample record at ${dir} — expected an IS_SAMPLE marker in it.`);
    process.exitCode = 1;
    return;
  }

  ensureAccounts();
  console.log(`
  Opening on the SAMPLE record at samples/. Nothing in data/ is touched.
  Settings › Record switches between the two without a restart.
`);

  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '-p', '3220', '-H', '127.0.0.1'],
    { stdio: 'inherit', env: { ...process.env, DEAR_RECORD: 'sample' } },
  );
  child.on('exit', (code) => {
    process.exitCode = code ?? 0;
  });
}

const command = process.argv[2];
if (command === 'ensure-accounts') {
  ensureAccounts();
} else if (command === 'sample') {
  sample();
} else {
  console.log('usage: node scripts/dashboard.mjs <ensure-accounts|sample>');
  process.exitCode = 1;
}
