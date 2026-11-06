// The schema for `data/profile.yaml`: its parser, its rules, its canonical text,
// and the one place any of them is enforced.
//
// It lives in .claude/hooks/ because keeping the profile valid is enforcement,
// and must hold whether or not anyone looks at the dashboard. Everything that
// reads the file goes through here, so none of them can disagree about what a
// valid profile is:
//
//   - hooks/record/check-profile.mjs, straight after any edit to the file, again
//     before a turn ends, and as `--all` from `npm run check` and the build
//   - hooks/session/session-brief.mjs, which tells a new session which
//     questions are still owed
//   - the dashboard (ux/lib/content-read.js), for name, pronouns and timezone
//   - ux/scripts/check-privacy.mjs, for the name it must never find in the harness
//
// ── Why it parses the file itself ──────────────────────────────────────────
//
// Hooks carry no dependencies (ux/node_modules is not installed in every
// session), so they cannot use js-yaml, and a hand-rolled reader in a hook that
// merely approximates the real one is how the two quietly drift. So the file is
// written in a strict subset of YAML that this module parses exactly, and every
// reader uses this parser. check-profile.mjs --all also parses it with js-yaml
// when ux/ has it installed, and fails if the two disagree, which proves the
// subset is still real YAML.
//
// The subset: comments and blank lines anywhere; a section at column 0, a
// question at 2 spaces, a key at 4; a key's value plain, "double-quoted",
// 'single-quoted', or a `|` block indented 6 spaces. No tabs, no flow style, no
// anchors. Anything else is an error naming the line, never a guess.
//
// ── The shape ──────────────────────────────────────────────────────────────
//
// Three sections, in this order. Where a question sits decides when it is asked
// (MEM-014):
//
//   mandatory    before anything else, first session, one per message
//   recommended  in the opening, after mandatory; if she arrives with something
//                on her mind it can wait for a natural pause in that session
//   optional     never asked up front; only when the conversation makes it matter
//
// Every question carries the same keys:
//
//   value          her answer, in her words; empty unless status is answered
//   status         not_asked | asked | answered | declined | removed
//   status_reason  free text: why it is in this status; may be empty
//   revisit_when   declined only, and required then: what would make it worth
//                  asking again
//   last_updated   date and time with an offset (2026-09-25T21:14:00+08:00);
//                  required unless not_asked
//
// None of it can sit in the harness: everything personal lives in data/ and
// nothing personal outside it. The bar for a new question is high: something
// must read it, it must be about THE PERSON rather than the deployment, and it
// needs the owner's word (MEM-014).

// ── The questions ──────────────────────────────────────────────────────────

export const SECTIONS = ['mandatory', 'recommended', 'optional'];

export const STATUSES = ['not_asked', 'asked', 'answered', 'declined', 'removed'];

const STATUS_MEANING = {
  not_asked: 'never raised',
  asked: 'raised, no answer yet',
  answered: 'value holds her answer',
  declined: 'she said no; revisit_when says when to ask again',
  removed: 'answered, then taken out; the old answer is in archive/',
};

// Every key a question may carry, in the order it is written.
const KEYS = ['value', 'status', 'status_reason', 'revisit_when', 'last_updated'];
const REQUIRED_KEYS = ['value', 'status', 'status_reason', 'last_updated'];

