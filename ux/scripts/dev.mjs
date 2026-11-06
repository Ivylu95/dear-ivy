// `npm run dev`: the dashboard, and the developer's views beside it where they
// are here (WKB-002).
//
// One command for everyone. In a copy without dev/ui/ this is `next dev` and
// nothing else. In the developer's copy it starts the admin app on its own port
// first, prefixing its output with [admin], and stops it when the dashboard
// stops; the dashboard passes /admin/… to it (proxy.js). If the admin app fails,
// the dashboard keeps running and /admin says so.
//
//   DEAR_PORT   the dashboard's port, optional, defaults to 3220
//
// `npm run work` (`--work`) is the same pair as production builds: both apps
// are built, then served with `next start`. An audit on 2026-10-06 measured a
// page at 186-300 ms under `next dev` and 11-20 ms under `next start`, before
// counting the compile a dev server does on each first visit (DES-008). For
// reading and working, not for editing the app: code changed since the build is
// not served until the next `npm run work`, and the page does not reload itself
// when a file changes (the watcher is development-only).
//
// A hard kill of this launcher (Task Manager, a closed terminal, kill -9) ends
// it before any handler runs, and both servers carry on holding their ports, so
// the next start failed with the port in use. That kill cannot be caught, so it
// is handled on the next start: each run writes its process ids to
// .claude/hooks/state/dev-servers.json, and a start finding a previous run's servers still
// alive, with their launcher gone, stops them first.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_BASE, ADMIN_DIR, ADMIN_ORIGIN, ADMIN_PORT, ADMIN_PRESENT } from '../config/admin.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';

const ux = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = join(ux, 'node_modules', 'next', 'dist', 'bin', 'next');
// The install missing, said plainly with its fix, before anything starts. On
// 2026-10-07 the shared ux/node_modules was emptied (a worktree removed through
// its link; lib/branches.mjs now takes the link out first), the servers already
// running answered every page with a bare 500, and the next start died on a
// MODULE_NOT_FOUND stack that did not say what to do.
if (!existsSync(next)) {
  console.error("The dashboard's packages are missing (no Next in ux/node_modules), so nothing can start. Reinstall them from the lockfile, in ux/:\n  npm ci\nthen run this again.");
  process.exit(1);
}

const DASHBOARD_PORT = Number(process.env.DEAR_PORT) || 3220;
const WORK = process.argv.includes('--work');
const SERVE = WORK ? 'start' : 'dev';
// Production first needs a build of each app, done before any server starts.
const build = (cwd, label) => {
  console.log(`Building ${label}…`);
  return spawnSync(process.execPath, [next, 'build'], { cwd, stdio: 'inherit' }).status === 0;
};
// Kept in .claude/hooks/state/, not temp/: a later start relies on it (ARC-014).
const RUN_FILE = join(ux, '..', '.claude', 'hooks', 'state', 'dev-servers.json');
const WINDOWS = process.platform === 'win32';

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
// A recorded id may since have been handed to another program: only a node
// process is taken to be one of ours.
const isNode = (pid) => {
  const r = WINDOWS
    ? spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' })
    : spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' });
  return /\bnode(\.exe)?\b/i.test(r.stdout ?? '');
};
// On Windows a child's own children survive a plain kill, so the whole tree is ended.
const stopTree = (pid) => {
  if (WINDOWS) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
};

let previous = null;
try {
  previous = JSON.parse(readFileSync(RUN_FILE, 'utf8'));
} catch {
  // no previous run on record
}
if (previous) {
  const servers = (previous.servers ?? []).filter((pid) => Number.isInteger(pid) && alive(pid) && isNode(pid));
  if (Number.isInteger(previous.launcher) && alive(previous.launcher) && isNode(previous.launcher)) {
    // A run started by a chat in the background has no terminal to Ctrl+C in, so
    // the message carries the command that stops it (2026-10-07): the whole tree,
    // since on Windows a server's own child holds the port and outlives a plain stop.
    const stop = WINDOWS
      ? `taskkill /T /F ${[previous.launcher, ...servers].map((pid) => `/PID ${pid}`).join(' ')}`
      : `kill ${[previous.launcher, ...servers].join(' ')}`;
    if (servers.length) console.error(`A previous \`npm run dev\` is still running (process ${previous.launcher}); its servers are left alone. If the ports are in use, stop it first:\n  ${stop}\nthen run this again.`);
  } else if (servers.length) {
    servers.forEach(stopTree);
    console.log(`Stopped ${servers.length} server${servers.length > 1 ? 's' : ''} a previous run left behind (process ${servers.join(', ')}).`);
  }
}

