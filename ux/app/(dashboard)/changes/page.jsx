import Link from 'next/link';
import { ChangeFilters, ChangeScope } from '@/components/changes/ChangeFilters';
import { ChangeList } from '@/components/changes/ChangeList';
import { SaveState } from '@/components/changes/SaveState';
import { Banner, Empty, Enter, PageHead } from '@/components/ui';
import { byDay, getHistory, getSaveState, queryFrom, queryHref } from '@/lib/git';

export const dynamic = 'force-dynamic';

// Every commit to this repository, newest first.
//
// ── Why this is a tab and not a terminal ────────────────────────────────────
//
// The harness tab shows what the agent is told to do RIGHT NOW. It is a
// snapshot, and a snapshot cannot answer the question that actually comes up
// when a rule looks wrong: when did it start saying that, and what else moved
// with it? CLAUDE.md calls the harness "yours to amend, one traceable change at
// a time"; this is where the trace is legible without leaving the app.
//
// It is also the one surface that shows the two halves of this repository
// moving. A row marked Record is the agent writing her down; a row marked
// Harness is a rule changing; a row marked both is a change of rule that
// rewrote something already written, which is the one kind of commit worth
// noticing on sight.
//
// ── Why it is called Changes and not History ────────────────────────────────
//
// Because the rail already has Timeline, and Timeline is HER history — the
// spine of the record, the thing this whole system exists to keep. Two rows
// called history, one of them meaning "what happened to her" and the other
// meaning "what I edited", is a rail that has stopped saying what its rows are.
// This one is about the repository, so it is named after what a repository
// holds.
//
// ── What it is not ──────────────────────────────────────────────────────────
//
// Not an editor, not a git client, and never a diff. lib/git.js asks git for
// messages, paths and line counts and never for content — a diff of `data/` is
// her journal rendered on a page about the machine, which is the one blurring of
// the two halves this app cannot have. The full hash sits at the foot of every
// opened commit, which is the handoff: when the message is not enough, `git
// show` is one paste away.
//
// ── Why it does not show all of it at once ──────────────────────────────────
//
// Because a <details> costs whether or not it is opened. Every commit here
// carries its whole message and every path it touched into the markup, and then
// into the payload React ships beside the markup to hydrate the same tree — so
// the entire history of this repository came to 824 KB and five thousand nodes,
// seven tenths of it behind a triangle nobody had clicked. It cost on the
// server too: --numstat makes git diff every commit it prints.
//
// The alternative was to render the detail only once a row is opened, which
// needs JavaScript on the client to do it — and a list that cannot be read with
// scripts off is a worse trade than a list that shows a page of rows and offers
// the rest. So: a page, and one link that doubles it.
export default async function Changes({ searchParams }) {
  // The whole query, not just the count: queryFrom also reads the search text
  // and the area filter, and getHistory needs all three to build the git call.
  const query = queryFrom(await searchParams);
  const { limit } = query;
  // Two independent reads, so neither queues behind the other: the log is one
  // `git log`, the save state is one `git status`. The branch name comes from
  // the second rather than from a read of its own — status already carries it.
  //
  // Awaited together, and deliberately not streamed. The status is the slowest
  // read here and the one it is tempting to defer, but CHG-003 asks that the
  // unsaved state be visible before any historical row is read: a list that
  // paints first and has its most important line arrive above it afterwards
  // has the order backwards, however briefly. The saving comes from the other
  // direction instead — the log no longer takes its cache key from this status
  // call (see rememberedHistory), so the two genuinely run side by side rather
  // than one after the other.
  const [{ ok, reason, commits, more }, saved] = await Promise.all([
    getHistory(query),
    getSaveState(),
  ]);
  const days = byDay(commits);

  return (
    <Enter>
      <PageHead
        route="/changes"
        title="Changes"
        sub={
          saved?.branch
            ? `This repository, commit by commit, on ${saved.branch}.`
            : 'This repository, commit by commit.'
        }
      />

      {/* Not a warning, and deliberately not drawn as one. There is nothing
          broken about a deployment with no working tree — it is the normal shape
          of a hosted build — so this says where the history IS readable rather
          than reporting a fault. */}
      {!ok && reason === 'no-git' && (
        <Banner>
          There is no <code>.git</code> directory where this app is running, so
          there is no history to read. That is the ordinary state of a hosted
          build, which ships the files rather than the repository; the full log
          is on the checkout this was deployed from.
        </Banner>
      )}

      {!ok && reason === 'unreadable' && (
        <Banner tone="warn">
          There is a repository here but <code>git log</code> could not be run
          against it — git may not be on the path, or the log may be larger than
          this view will read. Nothing else in this app depends on it.
        </Banner>
      )}

      {/* First, because it is the only thing on this page that is about right
          now rather than about the past, and the only question here whose wrong
          answer costs something. */}
      {ok && <SaveState state={saved} />}

      {ok && <ChangeFilters query={query} />}
      {ok && <ChangeScope query={query} shown={commits.length} />}

      {ok && days.length > 0 && <ChangeList days={days} />}

      {/* A filter that matched nothing is not the same as a repository with
          nothing in it, and saying so takes the reader back rather than leaving
          them on a page that looks broken. */}
      {ok && !days.length && (query.q || query.area) && (
        <Empty title="Nothing matches">
          No commit in this repository matches that. The search reads commit
          messages only, so a filename or a person will not find one.
        </Empty>
      )}

      {/* Doubling rather than a next page, because this list is read from the
          top and what a reader wants is more of it below what they are already
          looking at — not the same amount somewhere else, with the rows they
          had just read now gone. It is a plain link, so it works with scripts
          off and the URL says what it is showing. */}
      {ok && more && (
        <p className="change-more">
          {/* scroll={false} because this link ADDS to the list rather than
              replacing it. The rows already on screen stay where they are and
              more appear below, which is what "show more" means; the default
              would throw the reader back to the top of a page they had just
              read a page of rows down. */}
          <Link href={queryHref(query, { limit: limit * 2 })} prefetch={false} scroll={false}>
            Show {limit * 2} commits
          </Link>
          <span className="dim"> · showing the last {limit}</span>
        </p>
      )}

      {ok && !days.length && (
        <Empty title="Nothing committed yet">
          The repository is here and has no commits in it — the first change to
          the harness or to her record will be the first row.
        </Empty>
      )}

    </Enter>
  );
}
