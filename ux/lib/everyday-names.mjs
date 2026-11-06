// Everyday words that are also names, for the privacy check (ARC-004).
//
// The check refuses any harness file holding a name from the copy's record. A
// handful of ordinary words are names too: a herb, a font, two colours, a cited
// author, the safety benchmark's invented personas. Unanswered, a record holding
// one would stop a copy over a file no one in it wrote. The developer chose the
// smallest loosening (2026-10-29): a reviewed list of exact phrases in context,
// each with its reason, kept in one data file (everyday-names.json). Only the
// listed context is hidden from the name match; every other occurrence of the
// same name is held exactly as before.
//
// Read by ux/scripts/check-privacy.mjs (and so the Stop hook that runs it) and
// by .claude/hooks/privacy/guard-harness-privacy.mjs, so the two cannot disagree. Proven in
// ux/scripts/test-check-privacy.mjs.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
// The same hash as ux/scripts/test-example-names.mjs's nameHash.
const nameHash = (word) => createHash('sha256').update(String(word).normalize('NFC').toLowerCase()).digest('hex').slice(0, 16);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const whole = (name) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escape(name)}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu');

// A list file that is missing (a copy without dev/) names no one, so it hides nothing.
function namesFrom(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8').split('\n').slice(1).map((l) => l.split('\t')[0].trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

const listed = JSON.parse(readFileSync(join(HERE, 'everyday-names.json'), 'utf8')).allowed;

/** The reviewed list, read once: each rule's names, its context, and where it applies. */
export const EVERYDAY_NAMES = [
  ...listed.map((r) => ({
    // A rule may read its words from a table, and hold more as hashes: the shipped
    // policy's personas are hashed here because a copy without dev/ has no table.
    names: new Set([...(r.names ?? []), ...(r.namesFrom ? namesFrom(r.namesFrom) : [])].map((n) => n.toLowerCase())),
    hashes: new Set(r.nameHashes ?? []),
    context: r.phrase ? new RegExp(escape(r.phrase), 'giu') : r.pattern ? new RegExp(r.pattern, 'giu') : null,
    files: r.files ?? null,
    ext: r.ext ?? null,
    why: r.why,
  })),
  // The list itself must spell the words it lets through, and only those.
  { names: new Set(listed.flatMap((r) => r.names ?? [])), context: null, files: ['ux/lib/everyday-names.json'], why: 'the list itself' },
];

// `ext` narrows a rule to code files: a colour rule once let "background: Violet" and
// "Text-rose-500 is how she spells her name" through in prose (round 2, C26).
const appliesTo = (files, rel, ext = null) =>
  (!files || files.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p))) && (!ext || ext.some((e) => rel.toLowerCase().endsWith(e)));

/**
 * `text` with every listed context for `name` blanked to spaces, so the name
 * match reads only what is left. `rel` is the file's path from the repository
 * root, with forward slashes. A rule with no context (the personas) hides the
 * name as a whole word, in its own files only.
 */
/**
 * Names that are also everyday English words. One of these counts only as a name:
 * capitalised, and after a lower-case word or a comma, colon or bracket, so not
 * at a sentence's start. "ask <Name> about it" is held; the word in ordinary use,
 * or opening a question, is not (the developer's yes, 2026-10-31: "Okay do it"). A name that
 * opens a sentence slips through; that is the cost.
 */
export const WORD_NAMES = new Set(JSON.parse(readFileSync(join(HERE, 'everyday-names.json'), 'utf8')).wordNames ?? []);
const MONTHS = new Set(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
const MID_SENTENCE = /[\p{Ll}\p{N},;:("'\u2019] $/u;

export function withoutEverydayNames(text, name, rel = '', rules = EVERYDAY_NAMES) {
  const lower = String(name ?? '').toLowerCase();
  let out = String(text ?? '');
  if (WORD_NAMES.has(lower)) {
    const month = MONTHS.has(lower);
    out = out.replace(whole(lower), (m, at, all) => {
      const before = all.slice(Math.max(0, at - 12), at);
      const after = all.slice(at + m.length, at + m.length + 4);
      const asName = /^\p{Lu}\p{Ll}+$/u.test(m) && MID_SENTENCE.test(before.slice(-2))
        && !/^['\u2019]\p{L}|^\.\s?\d/u.test(after)
        && !(month && (!/\p{Ll} $/u.test(before) || /(\d|\b(in|on|by|of|since|until|from|early|mid|late|last|next|this|every))\s$/i.test(before) || /^\s?\d/.test(after)));
      return asName ? m : ' '.repeat(m.length);
    });
  }
  for (const r of rules) {
    if (!(r.names.has(lower) || (r.hashes?.size && r.hashes.has(nameHash(lower)))) || !appliesTo(r.files, rel, r.ext)) continue;
    out = out.replace(r.context ?? whole(lower), (m) => ' '.repeat(m.length));
  }
  return out;
}
