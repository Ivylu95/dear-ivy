import Link from 'next/link';
import { Empty, Enter, PageHead, Prose, SectionHead, Source } from '@/components/ui';
import { getMentions, getPerson } from '@/lib/content';

export const dynamic = 'force-dynamic';

// One person's file, plus every timeline line that mentions them.
//
// The timeline half is the point. A person's file holds what she thinks of them;
// the timeline holds what actually happened. Read together they answer the
// question a session needs answered — "what has gone on with this person" — in
// one page instead of two reads and a guess.
//
// The match is on their name appearing in the line -- see getMentions() in
// lib/content.js, which the rail beside this page reads too so it never offers a
// jump to a section this page did not render.
export default async function Person({ params }) {
  const { slug } = await params;
  const person = await getPerson(slug);

  // Rendered in place rather than thrown to notFound().
  //
  // Two reasons, and the second is the real one. Under parallel routes Next
  // renders the not-found boundary but leaves the status at 200, so the 404 was
  // never honest anyway — nothing consumes the status on a private surface with
  // no crawler and no API, but claiming a code it does not send is still a lie in
  // the code. And the generic "that page does not exist" is the wrong answer to
  // the only way this happens: a stale link to someone whose file was renamed.
  // Saying which name was looked for, with the way back, is worth more than a
  // status code nobody reads.
  if (!person) {
    return (
      <Enter>
        <PageHead route="/people" title="Not on file" />
        <Empty title={`No one on file under "${slug}"`}>
          The file may have been renamed, or this link may be older than the
          record it points at.
        </Empty>
        <p className="note">
          <Link href="/people">← everyone on file</Link>
        </p>
      </Enter>
    );
  }

  const mentions = await getMentions(person.name);

  return (
    <Enter>
      <PageHead route="/people" title={person.name} sub={person.relation ?? undefined}>
        <p className="meta-line">
          <Link href="/people">← everyone on file</Link>
        </p>
      </PageHead>

      {/* Anchored, because the rail beside this page is a contents list and this
          is the first thing on it. */}
      <section id="their-file">
        {person.filled ? (
          <div className="card">
            <Prose html={person.html} />
          </div>
        ) : (
          <Empty title="This file has been started, but nothing is in it yet">
            It fills in as they come up in conversation.
          </Empty>
        )}
      </section>
      <Source path={`data/${person.path}`} />

      {mentions.length > 0 && (
        <>
          {/* The app's standard section rule, which also gives the heading
              the id the rail points at. */}
          <SectionHead title="On the timeline" note="Every dated line that mentions them." />
          <div className="tl">
            {mentions.map((entry) => (
              <article key={`${entry.date}-${entry.what}`} className="tl-item">
                <div className="tl-date">{entry.date}</div>
                <p className="tl-what">{entry.what.replace(/\[inferred\]\s*/i, '')}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </Enter>
  );
}