// In asking order within each section. `comment` is written above the question
// in the file; `describe` is what the session brief says about it.
export const QUESTIONS = {
  name: {
    section: 'mandatory',
    comment: 'What to call her. Shown in the app.',
    describe: 'What to call the person. Shown in the app.',
    inline: true,
    check(value) {
      if (/[\r\n]/.test(value)) return 'must be a single line';
      // Long enough for a full name, short enough that the rail can render it.
      if (value.length > 40) return `is ${value.length} characters; the rail can show about 40`;
      return null;
    },
  },

  // Stored as the subject form only; lib/pronouns.js derives the rest. Absent,
  // everything says "they", the only answer that cannot be wrong.
  pronouns: {
    section: 'mandatory',
    comment: 'she, he or they. Never guessed from the name.',
    describe: 'The pronouns the record is written in: she, he or they. Never guessed.',
    inline: true,
    check(value) {
      const subject = value.toLowerCase().split(/[\s/]+/)[0];
      if (!['she', 'he', 'they'].includes(subject)) return `is "${value}"; it wants "she", "he" or "they"`;
      return null;
    },
    clean: (value) => value.toLowerCase().split(/[\s/]+/)[0],
  },

  timezone: {
    section: 'mandatory',
    comment: 'An IANA zone, so "today" means hers.',
    describe: 'Where the person is, as an IANA zone, so "today" means their today.',
    inline: true,
    check(value) {
      // The only reliable validator is the one the platform will use.
      try {
        new Intl.DateTimeFormat('en-CA', { timeZone: value });
      } catch {
        return 'is not a time zone name; it wants an IANA one like "Asia/Singapore"';
      }
      return null;
    },
  },

  wants_from_this: {
    section: 'recommended',
    comment: 'Vent, think, advice, a record, or a mix.',
    describe: 'What she wants from this space: to vent, think things through, get advice, keep a record, or a mix.',
  },
  how_to_speak_to_me: {
    section: 'recommended',
    comment: 'Gentle or direct; mostly questions or real advice.',
    describe: 'How she wants to be spoken to: gentle or direct, mostly questions or real advice.',
  },
  professional_involved: {
    section: 'recommended',
    comment: 'Therapist, doctor, anyone professional, or "no one". Whose word comes first.',
    describe: 'Whether a therapist, doctor or anyone professional is involved, so the session knows whom to defer to. "no one" is an answer.',
  },
  bad_night_person: {
    section: 'recommended',
    comment: 'One person she would reach on a bad night.',
    describe: 'One person she would reach on a bad night.',
  },

  work_or_study: {
    section: 'optional',
    comment: 'What she does for work or study, in her words.',
    describe: 'What she does for work or study.',
  },
  lives_with: {
    section: 'optional',
    comment: 'Who she lives with.',
    describe: 'Who she lives with.',
  },
};

// Kept under its old name for callers that only want the keys.
export const FIELDS = QUESTIONS;

const FREE_TEXT_LIMIT = 1000;

// ── Parsing ────────────────────────────────────────────────────────────────

const LINE = /^( *)([A-Za-z_][A-Za-z0-9_]*):(?:[ ]+(.*)|[ ]*)$/;

// Returns { data, errors }. `data` is { section: { question: { key: string } } },
// holding whatever could be read; `errors` names each line that could not be.
export function parseProfile(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const data = {};
  const errors = [];
  let section = null;
  let question = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const at = `line ${i + 1}`;
    if (/^\s*(#.*)?$/.test(line)) continue;
    if (/^\s*\t/.test(line)) {
      errors.push(`${at}: indented with a tab; use spaces`);
      continue;
    }
    const m = line.match(LINE);
    if (!m) {
      errors.push(`${at}: not understood ("${line.trim().slice(0, 40)}"); every line is "key:" or "key: value" at 0, 2 or 4 spaces`);
      continue;
    }
    const indent = m[1].length;
    const key = m[2];
    const rest = stripComment(m[3] ?? '');

    if (indent === 0) {
      if (rest) errors.push(`${at}: "${key}" is a section and takes no value on its line`);
      if (key in data) errors.push(`${at}: section "${key}" appears twice`);
      data[key] = data[key] ?? {};
      section = key;
      question = null;
    } else if (indent === 2) {
      if (!section) {
        errors.push(`${at}: "${key}" is indented but sits under no section`);
        continue;
      }
      if (rest) errors.push(`${at}: "${key}" is a question and takes no value on its line; its keys go beneath it`);
      if (key in data[section]) errors.push(`${at}: question "${key}" appears twice in "${section}"`);
      data[section][key] = data[section][key] ?? {};
      question = key;
    } else if (indent === 4) {
      if (!section || !question) {
        errors.push(`${at}: "${key}" sits under no question`);
        continue;
      }
      const target = data[section][question];
      if (key in target) errors.push(`${at}: "${key}" appears twice in "${question}"`);
      if (/^\|[-+]?$/.test(rest)) {
        const block = [];
        let j = i + 1;
        while (j < lines.length && (/^\s*$/.test(lines[j]) || /^ {6,}/.test(lines[j]))) {
          if (/^\s*\t/.test(lines[j])) errors.push(`line ${j + 1}: indented with a tab; use spaces`);
          block.push(lines[j]);
          j += 1;
        }
        while (block.length && !block[block.length - 1].trim()) block.pop();
        const depth = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length), Infinity);
        target[key] = block.map((l) => l.slice(Number.isFinite(depth) ? depth : 0)).join('\n');
        i = i + block.length;
      } else {
        const scalar = parseScalar(m[3] ?? '');
        if (scalar.error) errors.push(`${at}: "${key}" ${scalar.error}`);
        target[key] = scalar.value;
      }
    } else {
      errors.push(`${at}: indented ${indent} spaces; sections sit at 0, questions at 2, their keys at 4, a | block's text at 6`);
    }
  }
  return { data, errors };
}

