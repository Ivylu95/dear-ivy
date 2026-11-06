// Reads one threshold from .claude/thresholds.json, the file generated from the
// rows that state them (FND-009; ux/scripts/thresholds.mjs writes it).
//
// A missing file or key returns null, never a default: a number written here as
// a fallback would be a second home for it. Each caller decides what null means,
// and a caller that removes or starts anything must take null as "do nothing".
// The caller names the unit it counts in, so a row rewritten as 1 GB reads as
// unreadable, not as 1 MB.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The file sits beside the harness this lib belongs to: .claude/hooks/lib → .claude/
const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'thresholds.json');

let cache;
export const threshold = (key, unit) => {
  if (cache === undefined) {
    try {
      cache = JSON.parse(readFileSync(FILE, 'utf8')).thresholds ?? {};
    } catch {
      cache = {};
    }
  }
  const entry = cache[key];
  if (!entry || entry.unit !== unit) return null;
  return typeof entry.value === 'number' && entry.value > 0 ? entry.value : null;
};
