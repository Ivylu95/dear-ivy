'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons';
import { Reading } from '@/components/ui/Reading';
import { markFor } from '@/lib/harness-marks';
import { VIEW_ICON } from '@/lib/views';
import {
  getPendingRoute,
  routeFor,
  serverPendingRoute,
  setPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';

// `.claude/`, as a tree, beside the file it opens.
//
// This is the third navigation in the app, and it exists because the other two
// cannot do this one's job. The left rail moves between VIEWS and never changes.
// The right rail moves within the page you are on. Neither holds still while you
// read a series of files — and reading a series of files is the whole activity
// here. Opening CLAUDE.md, then a spec, then the skill the spec governs is three
// clicks with this and six with a back button.
//
// It lives in a layout rather than in each page, so Next keeps the same DOM node
// across navigations: the tree does not re-mount, does not lose its scroll
// position, and does not flash while the panel beside it streams in. That
// persistence is most of what makes a panel feel like a panel rather than a new
// screen.
//
// ── It is the folder, and nothing else ──────────────────────────────────────
//
// Every row is a real entry on disk, at the depth it actually sits, under the
// name it actually has. There is no grouping laid over it and no row you cannot
// point at in a file browser. It had one for a while — eight themed headings,
// two of them invented to hold the loose files at the top — and the cost was
// that the tree and the folder disagreed, so neither could be trusted to answer
// "what is actually in there".
//
// The consequence to keep in mind: everything here comes from lib/harness.js
// reading the directory, so a file added to `.claude/` appears on the next
// request with nothing else edited. That is the property the grouping was
// quietly spending.
//
// ── Why a client component ──────────────────────────────────────────────────
//
// It needs the current path to mark a row and to open the branch holding it, and
// pathname is not knowable on the server for a layout that must not re-render
// per route. Everything it displays was read on the server and handed down; this
// adds only "where am I".
//
// Drawn for either folder tab. `tab` is its wording and route from
// lib/folder-views.js — plain data, because this is a client component.
export function HarnessIndex({ entries, tab }) {
  // Where the tree should draw itself as being: the page being navigated TO if a
  // click is still in flight, otherwise the page actually open.
  //
  // Every harness route is a server component reading files at request time, so
  // there is a real gap between the click and the new panel — and in that gap
  // usePathname() still answers with the file you are leaving. Marking from the
  // pathname alone therefore left the OLD row lit for the whole wait, which is
  // the thing that reads as a dead click rather than as a slow one. The shared
  // channel in lib/route-pending.js is the same one the left rail marks itself
  // from, so both columns change at the same instant and neither can be caught
  // pointing somewhere the app has already left.
  //
  // Next gives the pathname encoded; the tree's own hrefs are not. A file with a
  // space or a bracket in its name would otherwise never match its own row.
  const here = usePathname();
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const pathname = safeDecode(routeFor(here));

  // Which folders are open. Seeded from the path on first render so a deep link
  // arrives with its branch already unfolded.
  //
  // Additive, deliberately: navigating opens the folder you went into and leaves
  // every folder you opened by hand exactly as you left it. The alternative —
  // deriving open state from the path alone — closes folders the reader opened
  // on purpose every time they click something, which reads as the tree fighting
  // them.
  const [open, setOpen] = useState(() => ancestorsOf(pathname, tab.route));

  // Adjusted during render rather than in an effect. React's own guidance for
  // state that has to respond to a changing input: compare against the value
  // last rendered, and set during render, which React handles by re-running this
  // component before committing anything. In an effect the same work paints the
  // old tree first and then corrects it, so a deep link would visibly unfold a
  // beat after arriving.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen((prev) => new Set([...prev, ...ancestorsOf(pathname, tab.route)]));
  }

  const toggle = (path, isOpen) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(path);
      else next.delete(path);
      return next;
    });

  // What has been typed into the filter, and the tree that survives it.
  //
  // ── Why it filters rather than jumps ────────────────────────────────────────
  //
  // The obvious alternative is a picker: type, get a flat list of hits, pick one,
  // and the tree goes back to how it was. That answers "open the file I can
  // already name" and nothing else. This column's actual job is the other
  // question — what is in here, and what sits next to what — so the search keeps
  // the tree's shape and removes the rows that do not match. A hit stays where it
  // lives, under its folder, at its depth, which is the fact worth having: a
  // `guard` that turns out to be in `hooks/` has told you something a flat list
  // never would.
  //
  // Matched on the name and the description, never the path. Matching the path
  // would mean typing `specs` keeps every file under `specs/` — every one of
  // their paths contains it — so one broad word would empty the filter of any
  // meaning. A folder whose own name matches keeps its whole subtree instead,
  // which is the same intent said precisely: you asked for that folder, so here
  // is that folder. See haystack() below for what else is searched.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? filterTree(entries, q) : entries), [entries, q]);

  // While filtering, every surviving folder is open, and `open` is left exactly
  // as the reader last set it by hand. A filter that collapsed the tree would
  // hide the hits it just found; one that wrote its unfolding into `open` would
  // silently rearrange the tree they come back to when the field is cleared.
  const found = useMemo(() => (q ? countRows(visible) : 0), [q, visible]);
  const openWhileFiltering = useMemo(
    () => (q ? new Set(foldersIn(visible)) : null),
    [q, visible],
  );

  const state = { pathname, here, open: openWhileFiltering ?? open, toggle };

  // Arrow keys through the tree.
  //
  // Sixty rows, a developer reading a series of files, and until now the only
  // way down the column was Tab — which stops at the fold button of every folder
  // as well as its name, so reaching the fourth file meant eleven presses. A
  // file tree that cannot be arrowed through is a page, not a tool.
  //
  // The rows are read out of the DOM rather than tracked in state. They are
  // already rendered in document order, the filter and the folds decide which
  // exist, and asking the document means this cannot disagree with what is on
  // screen — which a parallel index of the same tree eventually would.
  const onKeyDown = (event) => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;

    // Every row's NAME, folder or file. The fold button beside a folder is
    // deliberately not in the list: it does what ArrowRight and ArrowLeft
    // already do, and a reader holding ArrowDown does not want to stop on it.
    const rows = [
      ...event.currentTarget.querySelectorAll('a.harness-index-open, a.harness-index-row'),
    ];
    if (!rows.length) return;

    const at = rows.indexOf(document.activeElement);
    const focus = (i) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (next) next.focus();
    };

    const row = at >= 0 ? rows[at] : null;
    const path = row?.dataset.path;
    const isDir = row?.dataset.dir === 'true';
    const isOpen = path ? state.open.has(path) : false;

    event.preventDefault();

    if (event.key === 'Home') return focus(0);
    if (event.key === 'End') return focus(rows.length - 1);
    if (event.key === 'ArrowDown') return focus(at < 0 ? 0 : at + 1);
    if (event.key === 'ArrowUp') return focus(at < 0 ? rows.length - 1 : at - 1);

    // Right opens a closed folder and steps into an open one; left closes an
    // open folder and steps out of anything else. That pair is what makes a tree
    // navigable rather than a list you scroll: one key answers both "show me
    // what is in here" and "take me back out".
    if (event.key === 'ArrowRight') {
      if (isDir && !isOpen) return toggle(path, true);
      return focus(at + 1);
    }

    if (isDir && isOpen) return toggle(path, false);
    // Out to the folder holding this one — the row whose path is this one's
    // parent, which is always above it and always rendered when this row is.
    const parent = path?.split('/').slice(0, -1).join('/');
    const up = parent ? rows.findIndex((r) => r.dataset.path === parent) : -1;
    return focus(up >= 0 ? up : at - 1);
  };

  // Every folder that has something to unfold, in one flat list.
  //
  // Computed from the tree rather than tracked as it is drawn, so "all" means
  // all of it and not "all of the ones rendered so far". Memoised on `entries`,
  // which changes only when the folder on disk does: without that it walks the
  // whole tree on every keystroke of a drag or a hover.
  const foldable = useMemo(() => {
    const out = [];
    const walk = (rows) => {
      for (const row of rows ?? []) {
        if (row.kind === 'dir' && row.children?.length) {
          out.push(row.path);
          walk(row.children);
        }
      }
    };
    walk(entries);
    return out;
  }, [entries]);

  const anyOpen = open.size > 0;

  // The narrow-screen fold. A button and a flag rather than a <details> around
  // the whole tree, because a <details> without `open` hides its contents at
  // EVERY width — the column would be empty on the wide screens this layout is
  // for. With a flag the stylesheet decides: above the breakpoint it ignores the
  // flag and the button is not rendered at all; below it, both apply.
  const [shown, setShown] = useState(false);

  return (
    <>
      <button
        type="button"
        className="harness-aside-toggle"
        aria-expanded={shown}
        aria-controls="harness-index"
        onClick={() => setShown((was) => !was)}
      >
        {shown ? `Hide ${tab.noun}` : `Browse ${tab.noun}`}
      </button>

      <nav
        className="harness-index"
        id="harness-index"
        onKeyDown={onKeyDown}
        data-shown={shown ? 'true' : 'false'}
        aria-label={tab.title}
      >
        {/* What this column is, above what it contains.
            
            The row below names the FOLDER — `.claude/` — which is the column's
            claim about where its rows come from, and says nothing about which
            part of the app you are in. The left rail marks the tab, but it is a
            long way from here and collapses to glyphs; a reader arriving at this
            panel from a deep link has no other label to read. Same mark and same
            word as the tab itself, so the two cannot be taken for different
            places. */}
        {/* Every glyph in this column names its weight, this one included.

            They are the smallest icons in the app — 10px to 15px against 24 in
            the app's largest — and the set's stroke is written on the 24 grid,
            so it thins with the glyph and lands under a device pixel here. A
            browser paints a sub-pixel line by spreading it into grey, and a
            column of grey glyphs reads as a low-resolution icon set. Naming the
            stroke in rendered pixels holds it at one weight from the mast down
            to the last row, which is also what makes the column look like one
            set rather than one per size. */}
        <p className="harness-index-mast">
          <Icon name={VIEW_ICON[tab.route]} size={15} className="harness-index-mast-icon" />
          {tab.title}
        </p>

        {/* Six words for a reader who does not have the word yet.

            `specs/README.md` once defined the harness under Defined terms as
            "everything generic: instructions, skills, specs, configuration,
            tooling" — accurate, and a list. A list does not survive being cut to
            what fits a margin; the first attempt cut it to "the machinery around
            the record", which kept the accuracy and said nothing about what any
            of it DOES.

            What all five of those things have in common is their timing: every
            one of them is loaded before she has said anything, and none of it is
            a reply to her. That is the fact worth six words, and it is also the
            one that separates this tab from every other tab in the app — those
            are what the agent was told BY her, this is what it was told before
            she arrived. */}
        <p className="harness-index-mast-sub">{tab.tagline}</p>

        {/* The filter, above the folder it filters.

            Placed over `.claude/` rather than under it because everything below
            that row is the tree, and a control that sits inside the thing it
            acts on has to be told apart from the rows around it every time. Here
            it reads as what it is: the last part of the column's heading.

            type="search" for the browser's own affordances — the clear gesture,
            the escape key, and the right keyboard on a touch device — with a
            clear button of our own beside it, because the native one is absent
            on some platforms and unstyleable on the rest. */}
        <div className="harness-index-search">
          <Icon name="search" size={13} className="harness-index-search-mark" />
          <input
            type="search"
            className="harness-index-search-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Escape clears rather than blurs. The field holds the only state in
            // this column a reader can get stuck in — a query matching nothing
            // looks identical to an empty harness — so the way out is the key
            // they will already try.
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder={`Filter ${tab.noun}`}
            aria-label={`Filter ${tab.noun} by name`}
            aria-describedby={q ? 'harness-index-found' : undefined}
            spellCheck="false"
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              className="harness-index-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear the filter"
              title="Clear the filter"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        {/* The label over the list, and the two controls that act on the whole
            of it.
            
            The label is in the same small tracked caps the right rail titles its
            own index with, and it is the name of the folder rather than a
            description of the page, because the column's whole claim is that it
            IS that folder. It is also the way back to the overview, which is why
            it is a link and not an <h2> — and why the controls sit beside it
            rather than inside it, since a button nested in a link is neither. */}
        <div className="harness-index-head">
          <Link
            href={tab.route}
            className="harness-index-top"
            data-active={pathname === tab.route ? 'true' : undefined}
            aria-current={pathname === tab.route ? 'page' : undefined}
            onClick={() => setPendingRoute(tab.route, here)}
          >
            {tab.folder}/
            <Reading />
          </Link>

          {/* One toggle, not a pair of buttons.
              
              It was two — `expand` and `collapse`, side by side, each going
              inert when it would do nothing. Two controls beside a heading in a
              206px column is a toolbar, and the inert one read as broken rather
              than as unavailable.
              
              One also matches what the interaction actually costs. Expanding
              everything is the DESTRUCTIVE move here: Hagan Rivers' account of
              tree interaction is that expanding and collapsing move everything
              around, and that a large tree can destroy positional memory — the
              sense of where you are, which is most of how anyone finds anything
              in a file tree. So it is one quiet word in the margin rather than
              two, and the word offered is always the one that undoes the state
              you are in.
              
              The trade is that going from "some folders open" to "everything
              open" costs two clicks. That is the right way round: the cheap
              click is the one that puts the tree back to a state you can
              navigate.
              
              aria-label and aria-expanded say different things and both are
              required — the label is what the click WILL do, aria-expanded is
              the state the tree is IN. Swapping the label alone is the common
              bug. */}
          {/* While filtering, the count stands where the toggle does.

              The toggle has nothing to say then — every surviving folder is
              already open — and the count answers the question a filter always
              raises: is this everything, or is the rest folded away somewhere.
              aria-live, because the number changes without the focus ever
              leaving the field, and a screen reader would otherwise hear
              nothing at all in response to typing. */}
          {q && (
            <span
              className="harness-index-found"
              id="harness-index-found"
              role="status"
              aria-live="polite"
            >
              {found === 1 ? '1 match' : `${found} matches`}
            </span>
          )}

          {!q && foldable.length > 0 && (
            <button
              type="button"
              className="harness-index-toggle"
              aria-expanded={anyOpen}
              aria-controls="harness-tree"
              aria-label={anyOpen ? 'Collapse every folder' : 'Expand every folder'}
              title={anyOpen ? 'Collapse every folder' : 'Expand every folder'}
              onClick={() => setOpen(anyOpen ? new Set() : new Set(foldable))}
            >
              {anyOpen ? 'collapse' : 'expand'}
            </button>
          )}
        </div>

        <Branch entries={visible} state={state} root />

        {/* A query matching nothing renders an empty column, which looks exactly
            like a harness with nothing in it. Said in words instead, with the
            query quoted back so it is clear what was searched for. */}
        {q && !visible.length && (
          <p className="harness-index-none">
            Nothing here is called <strong>{query.trim()}</strong>.
          </p>
        )}
      </nav>
    </>
  );
}

