// The two tabs that are a folder rather than a view over the record.
//
// Harness is `.claude/`, what configures the agent. Specs is `specs/`, the
// design that configuration is judged against — kept outside `.claude/` since
// ARC-008 was amended, because it is not configuration and it outlives any one
// tool's folder. They read the same way, so they share one reader
// (lib/harness.js), one index, one set of pages. Everything that differs between
// them is here, and nothing here touches the disk, so the client index can
// import it as well as the server.
//
// `folder` is the repository path the tab mirrors, as a reader would type it:
// it heads the index and starts every breadcrumb.
export const HARNESS_VIEW = {
  route: '/harness',
  folder: '.claude',
  title: 'Harness',
  noun: 'the harness',
  tagline: 'What it reads before it listens.',
  sub: 'What shapes a conversation. None of it is yours.',
};

export const SPECS_VIEW = {
  route: '/specs',
  folder: 'specs',
  title: 'Specs',
  noun: 'the specs',
  tagline: 'What it must be, argued out first.',
  sub: 'What must hold, and why. The agent drafts here; only a person changes it.',
};
