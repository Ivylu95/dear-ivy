// PostToolUse and Stop — every PROFILE.yaml obeys its rules, checked the moment
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
// ── Pointers, as a file is written (SFG-005) ────────────────────────────────
//
// The same hook, after a Write or an Edit of a markdown file, reads that file
// alone for a pointer to nothing or a cited row no spec defines (the rules of
// ux/scripts/check-links.mjs, less what its known list already holds) and hands
// the findings back with the profile's, so the fix is the next edit and not a
// search at commit. Only the file just written is read, and the whole read is
// a fraction of a second. A shell command names no file and is left to the
// commit gate. It reports; it cannot undo.
//
// ── From the command line ───────────────────────────────────────────────────
//
//   node .claude/hooks/record/check-profile.mjs --all              every profile
//   node .claude/hooks/record/check-profile.mjs --write-template   regenerate it
//   node .claude/hooks/record/check-profile.mjs --fix-header <file> restore a header
//
// `--all` is the full sweep `npm run check` and the build call: every profile,
// plus the template, which must be exactly the blank profile the schema writes
// (so a new record starts from the current rules). When ux/ has js-yaml
// installed, each file is also read by it and must mean the same thing, which
// proves the strict subset the schema parses is still real YAML.
//
// From the command line it reads the repository it lives in, whatever folder
// it is run from: ux/lib/checks.mjs runs it from ux/, where the shared root
// (the hook's project folder, else the working folder) would find no profile.
// A hook run keeps the project folder Claude Code gives it.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const flag = process.argv[2];
if (['--all', '--write-template', '--fix-header'].includes(flag) && !process.env.CLAUDE_PROJECT_DIR) {
  process.env.CLAUDE_PROJECT_DIR = fileURLToPath(new URL('../../..', import.meta.url)).replace(/[\\/]$/, '');
}
const { readHookInput, block, pass, markerRead, markerWrite, repoRoot } = await import('../lib/hook.mjs');
const { allProfiles, profileErrors, record, TEMPLATE } = await import('../lib/profile.mjs');
if (flag === '--write-template') {
  writeFileSync(TEMPLATE, record.renderProfile({}));
  console.log(`profile check: wrote ${relative(repoRoot, TEMPLATE)}`);
  process.exit(0);
}
if (flag === '--fix-header') {
  const path = process.argv[3];
  writeFileSync(path, record.withCurrentHeader(readFileSync(path, 'utf8')));
  console.log(`profile check: restored the header of ${relative(repoRoot, path)}`);
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
  // Compared as text, not bytes: a checkout with core.autocrlf (every Windows
  // clone, and the pre-commit gate's copy of the index) writes CRLF.
  else if (readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n') !== record.renderProfile({})) {
    failures.push(
      `${relative(repoRoot, TEMPLATE)} is not the blank profile the schema writes; regenerate it: node .claude/hooks/record/check-profile.mjs --write-template`,
    );
  }

  if (failures.length) {
    console.error(
      `\n  PROFILE CHECK FAILED\n\n${failures.map((f) => `  - ${f}`).join('\n')}\n\n` +
        '  The rules are in the header of every PROFILE.yaml, and enforced in\n' +
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

// A markdown file just written: any pointer in it that resolves to nothing.
async function brokenPointers() {
  const written = input?.tool_input?.file_path;
  if (stopping || typeof written !== 'string' || !/\.md$/i.test(written)) return [];
  const abs = resolve(input.cwd || repoRoot, written);
  const rel = relative(repoRoot, abs).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !existsSync(abs)) return [];
  try {
    const { findBrokenLinksIn, freshFindings } = await import(new URL('../../../ux/scripts/check-links.mjs', import.meta.url).href);
    const found = freshFindings(findBrokenLinksIn(repoRoot, new Set([rel])).findings);
    return [...new Set(found.map((f) => `${f.from} ${f.what}`))];
  } catch {
    return []; // a copy without ux/: the commit gate still checks
  }
}
const pointerFailures = await brokenPointers();

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

const POINTERS = pointerFailures.length
  ? `LINK CHECK FAILED on the file just written. Fix this next: a pointer that resolves is how the record stays findable.\n\n${pointerFailures.map((f) => `  - ${f}`).join('\n')}`
  : '';
if (POINTERS) block(failures.length ? `${POINTERS}\n\nPROFILE CHECK FAILED too:\n\n${failures.join('\n\n')}` : POINTERS);
if (!failures.length) pass();
block(
  `PROFILE CHECK FAILED. Fix this next; the rules are in the file's own header. If she is in crisis or distressed, stay with her and fix this afterwards: safety comes first (policies/SAFETY_POLICY.md).\n\n${failures.join('\n\n')}`,
);