// A folder's contents, and its folders' contents, to whatever depth the tree was
// read to.
//
// One shape per level — the indent is what says how deep you are, and a tree
// that changes its row at level two makes you re-learn it at level two. The top
// level is the one exception, and only in spacing: it hangs off `.claude/`
// rather than off a row, so it carries no rule down its left side.
function Branch({ entries, state, root }) {
  if (!entries?.length) return null;

  return (
    <div
      className={root ? 'harness-index-root' : 'harness-index-branch'}
      id={root ? 'harness-tree' : undefined}
    >
      {entries.map((entry) =>
        entry.kind === 'dir' ? (
          <Folder key={entry.path} entry={entry} state={state} />
        ) : (
          <Row key={entry.path} entry={entry} state={state} />
        ),
      )}
    </div>
  );
}

// A folder with something in it: two controls on one row.
//
// The name opens the folder's own listing in the panel — the same page the
// breadcrumb reaches — and unfolds the branch on the way, so one click answers
// both "what is in here" questions at once: the names, in the tree, and the line
// against each of them, in the panel. The chevron beside it folds and unfolds
// without touching the panel, which is what you want while reading one file and
// looking for the next.
//
// It used to be one control doing only the fold, on the argument that an
// unfolded branch says more than the listing does. It doesn't: the branch gives
// names, and the listing gives the sentence that says what each name is for —
// `prompts/` and `commands/` are equally opaque until something spells them out.
// A folder row that refused to open the folder also had to be learned, because
// every other row in the column opens what it points at.
//
// Two interactive elements rather than one, and therefore not a <details>: a
// link inside a <summary> is nested interactive content, which browsers and
// screen readers each resolve differently. The disclosure semantics <details>
// gave for free are restated on the button — aria-expanded, and aria-controls
// pointing at the branch it opens.
function Folder({ entry, state }) {
  // A folder read past the depth cap, or one with nothing in it, has no branch
  // to unfold — and still draws the chevron, as a mark rather than as a control.
  //
  // Every folder in the column carries one, because the column holds ONE thing
  // per row and that one thing has to mean the same on every line: a chevron
  // says folder, a glyph says file, and the reader learns it once. Giving the
  // empty ones a folder picture instead was accurate about each row on its own
  // and unreadable down the column — the same position saying "fold me" on one
  // line and "I am a folder" on the next.
  //
  // So the glyph is the same and the ELEMENT is not: a <span>, not a <button>,
  // with nothing to expand and no aria-expanded to claim it can. A control that
  // opens onto nothing is the thing this must not become; a mark that happens to
  // be chevron-shaped is not a control at all. The row still opens the folder's
  // own listing, which is where an empty one says so in words.
  const canFold = Boolean(entry.children?.length);
  const isOpen = canFold && state.open.has(entry.path);
  const active = state.pathname === entry.href;
  const branchId = `harness-branch-${entry.path.replace(/[^\w-]/g, '-')}`;

  return (
    <div className="harness-index-folder" data-open={isOpen ? 'true' : undefined}>
      <div
        className="harness-index-row"
        data-kind="dir"
        data-active={active ? 'true' : undefined}
      >
        {!canFold && (
          <span className="harness-index-twist harness-index-twist-still" aria-hidden="true">
            <Icon name="chevron" size={10} className="harness-index-chevron" />
          </span>
        )}

        {canFold && (
        <button
          type="button"
          className="harness-index-twist"
          aria-expanded={isOpen}
          // Only while there is something to point at: the branch is rendered
          // rather than hidden when folded, and aria-controls naming an id that
          // is not in the document tells a screen reader nothing at all.
          aria-controls={isOpen ? branchId : undefined}
          aria-label={`${isOpen ? 'Fold' : 'Unfold'} ${entry.name}`}
          onClick={() => state.toggle(entry.path, !isOpen)}
        >
          <Icon name="chevron" size={10} className="harness-index-chevron" />
        </button>
        )}

        <Link
          href={entry.href}
          className="harness-index-open"
          data-path={entry.path}
          data-dir="true"
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            // Folds as well as unfolds — the same toggle the chevron does, with
            // the navigation on top.
            //
            // It used to unfold only, on the reasoning that a click meant to
            // open the listing should not close the branch under it and move
            // every row below. That reads well and it is wrong in the hand: a
            // folder tree toggles when you click a folder, everywhere anyone has
            // ever used one, and a row that opens on the first click and then
            // does nothing on the second is a row the reader clicks twice and
            // then looks for the real control. Refusing to fold also made the
            // two halves of one row disagree — the chevron toggled, the name
            // next to it did not.
            //
            // Clicking an open folder therefore collapses it AND goes to its
            // listing, which sounds contradictory and is not: the panel is what
            // you asked to see, the tree is the map, and the map does not have
            // to stay unfolded for the panel to answer. Nothing is lost either
            // way — the next click puts it back.
            state.toggle(entry.path, !isOpen);
            setPendingRoute(entry.href, state.here);
          }}
        >
          <Name name={entry.name} suffix="/" />
          <span className="harness-index-n">{entry.count}</span>
          <Reading />
        </Link>
      </div>

      {/* Rendered only when open. <details> kept its contents in the DOM and hid
          them, which is the right trade for find-in-page; here the whole tree is
          read on the server anyway and a hidden branch is a hidden branch's
          worth of rows the browser still has to lay out. */}
      {canFold && isOpen && (
        <div id={branchId}>
          <Branch entries={entry.children} state={state} />
        </div>
      )}
    </div>
  );
}

