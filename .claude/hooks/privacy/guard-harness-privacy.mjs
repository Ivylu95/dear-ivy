// PreToolUse(Write|Edit|MultiEdit) — nothing personal is written outside data/.
//
// CLAUDE.md: "no names, no quotes, no details of her life can be found outside
// this folder." ux/scripts/check-privacy.mjs already proves this over the whole
// tree, but it runs at build time — after the leak is committed, and after a
// push has published it. This is the same two mechanical checks applied to one
// pending write, before it lands:
//
//   NAMES   a first name that has a file in data/people/
//   COPIES  a long line that already appears verbatim somewhere in data/
//
// A clean pass is not proof the write is impersonal. A hit is proof it is not.
//
// This runs before every Write and Edit in the repo, so it is ordered cheapest
// test first and reads nothing it does not need: writes into data/ leave at the
// first branch, the names check costs one readdir, and the record is only walked
// when the pending write actually contains a line long enough to be a quote.

import { readHookInput, deny, pass, isInside, read, walk, peopleNames, realDataDir as dataDir, repoRoot } from '../lib/hook.mjs';
import { join } from 'node:path';

const QUOTE_LENGTH = 60; // Shorter than this and a verbatim match is coincidence.

const input = await readHookInput();
const path = input?.tool_input?.file_path ?? '';
if (!path) pass();
if (isInside(path, dataDir)) pass(); // data/ is where personal content belongs.
if (isInside(path, join(repoRoot, 'data-sandbox'))) pass(); // Test content, removable.
if (!isInside(path, repoRoot)) pass();

const ti = input.tool_input ?? {};
const written = [ti.content, ti.new_string, ...(ti.edits ?? []).map((e) => e.new_string)]
  .filter(Boolean)
  .join('\n');
if (!written.trim()) pass();

for (const name of peopleNames()) {
  if (new RegExp(`\\b${name}\\b`).test(written)) {
    deny(
      'PreToolUse',
      `Blocked: "${name}" has a file in data/people/, and this write is outside data/.\n\n` +
        'Names live in the record and nowhere else — not in a comment, a fixture, a doc ' +
        'example or a commit message. Use a placeholder here, and put the real thing in data/.',
    );
  }
}

// Verbatim carry-over: her own words reaching a harness file. Nothing below here
// runs unless the write contains a line long enough to be one.
const candidates = written
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length >= QUOTE_LENGTH);
if (!candidates.length) pass();

const fromRecord = new Set();
for (const file of walk(dataDir)) {
  if (!file.endsWith('.md')) continue;
  for (const line of read(file).split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length >= QUOTE_LENGTH && !trimmed.startsWith('<!--')) fromRecord.add(trimmed);
  }
}

for (const line of candidates) {
  if (!fromRecord.has(line)) continue;
  deny(
    'PreToolUse',
    'Blocked: this line already appears verbatim inside data/.\n\n' +
      `  ${line.slice(0, 80)}…\n\n` +
      'Copying it into a harness file moves something of hers out of the one folder ' +
      'that is hers. Write a non-personal line here instead.',
  );
}

pass();
