// Who can open this record.
//
// This file holds no credentials. It reads them from the environment, so a
// password never enters git history: it is never in a file git tracks.
//
//   DEAR_ACCOUNTS         JSON array: [{"username":"me","password":"..."}]
//   DEAR_SESSION_SECRET   signs the session cookie; changing it signs everyone out
//   DEAR_SESSION_DAYS     session lifetime in days, optional, defaults to 30
//
// Where they come from: the .env at the REPOSITORY ROOT — beside data/, not
// inside ux/ — written by scripts/dashboard.mjs the first time the dashboard is
// started, and gitignored. A fresh clone therefore gets its own generated
// password, printed once on first run. It sits at the root because who may open
// this record is a property of the record, not of the app that displays it;
// config/env.mjs is what reads it, since Next only looks inside ux/. There is no
// hosted deployment and so no second place these can be set.
//
// JSON rather than a `user:pass` list because a generated password may contain
// any character, and a separator that can appear inside a value is a parser that
// silently truncates a credential.
//
// Read on every call, never at module scope (PRV-005, "Revoking access actually
// revokes it."):
//
// 1. lib/auth.js is imported by proxy.js, which runs on Node at request time, so
//    a build made without these values contains neither of them.
// 2. Editing the .env takes effect on the next request, without a restart:
//    config/env.mjs reads the file again whenever it changes, so an account
//    removed is refused at once and a changed secret ends every session at once.
//    A value exported in the shell still wins over the file, and stays until
//    the server is restarted from a shell without it.
//
// FAIL CLOSED. Anything missing, malformed or incomplete yields an empty list,
// and authConfigured() in lib/auth.js then refuses every sign-in rather than
// letting in anyone who can reach the port.

// It fills process.env from the .env at the repository root, where the
// credentials live, and envValue() reads them as the file is now.
import { envValue } from './env.mjs';

function parseAccounts(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a) =>
      a &&
      typeof a.username === 'string' &&
      typeof a.password === 'string' &&
      a.username.trim() !== '' &&
      a.password !== '',
  );
}

// Usernames are trimmed and compared case-insensitively by lib/auth.js. Passwords
// are compared exactly. Parsed again only when the raw value changes.
let parsedFrom;
let parsed = [];
export function accounts() {
  const raw = envValue('DEAR_ACCOUNTS');
  if (raw !== parsedFrom) {
    parsedFrom = raw;
    parsed = parseAccounts(raw);
  }
  return parsed;
}

export const sessionSecret = () => envValue('DEAR_SESSION_SECRET') || '';

export const sessionDays = () => Number(envValue('DEAR_SESSION_DAYS')) || 30;
