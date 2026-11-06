// The read layer over the record — the inner half of it.
//
// Import lib/content.js, not this file. That one decides WHICH record a request
// is reading and enters its scope; this one does the reading and asks
// activeDir() where to read from. Calling in here directly skips the switch and
// always reads hers, which is safe but is never what a view meant.
//
// Everything here reads markdown off disk at request time. There is no database
// and no build step that bakes a copy in, so a line written into timeline.md
// during a session is on the next page load. That is the whole point: the record
// and the thing that displays it are never two different versions of the truth.
//
// NOTHING IN THIS FILE WRITES. The dashboard is a window, not a second author.
// Her record has exactly one writer — the agent she talks to — and a read surface
// that could edit it would be a second, unattributed one.
//
// There is exactly one exception in the whole app, and it is deliberately not
// here: lib/avatar.js, which saves the picture she chooses for herself. It is
// its own module for that reason — so the carve-out is one small file that can
// be read in full, rather than a write hiding among two hundred lines of reads.
// It is the one exception DSH-002 admits — "The single exception to DSH-001 is
// a thing she made rather than said" — and nothing else in this app may write.
//
// Split by subject into lib/read/ (design audit, 2026-10-08): this file was
// 898 lines covering every part of the record. It stays the one import, and
// the path the specs name, re-exporting each getter from its own file.

export { getIdentity, getPronouns, getSettings, getToday } from '@/lib/read/profile';
export { getTimeline } from '@/lib/read/timeline';
export { getCalendar } from '@/lib/read/calendar';
export { getMentions, getPeople, getPerson } from '@/lib/read/people';
export { getJournal } from '@/lib/read/journal';
export { getMe, getTherapy } from '@/lib/read/me';
export { getOpenLoops } from '@/lib/read/loops';
export { getSafetyPlan } from '@/lib/read/safety';
// CON-001: the rail's counts (getNavCounts) are of things on file only, never
// her sessions, entries or streaks; test/read.test.mjs holds that.
export { getHome, getIndex, getLastSession, getNavCounts } from '@/lib/read/home';
