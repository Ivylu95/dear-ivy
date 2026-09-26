import { RailNav } from '@/components/shell/RailNav';
import { getOpenLoops } from '@/lib/content';
import { slugify } from '@/lib/views';

// One row per group, with how many are still open beside it.
//
// That number is a count of THREADS ON FILE, which is navigation — the same
// exception the note at the foot of components/ui/index.jsx carves out. It is not a
// count of her, and it never becomes one: nothing here counts days, entries or
// how long since.
export default async function LoopsRail() {
  const { groups } = await getOpenLoops();

  // The view renders an empty state instead of the groups when nothing is open,
  // so listing them here would point every row at an anchor that does not exist.
  // The rail is built from the page, not from the file behind it.
  if (!groups.some((g) => g.items.length > 0)) return null;

  const items = groups.map((group) => {
    const open = group.items.filter((i) => !i.done).length;
    return {
      href: `#${slugify(group.heading)}`,
      label: group.heading,
      meta: open > 0 ? String(open) : null,
    };
  });

  return <RailNav title="On this page" items={items} />;
}