// A build writes over the .next a running copy is serving, so work mode will not
// start beside one; and the dashboard is built before anything takes a port.
if (WORK) {
  if (previous && Number.isInteger(previous.launcher) && alive(previous.launcher) && isNode(previous.launcher)) {
    console.error(`npm run work builds the apps, and a previous run is still serving them (process ${previous.launcher}). Stop it first.`);
    process.exit(1);
  }
  if (!build(ux, 'the dashboard')) {
    console.error('The dashboard did not build; nothing started.');
    process.exit(1);
  }
}

let admin = null;
if (ADMIN_PRESENT) {
  const linked = spawnSync(process.execPath, [join(ADMIN_DIR, 'scripts', 'link-deps.mjs')], { stdio: 'inherit' });
  if (WORK && linked.status === 0 && !build(ADMIN_DIR, 'the admin app')) {
    console.error('[admin] did not build; the dashboard carries on, and /admin says so.');
  } else if (linked.status === 0) {
    admin = spawn(process.execPath, [next, SERVE, '-p', String(ADMIN_PORT), '-H', '127.0.0.1'], { cwd: ADMIN_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    const prefix = (stream, out) =>
      stream.on('data', (chunk) => out.write(String(chunk).replace(/^(?=.)/gm, '[admin] ')));
    prefix(admin.stdout, process.stdout);
    prefix(admin.stderr, process.stderr);
    admin.on('exit', (code) => {
      if (code) console.error(`[admin] stopped (exit ${code}); the dashboard carries on, and /admin says so.`);
      admin = null;
    });
  } else {
    console.error('[admin] not started: its install link failed; the dashboard carries on.');
  }
}

const dashboard = spawn(process.execPath, [next, SERVE, '-p', String(DASHBOARD_PORT), '-H', '127.0.0.1'], { cwd: ux, stdio: 'inherit' });

try {
  mkdirSync(dirname(RUN_FILE), { recursive: true });
  writeFileSync(RUN_FILE, JSON.stringify({ launcher: process.pid, servers: [admin?.pid, dashboard.pid].filter(Boolean) }));
} catch (e) {
  console.error(`Could not record this run's servers (${e.message}); a hard kill will leave them running.`);
}

// ── Warming what can be warmed without a session (DES-008) ──────────────────
//
// `next dev` compiles a route the first time it is requested, and the first
// click on each tab paid that compile on top of its render (2026-10-07 audit).
// The usual cure, and the one another project's dashboard script uses, is to
// request every route once at start. It signs in first, through its real login
// endpoint with an account read from .env.local, because its gate rewrites an
// unauthenticated request to /login exactly as ux/proxy.js does here.
//
// This launcher does not sign in, and never will hold a credential to do it
// with. Without a session every gated route is answered with the login page
// before its own code is reached, so requesting /timeline compiles the proxy
// and /login and nothing of the timeline. So what is warmed is what an
// unauthenticated request genuinely compiles: the gate, the root layout, the
// login page and its client assets, on the dashboard and on the admin app. The
// views behind the gate are NOT warmed and still compile on their first click,
// which is what a sign-in is: the login page answering at once, rather than
// after its own cold compile, is the part of a cold start this can reach.
//
// Development only: `npm run work` serves builds, which have nothing to
// compile. Fire and forget: nothing waits on it, and every failure is
// swallowed, because a page that fails to warm still works and pays its own
// compile on first click, as it always did.
const WARM_TIMEOUT_MS = 90_000; // per request: each may be paying a cold compile
const READY_TIMEOUT_MS = 120_000; // for the server to start answering at all

async function warmOnce(url) {
  const until = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < until) {
    try {
      // The first answer is the warm request itself: the server only answers
      // /login once it has compiled it.
      await fetch(url, { signal: AbortSignal.timeout(WARM_TIMEOUT_MS) });
      return;
    } catch {
      // Not listening yet. Try again shortly.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

// ── A slow server says why (DES-008, design 4) ───────────────────────────────
//
// On 2026-10-07 the admin app answered every click in 4 to 5 seconds, and kept
// a core busy while idle: five agent worktrees sat in .claude/worktrees, 28,000
// files its bundler watched, since its root is the whole repository. Nothing
// said so; the developer found it by feeling it. So once warm, each app's login
// page is asked for again and timed, and over the budget the launcher says how
// slow, names any worktrees inside the repository with their file count, and
// gives the command that clears them.
const ANSWER_MS = threshold('speed.devAnswer', 'ms');
// Files counted across all the worktrees before the count stops: it only has
// to say "thousands", and the walk is synchronous.
const COUNT_CAP = 200_000;

// The repository's other worktrees that sit inside it, from git's own list.
// Agent worktrees land in .claude/worktrees, but any worktree under the root is
// watched the same way.
function worktreesInside() {
  const top = join(ux, '..').replace(/\\/g, '/').toLowerCase();
  const listed = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ux, encoding: 'utf8' }).stdout ?? '';
  return listed
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim())
    .filter((path) => {
      const p = path.replace(/\\/g, '/').toLowerCase();
      return p !== top && p.startsWith(`${top}/`);
    });
}

// Files under each folder, links not followed (a worktree's linked node_modules
// counts as one), sharing one cap across them all.
function countFiles(dirs) {
  let total = 0;
  const counts = dirs.map((dir) => {
    let n = 0;
    const stack = [dir];
    while (stack.length && total < COUNT_CAP) {
      const at = stack.pop();
      let entries = [];
      try {
        entries = readdirSync(at, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.isDirectory()) stack.push(join(at, e.name));
        else {
          n += 1;
          total += 1;
        }
      }
    }
    return { dir, files: n };
  });
  return { counts, capped: total >= COUNT_CAP };
}

function slowServerNote(slow, found) {
  const apps = slow.map(({ label, ms }) => `${label} answered in ${(ms / 1000).toFixed(1)} s`).join(' and ');
  const head = `${apps[0].toUpperCase()}${apps.slice(1)}, over the ${ANSWER_MS} ms budget (DES-008).`;
  if (!found.counts.length) return `${head} No worktree inside the repository explains it: stop and start again, or use npm run work.`;
  const n = (files) => `${files.toLocaleString('en')}${found.capped ? '+' : ''}`;
  const each = found.counts.map(({ dir, files }) => `  ${dir} (${n(files)} files)`).join('\n');
  const many = found.counts.length > 1;
  return `${head} ${found.counts.length} worktree${many ? 's' : ''} inside the repository, all watched:\n${each}\nClear ${many ? 'them' : 'it'} with npm run git:reconcile in ux/, then start again.`;
}

async function answerTime(url) {
  const t = performance.now();
  try {
    await fetch(url, { signal: AbortSignal.timeout(WARM_TIMEOUT_MS) });
  } catch {
    return null;
  }
  return performance.now() - t;
}

if (!WORK) {
  // Serially, the dashboard first: it is what opens first, and Next compiles
  // one request at a time per server anyway. Then each is timed once warm, and
  // a slow one is explained once for both.
  (async () => {
    const apps = [['the dashboard', `http://127.0.0.1:${DASHBOARD_PORT}/login`]];
    if (admin) apps.push(['the admin app', `${ADMIN_ORIGIN}${ADMIN_BASE}/login`]);
    for (const [, url] of apps) await warmOnce(url);
    if (!ANSWER_MS) return;
    const slow = [];
    for (const [label, url] of apps) {
      const ms = await answerTime(url);
      if (ms != null && ms > ANSWER_MS) slow.push({ label, ms });
    }
    if (slow.length) console.error(`[speed] ${slowServerNote(slow, countFiles(worktreesInside()))}`);
  })().catch(() => {});
}

// Stop the admin app with the dashboard.
function stopAdmin() {
  if (!admin) return;
  if (WINDOWS) stopTree(admin.pid);
  else admin.kill('SIGTERM');
  admin = null;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAdmin();
    dashboard.kill(signal);
  });
}
dashboard.on('exit', (code) => {
  stopAdmin();
  rmSync(RUN_FILE, { force: true });
  process.exit(code ?? 0);
});
