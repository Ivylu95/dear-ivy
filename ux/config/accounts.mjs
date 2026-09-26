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
// Two things follow from this being read at module scope:
//
// 1. process.env.DEAR_* is read when this module loads. lib/auth.js is imported by
//    proxy.js, which runs on Node at request time, so a build made without these
//    values contains neither of them.
// 2. Changing an account needs the dev server restarted, not just the .env
//    edited: the old values stay loaded until the module is.
//
// FAIL CLOSED. Anything missing, malformed or incomplete yields an empty list,
// and authConfigured() in lib/auth.js then refuses every sign-in rather than
// letting in anyone who can reach the port.

// First, and for its side effect only: it fills process.env from the .env at the
// repository root, which is where the credentials live. Everything below reads
// process.env at module scope, so this import has to be evaluated before them —
// which is what its position here guarantees.
import './env.mjs';

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
// are compared exactly.
export const ACCOUNTS = parseAccounts(process.env.DEAR_ACCOUNTS);

export const SESSION_SECRET = process.env.DEAR_SESSION_SECRET || '';

export const SESSION_DAYS = Number(process.env.DEAR_SESSION_DAYS) || 30;
