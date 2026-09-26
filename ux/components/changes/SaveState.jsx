// Whether the work is actually saved.
//
// The one thing this view can say that nothing else in the app can, and the
// highest-stakes sentence on the surface. ARD-012: a material write has to
// survive the machine without her doing anything, because the session runs on a
// disposable box that is reclaimed without warning. CLAUDE.md names the failure
// mode exactly — "a silent failure to save is the one failure she can't see."
//
// A page listing forty saved commits was showing only the half of that which was
// never in doubt. This is the other half.
//
// ── Why it is not drawn as an alert until it is one ─────────────────────────
//
// Almost every visit finds nothing wrong, and a status bar that is loud when it
// has nothing to report teaches you to stop reading it — which is the one thing
// it cannot afford, because the day it matters it will look the same as every
// other day. So: at rest this is a line of text with a dot in front of it and no
// box at all, and the warn role — a frame, a tint, coloured ink — is spent on
// the one state that means something is genuinely at risk. The same argument
// components/ui/index.jsx makes about the empty state.
//
// A server component. It renders what the page already read.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function SaveState({ state }) {
  // No repository at all. The page already carries a banner explaining that; a
  // second line saying the same thing more quietly is not a second fact.
  if (!state) return null;

  const { tracking, ahead, dirty, dirtyRecord } = state;

  // In order of what is actually at stake, most first. Her record on an
  // unsaved disk outranks a commit that has not been pushed, which outranks a
  // dashboard file somebody is still editing.
  const unpushed = !tracking || (ahead ?? 0) > 0;
  const atRisk = unpushed || dirtyRecord > 0;

  const said = [];
  if (!tracking) said.push('this branch has no remote');
  else if (ahead > 0) said.push(`${plural(ahead, 'commit is', 'commits are')} not pushed`);
  if (dirty > 0) said.push(`${plural(dirty, 'file', 'files')} changed and not committed`);

  const tone = atRisk ? 'risk' : dirty > 0 ? 'working' : 'clean';

  return (
    <p className="change-state" data-state={tone}>
      <span className="change-state-mark" aria-hidden="true" />
      <span>
        <strong>
          {said.length
            ? `${said.join(', ')}.`.replace(/^./, (c) => c.toUpperCase())
            : 'Everything here is saved.'}
        </strong>{' '}
        <span className="change-state-why">{why({ tracking, ahead, dirty, dirtyRecord })}</span>
      </span>
    </p>
  );
}

// What the state means, rather than a restatement of it. The counts above say
// what is true; this says why it is worth knowing, and it is the half a reader
// cannot work out from a number.
function why({ tracking, ahead, dirty, dirtyRecord }) {
  if (!tracking) {
    return 'Nothing here has been pushed anywhere, so nothing here survives this machine.';
  }
  if (ahead > 0) {
    return dirtyRecord > 0
      ? `Those commits exist only on this machine, and ${plural(dirtyRecord, 'file', 'files')} under data/ are not even in one yet.`
      : 'Those commits exist only on this machine. If it goes, so do they.';
  }
  if (dirtyRecord > 0) {
    return `Of those, ${plural(dirtyRecord, 'file is', 'files are')} under data/ — the record only survives once it is committed and pushed.`;
  }
  if (dirty > 0) {
    // Not a warning. Work in progress on the machine is the normal state of a
    // working tree, and nothing under data/ is waiting on it.
    return 'Work in progress, none of it the record.';
  }
  return 'Nothing written that is not committed, nothing committed that is not pushed.';
}
