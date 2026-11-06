import { Fragment } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { VIEW_ICON, slugify } from '@/lib/views';

// Pure label helpers, re-exported so this stays the one import for a view's
// presentational pieces. They live in lib/dates.js because a client component
// cannot import anything from this file that reaches lib/content.js, and so `fs`.
export { dateLabel, untilLabel } from '@/lib/dates';

// Shared presentational pieces. Server components: they render from data the page
// already read, and never fetch anything themselves.

// The view's header. `route` keys the glyph from lib/views.js, which switches the
// header to a two-column grid: the glyph in the first, the title and subtitle in
// the second, sharing one left edge.
// `icon` overrides the glyph the route would give.
//
// Every view over her record is one page about one thing, so the tab's own mark
// is the right mark for it and `route` alone was enough. The harness is a folder
// tree behind a single route: every page under it would wear the same braces,
// and the one thing a reader wants from the header of a file tree is whether
// they are looking at a folder or a file.
// `id` makes the header itself a jump target, for a view whose contents list
// wants a row for the top of the document. Nothing needed one until the harness
// rail started with the document's own name.
export function PageHead({ title, sub, route, icon: glyph, id, children }) {
  const icon = glyph ?? (route ? VIEW_ICON[route] : null);
  return (
    <header className={`page-head${icon ? ' has-icon' : ''}`} id={id}>
      {icon && <Icon name={icon} size={30} className="page-icon" />}
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
      {children}
    </header>
  );
}

// A section heading with an optional quiet note beside it. Used instead of a bare
// h2 wherever the heading needs to say where the thing under it came from.
//
// The id is derived from the title rather than passed in. Almost every view
// builds its structure out of these, so anchoring here is what makes the right
// rail able to navigate any of them without each page having to remember to
// declare targets — and a heading that is reworded carries its anchor with it
// instead of leaving a rail row pointing at nothing. Pass `id` to override, for
// the two places that already had one of their own.
// `anchorHere` puts the id somewhere other than on this element while keeping
// the `#` link pointing at it.
//
// It exists for one real case: a view that pins this heading to the top of the
// column while its section is read. A `position: sticky` box is an unreliable
// fragment target, because the browser works out where to scroll from where the
// element currently IS — and a sticky element is wherever the scroll has left
// it, not where it lives. A link to one can land short, land nowhere, or do
// nothing at all depending on which section you happen to be in. So the view
// puts the id on the section WRAPPER, which does not move, and passes false
// here. The heading still sits at the top of that wrapper, so the landing is
// the same place; it is just computed from a box that holds still.
export function SectionHead({ title, note, id, anchorHere = true, children }) {
  const anchor = id ?? slugify(title);
  return (
    <div className="section-head" id={anchorHere ? anchor : undefined}>
      {/* The way to link to one rule rather than to the document holding it.
          It leads the row, and holds its width whether shown or not, so every
          section heading keeps the same left edge and nothing shifts on hover.
          Quiet until the heading is hovered or the link is tabbed to, because a
          column of hash marks reads as punctuation nobody asked for — but always
          present in the markup, so it is reachable by keyboard and by anyone who
          knows to look. */}
      <a className="section-anchor" href={`#${anchor}`} aria-label={`Link to ${title}`}>
        #
      </a>
      <h2>{title}</h2>
      {note && <span className="section-note">{note}</span>}
      {children}
    </div>
  );
}

