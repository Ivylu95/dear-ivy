// The login page is a client component, so it cannot export metadata of its own.
// This layout exists for that one reason and adds no markup.
//
// The title says what the page is, never whose record is behind it — the same
// rule the page itself keeps. A <title> reaches browser history, link previews
// and the window switcher, all of which are seen by people who are not her.
// "Sign in" is true of any locked door and identifies nobody.
//
// It is also the practical half of the fix: with several tabs open, "Dear" on
// its own was indistinguishable from the app, so the tab you had been signed
// out of looked exactly like the one you were still signed in to.
export const metadata = {
  title: 'Dear — sign in',
};

export default function LoginLayout({ children }) {
  return children;
}
