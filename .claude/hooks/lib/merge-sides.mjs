// A merge must keep both of its sides. Read by git/pre-push before anything reaches main.
//
// On 2026-11-03 merge f5041f36 recorded a clash ("# Conflicts:" with nothing listed) and
// committed its first parent's files unchanged: the second parent's Transcript entries, a
// script fix and its test, a session-reviews line and a skill fix were gone, and nothing
// noticed, because a merge git is told to commit runs no check that compares it with its
// parents. Several chats push to main at once, so a merge is made on every pull.
//
// Each merge in the pushed range is made again from its two parents, without a working
// tree (`git merge-tree --write-tree`, git 2.38+). Every path where the committed merge
// differs from that remade one is then looked at, and is a lost side when the committed
// file is one parent's version exactly while the other parent had changed it from the
// merge base (a file kept, deleted or left out whole). Hand-merged content that is
// neither side passes, and so does a path where the remade merge agrees with the commit.
// A lost side is excused only when it is not lost: the file moved to a path the merge
// added (a renumbered card), a later commit in the same push put the change back (the
// way to fix a merge without rewriting history), or a pushed message says, for that path,
// "Kept one side: <path>" (two chats wrote the same fix, and one copy was kept on purpose)
// and keeping it lost nothing: the dropped side's change from the merge base is already in
// the kept version (contained() below). Said of a real loss, the line excuses nothing, and
// the refusal says so for that path (2026-11-04, T-711: three merges had used it to drop a
// differently worded comment, a test line and an idea's notes).
// Only paths and the fix are named, never content: her record (data/) is checked too,
// since it must not lose a side either.
//
// The Transcript's own driver (merge=dialogue) reads HEAD and MERGE_HEAD and notes moved
// numbers in the working tree, so it cannot remake a past merge: here those paths merge
// as plain text, as its own fallback does, and a clash there is judged like any other.
// The union drivers are git's own and run as configured.
//
// Generated pages are exempt: dev/dialogue/agreements.md, its pages in
// dev/dialogue/agreements/ (T-768) and dev/dialogue/index/*.md are
// rebuilt from the merged Transcript after a merge (dialogue.mjs build), so they rightly
// equal neither side, or one side when the other's change to them is regenerated away;
// whether they match the Transcript is `dialogue.mjs check`'s, in the commit gate.
// A merge reconcile() makes to retire an idle branch into main's history keeps main's
// files on purpose (lib/branches.mjs, `chore(git): retire`), and is exempt by its subject.

import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GENERATED = [/^dev\/dialogue\/agreements\.md$/, /^dev\/dialogue\/agreements\/[^/]+\.md$/, /^dev\/dialogue\/index\/[^/]+\.md$/];
const RETIRE = /^chore\(git\): retire /;
const ZERO = /^0+$/;
// Plain text merge for the Transcript's driver, which cannot run outside a live merge.
const TEXT_DRIVER = ['-c', 'merge.dialogue.driver=git merge-file -q %A %O %B'];

function git(cwd, args, ok = [0]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (!ok.includes(r.status)) throw new Error(`git ${args[0]} failed: ${(r.stderr || '').trim().split('\n')[0]}`);
  return { out: r.stdout, status: r.status };
}

/** Blob id (or null where absent) of each path in a commit or tree. */
function blobs(cwd, rev, paths) {
  const map = new Map(paths.map((p) => [p, null]));
  if (!paths.length) return map;
  // ls-tree names each path asked for; a missing one is simply not listed.
  for (let i = 0; i < paths.length; i += 200) {
    const out = git(cwd, ['ls-tree', '-z', '--full-tree', rev, '--', ...paths.slice(i, i + 200)]).out;
    for (const rec of out.split('\0').filter(Boolean)) {
      const tab = rec.indexOf('\t');
      const [, type, id] = rec.slice(0, tab).split(' ');
      if (type === 'blob') map.set(rec.slice(tab + 1), id);
    }
  }
  return map;
}

/**
 * The paths a two-parent merge commit lost a side of: [{ path, kept: 1|2, conflicted }].
 * `kept` is the parent whose version the commit holds whole; the other parent's change
 * is the one lost. Empty for a sound merge, an exempt one, or one that cannot be remade.
 * `opts.tip`: the commit being pushed, where a later fix may have put the side back;
 * `opts.notes`: the messages of the commits pushed with it, read for "Kept one side: <path>".
 */
