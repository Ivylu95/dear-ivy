#!/usr/bin/env node
// The person's side of a harness release: fetch, judge, apply, undo.
//
//   DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs check    what the newest release is
//   DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs fetch    fetch it into quarantine, then verify
//   node .claude/hooks/lib/update/update.mjs verify    judge what is in quarantine (fetch runs this)
//   node .claude/hooks/lib/update/update.mjs apply     after the person typed the phrase verify printed
//   node .claude/hooks/lib/update/update.mjs rollback  undo the last update
//   node .claude/hooks/lib/update/update.mjs status    which version is installed
//   node <candidate>/.claude/hooks/lib/update/update.mjs install <fingerprint>   first install only
//   DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs fetch <version>   one release in particular
//   DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs rekey <fingerprint> [<version>]
//       the release that brings a new release key, trusted like a first install:
//       by the fingerprint the developer sent the person directly, then her phrase
//
// The key is read from its own variable, used for this one fetch, and written
// nowhere (guard-secrets.mjs refuses any other way of carrying it). The source
// is the address pinned for this copy (lib/release-source.mjs: the record's
// data/core/setup/release-source.json, else .claude/release/source.json), never one from a chat.
//
// Everything is judged by this copy's own code, before anything from the
// release runs: signature, fingerprints, the paths it touches, anything new
// that reaches outward, anything that weakens the safety floor. Only then is it
// test-run, on a throwaway copy holding a blank record. Only then is the person
// asked to type the phrase, and only their typed phrase lets it in. Each step
// forward is a commit that can be reverted; history is never rewritten.

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELEASE_DIR, approvalCode, compareVersions, fingerprint, floorFindings, gitHookPaths, hashTree, isLink, listFiles, normalisePhrase, outwardFindings,
  readOr, touchable, updatePhrase, verifySignature, crisisSection, instructionFiles, CRISIS_WORDS, INSTRUCTION_PATHS, crisisWordIn,
  declaredSince, isJobFile, ownChanges, withRecordOf,
} from './release-lib.mjs';
import { runRecordOnly } from '../hazard-log.mjs';
import { planPath, roleNumbers } from '../everyday-reply.mjs';
import { forgetRefused } from '../refused-staged.mjs';
import { releaseRepo } from '../release-source.mjs';
import { PHRASE_MARKER } from './secrets.mjs';

// A first install runs this file from the quarantine (temp/update/candidate), with
// no CLAUDE_PROJECT_DIR in a terminal or a Bash call: the copy is then three folders
// up, not the candidate (rehearsal 2026-10-27: "nothing fetched", every time).
const here = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const root = process.env.CLAUDE_PROJECT_DIR || (/[\\/]temp[\\/]update[\\/]candidate$/.test(here) ? resolve(here, '../../..') : here);
const releaseHome = join(root, '.claude', 'release');
const work = join(root, 'temp', 'update');
const candidate = join(work, 'candidate');
const verdictPath = join(work, 'verdict.json');
const installedPath = join(releaseHome, 'installed.json');
const logPath = join(releaseHome, 'update-log.jsonl');

const say = (msg) => console.log(msg);
const die = (msg) => {
  console.error(`update: ${msg}`);
  process.exit(1);
};
const git = (args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...opts }).trim();
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};
const log = (entry) => {
  mkdirSync(releaseHome, { recursive: true });
  appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
};
const installed = () => readJson(installedPath)?.version ?? '0';

function source() {
  const repo = releaseRepo(root);
  if (!repo) die('no release source is set up in this copy yet (data/core/setup/release-source.json)');
  return repo;
}