// " #" starts a comment outside quotes, as in YAML.
function stripComment(raw) {
  const s = raw.trim();
  if (s.startsWith('"') || s.startsWith("'")) return s;
  return s.replace(/(^|\s)#.*$/, '').trim();
}

function parseScalar(raw) {
  const s = raw.trim();
  if (!s) return { value: '' };
  if (s.startsWith('"')) {
    const end = s.lastIndexOf('"');
    if (end === 0 || stripComment(s.slice(end + 1))) return { value: '', error: 'has an unclosed or trailing-text double quote' };
    try {
      return { value: JSON.parse(s.slice(0, end + 1)) };
    } catch {
      return { value: '', error: 'has a double-quoted value that does not parse' };
    }
  }
  if (s.startsWith("'")) {
    const end = s.lastIndexOf("'");
    if (end === 0 || stripComment(s.slice(end + 1))) return { value: '', error: 'has an unclosed or trailing-text single quote' };
    return { value: s.slice(1, end).replace(/''/g, "'") };
  }
  const plain = stripComment(s);
  if (/: /.test(plain) || plain.endsWith(':')) return { value: plain, error: 'contains ": "; quote it, or write it as a | block' };
  if (/^[&*!|>%@`{[\],?-](\s|$)|^[&*!%@`{[]/.test(plain)) return { value: plain, error: `starts with "${plain[0]}", which YAML reads as syntax; quote it` };
  return { value: plain };
}

// ── Validation ─────────────────────────────────────────────────────────────

const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|([+-])(\d{2}):(\d{2}))$/;

// Null when `raw` is a real date-time with an offset, or a sentence saying why not.
export function checkDateTime(raw, { now = Date.now() } = {}) {
  const m = String(raw).match(DATETIME);
  if (!m) return `is "${raw}"; it wants a date and time with an offset, like 2026-09-25T21:14:00+08:00`;
  const [, y, mo, d, h, mi, sec = '00', , , oh = '00', om = '00'] = m;
  const t = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec));
  if (
    t.getUTCFullYear() !== +y || t.getUTCMonth() !== +mo - 1 || t.getUTCDate() !== +d ||
    t.getUTCHours() !== +h || t.getUTCMinutes() !== +mi || t.getUTCSeconds() !== +sec
  ) {
    return `is "${raw}", which is not a real date and time`;
  }
  if (+oh > 14 || +om > 59) return `is "${raw}"; the offset ${m[7]} is not a real one`;
  // A day of slack for clocks; beyond that, a future time is a typo.
  if (Date.parse(raw) > now + 24 * 60 * 60 * 1000) return `is "${raw}", which is in the future`;
  return null;
}

