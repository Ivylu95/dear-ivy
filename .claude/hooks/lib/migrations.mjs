// Record migrations: when a release changes the shape a record file is read in
// (PRD-008 design 2, "Migrate an older shape when it is read"), a numbered script
// in .claude/migrations/ rewrites the old shape at the next session start, the
// superseded file kept in archive/ first. Nothing in a record is ever deleted.
//
// The convention (.claude/migrations/README.md):
//   formats.json        each record format: its files (relative to the record
//                       folder), the files that read it, and its version
//   NNN-<format>-v<N>.mjs  one migration, run in number order, bringing <format>
//                       to version N. It exports `migrate(text, { path })`, which
//                       returns the new text, or null when the file is already in
//                       the new shape. It must be idempotent: run on its own
//                       output it returns null (or the same text), and the runner
//                       refuses to write a result that fails that test.
//
// Two sides use this file:
//   - a session start (session/session-brief.mjs) calls runMigrations on the
//     active record, which runs every script not yet in the record's ledger,
//     archive/migrations/ran.json, and writes nothing when none is pending;
//   - the release script (dev/skills/release/release.mjs prepare) calls
//     formatProblems, which refuses a release that changed a reader of a format
//     without raising its version and shipping the migration for it, unless the
//     developer declares the shape unchanged (--same-format <format>).
//
// No dependencies, like everything under hooks/.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');
export const FORMATS_FILE = 'formats.json';
/** The record's own ledger of which migrations ran, relative to the record folder. */
export const LEDGER = 'archive/migrations/ran.json';
export const SCRIPT_NAME = /^(\d{3})-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-v(\d+)\.mjs$/;

/** formats.json's text as { name: { files, readers, version } }; throws on a malformed file. */
export function readFormats(text) {
  const parsed = JSON.parse(text);
  const formats = parsed?.formats;
  if (!formats || typeof formats !== 'object') throw new Error('formats.json has no "formats" object');
  for (const [name, f] of Object.entries(formats)) {
    if (!/^[a-z][a-z0-9]*$/.test(name)) throw new Error(`format "${name}": a name is lower-case letters and digits`);
    if (!Array.isArray(f.files) || !f.files.length) throw new Error(`format "${name}": no files`);
    if (!Array.isArray(f.readers) || !f.readers.length) throw new Error(`format "${name}": no readers`);
    if (!Number.isInteger(f.version) || f.version < 1) throw new Error(`format "${name}": version must be a whole number from 1`);
  }
  return formats;
}

/** Script file names as [{ file, n, format, to }] in run order, and what is wrong with any. */
export function readScripts(names) {
  const scripts = [];
  const problems = [];
  const seen = new Map();
  for (const file of names) {
    if (!file.endsWith('.mjs')) continue;
    const m = SCRIPT_NAME.exec(file);
    if (!m) {
      problems.push(`${file}: a migration is named NNN-<format>-v<N>.mjs`);
      continue;
    }
    if (seen.has(m[1])) problems.push(`${file}: number ${m[1]} is taken by ${seen.get(m[1])}`);
    seen.set(m[1], file);
    scripts.push({ file, n: Number(m[1]), format: m[2], to: Number(m[3]) });
  }
  scripts.sort((a, b) => a.n - b.n);
  return { scripts, problems };
}

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

/** The record's ledger: { ran: [{ script, on, archived }] }. */
export function readLedger(recordDir) {
  const ledger = readJson(join(recordDir, LEDGER), null);
  return ledger && Array.isArray(ledger.ran) ? ledger : { ran: [] };
}

/** Where the superseded copy of `rel` goes: archive/migrations/NNN-<path>-<date><ext>, never over another. */
export function archivePathFor(recordDir, rel, n, day) {
  const ext = extname(rel);
  const stem = rel.slice(0, rel.length - ext.length).replace(/[\\/]+/g, '-');
  const base = `archive/migrations/${String(n).padStart(3, '0')}-${stem}-${day}`;
  let out = `${base}${ext}`;
  for (let i = 2; existsSync(join(recordDir, out)); i += 1) out = `${base}-${i}${ext}`;
  return out;
}

/**
 * Runs every migration the record's ledger does not hold, in number order, on
 * `recordDir`. Each file a script changes is copied to archive/migrations/ before
 * it is rewritten. A script that fails, or whose result it would change again,
 * stops the run there: nothing of it is written or recorded, and the next session
 * tries again. Writes nothing at all when no migration is pending.
 * Returns { ran: [script], archived: [{ file, to }], problems: [text] }.
 */
