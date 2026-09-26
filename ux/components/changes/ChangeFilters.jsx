import Link from 'next/link';
import { AREA_KEYS, AREA_LABEL, PAGE, queryHref } from '@/lib/git';

// Narrowing the log: a search box, and the areas as a row of links.
//
// ── Why search is here at all ───────────────────────────────────────────────
//
// Because .claude/skills/commit/SKILL.md tells every session to cite the spec ID
// in the commit body, and the stated reason is that `git log --grep=ARD-012`
// then finds every commit that moved that requirement. A discipline whose whole
// payoff is a search, on a surface with no search, is a discipline that only
// pays off in a terminal. This is the other end of that rule.
//
// It searches the MESSAGE, which is what --grep does, and the label says so.
// Searching paths as well would be a different flag with different semantics,
// and a box that quietly did both would give results no one could predict.
//
// ── Why a form and links rather than a filter component ─────────────────────
//
// Both work with scripts off, which is the standard the rest of this app holds
// to — the theme, the harness tree's fold, every <details> on this page. They
// also put the state in the URL, so a filtered view is a link you can keep, and
// the right rail (which renders as a separate route and cannot be handed
// anything) reads the same query string and stays in step for free.
//
// Server components. They render what the page already read.

export function ChangeFilters({ query }) {
  const { q, area } = query;

  return (
    <div className="change-filters">
      {/* A plain GET form. `area` rides along as a hidden field so searching
          inside an area stays inside it; `n` deliberately does not, because a
          new search is a new list and carrying a reader's expanded page size
          into it would ask git for two hundred rows nobody asked to see. */}
      <form className="change-search" action="/changes" method="get">
        {area && <input type="hidden" name="area" value={area} />}
        <label className="sr-only" htmlFor="change-q">
          Search commit messages
        </label>
        <input
          id="change-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search messages — a word, or a spec ID"
          autoComplete="off"
        />
        {/* `btn` is the base and `btn-quiet` only a modifier on it — used alone
            it has no padding and no box, which is how this rendered as a word
            floating beside the field. */}
        <button type="submit" className="btn">
          Search
        </button>
      </form>

      {/* Everything first, then the five areas in the order lib/git.js declares
          them — her record leading, because it is the one a reader is most
          likely to want alone and the only one given ink anywhere else on this
          page. */}
      <nav className="change-areas-nav" aria-label="Filter by area">
        <Link
          href={queryHref(query, { area: null, limit: PAGE })}
          data-active={area ? undefined : 'true'}
          aria-current={area ? undefined : 'true'}
        >
          Everything
        </Link>
        {AREA_KEYS.map((key) => (
          <Link
            key={key}
            href={queryHref(query, { area: key, limit: PAGE })}
            data-active={area === key ? 'true' : undefined}
            aria-current={area === key ? 'true' : undefined}
            data-area={key}
          >
            {AREA_LABEL[key]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// What the list is currently showing, said in words, when it is not showing
// everything.
//
// This exists because of a trade made in lib/git.js: the area filter is a git
// pathspec, which means --numstat is scoped by it too, so a filtered row's paths
// and counts describe that commit's effect on THAT area rather than the whole
// commit. That is the more useful reading of a filtered list and it is not the
// obvious one, so it is said out loud rather than left for someone to work out
// from numbers that do not add up to what `git show` would print.
export function ChangeScope({ query, shown }) {
  const { q, area } = query;
  if (!q && !area) return null;

  return (
    <p className="change-scope-note">
      Showing {shown === 0 ? 'no commits' : shown === 1 ? '1 commit' : `${shown} commits`}
      {area && (
        <>
          {' '}
          that touched <strong>{AREA_LABEL[area]}</strong>
        </>
      )}
      {q && (
        <>
          {' '}
          whose message matches <strong>{q}</strong>
        </>
      )}
      {area && <span className="dim"> · paths and counts are for that area only</span>}
      {(q || area) && (
        <>
          {' · '}
          <Link href={queryHref({}, { limit: PAGE })}>clear</Link>
        </>
      )}
    </p>
  );
}