// Returns { value, questions, errors }.
//
// `value` is flat — { name, pronouns, timezone, ... } — holding each answer or
// null, so the app never branches on the file's shape or on a status: anything
// not answered reads as absent, and the app falls back as it would for a blank.
// `questions` is every question's full entry plus its section. `errors` is what
// the checks report; the app ignores them and renders the degraded value, because
// a page that refuses to load is a worse answer to a typo than one that says
// "Dear you".
export function validateProfile(data, { now } = {}) {
  const errors = [];
  const value = {};
  const questions = {};
  const parsed = data && typeof data === 'object' ? data : {};

  const present = Object.keys(parsed);
  for (const s of present) {
    if (!SECTIONS.includes(s)) {
      errors.push(
        s in QUESTIONS
          ? `"${s}" sits at the top level; it belongs under "${QUESTIONS[s].section}" (is this the old flat profile? it migrates at the next session start)`
          : `"${s}" is not a section. The sections are: ${SECTIONS.join(', ')}.`,
      );
    }
  }
  const order = present.filter((s) => SECTIONS.includes(s));
  if (order.join() !== SECTIONS.filter((s) => order.includes(s)).join()) {
    errors.push(`the sections are out of order; they go ${SECTIONS.join(', then ')}`);
  }
  for (const s of SECTIONS) if (!(s in parsed)) errors.push(`section "${s}" is missing`);

  for (const s of SECTIONS) {
    const section = parsed[s] && typeof parsed[s] === 'object' ? parsed[s] : {};
    for (const q of Object.keys(section)) {
      if (!(q in QUESTIONS)) errors.push(`"${s}.${q}" is not a question. Known: ${Object.keys(QUESTIONS).join(', ')}.`);
      else if (QUESTIONS[q].section !== s) errors.push(`"${s}.${q}" is in the wrong section; it belongs under "${QUESTIONS[q].section}"`);
    }
  }

  for (const [q, spec] of Object.entries(QUESTIONS)) {
    const where = `${spec.section}.${q}`;
    const entry = parsed[spec.section]?.[q];
    value[q] = null;
    if (!entry || typeof entry !== 'object') {
      errors.push(`"${where}" is missing`);
      questions[q] = { section: spec.section, status: 'not_asked', value: '', status_reason: '', revisit_when: '', last_updated: '' };
      continue;
    }
    for (const k of Object.keys(entry)) {
      if (!KEYS.includes(k)) errors.push(`"${where}.${k}" is not a key. Each question has: ${KEYS.join(', ')}.`);
    }
    for (const k of REQUIRED_KEYS) if (!(k in entry)) errors.push(`"${where}" has no "${k}"; every question has ${REQUIRED_KEYS.join(', ')}`);

    const str = (k) => (entry[k] === undefined || entry[k] === null ? '' : entry[k]);
    for (const k of KEYS) {
      if (typeof str(k) !== 'string') errors.push(`"${where}.${k}" must be text`);
    }
    const text = (k) => (typeof str(k) === 'string' ? str(k).trim() : '');
    const status = text('status');
    const answer = text('value');
    const reason = text('status_reason');
    const revisit = text('revisit_when');
    const updated = text('last_updated');
    questions[q] = { section: spec.section, status, value: answer, status_reason: reason, revisit_when: revisit, last_updated: updated };

    if (!STATUSES.includes(status)) {
      errors.push(`"${where}.status" is ${status ? `"${status}"` : 'empty'}; it must be one of: ${STATUSES.join(', ')}`);
      continue;
    }
    if (reason.length > FREE_TEXT_LIMIT) errors.push(`"${where}.status_reason" is over ${FREE_TEXT_LIMIT} characters`);

    if (status === 'answered') {
      if (!answer) errors.push(`"${where}" is answered but its value is empty`);
      else if (answer.length > FREE_TEXT_LIMIT) errors.push(`"${where}.value" is over ${FREE_TEXT_LIMIT} characters; the detail belongs in the files under me/`);
      else {
        const problem = spec.check?.(answer);
        if (problem) errors.push(`"${where}.value" ${problem}`);
        else value[q] = spec.clean ? spec.clean(answer) : answer;
      }
    } else if (answer) {
      errors.push(`"${where}" has a value but its status is ${status}; only answered carries a value${status === 'removed' ? ' (a removed answer moves to archive/)' : ''}`);
    }

    if (status === 'declined' && !revisit) errors.push(`"${where}" is declined but has no revisit_when; say what would make it worth asking again`);
    if (status !== 'declined' && revisit) errors.push(`"${where}" has a revisit_when but is ${status}; only declined carries one`);

    if (status === 'not_asked') {
      if (updated) {
        const problem = checkDateTime(updated, { now });
        if (problem) errors.push(`"${where}.last_updated" ${problem}`);
      }
    } else if (!updated) {
      errors.push(`"${where}" is ${status} but last_updated is empty`);
    } else {
      const problem = checkDateTime(updated, { now });
      if (problem) errors.push(`"${where}.last_updated" ${problem}`);
    }
  }

  return { value, questions, errors };
}

