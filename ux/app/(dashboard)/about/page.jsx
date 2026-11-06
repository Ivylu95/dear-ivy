import Link from 'next/link';
import { Enter, PageHead, Prose, SectionHead, Source, dateLabel } from '@/components/ui';
import { getIndex, getLastSession } from '@/lib/content';

export const dynamic = 'force-dynamic';

// What this is, where it keeps things, and what it will not do.
//
// The three promises below are restated here rather than only living in
// CLAUDE.md, because a promise a person cannot read is not one they have been
// made. They are the same three the record is built on: she never files, nothing
// is ever deleted, and this is not a clinician.
export default async function About() {
  const index = await getIndex();
  const lastSession = await getLastSession();

  return (
    <Enter>
      <PageHead
        route="/about"
        title="About this"
        sub="A private space to think, and to remember."
      />

      <div className="card">
        <div className="prose">
          <p>
            This page and everything behind it is a window onto a folder of plain
            text files. It reads them; it never writes to them. The record has one
            author — the conversation — and this is just a way to look at it.{' '}
            <Link href="/workflow">Workflow</Link> is how that happens, step by
            step.
          </p>
          <h2 id="three-things-it-promises">Three things it promises</h2>
          <p>
            <strong>You never file anything.</strong> There is nothing to tick,
            name, approve or tidy up anywhere in here. If keeping the record
            working ever needs something from you, that is a fault in how it was
            built, not a job for you.
          </p>
          <p>
            <strong>Nothing is ever deleted.</strong> Superseded things move to an
            archive; they do not disappear. A memory that quietly changes is a
            memory you cannot trust, and the point of this is that you can.
          </p>
          <p>
            <strong>It is not a therapist.</strong> It does not diagnose, and it is
            never a substitute for a person. Where it and your care team disagree,
            your care team is right.
          </p>
          <h2 id="what-it-will-not-do">What it will not do</h2>
          <p>
            It will not count how often you write, or how long it has been. There
            are no streaks here and there is no score. The measure of whether this
            is working is your life outside it, which nothing on this screen can
            see — so nothing on this screen tries to grade it.
          </p>
        </div>
      </div>

      {lastSession && (
        <p className="note">Last conversation on file: {dateLabel(lastSession)}.</p>
      )}

      {index && (
        <>
          <SectionHead title="Where things are kept" />
          <div className="card">
            <Prose html={index.html} />
          </div>
          <Source path="data/INDEX.md" />
        </>
      )}
    </Enter>
  );
}
