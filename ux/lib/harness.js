import { cache } from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fromFile } from '@/lib/file-cache';
import { readCode } from '@/lib/harness-code';
import { HARNESS, SPECS } from '@/lib/harness-dir';
import { HARNESS_VIEW, SPECS_VIEW } from '@/lib/folder-views';
import { sections, toHtml } from '@/lib/markdown';
import { slugify } from '@/lib/views';

// A folder, read off disk — `.claude/` for the Harness tab, `specs/` for the
// Specs tab.
//
// The two read the same way — a directory lists, a file renders, a register row
// gets an anchor — so they are one reader built twice by createFolderView() at
// the foot of this file, each bound to its own root. What differs between the
// tabs (route, label, wording) is lib/folder-views.js; what differs in the
// reading is only the root and the hand-written glosses below. The notes that
// follow were written for `.claude/` and hold for either.
//
//
// Every other view in this app is a window onto her record. This one is the
// window onto the machinery around it: the file loaded into every session, the
// skills that load when a session matches one, the specs that argue for why any
// of it is shaped this way, and the settings that decide what actually runs.
//
// It reads hooks as files like anything else. There was a view of its own for
// them once, which said whether each was switched on by reading settings.json —
// a question a directory listing cannot answer. It was removed because one
// folder reading unlike every other folder cost more than the answer it gave.
//
// It exists because the harness had become the one part of this system with no
// way to read it except by opening a dozen folders in an editor — which meant
// the question "what does this thing actually do?" was answerable only by
// someone already holding the whole layout in their head. A rule nobody can find
// is a rule nobody is keeping.
//
// ── Nothing here is hers ────────────────────────────────────────────────────
//
// This module reads `.claude/` and never `data/`. That is held by two separate
// things: the folder it is given — lib/harness-dir.js, a different resolver from
// lib/data-dir.js — and safeJoin() below, which refuses any path that climbs out
// of it. Both are needed. The first stops a mistake; the second stops a crafted
// URL. The harness is non-personal, committed, and written for a developer; the
// record is hers. A surface that blurs the two is the one failure this app
// cannot have.
//
// ── The folder IS the structure ─────────────────────────────────────────────
//
// There is no table of files here, and no scheme laid over them. A directory
// lists, a file renders, and those two rules go all the way down — so what the
// view shows is `.claude/` as an editor would list it: same entries, same names,
// same order.
//
// It was briefly otherwise. The top level was grouped into eight invented
// "areas", two of which existed nowhere on disk: the loose markdown at the top
// of `.claude/` was gathered under a heading called Instructions, and the loose
// JSON under one called Settings. It read tidily and it was a second structure
// to learn — you could not point at a row and say which file it was, the two
// invented headings had no path of their own to open until one was special-cased
// in, and the day someone dropped a `.yaml` at the top level it would have
// belonged to neither. CLAUDE.md calls the harness "yours to amend, one
// traceable change at a time"; an amendment has to show up here without a second
// edit, and only mirroring the disk does that.
//
// What is left is annotation. The glosses below are one line per top-level entry, keyed
// by its real name, because what a folder is FOR is the one thing a filename
// cannot say. It changes nothing about what is shown or in what order: an entry
// with no gloss still appears, described by its own first paragraph.

const HARNESS_GLOSS = {
  'CLAUDE.md': 'Loaded into every session, whether anything else matches.',
  'REVIEW.md': 'Raised by the agent, cleared by a person.',
  commands: 'What a developer can invoke by name.',
  'heartbeats.json': 'When the unattended runs fire, and how often.',
  hooks: 'Small programs that run by themselves, at fixed moments.',
  prompts: 'Prompt text for the runs nobody is watching.',
  'settings.json': 'What is wired up, and what is permitted.',
  skills: 'One session shape each, loaded when its description matches.',
};

const SPECS_GLOSS = {
  'ARCHITECTURE.md': 'Where everything lives. Read first.',
  'README.md': 'How a spec is read, and the terms they all share.',
  'REFERENCES.md': 'The works a row leans on, and where each stops.',
  'REVIEW.md': 'Findings about the specs, raised by the agent, cleared by a person.',
};

// A file big enough to hang the page is one this view should decline rather than
// attempt. 400 KB is far above anything the harness holds and far below anything
// that would matter.
const MAX_BYTES = 400 * 1024;

const TEXT = /\.(md|mjs|js|json|txt|ya?ml|toml|css|jsx|ts|tsx|sh)$/i;

// ── Paths ───────────────────────────────────────────────────────────────────

/**
 * A path from a URL, resolved inside the harness — or null.
 *
 * Every segment of every harness route arrives from the address bar, so this is
 * the boundary. It rejects anything resolving outside `.claude/`, which covers
 * `..`, an absolute path, and the encoded forms of both, because it compares the
 * RESOLVED path rather than inspecting the string. A string check is a list of
 * tricks somebody remembered; this is the answer.
 */
