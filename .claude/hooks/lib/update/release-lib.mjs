// What a release is, and the checks a copy runs before it trusts one.
//
// Shared by both ends of a harness release: the developer's release tooling
// builds and fingerprints a release with it, and every person's copy judges an
// incoming release with it. The copy always runs the version of this file it
// already has, never the one inside the release: a hijacked release would
// otherwise grade itself as safe. ARC-008: nothing here reads dev/specs/.
//
// A release is a tree of files plus `.release/release.json` (version, every
// file's SHA-256, what it declares) and `.release/release.sig` (an Ed25519
// signature over release.json, by the developer's release key). The copy holds
// the public half in .claude/release/release-key.pub from its first install.

import { createHash, createPublicKey, verify as verifySig } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { carriesCrisisWord } from '../everyday-reply.mjs';
import { RECORD_KEYS, withoutRecord } from '../hazard-log.mjs';

export const RELEASE_DIR = '.release';

/** Paths no release may write, delete or carry: the person's own, and git's (DEP-009: the harness reaches her copy without anyone gaining the record; held by ux/test/release-lane.test.mjs). */
export const NEVER_TOUCH = [
  /^data\//,
  /^(data-sandbox)\//, // the test record, in a group so it reads as its own folder
  /^dev\//, // the developer's own (FND-007): never on a copy
  /^\.git\//,
  /^\.git$/,
  // A phone session cannot push workflow files, and a refused push stops every
  // save after it, so a release never changes them in a copy.
  /^\.github\//,
  /^temp\//,
  /^\.claude\/hooks\/state\//,
  // Each heartbeat job's run record, rewritten by every run here: the copy's own (D1).
  /^\.claude\/jobs\/state\.json$/,
  /^\.claude\/release\/installed\.json$/,
  /^\.claude\/release\/update-log\.jsonl$/,
  // DEP-010: the local layer, what was made for this one person.
  /^\.claude\/skills\/local-[^/]+\//,
  /(^|\/)\.env[^/]*$/,
];

export const touchable = (path) => !NEVER_TOUCH.some((re) => re.test(path));

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Every file under root, repo-relative with forward slashes, symbolic links
 * included as files of their own and never followed (round 2, 2026-10-29, C12):
 * followed, a dangling one threw and verify died with no verdict, and a live one
 * was judged by what it pointed at. `isLink` names them, and verify holds a
 * release carrying one back: a link can point a copy's write into her record.
 */
export function listFiles(root, dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === '.next') continue;
    const abs = join(dir, name);
    const st = lstatSync(abs);
    if (st.isDirectory()) listFiles(root, abs, out);
    else if (st.isFile() || st.isSymbolicLink()) out.push(relative(root, abs).split(sep).join('/'));
  }
  return out.sort();
}

export const isLink = (root, path) => {
  try {
    return lstatSync(join(root, path)).isSymbolicLink();
  } catch {
    return false;
  }
};

// A text file is hashed with its line endings as LF. The same commit reaches a
// copy as CRLF on Windows (git's autocrlf, and `git archive` applies it) and as
// LF elsewhere, and the release was built from whichever tree the developer
// had: hashing raw bytes held back every good release on a Windows copy
// (backlog 2026-10-03). A file holding a NUL byte is binary and hashed as it is.
// What this gives up is a change of line endings alone, which alters nothing a
// copy runs or says. An LF tree hashes as before, so older copies still agree.
const isBinary = (buf) => buf.includes(0);
const normalised = (buf) => (isBinary(buf) ? buf : Buffer.from(buf.toString('latin1').replaceAll('\r\n', '\n'), 'latin1'));

// The git hooks, which must be executable as committed (the self-test holds
// them to it). Windows records no executable bit, so a tree committed there
// carries them as 644 unless they are marked by name.
export const gitHookPaths = (root) => {
  const dir = join(root, '.claude', 'hooks', 'git');
  return existsSync(dir) ? readdirSync(dir).filter((f) => !f.includes('.')).map((f) => `.claude/hooks/git/${f}`) : [];
};

