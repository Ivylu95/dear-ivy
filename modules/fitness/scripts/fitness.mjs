#!/usr/bin/env node
// Reads the training log in the record (card A-132): each set as weight × reps × reps left,
// and bodyweight as weighed, so a session can say where a lift's estimated max stands and
// what protein a goal comes to per kilogram; and her recovery a day a line, sleep, soreness
// and energy (card A-154), so a week can be read back. Nothing is written; the agent keeps
// the tables.
//
//   node modules/fitness/scripts/fitness.mjs summary [--json]   best estimated max per lift, its trend,
//                                                  the latest bodyweight, protein per kg,
//                                                  and the last seven days of recovery
//   node modules/fitness/scripts/fitness.mjs check              every row readable; exits 1 if not
//
// --record <dir> reads another record folder instead of data/ (a test).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Estimated one-rep max from a set: Epley's formula on the reps done plus the reps left
 * (reps in reserve), so an easy 5 counts for more than a grinding 5. A true single (one rep,
 * none left) is the max itself; Epley overstates singles. Reps left not given count as none,
 * so an unknown set never flatters the estimate.
 */
export function e1rm(kg, reps, left = 0) {
  const total = reps + (Number.isFinite(left) ? left : 0);
  if (!(kg > 0) || !(reps >= 1)) return null;
  return total <= 1 ? kg : Math.round(kg * (1 + total / 30) * 10) / 10;
}

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
function table(text, heading) {
  const at = text.search(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (at < 0) return [];
  const rows = [];
  for (const line of text.slice(at).split('\n').slice(1)) {
    if (/^## /.test(line)) break;
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    rows.push(cells(line));
  }
  return rows.slice(1); // the header row
}
const num = (s) => { const n = Number(String(s ?? '').replace(/[~kg\s]/g, '')); return String(s ?? '').trim() === '' || !Number.isFinite(n) ? null : n; };

/** The log's sets and weigh-ins, with what is wrong with each unreadable row. */
export function readLog(text) {
  const faults = [];
  const sets = [];
  for (const [date, lift, kg, reps, left] of table(text, 'Sets')) {
    const row = { date, lift, kg: num(kg), reps: num(reps), left: left === '' || left === '?' ? null : num(left) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) faults.push(`Sets: "${date}" is not a date (YYYY-MM-DD)`);
    else if (!lift) faults.push(`Sets ${date}: no lift named`);
    else if (!(row.kg > 0)) faults.push(`Sets ${date} ${lift}: weight "${kg}" is not a number of kilograms`);
    else if (!(Number.isInteger(row.reps) && row.reps >= 1 && row.reps <= 30)) faults.push(`Sets ${date} ${lift}: reps "${reps}" should be a whole number from 1 to 30`);
    else if (left !== '' && left !== '?' && !(Number.isInteger(row.left) && row.left >= 0 && row.left <= 10)) faults.push(`Sets ${date} ${lift}: reps left "${left}" should be 0 to 10, or blank when not known`);
    else sets.push({ ...row, e1rm: e1rm(row.kg, row.reps, row.left ?? 0) });
  }
  const weights = [];
  for (const [date, kg] of table(text, 'Bodyweight')) {
    const w = num(kg);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) faults.push(`Bodyweight: "${date}" is not a date (YYYY-MM-DD)`);
    else if (!(w >= 30 && w <= 300)) faults.push(`Bodyweight ${date}: "${kg}" is not a bodyweight in kilograms`);
    else weights.push({ date, kg: w });
  }
  const recovery = [];
  const seen = new Set();
  for (const [date, sleep, sore, energy, note] of table(text, 'Recovery')) {
    const h = num(sleep);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) faults.push(`Recovery: "${date}" is not a date (YYYY-MM-DD)`);
    else if (seen.has(date)) faults.push(`Recovery ${date}: a second row for the same day; fill the first`);
    else if (String(sleep ?? '').trim() !== '' && !(h !== null && h >= 0 && h <= 16)) faults.push(`Recovery ${date}: sleep "${sleep}" should be hours from 0 to 16, or blank when not given`);
    else {
      seen.add(date);
      recovery.push({ date, sleep: h, soreness: sore || null, energy: energy || null, note: note || null });
    }
  }
  // Machines (T-777): each machine's settings, kept so they are found again, never only in the log.
  const machines = [];
  for (const [machine, setting, date, note] of table(text, 'Machines')) {
    if (!machine) faults.push('Machines: a row names no machine');
    else if (!setting) faults.push(`Machines ${machine}: no setting given`);
    else if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) faults.push(`Machines ${machine}: "${date}" is not a date (YYYY-MM-DD)`);
    else machines.push({ machine, setting, date: date || null, note: note || null });
  }
  return { sets, weights, recovery, machines, faults };
}

/** Log lines of `day` whose reps were not given yet and that no set row of that day covers
 *  (T-777): what one question at the session's end fills in. A row covers a line when it names the
 *  same lift (two words in common, or the line's only one) and, where the line gives one, the same weight. */
export function owed(text, day) {
  const { sets } = readLog(text);
  const words = (t) => String(t).toLowerCase().match(/[a-z][a-z-]{2,}/g)?.filter((w) => !['the', 'and', 'machine', 'her', 'his', 'their', 'one', 'arm', 'time'].includes(w)) ?? [];
  return String(text ?? '').split('\n')
    .filter((l) => l.startsWith(`- ${day} · `) && /\breps?\b[^.]*\bnot given\b/i.test(l))
    .map((l) => l.slice(`- ${day} · `.length).split(/[,:;]| (?:her|his|their) words/)[0].trim())
    .filter((head) => {
      const kg = Number(head.match(/(\d+(?:\.\d+)?)\s*kg/)?.[1]);
      const mine = words(head.replace(/\d+(\.\d+)?\s*kg/, ''));
      return !sets.some((r) => r.date === day && (!kg || r.kg === kg) && mine.filter((w) => words(r.lift).includes(w)).length >= Math.min(2, mine.length));
    });
}