// A row that opens the panel: a file, or a folder with nothing to unfold.
//
// It carries its mark in the column a folder spends on its chevron — the same
// glyph the overview gives that same entry, from markFor() in
// lib/harness-marks.js, so CLAUDE.md is an asterisk in both columns and a spec
// is a page in both. The column was a blank for a while, on the argument that a
// glyph in a 206px margin turns an index into a file explorer; the blank is what
// actually cost something. A file row had nothing at its left edge, so a tree of
// them read as text set against a rule rather than as a list of documents, and
// the panel it opens has carried the same page glyph at its head all along —
// which made the one place you choose a file the one place it was unmarked.
//
// ── One slot, one meaning ──────────────────────────────────────────────────
//
// That slot holds exactly one thing per row, and which thing it is, is itself
// the answer to what the row is: a chevron means folder, a glyph means file.
// Nothing carries both. A second column for the type — the arrangement a desktop
// file tree uses — is right when there is room for it and wrong at 206px: it
// spends fifteen of them on furniture, and it spends them on rows where the
// chevron beside it had already settled the question.
//
// Files only. Every directory goes through Folder, which draws the chevron
// whether or not it has anything under it.
function Row({ entry, state }) {
  const active = state.pathname === entry.href;

  return (
    <Link
      href={entry.href}
      className="harness-index-row"
      data-path={entry.path}
      data-kind="file"
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={() => setPendingRoute(entry.href, state.here)}
    >
      {/* `weight` rather than the set's default stroke. At this size 1.75 on the
          24 grid arrives as 0.875 CSS px, which is under a device pixel on an
          ordinary display and gets painted grey rather than dark — so every mark
          in the column went soft at once and the set read as low resolution. See
          Icon in components/ui/icons.jsx. */}
      <Icon name={markFor(entry)} size={13} className="harness-index-mark" />
      <Name name={entry.name} suffix="" />
      <Reading />
    </Link>
  );
}

