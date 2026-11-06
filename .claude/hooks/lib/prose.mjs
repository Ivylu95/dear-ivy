// A-171: everything he and she read flows like a good book. This finds the worst
// of what doesn't, by counting, never by judging: a sentence far too long, or
// semicolons and colons chained where sentences would do. Whether a sentence
// flows is still the reader's call; this only catches what a count can see.
// Code, quoted lines (> …), tables, headings, links and a progress line (⟶) are left out: a quote
// keeps its writer's words, and a table or heading is not a sentence.

/** The longest sentence allowed before it is flagged, in words. The card says about twenty; this is the worst of it. */
export const MAX_WORDS = 30;

const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

/** The prose of a text, one entry a sentence, with code, quotes, tables and headings left out. */
export function sentencesOf(text = '') {
  // A file wraps its sentences across lines, so a line that only continues the
  // one above is joined to it; a blank line, a list item, or a line after a
  // short one (a list of words, a label) starts afresh.
  const kept = [];
  for (const raw of String(text).replace(/```[\s\S]*?```/g, '\n').split('\n')) {
    if (/^\s*(>|\||#|<!--)/.test(raw) || /⟶/.test(raw) || !raw.trim()) { kept.push(''); continue; }
    const item = /^\s*([-*]|\d+\.)\s+/.test(raw);
    const line = raw.replace(/^\s*([-*]|\d+\.)\s+/, '').trim();
    const prev = kept[kept.length - 1];
    if (!item && prev && /^\s/.test(raw) === false && prev.length > 40 && !/[.!?:]["”’)*_]*$/.test(prev)) kept[kept.length - 1] = `${prev} ${line}`;
    else if (!item && prev && /^\s+/.test(raw) && prev.length > 40) kept[kept.length - 1] = `${prev} ${line}`;
    else kept.push(line);
  }
  const prose = kept
    .map((l) => l.replace(/`[^`\n]*`/g, 'X').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, 'link'))
    .join('\n');
  // A line break still ends a sentence: list items and short lines stand alone.
  return prose
    .split(/\n+|(?<=[.!?])["”’)*_]*\s+(?=["“(*_]*[\p{Lu}\p{N}])/u)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

/** What a count can see that makes the text hard to read: [{ kind, words, sentence }]. */
export function proseFaults(text = '', { maxWords = MAX_WORDS } = {}) {
  const faults = [];
  for (const s of sentencesOf(text)) {
    const n = words(s).length;
    const semis = (s.match(/;/g) || []).length;
    const colons = (s.match(/:(?!\/\/)\s/g) || []).length;
    if (n > maxWords) faults.push({ kind: 'long', words: n, sentence: s });
    else if (semis >= 2) faults.push({ kind: 'semicolons', words: n, sentence: s });
    else if (semis >= 1 && colons >= 1) faults.push({ kind: 'chain', words: n, sentence: s });
  }
  return faults;
}

/** One line saying what to fix first, or ''. */
export function proseProblem(text = '', opts) {
  const [f] = proseFaults(text, opts);
  if (!f) return '';
  const start = words(f.sentence).slice(0, 8).join(' ');
  if (f.kind === 'long') return `A sentence runs to ${f.words} words (A-171): "${start} …". Split it so each sentence says one thing, in about twenty words.`;
  return `A sentence strings its parts together with ${f.kind === 'semicolons' ? 'semicolons' : 'a colon and a semicolon'} (A-171): "${start} …". Write each part as its own sentence.`;
}
