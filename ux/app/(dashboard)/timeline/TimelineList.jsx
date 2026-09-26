'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dateLabel } from '@/lib/dates';
import { routeForFile } from '@/lib/views';

// Filtering happens in the browser over rows the server already parsed. The whole
// timeline is one markdown table read in a single pass, so there is nothing to
// gain from a round trip per filter and something real to lose: a record you have
// to wait for is a record you stop scrolling through.
//
// The filters offer the record's own controlled tag list, not a vocabulary
// invented beside it. See getTimeline() in lib/content.js.
export default function TimelineList({ entries, tags, types }) {
  const [tag, setTag] = useState(null);
  const [type, setType] = useState(null);

  const shown = useMemo(
    () =>
      entries.filter(
        (e) => (!tag || e.tags.includes(tag)) && (!type || e.type === type),
      ),
    [entries, tag, type],
  );

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
  const rows = useMemo(
    () =>
      shown.map((entry, i) => ({
        entry,
        showYear: Boolean(entry.year) && entry.year !== shown[i - 1]?.year,
      })),
    [shown],
  );

  return (
    <>
      {(tags.length > 0 || types.length > 0) && (
        <div className="tags tag-filters">
          <FilterChip active={!tag && !type} onClick={() => { setTag(null); setType(null); }}>
            everything
          </FilterChip>
          {types.map((t) => (
            <FilterChip key={`type-${t}`} active={type === t} onClick={() => setType(type === t ? null : t)}>
              {t}
            </FilterChip>
          ))}
          {tags.map((t) => (
            <FilterChip key={`tag-${t}`} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </FilterChip>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="note">Nothing on the timeline matches that.</p>
      ) : (
        <div className="tl">
          {rows.map(({ entry, showYear }) => (
            <div key={`${entry.date}-${entry.what}`}>
              {showYear && (
                <div className="tl-year" id={`year-${entry.year}`}>
                  {entry.year}
                </div>
              )}
              <article className="tl-item">
                <div className="tl-date">
                  {dateLabel(entry.date)}
                  {/* The gap between when something happened and when she said it.
                      Surfaced rather than swallowed: it is the difference between
                      a record of an event and a record of a disclosure. */}
                  {entry.told && ` · told ${dateLabel(entry.told)}`}
                </div>
                <p className="tl-what">{entry.what.replace(/\[inferred\]\s*/i, '')}</p>
                <div className="tags">
                  {entry.type && <span className="tag accent">{entry.type}</span>}
                  {entry.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                  {entry.inferred && (
                    <span className="tag inferred">a reading, not their words</span>
                  )}
                </div>
                {/* The pointer at the end of the line. This is the whole
                    mechanism the timeline runs on — one line here, the detail in
                    the file it names — and the page says so in its own subtitle,
                    so it has to be followable rather than merely parsed. Where
                    this app has no view for the file, the path still shows, as
                    text: a pointer is information even when there is nowhere to
                    send you. */}
                {entry.file &&
                  (routeForFile(entry.file) ? (
                    <Link className="tl-file" href={routeForFile(entry.file)}>
                      {entry.file}
                    </Link>
                  ) : (
                    <span className="tl-file is-plain">{entry.file}</span>
                  ))}
              </article>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tag${active ? ' accent' : ''}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
