import { Card, Prose, SectionHead, Source } from '@/components/ui';
import { titledDate } from '@/lib/dates';

// One dated document shown whole: a journal entry, a therapy appointment. Its
// title (or, without one, its date) as a section heading with the date beside
// it, the text in a card, and the file it came from (DES-001 design 3).
//
// The id goes on the wrapper, which the rail links to; the heading carries no
// id of its own (SectionHead's anchorHere). `as` is the heading level.
export function DatedDoc({ doc, className, as }) {
  const { title, note } = titledDate(doc);
  return (
    <article id={doc.slug} className={className}>
      <SectionHead
        title={title}
        note={note}
        id={doc.slug}
        anchorHere={false}
        as={as}
      />
      <Card>
        <Prose html={doc.html} />
      </Card>
      <Source path={`data/${doc.path}`} />
    </article>
  );
}
