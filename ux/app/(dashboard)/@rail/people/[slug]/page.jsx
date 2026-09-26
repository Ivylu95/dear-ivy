import { RailNav } from '@/components/shell/RailNav';
import { getMentions, getPerson } from '@/lib/content';

// Inside one person's file, the rail is the same contents list every other view
// gets: what is on this page, in the order the page renders it.
//
// It used to be everyone ELSE on file, so that moving from one person to the
// next never went back out through the index. That was navigation between views
// wearing the clothes of navigation within one, and the left rail already does
// the first job — People is one click away from here, and the file's own header
// carries a way back to it.
//
// The timeline row is conditional on the same getMentions() call the view makes,
// so the rail can never offer a jump to a section the page did not render.
export default async function PersonRail({ params }) {
  const { slug } = await params;
  const person = await getPerson(slug);
  if (!person) return null;

  const mentions = await getMentions(person.name);

  const items = [
    { href: '#their-file', label: 'Their file' },
    ...(mentions.length
      ? [{ href: '#on-the-timeline', label: 'On the timeline', meta: String(mentions.length) }]
      : []),
  ];

  return <RailNav title="On this page" items={items} />;
}
