'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RailHead, useRailFold } from '@/components/shell/RailFold';
import { Icon } from '@/components/ui/icons';

// The right rail's contents list: where you are inside the view you are already
// on.
//
// The two rails answer two different questions, and keeping them apart is the
// whole point of having two. The left one moves you BETWEEN views — timeline,
// journal, people — and never changes. This one moves you WITHIN the view you
// are in, and is rebuilt per route from the same data the page rendered, so it
// cannot list a section the page does not have.
//
// `items` is [{ href, label, meta, depth }]. An href starting with '#' is a jump
// inside the page and gets the scroll-spy below; anything else is an ordinary
// link, for the one view — people — whose internal structure is separate routes
// rather than sections.
//
// `search` is extra text a row can be found by without showing it: a register
// row is labelled `ARC-003` and nobody searches for a number they are looking up
// the meaning of, so the row's own statement rides along and the filter below
// reads both.
//
// `depth: 1` indents a row under the one above it. The list stays FLAT even so,
// which is what keeps the spy honest: it reads every '#' item the same way and
// in document order, so a nested row competes for the mark on exactly the terms
// a top-level one does. A tree here would have needed the spy to know about
// levels, and the only thing a level changes is how far in the row sits.
// `name` is the fold's key, and it is a prop because one rail can hold three of
// these: the harness shows a file's contents, what points at it and what it
// points at, all as this component. Sharing one key folded and unfolded the
// three together, which reads as the control belonging to the column rather
// than to the block. It defaults to `contents` so every view with a single
// contents list still shares one answer across the app — someone who folds it
// away on the timeline has not asked for it back on the journal.
export function RailNav({ title, items, name = 'contents' }) {
  if (!items?.length) return null;
  return (
    <section className="rail-card">
      <Spy items={items} title={title} name={name} />
    </section>
  );
}

// How many rows it takes before a list is worth searching rather than reading.
//
// Under this, the eye is faster than the box: a skill with five headings is
// answered by looking at it, and a field above it would be a control that costs
// a row of the column to save nothing. Over it, the list has stopped being
// scannable — ARCHITECTURE.md alone puts sixty rows in this column — and
// scrolling a margin to find a rule is the thing the contents list was supposed
// to replace.
//
// Twelve is roughly where a list stops fitting on screen beside the head and the
// facts above it. It is a judgement, not a measurement, and it is one number in
// one place so it can be moved.
const FILTER_FROM = 12;

