import { RailNav } from '@/components/shell/RailNav';
import { getTimeline } from '@/lib/content';

// Beside the timeline the rail is a year index, because the timeline's own
// navigation problem is "take me to 2024" and nothing else. The two notes that
// used to live here — sorted by when it happened, corrections are new lines —
// moved into the view itself, where they are read by someone looking at the
// entries rather than by someone looking away from them.
export default async function TimelineRail() {
  const { eras, entries, tags } = await getTimeline();

  const years = [];
  for (const entry of entries) {
    const year = entry.year ?? String(entry.date ?? '').slice(0, 4);
    if (year && !years.some((y) => y.year === year)) years.push({ year, count: 1 });
    else if (year) years.find((y) => y.year === year).count += 1;
  }

  const items = [
    ...(eras ? [{ href: '#eras', label: 'Eras' }] : []),
    ...(entries.length ? [{ href: '#entries', label: 'Entries' }] : []),
    ...years.map((y) => ({ href: `#year-${y.year}`, label: y.year, meta: String(y.count) })),
  ];

  return (
    <>
      <RailNav title="On this page" items={items} />
      {tags.length > 0 && (
        <section className="rail-card">
          <h2 className="rail-title">Tags in use</h2>
          <div className="tags">
            {tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
