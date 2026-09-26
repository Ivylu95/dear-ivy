// The one anchor in a harness document that is not derived from its text.
//
// Every other target in these pages mints its own id from what it says — a
// section from its heading, a register row from its ID column — so the page and
// the rail agree without either knowing about the other. The top of the document
// has no text of its own to slug: it is the header, and the title in it is the
// filename or the document's H1, neither of which is stable enough to key an
// anchor on. A file retitled from `# Architecture [ARC]` to `# Architecture`
// would silently move its own first rail row to a target that no longer exists.
//
// So it is a constant, imported by the page that renders the header and by the
// rail that links to it. Fixed, short, and not a word any heading would slug to.
export const DOC_TOP = 'doc-top';
