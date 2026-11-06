// PreToolUse(Write|Edit|MultiEdit) — nothing personal is written outside data/.
//
// CLAUDE.md: "no names, no quotes, no details of her life can be found outside
// this folder." ux/scripts/check-privacy.mjs already proves this over the whole
// tree, but it runs at build time — after the leak is committed, and after a
// push has published it. This is the same two mechanical checks applied to one
// pending write, before it lands:
//
//   NAMES   her own name, and each first name on file in data/core/people/, page or folder
//   COPIES  a long line that already appears verbatim somewhere in data/
//
// A clean pass is not proof the write is impersonal. A hit is proof it is not.
//
// This runs before every Write and Edit in the repo, so it is ordered cheapest
// test first and reads nothing it does not need: writes into data/ leave at the
// first branch, the names check costs one readdir, and the record is only walked
// when the pending write actually contains a line long enough to be a quote.

import { readHookInput, refuse, pass, isInside, read, walk, recordNames, realDataDir as dataDir, repoRoot } from '../lib/hook.mjs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const QUOTE_LENGTH = 60; // Shorter than this and a verbatim match is coincidence.

const input = await readHookInput();
const path = input?.tool_input?.file_path ?? '';
if (!path) pass();
if (isInside(path, dataDir)) pass(); // data/ is where personal content belongs.
// data-sandbox/ is outside data/, so it is held to the same rule (A-155): a chat
// played there is test content, and a real name typed into one is still a leak.
if (!isInside(path, repoRoot)) pass();

const ti = input.tool_input ?? {};
const written = [ti.content, ti.new_string, ...(ti.edits ?? []).map((e) => e.new_string)]
  .filter(Boolean)
  .join('\n');
if (!written.trim()) pass();

// The reviewed everyday phrases (ux/lib/everyday-names.json) are hidden from the
// match, exactly as the whole-tree check hides them, and nothing else is. A copy
// without the list hides nothing, which is the strict way round.
let withoutEverydayNames = (text) => text;
try {
  ({ withoutEverydayNames } = await import(pathToFileURL(join(repoRoot, 'ux', 'lib', 'everyday-names.mjs')).href));
} catch { /* no list: every occurrence is matched */ }
const rel = relative(repoRoot, resolve(repoRoot, path)).replace(/\\/g, '/');
for (const name of await recordNames()) {
  if (new RegExp(`\\b${name}\\b`, 'i').test(withoutEverydayNames(written, name, rel))) {
    refuse(
      'PreToolUse',
      `Blocked: "${name}" is a name from the record, and this write is outside data/.\n\n` +
        'Names live in the record and nowhere else — not in a comment, a fixture, a doc ' +
        'example or a commit message. Use a placeholder here, and put the real thing in data/.',
    );
  }
}

// Verbatim carry-over: her own words reaching a harness file. Nothing below here
// runs unless the write contains a line long enough to be one.
// A line a blank template holds is harness text that data/ was built from, not
// hers: the invented record and the templates' own docs repeat it by design.
const fromTemplates = new Set();
for (const file of walk(join(repoRoot, 'modules'))) {
  if (!file.replace(/\\/g, '/').includes('/templates/')) continue;
  for (const line of read(file).split('\n')) fromTemplates.add(line.trim());
}

// Each line with its number in this write, so a refusal names where, never what.
const candidates = written
  .split('\n')
  .map((line, i) => [line.trim(), i + 1])
  .filter(([line]) => line.length >= QUOTE_LENGTH && !fromTemplates.has(line));
if (!candidates.length) pass();

const fromRecord = new Set();
for (const file of walk(dataDir)) {
  if (!file.endsWith('.md')) continue;
  for (const line of read(file).split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length >= QUOTE_LENGTH && !trimmed.startsWith('<!--')) fromRecord.add(trimmed);
  }
}

// Named by path and line only (A-155): a refusal that printed the line carried the
// very words it stopped into the chat that shows it.
for (const [line, n] of candidates) {
  if (!fromRecord.has(line)) continue;
  refuse(
    'PreToolUse',
    `Blocked: ${rel}, line ${n} of this write, already appears verbatim inside data/.\n\n` +
      'Copying it into a harness file moves something of hers out of the one folder ' +
      'that is hers. Write a non-personal line here instead.',
  );
}

pass();
