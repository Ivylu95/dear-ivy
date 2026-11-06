// No ID made here is already taken on main by something else (WKB-007).
//
//   node ux/scripts/check-id-clash.mjs     (runs in the commit gate)
//
// Learned 2026-10-28 and 10-29: a long chat on a branch main could not merge into
// numbered its new eval cards and agreement cards from its own disk, while other
// chats on main took the same numbers for different things. Twice the cards had to
// be renumbered by hand, after the clash had already been pushed. The trap note
// (.claude/memory/take-the-next-id-from-disk.md) said to read the highest ID on
// disk; a disk behind main cannot see main's.
//
// An ID clashes when both sides made it since they parted (not at the merge base)
// and it names a different thing: an eval card with another title, an agreement
// card that says something else. Without a main to compare (no origin/main, no
// merge base), it passes and says so.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch { return null; } };

/** Eval card titles by ID, from `path\0text` pairs. */
export function evalTitles(files) {
  const out = new Map();
  for (const [path, text] of files) {
    const id = path.match(/\b(E-\d+)\.md$/)?.[1];
    if (id) out.set(id, String(text).match(/^title: (.*)$/m)?.[1]?.trim() ?? '');
  }
  return out;
}

/** Agreement cards' Says lines by ID, from Transcript texts. */
export function cardSays(texts) {
  const out = new Map();
  for (const text of texts) {
    for (const m of String(text).matchAll(/^- \*\*Card (A-\d+)\*\*[^\n]*\n(?:[^\n]*\n)*?\s+- \*\*Says:\*\* ([^\n]*)/gm)) out.set(m[1], m[2].trim());
  }
  return out;
}

/** IDs both sides made since the base, naming different things. */
export function clashes(base, ours, theirs) {
  const out = [];
  for (const [id, mine] of ours) {
    if (base.has(id) || !theirs.has(id)) continue;
    if (theirs.get(id) !== mine) out.push({ id, ours: mine, theirs: theirs.get(id) });
  }
  return out;
}

function sideOf(ref) {
  const list = (dir) => (git('ls-tree', '-r', '--name-only', ref, dir) ?? '').split('\n').filter(Boolean);
  const show = (p) => git('show', `${ref}:${p}`) ?? '';
  const cards = list('dev/evals/cards').filter((p) => /E-\d+\.md$/.test(p)).map((p) => [p, show(p)]);
  const months = list('dev/dialogue/transcript').filter((p) => p.endsWith('.md')).map(show);
  return { evals: evalTitles(cards), agreements: cardSays(months) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const base = git('rev-parse', '--verify', '-q', 'origin/main') && git('merge-base', 'HEAD', 'origin/main')?.trim();
  if (!base) {
    console.log('id clash: no origin/main to compare with; nothing checked');
    process.exit(0);
  }
  const [b, theirs] = [sideOf(base), sideOf('origin/main')];
  // Ours is the working tree: a clash is cheapest to fix before it is committed.
  const { readdirSync, readFileSync, existsSync } = await import('node:fs');
  const files = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).map((f) => [`${dir}/${f}`, readFileSync(`${dir}/${f}`, 'utf8')]) : []);
  const ours = {
    evals: evalTitles(files('dev/evals/cards', /^E-\d+\.md$/)),
    agreements: cardSays(files('dev/dialogue/transcript', /\.md$/).map(([, t]) => t)),
  };
  const found = [...clashes(b.evals, ours.evals, theirs.evals), ...clashes(b.agreements, ours.agreements, theirs.agreements)];
  if (found.length) {
    console.error(`id clash: ${found.length} ID(s) made here are taken on main by something else; renumber yours past main's highest:\n${found.map((f) => `  - ${f.id}: here "${f.ours.slice(0, 60)}", on main "${f.theirs.slice(0, 60)}"`).join('\n')}`);
    process.exit(1);
  }
  console.log(`id clash: none (${ours.evals.size} eval cards, ${ours.agreements.size} agreement cards, against main since ${base.slice(0, 8)})`);
}
