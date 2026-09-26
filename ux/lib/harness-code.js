import { paint, runs } from '@/lib/code-highlight';
import { toHtml } from '@/lib/markdown';
import { slugify } from '@/lib/views';

// The part of a source file that is not source.
//
// A markdown file in this view gets a title, a sentence saying what it is, and a
// rail that navigates its headings. Everything else — twelve hooks and three
// JSON files — got a grey slab of monospace with none of those things, and the
// difference was never about the format. A hook is as deliberately written as a
// spec is, and it explains itself at the top in exactly the same way:
//
//     // UserPromptSubmit — the safety floor, made mechanical.
//     //
//     // CLAUDE.md puts crisis in the always-loaded file and out of the skills,
//     // because "a skill loads only if a description matches"...
//
// That is a lead paragraph wearing slashes. This module takes them off.
//
// ── What it does NOT do ─────────────────────────────────────────────────────
//
// It does not touch the code. Not one character of it is reordered, reflowed,
// re-indented, prettified or highlighted — the existing rule in page.jsx stands
// and is the whole reason this view is trustworthy: these files are read to
// check an exact value, and a rendering you have to second-guess is worse than
// no rendering. What changes is the FURNITURE around the code: the header
// comment is lifted into prose, the section dividers the files already contain
// become anchors, and the lines get their real numbers.
//
// The line numbers are the test of that. The header comment is lifted OUT of the
// block, so the code no longer starts at line 1 — and rather than renumber from
// 1, the block starts at the number the line actually has in the file. Anything
// else would be a view that disagrees with the editor you would open next.

// ── What the files actually look like ───────────────────────────────────────

// `// ── Two properties everything here is built for ─────────────────────`
//
// The same divider this repository uses in its own stylesheets and modules. Four
// of the hooks carry them, and they are the only structure a 250-line script
// has — so they become what `##` is to a markdown file: an anchor, a rail row, a
// way to link to one part of a file rather than to the file.
const DIVIDER = /^\s*\/\/\s*─+\s*(.*?)\s*─*\s*$/;

// A top-level key in a formatted JSON file: exactly one indent in, quoted.
//
// Anchors rather than sections, and the distinction matters. Splitting settings.json
// at its keys would put the opening brace in one block and `"permissions": {` in
// the next, which is three fragments that no longer parse and a document that
// looks like something you could not paste back. So the file stays whole and the
// key lines merely become addressable.
const JSON_KEY = /^ {2}"([^"]+)"\s*:/;

const LANG = {
  mjs: 'javascript',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  css: 'css',
  toml: 'toml',
  txt: 'text',
};

/** What to call the format, for the tag by the title. */
function langOf(name) {
  const ext = String(name).split('.').pop()?.toLowerCase() ?? '';
  return LANG[ext] ?? ext ?? 'text';
}

/**
 * The header comment, as prose — or nothing.
 *
 * The leading run of `//` lines, stopping at the first divider or at the first
 * line that is not a comment. The divider is a stop rather than a continuation
 * because it opens the first SECTION: hook.mjs explains itself for eight lines
 * and then starts one, and swallowing that heading into the lead would lose the
 * first rail row of the longest file here.
 *
 * Only the text. The source block below still shows the file from its first
 * line — see readCode — so nothing here decides where the code starts.
 */