export function hashTree(root, files) {
  const out = {};
  // A link is hashed by where it points, never by following it (C12).
  for (const f of files) out[f] = isLink(root, f) ? sha256(`link:${readlinkSync(join(root, f))}`) : sha256(normalised(readFileSync(join(root, f))));
  return out;
}

/** One digest for the whole release: every path and its hash, in order. */
export function fingerprint(files) {
  return sha256(
    Object.keys(files)
      .sort()
      .map((p) => `${p}\0${files[p]}\n`)
      .join(''),
  );
}

// Crockford base32 without the letters people misread (I, L, O, U).
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Four characters a person types to approve this exact release. */
export function approvalCode(fp) {
  const n = parseInt(fp.slice(0, 8), 16);
  let s = '';
  for (let i = 0; i < 4; i += 1) s += B32[(n >>> (i * 5)) & 31];
  return s;
}

// The code's alphabet has no I, L, O or U, so a person who reads a 1 as I or L,
// or a 0 as O, means the digit (edge cases, 2026-10-29, B2). One reading for the
// typed-phrase hook and a first install's typed argument (round 2, C6).
export const normaliseCode = (c) => String(c).toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
/** A typed phrase with its last word, the code, read as the code's alphabet. */
export const normalisePhrase = (phrase) => {
  const words = String(phrase ?? '').trim().split(/\s+/);
  words[words.length - 1] = normaliseCode(words.at(-1));
  return words.join(' ');
};

export const releasePhrase = (version, code) => `RELEASE v${version} ${code}`;
export const updatePhrase = (version, code) => `update to version ${version} ${code}`;

/** The bytes the signature covers: release.json with its keys in a fixed order. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function verifySignature(releaseJson, sigB64, publicKeyPem) {
  try {
    const key = createPublicKey(publicKeyPem);
    return verifySig(null, Buffer.from(canonical(releaseJson)), key, Buffer.from(sigB64.trim(), 'base64'));
  } catch {
    return false;
  }
}

/** Compare dotted versions: 1 when a > b, -1 when a < b, 0 when equal. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ── what a release may not do ───────────────────────────────────────────────

// Code that can reach outside the machine. A new occurrence in a release blocks
// it unless the signed release declares that exact line.
const OUTWARD = [
  [/\bfetch\s*\(/, 'a network request (fetch)'],
  [/\b(curl|wget|nc|ncat|scp|rsync|ssh)\s/, 'a network command'],
  [/\bgit\s+(push|remote)\b/, 'a git push or remote change'],
  [/\bchild_process\b/, 'a new way to run commands'],
  [/\b(https?|net|tls|dgram|dns)\.(request|get|connect|createConnection|lookup|resolve)\b/, 'a network call'],
  [/\b(XMLHttpRequest|WebSocket|EventSource)\b/, 'a network connection'],
  [/\bsendBeacon\b/, 'a network beacon'],
  [/https?:\/\/(?!github\.com\/|api\.github\.com\/|claude\.ai\/|code\.claude\.com\/|docs\.anthropic\.com\/|localhost[:/]|127\.0\.0\.1)[^\s'"`)]+/, 'a web address'],
];
const CODE = /\.(mjs|cjs|js|jsx|ts|tsx|sh|json|ya?ml)$|(^|\/)(pre-commit|commit-msg)$/;

const lines = (text) => new Set(String(text).split('\n').map((l) => l.trim()).filter(Boolean));

/** New outward-reaching lines in `next` that `prev` did not have. */
export function outwardFindings(path, prev, next, declared = []) {
  if (!CODE.test(path)) return [];
  const before = lines(prev);
  const found = [];
  for (const line of lines(next)) {
    if (before.has(line)) continue;
    for (const [re, what] of OUTWARD) {
      if (re.test(line) && !declared.some((d) => d.file === path && line.includes(d.line))) {
        found.push(`${path}: ${what}: ${line.slice(0, 120)}`);
        break;
      }
    }
  }
  return found;
}