function Spy({ items, title, name }) {
  const [active, setActive] = useState(null);
  // Far enough down that the way back is worth offering. A control that does
  // nothing is worse than no control: offered at rest, it teaches the reader
  // that this list contains rows which go nowhere.
  const [away, setAway] = useState(false);
  const frame = useRef(0);
  const scrollerRef = useRef(null);
  // The list is not rendered while folded, so the spy below has nothing to mark
  // — but it keeps running, and that is deliberate: it also drives `away`, which
  // is what enables "Top", and that control stays on the row.
  const folded = useRailFold(name);
  const listId = useId();
  // What the reader is looking for, if anything. Local to the component and not
  // in the URL, unlike the Changes tab's search: that one filters a list the
  // server built and is worth keeping as a link, this one narrows a margin you
  // are standing in and is over the moment you have clicked a row.
  const [query, setQuery] = useState('');
  const navRef = useRef(null);

  // What a click asked for, which outranks the spy until the reader scrolls.
  //
  // The spy answers "what am I reading" from the scroll position, and that is
  // the right answer while someone is scrolling and the wrong one the moment
  // they point at a row. Two ways it was wrong, both at the foot of a document:
  //
  // A target near the end cannot be brought to the top, because the document
  // runs out first — so clicking ARD-015 from ARD-016 moves nothing, and a spy
  // reading the scroll position has no way to know anything was asked for. And
  // at the very bottom the `atBottom` rule below deliberately marks the LAST
  // row, so every row still on screen collapsed onto ARD-016 and a click on any
  // of them lit the wrong one.
  //
  // A click is not a guess about what is being read; it is a statement. So it is
  // recorded and honoured until the reader takes the scroll back by hand.
  const asked = useRef(null);
  // Set by the effect, so a click can mark a row through the same path the spy
  // uses — the state AND the attribute mirrored onto the heading — rather than
  // setting half of it from out here and letting the two drift.
  const apply = useRef(null);

  // A string, not the array. The effect below only ever needs to re-run when the
  // SET of anchors changes, and the array is rebuilt on every render — depending
  // on it would tear down and rebuild the whole thing each time, including on the
  // re-render a click in this very rail causes.
  const keys = items
    .filter((i) => i.href.startsWith('#'))
    .map((i) => i.href.slice(1))
    .join('|');

  // Whether this list points into the page at all. Empty for a block of links
  // to other files, which gets the rows and the fold and none of the machinery
  // that answers "where am I" — there is no "here" for it to be about.
  const anchored = keys.length > 0;

  // A field, on a list long enough to need one — and on one that goes somewhere
  // in this page, for the same reason "Top" is gated: a block of citations is
  // eight paths, read at a glance, and a rail carrying two search boxes eight
  // rows apart is the toolbar this column exists to not be.
  const filterable = anchored && items.length >= FILTER_FROM;
  const needle = filterable ? query.trim().toLowerCase() : '';
  const shown = narrow(items, needle);

  // Which section is currently being read, marked in the list.
  //
  // ── Why offsets and not an IntersectionObserver's verdict ───────────────────
  //
  // This was an observer with a thin band across the middle of the viewport, and
  // a thin band has no answer at either end of a document: at the top nothing has
  // reached it yet, at the bottom the last heading never gets there because the
  // page runs out first. So the rail sat on the wrong row for the whole of the
  // first section and could never reach the last one — clicking the final
  // heading put it in the URL and left the mark three rows up.
  //
  // Reading cached offsets answers the question everywhere on the page, and it is
  // cheaper than it looks: heading positions do not move while scrolling, so they
  // are measured once and the scroll handler only compares numbers.
  useEffect(() => {
    if (!keys) return undefined;

    const sections = keys
      .split('|')
      .map((id) => [id, document.getElementById(id)])
      .filter(([, el]) => el);
    if (!sections.length) return undefined;

    // Whatever actually scrolls. Above the stacking breakpoint that is the reading
    // column, which scrolls inside a shell fixed to the viewport; below it the
    // document scrolls as usual. Asked for rather than assumed, because a spy
    // listening to the window on a page where the window cannot scroll simply
    // never fires — the marker then sits on the first heading forever.
    const scroller = scrollParent(sections[0][1]);
    scrollerRef.current = scroller;
    const isWindow = scroller === window;
    const scrollTop = () => (isWindow ? window.scrollY : scroller.scrollTop);
    const viewport = () => (isWindow ? window.innerHeight : scroller.clientHeight);
    const extent = () =>
      isWindow ? document.documentElement.scrollHeight : scroller.scrollHeight;

    // Offsets from the top of the scroller, measured when the layout changes and
    // never during a scroll. The obvious loop calls getBoundingClientRect() per
    // heading per frame, and each call forces the browser to flush layout — a
    // synchronous reflow per section per painted frame, to answer a question
    // about boxes that did not move.
    let tops = [];
    // Each target's own scroll-margin-top, subtracted from where it sits.
    //
    // That margin is the distance a jump to this thing leaves above it, so
    // top-minus-margin is the scroll position at which it has exactly arrived —
    // and comparing against that is what keeps the mark and the jump from ever
    // disagreeing about where the top is.
    //
    // It was ONE value, read from the first target and applied to all of them,
    // on the assumption that everything a rail links to clears the top edge by
    // the same distance. That stopped being true when the harness panel gained a
    // pinned section band: its headings land flush at the pin line and its table
    // rows have to clear the whole band, so the two targets differ by about
    // sixty pixels. With a single value taken from the heading, clicking a row
    // scrolled correctly and then marked the row ABOVE it — the one that had
    // passed the heading's line — which is the off-by-one this replaces.
    const stickOf = (el) => Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;

    // Whether this view's targets are themselves pinned, and therefore whether
    // anything has to be unstuck to measure them at all.
    //
    // The harness is the view with pinned bands and it is NOT one of them: its
    // ids sit on the .view-section wrapper, which never pins — only the head
    // inside it does. So the whole manoeuvre below was being performed on the one
    // page it could do harm on and no good.
    const targetsArePinned = () =>
      sections.some(([, el]) => getComputedStyle(el).position === 'sticky');

    const measure = () => {
      const y = scrollTop();
      const origin = isWindow ? 0 : scroller.getBoundingClientRect().top;
      // Where the headings LIVE, not where they are currently pinned.
      //
      // Some views stick their section heads to the top of the column while
      // their section is being read, and a pinned element's rect is its pinned
      // position — measured mid-document, a stuck heading would report its
      // offset as "just below the top of the window", i.e. as a section already
      // passed, and the mark would sit one row ahead for the rest of the page.
      // Nothing fires this on a normal scroll; a window resized or a font
      // swapping in partway down a spec does.
      //
      // The attribute unsticks them for the length of this function — globals.css
      // has the one rule — and the reads below flush the style change on their
      // way past, so the frame the reader sees is the one after it is gone.
      //
      // In a `finally`, and that is not defensive tidiness. The rule it turns on
      // is `position: static` on every `.section-head` in the document. If
      // anything between the two lines throws — a detached node after a refresh,
      // a style read on a view being torn down — the attribute is never taken off
      // again, and from that moment no band in the app pins at all. The page does
      // not break, it just quietly goes back to scrolling its headings away, for
      // the life of the tab, with nothing in the DOM to say why. It reads exactly
      // like the sticky positioning having regressed.
      const unstick = targetsArePinned();
      if (unstick) document.body.setAttribute('data-measuring', '');
      try {
        tops = sections.map(([id, el]) => [
          id,
          el.getBoundingClientRect().top - origin + y - stickOf(el),
        ]);
      } finally {
        if (unstick) document.body.removeAttribute('data-measuring');
      }
    };

    let last = null;

    // Marking one row: the state the rail draws from, and the attribute the
    // document reads. One function so a click and the spy cannot mark
    // differently, and so the "nothing changed" early return covers both.
    const mark = (id) => {
      if (id === last) return;
      last = id;
      setActive(id);

      // Mirrored onto the heading itself, so the page can say where you are and
      // not only the rail. Written straight to the DOM rather than lifted into
      // shared state: the rail and the document are different parallel route
      // slots, so there is no common React tree to hold it, and a context in the
      // layout would make every view pay for one view's marker. This effect
      // already knows the answer; one attribute is the whole handoff.
      for (const [sid, el] of sections) {
        if (sid === id) el.setAttribute('data-current', 'true');
        else el.removeAttribute('data-current');
      }
    };
    apply.current = mark;

    const settle = () => {
      // At the foot of the document the rule has to change: the last heading's top
      // can never reach the line, because the page ends before it gets there.
      // Scrolled to the bottom, the line becomes the foot of the window instead,
      // so the last section wins — which is the one an anchor link lands on.
      const y = scrollTop();
      // Live the moment the document has moved at all, not after some distance:
      // the control answers "am I at the top", and a reader who has scrolled two
      // lines is not. The few pixels of slack are for sub-pixel scroll positions
      // and for the rubber-banding a trackpad produces at rest, either of which
      // would otherwise flicker the state at zero.
      //
      // Outside the early return below, which only fires when the SECTION has
      // changed — a reader scrolling within one long section would otherwise
      // never be told they had left the top.
      setAway(y > 4);

      // A click has said what is being read. Nothing measured here can improve
      // on that, and at the foot of a document the measurement actively
      // disagrees with it — so the spy stands down until the pin is released.
      if (asked.current) {
        mark(asked.current);
        return;
      }

      const atBottom = y + viewport() >= extent() - 2;
      // One line for every target now, because the allowance each of them needs
      // has already been taken off its own offset above. The 1 is slack for a
      // sub-pixel scroll position, so a target that has landed exactly on the
      // line counts as reached rather than as one pixel short of it.
      const line = atBottom ? y + viewport() : y + 1;

      let current = tops[0][0];
      for (const [id, top] of tops) if (top <= line) current = id;

      // mark() does nothing on the frames where the answer has not changed,
      // which is almost all of them.
      mark(current);
    };

    // rAF-coalesced, so a fast scroll costs one comparison per painted frame
    // rather than one per scroll event, and the listener is passive so it never
    // blocks the scroll itself.
    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        settle();
      });
    };
    // Coalesced like the scroll handler, and for a sharper reason: a ResizeObserver
    // on the body fires in bursts — a font swapping in, a panel expanding, a window
    // dragged rather than snapped — and measure() reads layout for every heading.
    // Uncoalesced, one drag of a window edge is a few hundred forced reflows.
    const remeasure = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        measure();
        last = null;
        settle();
      });
    };

    // The reader taking the scroll back, which is what ends a pin.
    //
    // Listening for the INPUT rather than for the scroll: the click's own smooth
    // scroll fires scroll events all the way to its destination, so releasing on
    // those would undo the pin in the same breath as setting it. A wheel, a drag
    // on the touchscreen, or a key is unambiguously the reader moving the
    // document themselves, and from that moment the spy is right again.
    const release = () => {
      asked.current = null;
    };
    const input = isWindow ? window : scroller;
    input.addEventListener('wheel', release, { passive: true });
    input.addEventListener('touchmove', release, { passive: true });
    window.addEventListener('keydown', release);

    measure();
    settle();

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    // Anything that changes the page's height moves every offset below it — a font
    // swap, an image arriving, a panel expanding.
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      input.removeEventListener('wheel', release);
      input.removeEventListener('touchmove', release);
      window.removeEventListener('keydown', release);
      window.removeEventListener('resize', remeasure);
      ro.disconnect();
      apply.current = null;
      asked.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      // The attribute is ours and lives outside React's tree, so nothing else
      // will clear it on unmount or on a Strict Mode remount.
      for (const [, el] of sections) el.removeAttribute('data-current');
      // And the same for the measuring flag, for the same reason and with more at
      // stake: left on, it unsticks every band in the app until the tab is
      // reloaded. measure() already takes it off in a `finally`; this covers the
      // one path that cannot — an unmount between the two.
      document.body.removeAttribute('data-measuring');
    };
  }, [keys]);

  // Back to the top of the document, which is not the same as the first item in
  // this list: a spec's lead — what the file is, the rule about editing it —
  // sits above its first heading and no row here can reach it.
  const toTop = () => {
    // The pin from any earlier click is released first.
    //
    // Going back to the top is the reader saying they are done with wherever
    // they were, and a mark left on ARD-015 while the document sits at its own
    // first line is the rail reporting a place nobody is. Without this the
    // control moved the document and left the list insisting otherwise, which
    // reads as the button not having worked.
    asked.current = null;
    const scroller = scrollerRef.current;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const how = { top: 0, behavior: smooth ? 'smooth' : 'auto' };
    if (scroller && scroller !== window) scroller.scrollTo(how);
    else window.scrollTo(how);
  };

  return (
    <>
      {/* The title and the way back share one line, with the control flush to the
          column's right edge. It is the row a reader's eye already rests on, and
          putting the control there costs no vertical space in a list that can run
          to twenty rows.
          
          A button rather than a link to `#`: there is no target at the top of the
          document, and an empty fragment would put one in the address bar and
          leave it there. Disabled rather than hidden at the top of a document,
          so the control keeps its place and the column does not reflow the
          moment a reader starts scrolling — `disabled` also takes it out of the
          tab order and says why to a screen reader, which `hidden` cannot. */}
      {/* The heading folds the list; "Top" keeps the slot beside it, because a
          folded contents list has not stopped the page from being scrollable
          and the way back is the one thing you might still want from a column
          you have just closed. */}
      <RailHead name={name} title={title} bodyId={listId}>
        {/* Only for a list that navigates THIS page.
            
            A block of links to OTHER files borrows this component for its rows
            and its fold, and "Top" means nothing in it — worse, it would put a
            second one in the column, so two identical controls would sit eight
            rows apart and only one of them would be about the document. */}
        {anchored && (
          <button type="button" className="rail-top" onClick={toTop} disabled={!away}>
            <Icon name="chevron" size={11} className="rail-top-mark" />
            Top
          </button>
        )}
      </RailHead>

      {folded ? null : (
      <>
      {/* Under the heading rather than on its line: the row above is a label,
          a fold and a way back already, and a fourth thing on it in a 206px
          column is how a margin becomes a control panel. It scrolls with the
          list rather than pinning under the head, because it is the list's own
          first row, not a second header. */}
      {filterable && (
        <div className="rail-filter">
          {/* The same glyph, gap and rule as the harness index's filter two
              columns to the left — see `.harness-index-search`. One gesture in
              this app should look like one thing wherever it is offered, and a
              reader who has just used that field to find the document should not
              have to work out that this is the same control at a different
              scale.

              type="search" for the browser's own affordances — the escape key,
              the right keyboard on a touch device — with a clear button of our
              own, because the native one is absent on Firefox and unstyleable on
              WebKit. */}
          <Icon name="search" size={12} className="rail-filter-mark" aria-hidden="true" />
          <input
            type="search"
            className="rail-filter-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Escape empties the box rather than leaving the reader to select
              // and delete. `type=search` gives some browsers a clear button and
              // no browser all of them, so the key is the one that is always
              // there.
              if (event.key === 'Escape') {
                setQuery('');
                return;
              }
              // Enter takes the first result, which is what typing three letters
              // into a list of sixty was for. The anchor's own handler does the
              // work, so the jump and the mark go through exactly the path a
              // click does — context rows are skipped, because they are where a
              // match SITS rather than a match.
              if (event.key === 'Enter') {
                event.preventDefault();
                navRef.current?.querySelector('a:not([data-context])')?.click();
              }
            }}
            // Named the way the index's field is named: what it filters, not
            // what it is. The rail is only ever offered this on a list that
            // points into the page being read, so "this page" is exact.
            placeholder="Filter this page"
            aria-label="Filter this page"
            aria-controls={listId}
            spellCheck="false"
            autoComplete="off"
          />
          {/* On a query, not on focus. A control that appears the moment the
              field is touched is one more thing moving in a 206px column; one
              that appears when there is something to clear is a way out. */}
          {query && (
            <button
              type="button"
              className="rail-filter-clear"
              onClick={() => setQuery('')}
              aria-label="Clear the filter"
              title="Clear the filter"
            >
              <Icon name="close" size={11} />
            </button>
          )}
        </div>
      )}

      <nav className="rail-list" id={listId} aria-label="On this page" ref={navRef}>
      {shown.map(({ item, hit, context }) => {
        const isActive = active != null && item.href === `#${active}`;
        return (
          <a
            key={item.href}
            href={item.href}
            data-depth={item.depth || undefined}
            data-active={isActive ? 'true' : undefined}
            // Kept because something under it matched, not because it did. The
            // attribute is what Enter reads to skip past it.
            data-context={context ? 'true' : undefined}
            aria-current={isActive ? 'true' : undefined}
            // Marked from the click rather than from where the scroll ends up.
            // The row the reader pointed at is the answer even when the document
            // cannot move far enough to prove it — see `asked` above.
            onClick={() => {
              const id = item.href.slice(1);
              asked.current = id;
              apply.current?.(id);
            }}
          >
            {item.label}
            {item.meta && <span className="rail-when">{item.meta}</span>}
            {/* Why this row is here, when the reason is not on it.

                A filter that matched inside ARD-012's rationale and then printed
                `ARD-012` has answered a question the reader cannot check: the
                word they typed is nowhere on the row. So the words around the
                match come with it — see excerpt() — for exactly the rows whose
                label does not carry it, and only while the filter is on. */}
            {hit && (
              <span className="rail-hit">
                {hit.lead}
                <mark>{hit.word}</mark>
                {hit.tail}
              </span>
            )}
          </a>
        );
      })}
      {/* An empty list is a blank column, which reads as something broken rather
          than as an answer. One line, and it says which word found nothing.

          Inside the list rather than under it, so it stands where the rows would
          have and takes the block's own air — a sibling would have added the
          empty list's 24px of padding above itself. */}
      {needle && shown.length === 0 && (
        <p className="rail-empty">No section matches “{query.trim()}”.</p>
      )}
      </nav>
      </>
      )}
    </>
  );
}