// The way back up, for the one part of this app that is deeper than one level.
//
// Nothing in her record needs this: every view there is a single page, and the
// left rail is the whole navigation. The harness is a folder tree, and a folder
// tree read three levels down without a trail is a page you can only leave by
// pressing Back.
//
// It sits above the page head rather than inside it, because it is not part of
// what this page is — it is where this page is.
//
// The separator is an element of its own rather than a pseudo-element on the
// link, for two reasons. One row of flex children means the gap between them is
// the ONLY thing setting the spacing, so every slash sits in the same air — a
// margin hung off one side of a pseudo-element cannot say that. And it keeps the
// slash outside the link: not clickable, not underlined on hover, and not part
// of the name a screen reader says.
//
// Every crumb carries one, the last included, because the trail runs into the
// title underneath it — `.claude / specs /` then **specs /**. That final slash
// is what says the title is a thing inside the folder before it, which is the
// whole reason this row is here.
//
// Unless the trail ends on the page itself. A document titles itself —
// ARCHITECTURE.md opens "Architecture [ARC]" — and that name cannot complete a
// path, so the filename has to sit in the trail instead and the trail has to
// stop there. An item marked `current` is that last segment: no link, no slash.
export function Crumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item) => (
        <Fragment key={item.href}>
          {/* The last crumb can BE this page. It is not a link — a link to where
              you already are is a click that does nothing — and it takes no
              slash after it, because nothing follows it into the title: the
              title is the document's own name, not the next path segment. */}
          {item.current ? (
            <span className="crumb-current" aria-current="page">
              {item.label}
            </span>
          ) : (
            <>
              <Link href={item.href}>{item.label}</Link>
              <span className="crumb-sep" aria-hidden="true">
                /
              </span>
            </>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function Tag({ children, kind }) {
  return <span className={`tag${kind ? ` ${kind}` : ''}`}>{children}</span>;
}

// ── Empty ───────────────────────────────────────────────────────────────────
//
// The single most-used component in this app on day one, and the one most worth
// getting right.
//
// An empty file in this record is not a gap, a to-do, or a failure. It is a thing
// that has not come up yet. So it is not drawn as a notice at all — a dashed
// outline of a space not yet filled, a leaf rather than a triangle, and no
// status colour anywhere in it — and it says what WOULD live here rather than
// what is missing — "who she is, when she says" rather than "no data".
//
// It also never addresses her with an instruction. "Add a journal entry" turns a
// record into a chore list, and a chore list is the one thing this must not
// become. She writes nothing here; she talks, and the record follows.
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <Icon name="leaf" size={18} className="empty-mark" />
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

export function Banner({ tone, children }) {
  return <div className={`banner${tone ? ` ${tone}` : ''}`}>{children}</div>;
}

// Rendered markdown from a file under data/. The only writer of those files is
// the agent she talks to, inside a private single-member repository, so it is not
// treated as untrusted input.
export function Prose({ html, className = '' }) {
  return <div className={`prose ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
}

// There is no Verbatim component here any more.
//
// One was written — a serif blockquote for the words CLAUDE.md asks be quoted
// exactly rather than improved — and nothing ever called it, because her record
// has no structured place for a quote. Her exact words are written inline, in
// whatever file they land in, which is what the rule actually asks for.
//
// It is recorded here rather than silently dropped so the next person to want it
// knows it existed. The styling is still in globals.css under .verbatim; wire a
// component back up if the record ever grows a field for it.

// Where a panel's content came from. Small, dim, and always present on rendered
// markdown: this is a record, and a record whose provenance you cannot see is
// just a screen telling you things.
export function Source({ path }) {
  return <p className="source">{path}</p>;
}

// Wraps a route's content so it settles in on mount. One class, one keyframe, and
// it collapses to nothing under prefers-reduced-motion.
//
// `className` names the view for the two rules in globals.css that have to reach
// a whole page rather than a piece of one — the width of the reading column, and
// the measure inside it. Those live on ancestors of this element, so they are
// written as `.main-inner:has(.plan-view)`, which is the same mechanism the
// harness and changes views already use. The alternative was to key a page's
// width off some class that happens to appear only on that page, and a layout
// rule hanging off an unrelated component is a rule nobody finds when the
// component moves.
export function Enter({ children, className }) {
  return <div className={className ? `enter ${className}` : 'enter'}>{children}</div>;
}

// ── A note on what is NOT in this file ──────────────────────────────────────
//
// There is no Stat tile, no Sparkline, no progress meter and no streak. That is
// not an omission to be filled in later; it is the design.
//
// A number on a surface invites comparison with the same number last week, and
// every number this record could honestly produce is a count of her: entries
// written, sessions held, days since. Rendering those turns a record she is free
// to ignore into a scoreboard she is failing. The measure of this app is her life
// outside it, and nothing here can see that, so nothing here should score it.
//
// The one exception is a count of things ON FILE — how many people have a file,
// how many threads are open — which is navigation, not assessment, and lives in
// the rail where navigation belongs.
