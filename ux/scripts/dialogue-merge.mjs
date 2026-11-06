// The Transcript's merge driver, the numbers a merge moved, and eval cards two
// chats both added: moved whole out of dialogue.mjs (HYG-002), which still runs
// it (`dialogue.mjs merge-driver`, `resolve`, `moved`) and re-exports it.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { DEV_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { readCards } from './evals.mjs';
import { spawnSync } from 'node:child_process';
import { REPO, indexStale, parseTranscript, readTranscript, renderIndex, writeIndex } from './dialogue.mjs';
import { agreementsStale, renderAgreementParts, writeAgreements } from './dialogue-agreements.mjs';
import { ONE_READ, PART_FILE, lineCount, partOf, sortParts } from '../../.claude/hooks/lib/transcript-parts.mjs';

// ── Merging the Transcript ──────────────────────────────────────────────────
// Each chat's hook numbers a remark from its own copy of the month, so two
// chats appending at once take the same T- (and A-) numbers and every pull
// conflicted: settled by hand more than ten times in one chat on 2026-10-27
// (T-288). A git merge driver (wired in .gitattributes, configured by the
// session brief) settles it inside the pull, so the pull never stops:
// main's side whole, in its order; this chat's changes to entries main left
// alone, and its removals of them; this chat's new entries after main's, less
// any main already holds under other numbers; and only the numbers that
// clash moved, with this chat's own references to them. One entry changed
// two ways is never guessed: that stays a conflict, for `resolve` to report.
// The Agreements are generated, the index at agreements.md and every page in agreements/
// (T-768), so each one's merge is a rebuild from the merged months.

// A month's every part (T-499): `2026-10.md`, `2026-10-2.md`… each merged as a file of its own.
const MONTH_PATH = new RegExp(`^${DEV_DIR}/dialogue/transcript/(${PART_FILE.source.slice(1, -1)})$`);
const AGREEMENTS_PATH = `${DEV_DIR}/dialogue/agreements.md`;
/** The index and every page of the Agreements; the match is the page's path inside the dialogue folder. */
const AGREEMENTS_PAGE = new RegExp(`^${DEV_DIR}/dialogue/(agreements\\.md|agreements/[\\w-]+\\.md)$`);
const INDEX_PATH = new RegExp(`^${DEV_DIR}/dialogue/index/([\\w-]+\\.md)$`);
const ID = /\b([TA])-(\d+)\b/g;