// The safety floor. What must survive every release, unless the release
// declares a change to it, and even then the crisis numbers must stay.
// The safety surface: what decides what a person in distress is told. The same
// list as SURFACE in hooks/git/pre-commit and hooks/safety/safety-at-stop.mjs,
// so a release is held to what the repository holds a commit to. Any change to
// one of these must be declared, and the developer's release gate then asks
// for a passing crisis evaluation of it. The old path stays listed here alone
// (FND-010), so a release that puts a copy back in .claude/ must declare it.
export const SAFETY_SURFACE = [
  'CLAUDE.md',
  'AGENTS.md',
  '.claude/CLAUDE.md',
  '.claude/hooks/safety/',
  '.claude/skills/first-contact/',
  '.claude/jobs/check-in.md',
  'ux/lib/safety.mjs',
  'ux/scripts/check-safety.mjs',
];
export const onSurface = (path) => SAFETY_SURFACE.some((s) => (s.endsWith('/') ? path.startsWith(s) : path === s));

export const FLOOR_FILES = /^\.claude\/hooks\/(safety|privacy|record)\/|^\.claude\/hooks\/git\/(pre-commit|commit-msg)$|^ux\/lib\/safety\.mjs$|^ux\/scripts\/check-safety\.mjs$/;
export const CRISIS_WORDS = ['1767', '995', '1771', 'Are you safe right now?', "I'm an AI, not a person"];
// A number word counts as present when Singapore's number or her plan's for
// the same role is there (SAF-016): `roles` is roleNumbers() of her plan, and
// without it Singapore's alone, exactly as before.
export const crisisWordIn = (text, word, roles) => carriesCrisisWord(text, word, roles);

// The instruction file moves from .claude/ to the root (FND-010), so a copy on
// either side must judge a release on the other. Claude Code loads every one
// present, so a release is held to each of them; the copy's own is the first
// present, root first.
export const INSTRUCTION_PATHS = ['CLAUDE.md', '.claude/CLAUDE.md'];
export const instructionFiles = (read) => INSTRUCTION_PATHS.map((path) => [path, read(path)]).filter(([, text]) => text);
export const instructionsOf = (read) => instructionFiles(read)[0]?.[1] ?? '';