// The key as an HTTP header, handed to git through its environment: never on
// a command line another process can read, never in git's settings.
function gitEnv() {
  const key = process.env.DEAR_RELEASE_KEY ?? '';
  if (!key) die('no key given: the person pastes the key they were sent');
  const basic = Buffer.from(`x-access-token:${key}`).toString('base64');
  return {
    ...process.env,
    DEAR_RELEASE_KEY: '',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}

// A key pasted twice, cut short or revoked once threw from git with no log and no
// plain word (edge cases, 2026-10-29, B3). git's own message is not printed: it
// names the address, never the key, but it is not hers to read.
const refused = () => {
  log({ event: 'key refused' });
  die('the release source refused the key, or could not be reached; nothing changed. Ask the person once to paste the key again, exactly as sent.');
};

function remoteVersions(env) {
  let out;
  try {
    out = execFileSync('git', ['ls-remote', '--tags', source()], { cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    refused();
  }
  return [...out.matchAll(/refs\/tags\/v(\d+(?:\.\d+)*)$/gm)].map((m) => m[1]).sort(compareVersions);
}

// Every file in quarantine dated now. tar keeps the release commit's date, so a
// release published more than a week before it was fetched was swept from temp/
// by the next session start, or by the in-place self-test's own sweep, which
// failed the test and rolled every such update back (edge cases, 2026-10-29, B5).
function freshen(dir) {
  const now = new Date();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) utimesSync(p, now, now);
    }
  };
  if (existsSync(dir)) walk(dir);
}

// ── verify ──────────────────────────────────────────────────────────────────

