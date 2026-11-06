// Which registers govern which paths.
//
//   node .claude/hooks/lib/spec-map.mjs dev/ui/lib/git.js     what governs this file
//   node .claude/hooks/lib/spec-map.mjs --check           every mapped spec exists
//   node .claude/hooks/lib/spec-map.mjs --unmapped        registers nothing points at
//
// SFG-008, "Before an edit to the harness is finished, the agent has read the
// specs that govern the file it changed.", asks for exactly this list and names
// the failure it prevents: "a change that painted history before the save state
// went unnoticed until the right spec file was opened by chance."
//
// It is also what makes an audit repeatable. Without it, every audit of a row
// re-derives which files could possibly bear on it, and two audits of the same
// row read different evidence — so a verdict cannot be compared with the one
// before it. The spec-audit skill reads scope from here.
//
// ── What it is not ─────────────────────────────────────────────────────────
//
// It is a map of governance, not of proof. A path matching a register says the
// register bears on that file; it never says the file satisfies it. And the
// list drifts as files move — SFG-008's design column admits that plainly. The
// --check flag catches a spec that has been renamed; nothing catches a path
// pattern that has quietly stopped matching anything, which is the drift that
// actually happens.
//
// Nothing under data/ is mapped, deliberately. The specs governing the record
// are audited against data-sample/, which is fabricated and carries nothing
// personal — ARC-004 holds inside an audit report as everywhere else.

import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from './paths.mjs';

