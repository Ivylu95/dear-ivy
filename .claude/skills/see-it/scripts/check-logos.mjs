#!/usr/bin/env node
// The see-it skill's logo set stays safe to inline and exactly as vetted.
//
// DEV-004 design 4: a diagram page inlines every logo, so a logo is code on that
// page. This refuses, for each SVG in logos/:
//   - a <script>, a <foreignObject>, or any on* attribute (an event handler);
//   - an href, xlink:href or url() that leaves the file (only #id and data: stay);
//   - a file not listed in logos/SOURCES.md, or a listed one missing;
//   - a file whose sha256 differs from its SOURCES.md row (changed after vetting).
// It reports, without failing, a row whose Checked date is older than the
// re-ground interval in the skill's log (dev/skills/see-it/log.md; six months in
// a copy without dev/, ARC-008), so a stale mark is seen when the log is.
//
// Dependency-free. Reads nothing outside its own skill folder but that log.
//
//   node .claude/skills/see-it/scripts/check-logos.mjs [--dir <logos folder>] [--today YYYY-MM-DD]

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const dir = arg('--dir') ?? join(here, '..', 'logos');
/** The skill's grounding log, in the development half; absent in a copy without dev/. */
export const LOG = join(here, '..', '..', '..', '..', 'dev', 'skills', 'see-it', 'log.md');
const today = arg('--today') ?? new Date().toISOString().slice(0, 10);

/** Faults in one SVG's text, as strings. */
export function svgFaults(text) {
  const f = [];
  if (/<script\b/i.test(text)) f.push('has a <script>');
  if (/<foreignObject\b/i.test(text)) f.push('has a <foreignObject>');
  for (const [, name] of text.matchAll(/\s(on[a-z]+)\s*=/gi)) f.push(`has an event attribute ${name}`);
  for (const [, ref] of text.matchAll(/\s(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^(#|data:)/i.test(ref.trim())) f.push(`links out: href "${ref.slice(0, 60)}"`);
  }
  for (const [, ref] of text.matchAll(/url\(\s*["']?([^"')]*)/gi)) {
    if (!/^(#|data:)/i.test(ref.trim())) f.push(`links out: url(${ref.slice(0, 60)})`);
  }
  if (/@import\b/i.test(text)) f.push('has an @import');
  return f;
}

/** The SOURCES.md table rows: { file, checked, sha }. */
export function sourceRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const file = cells.find((c) => /^`?[\w.-]+\.svg`?$/.test(c))?.replace(/`/g, '');
    if (!file) continue;
    rows.push({
      file,
      checked: cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) ?? null,
      sha: cells.map((c) => c.replace(/`/g, '')).find((c) => /^[0-9a-f]{64}$/.test(c)) ?? null,
    });
  }
  return rows;
}

/** The re-ground interval in months, from the log's Status row; six where it says none. */
export function intervalMonths(logText) {
  const n = String(logText).match(/\*\*Interval\*\*\s*\|\s*(\d+)\s*months?/i)?.[1];
  return n ? Number(n) : 6;
}

const monthsBetween = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

/** { failures, reports } for one logos folder. */
export function checkLogos(logosDir, logPath, on) {
  const failures = [];
  const reports = [];
  const sourcesPath = join(logosDir, 'SOURCES.md');
  if (!existsSync(sourcesPath)) return { failures: ['logos/SOURCES.md is missing'], reports };
  const rows = sourceRows(readFileSync(sourcesPath, 'utf8'));
  const byFile = new Map(rows.map((r) => [r.file, r]));
  const svgs = readdirSync(logosDir).filter((n) => n.toLowerCase().endsWith('.svg')).sort();
  const months = intervalMonths(existsSync(logPath) ? readFileSync(logPath, 'utf8') : '');
  for (const name of svgs) {
    const buf = readFileSync(join(logosDir, name));
    for (const fault of svgFaults(buf.toString('utf8'))) failures.push(`${name} ${fault}`);
    const row = byFile.get(name);
    if (!row) {
      failures.push(`${name} is in no SOURCES.md row`);
      continue;
    }
    const sha = createHash('sha256').update(buf).digest('hex');
    if (!row.sha) failures.push(`${name}: its SOURCES.md row has no sha256`);
    else if (row.sha !== sha) failures.push(`${name}: sha256 ${sha.slice(0, 12)}… differs from SOURCES.md ${row.sha.slice(0, 12)}…`);
    if (!row.checked) reports.push(`${name}: its SOURCES.md row has no checked date`);
    else if (monthsBetween(row.checked, on) >= months) reports.push(`${name}: checked ${row.checked}, older than the ${months}-month re-ground; look again at its source`);
  }
  for (const r of rows) if (!svgs.includes(r.file)) failures.push(`${r.file} is in SOURCES.md but not in logos/`);
  return { failures, reports };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { failures, reports } = checkLogos(dir, LOG, today);
  for (const r of reports) console.log(`  report: ${r}`);
  if (failures.length) {
    console.log('SEE-IT LOGOS CHECK FAILED\n');
    for (const f of failures) console.log(`  - ${f}`);
    console.log('\n  A logo is inlined into a page: it must carry no code, link nowhere, and be the file that was vetted.');
    console.log('  Fix the file, or fetch it again from its source and update its SOURCES.md row.');
    process.exit(1);
  }
  console.log(`see-it logos: ${readdirSync(dir).filter((n) => n.endsWith('.svg')).length} logos, each clean and as vetted`);
}