// `pinned`: on a first install only, the fingerprint the developer sent the
// person directly. A copy installed before the updater existed has no key and
// no checker of its own, so trust starts from what the developer handed over
// outside the download: the release must match it exactly, and its own key
// must verify its own signature. From then on the key is this copy's.
// `rekey`: the same trust for a copy that has the updater, when the developer's
// key has changed. Every other check runs as for any update, against this copy;
// only the key may change. A copy once had no way to take a new key at all: the
// floor refused it, and a first install refused a copy with the updater (D5).
function verify(pinned = null, rekey = false) {
  const first = Boolean(pinned) && !rekey;
  // Here, not only after fetch: a first install's candidate is unpacked by the
  // paste-in message, with tar, and reaches this copy's checks only through here.
  freshen(candidate);
  const release = readJson(join(candidate, RELEASE_DIR, 'release.json'));
  const sig = existsSync(join(candidate, RELEASE_DIR, 'release.sig')) ? readFileSync(join(candidate, RELEASE_DIR, 'release.sig'), 'utf8') : '';
  const keyHome = pinned ? join(candidate, '.claude', 'release') : releaseHome;
  const pub = existsSync(join(keyHome, 'release-key.pub')) ? readFileSync(join(keyHome, 'release-key.pub'), 'utf8') : '';
  const failures = [];
  const fail = (check, detail) => failures.push({ check, detail });
  const policies = [];
  const replaced = [];

  // 1. Is it the developer's? Signed by the key this copy has held since install.
  if (!release) fail('signature', 'the release carries no release.json');
  else if (!pub) fail('signature', 'this copy holds no release key to check against');
  else if (!verifySignature(release, sig, pub)) fail('signature', 'the signature does not match the developer\'s key');

  if (pinned && release && release.fingerprint !== pinned) fail('signature', 'the release is not the one the developer sent the fingerprint for');
  if (first && existsSync(installedPath)) fail('version', 'this copy already has the updater: use fetch, not a first install');
  if (rekey && !existsSync(join(root, '.claude', 'hooks', 'lib', 'update', 'release-lib.mjs'))) fail('version', 'this copy has no updater yet: a first install, not a rekey');

  if (release && !failures.length) {
    // 2. Whole, unchanged and newer.
    const files = listFiles(candidate).filter((f) => !f.startsWith(`${RELEASE_DIR}/`));
    // A link is never a file a release may carry: copied in, it could point a
    // write into her record, and a dangling one once killed verify (C12).
    for (const f of files) if (isLink(candidate, f)) fail('lane', `${f} is a link, which a release may not carry`);
    const hashes = hashTree(candidate, files);
    const listed = Object.keys(release.files ?? {});
    for (const f of files) if (release.files?.[f] !== hashes[f]) fail('fingerprints', `${f} is not the file the release lists`);
    for (const f of listed) if (!(f in hashes)) fail('fingerprints', `${f} is listed but missing`);
    if (fingerprint(release.files ?? {}) !== release.fingerprint) fail('fingerprints', 'the release fingerprint does not add up');
    if (compareVersions(release.version, installed()) <= 0) fail('version', `v${release.version} is not newer than the installed v${installed()}`);

    // 3. Stays in its lane: never the record, the local layer, git or secrets.
    for (const f of files) if (!touchable(f)) fail('lane', `${f} is outside what a release may touch`);

    // 4. Reaches outward, 5. weakens the floor: judged against this copy, now.
    // A first install replaces machinery of another shape, with nothing of its
    // own to compare against: its trust is the fingerprint the developer sent,
    // so it is not diffed for outward reach. The crisis floor must still be whole.
    const cur = first ? () => '' : readOr(root);
    const next = readOr(candidate);
    // Every release's declarations since the installed one, so a copy that
    // skipped a release is not held back for its changes (round 3, D3).
    const declared = declaredSince(release, installed());
    if (!first) for (const f of files) for (const d of outwardFindings(f, cur(f), next(f), declared.outward ?? [])) fail('outward', d);
    const curFiles = first ? [] : git(['ls-files']).split('\n').filter(Boolean);
    // A first install replaces the whole surface by design: it is held to the
    // crisis words below, not to a diff against machinery of another shape.
    const asDeclared = first ? { ...declared, safetyCore: true } : rekey ? { ...declared, rekey: true } : declared;
    // Her plan's numbers count in Singapore's place (SAF-016); only its number lines are read.
    const roles = roleNumbers(planPath(root));
    for (const d of floorFindings(cur, next, curFiles, files, asDeclared, roles)) fail('floor', d);
    const present = instructionFiles(next);
    if (!present.length) fail('floor', 'the crisis section of CLAUDE.md is missing');
    for (const [path, text] of present) {
      const crisis = crisisSection(text);
      for (const w of CRISIS_WORDS) if (!crisisWordIn(crisis, w, roles)) fail('floor', `the crisis section of ${path} lacks "${w}"`);
    }
    // Not a failure: her terms say she is told before a change to them applies
    // (TERMS_OF_USE), so the policies it changes are named before the phrase (D24).
    if (!first) policies.push(...[...new Set([...curFiles, ...files])].filter((f) => f.startsWith('policies/') && cur(f) !== next(f)).sort());
    // Not a failure either: what this copy changed itself since its installed
    // release and the update would overwrite or remove (kept in its history),
    // named before the phrase so set-up's step 4 rests on code, not on a log
    // read by hand.
    if (!first) replaced.push(...ownChanges(root, readJson(installedPath)?.files, release.files));
  }

  // 6. Works: only now does any of its code run, on a blank record.
  if (!failures.length) {
    const trial = join(work, 'trial');
    rmSync(trial, { recursive: true, force: true });
    cpSync(candidate, trial, { recursive: true });
    rmSync(join(trial, RELEASE_DIR), { recursive: true, force: true });
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, CLAUDE_PROJECT_DIR: trial };
    const run = (cmd, args) => spawnSync(cmd, args, { cwd: trial, encoding: 'utf8', env, timeout: 300000 });
    run('node', ['-e', "import('./.claude/hooks/lib/sandbox.mjs').then((m) => m.buildBlankRecord('data'))"]);
    run('git', ['init', '-q']);
    run('git', ['add', '-A']);
    run('git', ['update-index', '--chmod=+x', '--', ...gitHookPaths(trial)]);
    run('git', ['-c', 'user.email=trial@local', '-c', 'user.name=trial', 'commit', '-q', '--no-verify', '-m', 'trial']);
    const self = run('node', ['.claude/hooks/selftest.mjs']);
    if (self.status !== 0) {
      const lines = `${self.stdout}${self.stderr}`.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 5);
      fail('works', lines.join('; ') || 'the hook self-test did not pass');
    }
    rmSync(trial, { recursive: true, force: true });
  }

  const verdict = {
    at: new Date().toISOString(),
    version: release?.version ?? null,
    fingerprint: release?.fingerprint ?? null,
    ok: failures.length === 0,
    failures,
    notes: release?.notes ?? '',
    phrase: failures.length ? null : updatePhrase(release.version, approvalCode(release.fingerprint)),
    firstInstall: first,
    rekey,
    policies,
    replaced,
  };
  writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`);
  if (!verdict.ok) {
    log({ event: 'held back', version: verdict.version, failures });
    rmSync(candidate, { recursive: true, force: true });
    say(`HELD BACK: v${verdict.version ?? '?'} did not pass its checks and was discarded. Logged.`);
    for (const f of failures.slice(0, 8)) say(`  - ${f.check}: ${f.detail}`);
    say('Tell the person, in one plain line, that an update was held back because it did not pass its safety checks, and to let whoever set this up know.');
    process.exit(2);
  }
  say(`PASSED: v${verdict.version} passed every check.`);
  if (verdict.notes) say(`What it changes: ${verdict.notes}`);
  if (rekey) say('It brings a new release key, matched to the fingerprint the developer sent.');
  if (policies.length) {
    say(`It changes her policies: ${policies.join(', ')}.`);
    say('Name that to the person on its own line, in plain words, before the phrase: her terms promise she is told before a change to them applies.');
  }
  if (replaced.length) {
    say(`It replaces changes made in this copy since v${installed()}: ${replaced.join(', ')}.`);
    say('Name them to the person as replaced (kept in the history), unless she wants one kept: then it moves into a local- skill first, which no update touches.');
  }
  say(`\nThe person types, exactly and on its own line:\n\n  ${verdict.phrase}\n`);
}

// ── apply ───────────────────────────────────────────────────────────────────

function typedPhrase() {
  const session = (process.env.CLAUDE_CODE_SESSION_ID || '').replace(/[^\w-]/g, '');
  return readJson(join(root, '.claude', 'hooks', 'state', `${PHRASE_MARKER}${session}`));
}

// The failing cases, [] when the self-test passes: logged with a roll-back, so
// whoever set this up can see what failed in place.
function selftestFailures() {
  const r = spawnSync('node', ['.claude/hooks/selftest.mjs'], { cwd: root, encoding: 'utf8', timeout: 300000 });
  if (r.status === 0) return [];
  const lines = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').filter((l) => /FAIL/.test(l)).map((l) => l.trim().slice(0, 160)).slice(0, 5);
  return lines.length ? lines : ['the hook self-test did not pass'];
}

function apply(typedArg) {
  const verdict = readJson(verdictPath);
  if (!verdict?.ok) die('nothing has passed its checks: fetch first');
  const release = readJson(join(candidate, RELEASE_DIR, 'release.json'));
  if (!release || release.fingerprint !== verdict.fingerprint) die('what is in quarantine is not what was checked: fetch again');
  // A first install runs on a copy with no hook to record the typed phrase,
  // so the phrase she typed is passed in, word for word. Weaker, once only. Its
  // code is read as the hook reads it, an I or L as 1 and an O as 0 (C6).
  const typed = verdict.firstInstall ? { phrase: normalisePhrase(typedArg), at: new Date().toISOString() } : typedPhrase();
  if (!typed || String(typed.phrase).trim().toLowerCase() !== verdict.phrase.toLowerCase() || typed.at < verdict.at) {
    die(`the person has not typed "${verdict.phrase}" since it was checked; nothing changed`);
  }

  const files = Object.keys(release.files);
  const previous = readJson(installedPath);
  const removed = Object.keys(previous?.files ?? {}).filter((f) => !(f in release.files) && touchable(f) && existsSync(join(root, f)));
  // FND-010: the instruction file moved to the root. A copy installed before
  // that (a first install has no previous manifest) keeps the old one, and
  // Claude Code would load both, so it goes when the release carries the new.
  const [rootFile, oldFile] = INSTRUCTION_PATHS;
  if (rootFile in release.files && !(oldFile in release.files) && !removed.includes(oldFile) && git(['ls-files', '--', oldFile])) removed.push(oldFile);
  const head = git(['rev-parse', 'HEAD']);
  const tag = `before-v${release.version}`;

  // The update is a commit of its own. Anything else staged went into it, and
  // going back over the update then took that too: a staged record file once left
  // with a revert (round 2, 2026-10-29, C8). Refused before anything is written.
  const ours = new Set([...files, '.claude/release/installed.json', ...removed]);
  const others = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter((f) => f && !ours.has(f));
  if (others.length) {
    log({ event: 'update refused', version: release.version, why: 'something else was staged' });
    die(`${others.length} other file(s) are staged to be saved here, and an update goes in a commit of its own. Save them (commit) first, then apply again; nothing changed.`);
  }

  // Each file it writes, as it was, so a commit the copy's own gate refuses can
  // be put back exactly: a refusal once threw, leaving the update staged and
  // the tag behind (edge cases, 2026-10-29, B10). The tag is now made only once
  // the update has passed in place, so a refusal leaves none to remove.
  const written = [...files, '.claude/release/installed.json'];
  const was = new Map(written.map((f) => {
    const p = join(root, f);
    return [f, existsSync(p) ? { bytes: readFileSync(p), mode: statSync(p).mode } : null];
  }));
  // The folders the update makes, so a put-back leaves none behind empty (C-small).
  const madeDirs = [];
  const makeDir = (d) => {
    const missing = [];
    for (let at = d; at.length > root.length && !existsSync(at); at = dirname(at)) missing.push(at);
    mkdirSync(d, { recursive: true });
    madeDirs.push(...missing);
  };
  const putBack = () => {
    spawnSync('git', ['reset', '-q', 'HEAD', '--', ...written, ...removed], { cwd: root });
    for (const [f, old] of was) {
      const p = join(root, f);
      if (!old) {
        rmSync(p, { force: true });
        continue;
      }
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, old.bytes);
      chmodSync(p, old.mode);
    }
    if (removed.length) spawnSync('git', ['checkout', 'HEAD', '--', ...removed], { cwd: root });
    // Deepest first, and only while empty.
    for (const d of [...new Set(madeDirs)].sort((a, b) => b.length - a.length)) {
      try {
        if (!readdirSync(d).length) rmSync(d, { recursive: true });
      } catch {
        // already gone
      }
    }
    // The gate remembers what its refusal left staged; nothing is now.
    forgetRefused([...written, ...removed], root);
  };

  // The update's commit is built in an index of its own, holding HEAD and only
  // the update's paths: a record save that staged a file after the check above
  // would otherwise ride into it, and be undone with it (round 3, B6).
  const ownIndex = resolve(root, git(['rev-parse', '--git-path', 'dear-update-index']));
  const inOwn = { env: { ...process.env, GIT_INDEX_FILE: ownIndex } };
  try {
    for (const f of files) {
      makeDir(dirname(join(root, f)));
      cpSync(join(candidate, f), join(root, f));
      // A job's run record is this copy's, never the release's (round 3, D1).
      const old = was.get(f);
      if (isJobFile(f) && old) writeFileSync(join(root, f), withRecordOf(readFileSync(join(root, f), 'utf8'), old.bytes.toString('utf8')));
    }
    for (const f of removed) rmSync(join(root, f), { force: true });
    mkdirSync(releaseHome, { recursive: true });
    writeFileSync(installedPath, `${JSON.stringify(release, null, 2)}\n`);
    rmSync(ownIndex, { force: true });
    git(['read-tree', 'HEAD'], inOwn);
    git(['add', '--', ...files, '.claude/release/installed.json'], inOwn);
    if (removed.length) git(['rm', '-q', '--cached', '--ignore-unmatch', '--', ...removed], inOwn);
    // A hook new to this copy is added as 644 on Windows, and git would not run it elsewhere.
    const hooks = gitHookPaths(root);
    if (hooks.length) git(['update-index', '--chmod=+x', '--', ...hooks], inOwn);
    git(['commit', '-q', '-m', `harness: update to v${release.version}`, '-m', `fingerprint ${release.fingerprint}\napproved by the typed phrase "${verdict.phrase}"`], { ...inOwn, stdio: ['ignore', 'pipe', 'pipe'] });
    rmSync(ownIndex, { force: true });
    // The working index catches up with the commit for the update's paths only.
    spawnSync('git', ['reset', '-q', 'HEAD', '--', ...written, ...removed], { cwd: root });
  } catch {
    rmSync(ownIndex, { force: true });
    putBack();
    log({ event: 'refused at commit', version: release.version, why: 'this copy\'s own commit checks refused the update' });
    say(`NOT APPLIED: v${release.version} could not be committed here (this copy's own checks refused it), so everything was put back as it was. Logged.`);
    say('Tell the person, in one plain line, that the update did not take and nothing changed for them, and let whoever set this up know.');
    process.exit(2);
  }
  // The update's own commit, named now: the self-test takes a minute or more, a
  // record save landing meanwhile became HEAD, and reverting HEAD undid her
  // entry instead of the update (round 3, B6).
  const mine = git(['rev-parse', 'HEAD']);
  // Tagged only once it has passed in place: one rolled back here once left its
  // before-v tag, marking a "before" of an update that never stayed (round 2, C-small).
  const failing = selftestFailures();
  if (failing.length) {
    try {
      git(['revert', '--no-edit', mine], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      spawnSync('git', ['revert', '--abort'], { cwd: root, stdio: 'ignore' });
      log({ event: 'not rolled back', version: release.version, why: 'the self-test failed once applied, and undoing it was refused' });
      say(`FAILED IN PLACE: v${release.version} went in but failed its tests in place, and could not be undone here. Logged.`);
      say('Tell the person, in one plain line, that the update did not go well and whoever set this up will sort it; then let the developer know (rollback, once whatever blocked it is saved).');
      process.exit(2);
    }
    log({ event: 'rolled back', version: release.version, why: 'the self-test failed once applied', failing });
    say(`ROLLED BACK: v${release.version} went in but failed its tests in place, so it was undone. Logged.`);
    say('Tell the person, in one plain line, that the update did not take and nothing changed for them.');
    process.exit(2);
  }
  if (!git(['tag', '--list', tag])) git(['tag', tag, head]);
  log({ event: 'updated', from: previous?.version ?? 'unreleased', to: release.version });
  rmSync(work, { recursive: true, force: true });
  say(`UPDATED to v${release.version}. Commit the update log and push, then tell the person in one plain line.`);
}

