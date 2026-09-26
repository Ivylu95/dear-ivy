import { RailNav } from '@/components/shell/RailNav';
import { getJournal } from '@/lib/content';
import { dateLabel } from '@/lib/dates';

// Years, then the entries under them. A journal is the one view where the whole
// page is a single long scroll with no structure but dates, so the rail is the
// only navigation it has.
//
// Entries are listed in full rather than capped. The list is as long as her
// record is, and a rail that silently stopped at twenty would hide exactly the
// older material this is for; the rail scrolls instead.
export default async function JournalRail() {
  const entries = await getJournal();

  const items = [];
  let year = null;
  for (const entry of entries) {
    if (entry.year && entry.year !== year) {
      year = entry.year;
      items.push({ href: `#year-${year}`, label: year, heading: true });
    }
    items.push({
      href: `#${entry.slug}`,
      label: entry.title ?? dateLabel(entry.date),
      meta: entry.title ? dateLabel(entry.date) : null,
    });
  }

  return <RailNav title="On this page" items={items} />;
}