// A name on one line, clipped in the middle rather than at the end.
//
// A row that wraps reads as two entries, and a row clipped at the end —
// `guard-harness-…` — is a row you have to open to identify, which is the thing
// this index must not make you do. Clipping between the stem and the last few
// characters keeps the one part that says what kind of file it is: the
// extension, and the slash that marks a folder.
//
// Two elements, because CSS cannot ellipsis the middle of one: the stem takes
// the row and truncates, the tail never shrinks. The full name stays in `title`
// for anyone who wants it, and in the address bar once the row is open.
function Name({ name, suffix }) {
  const cut = name.lastIndexOf('.');
  // A leading dot is the whole name of a dotfile, not an extension.
  const stem = cut > 0 ? name.slice(0, cut) : name;
  const tail = cut > 0 ? name.slice(cut) : '';

  return (
    <span className="harness-index-name" title={`${name}${suffix}`}>
      <span className="harness-index-stem">{stem}</span>
      <span className="harness-index-tail">
        {tail}
        {suffix}
      </span>
    </span>
  );
}

// Every folder on the way down to the open path, so a deep link arrives
// unfolded. `/specs/ux/design.md` opens `ux/`
// and stops — the file itself is not a folder and has nothing to open.
//
// The keys are plain paths now. They used to be prefixed strings like
// `area:specs` and `dir:specs/dashboard`, because the top level was a set of
// invented headings that were not paths at all. With the tree mirroring the
// disk, every node has a real path and that path is its identity.
function ancestorsOf(pathname, route) {
  const keys = new Set();
  const path = String(pathname ?? '');
  const rest = path.startsWith(route) ? path.slice(route.length).replace(/^\//, '') : '';
  if (!rest) return keys;

  const parts = rest.split('/').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i += 1) {
    keys.add(parts.slice(0, i + 1).join('/'));
  }
  return keys;
}

