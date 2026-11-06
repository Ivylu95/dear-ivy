// The scratch folder's two lines, and one way of measuring it.
//
// ARC-013, "All scratch output goes to one disposable location." Its design
// bounds the folder twice: by age, through the sweep (session/sweep-temp.mjs),
// and by size, through a report that never removes anything. Both numbers live
// in ARC-013's row and reach the code through .claude/thresholds.json (FND-009), so
// the sweep, the session notice and the check cannot disagree.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { threshold } from './thresholds.mjs';

// null when the threshold cannot be read. The sweep then removes nothing.
export const scratchMaxAgeDays = () => threshold('scratch.maxAge', 'days');
export const scratchCeilingMb = () => threshold('scratch.ceiling', 'MB');

export const scratchDir = (repoRoot) => join(repoRoot, 'temp');

const walk = (dir) => {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
};

// { files, mb, oldestDays }, or null when there is no scratch folder.
export const measureScratch = (repoRoot) => {
  const dir = scratchDir(repoRoot);
  try {
    statSync(dir);
  } catch {
    return null;
  }
  const files = walk(dir);
  let bytes = 0;
  let oldest = Date.now();
  for (const file of files) {
    try {
      const stat = statSync(file);
      bytes += stat.size;
      if (stat.mtimeMs < oldest) oldest = stat.mtimeMs;
    } catch {
      // Vanished between the walk and the stat, which is what scratch does.
    }
  }
  return {
    files: files.length,
    mb: bytes / (1024 * 1024),
    oldestDays: Math.floor((Date.now() - oldest) / (24 * 60 * 60 * 1000)),
  };
};
