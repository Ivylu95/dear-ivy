import localFont from 'next/font/local';

// One family, loaded from app/fonts/ rather than a font CDN: no network at
// build or at runtime, nothing to break offline, and no layout shift, because
// next/font generates a metric-matched fallback for it.
//
// It exposes a variable the palette's font tokens point at, so type has exactly
// one home — theme/palette.mjs — the same way colour does.
//
// There were three. Public Sans was the body face, with the serif over it on
// anything that called itself a heading — and the line between the two was drawn
// by whoever wrote each rule, so it moved: the left rail ended up with a serif
// label over a sans list, and nothing in the stylesheet said why. IBM Plex Mono
// then carried everything quoted exactly: paths, hashes, dates, counts.
//
// Both are gone, on the owner's explicit instruction, and the second one costs
// something real: a file path in a sentence and a block of source in the harness
// viewer no longer have a face of their own, only a tinted ground. That is a
// departure from DES-005, which the agent may not amend, so it is recorded in
// .claude/REVIEW.md for a person to clear.
//
// The serif does all of the work here. Her record is prose — entries, quotes,
// what she said — and a reading face rather than an interface face is what makes
// a page of it feel like a letter instead of a ticket queue. It carries the
// chrome as well now: one family, one voice, whatever you are looking at.
//
// It lives in its own module, not in layout.jsx, because the layout is not the
// only thing that needs it: global-error.jsx replaces the layout — shell, theme
// and stylesheet with it — and would otherwise be the one screen in the app
// falling back to a system face at the exact moment the app is explaining
// itself. A second localFont() call there would have loaded a second copy of
// the same file under a second generated family name; one export cannot.
//
// And it lives in this folder rather than beside it as `app/fonts.js`, which is
// where it started. A module and a directory of the same name are ambiguous to
// a reader — `import { serif } from './fonts'` resolves to the file by Node's
// resolution order, which is a rule you have to know rather than something the
// line says. Here the import unambiguously means this folder, and the face and
// the code that loads it are one object on disk. The file is NOT in a
// `public/` or `assets/` tree, and must not be moved to one: next/font reads it
// at build time to hash it, write the @font-face and generate the metric-matched
// fallback that keeps the page from shifting. It is a build input, not a served
// asset, and a served copy would have to give all three of those up.
export const serif = localFont({
  src: './Newsreader-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  variable: '--f-serif-var',
  display: 'swap',
});
