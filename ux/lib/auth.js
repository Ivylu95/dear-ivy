// Session signing and credential checking for the gate.
//
// Dependency-free and Web Crypto only: a platform API that runs unchanged in the
// proxy, in route handlers and in server components, so the signing code has one
// form wherever the gate runs.
//
// The model is a username and password checked against the account list in
// config/accounts.mjs, exchanged for a signed, expiring, HttpOnly cookie naming
// the account it was issued to.

// The extension is explicit. Webpack resolves the extensionless form, but the
// editor's module resolution does not add `.mjs`, so it reported the config as a
// missing module and every symbol from it as `any`. `app/layout.jsx` already
// imports `@/theme/palette.mjs` the same way.
import { ACCOUNTS, SESSION_SECRET, SESSION_DAYS } from '@/config/accounts.mjs';

// Renaming this once invalidated every cookie already issued, which is a
// single re-login and the correct price: the old name carried hers.
const COOKIE = 'dear_session';

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

// Constant-time comparison. A timing-variable compare on the session signature or
// on a credential leaks it a byte at a time to anything that can reach the port.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Hashing both sides first makes the compare fixed-width, so it cannot leak a
// value's length. The domain string keeps a username digest from ever being
// interchangeable with a password digest.
async function secretsMatch(candidate, expected, domain) {
  if (!expected || typeof candidate !== 'string') return false;
  const a = toBase64Url(await hmac(candidate, domain));
  const b = toBase64Url(await hmac(expected, domain));
  return timingSafeEqual(a, b);
}

// A username typed by a human is not a secret, and treating a trailing space as a
// different account is user-hostile. The password is compared exactly.
function normaliseUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isKnownAccount(username) {
  const name = normaliseUsername(username);
  return ACCOUNTS.some((a) => normaliseUsername(a.username) === name);
}

// Returns the canonical username on success, null on failure.
//
// Every account is checked and both halves of every pair compared, with no early
// exit. Bailing out on the first username mismatch would answer faster than a
// wrong password does, and tell whoever is guessing which half they already had
// right.
export async function authenticate(username, password) {
  let matched = null;
  for (const account of ACCOUNTS) {
    const userOk = await secretsMatch(
      normaliseUsername(username),
      normaliseUsername(account.username),
      'dear-username-compare',
    );
    const passOk = await secretsMatch(password, account.password, 'dear-password-compare');
    if (userOk && passOk) matched = normaliseUsername(account.username);
  }
  return matched;
}

// The username is signed into the session, so removing an account from the list,
// or renaming one, invalidates every cookie already issued to it.
export async function createToken(username) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ sub: username, exp: Date.now() + SESSION_MAX_AGE * 1000 })),
  );
  const signature = toBase64Url(await hmac(payload, SESSION_SECRET));
  return `${payload}.${signature}`;
}

// The account a valid token was issued to, or null.
//
// This is the single verification path: verifyToken below is this function read
// as a boolean. Two implementations of "is this session good" is exactly the
// shape of bug where the gate and the page disagree about who is signed in, and
// the gate is the whole of the protection standing between her record and the
// open internet.
export async function sessionUser(token) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  // No secret, no session. Without this the hash below throws rather than
  // returning, because Web Crypto refuses a zero-length HMAC key, and the proxy
  // awaits this with no try around it. Fail-closed either way, but a throw reads
  // as a broken app rather than as "DEAR_SESSION_SECRET never reached the build".
  if (!SESSION_SECRET) return null;

  const expected = toBase64Url(await hmac(payload, SESSION_SECRET));
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const { sub, exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!isKnownAccount(sub)) return null;
    if (typeof exp !== 'number' || Date.now() >= exp) return null;
    return sub;
  } catch {
    return null;
  }
}

export async function verifyToken(token) {
  return (await sessionUser(token)) !== null;
}

// Fail closed. An empty account list, or one with a blank credential in it,
// authenticates nobody rather than letting in anyone who can reach the port.
export function authConfigured() {
  return (
    ACCOUNTS.length > 0 &&
    ACCOUNTS.every((a) => a.username && a.password) &&
    Boolean(SESSION_SECRET)
  );
}
