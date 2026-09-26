import { headers } from 'next/headers';
import { serif } from './fonts';
import './globals.css';
import { Icon } from '@/components/ui/icons';
import { currentRecord } from '@/lib/data-dir';
import { HARNESS_WIDTH_INIT_SCRIPT } from '@/lib/harness-width';
import { SIDEBAR_INIT_SCRIPT } from '@/lib/sidebar';
import { RAIL_WIDTH_INIT_SCRIPT } from '@/lib/rail-width';
import { REVIEW_WIDTH_INIT_SCRIPT } from '@/lib/review-width';
import { SIDEBAR_WIDTH_INIT_SCRIPT } from '@/lib/sidebar-width';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { DEFAULT_HUE, hexOf, neutralScale } from '@/theme/palette.mjs';

export const metadata = {
  // The product, not the person. A <title> reaches browser history, link
  // previews and anything that crawls it, and the file already refuses to let
  // the nature of the record travel that far — her name had no business
  // travelling either. In the app the wordmark reads "Dear <her name>"; out
  // here it is just the half that belongs to the software.
  title: 'Dear',
  // No description of what the record contains, here or anywhere in <head>.
  // Metadata is the one part of a page that leaks into link previews, browser
  // history and anything that crawls it, and the fact that this is a therapy
  // record is not a fact that needs to travel with the tab.
  description: 'A private space to think out loud.',
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: 'Dear', statusBarStyle: 'black-translucent' },
  other: {
    // Next emits only the standardised name from the field above. iOS Safari
    // still reads the apple-prefixed one, and without it the standalone launch is
    // ignored.
    'apple-mobile-web-app-capable': 'yes',
  },
};

// The two grounds, resolved to hex at build time from the same scale and the
// same conversion the contrast gate uses. Hex rather than the oklch() the
// stylesheet carries, because this tag is read by browser chrome that may be
// older than the page it is painting behind.
const DEFAULT_SURFACES = {
  light: hexOf(neutralScale[50], DEFAULT_HUE),
  dark: hexOf(neutralScale[950], DEFAULT_HUE),
};

// Read from the palette rather than written here. These paint the browser's own
// chrome on mobile, so a literal that drifted from --bg would show as a seam
// above the page that nothing in the app could detect.
//
// The server can only serve the DEFAULT hue's grounds: the hue she chose lives
// in her browser's storage, and this head is rendered before any of it is
// readable. lib/theme.js syncThemeColor() rewrites both tags from the resolved
// --bg on mount, so a non-default theme is correct from the first interactive
// frame; these two are what the browser paints in the frame before that.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Extends the canvas under the notch and the home indicator, which is what
  // makes env(safe-area-inset-*) resolve to real pixels. Without it iOS reports
  // them as zero in standalone mode, and the mobile header computes its offsets
  // from them.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: DEFAULT_SURFACES.light },
    { media: '(prefers-color-scheme: dark)', color: DEFAULT_SURFACES.dark },
  ],
  // Pinch-zoom is deliberately NOT disabled. This is a long-form reading surface
  // and taking magnification away from someone reading it is a WCAG 1.4.4
  // failure with a real cost and no benefit worth having here.
};

// The root layout carries only the document, the stylesheet and the six
// bootstrap scripts. The shell lives in the (dashboard) route group so the login
// page, which renders before a session exists, is not wrapped in navigation the
// visitor is not yet allowed to use.
export default async function RootLayout({ children }) {
  // Which record is up is a cookie, so the document itself is now request-bound.
  // It is read HERE rather than in the dashboard layout so the flag also covers
  // the login screen and anything else outside the shell — a fabricated record
  // that is not marked as one, anywhere, is the worst thing this app could do.
  const { isSample } = await currentRecord();

  // Minted per request by the gate in ux/proxy.js and forwarded here, so the six
  // scripts below can run under a Content-Security-Policy that otherwise refuses
  // inline script. Next stamps the same value onto the tags IT injects, which it
  // learns from the policy the gate sets on the request — so the nonce has one
  // source and there is no second place for the two to disagree.
  //
  // Undefined is the correct fallback rather than a thrown error: a request that
  // somehow arrives without passing the gate should render, and the browser
  // refusing an unnonced script is a visible failure in the console rather than
  // a silent one. React omits the attribute entirely for undefined.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${serif.variable}${
        isSample ? ' is-sample' : ''
      }`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint: adds .dark when the resolved mode is dark,
            --hue when a colour is stored and data-character when a reading style
            is, so there is no flash of the wrong surface. suppressHydrationWarning
            above covers all three, none of which the server could have known. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Same trick for the rail: restore the collapsed state before paint so it
            does not flash open to full width and snap shut on hydration. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
        {/* And for the harness index's width, which is the reader's to drag. An
            effect would restore it after first paint, so a column dragged wide
            would render narrow and jump. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: HARNESS_WIDTH_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SIDEBAR_WIDTH_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: RAIL_WIDTH_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: REVIEW_WIDTH_INIT_SCRIPT }} />
      </head>
      <body>
        {/* The one thing that must be true of a fabricated record: that nobody
            can mistake it for hers. Fixed to the top of the viewport, on every
            page including the login screen, and it reserves its own height so it
            covers nothing — see --sample-bar in globals.css.

            Rendered from a marker file inside the record itself, so it cannot be
            switched off by an environment variable or forgotten by a route. */}
        {isSample && (
          <p className="sample-flag" role="status">
            {/* "data", not "record". Her record is a specific thing in this app
                and the word is hers; borrowing it for the fiction makes the one
                sentence that must be unambiguous read as though she has two
                records. Bold, because at 30px of small type across a wide
                window the first two words are all that is reliably read. */}
            <strong>Sample data</strong> — nothing on this screen is real, and
            none of it is yours.
          </p>
        )}
        {children}
        {/* Shown purely by a media query in globals.css. Here in the root layout so
            the login page is covered too. */}
        <div className="rotate-lock">
          <Icon name="phone" size={38} className="rotate-lock-mark" />
          <p className="rotate-lock-title">Turn your phone upright</p>
          <p className="rotate-lock-sub">This is laid out for portrait.</p>
        </div>
      </body>
    </html>
  );
}
