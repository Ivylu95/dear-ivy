// Before it: once two replies have passed since her first crisis message without
// the question, the floor says it is due (stay with her first, then ask).
// After "Are you safe right now?" (A-143): whatever she answers, the reply names
// one person she could reach and one line. Live persona checks (2026-10-29) showed
// the question asked, "I'm safe" heard, then neither named in four runs of five,
// the reply offering "I'm here" instead; the sentence alone did not hold, so the
// floor says what is still owed every turn until a reply has named both.
//
// Pure functions over the transcript's entries. It follows her lead: once she
// asks not to be pointed elsewhere, nothing is owed (CLAUDE.md, stopping).

import { herWords, textOf, isHers } from './place.mjs';

const ASKED = /\bare you safe\b/i;
// The emergency number alone is not the line: it is offered for chest pain too (live run, 2026-10-29).
const LINE = /\b(?:1767|1771|9151 ?1767|6669 ?1771|sos|mindline|samaritans|helpline|hotline|crisis line)\b/i;
const PERSON = [
  /\b(?:someone|anyone|somebody|a friend|a person)\b[^.?!\n]{0,40}\b(?:could|can|would|might|trust)\b/i,
  /\bwho (?:could|can|would|might) you\b/i,
  /\byour (?:gp|doctor|therapist|counsellor|counselor|psychiatrist|clinician)\b/i,
];
const DROPPED = /\b(?:stop (?:pointing|giving|sending|telling)|(?:don'?t|do not|no more) (?:give|send|tell) me (?:the |those |any )?(?:numbers|hotlines?|lines?)|no more numbers|stop with the (?:numbers|hotlines?))\b/i;

/**
 * Whether the safety question was asked, how many replies have passed since her
 * first crisis message without it (with `isCrisis`), and whether a person and a
 * line have been named since it was asked.
 */
export function owedState(entries, isCrisis = () => false) {
  const s = { asked: false, line: false, person: false, dropped: false, crisis: false, unasked: 0 };
  for (const entry of entries ?? []) {
    const text = entry?.type === 'user' ? herWords(textOf(entry)) : textOf(entry);
    if (entry?.type === 'user' && isHers(entry) && isCrisis(text.toLowerCase())) s.crisis = true;
    if (entry?.type === 'assistant') {
      if (ASKED.test(text)) s.asked = true;
      else if (s.crisis && !s.asked) s.unasked += 1;
      if (s.asked) {
        if (LINE.test(text)) s.line = true;
        if (PERSON.some((re) => re.test(text))) s.person = true;
      }
    } else if (entry?.type === 'user' && isHers(entry) && s.asked && DROPPED.test(text)) {
      s.dropped = true;
    }
  }
  return s;
}

/** The lines the floor adds while a person or a line is still owed, or []. */
export function owedLines(s) {
  // Stay with her first, two or three messages (CLAUDE.md); after two, the question is due.
  if (!s?.asked && s?.unasked >= 2) {
    return [
      `  · ${s.unasked} replies since her first crisis message, and none has asked plainly. This`,
      '    reply asks "Are you safe right now?", in those words, and says you are an AI, not a person.',
    ];
  }
  if (!s?.asked || s.dropped || (s.line && s.person)) return [];
  const missing = [!s.person && 'one person she could reach', !s.line && 'one line'].filter(Boolean).join(' and ');
  return [
    `  · You asked whether she is safe; no reply since has named ${missing}. Whatever she`,
    `    answered, this reply names ${missing} (safe: once, for a night that gets worse),`,
    '    never yourself in their place, not "I\'m here" instead (A-143).',
  ];
}
