import { RailNav } from '@/components/shell/RailNav';
import { getCalendar } from '@/lib/content';
import { slugify } from '@/lib/views';

// The calendar's sections are fixed and few, so the rail lists the ones that
// actually have something under them. A row for "Just gone" on a record with
// nothing just gone is a row that teaches her the rail lies.
export default async function CalendarRail() {
  const { upcoming, passed, hard, good } = await getCalendar();

  const items = [
    ['Coming up', upcoming.length],
    ['Just gone', passed.length],
    ['Every year', hard.length + good.length],
  ]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ href: `#${slugify(label)}`, label, meta: String(count) }));

  return <RailNav title="On this page" items={items} />;
}
