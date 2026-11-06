import { Fragment } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { AnchorLink } from './AnchorLink';
import { VIEW_ICON, slugify } from '@/lib/views';

// Pure label helpers, re-exported so this stays the one import for a view's
// presentational pieces. They live in lib/dates.js because a client component
// cannot import anything from this file that reaches lib/content.js, and so `fs`.
export { dateLabel, untilLabel } from '@/lib/dates';

// Shared presentational pieces. They render from data the page already read and
// never fetch anything themselves, so client components import them too (the
// rail, the harness index, the sign-in page): nothing here may reach the disk.

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
//
// `icon` is a glyph's name, or `{ d }` for a path the icon set does not hold
// (the harness tree's marks, which live in dev/ui).
export function PageHead({ title, sub, route, icon: glyph, id, children }) {
  const icon = glyph ?? (route ? VIEW_ICON[route] : null);
  const iconProps = typeof icon === 'string' ? { name: icon } : icon;
  return (
    <header className={`page-head${icon ? ' has-icon' : ''}`} id={id}>
      {icon && <Icon {...iconProps} size={30} className="page-icon" />}
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
//
// `as` sets the heading's level where the outline needs it (a journal entry
// sits under its year's h2), and `mark` is a glyph set before the title, as
// About me marks the files that hold her own words.
export function SectionHead({ title, note, id, anchorHere = true, as: H = 'h2', mark, children }) {
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
      <AnchorLink className="section-anchor" href={`#${anchor}`} aria-label={`Link to ${title}`}>
        #
      </AnchorLink>
      <H>
        {mark}
        {title}
      </H>
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

// A row of tags or filter chips, wrapping, drawn once (DES-001 design 3): a
// timeline line's, a calendar or People row's, the timeline rail's, and the
// Timeline's filters each wrote the box by hand. `className` is for a
// container's placement only (the filters' `tag-filters`); anything else, an
// `id` for a fold to name, passes through.
export function Tags({ className, children, ...rest }) {
  return (
    <div className={className ? `tags ${className}` : 'tags'} {...rest}>
      {children}
    </div>
  );
}

// ── Count ───────────────────────────────────────────────────────────────────
//
// A small number, drawn once (DES-001 design 3). The pill form sits at the end
// of a row — a nav item's count, the settings row's "Sample", a switch's "+12" —
// quiet by default, `tone="accent"` for the one that says notice me. `plain`
// is the bare figure in a margin column: no pill, the dimmest legible ink, and
// tabular figures so a column of them lines up.
//
// `className` is for a container's placement and state hooks only, never for
// the look. `as` sets the element where the markup needs one (a <dd>).
export function Count({ children, tone, plain, as: El = 'span', className, ...rest }) {
  const classes = [plain ? 'count-n' : 'count', !plain && tone, className].filter(Boolean).join(' ');
  return (
    <El className={classes} {...rest}>
      {children}
    </El>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
//
// The one button (DES-001 design 3), in the .btn look in globals.css. The
// error page's actions, the avatar's, the print button, the sign-in, the
// Changes search and the spec map's controls each drew their own; a view now
// passes the label and picks a variant:
//   (none)    the outline control
//   quiet     a second action beside a first, no border until hovered
//   primary   the one thing the screen is for, on the accent
//   icon      a glyph alone (pass `aria-label`), no border until hovered
// With `href` it is a Next <Link> (which adds the admin app's base path);
// otherwise a <button>, type="button" unless `type` says otherwise.
// `className` is for a container's placement only, never for the look.
const BUTTON_VARIANT = { quiet: 'btn-quiet', primary: 'btn-primary', icon: 'btn-icon' };

export function Button({ variant, href, type = 'button', className, children, ...rest }) {
  const classes = ['btn', BUTTON_VARIANT[variant], className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

// A row of Buttons under a page's message (DES-001 design 3): the shell's
// error and not-found pages each wrote the box by hand. The avatar's controls
// keep their own row, which sits tighter and with no gap above.
export function Actions({ children }) {
  return <div className="actions">{children}</div>;
}

// ── Chevron ─────────────────────────────────────────────────────────────────
//
// The mark on anything that opens to show more (DES-001 design 3): the rail's
// folds, the harness tree's twists, a commit row, the workflow's cards. It
// points at the row when shut and turns a quarter down when open, on one
// rule and one timing in globals.css. Each control keeps its own semantics —
// a button's aria-expanded, a <details>' open — and says which way to point:
// `open` from the state the control already holds, or nothing inside a
// <summary>, where the <details>' own [open] turns it.
//
// Two sizes: `small` (10px) for a margin column, where it is punctuation and
// holds a 10px slot; otherwise 14px, on a row or a card. Decorative: the
// control around it already says expanded or not.
// `className` is for a container's placement and hover only, never the turn.
export function Chevron({ open, small, className }) {
  return (
    <Icon
      name="chevron"
      size={small ? 10 : 14}
      className={className ? `chevron ${className}` : 'chevron'}
      data-open={open ? 'true' : undefined}
    />
  );
}

// ── Meter ───────────────────────────────────────────────────────────────────
//
// A share of a whole as a bar (DES-001 design 3): the spec map's clauses
// carried, a branch side's kinds in Changes. Developer surfaces only — the note
// at the foot of this file is why nothing over her record scores anything.
//
// Either `value` (0–1), one fill, read out as a progressbar with `now` of
// `max`; or `segments` [{ key, share, kind, title }], each `share` of the
// track, coloured by its `kind` through the container's --mark (the kinds'
// colours belong to the view), read out as an image whose `label` says the
// parts. `as` sets the element (a <dd> in a list). `className` is for a
// container's placement only.
export function Meter({ value, segments, label, now, max, as: El = 'div', className }) {
  const classes = className ? `meter ${className}` : 'meter';
  if (segments) {
    return (
      <El className={classes} role="img" aria-label={label} style={{ '--segs': segments.length }}>
        {segments.map(({ key, share, kind, title }) => (
          <span key={key} className="meter-seg" data-kind={kind} title={title} style={{ '--share': share }} />
        ))}
      </El>
    );
  }
  return (
    <El
      className={classes}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max ?? 1}
      aria-valuenow={now ?? value}
      aria-label={label}
    >
      <span className="meter-fill" style={{ '--share': value }} />
    </El>
  );
}

// ── FactList ────────────────────────────────────────────────────────────────
//
// A list of labels, each beside its figure, drawn once (DES-001 design 3): the
// rail's stated facts, the specs header's figures and the Changes branches each
// wrote the <dl>, its rows and their <dt>/<dd> pairs out by hand. A description
// list, so a screen reader reads each label and figure as a pair.
//
// `rows` are { label, value } (keyed by `key`, else the label); a row's own
// `figure` replaces its <dd> when the figure is more than text (a Count and a
// Meter, each `as="dd"`). `className`, `id` and `rowClassName` (or a row's own
// `className`) are the view's own, for its look and place: the look stays
// with each view, as it was.
export function FactList({ rows, className, id, rowClassName }) {
  return (
    <dl className={className} id={id}>
      {rows.map((row) => (
        <div key={row.key ?? row.label} className={row.className ?? rowClassName}>
          <dt>{row.label}</dt>
          {row.figure ?? <dd>{row.value}</dd>}
        </div>
      ))}
    </dl>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
//
// A panel of content with an optional heading, drawn once (DES-001 design 3).
// Now, About me and Therapy each wrote the box and its .card-heading out by
// hand. `title` is the heading; `titleAs` its level, because the look is the
// same whether it is an h2 directly under the page (Now) or an h3 under a
// section's own h2. `as` is the box's element (a <section> when it is a jump
// target with an `id`). `className` is for a container's placement only.
export function Card({ title, titleAs: H = 'h2', as: El = 'div', className, children, ...rest }) {
  return (
    <El className={className ? `card ${className}` : 'card'} {...rest}>
      {title && <H className="card-heading">{title}</H>}
      {children}
    </El>
  );
}

// One titled part of a card holding several (a file's sections on About me and
// Therapy). The heading wears the card's heading look, one level down.
export function CardSection({ title, titleAs: H = 'h3', children }) {
  return (
    <section className="card-section">
      {title && <H className="card-heading">{title}</H>}
      {children}
    </section>
  );
}

// ── YearRule ────────────────────────────────────────────────────────────────
//
// Where one year of a dated list ends and the next begins (DES-001 design 3):
// the Journal's and the Timeline's, one look. Its id is `year-YYYY` because the
// right rail and the Journal's year chips link to it. `as` keeps each list's
// outline: the Journal's is an h2 its entries sit under, the Timeline's is not a
// heading at all.
export function YearRule({ year, as: El = 'h2' }) {
  return (
    <El id={`year-${year}`} className="year-rule">
      {year}
    </El>
  );
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

// ── NoMatch ─────────────────────────────────────────────────────────────────
//
// A search or a filter that found nothing (DES-001 design 3). Not Empty: an
// empty file is a thing that has not come up yet, and this is an answer to a
// question just asked, so it is one quiet line in the place the results would
// be, never a box. A blank column reads as something broken. Quote what was
// searched for in a <strong>, so it is clear what found nothing.
//
// `className` is for spacing in its container only, never for its look.
export function NoMatch({ children, className }) {
  return <p className={`no-match${className ? ` ${className}` : ''}`}>{children}</p>;
}

// ── Banner ──────────────────────────────────────────────────────────────────
//
// A notice across the column (DES-001 design 3). Untoned it is a standing note,
// calm: what this page is, where something lives. `tone="warn"` is for
// something wrong, in the warn colours. Every boxed notice is this one,
// including the sign-in error (`role="alert"`, so it is read out when it
// appears); `className` is for spacing in its container only.
export function Banner({ tone, role, className, children }) {
  const classes = ['banner', tone, className].filter(Boolean).join(' ');
  return (
    <div className={classes} role={role}>
      {children}
    </div>
  );
}

// ── Note ────────────────────────────────────────────────────────────────────
//
// The quiet aside under a panel: a line that explains what is above it rather
// than adding to it (DES-001 design 3). Nine views wrote <p className="note">
// by hand, one with its own inline gap. `className` is for a container's
// placement only, never for the look.
export function Note({ className, children }) {
  return <p className={className ? `note ${className}` : 'note'}>{children}</p>;
}

// Rendered markdown from a file under data/. The only writer of those files is
// the agent she talks to, inside a private single-member repository, so it is not
// treated as untrusted input.
//
// Or written text in the same measure (DES-001 design 3): About, the admin
// app's "not running" page and the For you lists set their own words in the
// .prose look and wrote the class by hand. Pass `children` for that, or `html`
// for rendered markdown, never both. `as` sets the element (a <ul> for a list
// set as prose). `className` is for a container's placement only.
export function Prose({ html, children, as: El = 'div', className = '' }) {
  const classes = `prose ${className}`.trim();
  if (children != null) {
    if (html != null) throw new Error('Prose takes `html` or `children`, not both');
    return <El className={classes}>{children}</El>;
  }
  return <El className={classes} dangerouslySetInnerHTML={{ __html: html }} />;
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
// There is no Stat tile, no Sparkline and no streak, and the Meter above is
// never used over her record — it measures specs and branches in the
// developer's views. That is not an omission to be filled in later; it is the
// design.
//
// A number on a surface invites comparison with the same number last week, and
// every number this record could honestly produce is a count of her: entries
// written, sessions held, days since. Rendering those turns a record she is free
// to ignore into a scoreboard she is failing. The measure of this app is her life
// outside it, and nothing here can see that, so nothing here should score it.
//
// NOW-002: test/read.test.mjs sweeps the pages for a rendered length.
//
// The one exception is a count of things ON FILE — how many people have a file,
// how many threads are open — which is navigation, not assessment, and lives in
// the rail where navigation belongs.