// The rows a search leaves, with the rows that say where they are.
//
// Matching is a plain case-folded substring over the label and over `search` —
// the row's own statement, where it has one. No fuzzy matching and no word
// splitting: a reader typing `safety` into a list of spec rows is looking for
// the word, and a matcher that also returns `satisfy` because the letters are in
// order is a matcher nobody can predict or trust.
//
// ── Why the ancestors come too ──────────────────────────────────────────────
//
// The list is flat with a depth marker, so a filtered result is `ARD-012`
// indented two steps under nothing — the indentation still says "inside
// something" and the something is gone. Worse, a document with three registers
// gives three rows that look alike and the column no longer says which table any
// of them came from.
//
// So every match drags its heading, and its heading's heading, back in with it.
// They are marked as context rather than as results: they are not what was
// found, they are where it sits, and Enter passes over them.
function narrow(items, needle) {
  if (!needle) return items.map((item) => ({ item }));

  // Index of the last row seen at each depth — the trail of headings above
  // wherever the walk currently is. Truncated on the way in, so leaving a
  // section cannot leave its rows hanging on the trail of the next one.
  const trail = [];
  const keep = new Map();

  items.forEach((item, i) => {
    const depth = item.depth || 0;
    trail.length = depth;
    trail[depth] = i;

    const inLabel = item.label.toLowerCase().includes(needle);
    const inText = !inLabel && String(item.search ?? '').toLowerCase().includes(needle);
    if (!inLabel && !inText) return;

    // An ancestor already kept on its own account keeps that standing: it is
    // always at a lower index, so it was set before this row was reached and the
    // guard leaves its reason alone.
    // `up == null` where a list skips a level — a row at depth 2 under no depth
    // 1 heading. Nothing in the harness builds one, and a gap in the trail is
    // not a reason to render a row that does not exist.
    for (const up of trail.slice(0, depth)) {
      if (up != null && !keep.has(up)) keep.set(up, { item: items[up], context: true });
    }
    keep.set(i, { item, hit: inText ? excerpt(String(item.search), needle) : undefined });
  });

  // By position in the document, not by the order matches were found in —
  // ancestors are inserted when their first descendant hits, which is after
  // earlier sections' rows.
  return [...keep.keys()].sort((a, b) => a - b).map((i) => keep.get(i));
}