// Parse and validate in one call: what every reader of the file wants.
export function readProfile(text, options) {
  const parsed = parseProfile(text);
  const checked = validateProfile(parsed.data, options);
  return { ...checked, data: parsed.data, errors: [...parsed.errors, ...checked.errors] };
}

// The old name, for the dashboard's callers: takes parsed data, returns { value, errors }.
export function validateRecordConfig(data) {
  const { value, errors } = validateProfile(data);
  return { value, errors };
}

// ── What a session owes ────────────────────────────────────────────────────

// Questions still to ask up front, in asking order: mandatory then recommended,
// each not_asked, asked or removed. Optional and declined ones are never owed.
export function owedQuestions(questions) {
  return Object.keys(QUESTIONS)
    .filter((q) => QUESTIONS[q].section !== 'optional')
    .filter((q) => ['not_asked', 'asked', 'removed'].includes(questions[q]?.status))
    .map((q) => ({ key: q, ...questions[q] }));
}

export function declinedQuestions(questions) {
  return Object.keys(QUESTIONS)
    .filter((q) => questions[q]?.status === 'declined')
    .map((q) => ({ key: q, ...questions[q] }));
}

// ── Writing ────────────────────────────────────────────────────────────────

// The header every profile opens with. It is the file's own manual: a session
// that opens the file reads the rules before it edits.
export const HEADER = `# Profile: who this is for, and what must be known before a conversation goes
# further. Checked after every edit and by \`npm run check\`; the rules are
# enforced in .claude/hooks/lib/profile-schema.mjs, which writes this header.
#
# ── SECTIONS ─────────────────────────────────────────────────────────────────
#   mandatory    Asked first, before anything else. The app needs them.
#   recommended  Asked in the opening, after mandatory, each with its reason
#                and her permission. Can wait for a pause if she arrives with
#                something on her mind.
#   optional     Never asked up front. Only when the conversation makes it
#                matter.
#
# ── EVERY QUESTION HAS ───────────────────────────────────────────────────────
#   value          Her answer, in her words. Empty unless status is answered.
#   status         Required. One of:
${STATUSES.map((s) => `#                    ${s.padEnd(10)} ${STATUS_MEANING[s]}`).join('\n')}
#   status_reason  Free text: why it is in this status. May be empty.
#   revisit_when   Only when declined, and required then: what would make it
#                  worth asking again.
#   last_updated   Required unless not_asked. Date and time with an offset:
#                  2026-09-25T21:14:00+08:00
#
# ── HOW TO WRITE IT ──────────────────────────────────────────────────────────
#   Sections at column 0, questions at 2 spaces, keys at 4. No tabs.
#   A value with a colon, a quote or more than one line goes in a | block,
#   its text indented 6 spaces beneath. Nothing is deleted: a removed answer
#   moves to archive/ first.
`;

// The whole file, from { question: { value, status, ... } }. Any question not
// given is written not_asked.
export function renderProfile(questions = {}) {
  const out = [HEADER];
  for (const s of SECTIONS) {
    out.push(`${s}:`);
    for (const [q, spec] of Object.entries(QUESTIONS)) {
      if (spec.section !== s) continue;
      const e = { status: 'not_asked', value: '', status_reason: '', revisit_when: '', last_updated: '', ...questions[q] };
      out.push('', `  # ${spec.comment}`, `  ${q}:`);
      out.push(spec.inline ? `    value: ${inline(e.value)}`.trimEnd() : block('value', e.value));
      out.push(`    status: ${e.status}`);
      out.push(`    status_reason: ${inline(e.status_reason)}`.trimEnd());
      if (e.status === 'declined' || e.revisit_when) out.push(`    revisit_when: ${inline(e.revisit_when)}`.trimEnd());
      out.push(`    last_updated: ${e.last_updated ?? ''}`.trimEnd());
    }
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

