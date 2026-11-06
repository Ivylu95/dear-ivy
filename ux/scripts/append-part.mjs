// Appending to a log that cuts itself before the one-read line (E-031, T-768).
//
// A log only ever appended to, such as the growth log (HYG-001), outgrows one
// read in time. The pattern is the Transcript's months (T-499) and the eval
// history's days: the file keeps its name as the first part, and once the last
// part would pass PART_LINES the next begins beside it as `<name>-2.<ext>`, then
// `-3`…; every reader reads them in order, as one (lib/one-read.mjs).

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { PART_LINES, partPath } from '../../.claude/hooks/lib/one-read.mjs';

/** Every part of `file` that exists, in order: the file itself first. */
export function partsOf(file) {
  const out = [];
  for (let n = 1; existsSync(partPath(file, n)); n += 1) out.push(partPath(file, n));
  return out;
}

/** Lines held, a trailing newline not counted as one. */
const held = (file) => {
  const text = readFileSync(file, 'utf8');
  return text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
};

/** Appends `lines` to the last part, or begins the next when they would take it past `limit`; returns the file written. */
export function appendPart(file, lines, limit = PART_LINES) {
  const list = [lines].flat();
  const parts = partsOf(file);
  const last = parts.at(-1);
  const target = !last ? file : held(last) + list.length > limit ? partPath(file, parts.length + 1) : last;
  appendFileSync(target, `${list.join('\n')}\n`);
  return target;
}