export function crisisSection(claudeMd) {
  const m = String(claudeMd).match(/### Crisis[\s\S]*?(?=\n### Everything else is a skill)/);
  return m ? m[0] : '';
}

function settingsOf(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hookCommands(settings) {
  const out = new Set();
  for (const groups of Object.values(settings?.hooks ?? {})) {
    for (const g of groups) for (const h of g.hooks ?? []) if (h.command) out.add(h.command);
  }
  return out;
}

/**
 * Everything that would weaken the safety floor or widen what the copy can do.
 * `cur` and `next` read a file's text by path, '' when absent; the two lists
 * are each side's files. `roles` is her plan's numbers by role (roleNumbers),
 * so a crisis section giving her country's lines in Singapore's place still
 * counts as whole; left out, Singapore's alone.
 */
export function floorFindings(cur, next, curFiles, nextFiles, declared = {}, roles = undefined) {
  // A job file's run record (when it last ran, who ran it) is the copy's own,
  // rewritten by every heartbeat: it differs from any release's, so check-in.md
  // read as a changed safety surface at every update (round 3, D1).
  const same = (path) => (isJobFile(path) ? withoutRecord(cur(path)) === withoutRecord(next(path)) : cur(path) === next(path));
  const found = [];
  const safetyCore = declared.safetyCore === true;

  const crisisNow = crisisSection(instructionsOf(cur));
  const nextInstructions = instructionFiles(next);
  if (!nextInstructions.length) found.push('the crisis section of CLAUDE.md is missing');
  for (const [path, text] of nextInstructions) {
    const crisisNext = crisisSection(text);
    if (!crisisNext) found.push(`the crisis section of ${path} is missing`);
    else if (crisisNow && crisisNext !== crisisNow && !safetyCore) found.push(`the crisis section of ${path} changed without being declared`);
    for (const w of CRISIS_WORDS) if (crisisWordIn(crisisNow, w, roles) && !crisisWordIn(crisisNext, w, roles)) found.push(`the crisis section of ${path} lost "${w}"`);
  }

  const sNow = settingsOf(cur('.claude/settings.json'));
  const sNext = settingsOf(next('.claude/settings.json'));
  if (!sNext) found.push('settings.json is missing or unreadable');
  else if (sNow) {
    const denyNext = new Set(sNext.permissions?.deny ?? []);
    for (const d of sNow.permissions?.deny ?? []) if (!denyNext.has(d)) found.push(`a blocked command was unblocked: ${d}`);
    const allowNow = new Set(sNow.permissions?.allow ?? []);
    for (const a of sNext.permissions?.allow ?? []) if (!allowNow.has(a)) found.push(`a new permission was granted: ${a}`);
    const hooksNext = hookCommands(sNext);
    for (const h of hookCommands(sNow)) {
      if (/hooks\/(safety|privacy|record)\/|hooks\/update\//.test(h) && !hooksNext.has(h)) found.push(`a guard was unwired: ${h}`);
    }
    if (JSON.stringify(sNext.env ?? {}) !== JSON.stringify(sNow.env ?? {})) found.push('the environment settings changed');
  }

  const nextSet = new Set(nextFiles);
  for (const path of curFiles.filter((f) => FLOOR_FILES.test(f))) {
    if (!nextSet.has(path)) found.push(`a guard file was removed: ${path}`);
  }
  if (!safetyCore) {
    for (const path of new Set([...curFiles, ...nextFiles])) {
      if (onSurface(path) && !same(path)) found.push(`the safety surface changed without being declared: ${path}`);
    }
  }

  // The key every later release is checked against never changes in a release:
  // a hijacker holding a key of their own would otherwise swap it in. Only a
  // rekey (update.mjs rekey), trusted by the fingerprint the developer sent the
  // person directly, may bring a new one; `rekey` is set by the copy, never read
  // from the release (round 3, D5).
  const KEY = '.claude/release/release-key.pub';
  if (cur(KEY) && next(KEY) !== cur(KEY) && !(declared.rekey === true && next(KEY))) found.push('the release key changed');

  // The checker itself changes only with the developer's declaration.
  for (const path of nextFiles) {
    if (/^\.claude\/hooks\/lib\/update\//.test(path) && cur(path) && cur(path) !== next(path) && !declared.updater) {
      found.push(`the update checker changed without being declared: ${path}`);
    }
  }
  return found;
}

/**
 * What a copy at `installedVersion` takes as declared: this release's own
 * declarations and those of every release after the installed one, which it
 * carries in `history`. Each release declared only its changes since the one
 * before, so a copy that skipped one was held back for good (round 3, D3).
 * `rekey` is never taken from a release: only the copy's rekey command sets it.
 */
export function declaredSince(release, installedVersion) {
  const all = [release?.declared ?? {}, ...(release?.history ?? []).filter((h) => compareVersions(h?.version ?? '0', installedVersion) > 0).map((h) => h.declared ?? {})];
  const out = {};
  for (const d of all) {
    if (d.safetyCore === true) out.safetyCore = true;
    if (d.updater === true) out.updater = true;
    if (Array.isArray(d.outward) && d.outward.length) out.outward = [...(out.outward ?? []), ...d.outward];
  }
  return out;
}

// ── job run state ───────────────────────────────────────────────────────────

/** A heartbeat job's file, whose front matter carries the copy's run record. */
export const isJobFile = (path) => /^\.claude\/jobs\/[^/]+\.md$/.test(path);

const frontMatter = (text) => /^---\n([\s\S]*?)\n---\n/.exec(String(text ?? '').replace(/\r\n/g, '\n'));
const recordKey = (line) => RECORD_KEYS.find((k) => line.startsWith(`${k}:`));

/**
 * `target` with the run record lines of `source`: each record line of the
 * target takes the source's value for that key, or goes when the source has
 * none, and any the source has beyond those join the end of the front matter.
 * An update writes a job's instructions, never when it last ran here: one that
 * wrote the release's run record conflicted with the copy's next heartbeat,
 * and going back over the update was then refused (round 3, D1).
 */
export function withRecordOf(target, source) {
  const t = String(target ?? '').replace(/\r\n/g, '\n');
  const m = frontMatter(t);
  const src = frontMatter(source);
  if (!m) return t;
  const theirs = new Map((src ? src[1].split('\n') : []).filter(recordKey).map((l) => [recordKey(l), l]));
  const used = new Set();
  const lines = [];
  for (const line of m[1].split('\n')) {
    const k = recordKey(line);
    if (!k) lines.push(line);
    else if (theirs.has(k)) {
      lines.push(theirs.get(k));
      used.add(k);
    }
  }
  for (const [k, l] of theirs) if (!used.has(k)) lines.push(l);
  return `---\n${lines.join('\n')}\n---\n${t.slice(m[0].length)}`;
}

/**
 * A job file as a release ships it: never run. A release cut while a heartbeat
 * held its claim shipped `status: running`, and every copy taking it stood its
 * runs down for hours and counted a failure (round 3, D25).
 */
export function resetRunState(text) {
  const m = frontMatter(text);
  if (!m || !m[1].split('\n').some(recordKey)) return text;
  const present = new Set(m[1].split('\n').map(recordKey).filter(Boolean));
  return withRecordOf(text, `---\n${['status: never', 'failures: 0'].filter((l) => present.has(recordKey(l))).join('\n')}\n---\n`);
}

/**
 * What an update would overwrite or remove that this copy changed itself: each
 * file the release writes or drops whose file here is no longer the one it was
 * installed as (`installedFiles`, the installed manifest's path → hash), or, for
 * one the manifest never listed, is not the release's own. A job file is read as
 * a release ships it, so its run record is never a change of the copy's. With no
 * manifest (a first install replaces machinery of another shape) there is
 * nothing to compare: []. Set-up's update step names these as replaced before
 * the phrase; until this, that rested on reading the copy's log by hand.
 */
export function ownChanges(root, installedFiles, releaseFiles) {
  if (!installedFiles) return [];
  // A job file is read both ways a release has shipped one: its record reset to
  // never (up to 2026-11-02), and with no record at all (since, when the record
  // moved to .claude/jobs/state.json). Either matching is not a change of hers.
  const here = (f) => {
    if (isLink(root, f)) return [hashTree(root, [f])[f]];
    const buf = readFileSync(join(root, f));
    if (!isJobFile(f)) return [sha256(normalised(buf))];
    const text = buf.toString('utf8');
    return [resetRunState(text), withoutRecord(text)].map((t) => sha256(normalised(Buffer.from(t, 'utf8'))));
  };
  const paths = [...new Set([...Object.keys(installedFiles), ...Object.keys(releaseFiles ?? {})])].sort();
  return paths.filter((f) => {
    if (!touchable(f) || !(existsSync(join(root, f)) || isLink(root, f))) return false;
    const now = here(f);
    const next = releaseFiles?.[f];
    if (f in installedFiles) return !now.includes(installedFiles[f]) && !now.includes(next);
    return next !== undefined && !now.includes(next);
  });
}

export const readOr = (root) => (path) => {
  const abs = join(root, path);
  try {
    // LF, as hashTree reads it: the floor compares text across a CRLF copy and an LF release.
    return existsSync(abs) ? readFileSync(abs, 'utf8').replaceAll('\r\n', '\n') : '';
  } catch {
    return '';
  }
};
