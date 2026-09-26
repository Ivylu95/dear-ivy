// The pronouns the record is written in, derived from one configured word.
//
// ── Why this exists at all ──────────────────────────────────────────────────
//
// This app was written throughout for one woman, and said so in every sentence
// it rendered — "her record", "what she said", "where she is". None of that was
// a fact about the software. The record holds one person, and who that person is
// belongs in data/profile.yaml, which is the only file here that describes them;
// everything else has to be right for whoever opens it.
//
// The default is "they", and that is not a fallback so much as the correct
// answer: for a person whose pronouns nobody has stated, it is the only form
// that cannot be wrong. A name does not say what they are, so nothing here
// infers it from `name` — the file says it or the app does not claim it.
//
// ── Why one word in and three out ───────────────────────────────────────────
//
// profile.yaml stores the subject form alone. Storing subject, object and
// possessive as three keys is three chances for them to disagree, and there is
// no set this app renders where knowing one does not give the other two.
//
// `verb` is the part that is easy to forget: "they" takes a plural verb, so a
// sentence built by joining strings — "what {subject} {verb}" — says "she says"
// and "they say" and never "they says".

const SETS = {
  she: { subject: 'she', object: 'her', possessive: 'her', possessivePronoun: 'hers', reflexive: 'herself', plural: false },
  he: { subject: 'he', object: 'him', possessive: 'his', possessivePronoun: 'his', reflexive: 'himself', plural: false },
  they: { subject: 'they', object: 'them', possessive: 'their', possessivePronoun: 'theirs', reflexive: 'themselves', plural: true },
};

export const DEFAULT_PRONOUNS = 'they';

// The set for a configured word, or the neutral one for anything else —
// including absent, empty, and a value config validation has already rejected.
// A view asking for a pronoun must always get a usable word back: a page that
// renders "undefined record" because a setting is malformed is worse than one
// that says "their".
export function pronouns(configured) {
  const key = String(configured ?? '').trim().toLowerCase().split(/[\s/]+/)[0];
  return SETS[key] ?? SETS[DEFAULT_PRONOUNS];
}

// Subject-verb agreement for a sentence assembled from parts. `is`/`are`,
// `has`/`have`, and the plain -s ending that every other verb takes.
//
// Only what this app actually builds. A general conjugator would be a library,
// and a record that renders six verbs does not need one.
export function agree(set, verb) {
  if (!set.plural) {
    if (verb === 'be') return 'is';
    if (verb === 'have') return 'has';
    return `${verb}s`;
  }
  if (verb === 'be') return 'are';
  if (verb === 'have') return 'have';
  return verb;
}

// Capitalised, for a pronoun that opens a sentence.
export function caps(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
