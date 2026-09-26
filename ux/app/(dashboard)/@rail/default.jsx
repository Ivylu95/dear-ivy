// The rail for any route that supplies none of its own.
//
// Deliberately empty. This slot is for navigation INSIDE the current view, and a
// view with no internal structure has none to offer — filling the gap with
// what's-coming-up and what's-still-open would put two views' contents beside a
// third, which is how a navigation panel turns back into a dashboard.
//
// The one thing that used to live here and must not be lost is the route to the
// safety plan. It is now rendered by app/(dashboard)/layout.jsx, below this slot,
// on every route — so it is present whether or not a rail matches. A rule whose
// absence is unacceptable cannot sit behind a matcher, and this slot is one.
export default function DefaultRail() {
  return null;
}
