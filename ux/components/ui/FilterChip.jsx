import Link from 'next/link';

// One chip in a row of filters: the Timeline's types and tags, the Changes
// view's areas. A list too long for a switch, so a row of chips, drawn once here
// (DES-001 design 3) in the .tag look, lit with `kind` when chosen.
//
// A link, so the filter lives in the URL. Not prefetched: a chip row is a dozen
// links, and each is a full server render. scroll={false} keeps the reader
// where they were.
export function FilterChip({ active, href, kind = 'accent', children, ...rest }) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      className={`tag${active ? ` ${kind}` : ''}`}
      aria-current={active ? 'true' : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