function safeJoin(root, relPath) {
  const parts = String(relPath ?? '')
    .split('/')
    .filter((part) => part && part !== '.');
  const full = resolve(root, ...parts);
  const top = resolve(root);
  if (full !== top && !full.startsWith(top + sep)) return null;
  return full;
}

/**
 * The same rule as safeJoin, answered without touching the disk.
 *
 * safeJoin exists to turn a relative path into an absolute one it is safe to
 * read; this exists to turn one into the key the walk files things under. Both
 * refuse anything that climbs out of `.claude/`, which is the only part that
 * has to stay in step between them — and it is the same three lines of logic,
 * stated once each in the two currencies the module deals in.
 *
 * Null for a path that escapes, exactly as safeJoin returns null for one.
 */
function withinHarness(relPath) {
  const parts = [];
  for (const part of String(relPath ?? '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

const toPosix = (path) => String(path).split(sep).join('/');

// `.claude/x` or `specs/x`, with or without a leading `./` or `/`: a path written
// from the repository root names the folder first, and this is what strips it.
const prefixOf = (folder) => new RegExp(`^\\.?\\/?${folder.replace(/\./g, '\\.')}\\/`);

// ── Reading a file ──────────────────────────────────────────────────────────

// Through the file cache, so an unchanged file costs a stat rather than a read.
//
// It went straight to disk before, which was affordable while only the opened
// file was read. The single walk above reads every text file in the harness on
// every request — sixty-odd of them — to collect first paragraphs and links, and
// at that volume "read it again" is the whole cost. fromFile keys on the
// modification time, so the second request for a folder nobody has edited does
// sixty stats and no reads at all.
//
// The size guard stays outside the cached build: a file that has grown past the
// limit should stop being read, and deciding that from the stat this already
// does costs nothing.
function readText(full) {
  try {
    if (statSync(full).size > MAX_BYTES) return null;
    return fromFile(full, 'harness-text', () => readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * YAML front matter, as a flat map.
 *
 * Only `key: value` at the top level, which is all any file here uses — a
 * skill's frontmatter carries a name and a description and nothing else. Quotes
 * are stripped. Anything more structured is left alone rather than half-parsed
 * into something misleading.
 */
function frontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(String(source ?? ''));
  if (!match) return { meta: {}, body: String(source ?? '') };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (pair) meta[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: String(source).slice(match[0].length) };
}

/**
 * The one line that says what a file is.
 *
 * In order of how deliberately it was written as a description: a skill's own
 * `description:`, which is the only thing dispatch ever sees and is therefore
 * written to be read; then the first real paragraph, which is how every spec and
 * README here opens; then nothing. Never a truncated first line of code — a
 * description that turns out to be an import statement is worse than a blank.
 *
 * Trimmed to what stays one line in a list. The whole file is one click away, so
 * nothing is lost by stopping here.
 */
function describe(source, name) {
  const { meta, body } = frontmatter(source);
  if (meta.description) return flatten(meta.description);

  if (!name.endsWith('.md')) {
    // A hook or a script. Its header comment opens `Event — what it does`;
    // take the half that is prose.
    const first = body
      .split('\n')
      .find((line) => line.startsWith('//') && line.replace(/^\/\/ ?/, '').trim());
    if (!first) return null;
    const said = first.replace(/^\/\/ ?/, '').trim();
    const halves = said.split(' — ');
    return flatten(halves.length > 1 ? halves.slice(1).join(' — ') : said);
  }

  const paragraph = body
    .replace(/^#[^\n]*\n/, '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#') && !block.startsWith('|'));
  return paragraph ? flatten(paragraph) : null;
}

/**
 * A heading as text, with its inline markdown taken off.
 *
 * A title here is pulled out of the document with a regex and handed to a
 * component that renders a plain string, so anything the author marked up
 * arrives as literal characters: .claude/commands/check-work.md opens with a
 * backticked slash command, and the page was titled with the backticks showing.
 *
 * The file is right and the view was wrong. A slash command IS code, and
 * backticks are how markdown says so; the fix is not to un-format the source but
 * to stop rendering markup as content.
 *
 * Underscores are deliberately left alone. Emphasis marked that way in a heading
 * is rare and file names carrying them are not — `data/me/how_to_talk_to_me.md`,
 * `data/state/open_loops.md` — and stripping the pair would turn one into
 * something that never existed.
 *
 * A citation is a link with a second pair of brackets — `[[ISO-42010]](url
 * "what it is and what does not transfer")`, the form every spec in this
 * repository uses for its sources. The link rule below cannot see it: its
 * `[^\]]+` stops at the inner `]`, so the whole apparatus survived as literal
 * text. That went unnoticed while this only ever ran over headings and row IDs,
 * which carry no citations; it stopped being harmless the moment the rail began
 * indexing whole register rows for its filter, because a search for `http` then
 * matched every rule in the register and the word in the excerpt was a URL.
 *
 * The label stays and the apparatus goes, which is the same trade the link rule
 * makes one line down: `ISO-42010` is a real thing to search a spec for, and the
 * address it lives at is not.
 */
function plainInline(text) {
  return String(text ?? '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Before the plain link rule, which would otherwise take the inner pair and
    // leave the outer brackets and the address behind.
    .replace(/\[\[([^\]]+)\]\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

/**
 * A description flattened to one run of text — markup off, newlines closed up.
 *
 * It used to cut at 150 characters and append an ellipsis, so that every row in
 * a listing was the same height. What that actually did was truncate exactly
 * the descriptions worth reading: a short one was never near the limit, and a
 * long one is long because the file is doing several things, which is the case
 * where a reader most needs the sentence finished. "…audit it against the
 * field's cu…" costs the click it was meant to save.
 *
 * Rows take the height their text needs now. There is deliberately no cap left
 * to tune: a cap is a guess about how much of a sentence is enough, and the
 * file is the only thing that knows.
 */
function flatten(text) {
  return String(text)
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What a folder is called, as opposed to what it is filed under.
 *
 * Asked of the folder itself first. Fifteen of the folders in `.claude/` open a
 * SKILL.md or a README.md with a heading their author wrote — "Check-in — the
 * default", "First contact — when the record is empty", "She's had an
 * appointment" — and no rule applied to the directory name could produce any of
 * them. It is the same file readFolder() already takes the one-line description
 * from, so the two always agree about which document speaks for the folder.
 *
 * The rest get their name tidied: separators out, first letter up. Sentence case
 * rather than Title Case, because that is what the fifteen are written in, and a
 * view where half the headings are capitalised one way and half the other reads
 * as two different sets of folders.
 *
 * A heading that is only the path again — a README.md opening
 * `# .claude/hooks/`, say — is no title at all, and falls through to the tidied
 * name rather than putting a path where a name goes.
 */
/**
 * What a FILE is called at the top of its own page.
 *
 * Taken from the file name, not from the heading inside it. The heading is
 * written for the document and is often a sentence — .claude/commands/
 * manage-harness.md opens "/manage-harness — own the harness end to end", which
 * is a good first line and a bad page title: it repeats the slug the breadcrumb
 * already shows, then runs on into the summary that is printed directly beneath
 * it anyway. The name is the one short, stable thing every file has.
 *
 * Separators out, words capitalised: manage-harness.md becomes "Manage Harness".
 *
 * A word already in capitals is left alone. This repository capitalises the
 * names of its standing documents on purpose — ARCHITECTURE.md, REFERENCES.md,
 * REVIEW.md, README.md — and title-casing those would produce "Readme" and
 * "Architecture", quietly overruling a convention the file names are stating.
 * Lowering a name is a judgement about the name; this function only formats.
 *
 * Note this is Title Case where folderTitle() is deliberately sentence case.
 * The two are different kinds of label — a folder is named after what it holds
 * and reads as a phrase, a file is named as an object — but if that ever reads
 * as two conventions fighting, this is the half to change.
 */
function fileTitle(name) {
  const base = String(name).replace(/\.[^.]+$/, '');
  return (
    base
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((word) => (word === word.toUpperCase() ? word : word[0].toUpperCase() + word.slice(1)))
      .join(' ') || name
  );
}

function folderTitle(full, name, folder) {
  const lead = ['SKILL.md', 'README.md'].map((file) => readText(join(full, file))).find(Boolean);
  const heading = lead ? plainInline(/^#\s+(.+)$/m.exec(frontmatter(lead).body)?.[1] ?? '') : '';

  const asPath = heading
    .replace(prefixOf(folder), '')
    .replace(/\/+$/, '')
    .toLowerCase();
  if (heading && asPath !== name.toLowerCase()) return heading;

  const tidied = name.replace(/[-_]+/g, ' ').trim();
  return tidied ? tidied[0].toUpperCase() + tidied.slice(1) : name;
}

// ── Reading a folder ────────────────────────────────────────────────────────


// ── One walk ────────────────────────────────────────────────────────────────
//
// Everything this module knows about the shape of `.claude/` comes from here,
// and it reads the folder exactly once per request.
//
// It did not used to. Three separate traversals had grown up beside each other —
// the listing counted files per row, the facts block walked for sizes, and the
// backlink graph read every markdown file — and none of them knew the others
// existed. One request for the overview cost 126 readdir, 123 stat and 54 reads,
// about 35ms, to answer questions about forty files that had not changed.
//
// So the walk happens once and everything is derived from what it found:
//
//   entries   what is directly in each folder, with each file's size
//   stats     the same folders with their subtree totalled up
//   links     which markdown file points at which
//
// react's cache() is the right scope for it. Longer than a request and it goes
// stale the moment the agent writes a file — which is the thing this view exists
// to show — and shorter is what it was already doing.
function scanFolder(root, folder) {
  const entries = new Map();
  const stats = new Map();
  const links = new Map();
  const text = new Map();
  // Every path the walk saw, as the key a link would have to resolve to. The
  // link pass below answers "is this really there" out of this rather than off
  // the disk — see the note above it.
  const present = new Set();

  // Returns the subtree totals for `rel`, and records everything on the way.
  const walk = (rel, depth = 0) => {
    const totals = { folders: 0, files: 0, bytes: 0 };
    if (depth > 6) return totals;

    const full = safeJoin(root, rel);
    if (!full) return totals;

    let dirents = [];
    try {
      dirents = readdirSync(full, { withFileTypes: true });
    } catch {
      // An unreadable folder is an empty one here. Reporting an IO error in a
      // file tree helps nobody who is looking for a file.
      entries.set(rel, []);
      return totals;
    }

    const rows = [];
    for (const dirent of dirents) {
      const childRel = rel ? `${rel}/${dirent.name}` : dirent.name;

      // Recorded before the dot-file skip, not after. The listing has no reason
      // to show `.gitkeep`, but a document that links to one is still linking to
      // something that is there, and a link pass that called it missing would be
      // answering a different question from the one it is asked.
      present.add(childRel);
      if (dirent.name.startsWith('.')) continue;

      const childFull = join(full, dirent.name);

      if (dirent.isDirectory()) {
        const inner = walk(childRel, depth + 1);
        totals.folders += 1 + inner.folders;
        totals.files += inner.files;
        totals.bytes += inner.bytes;
        rows.push({ kind: 'dir', name: dirent.name, rel: childRel, count: inner.files });
        continue;
      }

      let bytes = 0;
      try {
        bytes = statSync(childFull).size;
      } catch {
        // Gone between the listing and the stat. Still a file; just weightless.
      }
      totals.files += 1;
      totals.bytes += bytes;
      rows.push({ kind: 'file', name: dirent.name, rel: childRel, bytes });

      // Read once, here, and kept — the listing wants its first paragraph, the
      // link graph wants its links, and the file cache underneath means a second
      // request for an unchanged file costs a stat rather than a read.
      if (TEXT.test(dirent.name)) {
        const body = readText(childFull);
        if (body != null) text.set(childRel, body);
      }
    }

    entries.set(rel, rows);
    stats.set(rel, {
      folders: rows.filter((r) => r.kind === 'dir').length,
      files: rows.filter((r) => r.kind === 'file').length,
      nestedFolders: totals.folders,
      nestedFiles: totals.files,
      bytes: totals.bytes,
    });
    return totals;
  };

  walk('');

  // ── Who points at what ────────────────────────────────────────────────────
  //
  // Two forms are counted, the same two scripts/check-links.mjs validates,
  // because a path is a reference whichever way it is written here: a markdown
  // link target, and a backticked path.
  //
  // Each link resolves to ONE file, and only if that file is really there. Two
  // spellings are in use and they need different bases — a sibling named bare or
  // with `./`, and a distant file named from the repository root with the
  // `.claude/` prefix — so the file's own folder is tried first, because that is
  // what a bare name means, and the first candidate that exists wins. Keeping
  // every candidate instead was the first attempt and it credited a bare
  // `README.md` to two different files at once.
  //
  // ── "Really there" is asked of the walk, not of the disk ──────────────────
  //
  // This used to call existsSync() on each candidate. The walk immediately above
  // has just enumerated the entire folder, so every one of those was a syscall
  // asking a question the process had already answered — 1,113 of them per
  // request, 44–55ms measured, on a page whose own work is about 12ms.
  //
  // The rewrite is not only faster. existsSync() answers with the FILESYSTEM's
  // idea of sameness, and on Windows that is case-insensitive: every one of the
  // fifteen locked specs under `specs/ux/tabs/` carries a backlink written
  // ``[`REVIEW.md`](../../../REVIEW.md)``, whose backticked half resolves as a
  // sibling — `specs/ux/tabs/REVIEW.md` — and matched `review.md`, the tab spec
  // sitting next to it. So the link was credited to a path with no file at it,
  // the loop broke, and `.claude/REVIEW.md` never got the backlink it was owed.
  // Locally only: on the deployment's Linux filesystem the same code was right.
  // A Set is case-exact, so both now agree, and they agree with Linux.
  for (const [rel, body] of text) {
    if (!rel.endsWith('.md')) continue;
    const here = rel.split('/').slice(0, -1).join('/');
    for (const pattern of [LINK_TARGET, BACKTICKED_PATH]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(body)) !== null) {
        const raw = match[1].split('#')[0].replace(/^\.\//, '');
        if (!raw || /^[a-z]+:/i.test(raw)) continue;
        const rooted = raw.replace(prefixOf(folder), '');
        for (const candidate of [here ? `${here}/${raw}` : raw, rooted]) {
          // Normalised the same way safeJoin does it — `.` dropped, `..` popped,
          // and null the moment it would climb out of `.claude/`, which is what
          // kept `../ux/app/globals.css` out of this graph before and keeps it
          // out now. `a/../b.md` and `b.md` come out as one key either way.
          const key = withinHarness(candidate.replace(/\/+$/, ''));
          if (key == null || !present.has(key)) continue;
          // A file citing itself is not a reference, it is a heading anchor.
          if (key !== rel) {
            if (!links.has(key)) links.set(key, new Set());
            links.get(key).add(rel);
          }
          break;
        }
      }
    }
  }

  return { entries, stats, links, text };
}

const LINK_TARGET = /\]\(([^)\s]+)\)/g;
const BACKTICKED_PATH = /`([^`\s]+\.md)`/g;

// ── Rows worth linking to ───────────────────────────────────────────────────
//
// The specs are not prose with headings; their substance is a table, and the
// unit somebody actually refers to is a ROW. ARCHITECTURE.md says so itself:
// "always cite a row by both its ID and its spec statement". A contents list
// that stops at `## Specifications Register` therefore stops one level above
// everything anyone comes to that document for.
//
// So the rows get anchors. Two steps, because markdown and HTML each know half
// of it: tableRows() reads the labels out of the source, and anchorRows() puts
// the matching ids onto the rendered <tr>s. They walk the same rows in the same
// order, which is the whole reason they can be kept in step.

/**
 * The first column of every body row of every table in a chunk of markdown.
 *
 * A numeric column is not a name — `1` in a rail is a row of nothing. Where the
 * ids are numbers, the SECOND column's header names them instead: the provisions
 * table is `#` | `Provision`, so its rows come back as "Provision 1". Where they
 * already read as ids they are left alone, which is how ARC-003 stays ARC-003.
 *
 * `taken` is shared across a whole document so two tables cannot mint the same
 * anchor; the id is what a URL will carry, and a duplicate would send the reader
 * to whichever came first.
 */
function tableRows(markdown, taken) {
  const rows = [];
  let header = null;
  let inBody = false;

  for (const raw of String(markdown ?? '').split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      header = null;
      inBody = false;
      continue;
    }

    const cells = line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());

    if (!header) {
      header = cells;
      continue;
    }
    if (!inBody) {
      // The `---|---` rule under the header, and nothing else, opens the body.
      inBody = /^[-: ]+$/.test(cells.join(''));
      continue;
    }

    const first = plainInline(cells[0] ?? '');
    if (!first) continue;

    const numeric = /^\d+$/.test(first);
    const label = numeric ? `${plainInline(header[1] ?? 'Row')} ${first}` : first;

    let id = slugify(label);
    if (!id) continue;
    while (taken.has(id)) id = `${id}-`;
    taken.add(id);

    // What the row SAYS, carried beside what it is called.
    //
    // A register row's label is its ID — `ARC-003` — which is the right thing to
    // print in a 206px margin and the wrong thing to search. Nobody hunting for
    // the rule about the safety floor knows its number; not knowing it is why
    // they are hunting. So the rest of the row comes along as the text the rail's
    // filter reads.
    //
    // ── Every column, not just the statement ───────────────────────────────
    //
    // This carried the second column alone at first, on the assumption that the
    // rationale and the recommendation beside it were too heavy to ship. They
    // are not, and the assumption cost the filter the answers it is most often
    // asked for: `data/` is not in ARC-003's statement — it is in the rationale
    // and in the recommendation — so searching this register for the folder the
    // whole register is about returned nothing.
    //
    // The weight was overestimated by an order of magnitude because the bulk of
    // these cells is citation tooltips, and plainInline() drops those with the
    // link. ARCHITECTURE.md is the largest spec in the harness and its twenty-one
    // rows come to 12.5kb of text across all columns, against 1.1kb for the
    // statements alone. That is a fair price for a filter that works.
    rows.push({
      id,
      label,
      text: cells.slice(1).map(plainInline).filter(Boolean).join(' · '),
    });
  }

  return rows;
}

/**
 * The same rows, as ids on the rendered table.
 *
 * Only inside <tbody>, so the header row never takes one, and in order — a
 * markdown table's body rows become <tr>s one for one, which is what lets this
 * be positional rather than a second parse of the same content.
 */
function anchorRows(html, rows) {
  if (!rows.length) return html;
  let i = 0;
  return html.replace(
    /(<tbody>)([\s\S]*?)(<\/tbody>)/g,
    (all, open, body, close) =>
      open + body.replace(/<tr>/g, () => (i < rows.length ? `<tr id="${rows[i++].id}">` : '<tr>')) + close,
  );
}

// ── One reader per folder ───────────────────────────────────────────────────
//
// Everything below closes over one root. The walk is cached per request per
// folder, so the two tabs never share or evict each other's scan. A link that
// climbs out of the root is left out of that folder's graph, the same as it
// always was: a spec citing `.claude/REVIEW.md` is a real link, and simply not
// one the Specs tab draws a backlink for.
function createFolderView({ root, route, folder, gloss }) {
  const scan = cache(() => scanFolder(root, folder));

  /**
   * The route this app serves a harness path at — the identity map.
   *
   * `hooks/` is the one entry whose page is not a listing: app/(dashboard)/
   * harness/hooks/page.jsx sits on that exact route, because whether a hook is
   * wired up is the only thing worth knowing about one and that answer lives in
   * settings.json rather than in the folder. Nothing special is needed here for
   * that — the route is the path either way — and everything INSIDE the folder
   * stays an ordinary file that opens as its own source. A tree claiming to mirror
   * the disk has to let you reach what is actually in it.
   */
  function href(relPath) {
    const clean = toPosix(relPath ?? '').replace(/^\/+|\/+$/g, '');
    return clean ? `${route}/${clean}` : route;
  }

  /** The hand-written line for a top-level entry, if it has one. */
  function glossFor(relPath) {
    const clean = toPosix(relPath ?? '').replace(/^\/+|\/+$/g, '');
    return clean.includes('/') ? null : (gloss[clean] ?? null);
  }

  /** The harness files that point at `relPath`, alphabetically. */
  function referencedBy(relPath) {
    const from = scan().links.get(String(relPath ?? '').replace(/^\/+|\/+$/g, ''));
    return from ? [...from].sort().map((path) => ({ path, href: href(path) })) : [];
  }

  /** What `relPath` itself points at — the same graph, read the other way. */
  function references(relPath) {
    const self = String(relPath ?? '').replace(/^\/+|\/+$/g, '');
    const out = [];
    for (const [target, sources] of scan().links) {
      if (sources.has(self)) out.push(target);
    }
    return out.sort().map((path) => ({ path, href: href(path) }));
  }

  /**
   * What a folder holds, as rows ready to render.
   *
   * Folders first, then files, each alphabetical — the order an editor lists a
   * directory in, which is the order this whole view is trying to reproduce. The
   * one departure: a README and an ARCHITECTURE sort to the top of their group.
   * Those two exist to be read first, and plain alphabetical order puts
   * ARCHITECTURE.md above `context/` by luck and README.md below `prompts/` by the
   * same luck. A reading order that depends on luck is not one.
   */
  function readFolder(relPath) {
    const rows = (scan().entries.get(String(relPath ?? '')) ?? []).map((row) => {
      const shared = {
        name: row.name,
        path: row.rel,
        href: href(row.rel),
        gloss: glossFor(row.rel),
      };

      if (row.kind === 'dir') {
        // A folder describes itself through whichever file inside it was written
        // to be read: a skill's SKILL.md, anything else's README. Both were read
        // by the walk, so this is a map lookup rather than two speculative opens
        // per folder — which is what it used to be, on every folder, every request.
        const lead = ['SKILL.md', 'README.md']
          .map((name) => scan().text.get(`${row.rel}/${name}`))
          .find(Boolean);
        return {
          kind: 'dir',
          ...shared,
          description: lead ? describe(lead, 'SKILL.md') : null,
          count: row.count,
        };
      }

      const source = scan().text.get(row.rel);
      return {
        kind: 'file',
        ...shared,
        description: source ? describe(source, row.name) : null,
        count: null,
      };
    });

    const first = (row) => (/^(README|ARCHITECTURE)\./i.test(row.name) ? 0 : 1);
    return rows.sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === 'dir' ? -1 : 1) ||
        first(a) - first(b) ||
        a.name.localeCompare(b.name),
    );
  }

  // ── What the views ask for ──────────────────────────────────────────────────

  /** The top of `.claude/`, exactly as it sits on disk. */
  function getTop() {
    const entries = readFolder('');
    return { ok: entries.length > 0, entries };
  }

  /**
   * The same, with every folder expanded — the whole harness as one tree.
   *
   * getTop() is one level deep, which is what the overview needs. The index
   * beside the panel needs all of it at once: it is the thing that stays put while
   * files open next to it, and an index that has to be navigated to see its own
   * contents is a second panel, not an index.
   *
   * Depth-capped rather than unbounded. The harness is three levels deep and a cap
   * costs nothing today; without one, a symlink or a folder someone nests six deep
   * turns every page render into a full-tree walk.
   */
  // Wrapped in cache() so the tree is walked once per request rather than once per
  // component that asks for it. The layout and the overview both want it, and
  // without this each one pays for its own recursive readdir of `.claude/`.
  const getTree = cache((maxDepth = 4) => {
    const expand = (entries, depth) =>
      entries.map((entry) =>
        entry.kind === 'dir' && depth < maxDepth
          ? { ...entry, children: expand(readFolder(entry.path), depth + 1) }
          : entry,
      );

    const { ok, entries } = getTop();
    return { ok, entries: expand(entries, 1) };
  });

  /**
   * One path inside the harness: a folder to list, or a file to read.
   *
   * Returns kind `missing` for anything not there or not allowed, so a route can
   * render a not-found without having to tell those two apart. From the address
   * bar they are the same thing, and saying which is which hands out free
   * information about a filesystem.
   */
  // Wrapped for the same reason, and it matters more here: the panel and the right
  // rail both resolve the open path on every navigation, so an uncached read meant
  // the file was opened off disk and its markdown parsed TWICE per click — the
  // rail only wants the headings, but it was paying for the whole render to get
  // them. cache() is per request, so a file edited between clicks is still read
  // fresh.
  const getPath = cache((relPath) => {
    const clean = toPosix(relPath ?? '').replace(/^\/+|\/+$/g, '');
    const full = safeJoin(root, clean);
    if (!full) return { kind: 'missing', path: clean };

    let stat;
    try {
      stat = statSync(full);
    } catch {
      return { kind: 'missing', path: clean };
    }

    const name = clean.split('/').pop() ?? '';
    const where = { path: clean, name, gloss: glossFor(clean), crumbs: crumbsFor(clean) };

    if (stat.isDirectory()) {
      return {
        kind: 'dir',
        ...where,
        title: folderTitle(full, name, folder),
        entries: readFolder(clean),
        stats: scan().stats.get(clean) ?? null,
        referencedBy: referencedBy(clean),
        references: references(clean),
      };
    }

    // How big the file is on disk, which is a different fact from how long it is
    // to read. A spec with a long fenced tree in it weighs more than its word count
    // suggests, and a JSON file has no word count worth printing at all — this is
    // the one measure every kind of file here can answer.
    const bytes = stat.size;

    const source = TEXT.test(name) ? readText(full) : null;
    if (source == null) return { kind: 'opaque', ...where, bytes };

    const { meta, body } = frontmatter(source);

    // Not markdown: a hook, a settings file, a script. Its header comment becomes
    // the lead and its dividers become anchors — see lib/harness-code.js — and the
    // source itself is handed over untouched.
    //
    // Cached on the file's mtime like the documents below, and for the same
    // reason: these routes are force-dynamic by necessity, so an uncached read
    // re-splits the same unchanged file on every click.
    if (!name.endsWith('.md')) {
      const parsed = fromFile(full, 'code', () => readCode(name, body));
      return { kind: 'code', ...where, meta, bytes, ...parsed };
    }

    // Markdown is rendered with toHtml rather than renderBody, and that is
    // deliberate. renderBody drops wholly-italic paragraphs, because in HER record
    // those are template guidance written for the agent, and showing them to her
    // is showing her the form instead of the answer. Nothing in the harness is a
    // form. An italic line in a spec is the argument, and dropping it here would
    // silently delete the reasoning this page exists to show.
    // Split and rendered once per version of the file rather than once per
    // navigation. These routes are force-dynamic by necessity, so without this the
    // same unchanged spec is re-parsed on every click — the largest of them is
    // 22kb and costs about 18ms to turn into HTML, paid again for nothing.
    const rendered = fromFile(full, 'doc', () => {
      const parsed = sections(body);

      // One set of ids for the whole document, so no two rows can claim the same
      // anchor. Seeded with the section headings, which mint theirs from the same
      // slugify() and would otherwise be the easiest thing for a row to collide
      // with.
      const taken = new Set(parsed.sections.map((section) => slugify(plainInline(section.heading))));

      // The lead is scanned before the sections, because that is the order it sits
      // in. It is not just a preamble: dashboard/purpose.md keeps its whole DSH
      // table above the first `##`, so a scan that started at the sections found
      // one anchor in that file and missed both rows anyone opens it for.
      const leadBody = parsed.lead.replace(/^#\s+.+$/m, '');
      const leadRows = tableRows(leadBody, taken);

      // What the document calls itself, where it says something the filename
      // cannot.
      //
      // This was the filename alone, and the H1 was stripped from the lead and
      // shown nowhere — so `# Architecture [ARC]` rendered as "ARCHITECTURE" and
      // the tag went missing from the one page that explains what it tags. The ID
      // prefix is not decoration: every row in the register is ARC-0xx and every
      // citation elsewhere is "[ARC]", so the document has to be able to say which
      // letters are its own.
      //
      // The filename stays the fallback, and keeps one case it was chosen for: a
      // heading that opens with a slash. commands/check-work.md heads itself
      // `# /check-work`, and the breadcrumb above the title already ends in one —
      // `.claude / commands /` followed by `/check-work` is two slashes colliding
      // and a title that reads as another path segment. Anything path-shaped is
      // left to the filename; everything else gets to keep its own name.
      const own = plainInline(/^#\s+(.+)$/m.exec(parsed.lead)?.[1] ?? '');

      // ── What is true ABOUT the document ────────────────────────────────────
      //
      // Two, and both say something the contents list underneath them cannot: how
      // long this is. Three sections may be two hundred words or three thousand,
      // and the difference decides whether you read now or come back.
      //
      // Three were tried and dropped. SECTIONS, because the list directly below
      // already names every one of them and a count over a list is the same fact
      // twice. RULES — the register rows, which is the unit anyone cites here —
      // and SOURCES, the distinct works a spec leans on: both were interesting and
      // neither was load-bearing, and a margin block earns its place by being
      // glanced at rather than by being complete.
      //
      // LAST CHANGED is the one worth wanting and the one not here. The only cheap
      // source is the filesystem mtime, and lib/content-read.js already refuses
      // that for the record on the grounds that a clone, a checkout or a sync
      // rewrites it. A date that lies is worse than no date; the honest source is
      // git, which is the Changes tab's whole job.
      const sectionRows = parsed.sections.map((section) => tableRows(section.body, taken));

      return {
        title: own && !own.startsWith('/') ? own : fileTitle(name),
        // As the file has them, frontmatter and all, because that is what a line
        // number in an editor counts. Split on a pattern rather than on a literal,
        // so a file saved with CRLF is not counted as one very long line.
        lines: body.split(/\r?\n/).length,
        // Fenced blocks are not read the way prose is — the layout tree in the
        // architecture spec is forty "words" that are all paths — so they come out
        // before counting. That is the difference between the two: `lines` is a
        // position in a file and counts everything in it, `words` is a quantity of
        // reading and counts only what gets read.
        words: body
          .replace(/^---[\s\S]*?---\s*/, '')
          .replace(/```[\s\S]*?```/g, ' ')
          .split(/\s+/)
          .filter(Boolean).length,
        lead: anchorRows(toHtml(leadBody), leadRows),
        leadRows,
        sections: parsed.sections.map((section, i) => {
          // Taken from the pass above rather than re-parsed: tableRows() mints
          // ids against the shared `taken` set, so running it twice over the same
          // section would find every id already claimed and suffix them all.
          const rows = sectionRows[i];
          return {
            // Same treatment as the title, and it leaves the anchors alone:
            // slugify() already drops backticks and asterisks as non-word
            // characters, so an id built from the stripped heading is the id it
            // was building already.
            heading: plainInline(section.heading),
            html: anchorRows(toHtml(section.body), rows),
            rows,
          };
        }),
      };
    });

    return {
      kind: 'doc',
      ...where,
      meta,
      bytes,
      ...rendered,
      referencedBy: referencedBy(clean),
      references: references(clean),
    };
  });

  /**
   * The trail back up, so a file three folders deep says where it is.
   *
   * The segments are the folder names as they are on disk, not prettified. This
   * view's whole claim is that it shows you `.claude/`; a breadcrumb that quietly
   * retitled `specs` to "Specs" on the way past would be the one place it stopped
   * being true, and the one place a reader would not think to check.
   */
  function crumbsFor(relPath) {
    const parts = String(relPath).split('/').filter(Boolean);
    return parts.slice(0, -1).map((part, i) => ({
      label: part,
      href: href(parts.slice(0, i + 1).join('/')),
    }));
  }

  return { route, folder, href, glossFor, getTop, getTree, getPath };
}

export const harnessView = createFolderView({ root: HARNESS, ...HARNESS_VIEW, gloss: HARNESS_GLOSS });
export const specsView = createFolderView({ root: SPECS, ...SPECS_VIEW, gloss: SPECS_GLOSS });

// For the change log, which links a changed file to the tab that opens it.
export const harnessHref = harnessView.href;
export const specsHref = specsView.href;