/** The seven days up to `today`: nights logged, average sleep, short nights, soreness named. */
export function week(recovery = [], today = new Date().toISOString().slice(0, 10)) {
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 6);
  const start = from.toISOString().slice(0, 10);
  const days = recovery.filter((r) => r.date >= start && r.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const slept = days.filter((r) => r.sleep !== null);
  const avg = slept.length ? Math.round((slept.reduce((t, r) => t + r.sleep, 0) / slept.length) * 10) / 10 : null;
  return {
    from: start,
    to: today,
    days: days.length,
    nights: slept.length,
    averageSleep: avg,
    shortNights: slept.filter((r) => r.sleep < 6).map((r) => r.date),
    sore: days.filter((r) => r.soreness).map((r) => ({ date: r.date, soreness: r.soreness })),
  };
}

/** Per lift: the best estimated max, and the best of each session in date order. */
export function summarise({ sets, weights, recovery = [] }, proteinGoal = null, today = undefined) {
  const lifts = {};
  for (const s of [...sets].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = s.lift.toLowerCase();
    const l = (lifts[key] ??= { lift: s.lift, best: null, sessions: [] });
    const last = l.sessions.at(-1);
    if (last?.date === s.date) { if (s.e1rm > last.e1rm) Object.assign(last, { e1rm: s.e1rm, from: `${s.kg} × ${s.reps}` }); }
    else l.sessions.push({ date: s.date, e1rm: s.e1rm, from: `${s.kg} × ${s.reps}` });
    if (!l.best || s.e1rm > l.best.e1rm) l.best = { date: s.date, e1rm: s.e1rm, from: `${s.kg} × ${s.reps}${s.left === null ? '' : `, ${s.left} left`}` };
  }
  const byDate = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = byDate.at(-1) ?? null;
  const perKg = latest && proteinGoal ? Math.round((proteinGoal / latest.kg) * 10) / 10 : null;
  return { lifts: Object.values(lifts), bodyweight: latest, proteinPerKg: perKg, recovery: week(recovery, today) };
}

/** Her timezone, from her profile; UTC when none is set. */
function tzOf(record) {
  try {
    const tz = readFileSync(join(record, 'PROFILE.yaml'), 'utf8').match(/^\s*timezone:\s*(?:\n\s*value:\s*)?["']?([A-Za-z_]+\/[A-Za-z_]+)/m)?.[1];
    return tz && Intl.supportedValuesOf('timeZone').includes(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ri = args.indexOf('--record');
  const record = ri >= 0 ? args[ri + 1] : join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');
  const path = join(record, 'fitness', 'training.md');
  if (!existsSync(path)) { console.log('fitness: no training log yet'); process.exit(0); }
  const log = readLog(readFileSync(path, 'utf8'));
  if (args[0] === 'check') {
    for (const f of log.faults) console.log(`problem: ${f}`);
    console.log(`fitness: ${log.sets.length} sets, ${log.weights.length} weigh-ins, ${log.recovery.length} recovery days, ${log.machines.length} machines${log.faults.length ? `, ${log.faults.length} unreadable` : ', all readable'}`);
    process.exit(log.faults.length ? 1 : 0);
  }
  if (args[0] === 'owed') {
    const day = args[1] && /^\d{4}-\d{2}-\d{2}$/.test(args[1]) ? args[1] : new Intl.DateTimeFormat('en-CA', { timeZone: tzOf(record) }).format(new Date());
    const list = owed(readFileSync(path, 'utf8'), day);
    console.log(list.length ? `reps not given yet on ${day}:\n${list.map((x) => `  - ${x}`).join('\n')}` : `reps: nothing owed on ${day}`);
    process.exit(0);
  }
  const readme = join(record, 'fitness', 'README.md');
  const goal = existsSync(readme) ? Number(readFileSync(readme, 'utf8').match(/\|\s*Protein\s*\|\s*(\d+)\s*g/i)?.[1]) || null : null;
  const s = summarise(log, goal);
  if (args.includes('--json')) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  for (const l of s.lifts) console.log(`${l.lift}: best estimated max ${l.best.e1rm} kg (${l.best.date}, ${l.best.from}); by session ${l.sessions.map((x) => `${x.date} ${x.e1rm}`).join(' · ')}`);
  console.log(s.bodyweight ? `bodyweight ${s.bodyweight.kg} kg (${s.bodyweight.date})${s.proteinPerKg ? `; protein goal ${goal} g is ${s.proteinPerKg} g per kg` : ''}` : 'bodyweight: none logged yet');
  const w = s.recovery;
  console.log(w.days ? `recovery ${w.from} to ${w.to}: ${w.nights} nights logged${w.averageSleep !== null ? `, average sleep ${w.averageSleep} h` : ''}${w.shortNights.length ? `, short nights (under 6 h) ${w.shortNights.join(', ')}` : ''}${w.sore.length ? `; sore ${w.sore.map((x) => `${x.date} "${x.soreness}"`).join(', ')}` : ''}` : 'recovery: nothing logged in the last seven days');
  if (log.machines.length) console.log(`machines: ${log.machines.map((m) => `${m.machine} (${m.setting})`).join(' · ')}`);
  if (log.faults.length) console.log(`(${log.faults.length} unreadable rows: run check)`);
}