// The words either side of a match, so a row can show why it is in the results.
//
// A register row's searchable text is the whole of it bar the ID — statement,
// rationale and recommendation, six hundred characters and more. Printing that
// under a rail row would bury the list it is meant to explain, and printing the
// statement instead would be worse than printing nothing: search `data/`, which
// is in ARC-003's rationale and not in its statement, and the row would offer a
// sentence without the word in it as its reason for being there.
//
// So the window follows the match. More after than before, because the match is
// usually a subject and what comes after it is the predicate — `data/ is hers`
// says something, `everything in` does not.
const HIT_BEFORE = 32;
const HIT_AFTER = 72;

function excerpt(text, needle) {
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return null;

  let from = Math.max(0, at - HIT_BEFORE);
  let to = Math.min(text.length, at + needle.length + HIT_AFTER);
  // Cut at spaces rather than mid-word, but never across the match itself: a
  // window that swallowed its own match would print an ellipsis and no reason.
  if (from > 0) {
    const space = text.indexOf(' ', from);
    if (space > -1 && space < at) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > at + needle.length) to = space;
  }

  // Split at the match rather than returning one string, so the row can mark the
  // word without either side building HTML out of the reader's own typing.
  return {
    lead: (from > 0 ? '…' : '') + text.slice(from, at),
    word: text.slice(at, at + needle.length),
    tail: text.slice(at + needle.length, to) + (to < text.length ? '…' : ''),
  };
}

// The nearest ancestor that scrolls, or the window if none does.
//
// `overflow: auto` alone is not enough to answer with: a column that can scroll
// but has nothing to scroll yet still reports auto, and picking it would mean
// listening to an element whose scrollTop never moves. So the box has to both
// allow scrolling and actually overflow.
function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return window;
}
