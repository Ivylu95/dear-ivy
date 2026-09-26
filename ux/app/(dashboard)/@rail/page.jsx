import { RailNav } from '@/components/shell/RailNav';
import { getHome } from '@/lib/content';
import { slugify } from '@/lib/views';

// Now is one file rendered section by section, so its rail is that file's
// headings. On a record with nothing in it yet there are none, and the rail
// correctly shows nothing rather than an empty box.
export default async function NowRail() {
  const { now } = await getHome();
  const items = (now?.sections ?? [])
    .filter((s) => s.filled)
    .map((s) => ({ href: `#${slugify(s.heading)}`, label: s.heading }));

  return <RailNav title="On this page" items={items} />;
}
