import Link from 'next/link';

// One row of a list: a title, a quiet note at its right, a line of details
// under it, and anything else beneath (tags). Drawn once here (DES-001 design
// 3) for the Calendar, Now and People, which had seven hand-written copies.
//
//   href     the row is a link to it
//   meta     the note at the right of the title: how far off, when every year
//   details  the line under the title, empty parts left out
//   past     a date already gone, drawn as passed rather than removed (CAL-003)
export function Row({ title, meta, details = [], href, past = false, children }) {
  const Box = href ? Link : 'div';
  const parts = details.filter(Boolean);
  return (
    <Box href={href} className={`row${past ? ' is-past' : ''}`}>
      <div className="row-head">
        <span className="row-title">{title}</span>
        {meta && <span className="row-meta">{meta}</span>}
      </div>
      {parts.length > 0 && (
        <MetaLine>
          {parts.map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </MetaLine>
      )}
      {children}
    </Box>
  );
}

// The quiet line of details, under a row's title or a page's (DES-001 design
// 3): a person's page put its way back in one by hand. Each child is one part,
// set apart by the separator .meta-line draws. `as` sets the element (a <p>
// under a page head).
export function MetaLine({ as: El = 'div', children }) {
  return <El className="meta-line">{children}</El>;
}
