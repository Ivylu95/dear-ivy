import { RailNav } from '@/components/shell/RailNav';
import { getIndex } from '@/lib/content';
import { slugify } from '@/lib/views';

export default async function AboutRail() {
  const index = await getIndex();
  const items = [
    { href: '#three-things-it-promises', label: 'Three things it promises' },
    { href: '#what-it-will-not-do', label: 'What it will not do' },
    ...(index ? [{ href: `#${slugify('Where things are kept')}`, label: 'Where things are kept' }] : []),
  ];

  return <RailNav title="On this page" items={items} />;
}
