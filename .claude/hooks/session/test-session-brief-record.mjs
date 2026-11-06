#!/usr/bin/env node
// What the session brief says about the record's start, on throwaway copies, never
// this repository (round 2 of the set-up edge cases, 2026-10-29):
//
// - B14: the about_me sentinel counts only while the timeline is empty, so an
//   imported record that left it is never greeted as a first contact.
// - D2: a copy for someone else, on GitHub, nothing asked yet, opened on a
//   computer is the helper's session (steps 8 to 11): no profile question, no
//   first contact; in a cloud session, or once a question was asked, it is hers.
//
// Run: node .claude/hooks/session/test-session-brief-record.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'session-brief.mjs');
const harness = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && !k.startsWith('CLAUDE_CODE_REMOTE') && k !== 'CCR_AGENT_PROXY_ENABLED' && k !== 'DEAR_RECORD_READONLY'));
const dir = makeTemp('brief-record-');
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const sh = (cwd, ...args) => execFileSync('git', args, { cwd, env: base, stdio: 'ignore' });
const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const brief = (root, extra = {}) => {
  const r = spawnSync(process.execPath, [hook], { cwd: root, env: { ...base, CLAUDE_PROJECT_DIR: root, ...extra }, input: '{}', encoding: 'utf8', timeout: 120000 });
  return r.stdout ?? '';
};

/** A copy on GitHub (a local bare origin, never the network), its blank record built by the brief. */
function copy(name) {
  const root = join(dir, name);
  sh(dir, 'init', '-q', '--bare', '-b', 'main', `${name}.git`);
  mkdirSync(root);
  sh(root, 'init', '-q', '-b', 'main');
  sh(root, 'remote', 'add', 'origin', join(dir, `${name}.git`));
  // The blank record is built from the modules' shapes, read from the copy's own root.
  cpSync(join(harness, 'modules'), join(root, 'modules'), { recursive: true });
  brief(root);
  return root;
}

