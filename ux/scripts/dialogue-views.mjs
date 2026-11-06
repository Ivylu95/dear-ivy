// What the dialogue shows: the status line, gate holds, triage, growth, lessons,
// levels, milestones, the rendered Agreements and `ask`. Moved whole out of
// dialogue.mjs (HYG-002), which still runs every command and re-exports it.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { walkFiles } from '../lib/walk-skip.mjs';
import { latest, readCards, readHistory, regressions, runnable } from './evals.mjs';
import { execFileSync } from 'node:child_process';
import { DIALOGUE_DIR, FOR_YOU, REPO, SPECS, TRACE, UNSORTED, cardEntries, standingCards } from './dialogue.mjs';


/**
 * The owner's words a spec row's rationale quotes that no card carries (T-173):
 * his skill decisions of 13 to 15 October sat in PMM rationales, and no card
 * held them, so `ask` could not find them. A quote counts as carried when every
 * part of it (split at an ellipsis) is in the words of a Transcript entry that
 * holds a card.
 */
const OWNER_QUOTE = /\b(?:developer|owner)(?:'s)?\b(?:[ ,][a-z']+){0,8}?[,:]? \*"([^"]+)"\*/gi;
const flat = (s) => String(s ?? '').toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
export function quoteGaps(rows, entries) {
  // A card carries a quote when its remark holds it, or when its Why quotes it and the words are
  // truly a remark's (2026-11-05: A-175's Why quotes T-813, a remark holding no card). A Why is
  // agent-written, so its quote counts only where some remark's own words hold it too.
  const carded = entries.filter((e) => e.cards?.length);
  const carried = flat(carded.map((e) => e.words ?? e.quote).join(' \n '));
  const whys = flat(carded.flatMap((e) => e.cards.map((c) => c.why ?? '')).join(' \n '));
  const said = flat(entries.map((e) => e.words ?? e.quote).join(' \n '));
  const held = (p) => carried.includes(p) || (whys.includes(p) && said.includes(p));
  const gaps = [];
  for (const r of rows) {
    for (const m of r.rationale.matchAll(OWNER_QUOTE)) {
      const parts = m[1].split(/\.\.\.|…/).map(flat).filter((p) => p.length >= 8);
      if (parts.length && !parts.every(held)) gaps.push({ id: r.id, quote: m[1] });
    }
  }
  return gaps;
}

/**
 * What a desk decided that no Transcript entry names (D44, D46). A desk numbers its
 * decisions (`D1 · ...`) or titles them by date (`**2026-10-03 · Title.**`); a titled
 * one counts as named when its title appears word for word in the Transcript.
 */
export function coverageGaps(decisions, transcript) {
  const numbered = [...new Set(decisions.match(/\bD\d+(?= · )/g) ?? [])];
  if (numbered.length) {
    const named = new Set(transcript.match(/\bD\d+\b/g) ?? []);
    return { decided: numbered, missing: numbered.filter((d) => !named.has(d)) };
  }
  const titled = [...decisions.matchAll(/^\*\*\d{4}-\d\d-\d\d · (.+?\.)\*\*/gm)].map((m) => m[1]);
  return { decided: titled, missing: titled.filter((t) => !transcript.includes(t)) };
}

const DAY_MS = 86_400_000;
export const AWAY_DAYS = 3;
export const LOOP_LATE_DAYS = 1.5;

/**
 * The opening status line of every development chat (D19), and, after three days or more
 * away, the digest of what changed meanwhile (D42): one screen at most. Pure, so it can be
 * tested on a made-up history: the caller passes the commits and the for-you list it read.
 */
