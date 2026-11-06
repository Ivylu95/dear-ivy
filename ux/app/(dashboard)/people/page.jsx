import { Row } from '@/components/ui/Row';
import { Empty, Enter, PageHead, Tag, Tags } from '@/components/ui';
import { getPeople } from '@/lib/content';

export const dynamic = 'force-dynamic';

// One file per person, one card per file.
//
// The subtitle is the promise this view exists to keep, stated plainly: she never
// has to explain who someone is twice. Listing people is the visible half of
// that; the other half is that a session opens their file before she says
// anything about them.
export default async function People() {
  const people = await getPeople();

  return (
    <Enter>
      <PageHead
        route="/people"
        title="People"
        sub="Everyone on file, so you never explain twice."
      />

      {people.length === 0 ? (
        <Empty title="No one on file yet">
          Anyone who comes up in a conversation gets a file here — who they are to
          you, what is good, what is hard, and where it stands.
        </Empty>
      ) : (
        <div className="grid-2">
          {people.map((person) => (
            <Row key={person.slug} href={`/people/${person.slug}`} title={person.name} details={[person.relation]}>
              {!person.filled && (
                <Tags>
                  {/* The quiet tag, not the ok one. A file with nothing in it
                      yet is not a good outcome or a bad one, and the green it
                      used to wear said it was one of the two. */}
                  <Tag>file started, nothing in it yet</Tag>
                </Tags>
              )}
            </Row>
          ))}
        </div>
      )}
    </Enter>
  );
}