/** A month's text as its heading text and its entries, each matched across versions by number, date and first quoted line. */
function splitEntries(text) {
  // Trailing blank lines are spacing, not content: the last entry of a file has none.
  const parts = String(text ?? '').split(/^(?=### T-\d+ · )/m).map((t) => t.replace(/\n*$/, '\n'));
  const pre = parts[0].startsWith('### T-') ? '' : parts.shift().replace(/^\n$/, '');
  const seen = new Map();
  const entries = parts.map((t) => {
    const [head] = t.split('\n');
    const quote = (t.split('\n').find((l) => l.startsWith('> ')) ?? '').trim();
    const base = `${head.match(/^### (T-\d+) · (\S+)/)?.slice(1).join(' ')} ${quote}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: `${base} #${n}`, id: head.match(/^### (T-\d+)/)[1], text: t };
  });
  return { pre, entries };
}

/** A remark is its date and its first quoted line: what stays when its number moves or it is sorted. */
const remarkOf = (e) => e.key.replace(/^T-\d+ /, '').replace(/ #\d+$/, '');
/** How often each remark comes in these entries, or in this text. */
export function remarkCounts(from) {
  const n = new Map();
  for (const e of typeof from === 'string' ? splitEntries(from).entries : from) n.set(remarkOf(e), (n.get(remarkOf(e)) ?? 0) + 1);
  return n;
}

/** An entry's text with its numbers taken out, to know one entry under two numberings. */
const sameEntry = (text) => String(text).replace(ID, '#');
export const cardIds = (text) => [...String(text).matchAll(/^- \*\*Card (A-\d+)\*\*/gm)].map((m) => m[1]);
const headIds = (text) => [...String(text).matchAll(/^### (T-\d+) · /gm)].map((m) => m[1]);
/** The highest T- and A- number in these texts. */
export function highestIds(texts) {
  const top = { T: 0, A: 0 };
  for (const t of texts) {
    for (const id of [...headIds(t), ...cardIds(t)]) top[id[0]] = Math.max(top[id[0]], Number(id.slice(2)));
  }
  return top;
}

/** A three-way merge of one piece of text: the side that changed wins; both changed, git's own line merge, or null on a conflict. */
function merge3(base, ours, theirs) {
  if (ours === theirs || theirs === base) return ours;
  if (ours === base) return theirs;
  const tmp = makeTemp('dear-dialogue-merge-');
  try {
    const [o, b, t] = ['ours', 'base', 'theirs'].map((n, i) => {
      writeFileSync(join(tmp, n), [ours, base, theirs][i]);
      return join(tmp, n);
    });
    const run = spawnSync('git', ['merge-file', '-p', o, b, t], { encoding: 'utf8' });
    return run.status === 0 ? run.stdout : null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Merge one month of the Transcript. `floor` is the highest number taken in
 * the other months, so a fresh number is free across the whole Transcript, and
 * `taken` the numbers main's other months already give out, so a clash across
 * a month boundary moves too. `elsewhere` is the text of main's other parts of
 * this month (T-499): an entry main moved there, when a month was cut into parts,
 * is held by main, neither this chat's new entry nor a remark lost.
 * Returns { clean, text, moved, pairs } or { clean: false, why }.
 */
export function mergeTranscript({ base = '', ours = '', theirs = '', floor = { T: 0, A: 0 }, taken = { T: [], A: [] }, elsewhere = '', lost = new Set() }) {
  const B = splitEntries(base);
  const O = splitEntries(ours);
  const H = splitEntries(theirs);
  const inElsewhere = new Map(splitEntries(elsewhere).entries.map((e) => [e.key, e.text]));
  const pre = merge3(B.pre, O.pre, H.pre);
  if (pre === null) return { clean: false, why: 'both sides changed the text above the entries' };
  const inBase = new Map(B.entries.map((e) => [e.key, e.text]));
  const inTheirs = new Map(H.entries.map((e) => [e.key, e.text]));
  // A sorted entry the other side already holds under other numbers (a merge moved them)
  // is that entry, not a new one: kept twice, 24 copies came back on every merge (2026-10-29).
  const theirsAsText = new Set(H.entries.map((e) => sameEntry(e.text)));
  // And the other way round: main's entry that this chat holds under other numbers was
  // moved here, not removed. Read as removed, while this chat's copy was dropped as
  // main's, both went: six remarks lost in one merge (2026-10-30, cc3b5320).
  // Only this chat's entries under numbers neither base nor main has count: a copy
  // removed here beside one kept under its own number is still a removal.
  const oursAsText = new Set(O.entries.filter((e) => !inBase.has(e.key) && !inTheirs.has(e.key)).map((e) => sameEntry(e.text)));
  // `lost`: remarks an earlier merge on this chat's side dropped though both its parents
  // held them (droppedByMerges). Gone from here by a loss, not a removal, so main's copy
  // comes back: in cc3b5320 (2026-10-30) three of the six were lost so, in d9bd8082.
  // A remark this chat holds again (put back by hand) is no longer lost.
  const oursRemarks = remarkCounts(O.entries);
  const removedHere = (e) => !oursAsText.has(sameEntry(e.text)) && !(lost.has(remarkOf(e)) && !oursRemarks.has(remarkOf(e)));
  const oursNew = O.entries.filter((e) => !inBase.has(e.key) && !(inTheirs.get(e.key) === e.text) && !(inElsewhere.get(e.key) === e.text) && !(/^- \*\*Gist:\*\*/m.test(e.text) && theirsAsText.has(sameEntry(e.text))));
  const clash = oursNew.find((e) => inTheirs.has(e.key) || inElsewhere.has(e.key));
  if (clash) return { clean: false, why: `${clash.id} was added on both sides with different text` };
  // Only this chat's own new numbers can clash: main's are kept, since other chats may cite them.
  const own = O.entries.filter((e) => inBase.get(e.key) !== e.text);
  // Main's other months count too: a chat still writing October can take a number main gave out in November.
  const theirsHas = { T: new Set([...headIds(theirs), ...taken.T]), A: new Set([...cardIds(theirs), ...taken.A]) };
  const baseCards = new Set(cardIds(base));
  const next = highestIds([base, ours, theirs]);
  next.T = Math.max(next.T, floor.T);
  next.A = Math.max(next.A, floor.A);
  const map = new Map();
  const fresh = (id) => {
    if (!map.has(id)) map.set(id, `${id[0]}-${String((next[id[0]] += 1)).padStart(3, '0')}`);
  };
  for (const e of oursNew) if (theirsHas.T.has(e.id)) fresh(e.id);
  for (const e of own) for (const a of cardIds(e.text)) if (!baseCards.has(a) && theirsHas.A.has(a)) fresh(a);
  const moveRefs = (text) => (map.size ? text.replace(ID, (m) => map.get(m) ?? m) : text);
  const oursText = new Map(O.entries.map((e) => [e.key, inBase.get(e.key) === e.text ? e.text : moveRefs(e.text)]));

  const out = [];
  for (const h of H.entries) {
    const b = inBase.get(h.key);
    const o = oursText.get(h.key);
    // Removed here and left alone there stays removed; changed there, it is kept.
    if (b !== undefined && o === undefined && h.text === b && removedHere(h)) continue;
    if (b === undefined || o === undefined) out.push(h.text);
    else {
      const m = merge3(b, o, h.text);
      if (m === null) return { clean: false, why: `${h.id} was changed on both sides` };
      out.push(m);
    }
  }
  for (const [key, b] of inBase) {
    if (!inTheirs.has(key) && oursText.has(key) && oursText.get(key) !== b) return { clean: false, why: `${key.split(' ')[0]} was changed here and removed on main` };
  }
  for (const e of oursNew) out.push(oursText.get(e.key));
  const text = [pre, ...out].filter((p) => p !== '').join('\n');
  // Every remark either side holds is in the result, as often as the side holding it
  // most: a remark is its date and its first quoted line. Only one removed here, the
  // other side leaving it alone, may go. Anything else lost is a conflict, never a write.
  const kept = remarkCounts([...splitEntries(text).entries, ...splitEntries(elsewhere).entries]);
  const removed = remarkCounts(B.entries.filter((e) => !oursText.has(e.key) && inTheirs.get(e.key) === e.text && removedHere(e)));
  for (const side of [remarkCounts(O.entries), remarkCounts(H.entries)]) {
    for (const [r, n] of side) {
      if ((kept.get(r) ?? 0) + (removed.get(r) ?? 0) < n) return { clean: false, why: `a remark of ${r.split(' ')[0]} would be lost` };
    }
  }
  return { clean: true, text, moved: [...map].map(([a, b]) => `${a} → ${b}`), pairs: [...map] };
}

/** Point this repository's `merge=dialogue` paths at the driver (the session brief runs it at every start). */
export function setMergeDriver(cwd, script = join(REPO, 'ux', 'scripts', 'dialogue.mjs')) {
  const rel = relative(cwd, script).replace(/\\/g, '/');
  const want = `node "${rel.startsWith('..') ? script.replace(/\\/g, '/') : rel}" merge-driver %O %A %B %P`;
  const git = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  if (git('config', '--get', 'merge.dialogue.driver').stdout.trim() !== want) {
    git('config', 'merge.dialogue.name', 'the Transcript, merged by entry (dialogue.mjs)');
    git('config', 'merge.dialogue.driver', want);
  }
}

export const gitIn = (cwd, ...a) => {
  const run = spawnSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : null;
};
/** The commit being merged in, which git names in GITHEAD_<sha> for a merge's drivers. */
const incoming = (cwd) => {
  const head = (gitIn(cwd, 'rev-parse', 'HEAD') ?? '').trim();
  return Object.keys(process.env).map((k) => k.match(/^GITHEAD_([0-9a-f]{40,64})$/)?.[1]).find((sha) => sha && sha !== head) ?? null;
};
const monthsAt = (cwd, ref) =>
  ref ? (gitIn(cwd, 'ls-tree', '--name-only', ref, `${DEV_DIR}/dialogue/transcript/`) ?? '').split('\n').filter((p) => MONTH_PATH.test(p)) : [];
const blob = (cwd, ref, path) => (ref ? (gitIn(cwd, 'show', `${ref}:${path}`) ?? '') : '');
/** The highest numbers in every month but this one, on both sides. */
const floorBeside = (cwd, path, refs) => highestIds(refs.flatMap((r) => monthsAt(cwd, r).filter((p) => p !== path).map((p) => blob(cwd, r, p))));
/** Main's other parts of this path's month, as one text (T-499). */
const siblingsAt = (cwd, path, ref) => {
  const { month } = partOf(path);
  return monthsAt(cwd, ref).filter((p) => p !== path && partOf(p).month === month).map((p) => blob(cwd, ref, p)).join('\n');
};
/** The numbers main's other months give out: a clash across a month boundary is still a clash. */
const takenBeside = (cwd, path, ref) => {
  const texts = monthsAt(cwd, ref).filter((p) => p !== path).map((p) => blob(cwd, ref, p));
  return { T: texts.flatMap(headIds), A: texts.flatMap(cardIds) };
};

// ── Remarks a merge lost ────────────────────────────────────────────────────
// A remark both parents of a merge hold is in neither side's power to remove, so a
// merge without it lost it. cc3b5320 (2026-10-30) lost six: three by the driver's
// reading then (fixed in abd0cf84), and three a merge on this chat's side had lost
// twenty minutes before (d9bd8082), which the next merge then read as removed here.

/** Every month of the Transcript at a commit, as one text. */
const transcriptAt = (cwd, ref) => monthsAt(cwd, ref).map((p) => blob(cwd, ref, p)).join('\n');
/**
 * [remark, how often the result must hold it] for each remark it holds fewer times.
 * A remark every parent holds stays. So does one a side added since the sides
 * parted, unless the other removed it: on 3 Nov a merge kept one side of the whole
 * dialogue folder (f5041f36), and three remarks only the other side had added went
 * with it, unseen, since no parent but one held them.
 */
function lostIn(cwd, parents, result) {
  const sides = parents.map((p) => remarkCounts(transcriptAt(cwd, p)));
  const base = parents.length > 1 ? (gitIn(cwd, 'merge-base', ...parents) ?? '').trim().split('\n')[0] : '';
  const before = base ? remarkCounts(transcriptAt(cwd, base)) : null;
  const out = [];
  for (const r of new Set(sides.flatMap((s) => [...s.keys()]))) {
    const counts = sides.map((s) => s.get(r) ?? 0);
    const b = before?.get(r) ?? 0;
    const need = before && Math.min(...counts) >= b ? Math.max(...counts) : Math.min(...counts);
    if ((result.get(r) ?? 0) < need) out.push([r, need]);
  }
  return out;
}
/** Merge commits in from..to, newest first, each as [sha, ...parents]; at most `cap`. */
const mergesIn = (cwd, from, to, cap = 50) =>
  from && to ? (gitIn(cwd, 'rev-list', '--merges', '--parents', `--max-count=${cap}`, `${from}..${to}`) ?? '').split('\n').filter(Boolean).map((l) => l.split(' ')) : [];

/** Remarks a merge in base..ours dropped though every parent held them: lost there, never removed. */
export function droppedByMerges(cwd, base, ours) {
  const out = new Set();
  for (const [m, ...parents] of mergesIn(cwd, base, ours)) for (const [r] of lostIn(cwd, parents, remarkCounts(transcriptAt(cwd, m)))) out.add(r);
  return out;
}

/**
 * For `check`: a remark both parents hold that a merge lost, in the merge under way
 * (its result is the tree at `root`) or one not yet pushed (`since`..HEAD) and still
 * missing from the tree. `gitRoot` answers git; `root` holds the files (the commit
 * gate reads a copy of the index). Returns the faults, one line each.
 */
export function mergeLosses({ gitRoot = REPO, root = gitRoot, since } = {}) {
  const dir = join(root, DEV_DIR, 'dialogue', 'transcript');
  const now = remarkCounts(existsSync(dir) ? sortParts(readdirSync(dir)).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n') : '');
  const rev = (r) => (gitIn(gitRoot, 'rev-parse', '-q', '--verify', r) ?? '').trim();
  const head = rev('HEAD');
  // pre-merge-commit runs before git writes MERGE_HEAD: the incoming side is then named in GITHEAD_<sha>.
  const merging = rev('MERGE_HEAD') || incoming(gitRoot) || '';
  const upstream = since ?? (rev('@{upstream}') || rev('origin/main'));
  const say = (where, [r, held]) => `the merge ${where} loses the remark of ${r.slice(0, 10)} "${r.slice(13, 73)}" that a parent holds and neither removed${held > 1 ? ` (${held} times)` : ''}: put it back as that parent has it (git show <parent>:<month>)`;
  const faults = [];
  if (head && merging) faults.push(...lostIn(gitRoot, [head, merging], now).map((l) => say('under way', l)));
  for (const [m, ...parents] of mergesIn(gitRoot, upstream, head)) {
    for (const l of lostIn(gitRoot, parents, remarkCounts(transcriptAt(gitRoot, m)))) if ((now.get(l[0]) ?? 0) < l[1]) faults.push(say(m.slice(0, 8), l));
  }
  return faults;
}

// ── Numbers a merge moved, cited outside the Transcript ─────────────────────
// The driver moves this chat's clashing numbers and its references inside the
// Transcript; a spec row, trace.md, an eval card, the for-you list, a skill or a hook
// this chat also wrote still cites the old number, which now names main's card
// (found by hand after the 27 Oct review). Each move is noted in the git folder,
// never the tree, with the commits it came between; `moved` finds the lines this
// chat added (base..ours) that main does not hold, citing an old number, and
// `--fix` moves them. `check` refuses while any is left. A commit body already
// made cannot change, and is not looked at.

const MOVES_NOTE = 'dear-dialogue-moves.jsonl';
const movesPath = (cwd) => {
  const d = (gitIn(cwd, 'rev-parse', '--git-dir') ?? '').trim();
  return d ? join(resolvePath(cwd, d), MOVES_NOTE) : null;
};
const readMoves = (cwd) => {
  const p = movesPath(cwd);
  if (!p || !existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
};

/**
 * Note numbers a merge or renumber moved: `pairs` as [old, new], between `base`
 * (where the sides parted), `ours` (this chat's last commit before) and `theirs`
 * (main's). `everywhere` reads the Transcript too, for a move the driver did not
 * already carry through it (an eval card's, renumber's).
 */
export function recordMoves(cwd, pairs, { base, ours, theirs, everywhere = false }) {
  const p = movesPath(cwd);
  if (!p || !pairs.length || !base || !ours) return;
  appendFileSync(p, `${JSON.stringify({ date: new Date().toISOString(), pairs, base, ours, theirs: theirs ?? null, everywhere })}\n`);
}

/** The lines `base..ours` added to each file, from a zero-context diff; with no `ours`, up to the working tree. */
function addedLines(cwd, base, ours) {
  const diff = gitIn(cwd, '-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '--no-renames', base, ...(ours ? [ours] : []));
  if (diff === null) return null;
  const out = new Map();
  let path = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) path = line === '+++ /dev/null' ? null : line.slice(6);
    else if (path && line.startsWith('+') && !line.startsWith('+++')) out.set(path, [...(out.get(path) ?? []), line.slice(1)]);
  }
  return out;
}

/**
 * Every line in the tree that this chat added and main does not hold, citing a
 * number one of its merges moved; with `fix`, each is moved to the new number in
 * place, and a note with nothing left is dropped. `gitRoot` answers git; `root`
 * holds the files (the commit gate reads a copy of the index, apart from .git).
 * Returns [{ path, line, ids, fixed }].
 */
export function movedReferences({ gitRoot = REPO, root = gitRoot, fix = false, skip = new Set(), notes: given = null } = {}) {
  const notes = given ?? readMoves(gitRoot);
  const hits = [];
  const keep = [];
  // A note counts once its merge landed (main's side is in HEAD) or while it is under way;
  // a merge given up (aborted, refused) moved nothing, and its note is dropped.
  const head = (gitIn(gitRoot, 'rev-parse', '-q', '--verify', 'HEAD') ?? '').trim();
  const merging = (gitIn(gitRoot, 'rev-parse', '-q', '--verify', 'MERGE_HEAD') ?? '').trim();
  const live = (n) => !n.theirs || !head || n.theirs === merging || n.theirs === head || gitIn(gitRoot, 'merge-base', '--is-ancestor', n.theirs, head) !== null;
  const seen = new Set();
  for (const note of notes) {
    const key = JSON.stringify([note.pairs, note.base, note.ours, note.theirs, note.everywhere]);
    if (seen.has(key) || !live(note)) continue;
    seen.add(key);
    const map = new Map(note.pairs);
    const added = addedLines(gitRoot, note.base, note.ours);
    if (!note.base || !added || !map.size) continue; // its commits are gone: nothing left to find
    const re = new RegExp(`\\b(${[...map.keys()].join('|')})\\b`, 'g');
    const cites = (l) => l.search(re) !== -1;
    let left = 0;
    for (const [path, lines] of added) {
      // Generated from the Transcript, so always current: agreements.md and the pages by way and topic.
      if (AGREEMENTS_PAGE.test(path) || INDEX_PATH.test(path) || (!note.everywhere && MONTH_PATH.test(path))) continue;
      const citing = new Set(lines.filter(cites));
      if (!citing.size) continue;
      const theirs = note.theirs ? new Set(blob(gitRoot, note.theirs, path).split('\n')) : new Set();
      const file = join(root, path);
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf8').split('\n');
      let changed = false;
      text.forEach((l, i) => {
        // An entry's heading is that remark's own number, which only renumber gives (2026-11-04: a
        // heading another chat's merge brought in was rewritten as a citation, two remarks one number).
        if (!citing.has(l) || theirs.has(l) || /^### [TA]-\d+ · /.test(l)) return;
        const ids = [...new Set(l.match(re))];
        const can = fix && !skip.has(path);
        hits.push({ path, line: i + 1, ids: ids.map((id) => `${id} → ${map.get(id)}`), fixed: can });
        if (can) {
          text[i] = l.replace(re, (m) => map.get(m));
          changed = true;
        } else left += 1;
      });
      if (changed) writeFileSync(file, text.join('\n'));
    }
    if (left || !fix) keep.push(note);
  }
  const p = movesPath(gitRoot);
  if (fix && !given && p && existsSync(p)) {
    if (keep.length) writeFileSync(p, keep.map((n) => JSON.stringify(n)).join('\n') + '\n');
    else rmSync(p, { force: true });
  }
  // Mid-merge, the files it moved are staged, so the merge commit carries them: left unstaged,
  // a scripted `git add` of a guessed list missed two and the chat ended with them uncommitted
  // (T-839, 2026-11-05). Only in the working tree, never in the gate's copy.
  if (fix && root === gitRoot) stageDuringMerge(gitRoot, [...new Set(hits.filter((h) => h.fixed).map((h) => h.path))]);
  return hits;
}

/** Stages `paths` when `gitRoot` is in the middle of a merge; otherwise does nothing. Returns what it staged. */
export function stageDuringMerge(gitRoot, paths) {
  const head = gitIn(gitRoot, 'rev-parse', '--git-path', 'MERGE_HEAD')?.trim();
  if (!paths.length || !head || !existsSync(resolvePath(gitRoot, head))) return [];
  gitIn(gitRoot, 'add', '--', ...paths);
  return paths;
}

// ── Eval cards two chats both added ─────────────────────────────────────────
// An eval card's number is its file name, so two chats adding the next card
// meet as one file added twice: git stops on it, and taking one side drops the
// other's card unseen (2026-10-26: E-069 and E-070 numbered twice). `resolve`
// settles it as the Transcript is settled: main's card keeps the number, this
// chat's takes the next free one past both sides, with its scenario and its
// runs in the eval history, and its references elsewhere through `moved`.

const EVAL_FILE = new RegExp(`^${DEV_DIR}/evals/(?:cards/(E-\\d+)\\.md|scenarios/(E-\\d+)\\.json)$`);
const evalIdOf = (path) => { const m = path.match(EVAL_FILE); return m ? m[1] ?? m[2] : null; };
const evalIds = (cwd, ref) => (ref ? (gitIn(cwd, 'ls-tree', '--name-only', ref, `${DEV_DIR}/evals/cards/`) ?? '') : '').split('\n').map(evalIdOf).filter(Boolean);

/** Settle every eval card added on both sides: main's stays, this chat's moves. Returns what moved, as [old, new]. */
function settleEvalClashes(cwd, unmerged, theirs) {
  const both = unmerged.filter((p) => evalIdOf(p) && gitIn(cwd, 'show', `:1:${p}`) === null && gitIn(cwd, 'show', `:2:${p}`) !== null && gitIn(cwd, 'show', `:3:${p}`) !== null);
  if (!both.length) return [];
  const onDisk = existsSync(join(cwd, DEV_DIR, 'evals', 'cards')) ? readdirSync(join(cwd, DEV_DIR, 'evals', 'cards')).map((f) => evalIdOf(`${DEV_DIR}/evals/cards/${f}`)).filter(Boolean) : [];
  let next = Math.max(0, ...[...onDisk, ...evalIds(cwd, 'HEAD'), ...evalIds(cwd, theirs)].map((id) => Number(id.slice(2))));
  const base = (gitIn(cwd, 'merge-base', 'HEAD', theirs) ?? '').trim();
  const oursAdded = base ? (gitIn(cwd, '-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=A', base, 'HEAD', '--', `${DEV_DIR}/evals/`) ?? '').split('\n').filter(Boolean) : [];
  const pairs = [];
  for (const id of [...new Set(both.map(evalIdOf))].sort()) {
    const fresh = `E-${String(++next).padStart(3, '0')}`;
    const swap = (t) => t.replace(new RegExp(`\\b${id}\\b`, 'g'), fresh);
    // This chat's files under the number: the ones git stopped on, and the ones only it added (a scenario).
    for (const path of new Set([...both.filter((p) => evalIdOf(p) === id), ...oursAdded.filter((p) => evalIdOf(p) === id)])) {
      const conflicted = both.includes(path);
      const mine = gitIn(cwd, 'show', conflicted ? `:2:${path}` : `HEAD:${path}`);
      const moved = path.replace(id, fresh);
      mkdirSync(dirname(join(cwd, moved)), { recursive: true });
      writeFileSync(join(cwd, moved), swap(mine));
      if (conflicted) writeFileSync(join(cwd, path), gitIn(cwd, 'show', `:3:${path}`));
      else if (gitIn(cwd, 'cat-file', '-e', `${theirs}:${path}`) === null) {
        spawnSync('git', ['rm', '-q', '--cached', '--', path], { cwd });
        rmSync(join(cwd, path), { force: true });
      }
      spawnSync('git', ['add', '--', moved, ...(existsSync(join(cwd, path)) ? [path] : [])], { cwd });
    }
    pairs.push([id, fresh]);
  }
  if (pairs.length) recordMoves(cwd, pairs, { base, ours: (gitIn(cwd, 'rev-parse', 'HEAD') ?? '').trim(), theirs, everywhere: true });
  return pairs;
}

/** Every month merged between two commits, or null if one cannot be. The result turns only on
 *  the two commits, so one merge computes it once and every generated page git hands the driver
 *  after the first reads it back (T-822: about 45 pages each merged the whole Transcript again,
 *  some ten minutes a merge). Kept in git's own folder, keyed on both commits; an older one is
 *  removed when a new one is written. */
function mergedMonths(cwd, ours, theirs) {
  const [o, t] = [ours, theirs].map((r) => (gitIn(cwd, 'rev-parse', '-q', '--verify', `${r}^{commit}`) ?? '').trim());
  const gitDir = (gitIn(cwd, 'rev-parse', '--absolute-git-dir') ?? '').trim();
  const file = o && t && gitDir ? join(gitDir, `dialogue-months-${o.slice(0, 16)}-${t.slice(0, 16)}.json`) : '';
  if (file && existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8')).months;
    } catch { /* a cache that cannot be read is worked out again */ }
  }
  const months = mergedMonthsFresh(cwd, ours, theirs);
  if (file) {
    try {
      for (const f of readdirSync(gitDir)) if (/^dialogue-months-.*\.json$/.test(f)) rmSync(join(gitDir, f), { force: true });
      writeFileSync(file, JSON.stringify({ months }));
    } catch { /* no cache: each page works it out, as before */ }
  }
  return months;
}

function mergedMonthsFresh(cwd, ours, theirs) {
  const bases = (gitIn(cwd, 'merge-base', '--all', ours, theirs) ?? '').split('\n').filter(Boolean);
  if (bases.length !== 1) return null;
  const months = {};
  const lost = droppedByMerges(cwd, bases[0], ours);
  for (const path of [...new Set([...monthsAt(cwd, ours), ...monthsAt(cwd, theirs)])]) {
    const [b, o, t] = [bases[0], ours, theirs].map((r) => blob(cwd, r, path));
    if (o === t || t === b) months[path] = o;
    else if (o === b) months[path] = t;
    else {
      const m = mergeTranscript({ base: b, ours: o, theirs: t, floor: floorBeside(cwd, path, [ours, theirs]), elsewhere: siblingsAt(cwd, path, theirs), lost });
      if (!m.clean) return null;
      months[path] = m.text;
    }
  }
  return Object.fromEntries(Object.entries(months).map(([p, t]) => [p.match(MONTH_PATH)[1], t]));
}

// ── One render per merge (HYG-002) ──────────────────────────────────────────
// git runs the driver once per page, and every page is cut from one render of
// all of them: about 13 seconds each, so a merge of ~45 pages took ten minutes
// while main moved on and the push was refused again (2026-11-05). The first
// page's render is kept in the git folder, named by the merge's two commits,
// its kind and what else it was made from; every later page of that merge
// reads it. Written whole or not at all (a temporary name, then renamed); an
// older one of the same kind is removed as the new one is written; anything
// that cannot be read is rendered afresh, as before.

const RENDER_CACHE = 'dialogue-render-';

/**
 * The rendered pages of one kind ('agreements' or 'index') for the merge of two commits,
 * made by `make` once and kept in the git folder for the merge's other pages. `extra` is
 * anything else the pages are made from (the eval cards), and is part of the key.
 */
export function renderOnce(cwd, kind, ours, theirs, make, extra = '') {
  let file = null;
  let dir = null;
  let shas = null;
  try {
    const sha = (ref) => (gitIn(cwd, 'rev-parse', '-q', '--verify', `${ref}^{commit}`) ?? '').trim();
    shas = [sha(ours), sha(theirs)];
    const gitDir = (gitIn(cwd, 'rev-parse', '--git-dir') ?? '').trim();
    if (shas[0] && shas[1] && gitDir) {
      dir = resolvePath(cwd, gitDir);
      const key = createHash('sha256').update(`${shas[0]}\n${shas[1]}\n${extra}`).digest('hex').slice(0, 24);
      file = join(dir, `${RENDER_CACHE}${kind}-${key}.json`);
      if (existsSync(file)) {
        const kept = JSON.parse(readFileSync(file, 'utf8'));
        if (kept && kept.ours === shas[0] && kept.theirs === shas[1] && (kept.pages === null || typeof kept.pages === 'object')) return kept.pages;
      }
    }
  } catch {
    // Unreadable or half-gone: rendered afresh below.
  }
  const pages = make();
  if (file) {
    try {
      const temp = `${file}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify({ ours: shas[0], theirs: shas[1], pages: pages ?? null }));
      renameSync(temp, file);
      const own = file.slice(dir.length + 1);
      for (const f of readdirSync(dir)) if (f.startsWith(`${RENDER_CACHE}${kind}-`) && f !== own && !f.endsWith('.tmp')) rmSync(join(dir, f), { force: true });
    } catch {
      // Not kept: the next page renders again, as it did before.
    }
  }
  return pages;
}

/** Remove every render a merge kept. Quietly: one that cannot go is replaced by the next merge's. */
export function forgetRenders(cwd) {
  try {
    const gitDir = (gitIn(cwd, 'rev-parse', '--git-dir') ?? '').trim();
    if (!gitDir) return;
    const dir = resolvePath(cwd, gitDir);
    for (const f of readdirSync(dir)) if (f.startsWith(RENDER_CACHE)) rmSync(join(dir, f), { force: true });
  } catch {
    // Nothing to do.
  }
}

/** git's merge driver: %O %A %B %P. Writes the result over %A; exits 1 to leave a conflict, as git's own merge would. */
export function mergeDriver([basePath, oursPath, theirsPath, path]) {
  const cwd = process.cwd();
  const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const fallback = () => {
    const run = spawnSync('git', ['merge-file', '-L', 'ours', '-L', 'base', '-L', 'theirs', oursPath, basePath, theirsPath], { encoding: 'utf8' });
    return run.status === 0 ? 0 : 1;
  };
  try {
    const theirs = incoming(cwd);
    if (MONTH_PATH.test(path)) {
      const lost = theirs ? droppedByMerges(cwd, (gitIn(cwd, 'merge-base', 'HEAD', theirs) ?? '').trim(), 'HEAD') : new Set();
      const m = mergeTranscript({ base: read(basePath), ours: read(oursPath), theirs: read(theirsPath), floor: floorBeside(cwd, path, ['HEAD', theirs].filter(Boolean)), taken: takenBeside(cwd, path, theirs), elsewhere: theirs ? siblingsAt(cwd, path, theirs) : '', lost });
      if (!m.clean) {
        process.stderr.write(`dialogue: ${path} needs a person: ${m.why}. Settle that entry, then run node ux/scripts/dialogue.mjs resolve\n`);
        return fallback();
      }
      writeFileSync(oursPath, m.text);
      // The driver writes only this part, so this chat's new remarks land at its end even past the line: said now, refused by check, cut by split.
      if (lineCount(m.text) > ONE_READ) process.stderr.write(`dialogue: ${path} is ${lineCount(m.text)} lines after the merge, past the one-read line of ${ONE_READ}. When the merge is done, run node ux/scripts/dialogue.mjs split and commit the parts\n`);
      if (m.moved.length) {
        // The other files are git's to merge until it finishes: noted now, moved by `moved --fix` after.
        const ours = (gitIn(cwd, 'rev-parse', 'HEAD') ?? '').trim();
        const base = theirs ? (gitIn(cwd, 'merge-base', ours, theirs) ?? '').trim() : '';
        recordMoves(cwd, m.pairs, { base, ours, theirs });
        process.stderr.write(`dialogue: ${path} merged; this chat's ${m.moved.join(', ')}, references in the Transcript moved with them. When the merge is done, run node ux/scripts/dialogue.mjs moved --fix to move this chat's other references (check refuses until then).\n`);
      }
      return 0;
    }
    // Every page of the Agreements: the one handed over, rendered from the merged months.
    // A page the merged Transcript no longer makes falls to the plain merge, and the next
    // build (the commit gate's, or resolve's) removes it.
    const card = path.match(AGREEMENTS_PAGE);
    if (card && theirs) {
      const cards = readCards(join(cwd, DEV_DIR, 'evals', 'cards'));
      const pages = renderOnce(cwd, 'agreements', 'HEAD', theirs, () => {
        const months = mergedMonths(cwd, 'HEAD', theirs);
        return months ? renderAgreementParts(parseTranscript(months), cards) : null;
      }, JSON.stringify(cards));
      const text = pages ? pages[card[1]] : undefined;
      if (typeof text === 'string') {
        writeFileSync(oursPath, text);
        return 0;
      }
    }
    // The pages by way and by topic (A-070) are generated too: rebuilt from the merged months.
    const page = path.match(INDEX_PATH);
    if (page && theirs) {
      const pages = renderOnce(cwd, 'index', 'HEAD', theirs, () => {
        const months = mergedMonths(cwd, 'HEAD', theirs);
        return months ? renderIndex(parseTranscript(months)) : null;
      });
      const text = pages ? pages[page[1]] : undefined;
      if (typeof text === 'string') {
        writeFileSync(oursPath, text);
        return 0;
      }
    }
  } catch (error) {
    process.stderr.write(`dialogue: merge driver could not run (${error.message}); git's own merge used instead\n`);
  }
  return fallback();
}

/** After a pull that stopped: settle each conflicted month the driver could, then rebuild the Agreements and the index pages. */
export function resolveConflicts(cwd = REPO) {
  const unmerged = (gitIn(cwd, '-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=U') ?? '').split('\n').filter(Boolean);
  const theirs = (gitIn(cwd, 'rev-parse', '-q', '--verify', 'MERGE_HEAD') ?? '').trim() || null;
  const left = [];
  if (theirs) {
    const pairs = settleEvalClashes(cwd, unmerged, theirs);
    if (pairs.length) console.log(`dialogue: eval cards both chats added settled; main's kept, this chat's ${pairs.map(([a, b]) => `${a} → ${b}`).join(', ')}`);
  }
  const lost = theirs ? droppedByMerges(cwd, (gitIn(cwd, 'merge-base', 'HEAD', theirs) ?? '').trim(), 'HEAD') : new Set();
  for (const path of unmerged.filter((p) => MONTH_PATH.test(p))) {
    const [b, o, t] = [1, 2, 3].map((n) => gitIn(cwd, 'show', `:${n}:${path}`) ?? '');
    const m = mergeTranscript({ base: b, ours: o, theirs: t, floor: floorBeside(cwd, path, ['HEAD', theirs].filter(Boolean)), taken: theirs ? takenBeside(cwd, path, theirs) : undefined, elsewhere: theirs ? siblingsAt(cwd, path, theirs) : '', lost });
    if (!m.clean) {
      left.push(`${path}: ${m.why}`);
      continue;
    }
    writeFileSync(join(cwd, path), m.text);
    spawnSync('git', ['add', '--', path], { cwd });
    if (m.pairs.length && theirs) {
      const ours = (gitIn(cwd, 'rev-parse', 'HEAD') ?? '').trim();
      recordMoves(cwd, m.pairs, { base: (gitIn(cwd, 'merge-base', ours, theirs) ?? '').trim(), ours, theirs });
    }
    console.log(`dialogue: ${path} settled${m.moved.length ? `; this chat's ${m.moved.join(', ')}` : ''}`);
  }
  // This chat's references elsewhere follow what moved; a file still conflicted waits for its person.
  const conflicted = new Set((gitIn(cwd, '-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=U') ?? '').split('\n').filter(Boolean));
  const fixed = movedReferences({ gitRoot: cwd, root: cwd, fix: true, skip: conflicted });
  for (const path of new Set(fixed.filter((h) => h.fixed).map((h) => h.path))) spawnSync('git', ['add', '--', path], { cwd });
  for (const h of fixed) console.log(`dialogue: ${h.path}, line ${h.line}: ${h.ids.join(', ')}${h.fixed ? '' : ' (still conflicted: run moved --fix once it is settled)'}`);
  if (left.length) {
    console.log(`dialogue: ${left.length} month(s) need a person, then run resolve again:\n${left.map((l) => `  - ${l}`).join('\n')}`);
    return 1;
  }
  const still = (gitIn(cwd, 'diff', '--name-only', '--diff-filter=U', '--', `${DEV_DIR}/dialogue/transcript/`) ?? '').trim();
  if (still) return 1;
  // With the eval cards, as `build` writes it: without them a merge drops every Checked by line (2026-10-30).
  const merged = readTranscript(join(cwd, DEV_DIR, 'dialogue', 'transcript'));
  writeAgreements(merged, readCards(join(cwd, DEV_DIR, 'evals', 'cards')), join(cwd, DEV_DIR, 'dialogue'));
  writeIndex(merged, join(cwd, DEV_DIR, 'dialogue', 'index'));
  // Whole folders, so a page no longer made is staged as gone, and one new on either side as added.
  if (unmerged.some((p) => AGREEMENTS_PAGE.test(p)) || (gitIn(cwd, 'rev-parse', '-q', '--verify', 'MERGE_HEAD') ?? '').trim()) spawnSync('git', ['add', '-A', '--', AGREEMENTS_PATH, `${DEV_DIR}/dialogue/agreements/`, `${DEV_DIR}/dialogue/index/`], { cwd });
  console.log('dialogue: the Agreements (index, group pages, archive) and the pages by way and topic rebuilt from the Transcript; commit the merge when nothing else is conflicted');
  return 0;
}

/**
 * After a merge that went through (git's post-merge hook): every generated page rebuilt from
 * the merged Transcript, so the copy is right before its next commit carries them (T-768).
 * The driver rebuilds each page both sides changed; a page new on only one side (a new group,
 * a group's next part) is taken from that side by git without asking the driver, and can
 * still cite a number the merge moved. Returns the paths it rewrote; nothing while a merge is
 * still under way, or a month of the Transcript is still conflicted. With `underWay`, it runs
 * while the merge is under way too: git's pre-merge-commit hook, before the merge is written
 * (on 2026-11-04 a merge git committed by itself carried a chat's old one-file Agreements to
 * main, 1,035 lines, beside the new pages, and was pushed before any later commit rebuilt it).
 */
export function rebuildAfterMerge(cwd = REPO, { underWay = false } = {}) {
  const dialogue = join(cwd, DEV_DIR, 'dialogue');
  if (!existsSync(join(dialogue, 'transcript'))) return [];
  if (!underWay && (gitIn(cwd, 'rev-parse', '-q', '--verify', 'MERGE_HEAD') ?? '').trim()) return [];
  // The merge is over: its kept renders are of no use to the next one.
  if (!underWay) forgetRenders(cwd);
  if ((gitIn(cwd, 'diff', '--name-only', '--diff-filter=U', '--', `${DEV_DIR}/dialogue/`) ?? '').trim()) return [];
  const entries = readTranscript(join(dialogue, 'transcript'));
  const cards = readCards(join(cwd, DEV_DIR, 'evals', 'cards'));
  const off = [...agreementsStale(entries, cards, dialogue), ...indexStale(entries, join(dialogue, 'index')).map((f) => `index/${f}`)];
  if (!off.length) return [];
  writeAgreements(entries, cards, dialogue);
  writeIndex(entries, join(dialogue, 'index'));
  return off.map((p) => `${DEV_DIR}/dialogue/${p}`);
}