function inline(text) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  return parseScalar(s).error || /[\n"'#]/.test(s) || s !== s.trim() ? JSON.stringify(s) : s;
}

function block(key, text) {
  const s = String(text ?? '').trim();
  if (!s) return `    ${key}: |`;
  return `    ${key}: |\n${s.split('\n').map((l) => (l.trim() ? `      ${l}` : '')).join('\n')}`;
}

// ── The old flat shape ─────────────────────────────────────────────────────
//
// Until 2026-09-26 the profile was seven flat keys, each blank, answered, or
// holding a "declined …" / "asked <date> …" / "removed <date>" marker. A profile
// still in that shape is migrated once, at session start, with the old file
// kept in archive/.

export function isLegacyProfile(text) {
  const t = String(text ?? '');
  return /^(name|pronouns|timezone|wants_from_this):/m.test(t) && !/^mandatory:/m.test(t);
}

// The old file as { key: string }, read the way the old session brief read it.
function parseLegacy(text) {
  const out = {};
  let blockKey = null;
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (blockKey && (/^\s/.test(line) || !line.trim())) {
      out[blockKey] += `${line.trim()}\n`;
      continue;
    }
    blockKey = null;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const v = m[2].replace(/\s+#.*$/, '').trim();
    if (/^[|>][-+]?$/.test(v)) {
      blockKey = m[1];
      out[blockKey] = '';
    } else {
      out[m[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}

// `savedAt` is a Date to stamp on everything already answered: the old file kept
// no times, so the caller passes the last time the file was saved. It is written
// in her own zone when the old file names one.
export function migrateLegacyProfile(text, savedAt = new Date()) {
  const old = parseLegacy(text);
  const when = zonedDateTime(savedAt, old.timezone || 'UTC');
  const questions = {};
  for (const q of Object.keys(QUESTIONS)) {
    const v = old[q] ?? '';
    let m;
    if (!v) questions[q] = { status: 'not_asked' };
    else if ((m = v.match(/^declined\b[\s(]*(\d{4}-\d{2}-\d{2})?\)?[,:\s-]*(.*)$/is))) {
      questions[q] = {
        status: 'declined',
        status_reason: 'rather not say (carried over from the old profile)',
        revisit_when: m[2].trim() || 'when the conversation makes it matter',
        last_updated: m[1] ? `${m[1]}T00:00:00${offsetOf(when)}` : when,
      };
    } else if ((m = v.match(/^asked (\d{4}-\d{2}-\d{2})\b[,\s]*(.*)$/is))) {
      questions[q] = { status: 'asked', status_reason: m[2].trim() || 'no answer yet', last_updated: `${m[1]}T00:00:00${offsetOf(when)}` };
    } else if ((m = v.match(/^removed (\d{4}-\d{2}-\d{2})\b[,\s]*(.*)$/is))) {
      questions[q] = { status: 'removed', status_reason: m[2].trim(), last_updated: `${m[1]}T00:00:00${offsetOf(when)}` };
    } else {
      questions[q] = { status: 'answered', value: v, last_updated: when };
    }
  }
  return renderProfile(questions);
}

function offsetOf(datetime) {
  const m = String(datetime).match(/(Z|[+-]\d{2}:\d{2})$/);
  return m ? m[1] : 'Z';
}

// A date-time in a zone, with its offset: 2026-09-25T21:14:00+08:00. Falls back
// to UTC for a zone Intl does not know.
export function zonedDateTime(date = new Date(), timeZone = 'UTC') {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
  } catch {
    zone = 'UTC';
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', '');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}