export async function runMigrations(recordDir, { dir = MIGRATIONS_DIR, today = new Date().toISOString().slice(0, 10) } = {}) {
  const out = { ran: [], archived: [], problems: [] };
  if (!existsSync(dir) || !existsSync(recordDir)) return out;
  let formats;
  try {
    formats = readFormats(readFileSync(join(dir, FORMATS_FILE), 'utf8'));
  } catch (e) {
    out.problems.push(`.claude/migrations/${FORMATS_FILE}: ${e.message}`);
    return out;
  }
  const { scripts, problems } = readScripts(readdirSync(dir));
  if (problems.length) {
    out.problems.push(...problems);
    return out;
  }
  const ledger = readLedger(recordDir);
  const done = new Set(ledger.ran.map((r) => r.script));
  const pending = scripts.filter((s) => !done.has(s.file));
  if (!pending.length) return out;

  for (const s of pending) {
    const format = formats[s.format];
    if (!format) {
      out.problems.push(`${s.file}: no format "${s.format}" in ${FORMATS_FILE}`);
      break;
    }
    let migrate;
    try {
      ({ migrate } = await import(pathToFileURL(join(dir, s.file)).href));
      if (typeof migrate !== 'function') throw new Error('it exports no migrate()');
    } catch (e) {
      out.problems.push(`${s.file}: ${e.message}`);
      break;
    }
    // Work out every file's new text first, so a failure part-way writes nothing.
    const writes = [];
    let failed = null;
    for (const rel of format.files) {
      const path = join(recordDir, rel);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      try {
        const next = migrate(text, { path: rel });
        if (next === null || next === undefined || next === text) continue;
        if (typeof next !== 'string') throw new Error(`returned ${typeof next} for ${rel}, not text`);
        const again = migrate(next, { path: rel });
        if (again !== null && again !== undefined && again !== next) throw new Error(`is not idempotent on ${rel}: its own result would change again`);
        writes.push({ rel, path, text, next });
      } catch (e) {
        failed = `${s.file}: ${e.message}`;
        break;
      }
    }
    if (failed) {
      out.problems.push(failed);
      break;
    }
    const archived = [];
    for (const w of writes) {
      const to = archivePathFor(recordDir, w.rel, s.n, today);
      mkdirSync(dirname(join(recordDir, to)), { recursive: true });
      writeFileSync(join(recordDir, to), w.text);
      writeFileSync(w.path, w.next);
      archived.push(to);
      out.archived.push({ file: w.rel, to });
    }
    ledger.ran.push({ script: s.file, on: today, archived });
    out.ran.push(s.file);
  }
  if (out.ran.length) {
    mkdirSync(dirname(join(recordDir, LEDGER)), { recursive: true });
    const body = {
      _what: 'Which record migrations (.claude/migrations/) have run on this record, and where each kept the files it superseded. Written by the session start; never edited by hand.',
      ran: ledger.ran,
    };
    writeFileSync(join(recordDir, LEDGER), `${JSON.stringify(body, null, 2)}\n`);
  }
  return out;
}

/**
 * What a release may not ship (prepare): a reader of a format changed with the
 * format's version unraised and no declaration that its shape is the same, a
 * version raised with no migration bringing the format to each new version, a
 * version lowered, or a malformed folder.
 *   prev, next      formats.json text at the last release and in the candidate
 *                   (prev null or '' when the last release had none: nothing is
 *                   compared, since there was no version to raise)
 *   changed(path)   whether that file differs from the last release
 *   scripts         the candidate's file names in .claude/migrations/
 *   sameFormat      formats the developer declared unchanged in shape
 */
export function formatProblems({ prev, next, changed, scripts, sameFormat = [] }) {
  const problems = [];
  if (!next) return problems;
  let now;
  try {
    now = readFormats(next);
  } catch (e) {
    return [`.claude/migrations/${FORMATS_FILE}: ${e.message}`];
  }
  const read = readScripts(scripts);
  problems.push(...read.problems);
  for (const s of read.scripts) {
    if (!now[s.format]) problems.push(`${s.file}: no format "${s.format}" in ${FORMATS_FILE}`);
    else if (s.to > now[s.format].version) problems.push(`${s.file}: brings ${s.format} to v${s.to}, above its version ${now[s.format].version}`);
  }
  if (!prev) return problems;
  let before;
  try {
    before = readFormats(prev);
  } catch {
    return problems;
  }
  for (const [name, f] of Object.entries(now)) {
    const was = before[name]?.version;
    if (was === undefined) continue; // A new format: nothing in a record is in an older shape of it.
    if (f.version < was) {
      problems.push(`${name}: its version went down, ${was} to ${f.version}; a record already moved on cannot go back`);
      continue;
    }
    for (let v = was + 1; v <= f.version; v += 1) {
      if (!read.scripts.some((s) => s.format === name && s.to === v)) problems.push(`${name} is now v${f.version}, but no migration brings it to v${v}: add .claude/migrations/NNN-${name}-v${v}.mjs`);
    }
    if (f.version === was && !sameFormat.includes(name)) {
      const touched = f.readers.filter((r) => changed(r));
      if (touched.length) {
        problems.push(
          `${touched.join(', ')} changed, which reads ${name}: raise its version in .claude/migrations/${FORMATS_FILE} and add the migration (NNN-${name}-v${was + 1}.mjs), or declare its shape unchanged with --same-format ${name}`,
        );
      }
    }
  }
  return problems;
}