try {
  // B14: an imported record, its timeline filled, the about_me sentinel left behind.
  const imp = copy('imported');
  const about = join(imp, 'data', 'core', 'me', 'about_me.md');
  const aboutText = readFileSync(about, 'utf8');
  check('the blank record carries the sentinel this test relies on', aboutText.includes('<!-- unfilled:'));
  let out = brief(imp);
  check('a blank record opens as a first contact', /FIRST CONTACT/.test(out));
  put(imp, 'data/core/timeline.md', `${readFileSync(join(imp, 'data', 'core', 'timeline.md'), 'utf8')}\n2025-03-01 · event · work · an invented line · → data/core/journal/2025-03-01.md\n`);
  out = brief(imp);
  check('a filled timeline with the sentinel left is no first contact (B14)', !/FIRST CONTACT/.test(out));
  put(imp, 'data/core/timeline.md', '# Timeline\n');
  put(imp, 'data/core/journal/2025-03-01.md', 'invented\n');
  out = brief(imp);
  check('an empty timeline with the sentinel still opens as a first contact', /FIRST CONTACT/.test(out));

  // D2: the helper's session after step 8's push.
  const helped = copy('helped');
  put(helped, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · someone else\n- country · Singapore\n');
  out = brief(helped);
  check('a copy for someone else, nothing asked, on a computer: the helper is not asked profile questions, and her chat still keeps development talk out (D2)', /SETUP NOT YET HANDED OVER/.test(out) && !/PROFILE INCOMPLETE/.test(out) && !/FIRST CONTACT/.test(out) && /EVERYDAY UNLESS/.test(out));
  out = brief(helped, { CLAUDE_CODE_REMOTE: 'true' });
  check('the same copy in a cloud session is her first conversation: profile questions are owed', /PROFILE INCOMPLETE/.test(out) && !/SETUP NOT YET HANDED OVER/.test(out));
  const profile = join(helped, 'data', 'PROFILE.yaml');
  const asked = readFileSync(profile, 'utf8').replace(/status: not_asked/, 'status: asked');
  writeFileSync(profile, asked);
  out = brief(helped);
  check('once a question has been asked, a computer session is hers too', /PROFILE INCOMPLETE/.test(out) && !/SETUP NOT YET HANDED OVER/.test(out));
  const mine = copy('mine');
  put(mine, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · me\n');
  out = brief(mine);
  check('a copy for oneself, on a computer, is asked as usual', /PROFILE INCOMPLETE/.test(out) && !/SETUP NOT YET HANDED OVER/.test(out));

  // ── Round 3 ──
  // D14: a timeline split into year files, in either folder, is no empty timeline.
  for (const folder of ['data/core/timeline', 'data/timeline']) {
    const split = copy(`split-${folder.replace(/\W/g, '-')}`);
    put(split, 'data/core/timeline.md', '# Timeline\n\n## Eras\n\n- an invented era\n');
    out = brief(split);
    check(`(the split copy opens as a first contact before its year file is laid, ${folder})`, /FIRST CONTACT/.test(out));
    put(split, `${folder}/2025.md`, '# 2025\n\n2025-03-01 · event · work · an invented line · → data/core/journal/2025-03-01.md\n');
    out = brief(split);
    check(`a timeline split into ${folder}/YYYY.md is no first contact (D14)`, !/FIRST CONTACT/.test(out));
  }
  // B18: a FETCH_HEAD dated ahead of the clock is no recent fetch.
  {
    const fh = join(dir, 'imported', '.git', 'FETCH_HEAD');
    writeFileSync(fh, '');
    const ahead = new Date(Date.now() + 86400e3);
    utimesSync(fh, ahead, ahead);
    brief(join(dir, 'imported'));
    check('a FETCH_HEAD stamped a day ahead does not stop the fetch (B18)', statSync(fh).mtimeMs < ahead.getTime() - 3600e3);
    // Measured from the stamp, not the clock: under the behaviour lock's pinned clock the
    // real fetch's time runs ahead of Date.now(), and the lock read that as a change.
  }
  // C14: the helper's session needs a readable profile with its questions, a computer
  // outside any cloud, and no session of hers logged yet.
  const h2 = copy('helped2');
  put(h2, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · someone else\n- country · Singapore\n');
  check('(the helper\'s copy reads as the helper\'s first)', /SETUP NOT YET HANDED OVER/.test(brief(h2)));
  for (const [what, extra] of [['a cloud session told by its SDK address', { CLAUDE_CODE_REMOTE_SDK_URL: 'http://127.0.0.1:9' }], ['a session behind the cloud\'s proxy', { CCR_AGENT_PROXY_ENABLED: '1' }]]) {
    check(`${what} is hers, not the helper's (C14)`, !/SETUP NOT YET HANDED OVER/.test(brief(h2, extra)));
  }
  const log = join(h2, 'data', 'core', 'state', 'log.md');
  const logText = readFileSync(log, 'utf8');
  writeFileSync(log, `${logText}\n| 2026-10-30 · session abcd1234 · touched: core/journal/x.md |\n`);
  check('once a session of hers is logged, a computer session is hers (C14)', !/SETUP NOT YET HANDED OVER/.test(brief(h2)));
  writeFileSync(log, logText);
  writeFileSync(join(h2, 'data', 'PROFILE.yaml'), 'not: [a profile\n');
  check('a profile that does not read is never taken for nothing asked (C14)', !/SETUP NOT YET HANDED OVER/.test(brief(h2)));
  // T-330: what she meant to tell her therapist comes up the day before and the day of,
  // not only when she mentions the appointment. Made-up items; the rows cover the machine's
  // today and tomorrow, so one is her today or tomorrow whatever her timezone.
  const appt = copy('appointment');
  const utc = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  const loops = '# Open loops\n\n## Before her next appointment\n\n- [ ] an invented thing to say about sleep\n';
  const cal = (dates) => `# Calendar\n\n## Coming up\n\n| Date | What | Notes |\n|---|---|---|\n${dates.map((d) => `| ${d} | Therapy |  |`).join('\n')}\n`;
  put(appt, 'data/core/state/open_loops.md', loops);
  put(appt, 'data/core/calendar/calendar.md', cal([utc(0), utc(1)]));
  out = brief(appt, { CLAUDE_CODE_REMOTE: 'true' });
  check('the day before or of a therapy appointment, her chat is handed what she meant to say, in her words', /BEFORE HER APPOINTMENT (TODAY|TOMORROW)/.test(out) && out.includes('an invented thing to say about sleep'));
  put(appt, 'data/core/calendar/calendar.md', cal([utc(5)]));
  out = brief(appt, { CLAUDE_CODE_REMOTE: 'true' });
  check('five days out, nothing is raised yet', !/BEFORE HER APPOINTMENT/.test(out));
  // DEP-014: a set-up run that closed its chat without its learning step is said once, in the next brief.
  put(appt, '.claude/hooks/state/set-up-learn-owed', '2026-11-01: a set-up run closed without its learning step (DEP-014).');
  out = brief(appt);
  check('an unmet set-up learning step is carried into the next brief', /SET-UP LEARNING STEP OWED: 2026-11-01/.test(out));
  out = brief(appt);
  check('and said once, not every session after', !/SET-UP LEARNING STEP OWED/.test(out));

  // Round 34: the developer's command after a rebuild brings back what was lost and puts
  // nothing else back to that old commit. One page deleted, then another written since
  // and one edit not saved yet: following the command keeps both.
  {
    const lost = copy('lost-page');
    for (const [k, v] of [['user.email', 'test@example.invalid'], ['user.name', 'test']]) sh(lost, 'config', k, v);
    sh(lost, 'config', 'core.hooksPath', '/dev/null');
    put(lost, 'data/core/me/patterns.md', '# Patterns\n\nan invented pattern line\n');
    sh(lost, 'add', '-A');
    sh(lost, 'commit', '-q', '-m', 'one');
    rmSync(join(lost, 'data', 'core', 'me', 'patterns.md'));
    sh(lost, 'commit', '-q', '-a', '-m', 'two');
    const tl = join(lost, 'data', 'core', 'timeline.md');
    writeFileSync(tl, `${readFileSync(tl, 'utf8')}\nan invented line written since\n`);
    sh(lost, 'commit', '-q', '-a', '-m', 'three');
    const now = join(lost, 'data', 'core', 'state', 'now.md');
    writeFileSync(now, `${readFileSync(now, 'utf8')}\nan invented edit not saved yet\n`);
    out = brief(lost);
    const cmd = /runs `(git checkout [^`]+)`/.exec(out)?.[1]?.replace(/\\"/g, '"');
    check('(a rebuilt page names the developer\'s command)', Boolean(cmd));
    if (cmd) execFileSync(cmd, { cwd: lost, env: base, shell: true, stdio: 'ignore' });
    check('following it brings the lost page back', readFileSync(join(lost, 'data', 'core', 'me', 'patterns.md'), 'utf8').includes('an invented pattern line'));
    check('and keeps what was written since, saved or not (round 34)', readFileSync(tl, 'utf8').includes('an invented line written since') && readFileSync(now, 'utf8').includes('an invented edit not saved yet'));
    // The whole folder gone: the folder is named, as before.
    const gone = copy('lost-folder');
    for (const [k, v] of [['user.email', 'test@example.invalid'], ['user.name', 'test']]) sh(gone, 'config', k, v);
    sh(gone, 'config', 'core.hooksPath', '/dev/null');
    put(gone, 'data/core/journal/2025-03-01.md', 'an invented entry\n');
    sh(gone, 'add', '-A');
    sh(gone, 'commit', '-q', '-m', 'one');
    rmSync(join(gone, 'data'), { recursive: true, force: true });
    sh(gone, 'commit', '-q', '-a', '-m', 'two');
    out = brief(gone);
    const all = /runs `(git checkout [^`]+)`/.exec(out)?.[1];
    check('a record lost whole is brought back whole', /-- data$/.test(all ?? ''));
    if (all) execFileSync(all, { cwd: gone, env: base, shell: true, stdio: 'ignore' });
    check('(entries beyond the blank shape included)', readFileSync(join(gone, 'data', 'core', 'journal', '2025-03-01.md'), 'utf8').includes('an invented entry'));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('session brief record test: all passed');
