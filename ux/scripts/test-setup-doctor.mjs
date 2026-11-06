#!/usr/bin/env node
// Rule test: the setup doctor reads each state from evidence (DEP-014).
//
// Builds throwaway copies in the system temp folder, never this repository, and
// runs the doctor against each through SETUP_DOCTOR_ROOT. No inherited GIT_*
// variable is passed on. Exits non-zero on any failure.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const doctor = join(dirname(fileURLToPath(import.meta.url)), 'setup-doctor.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const dir = makeTemp('dear-setup-doctor-');
let failed = 0;

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, stdio: 'ignore' });
const run = (root) => {
  const r = spawnSync(process.execPath, [doctor, '--json'], { env: { ...env, SETUP_DOCTOR_ROOT: root }, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`doctor exited ${r.status}: ${r.stderr}`);
  return Object.fromEntries(JSON.parse(r.stdout).items.map((i) => [i.id, i]));
};
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};

try {
  // A bare copy: a git repository with nothing set up.
  const bare = join(dir, 'bare');
  mkdirSync(bare);
  git(bare, 'init', '-q', '-b', 'main');
  let s = run(bare);
  expect('no remote reads missing', s.remote.state === 'missing');
  expect('an unset commit gate reads missing', s.hooks.state === 'missing');
  expect('no profile reads missing', s.profile.state === 'missing');
  expect('no nudge file reads off, hers to choose', s.switch.state === 'off' && s.switch.who === 'person');
  expect('a copy with no origin reads as a new copy', JSON.parse(spawnSync(process.execPath, [doctor, '--json'], { env: { ...env, SETUP_DOCTOR_ROOT: bare }, encoding: 'utf8' }).stdout).environment.copy === 'new');
  expect('what only GitHub shows reads unknown', s.secrets.state === 'unknown' && s.secrets.who === 'remote');

  // A copy with a failed save, the gate set, edited numbers and the nudge on.
  const set = join(dir, 'set');
  mkdirSync(set);
  git(set, 'init', '-q', '-b', 'main');
  git(set, 'config', 'core.hooksPath', '.claude/hooks/git');
  git(set, 'remote', 'add', 'origin', 'https://github.com/example/example.git');
  put(set, 'data/core/state/PUSH_FAILED.md', 'PUSH TO main FAILED\n');
  put(set, 'data/safety/safety_plan.md', '# Plan\nCall 000.\n');
  put(set, 'data/core/me/nudge.md', '---\nnudge: on\n---\n');
  s = run(set);
  expect('a github origin reads ok', s.remote.state === 'ok');
  expect('the gate set reads ok', s.hooks.state === 'ok');
  expect('a push-failed note reads broken', s.push.state === 'broken');
  expect('edited crisis numbers read ok', s['safety-plan'].state === 'ok');
  expect('the nudge switched on reads ok', s.switch.state === 'ok');

  // The shipped Singapore numbers cannot be judged from here, and a switch set off reads off.
  put(set, 'data/safety/safety_plan.md', '# Plan\nSOS 1767\n');
  put(set, 'data/core/me/nudge.md', '---\nnudge: off\n---\n');
  s = run(set);
  expect('the shipped numbers read unknown, for a person to confirm', s['safety-plan'].state === 'unknown' && s['safety-plan'].who === 'person');
  expect('a switch set off reads off, hers to choose', s.switch.state === 'off' && s.switch.who === 'person');
  put(set, 'data/PROFILE.yaml', 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
  s = run(set);
  expect('the shipped numbers with a Singapore timezone read ok, never asked again', s['safety-plan'].state === 'ok');
  put(set, 'data/PROFILE.yaml', 'mandatory:\n  timezone:\n    value: Asia/Kuala_Lumpur\n    status: answered\n');
  s = run(set);
  expect('the shipped numbers elsewhere still read unknown', s['safety-plan'].state === 'unknown');

  // Where she lives: outside Singapore a hard stop, whatever the plan or timezone says.
  const full = (root) => JSON.parse(spawnSync(process.execPath, [doctor, '--json'], { env: { ...env, SETUP_DOCTOR_ROOT: root }, encoding: 'utf8' }).stdout);
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- country · Malaysia\n');
  let report = full(set);
  let plan = report.items.find((i) => i.id === 'safety-plan');
  expect('a recorded country outside Singapore marks the copy failed', report.failed === 'crisis numbers not set for this country' && plan.state === 'broken' && plan.evidence === report.failed);
  expect('the country itself is not printed', !JSON.stringify(report).includes('Malaysia'));
  put(set, 'data/safety/safety_plan.md', '# Plan\nCall 999.\n');
  expect('edited numbers do not lift the stop: CLAUDE.md and the hooks still hold Singapore\'s', full(set).failed !== null);
  put(set, 'data/safety/safety_plan.md', '# Plan\nSOS 1767\n');
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- country · Singapore\n');
  expect('with no crisis-lines catalogue even Singapore stops (SAF-016)', full(set).failed !== null);
  const lines = (country, first) => `# Crisis lines\n\n## ${country}\n\n| Role | Line | Number | Hours | Source | Read | Checked |\n|---|---|---|---|---|---|---|\n| first | A line | ${first} | 24 hours | its own page | full | 2026-10-15 |\n| emergency | Emergency | 999 | 24 hours | its own page | full | 2026-10-15 |\n`;
  put(set, 'modules/core/knowledge/crisis-lines.md', lines('Singapore', '1767'));
  report = full(set);
  expect('a recorded Singapore with a checked entry reads ok, even with another timezone', report.failed === null && report.items.find((i) => i.id === 'safety-plan').state === 'ok');
  put(set, 'modules/core/knowledge/crisis-lines.md', lines('Singapore', '1767') + lines('Malaysia', '15555').replace('# Crisis lines\n\n', ''));
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- country · Malaysia\n');
  expect("a checked entry for her country, her plan not yet holding it, still stops", full(set).failed !== null);
  put(set, 'data/safety/safety_plan.md', '# Plan\nA line 15555\n');
  report = full(set);
  expect("a checked entry for her country, held in her plan, reads ok", report.failed === null && report.items.find((i) => i.id === 'safety-plan').state === 'ok');
  expect('the country is still not printed', !JSON.stringify(report).includes('Malaysia'));
  put(set, 'modules/core/knowledge/crisis-lines.md', lines('Malaysia', '15555').replace('| full | 2026-10-15 |\n| emergency', '| full | |\n| emergency'));
  expect('an entry with no checked date is no entry', full(set).failed !== null);
  // SAF-017: a Singapore plan holding lines must follow a changed catalogue line. Numbers invented.
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- country · Singapore\n');
  put(set, 'modules/core/knowledge/crisis-lines.md', lines('Singapore', '1800'));
  put(set, 'data/safety/safety_plan.md', '# Plan\nSOS 1767\n');
  expect("a Singapore plan holding a line the catalogue has since changed reads broken", full(set).items.find((i) => i.id === 'safety-plan').state === 'broken');
  put(set, 'data/safety/safety_plan.md', '# Plan\nA line 1800\n');
  expect("a Singapore plan holding the catalogue's current line reads ok", full(set).items.find((i) => i.id === 'safety-plan').state === 'ok');
  put(set, 'data/safety/safety_plan.md', '# Plan\nWarning signs only.\n');
  expect('a Singapore plan holding no lines at all still reads ok (CLAUDE.md ships them)', full(set).items.find((i) => i.id === 'safety-plan').state === 'ok');
  put(set, 'modules/core/knowledge/crisis-lines.md', lines('Singapore', '1767'));
  put(set, 'data/safety/safety_plan.md', '# Plan\nSOS 1767\n');
  // A copy made for someone else that has dev/ again.
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · someone else\n');
  expect('someone else\'s copy with no dev/ reads ok', run(set)['copy-for']?.state === 'ok');
  put(set, 'dev/README.md', 'dev\n');
  expect('someone else\'s copy with dev/ reads broken', run(set)['copy-for']?.state === 'broken');
  rmSync(join(set, 'dev'), { recursive: true, force: true });
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · me\n');
  put(set, 'dev/README.md', 'dev\n');
  expect('the developer\'s own copy with dev/ is not flagged', !run(set)['copy-for']);
  rmSync(join(set, 'dev'), { recursive: true, force: true });
  // Her copy counts only the jobs the cloud may run; once one has run, the Routine that runs
  // them is read on claude.ai, since nothing else starts them (A-054).
  put(set, '.claude/jobs/README.md', '---\njobs: check-in, dev-hygiene\n---\n');
  put(set, '.claude/jobs/check-in.md', '---\nevery: 7 days\nruns: anywhere\nstatus: ok\n---\n');
  put(set, '.claude/jobs/dev-hygiene.md', '---\nevery: 7 days\n---\n');
  s = run(set);
  expect('a run record shipped from the source, with no finish commit here, is no run', s.heartbeats.state === 'off');
  git(set, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'chore(heartbeats): finish run 2026-10-27 (cc-routine)');
  s = run(set);
  expect('her copy counts only the jobs the cloud may run', s.heartbeats.state === 'ok' && s.heartbeats.evidence.startsWith('1 of 1'));
  expect('her copy whose check-ins have run reads the Routine on claude.ai, never off', s.routine.state === 'unknown' && s.routine.who === 'remote');
  put(set, '.claude/jobs/check-in.md', '---\nevery: 7 days\nruns: anywhere\n---\n');
  s = run(set);
  expect('her copy with no check-in run yet reads off, never a scheduler to set up', s.heartbeats.state === 'off');
  expect('her copy with nothing run yet reads the Routine off, hers to want', s.routine.state === 'off' && s.routine.who === 'person');
  put(set, 'dev/README.md', 'dev\n');
  s = run(set);
  expect('the developer\'s copy still needs its scheduler', s.heartbeats.state === 'missing' && s.routine.state === 'unknown');
  rmSync(join(set, 'dev'), { recursive: true, force: true });
  rmSync(join(set, '.claude'), { recursive: true, force: true });

  // An empty line in the switch once read as the closing --- and showed off.
  put(set, 'data/core/me/nudge.md', '---\nnudge: on\nuntil:\n---\n');
  s = run(set);
  expect('an empty line in the switch leaves the nudge on', s.switch.state === 'ok');
  // A note left from her chat for whoever checks the setup is shown.
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- open · 2026-10-09 · the nudge stopped: the Claude token looks expired\n- done · 2026-10-01 · a save was carried\n');
  s = run(set);
  expect('an open setup note is shown, a done one is not counted', s['setup-notes']?.evidence.startsWith('1 note'));

  // What wears out: a token inside the warning window or past reads broken, for a person.
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- expires · 2000-01-01 · the Claude token\n- expires · 2999-01-01 · the Telegram token\n');
  s = run(set);
  expect('a token already ended reads broken, for a person', s.expiry?.state === 'broken' && s.expiry.who === 'person' && s.expiry.evidence.includes('the Claude token ended'));
  put(set, 'data/core/state/setup_notes.md', '# Setup notes\n\n- expires · 2999-01-01 · the Telegram token\n');
  s = run(set);
  expect('a token far from its end reads ok', s.expiry?.state === 'ok');
  const { expiries } = await import(pathToFileURL(doctor).href);
  expect('heartbeats laid with no token end written reads unknown', expiries('', '2026-01-01', true)[0]?.state === 'unknown' && expiries('', '2026-01-01', false).length === 0);
  expect('a token inside the warning window reads broken', expiries('- expires · 2026-01-10 · the Claude token\n', '2026-01-01')[0]?.state === 'broken');

  // Branches on origin: a session save main lacks is the workflow's to carry; a
  // rescue holding only the push-failed note is not a record change; a detached
  // rescue touching the record waits for a person.
  const origin = join(dir, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env, stdio: 'ignore' });
  const work = join(dir, 'work');
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'main');
  git(work, 'config', 'user.email', 'test@example.invalid');
  git(work, 'config', 'user.name', 'test');
  git(work, 'remote', 'add', 'origin', origin);
  put(work, 'data/core/journal/a.md', 'start\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'start');
  git(work, 'push', '-q', 'origin', 'main');
  const branch = (name, path, text) => {
    git(work, 'checkout', '-q', '-b', name, 'main');
    put(work, path, text);
    git(work, 'add', '-A');
    git(work, 'commit', '-qm', name);
    git(work, 'push', '-q', 'origin', name);
    git(work, 'checkout', '-q', 'main');
  };
  branch('rescue/detached-1', 'data/core/state/PUSH_FAILED.md', 'note\n');
  git(work, 'fetch', '-q', 'origin');
  s = run(work);
  expect('a rescue holding only the push-failed note is not a record change', s.carry.state !== 'broken' && s.leftovers?.state === 'unknown' && !s.rescue);
  branch('rescue/detached-2', 'data/core/journal/b.md', 'kept\n');
  branch('claude/session-1', 'data/core/journal/c.md', 'said\n');
  git(work, 'fetch', '-q', 'origin');
  s = run(work);
  expect('a session save main lacks reads broken, for the agent', s.carry.state === 'broken' && s.carry.who === 'agent');
  expect('a detached rescue touching the record waits for a person', s.rescue?.state === 'unknown' && s.rescue?.who === 'person');

  // Nothing of the record is printed: a phrase planted in the record never appears.
  put(set, 'data/core/state/now.md', 'PLANTED-PRIVATE-PHRASE\n');
  const table = spawnSync(process.execPath, [doctor], { env: { ...env, SETUP_DOCTOR_ROOT: set }, encoding: 'utf8' }).stdout;
  expect('prints no word of the record', !table.includes('PLANTED-PRIVATE-PHRASE'));

  // What GitHub's run logs show, judged without a network.
  const remote = await import(pathToFileURL(doctor).href);
  expect('no part waits on a Worker or its monitor any more', !('judgeWorker' in remote) && !('judgeMonitor' in remote) && !('WORKER_PROOF' in remote));
  expect('no Cloudflare log is ever where to look', !/Cloudflare|Observability/.test(remote.ROUTINE_PROOF) && /routine/.test(remote.ROUTINE_PROOF));
  expect('an inert heartbeat run reads the secrets broken', remote.judgeSecrets(['heartbeats: inert'], true).state === 'broken');
  expect('a test message that arrived reads the secrets ok', remote.judgeSecrets([], true).state === 'ok');
  // A past run proves a part only if its log can be read and it is newer than the last secret change.
  const run1 = { createdAt: '2026-10-01T00:00:00Z' };
  const sent = 'job\tstep\t2026-10-01T00:00:01.00Z nudge: sent from GitHub\n';
  expect('an unreadable log proves nothing', remote.proof(run1, null, '2026-09-01T00:00:00Z').lines === null);
  expect('a run older than the last secret change proves nothing', remote.proof(run1, sent, '2026-10-05T00:00:00Z').lines === null);
  expect('unknown secret dates prove nothing', remote.proof(run1, sent, null).lines === null);
  expect('a readable run newer than the secrets proves the pipe', remote.proof(run1, sent, '2026-09-01T00:00:00Z').lines.includes('nudge: sent from GitHub'));
  const gone = remote.proof(run1, null, '2026-09-01T00:00:00Z');
  expect('an unreadable log reads the secrets unknown, never ok', remote.judgeSecrets(gone.lines, false, gone.why).state === 'unknown' && remote.judgeSecrets(gone.lines, false, gone.why).evidence.includes('cannot be read'));
  // Her reminders: only the sweep sends them, and only with "send": "routine" (HBT-010 design 2).
  const rem = join(dir, 'reminders');
  put(rem, 'data/PROFILE.yaml', 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
  put(rem, 'data/core/calendar/reminders.json', JSON.stringify({ timezone: 'UTC', reminders: [] }));
  let r = await remote.judgeReminders(rem);
  expect('the blank record\'s empty reminders file reads off, not broken', r.state === 'off');
  put(rem, 'data/core/calendar/reminders.json', JSON.stringify({ timezone: 'Asia/Singapore', reminders: [{ id: 'r', text: 'x', cron: '0 9 * * *' }] }));
  r = await remote.judgeReminders(rem);
  expect('a reminders file without "send": "routine" reads broken, for the agent', r.state === 'broken' && r.who === 'agent' && /nothing else sends it/.test(r.evidence));
  put(rem, 'data/core/calendar/reminders.json', JSON.stringify({ timezone: 'Asia/Singapore', send: 'routine', reminders: [{ id: 'r', text: 'x', cron: '0 9 * * *' }] }));
  r = await remote.judgeReminders(rem);
  expect('a live reminder sent by the sweep points at the routine and its tally', r.state === 'unknown' && r.who === 'remote' && r.next === remote.ROUTINE_PROOF);
  expect('the health lines of the retired monitor are no longer read', remote.statusLines('job\tstep\t2026-10-10T01:39:41.29Z health: pinged\n').length === 0);
  expect('hourly heartbeat runs and a few saves fit the free minutes', remote.judgeLimits(30).state === 'ok');
  expect('a cron every five minutes reads the limits broken', remote.judgeLimits(288).state === 'broken');
  expect('just under the share is still ok, at it is broken', remote.judgeLimits(52).state === 'ok' && remote.judgeLimits(54).state === 'broken');
  expect('a log is reduced to status lines only', remote.statusLines('job\tstep\t2026-10-10T01:39:41.29Z PLANTED-PRIVATE-PHRASE\njob\tstep\t2026-10-10T01:39:41.29Z heartbeats: inert\n').join() === 'heartbeats: inert');
  expect('the printed script is not output', remote.statusLines('job\tstep\t2026-10-10T01:39:37.26Z \u001b[36;1m  echo "heartbeats: inert, no token"\n').length === 0);

  // ── Set-up edge cases, 2026-10-29 ─────────────────────────────────────────
  const commit = (cwd, msg, date) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '--no-verify', '-m', msg], { cwd, stdio: 'ignore', env: date ? { ...env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : env });
  const hers = (name) => {
    const root = join(dir, name);
    mkdirSync(root);
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'remote', 'add', 'origin', 'https://github.com/example/example.git');
    return root;
  };

  // C18: a credential written into the origin address reads broken, and the address is never printed.
  const tok = hers('token-in-url');
  git(tok, 'remote', 'set-url', 'origin', 'https://someone:PLANTEDSECRET@github.com/example/example.git');
  const tokOut = spawnSync(process.execPath, [doctor, '--json'], { env: { ...env, SETUP_DOCTOR_ROOT: tok }, encoding: 'utf8' }).stdout;
  expect('a credential in the origin address reads broken, for a person (C18)', JSON.parse(tokOut).items.find((i) => i.id === 'remote').state === 'broken');
  expect('and neither the credential nor the address is printed', !tokOut.includes('PLANTEDSECRET') && !tokOut.includes('someone'));
  git(tok, 'remote', 'set-url', 'origin', 'git@github.com:example/example.git');
  expect('an ssh origin is not a credential', run(tok).remote.state === 'ok');

  // C12: a branch of any other name holding record changes waits for a look.
  branch('feature-x', 'data/core/journal/d.md', 'kept\n');
  git(work, 'fetch', '-q', 'origin');
  s = run(work);
  expect('a branch not named claude/ or rescue/ that touches the record is listed to look at (C12)', s.rescue?.state === 'unknown' && /^2 branch/.test(s.rescue.evidence));

  // C11: a token end no calendar has reads unknown, never ok.
  expect('an impossible token end reads unknown (C11)', expiries('- expires · 2026-13-01 · the Claude token\n', '2026-01-01')[0]?.state === 'unknown');
  expect('the 30th of February reads unknown too', expiries('- expires · 2027-02-30 · the Telegram token\n', '2026-01-01')[0]?.state === 'unknown');
  // C18 (round 2): one unreadable date never hides a key already past its end.
  const mixed = Object.fromEntries(expiries('- expires · 2026-13-01 · the Telegram token\n- expires · 2025-12-01 · the Claude token\n', '2026-01-01', true).map((i) => [i.id, i]));
  expect('an unreal date beside an expired key: the key reads broken, the date unknown (C18)', mixed.expiry?.state === 'broken' && /the Claude token ended/.test(mixed.expiry.evidence) && mixed['expiry-date']?.state === 'unknown');

  // C20 (round 2): only a secret in the address counts, and the host must be GitHub.
  git(tok, 'remote', 'set-url', 'origin', 'https://someone@github.com/example/example.git');
  expect('a user name with no secret in the origin is not a credential (C20)', run(tok).remote.state === 'ok');
  git(tok, 'remote', 'set-url', 'origin', 'https://evil.example/github.com/example/example.git');
  expect('github.com in the path of another host reads broken (C20)', run(tok).remote.state === 'broken');
  git(tok, 'remote', 'set-url', 'origin', 'file:///srv/github.com/example/example');
  expect('a folder named github.com reads broken (C20)', run(tok).remote.state === 'broken');
  git(tok, 'remote', 'set-url', 'origin', `https://${'ghp_'}${'Q'.repeat(36)}@github.com/example/example.git`);
  expect('a token alone before the host reads broken (C20)', run(tok).remote.state === 'broken');
  git(tok, 'remote', 'set-url', 'origin', 'ssh://git@github.com/example/example.git');
  expect('an ssh:// origin on GitHub reads ok', run(tok).remote.state === 'ok');

  // D18, D22 (round 2): where the doctor points.
  expect('a missing merge workflow points at components.md, not step 10 (D18)', !/step 10/.test(s['merge-workflow']?.next ?? '') && /components\.md/.test(s['merge-workflow']?.next ?? ''));

  // A12: a new copy (`- for ·`) whose country was never asked is not Singapore by default.
  const nc = hers('no-country');
  put(nc, 'data/safety/safety_plan.md', '# Plan\nSOS 1767\n');
  put(nc, 'data/PROFILE.yaml', 'mandatory:\n  timezone:\n    value: Asia/Singapore\n    status: answered\n');
  put(nc, 'data/core/state/setup_notes.md', '# Setup notes\n\n- for · me\n');
  s = run(nc);
  expect('a copy made by new-copy with no country recorded reads the crisis numbers unknown, for a person (A12)', s['safety-plan'].state === 'unknown' && s['safety-plan'].who === 'person' && /country/.test(s['safety-plan'].next));
  expect('asking the country says her chat leaves a setup note instead (D22)', /in her chat, a setup note instead/.test(s['safety-plan'].next));

  // A5 (round 2): the nudge on, nothing ever run here: nothing reaches her phone.
  const wantedCopy = hers('wanted');
  put(wantedCopy, '.claude/jobs/README.md', '---\njobs: check-in\n---\n');
  put(wantedCopy, '.claude/jobs/check-in.md', '---\nevery: 1 hour\nruns: anywhere\n---\n');
  s = run(wantedCopy);
  expect('nothing wanted and nothing run reads the routine off', s.routine.state === 'off');
  put(wantedCopy, 'data/core/me/nudge.md', '---\nnudge: on\n---\n');
  s = run(wantedCopy);
  expect('the nudge on with no routine ever run reads the routine missing: nothing reaches her phone (A5)', s.routine.state === 'missing' && /nothing reaches her phone/.test(s.routine.evidence) && s.heartbeats.state !== 'off');

  // C1, C21, C22: her copy's routine and jobs, read from the finish commits and the records.
  const hb = hers('routine');
  put(hb, '.claude/jobs/README.md', '---\njobs: check-in, dev-hygiene\n---\n');
  put(hb, '.claude/jobs/check-in.md', '---\nevery: 1 hour\nruns: anywhere\nstatus: ok\nlast_finished: 2026-10-01T00:00:00Z\n---\n');
  put(hb, '.claude/jobs/dev-hygiene.md', '---\nevery: 7 days\nstatus: ok\nlast_finished: 2026-10-01T00:00:00Z\n---\n');
  put(hb, 'data/core/me/nudge.md', '---\nnudge: on\n---\n');
  const old = new Date(Date.now() - 20 * 86400e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
  commit(hb, 'chore(heartbeats): finish run (cc-routine)', old);
  s = run(hb);
  expect('no finish run for 20 days with the nudge on reads the routine broken (C1)', s.routine.state === 'broken' && s.routine.evidence.includes(old.slice(0, 10)));
  commit(hb, 'chore(heartbeats): finish run (cc-routine)');
  s = run(hb);
  expect('a finish run within the day reads the routine on claude.ai, not broken', s.routine.state === 'unknown');
  put(hb, '.claude/jobs/dev-hygiene.md', '---\nevery: 7 days\nstatus: failed\nfailures: 1\nlast_started: 2026-10-01T00:00:00Z\n---\n');
  s = run(hb);
  expect('in her copy a failing job the routine runs reads broken, not only cloud jobs (C22)', s.heartbeats.state === 'broken' && s.heartbeats.evidence.includes('dev-hygiene'));
  put(hb, '.claude/jobs/dev-hygiene.md', '---\nevery: 7 days\nstatus: ok\nlast_finished: 2026-10-01T00:00:00Z\n---\n');
  put(hb, '.claude/jobs/check-in.md', `---\nevery: 1 hour\nruns: anywhere\nstatus: running\nfailures: 2\nlast_started: ${new Date(Date.now() - 5 * 86400e3).toISOString()}\n---\n`);
  s = run(hb);
  expect('a job stuck running for days after two failures, capped, reads broken (C21)', s.heartbeats.state === 'broken' && /repeated failures: check-in/.test(s.heartbeats.evidence) && /by hand/.test(s.heartbeats.next));

  // B16: where updates come from.
  const rel = hers('release');
  put(rel, '.claude/release/installed.json', '{"version":"1.0"}');
  put(rel, '.claude/release/source.json', '{"repo":"https://github.com/example/release.git"}');
  s = run(rel);
  expect('an installed copy with no release key reads broken: every update held back (B16)', s['release-key']?.state === 'broken' && s['release-source']?.state === 'ok');
  put(rel, '.claude/release/release-key.pub', 'key\n');
  put(rel, '.claude/release/source.json', '{"repo":"<the release repository>"}');
  s = run(rel);
  expect('a placeholder release source reads broken, and the key ok', s['release-source']?.state === 'broken' && s['release-key']?.state === 'ok');

  // D-G13: CLAUDE.md in her copy changes only by the download and updates.
  const cm = hers('claude-md');
  const save = (msg, text) => {
    put(cm, 'CLAUDE.md', text);
    git(cm, 'add', 'CLAUDE.md');
    commit(cm, msg);
  };
  save('chore: a new copy', 'rules v1\n');
  const FP = 'a'.repeat(64);
  put(cm, '.claude/release/installed.json', `{"version":"1.1","fingerprint":"${FP}"}`);
  git(cm, 'add', '.claude/release/installed.json');
  save(`harness: update to v1.1\n\nfingerprint ${FP}\napproved by the typed phrase "x"`, 'rules v1.1\n');
  expect('CLAUDE.md changed only by the download and an update reads ok', run(cm)['claude-md']?.state === 'ok');
  // C21 (round 2): an update's subject alone proves nothing; the updater's commit moves installed.json.
  save('harness: update to v99', 'rules, edited by hand under an update\'s name\n');
  s = run(cm);
  expect('a hand edit titled as an update, with no installed.json change, reads broken (C21)', s['claude-md']?.state === 'broken');
  const cmMerge = hers('claude-md-merge');
  const saveIn = (root, msg, text) => {
    put(root, 'CLAUDE.md', text);
    git(root, 'add', 'CLAUDE.md');
    commit(root, msg);
  };
  saveIn(cmMerge, 'chore: a new copy', 'rules v1\n');
  git(cmMerge, 'checkout', '-q', '-b', 'side');
  put(cmMerge, 'data/core/journal/x.md', 'x\n');
  git(cmMerge, 'add', '-A');
  commit(cmMerge, 'record: a save');
  git(cmMerge, 'checkout', '-q', 'main');
  put(cmMerge, 'notes.txt', 'n\n');
  git(cmMerge, 'add', '-A');
  commit(cmMerge, 'chore: other');
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '--no-commit', 'side'], { cwd: cmMerge, env, stdio: 'ignore' });
  expect('a plain merge leaves CLAUDE.md as released (C21)', (() => { commit(cmMerge, 'Merge a session branch'); return run(cmMerge)['claude-md']?.state === 'ok'; })());
  git(cmMerge, 'checkout', '-q', '-b', 'side2', 'HEAD~1');
  put(cmMerge, 'data/core/journal/y.md', 'y\n');
  git(cmMerge, 'add', '-A');
  commit(cmMerge, 'record: another save');
  git(cmMerge, 'checkout', '-q', 'main');
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '--no-commit', 'side2'], { cwd: cmMerge, env, stdio: 'ignore' });
  put(cmMerge, 'CLAUDE.md', 'rules, edited inside a merge\n');
  git(cmMerge, 'add', 'CLAUDE.md');
  commit(cmMerge, 'Merge a session branch');
  s = run(cmMerge);
  expect('a merge that edits CLAUDE.md itself reads broken (C21)', s['claude-md']?.state === 'broken');
  save('fix: tidy', 'rules, edited by hand\n');
  s = run(cm);
  expect('a hand edit to CLAUDE.md in her copy reads broken, for a person (D-G13)', s['claude-md']?.state === 'broken' && s['claude-md'].who === 'person');

  // C10, C14, C15: what GitHub shows, through a stand-in `gh` on PATH, never the network.
  expect('the newest heartbeat run failing after the secrets changed reads broken (C10)', remote.judgeLastBeat?.([{ conclusion: 'failure', createdAt: '2026-10-20T00:00:00Z' }, { conclusion: 'success', createdAt: '2026-10-19T00:00:00Z' }], '2026-10-01T00:00:00Z')?.state === 'broken');
  expect('a run still going is skipped for the newest finished one', remote.judgeLastBeat?.([{ conclusion: '', createdAt: '2026-10-21T00:00:00Z' }, { conclusion: 'success', createdAt: '2026-10-20T00:00:00Z' }], '2026-10-01T00:00:00Z') === null);
  // C19 (round 2): every way a run can fail counts; a cancelled one is passed over.
  for (const c of ['timed_out', 'startup_failure', 'action_required']) expect(`a newest run ending ${c} reads broken (C19)`, remote.judgeLastBeat([{ conclusion: c, createdAt: '2026-10-20T00:00:00Z' }], '2026-10-01T00:00:00Z')?.state === 'broken');
  expect('a cancelled newest run does not hide the failure before it (C19)', remote.judgeLastBeat([{ conclusion: 'cancelled', createdAt: '2026-10-21T00:00:00Z' }, { conclusion: 'skipped', createdAt: '2026-10-20T12:00:00Z' }, { conclusion: 'failure', createdAt: '2026-10-20T00:00:00Z' }], '2026-10-01T00:00:00Z')?.state === 'broken');
  expect('a cancelled run before a success says nothing', remote.judgeLastBeat([{ conclusion: 'cancelled', createdAt: '2026-10-21T00:00:00Z' }, { conclusion: 'success', createdAt: '2026-10-20T00:00:00Z' }], '2026-10-01T00:00:00Z') === null);
  expect('a failure older than the last secret change says nothing', remote.judgeLastBeat?.([{ conclusion: 'failure', createdAt: '2026-10-01T00:00:00Z' }], '2026-10-05T00:00:00Z') === null);
  const bin = join(dir, 'bin');
  put(bin, 'gh', `#!/usr/bin/env node
const a = process.argv.slice(2).join(' ');
const out = (o) => { process.stdout.write(typeof o === 'string' ? o : JSON.stringify(o)); process.exit(0); };
if (a.startsWith('auth status')) out('');
if (a.includes('--workflow heartbeats.yml')) out([{ databaseId: 3, event: 'schedule', createdAt: '2026-10-20T02:00:00Z', conclusion: 'failure' }, { databaseId: 2, event: 'schedule', createdAt: '2026-10-20T01:00:00Z', conclusion: 'failure' }, { databaseId: 1, event: 'schedule', createdAt: '2026-10-19T00:00:00Z', conclusion: 'success' }]);
if (a.includes('--workflow check-in.yml')) out([]);
if (a.startsWith('secret list')) out([{ name: 'X', updatedAt: '2026-10-01T00:00:00Z' }]);
if (a.startsWith('run view')) out('job\\tstep\\t2026-10-19T00:00:01.00Z nudge: sent from GitHub\\n');
if (a.startsWith('run list')) out([]);
if (a.includes('--json visibility')) out({ visibility: process.env.FAKE_VISIBILITY });
if (a.startsWith('repo view')) out({ name: 'example' });
if (a.startsWith('api repos/{owner}/{repo} --jq .size')) out(process.env.FAKE_SIZE ?? '');
if (a.startsWith('api')) out(process.env.FAKE_PEOPLE);
process.exit(1);
`);
  execFileSync('chmod', ['+x', join(bin, 'gh')]);
  const PATH0 = process.env.PATH;
  process.env.PATH = `${bin}:${PATH0}`;
  try {
    process.env.FAKE_VISIBILITY = 'PUBLIC';
    process.env.FAKE_PEOPLE = 'idQQ1\nidQQ2\n';
    let found = Object.fromEntries(remote.remoteFindings(work).map((i) => [i.id, i]));
    expect('two failed heartbeat runs after an older success read the secrets broken (C10)', found.secrets?.state === 'broken' && /failed/.test(found.secrets.evidence));
    expect('a public repository reads broken, for a person (C14)', found.visibility?.state === 'broken' && found.visibility.who === 'person');
    expect('a second account with access reads broken, for a person, naming no one (C15)', found.collaborators?.state === 'broken' && !/idQQ/.test(JSON.stringify(found)));
    process.env.FAKE_VISIBILITY = 'PRIVATE';
    process.env.FAKE_PEOPLE = 'idQQ1\n';
    found = Object.fromEntries(remote.remoteFindings(work).map((i) => [i.id, i]));
    expect('a private repository with only its owner reads ok', found.visibility?.state === 'ok' && found.collaborators?.state === 'ok');
    // D13 (round 3): the repository's size, from the repos API, past 1 GB reads broken.
    process.env.FAKE_SIZE = String(2 * 1024 * 1024);
    found = Object.fromEntries(remote.remoteFindings(work).map((i) => [i.id, i]));
    expect('a repository past 1 GB on GitHub reads broken, for a person (D13)', found.size?.state === 'broken' && found.size.who === 'person' && /2048 MB/.test(found.size.evidence));
    process.env.FAKE_SIZE = '5120';
    found = Object.fromEntries(remote.remoteFindings(work).map((i) => [i.id, i]));
    expect('a small repository reads ok (D13)', found.size?.state === 'ok');
    process.env.FAKE_SIZE = '';
    found = Object.fromEntries(remote.remoteFindings(work).map((i) => [i.id, i]));
    expect('an unreadable size says nothing (D13)', !found.size);
  } finally {
    process.env.PATH = PATH0;
  }

  // ── Round 3 ───────────────────────────────────────────────────────────────
  // B19: main holds a record commit GitHub lacks, with no note: not "push ok".
  const b19 = join(dir, 'b19');
  const b19origin = join(dir, 'b19.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', b19origin], { env, stdio: 'ignore' });
  mkdirSync(b19);
  git(b19, 'init', '-q', '-b', 'main');
  git(b19, 'remote', 'add', 'origin', b19origin);
  put(b19, 'data/core/journal/a.md', 'start\n');
  git(b19, 'add', '-A');
  commit(b19, 'start');
  git(b19, 'push', '-q', 'origin', 'main');
  git(b19, 'fetch', '-q', 'origin');
  expect('main level with GitHub reads the push ok', run(b19).push.state === 'ok');
  put(b19, 'data/core/journal/b.md', 'PLANTED-PRIVATE-PHRASE\n');
  git(b19, 'add', '-A');
  commit(b19, 'record: session update');
  s = run(b19);
  expect('a record commit main holds and GitHub lacks reads broken, with no note (B19)', s.push.state === 'broken' && /^1 record commit/.test(s.push.evidence));
  put(b19, 'notes.txt', 'n\n');
  git(b19, 'add', '-A');
  commit(b19, 'chore: not the record');
  git(b19, 'push', '-q', 'origin', 'main');
  git(b19, 'fetch', '-q', 'origin');
  expect('once pushed it reads ok again', run(b19).push.state === 'ok');

  // B1: a note saying the commit itself failed is not "retry the push"; a lock left behind is for a person.
  put(b19, 'data/core/state/PUSH_FAILED.md', 'RECORD NOT COMMITTED at 2026-10-30T00:00:00Z\n\nanother git in this folder held its lock (index.lock) throughout, so the record could not be committed. Her words are on disk here only.\nRun: git commit -- data/   to see why.\n');
  s = run(b19);
  expect('a note of a commit that failed names the failed commit and its cause, not a push (B1)', s.push.state === 'broken' && /not committed: git's lock/.test(s.push.evidence) && !/retry the push/.test(s.push.next));
  expect('the cause is told from the hook\'s fixed words, never echoed (B1)', remote.noteCause?.('RECORD NOT COMMITTED at x\n\nPLANTED-PRIVATE-PHRASE\n') === 'git refused the commit' && remote.noteCause?.('PUSH TO main FAILED\n') === null);
  put(b19, '.git/index.lock', '');
  s = run(b19);
  expect('a lock git left behind is listed, for a person when no git runs (B1)', (s.lock?.state === 'broken' && s.lock.who === 'person' && /index\.lock/.test(s.lock.next)) || s.lock?.state === 'unknown');
  rmSync(join(b19, '.git', 'index.lock'));
  expect('no lock, no lock item', !run(b19).lock);

  // C10: an off-form token end is unreadable, never dropped.
  for (const [what, line] of [['unpadded', '- expires · 2026-9-1 · the bot token'], ['double-spaced', '- expires  ·  2025-09-01 · the bot token'], ['with no what', '- expires · 2025-09-01'], ['in capitals', '- Expires · 2025-09-01 · the bot token']]) {
    const got = Object.fromEntries(expiries(`# Setup notes\n\n${line}\n`, '2026-01-01', true).map((i) => [i.id, i]));
    expect(`a token end written ${what} reads unreadable, not absent (C10)`, got['expiry-date']?.state === 'unknown' && got.expiry?.state !== 'ok');
  }

  // C11: a classic 40-hex token before the host is a credential.
  git(tok, 'remote', 'set-url', 'origin', `https://${'0123456789abcdef'.repeat(2)}${'01234567'}@github.com/example/example.git`);
  const c11 = spawnSync(process.execPath, [doctor, '--json'], { env: { ...env, SETUP_DOCTOR_ROOT: tok }, encoding: 'utf8' }).stdout;
  expect('a classic 40-hex token in the origin reads broken, unprinted (C11)', JSON.parse(c11).items.find((i) => i.id === 'remote').state === 'broken' && !c11.includes('0123456789abcdef'));

  // C13: an update's commit names the fingerprint it wrote; a hand edit moving installed.json too reads broken.
  const c13 = hers('c13');
  const save13 = (msg, files) => {
    for (const [p, t] of Object.entries(files)) put(c13, p, t);
    git(c13, 'add', '-A');
    commit(c13, msg);
  };
  save13('chore: a new copy', { 'CLAUDE.md': 'rules v1\n' });
  save13(`harness: update to v1.1\n\nfingerprint ${'b'.repeat(64)}`, { 'CLAUDE.md': 'rules v1.1\n', '.claude/release/installed.json': `{"fingerprint":"${'b'.repeat(64)}"}` });
  expect('an update whose body names the fingerprint it installed reads ok (C13)', run(c13)['claude-md']?.state === 'ok');
  git(c13, '-c', 'user.email=t@t', '-c', 'user.name=t', 'revert', '--no-edit', 'HEAD');
  expect('undoing a real update reads ok (C13)', run(c13)['claude-md']?.state === 'ok');
  save13('harness: update to v3', { 'CLAUDE.md': 'rules, edited by hand\n', '.claude/release/installed.json': '{"version":"3"}' });
  expect('a hand edit titled as an update that moves installed.json, with no fingerprint, reads broken (C13)', run(c13)['claude-md']?.state === 'broken');
  const c13b = hers('c13b');
  const save13b = (msg, files) => {
    for (const [p, t] of Object.entries(files)) put(c13b, p, t);
    git(c13b, 'add', '-A');
    commit(c13b, msg);
  };
  save13b('chore: a new copy', { 'CLAUDE.md': 'rules v1\n' });
  save13b(`harness: update to v3\n\nfingerprint ${'c'.repeat(64)}`, { 'CLAUDE.md': 'rules, edited by hand\n', '.claude/release/installed.json': `{"fingerprint":"${'d'.repeat(64)}"}` });
  expect('a fingerprint in the body that is not the one installed reads broken (C13)', run(c13b)['claude-md']?.state === 'broken');

  // D17: in her copy a developer's job (gate: dev) never runs, so its shipped record is not hers.
  put(hb, '.claude/jobs/check-in.md', '---\nevery: 1 hour\nruns: anywhere\nstatus: ok\nlast_finished: 2026-10-01T00:00:00Z\n---\n');
  put(hb, '.claude/jobs/dev-hygiene.md', '---\ngate: dev\nevery: 7 days\nstatus: failed\nfailures: 1\nlast_started: 2026-10-01T00:00:00Z\n---\n');
  expect('a developer\'s job failed in the source does not read broken in her copy (D17)', run(hb).heartbeats.state !== 'broken');

  // D13: the size judgement on its own.
  expect('judgeSize: unreadable says nothing, small ok, past 1 GB broken (D13)', remote.judgeSize?.(null) === null && remote.judgeSize?.(100)?.state === 'ok' && remote.judgeSize?.(1024 * 1024)?.state === 'broken');

  // C23: where a development chat looks for a reminder's delivery prints no reminder's words.
  expect('the routine proof points at list --shape, never list --json (C23)', /reminders\.mjs list --shape/.test(remote.ROUTINE_PROOF) && !/--json/.test(remote.ROUTINE_PROOF));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('setup doctor test: all passed');