export function lostSides(cwd, merge, opts = {}) {
  const [line] = git(cwd, ['rev-list', '--parents', '-n', '1', merge]).out.trim().split('\n');
  const [, p1, p2, ...more] = line.split(' ');
  if (!p2 || more.length) return [];
  if (RETIRE.test(git(cwd, ['log', '-1', '--format=%s', merge]).out)) return [];
  const bases = git(cwd, ['merge-base', '--all', p1, p2], [0, 1]).out.trim().split('\n').filter(Boolean);
  if (!bases.length) return [];
  const mt = git(cwd, [...TEXT_DRIVER, 'merge-tree', '--write-tree', '--name-only', '--no-messages', '-z', p1, p2], [0, 1]);
  const [tree, ...conflictedList] = mt.out.split('\0').filter(Boolean);
  if (!/^[0-9a-f]{40,64}$/.test(tree)) return [];
  const conflicted = new Set(conflictedList);
  const differ = git(cwd, ['diff', '--name-only', '--no-renames', '-z', tree, merge]).out.split('\0').filter(Boolean);
  const paths = [...new Set([...differ, ...conflicted])].filter((p) => !GENERATED.some((re) => re.test(p)));
  if (!paths.length) return [];
  // With several merge bases, a side "changed" a path if it differs from every one of them.
  const at = { m: blobs(cwd, merge, paths), p1: blobs(cwd, p1, paths), p2: blobs(cwd, p2, paths) };
  const baseMaps = bases.map((b) => blobs(cwd, b, paths));
  const changed = (side, p) => baseMaps.every((b) => b.get(p) !== at[side].get(p));
  const lost = [];
  for (const p of paths) {
    const [m, a, b] = [at.m.get(p), at.p1.get(p), at.p2.get(p)];
    if (a === b) continue;
    if (m === a && changed('p2', p)) lost.push({ path: p, kept: 1, conflicted: conflicted.has(p) });
    else if (m === b && changed('p1', p)) lost.push({ path: p, kept: 2, conflicted: conflicted.has(p) });
  }
  if (!lost.length) return [];
  // Kept on purpose, said in the merge's message or a later pushed one: one line a path.
  // The line is believed only where keeping one side truly lost nothing (2026-11-04, T-711):
  // the dropped side's change from the merge base is already in the kept version. Said for
  // a real loss, the path stays refused and is marked so the refusal says the line can't
  // excuse it.
  const notes = `${git(cwd, ['log', '-1', '--format=%B', merge]).out}\n${opts.notes ?? ''}`;
  const declared = new Set([...notes.matchAll(/^Kept one side: (.+?)\s*$/gm)].map((x) => x[1]));
  const excused = (l) => {
    if (!declared.has(l.path)) return false;
    const [kept, dropped] = l.kept === 1 ? [at.p1, at.p2] : [at.p2, at.p1];
    const ok = bases.every((b, i) => contained(cwd, baseMaps[i].get(l.path), dropped.get(l.path), kept.get(l.path)));
    if (!ok) l.declared = true;
    return ok;
  };
  // Moved, not lost: two chats that each added the same card number have one renumbered by
  // the merge (dialogue.mjs resolve, 2026-11-03: E-115 kept, the other side's card made E-116).
  // A lost side whose file reappears, mostly the same, at a path the merge added is kept.
  const listed = (args) => git(cwd, args).out.split('\0').filter(Boolean);
  const addedBy = (side) => new Set(listed(['diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', side, merge]));
  const fromP1 = addedBy(p1);
  const added = [...addedBy(p2)].filter((p) => fromP1.has(p));
  const moved = (l) => {
    if (!added.length) return false;
    const recs = listed(['diff', '--name-status', '-z', '-C50%', '--find-copies-harder', l.kept === 1 ? p2 : p1, merge, '--', l.path, ...added]);
    for (let i = 0; i < recs.length; i += 1) {
      if (/^[CR]\d*$/.test(recs[i])) {
        if (recs[i + 1] === l.path && added.includes(recs[i + 2])) return true;
        i += 2;
      } else i += 1;
    }
    return false;
  };
  // Put back since: a merge already made cannot be redone without rewriting history, so the
  // fix is a later commit that brings the lost side's change back. At the pushed tip the file
  // is then judged as a merge's is: no longer the kept side whole, and not the other side
  // whole either while the kept side had changed it, it counts as merged by hand.
  const tip = opts.tip && opts.tip !== merge ? opts.tip : null;
  const tipBlobs = tip ? blobs(cwd, tip, lost.map((l) => l.path)) : new Map();
  const repaired = (l) => {
    if (!tip) return false;
    const now = tipBlobs.get(l.path);
    const [kept, other] = l.kept === 1 ? [at.p1, at.p2] : [at.p2, at.p1];
    if (now === kept.get(l.path)) return false;
    return !(now === other.get(l.path) && changed(l.kept === 1 ? 'p1' : 'p2', l.path));
  };
  return lost.filter((l) => !moved(l) && !repaired(l) && !excused(l));
}

