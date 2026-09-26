'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons';
import { VIEW_ICON } from '@/lib/views';
import { Reading } from '@/components/ui/Reading';
import {
  getPendingRoute,
  routeFor,
  serverPendingRoute,
  setPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';

// The queue, beside the entry it opens.
//
// ── Why this view earns a third navigation ──────────────────────────────────
//
// The harness makes the argument and this view is the other case of it: the
// activity is moving through a series of things in one sitting, and neither of
// the app's two rails can hold still while that happens. Clearing a backlog is
// exactly that activity — read one, decide it, read the next — and the version
// without this column was a single page thirty entries long, where deciding the
// eleventh meant finding the eleventh again afterwards.
//
// It lives in a layout, so Next keeps this DOM node across navigations: the list
// does not re-mount, does not lose its scroll position, and does not flash while
// the entry beside it streams in. That persistence is most of what makes a panel
// feel like a panel rather than a new screen.
//
// ── Why the rows are grouped and the harness's are not ──────────────────────
//
// The harness index refuses to group because its whole claim is that it IS the
// folder, and a heading invented for the view is a second structure to learn.
// The same rule gives the opposite answer here. These groups are not invented:
// `.claude/REVIEW.md` is literally two tables under two headings, plus the
// log this app appends to. The column is mirroring the file, the same way the
// tree mirrors the folder.
//
// And the distinction is the one thing a reader needs before deciding anything.
// A deviation says the repository is wrong and the spec is right; a proposal
// says the spec itself may be wrong. Those take different verdicts from
// different people, and a flat list of thirty would hide which kind you are
// looking at until you had read it.
export function ReviewIndex({ groups }) {
  // Where the column should draw itself as being: the entry being navigated TO
  // while a click is in flight, otherwise the one actually open. Every route
  // here reads a file at request time, so there is a real gap between the click
  // and the new panel, and marking from the pathname alone leaves the row you
  // just left lit for the whole of it.
  const here = usePathname();
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const pathname = routeFor(here);

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Matched on the citation and on the opening clause, which between them are
  // the whole of what a row shows. Matching the full finding would return rows
  // whose visible text has nothing to do with what was typed — a hit the reader
  // cannot see is indistinguishable from a filter that is broken.
  const shownGroups = useMemo(() => {
    if (!q) return groups;
    return groups.map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) =>
          row.ids.join(' ').toLowerCase().includes(q) || row.gist.toLowerCase().includes(q),
      ),
    }));
  }, [groups, q]);

  const found = shownGroups.reduce((n, group) => n + group.rows.length, 0);

  // Counted off the unfiltered groups, not the visible ones: this line is the
  // state of the QUEUE, and a filter is something the reader is doing to the
  // view. A number that dropped to two while they typed would be answering a
  // different question from the one it asks.
  const open = groups
    .filter((group) => group.key !== 'decided')
    .reduce((n, group) => n + group.rows.length, 0);
  const cleared = groups.find((group) => group.key === 'decided')?.rows.length ?? 0;

  // The narrow-screen fold. A button and a flag rather than a <details> around
  // the list, because a <details> without `open` hides its contents at EVERY
  // width — the column would be empty on the wide screens this layout is for.
  // With a flag the stylesheet decides.
  const [shown, setShown] = useState(false);

  return (
    <>
      <button
        type="button"
        className="harness-aside-toggle"
        aria-expanded={shown}
        aria-controls="review-index"
        onClick={() => setShown((was) => !was)}
      >
        {shown ? 'Hide the queue' : 'Browse the queue'}
      </button>

      <nav
        className="review-index"
        id="review-index"
        data-shown={shown ? 'true' : 'false'}
        aria-label="The review queue"
      >
        {/* What this column is, above what it contains. The left rail marks the
            tab, but it is a long way from here and collapses to glyphs; a reader
            arriving from a deep link has no other label to read. Same mark and
            same words as the tab, so the two cannot be taken for two places. */}
        <p className="harness-index-mast">
          <Icon name={VIEW_ICON['/review']} size={15} className="harness-index-mast-icon" />
          Review
        </p>
        <p className="harness-index-mast-sub">Raised by the agent, cleared by a person.</p>

        {/* The queue's own state, in one line.

            The per-group counts below say how the work divides; this says how
            much of it there is and how much has been answered, which is the
            question a person opens this tab with. It is the one number in this
            app that is allowed to be a score, and only because of what it counts:
            entries in a harness file, not anything of hers. See the note at the
            foot of components/ui/index.jsx. */}
        <p className="review-status">
          <span className="review-status-open">{open === 1 ? '1 open' : `${open} open`}</span>
          {cleared > 0 && <span className="review-status-done">{cleared} cleared</span>}
        </p>

        <div className="harness-index-search">
          <Icon name="search" size={13} className="harness-index-search-mark" />
          <input
            type="search"
            className="harness-index-search-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Escape clears rather than blurs. A query matching nothing looks
            // identical to an empty queue, so the way out is the key a reader
            // will already try.
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="Filter by spec or wording"
            aria-label="Filter the queue by spec ID or wording"
            aria-describedby={q ? 'review-index-found' : undefined}
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

        {/* The way back to the overview, in the same row vocabulary the harness
            index gives `.claude/` — a link rather than a heading, because it is
            somewhere you can go. */}
        <div className="harness-index-head">
          <Link
            href="/review"
            className="harness-index-top"
            data-active={pathname === '/review' ? 'true' : undefined}
            aria-current={pathname === '/review' ? 'page' : undefined}
            onClick={() => setPendingRoute('/review', here)}
          >
            REVIEW.md
            <Reading />
          </Link>

          {q && (
            <span
              className="harness-index-found"
              id="review-index-found"
              role="status"
              aria-live="polite"
            >
              {found === 1 ? '1 match' : `${found} matches`}
            </span>
          )}
        </div>

        {/* The rows, and the only part of this column that moves.

            A wrapper with nothing to say of its own, and the column does not work
            without it: the aside is a fixed-height box that hides its overflow, so
            rows left as the last children of this <nav> are clipped at the fold
            rather than scrolled to. It is also what keeps the masthead, the filter
            and `REVIEW.md` where they are while a long queue runs beneath
            them — the same arrangement, and the same rule, as the harness tree.
            See .review-index-body in globals.css. */}
        <div className="review-index-body">
          {shownGroups.map((group) => (
            <section className="review-index-group" key={group.key}>
              <h2 className="review-index-label">
                {group.label}
                <span className="review-index-n">{group.rows.length}</span>
              </h2>

              {group.rows.length === 0 ? (
                <p className="review-index-none">{q ? 'no match here' : group.empty}</p>
              ) : (
                <ul className="review-index-rows">
                  {group.rows.map((row) => {
                    const active = pathname === row.href;
                    return (
                      <li key={row.id}>
                        <Link
                          href={row.href}
                          className="review-index-row"
                          data-active={active ? 'true' : undefined}
                          data-verdict={row.verdict || undefined}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setPendingRoute(row.href, here)}
                        >
                          {/* The citation leads, because it is how one of these is
                              looked for: specs/README.md asks that a row be cited
                              by ID, so a column where the IDs line up down one edge
                              can be scanned for ARD-007 without reading the prose
                              beside it. */}
                          {/* Status, as a mark rather than a word.

                              Every row carries one, the undecided included —
                              which is the point. A list where only the settled
                              rows are marked says "these are special"; a list
                              where all of them are says "here is where each one
                              got to", and open is a state rather than an absence
                              of one. The mark is hollow while nothing has been
                              decided and filled once something has, so the
                              column can be read down for what is left without
                              reading a word.

                              The word itself is on the element rather than
                              beside it: at this width a label per row would cost
                              a third of the citation, and a screen reader gets
                              the same fact from the title without it. */}
                          <span
                            className="review-index-status"
                            data-status={row.verdict ?? 'Open'}
                            title={row.verdict ?? 'Open'}
                            aria-hidden="true"
                          />
                          <span className="review-index-ids">{row.ids.join(' · ')}</span>
                          <span className="review-index-gist">{row.gist}</span>
                          <span className="sr-only">{row.verdict ?? 'Open'}</span>
                          <Reading />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </nav>
    </>
  );
}
