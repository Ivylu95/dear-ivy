// The gate's credentials, read from the repository root.
//
// Next loads .env files from the APP's directory — ux/ — which is one level
// below where this repository actually lives. The credentials are not a property
// of the dashboard; they are who may open this record, and the record is the
// repository. So the file sits at the root, beside data/, and this reads it.
//
// ── Precedence, and why it is this way round ────────────────────────────────
//
// A value already in the environment is never overwritten. Someone who exports
// a credential in their shell to try something has said so deliberately, and a
// file sitting on disk must not quietly win over that. So: environment first,
// file second, and the file is only ever filling in blanks.
//
// ── Why not a dependency ────────────────────────────────────────────────────
//
// dotenv is forty lines of parsing and one more thing in the tree that runs
// before the gate does. This app has four dependencies and none of them touch
// authentication. The subset below is exactly what scripts/dashboard.mjs writes
// and what a person editing that file by hand would type.
//
// Imported for its side effect, first, by config/accounts.mjs — which reads
// process.env at module scope, so this has to have run by then.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// config/ -> ux/ -> the repository.
export const ENV_PATH = join(
  dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
  '.env',
);

// KEY=value, one per line.
//
// Quotes are stripped only as a matching pair, and single-quoted values are
// taken literally — which matters more than it looks. The account list is JSON,
// so it is full of double quotes, and a loader that processed escapes inside a
// double-quoted value would hand JSON.parse a string full of backslash-quote.
// It would then throw, the account list would fail closed to empty, and every
// sign-in would answer 503 with nothing anywhere saying why. See the note in
// scripts/dashboard.mjs, which writes the file this reads.
function parse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;

    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = trimmed.slice(eq + 1).trim();

    const quote = value[0];
    if ((quote === "'" || quote === '"') && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    }

    out[key] = value;
  }
  return out;
}

// Silent when the file is not there. The first run has not written it yet, or
// the credentials were exported instead — and a throw here would take down the
// proxy, which is the whole of the protection standing in front of this record.
// Missing credentials fail closed in config/accounts.mjs, which is the right
// place for that to be loud.
function load() {
  if (!existsSync(ENV_PATH)) return;
  let text;
  try {
    text = readFileSync(ENV_PATH, 'utf8');
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parse(text))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

load();