const REPO = resolve(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

/**
 * Ordered, most specific first. `**` matches any depth, `*` any run within one
 * segment. Every entry names the registers that bear on that path — not the one
 * that happens to be most interesting.
 */
export const SPEC_MAP = [
  // ── The harness's own instructions ───────────────────────────────────────
  { pattern: 'CLAUDE.md', specs: ['interaction/safety.md', 'interaction/conduct.md', 'interaction/fit.md', 'interaction/memory.md', 'system/context.md'] },
  { pattern: '.claude/skills/policy-review/**', specs: ['legal/policies.md', 'system/skills.md'] },
  { pattern: '.claude/skills/commit/**', specs: ['system/practice.md', 'system/skills.md'] },
  { pattern: '.claude/skills/**', specs: ['system/skills.md', 'system/procedure-limits.md', 'interaction/conduct.md', 'interaction/fit.md'] },
  { pattern: '.claude/commands/**', specs: ['system/skills.md', 'system/procedure-limits.md'] },
  { pattern: '.claude/memory/**', specs: ['system/skills.md'] },

  // ── What holds the agent to its rules ────────────────────────────────────
  { pattern: '.claude/hooks/lib/update/**', specs: ['system/deployment.md', 'data/access.md', 'system/safeguards.md'] },
  { pattern: '.claude/release/**', specs: ['system/deployment.md', 'data/access.md'] },
  { pattern: '.claude/hooks/safety/**', specs: ['interaction/safety.md', 'system/safeguards.md'] },
  { pattern: '.claude/hooks/privacy/**', specs: ['data/access.md', 'system/safeguards.md'] },
  { pattern: '.claude/hooks/record/**', specs: ['data/record.md', 'system/safeguards.md', 'interaction/memory.md'] },
  { pattern: '.claude/hooks/session/policy-review-due.mjs', specs: ['legal/policies.md', 'system/context.md', 'system/safeguards.md'] },
  { pattern: '.claude/hooks/lib/policy-review.mjs', specs: ['legal/policies.md', 'system/safeguards.md'] },
  { pattern: '.claude/hooks/session/**', specs: ['system/context.md', 'system/safeguards.md'] },
  { pattern: '.claude/hooks/**', specs: ['system/safeguards.md'] },
  { pattern: '.claude/settings*.json', specs: ['system/safeguards.md'] },

  // ── The unattended run ───────────────────────────────────────────────────
  { pattern: '.claude/heartbeats.json', specs: ['system/heartbeats.md', 'system/maintenance.md'] },
  { pattern: '.claude/jobs/', specs: ['system/heartbeats.md', 'system/maintenance.md'] },
  { pattern: '.claude/jobs/**', specs: ['system/heartbeats.md', 'system/maintenance.md'] },
  { pattern: '.claude/jobs/**', specs: ['system/maintenance.md'] },

  // ── The queues, the evidence base, the fabricated record ─────────────────
  { pattern: 'dev/skills/release/**', specs: ['system/deployment.md', 'system/ARCHITECTURE.md'] },
  { pattern: 'dev/specs/**', specs: ['system/ARCHITECTURE.md', 'ux/tabs/specs.md'] },
  { pattern: 'dev/skills/**', specs: ['system/skills.md', 'system/ARCHITECTURE.md'] },
  { pattern: 'modules/*/knowledge/**', specs: ['interaction/knowledge.md'] },
  { pattern: 'modules/**', specs: ['system/skills.md', 'interaction/memory.md', 'interaction/conduct.md', 'interaction/fit.md'] },
  { pattern: 'data-sample/**', specs: ['data/sample.md', 'data/record.md'] },
  { pattern: 'policies/**', specs: ['legal/policies.md', 'interaction/safety.md', 'data/access.md'] },
  { pattern: 'ux/scripts/check-policies.mjs', specs: ['legal/policies.md', 'interaction/safety.md'] },

  // ── The read surface, one tab at a time ──────────────────────────────────
  { pattern: 'ux/app/(dashboard)/timeline/**', specs: ['ux/tabs/timeline.md'] },
  { pattern: 'ux/app/(dashboard)/journal/**', specs: ['ux/tabs/journal.md'] },
  { pattern: 'ux/app/(dashboard)/people/**', specs: ['ux/tabs/people.md'] },
  { pattern: 'ux/app/(dashboard)/therapy/**', specs: ['ux/tabs/therapy.md'] },
  { pattern: 'ux/app/(dashboard)/calendar/**', specs: ['ux/tabs/calendar.md'] },
  { pattern: 'ux/app/(dashboard)/loops/**', specs: ['ux/tabs/loops.md'] },
  { pattern: 'ux/app/(dashboard)/safety/**', specs: ['ux/tabs/safety.md', 'interaction/safety.md'] },
  { pattern: 'ux/app/(dashboard)/me/**', specs: ['ux/tabs/me.md'] },
  { pattern: 'ux/app/(dashboard)/about/**', specs: ['ux/tabs/about.md'] },
  { pattern: 'dev/ui/app/(admin)/workflow/**', specs: ['ux/tabs/workflow.md'] },
  { pattern: 'dev/ui/app/(admin)/changes/**', specs: ['ux/tabs/changes.md'] },
  { pattern: 'dev/ui/app/(admin)/specs/**', specs: ['ux/tabs/specs.md'] },
  { pattern: 'dev/ui/app/(admin)/harness/**', specs: ['ux/tabs/harness.md'] },
  { pattern: 'dev/ui/app/(admin)/hooks/**', specs: ['ux/tabs/harness.md'] },
  { pattern: 'dev/ui/app/(admin)/codemap/**', specs: ['ux/tabs/codemap.md'] },
  { pattern: 'dev/ui/components/codemap/**', specs: ['ux/tabs/codemap.md'] },
  { pattern: 'dev/ui/lib/code-map*.js', specs: ['ux/tabs/codemap.md'] },
  { pattern: 'dev/ui/app/(admin)/stack/**', specs: ['ux/tabs/stack.md'] },
  { pattern: 'dev/ui/components/stack/**', specs: ['ux/tabs/stack.md'] },
  { pattern: 'dev/ui/lib/tech-*.js', specs: ['ux/tabs/stack.md'] },
  { pattern: 'dev/ui/app/(admin)/agreements/**', specs: ['system/workbench.md'] },
  { pattern: 'dev/ui/app/(admin)/evals/**', specs: ['system/workbench.md'] },
  { pattern: 'dev/ui/lib/agreements.js', specs: ['system/workbench.md'] },
  { pattern: 'dev/ui/lib/evals.js', specs: ['system/workbench.md'] },
  { pattern: 'ux/app/(dashboard)/@rail/**', specs: ['ux/tabs/README.md', 'ux/design.md'] },
  { pattern: 'ux/app/(dashboard)/page.jsx', specs: ['ux/tabs/now.md'] },
  { pattern: 'ux/app/(dashboard)/**', specs: ['ux/purpose.md', 'ux/design.md'] },

  // ── The surface's own machinery ──────────────────────────────────────────
  { pattern: 'ux/app/login/**', specs: ['data/access.md', 'ux/perimeter.md'] },
  { pattern: 'ux/app/api/**', specs: ['ux/perimeter.md', 'data/access.md'] },
  { pattern: 'ux/app/globals.css', specs: ['ux/design.md'] },
  { pattern: 'ux/app/styles/**', specs: ['ux/design.md'] },
  { pattern: 'ux/app/prose.css', specs: ['ux/design.md'] },
  { pattern: 'ux/app/**', specs: ['ux/purpose.md', 'ux/design.md'] },
  { pattern: 'ux/components/**', specs: ['ux/design.md', 'ux/purpose.md'] },
  { pattern: 'dev/ui/lib/git.js', specs: ['ux/tabs/changes.md'] },
  { pattern: 'ux/lib/auth.js', specs: ['data/access.md', 'ux/perimeter.md'] },
  { pattern: 'ux/lib/data-dir.js', specs: ['data/sample.md', 'ux/perimeter.md'] },
  { pattern: 'ux/lib/spec-edit.mjs', specs: ['ux/tabs/specs.md', 'system/ARCHITECTURE.md'] },
  { pattern: 'ux/lib/harness*.js', specs: ['ux/tabs/harness.md'] },
  { pattern: 'ux/lib/**', specs: ['ux/perimeter.md', 'ux/purpose.md'] },
  { pattern: 'ux/scripts/sandbox.mjs', specs: ['data/sample.md'] },
  { pattern: 'ux/scripts/check-*.mjs', specs: ['system/safeguards.md'] },
  { pattern: 'ux/scripts/spec-*.mjs', specs: ['system/ARCHITECTURE.md', 'system/safeguards.md'] },
  { pattern: 'ux/scripts/**', specs: ['system/safeguards.md', 'ux/purpose.md'] },
  { pattern: 'ux/package.json', specs: ['system/deployment.md', 'system/safeguards.md'] },
  { pattern: 'ux/**', specs: ['ux/purpose.md'] },

  // ── Where it runs, and how it is stood up ────────────────────────────────
  { pattern: 'README.md', specs: ['system/deployment.md', 'system/dev.md', 'system/workbench.md'] },
  { pattern: '*.json', specs: ['system/deployment.md'] },
  { pattern: '.github/**', specs: ['system/deployment.md'] },
];

const toRegExp = (pattern) => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
};

