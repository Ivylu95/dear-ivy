// PostToolUse and Stop — every profile.yaml obeys its rules, checked the moment
// it changes and again before a turn ends.
//
// The rules (three sections; each question's status one of five; last_updated a
// real date-time with an offset; a value only when answered; revisit_when only
// and always when declined) are written in the file's own header, so a session
// that opens it knows them. This is what makes them hold when a session doesn't
// read, or misreads: the rules live in ux/config/record.mjs, and this hook, the
// session brief, `npm run check` and the dashboard all read through them.
//
// ── Why it runs after shell commands too ────────────────────────────────────
//
// A profile is edited with the edit tools, but also with sed, a heredoc or a
// short script, and a check that watched only the edit tools would miss exactly
// the edits most likely to break the file. So it runs after those too, and
// costs almost nothing when nothing changed: each profile's size and mtime are
// remembered after a clean check, and only a profile whose fingerprint moved (or
// that failed last time) is read at all.
//
// ── What it does on failure ─────────────────────────────────────────────────
//
// After a tool call, the errors go straight back to the model as a block, naming
// each broken line, so it is fixed before anything else happens. Before a turn
// ends, a broken profile stops the turn from ending, once; the save hook has
// already committed what was written, so nothing is lost while it is fixed.
//
// A profile in the old flat shape is not an error here: it migrates at the next
// session start on that record.
//
// ── From the command line ───────────────────────────────────────────────────
//
//   node .claude/hooks/record/check-profile.mjs --all              every profile
//   node .claude/hooks/record/check-profile.mjs --write-template   regenerate it
//
// `--all` is the full sweep `npm run check` and the build call: every profile,
// plus the template, which must be exactly the blank profile the schema writes
// (so a new record starts from the current rules). When ux/ has js-yaml
// installed, each file is also read by it and must mean the same thing, which
// proves the strict subset the schema parses is still real YAML.

import { readHookInput, block, pass, markerRead, markerWrite, repoRoot } from '../lib/hook.mjs';
import { allProfiles, profileErrors, record, TEMPLATE } from '../lib/profile.mjs';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const flag = process.argv[2];
if (flag === '--write-template') {
  writeFileSync(TEMPLATE, record.renderProfile({}));
  console.log(`profile check: wrote ${relative(repoRoot, TEMPLATE)}`);
  process.exit(0);
}
if (flag === '--all') await sweep();

async function sweep() {
  let parseYaml = null;
  try {
    const resolved = createRequire(join(repoRoot, 'ux', 'package.json')).resolve('js-yaml');
    ({ load: parseYaml } = await import(pathToFileURL(resolved).href));
  } catch {
    /* not installed: every rule still runs; only the YAML cross-check is skipped, and said so */
  }

  const failures = [];
  const notes = [];
  const paths = allProfiles().filter((p) => p !== TEMPLATE);
  for (const path of paths) {
    const name = relative(repoRoot, path);
    const text = readFileSync(path, 'utf8');
    if (record.isLegacyProfile(text)) {
      notes.push(`${name} is in the old flat shape; it migrates at the next session start on that record`);
      continue;
    }
    const { errors, data } = record.readProfile(text);
    if (!errors.length && parseYaml) errors.push(...crossCheck(parseYaml, text, data));
    for (const e of errors) failures.push(`${name}: ${e}`);
  }

  if (!existsSync(TEMPLATE)) failures.push(`${relative(repoRoot, TEMPLATE)} is missing`);
  else if (readFileSync(TEMPLATE, 'utf8') !== record.renderProfile({})) {
    failures.push(
      `${relative(repoRoot, TEMPLATE)} is not the blank profile the schema writes; regenerate it: node .claude/hooks/record/check-profile.mjs --write-template`,
    );
  }

  if (failures.length) {
    console.error(
      `\n  PROFILE CHECK FAILED\n\n${failures.map((f) => `  - ${f}`).join('\n')}\n\n` +
        '  The rules are in the header of every profile.yaml, and enforced in\n' +
        '  .claude/hooks/lib/profile-schema.mjs.\n',
    );
    process.exit(1);
  }
  for (const n of notes) console.log(`profile check: ${n}`);
  console.log(
    `profile check: ${paths.length} profile(s) valid` +
      (parseYaml ? ', and read the same by js-yaml' : ' (js-yaml not installed in ux/, so the YAML cross-check was skipped)') +
      '; template current',
  );
  process.exit(0);
}

function crossCheck(parseYaml, text, data) {
  let other;
  try {
    other = parseYaml(text);
  } catch (error) {
    return [`js-yaml cannot parse it: ${error.message.split('\n')[0]}`];
  }
  const out = [];
  for (const [s, questions] of Object.entries(data)) {
    for (const [q, keys] of Object.entries(questions)) {
      for (const [k, v] of Object.entries(keys)) {
        const theirs = other?.[s]?.[q]?.[k];
        const same =
          theirs === null || theirs === undefined
            ? v.trim() === ''
            : theirs instanceof Date
              ? Date.parse(v) === theirs.getTime()
              : String(theirs).trim() === v.trim();
        if (!same) out.push(`"${s}.${q}.${k}" reads as ${JSON.stringify(v)} here but ${JSON.stringify(theirs)} in YAML; quote it`);
      }
    }
  }
  return out;
}

const input = await readHookInput();
const stopping = input?.hook_event_name === 'Stop' || 'stop_hook_active' in (input ?? {});
if (input?.stop_hook_active) pass();

const MARKER = 'profile-fingerprints.json';
let known = {};
try {
  known = JSON.parse(markerRead(MARKER) || '{}');
} catch {
  known = {};
}

const fingerprint = (path) => {
  try {
    const s = statSync(path);
    return `${s.size}:${s.mtimeMs}`;
  } catch {
    return '';
  }
};

const failures = [];
const next = {};
for (const path of allProfiles()) {
  const name = relative(repoRoot, path);
  const fp = fingerprint(path);
  // Before a turn ends, everything is checked; after a tool call, only what moved.
  if (!stopping && known[name] === fp) {
    next[name] = fp;
    continue;
  }
  const errors = profileErrors(path);
  if (errors.length) failures.push(`${name}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  else next[name] = fp;
}
markerWrite(MARKER, JSON.stringify(next));

if (!failures.length) pass();
block(
  `PROFILE CHECK FAILED. Fix this now, before anything else; the rules are in the file's own header.\n\n${failures.join('\n\n')}`,
);