function header(lines) {
  if (!/^\s*\/\//.test(lines[0] ?? '')) return '';

  let end = 0;
  while (end < lines.length) {
    const line = lines[end];
    if (DIVIDER.test(line)) break;
    if (!/^\s*\/\//.test(line)) break;
    end += 1;
  }
  if (!end) return '';

  return lines
    .slice(0, end)
    .map((line) => line.replace(/^\s*\/\/ ?/, ''))
    // Four spaces is a code block in markdown, and prose that happens to be
    // indented would silently become one — the paragraph rendered as a grey slab
    // of monospace, which is the exact thing this module exists to stop. No
    // header comment in the harness is indented that far today; this is here so
    // that the day one is, it reads as a paragraph rather than as a bug.
    .map((line) => line.replace(/^ {3,}/, '  '))
    .join('\n')
    .trim();
}

/**
 * The one-line summary at the top of a header comment, split where it splits.
 *
 * Every hook opens `Event — what it does`: `UserPromptSubmit — the safety floor,
 * made mechanical.` The left half is the moment it fires, which is the single
 * most useful fact about a hook and belongs in a tag beside the filename; the
 * right half is the sentence, and belongs under the title where every other
 * view in this app puts its subtitle.
 *
 * Only an em-dash split counts, and only when the left half is short enough to
 * be a name. A first line that simply runs on — "Shared plumbing for the hooks
 * in `.claude/hooks/`." — has no event in it, and inventing one would put a tag
 * on the page saying something the file does not.
 */
function summarise(text) {
  const first = text.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (!first) return { tag: null, sub: null, rest: text };

  const rest = text.slice(text.indexOf('\n\n') + 1).trim();
  const halves = first.split(' — ');
  if (halves.length > 1 && /^[A-Za-z][\w.-]*$/.test(halves[0])) {
    return { tag: halves[0], sub: halves.slice(1).join(' — '), rest };
  }
  return { tag: null, sub: first, rest };
}

/**
 * A source file, ready to render: what it says about itself, then its lines.
 *
 * @param {string} name   The file name, which is all that decides the format.
 * @param {string} source The file, exactly as it is on disk.
 */
export function readCode(name, source) {
  const lang = langOf(name);

  // An empty file has no lines, and `''.split('\n')` says it has one. That is
  // the difference between a page reporting "0 lines" and a page reporting
  // "1 line" about a file with nothing in it — and heartbeats.json is empty
  // today, so it is not a hypothetical.
  const raw = String(source ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '');
  const lines = raw ? raw.split('\n') : [];

  // Only the comment languages have a header to lift. JSON has no comment
  // syntax at all — settings.json says so itself, at length, inside a `_note`
  // key it had to invent for the purpose — so there is nothing to take off it.
  const { tag, sub, rest } = summarise(lang === 'json' ? '' : header(lines));

  // ── The source block starts at line 1, always ───────────────────────────
  //
  // The header comment is COPIED into the lead above, not moved out of the file.
  // It was moved for a while, and the block then opened at line 6 — correct, in
  // that 6 really was where the remaining code began, and wrong in every way
  // that matters: a section headed "Source" that does not contain the first line
  // of the source is a section you have to work out before you can trust, and
  // the number 6 is the first thing that makes you do it.
  //
  // So the file is whole here and the lead is a summary of its opening, which is
  // the same arrangement as a README rendered above its own source. The cost is
  // that the header comment is on the page twice, a few inches apart. That is a
  // real cost and it was weighed: reading the same paragraph twice is a moment's
  // redundancy, and a line number that does not match the file is a doubt about
  // everything else on the page.

  // Painted over the whole file, then cut at the line boundaries below. A block
  // comment, a template literal and an unterminated string all span newlines, so
  // a per-line pass would have to carry state between lines and would get the
  // first line of each block wrong.
  const kinds = paint(raw, lang);

  // One id per anchor across the file, so two dividers with the same words
  // cannot both claim it and send the rail to whichever came first.
  const taken = new Set();
  const marks = [];

  // Where the current line starts in `raw`. Carried rather than recomputed per
  // line, which would make this quadratic on the only file here big enough for
  // that to show.
  let at = 0;

  const code = lines.map((line, i) => {
    const n = i + 1;
    const parts = runs(raw, kinds, at, at + line.length);
    at += line.length + 1;

    const found = lang === 'json' ? JSON_KEY.exec(line) : DIVIDER.exec(line);
    const label = found?.[1]?.trim();
    if (!label) return { n, parts };

    let id = slugify(label);
    if (!id) return { n, parts };
    while (taken.has(id)) id = `${id}-`;
    taken.add(id);

    marks.push({ id, label });
    return { n, parts, id };
  });

  return {
    lang,
    // The event the hook fires on, where the file names one.
    event: tag,
    // The sentence under the title. Falls back in the caller, which knows what a
    // file with nothing to say about itself should be called instead.
    sub: sub ?? null,
    // Everything after that first line, as prose. Markdown, because the files
    // are written in it without meaning to be — backticked paths, quoted rules,
    // the occasional list — and rendering it is the difference between a
    // paragraph and a paragraph with punctuation showing.
    lead: rest ? toHtml(rest) : '',
    code,
    marks,
    lines: lines.length,
  };
}