function rollback() {
  // The update that brought the installed version, never any update: a second
  // going back once picked the same, already undone, commit again and git threw
  // (edge cases, 2026-10-29, B6).
  const version = installed();
  const subject = `harness: update to v${version}`;
  const sha = version === '0' ? '' : git(['log', '--format=%H', `--grep=^${subject.replace(/\./g, '\\.')}$`, '-n', '1']);
  if (!sha) die('no update to undo');
  // A first install has the same subject, and it brought the updater itself:
  // undoing it left a copy that could never update again (B9). Known by the
  // updater arriving in it: a copy made by new-copy before it wrote
  // installed.json read its first ordinary update as a first install (D23).
  if (spawnSync('git', ['cat-file', '-e', `${sha}^:.claude/hooks/lib/update/update.mjs`], { cwd: root }).status !== 0) {
    log({ event: 'undo refused', update: subject, why: 'it was the first install' });
    die(`v${version} was this copy's first install, which brought the updater itself; going back over it would leave the copy unable to update. Nothing changed.`);
  }
  // Anything staged makes git refuse the revert, which once read as a conflict
  // with a later change (round 2, 2026-10-29, C-small): said as what it is.
  const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  if (staged.length) {
    log({ event: 'undo refused', update: subject, why: 'something was staged' });
    die(`${staged.length} file(s) are staged to be saved here, and going back is a commit of its own. Save them (commit) first, then go back again; nothing changed.`);
  }
  // A heartbeat job's run record is rewritten by every run, so after an update
  // the copy's own heartbeats touch the files it changed: going back was refused
  // after a single run (round 3, D1). A job file changed since only in its run
  // record is settled here: the instructions go back, the run record stays as
  // the copy's heartbeats left it.
  const show = (spec) => {
    const r = spawnSync('git', ['show', spec], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  };
  const jobs = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(isJobFile);
  const runNow = new Map(jobs.map((f) => [f, show(`HEAD:${f}`)]));
  const abandon = (why, message) => {
    spawnSync('git', ['revert', '--abort'], { cwd: root, stdio: 'ignore' });
    log({ event: 'undo refused', update: subject, why });
    die(message);
  };
  const conflict = () => abandon('it did not revert cleanly', `could not undo cleanly: a later change here touches what v${version} changed. Nothing changed.`);
  // A later change to the same lines makes the undo conflict: it is abandoned
  // whole, never left half-done with markers in the files (B7).
  const r = spawnSync('git', ['revert', '--no-edit', sha], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    if (/local changes .* would be overwritten/.test(`${r.stderr}${r.stdout}`)) {
      abandon('unsaved changes to what it changed', `unsaved changes here touch what v${version} changed, so going back would overwrite them. Save them (commit) first; nothing changed.`);
    }
    const unmerged = git(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
    const settles = (f) => isJobFile(f) && runNow.get(f) != null && runRecordOnly(show(`${sha}:${f}`) ?? '', runNow.get(f));
    if (!unmerged.length || !unmerged.every(settles)) conflict();
    for (const f of unmerged) {
      const before = show(`${sha}^:${f}`);
      if (before === null) git(['rm', '-q', '-f', '--', f]);
      else {
        writeFileSync(join(root, f), withRecordOf(before, runNow.get(f)));
        git(['add', '--', f]);
      }
    }
    // Every other job it touched keeps the run record it has now, too.
    for (const [f, now] of runNow) {
      const p = join(root, f);
      if (now === null || unmerged.includes(f) || !existsSync(p)) continue;
      const text = readFileSync(p, 'utf8');
      const kept = withRecordOf(text, now);
      if (kept !== text.replace(/\r\n/g, '\n')) {
        writeFileSync(p, kept);
        git(['add', '--', f]);
      }
    }
    // Settled, the undo is committed through this copy's own commit checks.
    try {
      git(['commit', '-q', '--no-edit'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      abandon('this copy\'s own commit checks refused it', `going back over v${version} was refused by this copy's own commit checks. Nothing changed.`);
    }
  }
  log({ event: 'undone at the person\'s request', update: subject });
  say(`UNDONE: ${subject}. Back to v${installed()}. Commit the update log and push.`);
}

// ── main ────────────────────────────────────────────────────────────────────

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'status') {
  say(`installed: v${installed()}`);
} else if (cmd === 'check') {
  const versions = remoteVersions(gitEnv());
  const latest = versions.at(-1);
  say(latest && compareVersions(latest, installed()) > 0 ? `v${latest} is available (installed: v${installed()})` : `up to date (v${installed()})`);
} else if (cmd === 'fetch' || cmd === 'rekey') {
  // rekey <fingerprint> [<version>]: the release bringing a new release key (D5).
  const pinned = cmd === 'rekey' ? arg : null;
  if (cmd === 'rekey' && !/^[0-9a-f]{64}$/.test(pinned ?? '')) die('give the full fingerprint the developer sent');
  const env = gitEnv();
  const versions = remoteVersions(env);
  const version = (cmd === 'rekey' ? process.argv[4] : arg) ?? versions.at(-1);
  if (!version || !versions.includes(version)) die('no such release');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(candidate, { recursive: true });
  const bare = join(work, 'quarantine.git');
  execFileSync('git', ['init', '-q', '--bare', bare], { encoding: 'utf8' });
  try {
    execFileSync('git', ['--git-dir', bare, 'fetch', '-q', '--depth', '1', source(), `refs/tags/v${version}:refs/tags/v${version}`], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    rmSync(work, { recursive: true, force: true });
    refused();
  }
  const tar = execFileSync('git', ['--git-dir', bare, 'archive', '--format=tar', `v${version}`], { maxBuffer: 512 * 1024 * 1024 });
  // The folder is the working directory, not a -C argument: GNU tar on Windows
  // reads `C:\…` as a remote host and refuses, so no Windows copy could update.
  mkdirSync(candidate, { recursive: true });
  execFileSync('tar', ['-x'], { input: tar, cwd: candidate });
  rmSync(bare, { recursive: true, force: true });
  if (pinned) verify(pinned, true);
  else verify();
} else if (cmd === 'verify') {
  verify();
} else if (cmd === 'install') {
  // First install: the candidate was fetched by the developer's paste-in message.
  if (!/^[0-9a-f]{64}$/.test(arg ?? '')) die('give the full fingerprint the developer sent');
  if (!existsSync(join(candidate, RELEASE_DIR, 'release.json'))) die('nothing fetched into temp/update/candidate');
  verify(arg);
} else if (cmd === 'apply') {
  apply(process.argv.slice(3).join(' '));
} else if (cmd === 'rollback') {
  rollback();
} else {
  die('commands: status, check, fetch [<version>], rekey <fingerprint> [<version>], verify, apply, rollback');
}