export function statusLines(entries, { today = new Date().toISOString().slice(0, 10), cards = [], history = [], commits = [], forYou = '', digests = [], review = null, method = null } = {}) {
  const cardsOf = standingCards(entries);
  const drafted = cardsOf.filter((e) => e.card.status !== 'agreed').length;
  const last = latest(history);
  const runnable = cards.filter((c) => c.status === 'runnable');
  const tally = (list) => `${list.filter((c) => last.get(c.id)?.verdict === 'pass').length}/${list.length}`;
  const slow = runnable.filter((c) => ['persona', 'troublemaker'].includes(c.who_acts));
  const fast = runnable.filter((c) => !slow.includes(c));
  const regressed = regressions(history);
  const unsorted = entries.filter((e) => e.way === UNSORTED && e.date < today).length;
  const model = history.filter((h) => h.kind === 'model').at(-1);
  const line = [
    `🧭 Dialogue: ${cardsOf.length - drafted} agreements stand${drafted ? `, ${drafted} drafted await the owner's yes` : ''}`,
    `evals ${tally(fast)} pass by code, ${tally(slow)} by persona`,
    regressed.length ? `🔴 regressed: ${regressed.join(', ')}` : 'no regressions',
    unsorted ? `${unsorted} remark(s) unsorted` : '',
    digests.length ? `month digest owed: ${digests.join(', ')}` : '',
    review?.due ? `agreements review due (${review.why.join('; ')})` : '',
    method?.due ? `method recheck due (${method.last ? `last ${method.last}` : 'never run'})` : '',
    model?.previous ? `model changed to ${model.model} (${model.date.slice(0, 10)})` : '',
    (() => { const u = unproven(entries, cards, history); return u.length ? `${u.length} agreement(s) not yet proven (every eval naming one must pass, T-840)` : 'every agreement proven'; })(),
  ].filter(Boolean).join(' · ');
  const out = [line];
  // A-095: a milestone from the last week is said in the opening line, in the flow of the chat.
  {
    const recent = milestones(entries).filter((x) => (Date.parse(today) - Date.parse(x.date)) / DAY_MS <= 7).slice(-2);
    if (recent.length) out.push(`🏁 ${recent.map((x) => x.text).join(' · ')}`);
  }
  // A-093, A-094: read the lesson record before teaching: what is due for recall, and how to teach.
  {
    const l = lessons(entries, today);
    if (l.given.length) out.push(`🎓 ${l.given.length} lessons, ${l.given.filter((x) => x.took).length} learned${l.enough && l.best ? `, teach by ${l.best}` : ', too few to tell how best to teach'}${l.due ? `; one recall may go in Worth knowing this week, if the work touches it: ${l.due.id} "${clip(l.due.text, 60)}"` : ''}.`);
  }
  // A-093: progress in the conversation, not on a page: the opening line of the month's first days.
  if (Number(today.slice(8, 10)) <= 3) {
    const g = growth(entries).filter((x) => x.month < today.slice(0, 7)).at(-1);
    const l = lessons(entries);
    if (g) out.push(`🌱 Last month (${g.month}): ${g.remarks} remarks, wants ${Math.round((100 * g.wants) / g.remarks)}%, corrections ${Math.round((100 * g.complaints) / g.remarks)}%, ${g.agreed} became agreements; ${l.given.filter((x) => x.took).length} of ${l.given.length} lessons shown applied.`);
  }
  // The loop runs only when the heartbeat does; when it is late, the chat that sees it catches up.
  const lastAll = history.filter((h) => h.kind === 'run' && h.scope === 'all').at(-1);
  const lateDays = lastAll ? (Date.parse(`${today}T23:59:59Z`) - Date.parse(lastAll.date)) / DAY_MS : Infinity;
  if (lateDays > LOOP_LATE_DAYS) out.push(`⏰ The daily loop ${lastAll ? `last ran ${Math.floor(lateDays)} days ago` : 'has never run'}: catch it up in this chat now, \`node ux/scripts/evals.mjs run --all\` (about a minute), and say what it found.`);
  const seen = entries.map((e) => e.date).filter((d) => d < today).sort().at(-1);
  const away = seen ? Math.floor((Date.parse(today) - Date.parse(seen)) / DAY_MS) : 0;
  if (away >= AWAY_DAYS) {
    const since = commits.filter((c) => c.date > seen);
    const kinds = (re) => since.filter((c) => re.test(c.subject)).length;
    const runs = history.filter((h) => h.kind === 'run' && h.date.slice(0, 10) > seen);
    const failedRuns = runs.filter((h) => h.verdict === 'fail').length; // a run that could not run failed nothing
    // A-152: only what waits on the owner is kept, so every line opened since is his.
    const waiting = forYou.split('\n').filter((l) => /^- for-you · /.test(l) && (l.match(/opened (\d{4}-\d\d-\d\d)/)?.[1] ?? '') > seen);
    out.push(`📬 Away ${away} days, since ${day(seen)}: ${since.length} commits (${kinds(/^feat/)} new, ${kinds(/^fix/)} fixes, ${kinds(/^record/)} saves of her record); ${runs.length} eval runs, ${failedRuns} with a failure; ${waiting.length} waiting on you.`);
    for (const l of waiting.slice(0, 3)) out.push(`   ⏳ ${clip(l.replace(/^- for-you · /, '').replace(/ · opened .*$/, ''), 100)}`);
    for (const c of since.filter((x) => /^feat/.test(x.subject)).slice(0, 3)) out.push(`   ✨ ${clip(c.subject, 100)}`);
  }
  return out;
}

