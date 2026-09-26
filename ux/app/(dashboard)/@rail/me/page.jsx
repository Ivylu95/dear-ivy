import { RailNav } from '@/components/shell/RailNav';
import { getMe } from '@/lib/content';

// The five standing files, in the order the view lays them out — which is the
// order a reader meets them, not alphabetical. The rail inherits that ordering
// from lib/content.js rather than choosing its own.
export default async function MeRail() {
  const items = (await getMe()).map((file) => ({
    href: `#${file.slug}`,
    label: file.label,
  }));

  return <RailNav title="On this page" items={items} />;
}
