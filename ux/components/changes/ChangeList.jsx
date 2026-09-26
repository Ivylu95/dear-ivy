import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { SectionHead, Tag } from '@/components/ui';
import { dateLabel } from '@/lib/dates';
import { AREA_LABEL, typeMeta } from '@/lib/git';

// A day of commits, and one commit inside it.
//
// The shape is borrowed from the hooks view rather than invented: a closed row
// that says the one thing you scan for, and a <details> that opens onto the
// reasoning. That matters more here than anywhere else in this app, because the
// commit messages in this repository are long — several paragraphs arguing for
// the change — and a list that showed them all would be a list nobody could
// scan, while a list that showed none of them would throw away the only place
// the argument is written down.
//
// <details> rather than a control of our own, for the same reason the hooks view
// gives: it opens on click, on Enter and on the browser's own find-in-page, it
// is a disclosure to a screen reader without being told to be one, and it works
// with JavaScript off — which this whole app is built to survive.
//
// Server components. They render what the page already read and fetch nothing.

export function ChangeList({ days }) {
  return (
    <div className="changes">
      {days.map((day) => (
        <section className="change-day" key={day.day}>
          {/* The same heading component every other view uses, so a day here
              anchors the way a year does in the journal and the right rail can
              navigate it without this page declaring targets of its own. The id
              is prefixed because a bare date is one a future section could
              plausibly want too. */}
          <SectionHead
            title={dateLabel(day.day)}
            id={`day-${day.day}`}
            note={day.commits.length === 1 ? '1 commit' : `${day.commits.length} commits`}
          />
          {/* A card of its own around the commits, rather than radiusing the
              first and last rows: the spine is drawn on this element, and a
              thread running down a day needs something to run down. */}
          <div className="change-card">
            {day.commits.map((commit) => (
              <Change key={commit.hash} commit={commit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Change({ commit }) {
  const type = typeMeta(commit.type);

  return (
    <details className="change" id={commit.short}>
      <summary className="change-line">
        {/* The clock it was committed at, in the author's own offset — see the
            note in lib/git.js. The date is the section heading above; repeating
            it on every row would be the widest column saying the least. */}
        <span className="change-time">{commit.time}</span>

        {/* A cell of its own, always present, so the summaries beside it share
            one left edge whatever the tag inside is — or whether there is one.
            An unparsed subject gets no tag rather than a made-up one: a commit
            that broke the convention is a fact about the history, and papering
            over it hides the one thing worth noticing about that row. */}
        <span className="change-type">
          {commit.type && <Tag kind={type?.tone ?? undefined}>{commit.type}</Tag>}
        </span>

        {/* Scope and summary in one text flow, not two boxes. As flex items the
            scope broke to a line of its own the moment the summary wrapped,
            which left a lone word hanging over a sentence on every long row. */}
        <span className="change-what">
          {commit.scope && <span className="change-scope">{commit.scope}</span>}
          {commit.summary}
          {commit.breaking && <span className="change-breaking"> !</span>}
        </span>

        {/* Which halves of the repository moved — but ONLY when that is not
            already obvious from the tag beside it.

            This column used to be on every row, and across a hundred commits it
            said almost nothing: 29 of 32 `record` commits touch only data/, 25
            of 25 `docs` commits only .claude/, 11 of 11 `feat` commits only ux/.
            A column you can predict from the column next to it is decoration,
            and it was the widest decoration on the row.

            What is worth seeing on sight is the commit that crossed a boundary —
            a rule changing at the same time as something already written under
            it. That is four rows in forty, and now it is the only time these
            appear, which is what makes them mean something when they do. */}
        {commit.areas.length > 1 && (
          <span className="change-areas">
            {commit.areas.map((area) => (
              <span className="change-area" data-area={area} key={area}>
                {AREA_LABEL[area]}
              </span>
            ))}
          </span>
        )}

        {/* A zero is not news. Dimmed rather than left out, so the column
            still lines up and the eye still lands in the same place. */}
        <span className="change-stat">
          <span className="change-add" data-zero={commit.added === 0 ? 'true' : undefined}>
            +{commit.added}
          </span>
          <span className="change-del" data-zero={commit.removed === 0 ? 'true' : undefined}>
            −{commit.removed}
          </span>
        </span>

        <Icon name="chevron" size={13} className="change-chevron" />
      </summary>

      <div className="change-detail">
        {/* The body as written, paragraph by paragraph, not rendered as
            markdown. A commit message is plain text — it was composed for `git
            log`, where nothing renders — so treating its asterisks and
            backticks as syntax would silently rewrite what was actually
            committed. This page's claim is that it shows the history; the moment
            it improves a message on the way past, it stops being able to say
            that. */}
        {/* Keyed by position. A commit message is immutable and this list is
            never reordered or filtered, so the index IS a stable identity here
            — and the paragraphs themselves are not unique enough to key on. */}
        {commit.body.map((para, i) => (
          <p className="change-body" key={`${commit.short}-${i}`}>
            {para}
          </p>
        ))}

        {!commit.body.length && (
          <p className="change-body dim">No message beyond the summary.</p>
        )}

        {/* The paths, as links wherever this app has a view for them — the
            harness tree for `.claude/`, her own views for `data/`. That is the
            difference between a receipt and navigation: read why a spec changed,
            then open the spec. lib/git.js hrefForPath() decides, reusing the two
            maps that already existed rather than writing a third.

            It links OUT and never renders IN. Nothing of what she wrote appears
            on this page; the row says a file moved and the link goes to the view
            that already exists for reading it. */}
        <ul className="change-files">
          {commit.files.map((file) => (
            <li className="change-file" data-area={file.area} key={file.path}>
              {file.href ? (
                <Link className="change-path" href={file.href} prefetch={false}>
                  {file.path}
                </Link>
              ) : (
                <span className="change-path">{file.path}</span>
              )}
              <span className="change-lines">
                {file.binary ? (
                  <span className="dim">binary</span>
                ) : (
                  <>
                    <span className="change-add" data-zero={file.added === 0 ? 'true' : undefined}>
                      +{file.added}
                    </span>
                    <span
                      className="change-del"
                      data-zero={file.removed === 0 ? 'true' : undefined}
                    >
                      −{file.removed}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        {/* The full hash, last and quiet. It is the one thing on this page that
            is of no use to read and every use to copy: it is what you paste into
            `git show` when the message is not enough, which is the only thing
            this view deliberately cannot do for you. */}
        <p className="change-hash">{commit.hash}</p>
      </div>
    </details>
  );
}
