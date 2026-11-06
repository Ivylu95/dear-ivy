// What an access key looks like, for the guards that keep one out of every file.
//
// A person pastes a read key into the chat when they update their harness
// (stage 3 of the release flow). It is used for one download and never
// stored: not in the repository, not in git's settings, not in the record.
// PRV-003, "A credential never enters version control."

// GitHub's token shapes, a token written into a clone URL, and the two other secrets
// a setup handles: a Telegram bot token and a Claude token (rehearsal 2026-10-27: a
// bot token pasted in a development chat matched nothing, so the Transcript kept it).
// The bot token sits outside the \b group (edge cases, 2026-10-29): inside its own
// URL (`/bot<id>:<key>`, no word break after "bot"), ending in '-' (no word break
// after it), or with an 11- or 12-digit bot id, \b let each through. The id runs
// 8 to 20 digits, and the colon may come URL-encoded as %3A: a 13-digit id, or a
// token pasted from an encoded address, once passed (round 2, 2026-10-29, C2).
// Not below 8: a bot id has never been shorter, and at 7 two PDFs in a real
// record read as holding a key. A clock time like 12:30 is never one. The
// encoded colon in either case: %3a, lowercase, once slipped through (round 3, C26).
export const TOKEN = /\b(github_pat_[A-Za-z0-9_]{22,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-ant-[a-z]{2,6}\d{2}-[A-Za-z0-9_-]{20,})\b|(?<![0-9])\d{8,20}(?::|%3[Aa])[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])|x-access-token:[^@\s'"]{8,}@/;

export const hasToken = (text) => TOKEN.test(String(text ?? ''));

// The one command allowed to carry a key: the updater, handed the key through
// its own environment variable, with nothing chained, piped or redirected.
// `rekey <fingerprint> [version]` fetches too: the release that brings a new
// release key, trusted by the fingerprint the developer sent (round 3, D5).
const UPDATER = /^\s*DEAR_RELEASE_KEY='[A-Za-z0-9_]+'\s+node\s+\.claude\/hooks\/lib\/update\/update\.mjs\s+((check|fetch)(\s+[\w.-]+)?|rekey\s+[0-9a-f]{64}(\s+[\w.-]+)?)\s*$/;
export const isUpdaterCall = (command) => UPDATER.test(String(command ?? ''));

// The record of an approval phrase a person typed. Written by the
// typed-phrase hook from their own message, and by nothing else.
export const PHRASE_MARKER = 'typed-phrase-';
