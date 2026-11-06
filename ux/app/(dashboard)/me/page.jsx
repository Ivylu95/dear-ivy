import { AvatarEditor } from '@/components/me/AvatarEditor';
import { Empty, Enter, PageHead, Prose, Source } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { SESSION_COOKIE, sessionUser } from '@/lib/auth';
import { avatarStamp } from '@/lib/avatar';
import { getIdentity, getMe } from '@/lib/content';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// The standing files: who she is, what she wants, what helps, how to talk to her,
// and the patterns she has named.
//
// Two of them carry a quill. Those are the files CLAUDE.md says to read BEFORE
// writing anything — what has actually worked for her, and what lands badly. They
// are not more important than the others; they are the ones where getting it
// wrong costs her something, and a surface that treats all five identically hides
// that.
//
// The note under Patterns is load-bearing. A pattern in this record is only ever
// one she named herself — one assigned to her is another person telling her what
// she is — and the page says so in her favour rather than leaving it implicit.
export default async function Me() {
  const files = await getMe();
  const identity = await getIdentity();
  const account = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <Enter>
      <PageHead
        route="/me"
        title="About me"
        sub="Who you are, what you want, what helps."
      >
        {/* The one control in this app that writes anything, and it is here
            rather than on the rail chip that shows the picture: a file picker one
            mis-click from a nav row is a file picker she opens by accident.
            lib/avatar.js says why DSH-002's exception is drawn this narrowly. */}
        <AvatarEditor name={identity.name ?? account ?? 'You'} stamp={avatarStamp()} />
      </PageHead>

      {/* What the app calls you, and where that comes from.

          Shown, not editable. DSH-001 makes every viewing surface read-only, and
          DSH-002 spends the single exception to it on the avatar — a thing she
          made rather than said. A name is something she said, so it arrives the
          way everything else she says arrives: she mentions it, and it gets
          written down. The row says so plainly rather than offering a field that
          does nothing, which is the version of this that reads as broken.

          The path is shown for the same reason every other panel shows one: this
          is a record, and a record whose provenance you cannot see is just a
          screen telling you things. */}
      <section id="name" className="card view-section">
        <h2 className="card-heading">What I call you</h2>
        <p className="identity-name">{identity.name ?? 'Not recorded yet'}</p>
        <p className="note" style={{ marginTop: 6 }}>
          {identity.name
            ? 'Say the word if you would rather be called something else, and it changes here and in the wordmark. Nothing on this page is edited by hand.'
            : 'Tell me your name in conversation and it gets written down here. Until then the wordmark reads "Dear you".'}
        </p>
        <Source path={`data/${identity.path}`} />
      </section>

      {files.map((file) => (
        <section key={file.slug} id={file.slug} className="view-section">
          <div className="section-head">
            <h2>
              {file.caution && (
                <Icon
                  name="quill"
                  size={16}
                  className="heading-mark"
                />
              )}
              {file.label}
            </h2>
            <span className="section-note">{file.blurb}</span>
          </div>

          {file.filled ? (
            <div className="card">
              {/* Only the sections with something in them. An empty heading and
                  the file's own note about what belongs under it are scaffolding,
                  and showing her the scaffolding is showing her a record that
                  looks fuller than it is. */}
              {file.sections
                .filter((s) => s.filled)
                .map((s) => (
                  <section key={s.heading} className="card-section">
                    <h3 className="card-heading">{s.heading}</h3>
                    <Prose html={s.html} />
                  </section>
                ))}
            </div>
          ) : (
            <Empty title="Nothing written here yet">
              {file.slug === 'patterns'
                ? 'Only patterns you have named yourself go here. None have been, and none will be put here for you.'
                : 'This fills in as things come up in conversation.'}
            </Empty>
          )}
          <Source path={`data/${file.path}`} />
        </section>
      ))}
    </Enter>
  );
}
