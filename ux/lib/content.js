import { cache } from 'react';
import { currentRecord, inRecord } from '@/lib/data-dir';
import * as read from '@/lib/content-read';

// The read layer's front door.
//
// Every view in this app asks for its content here, and this file does exactly
// one thing before handing the question on: it works out WHICH record the
// request is reading — hers, in data/, or the invented one in samples/ — and
// enters that scope.
//
// It is a separate file from lib/content-read.js, which holds the parsing, for a
// reason worth keeping. That file is several hundred lines of synchronous reads
// that call each other freely; deciding the record is asynchronous, because the
// answer is in a cookie. Mixing the two would make every getter in the read
// layer async and put `await` in front of a hundred internal calls, and the one
// that got missed would be a page rendering the wrong record — a bug that looks
// exactly like a working page.
//
// So the split is: this file is the only place that knows about requests, and
// that file is the only place that knows about markdown. Nothing imports
// content-read.js directly except this one. Doing so would read hers regardless
// of the switch, which is safe but wrong.
//
// NOTHING BELOW WRITES, and neither does anything it calls. The dashboard is a
// window, not a second author — see the note at the top of lib/content-read.js
// for the single carve-out, which is deliberately not in either file.

// Resolve the record, then run the synchronous read inside it.
//
// Async on the outside, synchronous on the inside: `fn` never awaits, so the
// whole read happens inside the AsyncLocalStorage scope with no chance of it
// being torn down mid-parse.
//
// Wrapped in react's cache() so a getter runs once per request, however many
// of the layout, the page and the rail ask for it. Home alone asked for the
// people folder five times. Safe because both cache() and the record cookie
// are per request, and no view mutates what it is handed.
function scoped(fn) {
  return cache(async (...args) => {
    const record = await currentRecord();
    return inRecord(record, () => fn(...args));
  });
}

export const getNow = scoped(read.getNow);
export const getSettings = scoped(read.getSettings);
export const getToday = scoped(read.getToday);
export const getIdentity = scoped(read.getIdentity);
export const getPronouns = scoped(read.getPronouns);
export const getTimeline = scoped(read.getTimeline);
export const getCalendar = scoped(read.getCalendar);
export const getPeople = scoped(read.getPeople);
export const getPerson = scoped(read.getPerson);
export const getMentions = scoped(read.getMentions);
export const getJournal = scoped(read.getJournal);
export const getMe = scoped(read.getMe);
export const getTherapy = scoped(read.getTherapy);
export const getOpenLoops = scoped(read.getOpenLoops);
export const getSafetyPlan = scoped(read.getSafetyPlan);
export const getIndex = scoped(read.getIndex);
export const getLastSession = scoped(read.getLastSession);
export const getNavCounts = scoped(read.getNavCounts);
export const getHome = scoped(read.getHome);
