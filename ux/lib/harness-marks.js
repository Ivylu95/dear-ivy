// Which glyph stands for a thing in `.claude/`.
//
// Shared by the two places the harness is drawn as a list — the overview rows in
// components/harness/HarnessList.jsx and the tree in components/harness/HarnessIndex.jsx
// — so one entry cannot wear a quill in one column and a plain page in the other.
// It lives here rather than in either of them because the tree is a client
// component and the list is not: importing the constant across that line would
// pull a server component's whole module into the browser bundle.
//
// Pure data and a lookup. No filesystem, no request — safe on both sides.

// One glyph per thing at the top of `.claude/`.
//
// Keyed on the PATH rather than the name, so the mark belongs to that one entry:
// a `hooks/` folder nested somewhere else does not inherit the bolt, because
// only a top-level path has no slash in it.
//
// A lookup with a fallback, never a requirement. Anything added to the harness
// that is not listed here still appears, wearing the mark for its kind — the
// structure is still read off the disk, and this only annotates it. The same
// arrangement as GLOSS in lib/harness.js, for the same reason.
//
// ── Why it is nearly all folders now ────────────────────────────────────────
//
// It held a bespoke mark for four of the top-level FILES too — a pennant on
// REVIEW.md, a heartbeat on heartbeats.json, sliders on settings.json. Each
// was a fair picture of what that file is about, and together they cost more
// than they bought: four files at the top of the tree wearing four unrelated
// glyphs, none of which said the one thing a reader scanning a file tree is
// actually asking, which is what KIND of file it is. A markdown file that looks
// nothing like the markdown file above it is a row you read rather than scan.
//
// So the tiers below carry it instead: a `.md` looks like a `.md`, a `.json`
// like a `.json`, and this table keeps only the entries where the picture beats
// the category. A folder is always one of those — `skills/` and `specs/` are
// both "a folder" and that is the least useful thing about either.
export const MARK = {
  commands: 'terminal',
  hooks: 'spark',
  prompts: 'speech',
  skills: 'layers',
  specs: 'plumb',
  // The one file that keeps a mark of its own, and the one case where the
  // category is genuinely the wrong answer. Every other file in the harness is
  // something the agent READS; this one is the agent's own instructions, so it
  // takes the agent's own mark rather than a document's.
  'CLAUDE.md': 'asterisk',
};

// A mark by filename, wherever that file turns up.
//
// The tier under MARK, and the reason it exists: there are four README.md in
// `.claude/` and one of them is at no fixed path anyone could key on. What the
// name means does not change with the folder — a README is the way in to
// whatever it sits beside, everywhere — so the name is the right thing to match.
//
// Exact, and deliberately not case-folded. These names are shouted by
// convention, and a `readme.md` in lower case is a different file from the one
// this repository writes; matching it would be guessing at intent.
export const BY_NAME = {
  // The same info mark the About view carries. A README and that view answer the
  // same question about two different things — what is this, and where do I
  // start — and one glyph for one question is how the rest of this set works.
  'README.md': 'about',
  // Drafting dividers, for the document the rest of the harness is set out from.
  'ARCHITECTURE.md': 'dividers',
};

// A mark by extension: the last tier before the plain page.
//
// Held to the kinds of file this repository actually keeps, rather than opened
// out into a file-type table. `.mjs` is left off on purpose — a hook and a
// script are the two things here that RUN rather than are read, and the plain
// page is an honest thing to say about them until there is a glyph that says
// that better.
export const BY_EXT = {
  '.md': 'markdown',
  '.json': 'brackets',
};

// The mark for one entry, most specific first: what that particular thing IS,
// then what a file of that name is, then what kind of file it is, and the plain
// folder or page where none of those knows.
//
// A folder takes only the first tier. The other two are about file contents and
// a directory has none — and a folder that happened to be called `README.md`
// would otherwise come back wearing a document's mark.
export function markFor(entry) {
  if (!entry) return 'file';
  if (entry.kind === 'dir') return MARK[entry.path] ?? 'folder';
  return MARK[entry.path] ?? BY_NAME[entry.name] ?? BY_EXT[extensionOf(entry.name)] ?? 'file';
}

// The extension, lower-cased, or '' where there is none.
//
// A leading dot is the whole name of a dotfile rather than an extension, which
// is why the search starts at 1: `.gitignore` has no extension, `settings.json`
// has `.json`. The same rule the tree's own Name component clips on.
function extensionOf(name) {
  const cut = String(name ?? '').lastIndexOf('.');
  return cut > 0 ? name.slice(cut).toLowerCase() : '';
}
