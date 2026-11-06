import { RailNav } from '@/components/shell/RailNav';
import { RailTags } from '@/components/shell/RailTags';
import { getTimeline } from '@/lib/content';

// Beside the timeline the rail is a year index, because the timeline's own
// navigation problem is "take me to 2024" and nothing else. The two notes that
// used to live here — sorted by when it happened, corrections are new lines —
// moved into the view itself, where they are read by someone looking at the
// entries rather than by someone looking away from them. A year carries no count
// of its entries: how many events she has told is not shown (NOW-002).
export default async function TimelineRail() {
  const { eras, entries, tags } = await getTimeline();

  const years = [];
  for (const entry of entries) {
    const year = entry.year ?? String(entry.date ?? '').slice(0, 4);
    if (year && !years.some((y) => y.year === year)) years.push({ year });
  }

  const items = [
    ...(eras ? [{ href: '#eras', label: 'Eras' }] : []),
    ...(entries.length ? [{ href: '#entries', label: 'Entries' }] : []),
    ...years.map((y) => ({ href: `#year-${y.year}`, label: y.year })),
  ];

  return (
    <>
      <RailNav title="On this page" items={items} />
      <RailTags title="Tags in use" tags={tags} />
    </>
  );
}
