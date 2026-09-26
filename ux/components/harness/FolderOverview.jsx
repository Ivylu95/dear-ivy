import { HarnessList } from '@/components/harness/HarnessList';
import { Banner, Crumbs, Empty, Enter, PageHead } from '@/components/ui';

// The harness: everything in `.claude/`, in one place.
//
// This app has two kinds of page, and the difference is whose the thing is.
// Every other view is a window onto `data/` — her record, personal, hers alone.
// This one is a window onto the folder beside it: the instructions the agent
// reads, the skills that load when a session matches one, the hooks that run
// whether or not it remembers to, the specs that argue for why any of it is
// shaped the way it is.
//
// ── Why it is worth a tab ───────────────────────────────────────────────────
//
// The harness is the part of this system that decides how every conversation
// goes, and until now it could only be read by opening a dozen folders in an
// editor — which meant the answer to "what did I tell it to do?" lived entirely
// in whoever last edited it. CLAUDE.md calls the harness "yours to amend, one
// traceable change at a time", and an amendment you cannot review first is not
// traceable in any sense that helps.
//
// ── What this page is, beside the tree ──────────────────────────────────────
//
// The top of `.claude/`, in the same order the tree shows it, with a sentence
// against each. That sentence is the only thing here the folder cannot supply:
// `prompts` and `commands` are equally opaque as names, and which of them holds
// something that runs unattended is not deducible from either. Where a
// hand-written line exists it is used; where none does, the entry's own first
// paragraph stands in.
//
// It does not group, re-order or rename anything. It used to — eight themed
// headings, two of them invented to hold the loose files at the top — and a
// page about a folder that disagrees with the folder is worse than no page.
//
// ── What it is not ──────────────────────────────────────────────────────────
//
// It is not an editor, and there is nothing here that switches anything on.
// Changing the harness is a deliberate edit to a committed file, by a person,
// with a commit message — the same rule the hooks view already holds to.
//
// It is also never her record. lib/harness.js resolves `.claude/` through its
// own resolver and refuses any path that climbs out of it, so this view cannot
// render a line of `data/` even if a URL asks it to.
//
// The Specs tab is the same page over `specs/`: `view` is the folder's reader
// and `tab` its wording, from lib/folder-views.js.
export function FolderOverview({ view, tab }) {
  const { ok, entries } = view.getTop();

  return (
    <Enter>
      {/* The same header every page under this one has: the path, then the
          name. This is the top of the tree, so the path is one segment and stops
          there — and it is marked `current`, which is what drops the trailing
          slash, because nothing follows it.

          The title carried both for a while, as `Harness — .claude /` in two
          faces. It said the right things and it said them in a shape no other
          page here uses; a reader arriving from `commands` or `specs` had to
          re-read the header to find the same two facts. One shape for all of
          them is worth more than the one line saved. */}
      <Crumbs items={[{ href: tab.route, label: tab.folder, current: true }]} />

      <PageHead route={tab.route} title={tab.title} sub={tab.sub} />

      {!ok && (
        <Banner tone="warn">
          The folder `{tab.folder}/` could not be read. That is worth looking at
          rather than shrugging at: this app is reading a checkout that does not
          have it, and nothing here can be trusted to describe the agent you are
          actually talking to.
        </Banner>
      )}

      {ok && <HarnessList entries={entries} />}

      {ok && !entries.length && (
        <Empty title={`${tab.title} is empty`}>
          There is nothing in `{tab.folder}/` yet. Every rule this agent follows
          is one it was told in the conversation and will forget.
        </Empty>
      )}
    </Enter>
  );
}