// The tree with everything that does not match removed, and nothing moved.
//
// Two rules, and the second is the one that makes it useful. A FILE is kept when
// its own name matches. A FOLDER is kept when its name matches — and then it
// keeps everything inside it, because naming a folder is how you ask to see what
// is in it — or when something below it survives, in which case it is kept as
// the path to that thing rather than as a hit of its own.
//
// New objects rather than mutated ones: `entries` is the server's tree, held
// across navigations by the layout, and a filter that edited it in place would
// make the query permanent.
// What a row is searched on: its name, and the sentence beside it.
//
// The name alone was the first version, and it answers only the question you
// could already answer — you cannot type `safety` and find the six files that
// discuss it, only the one called that. Every entry already carries the line
// that says what it IS: a skill's own `description:`, a spec's first paragraph,
// or the hand-written gloss on a top-level folder. Searching that turns the
// field from "jump to a filename" into "find the rule I half-remember", which
// is what a reader of a spec folder actually has.
//
// Not the whole file, deliberately. Matching body text would need every document
// read and scanned on every keystroke, and it would match the word `safety` in
// forty places that merely mention it — a filter that returns most of the tree
// has filtered nothing.
const haystack = (entry) =>
  `${entry.name} ${entry.gloss ?? ''} ${entry.description ?? ''}`.toLowerCase();

function filterTree(entries, q) {
  const out = [];
  for (const entry of entries ?? []) {
    const hit = haystack(entry).includes(q);
    if (entry.kind !== 'dir') {
      if (hit) out.push(entry);
      continue;
    }
    const children = hit ? entry.children : filterTree(entry.children, q);
    if (hit || children?.length) out.push({ ...entry, children });
  }
  return out;
}

// Every folder in a tree, so a filtered one can be shown fully unfolded.
function foldersIn(entries, out = []) {
  for (const entry of entries ?? []) {
    if (entry.kind === 'dir' && entry.children?.length) {
      out.push(entry.path);
      foldersIn(entry.children, out);
    }
  }
  return out;
}

// How many rows survived. Folders count: one that matched by name is a hit in
// its own right, and one kept only as a path to a hit is still a row the reader
// is being shown. Counting leaves alone would report fewer rows than are on
// screen, which is the one thing a count beside a list must never do.
function countRows(entries) {
  let n = 0;
  for (const entry of entries ?? []) {
    n += 1;
    if (entry.children?.length) n += countRows(entry.children);
  }
  return n;
}

function safeDecode(pathname) {
  try {
    return decodeURIComponent(String(pathname ?? ''));
  } catch {
    return String(pathname ?? '');
  }
}