/** What she would notice if it changed: her instructions, her skills and commands, her modules and her views. */
export const NOTICED = [/^CLAUDE\.md$/, /^\.claude\/skills\//, /^\.claude\/commands\//, /^\.claude\/modules\.md$/, /^modules\//, /^ux\/app\//];

/**
 * Gate 2 made visible (T-168, gap 3): commits that changed what she would notice and carry no
 * `Approved:` line or an agreed card it builds. Her record's own saves (`record:`) are hers, not a change to the system.
 * Reads `git log --format=%x1e%h%x09%s%n%b%x1f --name-only` output.
 */
export function gateHolds(log, agreed = new Set()) {
  return String(log).split('\x1e').filter((c) => c.trim()).flatMap((c) => {
    const [head, files = ''] = c.split('\x1f');
    const [first, ...body] = head.split('\n');
    const [sha, subject = ''] = first.split('\t');
    if (/^record[:(]/.test(subject)) return [];
    const touched = files.split('\n').map((f) => f.trim()).filter((f) => NOTICED.some((re) => re.test(f)));
    const text = `${subject}\n${body.join('\n')}`;
    // The owner's yes is on the commit (Approved:), or was given to the agreed card it builds.
    if (!touched.length || /^Approved: ["“].+["”]\s*$/m.test(text) || (text.match(/\b[AT]-\d+\b/g) ?? []).some((id) => agreed.has(id))) return [];
    return [{ sha, subject, files: touched }];
  });
}

export const STALE_ITEM_DAYS = 30;

/**
 * The for-you list's own upkeep (T-168, gap 8; A-152): the same question asked twice, reworded,
 * is one question. Groups lines sharing their first words and counts those waiting over a
 * month, for the weekly loop to merge each group into one line and re-check old ones against
 * git (a question already answered there goes), never to close one unread.
 */
export function forYouTriage(text, today = new Date().toISOString().slice(0, 10)) {
  const open = String(text).split('\n').filter((l) => /^- for-you · /.test(l));
  const by = new Map();
  for (const l of open) {
    const lead = l.replace(/^- [a-z-]+ · /, '').slice(0, 48);
    by.set(lead, (by.get(lead) ?? 0) + 1);
  }
  const groups = [...by].filter(([, n]) => n > 1).map(([lead, count]) => ({ lead, count })).sort((a, b) => b.count - a.count);
  const old = open.filter((l) => { const d = l.match(/opened (\d{4}-\d\d-\d\d)/)?.[1]; return d && (Date.parse(today) - Date.parse(d)) / DAY_MS > STALE_ITEM_DAYS; }).length;
  return { open: open.length, groups, old };
}

/**
 * How the owner's way of talking changes, month by month (A-063: the app improves and so do I).
 * Evidence, never a grade: how many remarks; the share that are wants (the end state) and
 * complaints (a correction, something that went wrong); how many became agreed cards; and how
 * many repeated something said before (an entry whose Became says so).
 */
export function growth(entries) {
  const by = new Map();
  for (const e of entries.filter((x) => !/Imported/.test(x.gist ?? ''))) {
    const m = e.date.slice(0, 7);
    const g = by.get(m) ?? { month: m, remarks: 0, wants: 0, complaints: 0, agreed: 0, repeats: 0 };
    g.remarks += 1;
    if (e.way === '💭 want') g.wants += 1;
    if (e.way === '😤 complaint') g.complaints += 1;
    g.agreed += (e.cards ?? (e.card ? [e.card] : [])).filter((c) => c.status === 'agreed').length;
    if (/said (it |this )?before|asked before|again/i.test(e.gist ?? '')) g.repeats += 1;
    by.set(m, g);
  }
  return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Full circle (T-243), every check (T-840, the owner: "Yes, do both"): an agreement is built
 * only when at least one runnable eval card names it in `why` and every runnable card naming it
 * passed its last run; a card never run counts as not passed. One partial check passing no
 * longer marks the whole agreement built. Every agreed card short of that is unproven: built only
 * on paper, in part, or not at all.
 */
export function provenBy(id, cards, last) {
  const naming = cards.filter((c) => runnable(c) && (Array.isArray(c.why) ? c.why : []).includes(id));
  return naming.length > 0 && naming.every((c) => last.get(c.id)?.verdict === 'pass');
}

export function unproven(entries, cards, history) {
  const last = latest(history);
  return standingCards(entries).filter((e) => e.card.status === 'agreed' && !provenBy(e.card.id, cards, last)).map((e) => e.card.id);
}

/**
 * How the owner learns (A-093): every lesson given, whether a later remark shows it applied,
 * and, by style, what share took, so the next lesson is taught the way that works. A lesson
 * given twice in the same words is a repeat.
 */
export const LEARNED_AFTER_DAYS = 7;
export const ENOUGH_LESSONS = 10;

export function lessons(entries, today = new Date().toISOString().slice(0, 10)) {
  const gap = (a, b) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
  // Learned (A-094): applied by the owner on their own, a week or more after the lesson. A use
  // straight after is recency, and an answer to a recall question is recall, counted apart.
  const given = entries.filter((e) => e.lesson).map((e) => {
    const uses = entries.filter((x) => x.applies === e.id);
    const recalls = entries.filter((x) => x.recalled?.lesson === e.id);
    // A-157: in the learning chat, explaining it back rightly in his own words a week on counts too.
    const told = entries.filter((x) => x.explained?.lesson === e.id && x.explained.kept);
    return { id: e.id, date: e.date, ...e.lesson, took: [...uses, ...told].some((x) => gap(e.date, x.date) >= LEARNED_AFTER_DAYS), recalled: recalls.length, recallKept: recalls.filter((x) => x.recalled.kept).length };
  });
  const byStyle = {};
  for (const l of given) {
    const b = (byStyle[l.style] ??= { given: 0, took: 0 });
    b.given += 1;
    if (l.took) b.took += 1;
  }
  const seen = new Map();
  const repeats = given.filter((l) => { const k = l.text.toLowerCase(); const dup = seen.has(k); seen.set(k, true); return dup; }).map((l) => l.id);
  const recallDates = entries.filter((e) => e.recalled).map((e) => e.date).sort();
  const tooOften = recallDates.filter((d, i) => i && gap(recallDates[i - 1], d) < 7);
  const lastRecall = recallDates.at(-1);
  // One recall a week at most, of the oldest lesson not yet learned and a week old.
  const due = (!lastRecall || gap(lastRecall, today) >= 7) ? given.filter((l) => !l.took && gap(l.date, today) >= LEARNED_AFTER_DAYS).sort((a, b) => a.recalled - b.recalled || a.date.localeCompare(b.date))[0] ?? null : null;
  const best = given.length >= ENOUGH_LESSONS ? Object.entries(byStyle).filter(([, b]) => b.given >= 3).sort((a, b) => b[1].took / b[1].given - a[1].took / a[1].given)[0]?.[0] ?? null : null;
  return { given, byStyle, repeats, tooOften, due, best, enough: given.length >= ENOUGH_LESSONS };
}


/** The learning map's topics, in teaching order: `- **L-NN** · <track emoji> · <title>`. */
export function readLearningMap(file = join(REPO, 'dev/dialogue/learning-map.md')) {
  if (!existsSync(file)) return [];
  return [...readFileSync(file, 'utf8').matchAll(/^- \*\*(L-\d+)\*\* · (\S+) · (.+)$/gm)].map((m) => ({ id: m[1], track: m[2], title: m[3].trim() }));
}

/**
 * Where the owner stands on the learning map (A-157): each topic learned, taught, holding an
 * open gap, or not started, from the Lesson, Gap, Applies and Explained lines in the Transcript.
 * Next is the earliest topic with an open gap, else the earliest not yet taught, so his
 * questions steer what comes next and the order holds the rest.
 */
export function learning(entries, { map = readLearningMap(), today } = {}) {
  const given = lessons(entries, today).given;
  const ids = new Set(map.map((t) => t.id));
  const topics = map.map((t) => {
    const mine = given.filter((l) => l.map === t.id);
    const learned = mine.some((l) => l.took);
    // A gap stays open until a lesson on its topic is given on that entry or a later one, so one
    // retaught gap never holds back every new topic for the week until he explains it again.
    const taughtAt = entries.map((e, i) => (e.lesson?.map === t.id ? i : -1)).filter((i) => i >= 0);
    const gaps = learned ? [] : entries.flatMap((e, i) => (e.gaps ?? []).filter((g) => g.map === t.id && !taughtAt.some((j) => j >= i)).map((g) => ({ ...g, at: e.id })));
    const status = learned ? 'learned' : gaps.length ? 'gap' : mine.length ? 'taught' : 'new';
    return { ...t, status, lessons: mine.map((l) => l.id), gaps };
  });
  const counts = { learned: 0, taught: 0, gap: 0, new: 0 };
  for (const t of topics) counts[t.status] += 1;
  const next = topics.find((t) => t.status === 'gap') ?? topics.find((t) => t.status === 'new') ?? null;
  const unknown = [...given.filter((l) => l.map && !ids.has(l.map)).map((l) => `${l.id} (${l.map})`), ...entries.flatMap((e) => (e.gaps ?? []).filter((g) => g.map && !ids.has(g.map)).map((g) => `${e.id} (${g.map})`))];
  return { topics, counts, next, unknown };
}

/**
 * Every level of one agreed card (A-096, "when I say do it, you do all of it"): kept and sorted,
 * agreed, carried by a spec row or the trace, protected by an eval card, every runnable eval naming
 * it passing on its last run (T-840), committed, and pushed. Each level reads the repository, never the reply.
 */
export function levels(id, entries, { cards = readCards(), history = readHistory(), git = gitText } = {}) {
  const e = standingCards(entries).find((x) => x.card.id === id);
  const specs = (() => { try { return execFileSync('grep', ['-rl', `\\b${id}\\b`, SPECS, TRACE], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
  const citing = cards.filter((c) => (Array.isArray(c.why) ? c.why : []).includes(id));
  const last = latest(history);
  const passing = citing.filter((c) => last.get(c.id)?.verdict === 'pass');
  const committed = git(['log', '--oneline', '-1', '--grep', id]);
  const ahead = git(['rev-list', '--count', '@{upstream}..HEAD']);
  return [
    { level: 'kept and sorted', ok: Boolean(e) && e.way !== UNSORTED, saw: e ? `${e.id} ${e.way}` : 'no such card' },
    { level: 'agreed', ok: e?.card.status === 'agreed', saw: e?.card.status ?? '—' },
    { level: 'spec', ok: Boolean(specs), saw: specs ? specs.split('\n').map((f) => relative(REPO, f)).join(', ') : 'no spec row or trace line names it' },
    { level: 'eval', ok: citing.some(runnable), saw: citing.length ? citing.map((c) => `${c.id}${runnable(c) ? '' : ' (written, not running)'}`).join(', ') : 'no eval card names it' },
    { level: 'proven', ok: provenBy(id, cards, last), saw: (() => { const short = citing.filter(runnable).filter((c) => !passing.includes(c)); return short.length ? `${short.map((c) => `${c.id} ${last.get(c.id)?.verdict ?? 'never run'}`).join(', ')}: every check naming it must pass (T-840)` : passing.length ? `${passing.map((c) => c.id).join(', ')} passed` : 'no eval naming it has passed'; })() },
    { level: 'committed', ok: Boolean(committed), saw: committed || 'no commit names it' },
    { level: 'pushed', ok: ahead === '0', saw: ahead === '' ? 'no upstream' : `${ahead} commit(s) not pushed` },
  ];
}
const gitText = (args) => { try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

/**
 * Milestones (A-095): moments worth seeing, said in the conversation, never points, streaks or
 * anything to lose (DEV-005). Each is dated by the remark that reached it.
 */
export function milestones(entries) {
  const out = [];
  const agreedEntries = cardEntries(entries).filter((e) => e.card.status === 'agreed' && !/Imported/.test(e.gist ?? ''));
  [10, 25, 50, 100, 200].forEach((n) => { const e = agreedEntries[n - 1]; if (e) out.push({ date: e.date, text: `your ${n}th agreement (${e.card.id})` }); });
  const l = lessons(entries);
  const learned = l.given.filter((x) => x.took);
  [1, 5, 10, 25].forEach((n) => { const x = learned[n - 1]; if (x) out.push({ date: x.date, text: n === 1 ? `your first lesson learned on your own (${x.id})` : `${n} lessons learned on your own` }); });
  for (const e of entries) {
    const n = (e.cards ?? []).length;
    if (n >= 3) out.push({ date: e.date, text: `one remark (${e.id}) became ${n} agreements` });
    if (e.applies) {
      const lesson = entries.find((x) => x.id === e.applies);
      if (lesson) out.push({ date: e.date, text: `you used a lesson on your own (${e.applies} → ${e.id})` });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')} …` : s);

/** A check's kind, by who acts and who grades (A-065): 🎭 persona, 🤖 AI judge, 👤 owner, 🧪 code. */
export const checkKind = (k) => (['persona', 'troublemaker'].includes(k.who_acts) ? '🎭' : k.who_grades === 'judge' ? '🤖' : k.who_grades === 'person' ? '👤' : '🧪');

// The Agreements, in parts (D37, T-768), are rendered by dialogue-agreements.mjs.
export { renderAgreements } from './dialogue-agreements.mjs';

const WORD = /[a-z0-9]+/g;
const STOP = new Set('a an and are as at be by can did do does for from has have how i in is it its me my of on or our so that the this to was we what when where which who why will with you'.split(' '));

/**
 * A word's stem, by rule, so "skills", "healing" and "practices" meet "skill",
 * "heal" and "practice" (T-173). A light suffix stripper in the manner of
 * Porter's, no list of synonyms: it joins forms of one word, never two words.
 */
export function stem(word) {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  const cut = w.match(/(ations?|ation|ments?|ness|ingly|edly|ing|ed|ly)$/);
  if (cut && w.length - cut[0].length >= 3) {
    w = w.slice(0, -cut[0].length);
    if (/(ing|ed)/.test(cut[0]) && /([^aeioulsz])\1$/.test(w)) w = w.slice(0, -1);
  }
  return w.length > 3 ? w.replace(/e$/, '') : w;
}
export const words = (s) => new Set((String(s ?? '').toLowerCase().match(WORD) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
const cardText = (e) => [e.card.says, e.card.why, e.card.failedIf, e.words ?? e.quote, e.gist].join(' ');

/**
 * Every row of every register, with its whole text (statement, parents,
 * rationale, coverage, design), so a search reads what a row says, not only its
 * title (T-173: no skill row was found for a question about skills).
 */
export function specRows(dir = SPECS) {
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const full of walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') })) {
    let row = null;
    let section = '';
    for (const line of readFileSync(full, 'utf8').split('\n')) {
      const head = line.match(/^## \*\*([A-Z]{3}-\d{3})\b/);
      if (head) {
        row = { id: head[1], path: relative(dir, full).replace(/\\/g, '/'), text: '', statement: '', rationale: '' };
        section = '';
        rows.push(row);
        continue;
      }
      if (/^# /.test(line)) { row = null; continue; }
      if (!row) continue;
      const sec = line.match(/^(?:> )?### \*\*\(.\) SPEC (\w+)/);
      if (sec) { section = sec[1]; continue; }
      row.text += `${line}\n`;
      if (section === 'STATEMENT' && !row.statement) row.statement = line.match(/^> \*\*(.+?)\*\*/)?.[1] ?? '';
      if (section === 'RATIONALE') row.rationale += `${line}\n`;
    }
  }
  return rows;
}

/** Items ranked by the question's stems they share, rarer stems counting more (inverse document frequency). */
function rank(q, items, textOf, min) {
  const sets = items.map((it) => words(textOf(it)));
  const idf = new Map([...q].map((w) => [w, Math.log((items.length + 1) / (sets.filter((s) => s.has(w)).length + 1)) + 1]));
  return items.map((it, i) => {
    const hit = [...q].filter((w) => sets[i].has(w));
    return { ...it, n: hit.length, score: hit.reduce((t, w) => t + idf.get(w), 0) };
  }).filter((x) => x.n >= min).sort((a, b) => b.score - a.score);
}

/**
 * The questions the owner keeps asking, from the "Your questions" table of the
 * dialogue README (A-053). E-094 (2026-10-30): "do we actually need this?" was kept
 * as a one-off, since "need" is in hundreds of remarks and the first asking (T-170)
 * never reached ask's top five; the table names it, so ask now reads the table.
 */
export function keptQuestions(text = existsSync(join(DIALOGUE_DIR, 'README.md')) ? readFileSync(join(DIALOGUE_DIR, 'README.md'), 'utf8') : '') {
  const part = String(text).split(/^## Your questions\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return [...part.matchAll(/^\| *([^|]+?) *\| *(T-\d+) *\|$/gm)].map((m) => ({ question: m[1], first: m[2] }));
}

/**
 * The kept questions this one asks again (A-053): a kept question matches when it shares all
 * its words, or two of them, so "do we actually need this?" is "Do we need this?" asked again.
 * Read by `ask` and, on his typed words, by the reply-shape hook (E-094: `ask` was run on two
 * words of the message, so the repeat went unseen).
 */
// Matched a sentence at a time, and only when the shared words are most of the kept
// question's and a fair part of the sentence's (2026-11-04): over his whole message, one
// shared word fired "Do we need this?" on "do u need to restart chats?", and two common
// words fired the hard-coded question on a message about gaps and redundancy.
const KEPT_SHARE = 0.6;
const SENTENCE_SHARE = 0.4;
// A kept question of two sentences ("Is it too specific? What could be removed?") is read
// against two sentences side by side as well, and the best match comes first (E-126,
// 2026-11-05): read a sentence at a time it was never found, and "What needs clarifying?"
// named "Do we need this?" in place of the conflict question it ends.
export function keptAgain(question, kept = keptQuestions()) {
  const sentences = String(question ?? '').split(/(?<=[?.!])\s+|\n+/).map(words).filter((s) => s.size);
  const spans = [...sentences, ...sentences.slice(1).map((s, i) => new Set([...sentences[i], ...s]))];
  const score = (k) => {
    const w = words(k.question);
    let best = 0;
    if (!w.size) return best;
    for (const s of spans) {
      const n = [...w].filter((x) => s.has(x)).length;
      if (n >= Math.min(2, w.size) && n / w.size >= KEPT_SHARE && n / s.size >= SENTENCE_SHARE) best = Math.max(best, n / w.size + n / 100);
    }
    return best;
  };
  return kept.map((k) => ({ k, s: score(k) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.k);
}

/** What was said, agreed and specified about a question, best match first (D40). */
export function ask(question, entries, rows = specRows(), kept = keptQuestions()) {
  const q = words(question);
  const min = Math.min(2, q.size);
  const said = rank(q, entries, (e) => `${e.words ?? e.quote} ${e.gist ?? ''} ${(e.cards ?? []).map((c) => c.says).join(' ')}`, 1).map((x) => ({ e: x, n: x.n }));
  // Every standing card, for the agent to judge: a word match only orders them (T-173).
  const cards = standingCards(entries).sort((a, b) => a.card.id.localeCompare(b.card.id, 'en', { numeric: true }));
  const hits = rank(q, cards, cardText, min);
  const agreed = hits.map((e) => ({ e, n: e.n }));
  const rest = cards.filter((e) => !hits.some((h) => h.card.id === e.card.id));
  const specs = rank(q, rows, (r) => `${r.id} ${r.text}`, min).map((r) => ({ id: r.id, text: r.statement || clip(r.text, 80), n: r.n }));
  // What already waits on the owner (A-152): a question on the same thing is already put to him.
  let queued = [];
  if (existsSync(FOR_YOU)) {
    queued = rank(q, readFileSync(FOR_YOU, 'utf8').split('\n').filter((l) => /^- for-you · /.test(l)).map((l) => ({ text: l.slice(2) })), (b) => b.text, min);
  }
  const again = keptAgain(question, kept);
  return { said: said.slice(0, 5), again, agreed, rest, specs: specs.slice(0, 6), queued: queued.slice(0, 3), evals: evalsFor(agreed.map((x) => x.e.card.id)) };
}

/** The eval cards guarding these agreements, each with its latest run, so a check can say 🟢 proven. */
export function evalsFor(cardIds, cards = readCards(), history = readHistory()) {
  const last = latest(history);
  return cards.filter((c) => (Array.isArray(c.why) ? c.why : []).some((w) => cardIds.includes(w)))
    .map((c) => ({ id: c.id, title: c.title, run: last.get(c.id) ?? null, runnable: runnable(c), blocked: c.blocked_by ?? null }));
}

const oneLine = (e, n = 64) => `${e.card.id} ${e.card.emoji} ${clip(e.card.says, n)}`;

export function printAsk(question, entries) {
  const { said, again, agreed, rest, specs, queued, evals } = ask(question, entries);
  const lines = [`🩺 Health check · "${question}"`, ''];
  if (again.length) {
    lines.push('🔁 A question he keeps asking (A-053, dev/dialogue/README.md "Your questions"):');
    lines.push(...again.map((k) => `   ${k.question} · first asked ${k.first}`));
    lines.push('   Not a one-off: say it is kept, ask it of one other area where it bites, and put it back to him to answer before giving your view.', '');
  }
  lines.push('📜 Asked or said before:');
  lines.push(...(said.length ? said.map(({ e }) => `   ${e.id} · ${day(e.date)} · ${e.way} · "${clip(e.quote, 80)}"`) : ['   nothing found']));
  lines.push(`🤝 Every standing card (${agreed.length + rest.length}); ▸ shares words; judge each by meaning:`);
  lines.push(...agreed.map(({ e }) => `▸ ${oneLine(e, 90)}${e.card.status === 'agreed' ? '' : ' (drafted)'}`));
  const agreedRest = rest.filter((e) => e.card.status === 'agreed');
  const draftedRest = rest.filter((e) => e.card.status !== 'agreed');
  if (agreedRest.length) lines.push('   agreed:', ...agreedRest.map((e) => `   ${oneLine(e)}`));
  if (draftedRest.length) lines.push('   drafted:', ...draftedRest.map((e) => `   ${oneLine(e)}`));
  lines.push('📐 Specs that carry it (whole rows, by stem):');
  lines.push(...(specs.length ? specs.map((s) => `   ${s.id} · ${clip(s.text, 80)}`) : ['   none found']));
  lines.push('🧪 Evals that run it:');
  lines.push(...(evals.length ? evals.slice(0, 6).map((v) => `   ${v.id} · ${!v.runnable ? `⏸ written, not running (${clip(v.blocked ?? '', 50)})` : v.run ? `${v.run.verdict === 'pass' ? '✅' : '❌'} ${v.run.verdict} ${day(v.run.date.slice(0, 10))} on ${v.run.commit}` : '⏳ never run'} · ${clip(v.title, 70)}`).concat(evals.length > 6 ? [`   …and ${evals.length - 6} more`] : []) : ['   none']));
  lines.push('🙋 Waiting on you:');
  lines.push(...(queued.length ? queued.map((b) => `   ${clip(b.text, 100)}`) : ['   nothing open']));
  const failing = evals.filter((v) => v.run && v.run.verdict !== 'pass');
  const passing = evals.filter((v) => v.run?.verdict === 'pass');
  const verdict = failing.length ? `🔴 failing: ${failing.map((v) => v.id).join(', ')} failed on its last run`
    : agreed.length && specs.length && passing.length && passing.length === evals.filter((v) => v.runnable).length ? `🟢 proven: every runnable eval guarding it (${passing.length}) passed its last run${evals.length > passing.length ? `; ${evals.length - passing.length} written, not running` : ''}`
    : agreed.length && specs.length && passing.length ? `🟡 partly proven: ${passing.length} of ${evals.filter((v) => v.runnable).length} runnable evals guarding it passed; the rest not yet run, and every one must pass (T-840)`
    : agreed.length && specs.length && evals.length && !evals.some((v) => v.runnable) ? '🟡 traced: eval written, not running; nothing checks it yet'
    : agreed.length && specs.length ? '🟡 traced: covered on paper; no eval has run it yet' : agreed.length || specs.length ? '🟡 partly: found in one layer only' : said.length ? '🟡 said before, but neither agreed nor specified' : '🔴 none by words: read the cards above before drafting one (D16)';
  lines.push('', `🚦 ${verdict}`);
  if (!agreed.length) lines.push('   (words only: if this was said in other words, read `dialogue.mjs gists` and match by meaning)');
  console.log(lines.join('\n'));
}

