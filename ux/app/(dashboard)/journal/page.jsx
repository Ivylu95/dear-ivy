import { Empty, Enter, PageHead, Prose, Source, dateLabel } from '@/components/ui';
import { getJournal } from '@/lib/content';

export const dynamic = 'force-dynamic';

// Dated entries, newest first, rendered in full rather than as a list of links.
//
// A list of dates with titles would be a filing cabinet. These are short, they
// are hers, and the thing she is likely to want is to read back through them, so
// they are set as continuous prose with a date above each — closer to a diary
// than to an inbox.
//
// ── Why there is a year index and no pagination ─────────────────────────────
//
// Rendering everything means that after a year of most-days writing this page is
// a few hundred entries long. Pagination is the obvious answer and it is the
// wrong one here: "page 4 of 11" is a filing structure, and reading back through
// a run of days is exactly the thing that made continuous prose right in the
// first place.
//
// So the page stays whole and gains a spine down the side: the years, as jump
// links, sticky at the top. Scrolling still works, Ctrl+F still finds everything,
// and getting from here to two Aprils ago is one click rather than a scroll bar
// guess.
//
// No count anywhere on this page, and no "last entry N days ago". A journal that
// reports its own frequency is asking her to keep a streak.
export default async function Journal() {
  const entries = await getJournal();

  // Computed in one pass, and in render order, so the year heading appears
  // exactly where the first entry of that year does.
  const years = [...new Set(entries.map((e) => e.year).filter(Boolean))];

  return (
    <Enter>
      <PageHead
        route="/journal"
        title="Journal"
        sub="Days written down, good ones as carefully as bad."
      />

      {entries.length === 0 ? (
        <Empty title="No entries yet">
          Anything that does not belong anywhere else gets written here: a bad day,
          a good one, a thought that will not leave.
        </Empty>
      ) : (
        <>
          {/* Only once there is more than one year of them. A single chip saying
              the only year on file is furniture. */}
          {years.length > 1 && (
            <nav className="year-jump" aria-label="Jump to a year">
              {years.map((year) => (
                <a key={year} href={`#year-${year}`}>
                  {year}
                </a>
              ))}
            </nav>
          )}

          {entries.map((entry, i) => {
            const startsYear = entry.year && entry.year !== entries[i - 1]?.year;
            return (
              <article key={entry.slug} id={entry.slug} className="journal-entry">
                {startsYear && (
                  <h2 id={`year-${entry.year}`} className="year-rule">
                    {entry.year}
                  </h2>
                )}
                <div className="section-head">
                  <h3>{entry.title ?? dateLabel(entry.date)}</h3>
                  {entry.title && <span className="section-note">{dateLabel(entry.date)}</span>}
                </div>
                <div className="card">
                  <Prose html={entry.html} />
                </div>
                <Source path={`data/${entry.path}`} />
              </article>
            );
          })}
        </>
      )}
    </Enter>
  );
}