const text = (cwd, id) => (id ? git(cwd, ['cat-file', 'blob', id]).out : '');
const tally = (s) => {
  const n = new Map();
  for (const line of s.split('\n')) n.set(line.trimEnd(), (n.get(line.trimEnd()) ?? 0) + 1);
  return n;
};

/**
 * Whether the dropped side's change from the base (blob ids, null where absent) is
 * already in the kept version, so keeping one side lost nothing. Either test will do:
 * merging the dropped side into the kept one changes nothing (both sides made the same
 * change, wherever the kept side changed more), or, line by line, every line the dropped
 * side added is in the kept file as often, and no line it removed came back. Words the
 * dropped side wrote that the kept file does not hold are a loss, however alike in meaning.
 */
export function contained(cwd, base, dropped, kept) {
  if (dropped === kept || dropped === base) return true;
  const k = text(cwd, kept);
  if (base && dropped && kept) {
    // git 2.43+; an older git answers by the line test alone.
    const r = spawnSync('git', ['merge-file', '-p', '--object-id', kept, base, dropped], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0 && r.stdout === k) return true;
  }
  const [b, d, kk] = [tally(text(cwd, base)), tally(text(cwd, dropped)), tally(k)];
  for (const [line, n] of d) if (n > (b.get(line) ?? 0) && (kk.get(line) ?? 0) < n) return false;
  for (const [line, n] of b) if ((d.get(line) ?? 0) < n && (kk.get(line) ?? 0) > (d.get(line) ?? 0)) return false;
  return true;
}

/** Merge commits a push would add to a remote branch, and the messages of every commit it adds. */
export function pushed(cwd, localSha, remoteSha) {
  if (!localSha || ZERO.test(localSha)) return { merges: [], notes: '' };
  const known = remoteSha && !ZERO.test(remoteSha) && git(cwd, ['cat-file', '-e', `${remoteSha}^{commit}`], [0, 1, 128]).status === 0;
  const not = known ? [`^${remoteSha}`] : ['--not', '--remotes=origin'];
  return {
    merges: git(cwd, ['rev-list', '--merges', localSha, ...not]).out.split('\n').filter(Boolean),
    notes: git(cwd, ['log', '--format=%B', localSha, ...not]).out,
  };
}

/** Every merge a push to main would add that lost a side: [{ merge, lost }]. */
export function checkPush(cwd, localSha, remoteSha) {
  const { merges, notes } = pushed(cwd, localSha, remoteSha);
  return merges.map((merge) => ({ merge, lost: lostSides(cwd, merge, { tip: localSha, notes }) })).filter((f) => f.lost.length);
}

/** The refusal, naming each merge and path, and no content. */
export function describe(found) {
  const lines = [];
  for (const { merge, lost } of found) {
    lines.push(`  merge ${merge.slice(0, 8)} lost one side of:`);
    for (const l of lost) {
      lines.push(`    - ${l.path} (kept parent ${l.kept}'s version whole${l.conflicted ? ', a conflicted file' : ''})`);
      if (l.declared) lines.push(`      "Kept one side: ${l.path}" can't excuse a real loss: the dropped side's change is not in the kept version`);
    }
  }
  return lines.join('\n');
}

// For a scan by hand: node .claude/hooks/lib/merge-sides.mjs <merge>...
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const found = process.argv.slice(2).map((m) => ({ merge: git(cwd, ['rev-parse', m]).out.trim(), lost: lostSides(cwd, m) })).filter((f) => f.lost.length);
  if (found.length) console.log(describe(found));
  process.exit(found.length ? 1 : 0);
}
