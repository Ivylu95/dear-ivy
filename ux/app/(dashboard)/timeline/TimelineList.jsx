import { NoMatch, Tags, YearRule } from '@/components/ui';
import { FilterChip } from '@/components/ui/FilterChip';
import { TimelineEntry } from '@/components/ui/TimelineEntry';

// Rendered on the server, and filtered there. It was a client component that
// filtered in the browser, which sent the whole timeline twice: once as the
// HTML and again as data for the filter to work over. The filter is now the URL
// — /timeline?type=…&tag=… — as the Changes view does it, so each chip is a
// plain link, works with scripts off, and the address says what is showing.
//
// The filters offer the record's own controlled tag list, not a vocabulary
// invented beside it. See getTimeline() in lib/content.js.

/**
 * The filter this request asks for, read from the URL. Anything that is not one
 * of the record's own tags or types reads as no filter, so a stale or mistyped
 * link shows everything rather than nothing.
 */
export function filterFrom(searchParams, { tags, types }) {
  const tag = searchParams?.tag;
  const type = searchParams?.type;
  return {
    tag: typeof tag === 'string' && tags.includes(tag) ? tag : null,
    type: typeof type === 'string' && types.includes(type) ? type : null,
  };
}

function filterHref({ tag, type }) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (tag) params.set('tag', tag);
  const query = params.toString();
  return query ? `/timeline?${query}` : '/timeline';
}

export default function TimelineList({ entries, tags, types, tag, type, p }) {
  const shown = entries.filter((e) => (!tag || e.tags.includes(tag)) && (!type || e.type === type));

  // A year rule between entries, so a long timeline stays navigable without a
  // table of contents.
  //
  // The flag is computed in one pass here rather than tracked with a variable
  // during render, and the list stays FLAT rather than being grouped into nested
  // arrays per year. Flat is what the spine's continuous rule is drawn down: one
  // .tl with one absolutely positioned line, instead of one per year with visible
  // seams between them.
  // Written against the previous element rather than a running variable, so the
  // pass is pure: the React compiler rejects a closure variable reassigned during
  // render, and it is right to — a value that survives between iterations is a
  // value that can survive between renders.
  const rows = shown.map((entry, i) => ({
    entry,
    showYear: Boolean(entry.year) && entry.year !== shown[i - 1]?.year,
  }));

  return (
    <>
      {(tags.length > 0 || types.length > 0) && (
        <Tags className="tag-filters">
          <FilterChip active={!tag && !type} href={filterHref({})}>
            everything
          </FilterChip>
          {types.map((t) => (
            <FilterChip key={`type-${t}`} active={type === t} href={filterHref({ tag, type: type === t ? null : t })}>
              {t}
            </FilterChip>
          ))}
          {tags.map((t) => (
            <FilterChip key={`tag-${t}`} active={tag === t} href={filterHref({ type, tag: tag === t ? null : t })}>
              {t}
            </FilterChip>
          ))}
        </Tags>
      )}

      {rows.length === 0 ? (
        <NoMatch>Nothing on the timeline matches that.</NoMatch>
      ) : (
        <div className="tl">
          {rows.map(({ entry, showYear }) => (
            <div key={`${entry.date}-${entry.what}`}>
              {showYear && <YearRule year={entry.year} as="div" />}
              <TimelineEntry entry={entry} p={p} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
