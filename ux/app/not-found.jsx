import Link from 'next/link';
import { BrandMark } from '@/components/ui/icons';

// The 404 for anything OUTSIDE the dashboard's route group.
//
// Routes inside it have their own, one folder down, and that one keeps the shell
// around it — a sidebar and a rail are the right answer when you are lost
// somewhere you are allowed to be. This is the other case: a path that is not
// part of the app at all, rendered with no shell, because there is nothing here
// to navigate.
//
// Until this file existed the case fell through to Next's built-in page — black
// ground, system sans, "404 | This page could not be found." It is a reasonable
// default and it belongs to a different product. A record that has been careful
// about how it says everything else should not go blunt at the one moment
// someone has already got something wrong.
//
// It says nothing about what is behind the gate. This page is reachable by
// anyone who can reach the origin, signed in or not, so it carries a way back
// and nothing else — the same rule the login page keeps.
//
// No card and no wordmark, deliberately. Both were here and both were wrong: a
// panel with the brand lockup at the top of it is the shape of the SIGN-IN page,
// so a 404 built that way reads as a form with its fields missing. The tab title
// and the favicon already say which app this is. What is left is the only three
// things this page owes anyone — what happened, why, and the way back — set as
// type on the page's own paper.
export const metadata = {
  title: 'Dear — nothing here',
};

export default function NotFound() {
  return (
    <main className="notice">
      {/* `enter` gives the block the same staggered fade every view in the app
          arrives with, so this page does not appear differently from the ones it
          replaces. The mark does one thing of its own — see .notice-mark. */}
      <div className="notice-body enter">
        {/* The mark, in the margin rather than over the type.

            It went at the top of a card once and that was the problem — a
            wordmark above a panel is the sign-in page's lockup, and the 404 kept
            borrowing its shape. Out here it is doing a different job: it fills
            the space the short text leaves, it sits beside the headline rather
            than announcing it, and it is the only drawn thing on a page that is
            otherwise all type. Below 560px it moves above the block, where a
            64px glyph and a 40px headline still have room to breathe. */}
        <BrandMark size={64} className="notice-mark" />
        {/* The words, and why these ones.

            This page is reachable by anyone who can reach the origin, so it can
            say nothing about the record behind the gate — no "your journal", no
            "that entry". What it can do is speak the way the rest of the app
            speaks. The mark is a pen and the wordmark is a salutation, so an
            address with nothing at it is a page never written rather than a
            resource not found.

            The last line is the one that earns its place. This app holds the
            only copy of someone's record, and an unexpected error screen on a
            surface like that reads as something gone wrong with the thing
            itself. app/(dashboard)/error.jsx says so outright for the same
            reason; here it is one short sentence, because a 404 is a smaller
            fright and an over-long reassurance invents a worry of its own. */}
        <p className="notice-code">404</p>
        <h1 className="notice-title">Nothing written here</h1>
        <p className="notice-sub">
          There is no page at this address — an old link, most likely, or a
          letter out of place. Nothing of yours is missing.
        </p>
        <p className="notice-back">
          <Link href="/">
            <span aria-hidden="true">&larr;</span> Back to the start
          </Link>
        </p>
      </div>
    </main>
  );
}