const compiled = SPEC_MAP.map((entry) => ({ ...entry, re: toRegExp(entry.pattern) }));

/** Repo-relative, forward slashes. Returns spec paths below `dev/specs/`, most specific first. */
export function specsFor(path) {
  const clean = String(path).split(sep).join('/').replace(/^\.\//, '');
  const relPath = clean.startsWith(REPO.split(sep).join('/'))
    ? relative(REPO, clean).split(sep).join('/')
    : clean;
  const hits = [];
  for (const entry of compiled) {
    if (entry.re.test(relPath)) {
      for (const spec of entry.specs) if (!hits.includes(spec)) hits.push(spec);
    }
  }
  return hits;
}

/** Every register a path in the repository could be audited against. */
export function mappedSpecs() {
  return [...new Set(SPEC_MAP.flatMap((e) => e.specs))].sort();
}

// ── Run directly ───────────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const arg = process.argv[2];
  const specsDir = join(REPO, SPECS_DIR);

  // The map itself is code and reads nothing; only these two flags read the
  // registers, and a copy without the design has none to read (ARC-008).
  if ((arg === '--check' || arg === '--unmapped') && !existsSync(specsDir)) {
    console.log(`No registers in this copy (${SPECS_DIR}/ is absent): nothing to check.`);
  } else if (arg === '--check') {
    const missing = mappedSpecs().filter((s) => !existsSync(join(specsDir, s)));
    if (missing.length) {
      console.error(`Mapped to specs that do not exist:\n  ${missing.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`✅ ${SPEC_MAP.length} patterns → ${mappedSpecs().length} registers, all present.`);
  } else if (arg === '--unmapped') {
    // Loaded here, not at the top: the hooks import this map, and only this
    // flag walks a folder.
    const { walkFiles } = await import('../../../ux/lib/walk-skip.mjs');
    const all = walkFiles(specsDir, { names: new Set(), keep: (n) => n.endsWith('.md') }).map((full) => relative(specsDir, full).split(sep).join('/'));
    const mapped = new Set(mappedSpecs());
    // PRODUCT.md is deliberately unmapped: its rows are needs, delivered by rows
    // in other registers rather than by any file. It is audited by tracing each
    // need down to the rows that deliver it, never by reading a path.
    const orphans = all.filter(
      (s) => !mapped.has(s) && !/README\.md$|REFERENCES\.md$|^PRODUCT\.md$/.test(s),
    );
    console.log(orphans.length ? `No path maps to:\n  ${orphans.join('\n  ')}` : '✅ Every register is reachable from a path (PRODUCT.md is traced, not mapped).');
  } else if (arg) {
    const hits = specsFor(arg);
    console.log(hits.length ? hits.map((s) => `${SPECS_DIR}/${s}`).join('\n') : `Nothing maps ${arg}.`);
  } else {
    console.log('Usage: spec-map.mjs <path> | --check | --unmapped');
  }
}
