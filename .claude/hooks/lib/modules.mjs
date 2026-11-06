// The one reader of modules/ (ARC-006). Every consumer — the blank-record build,
// the dashboard, the link check, the sample check, the module loader — asks
// here, so a module dropped into modules/ is seen the same way by all of them.
//
// A module is a folder under modules/ with a module.json:
//
//   data      its folder in the record, data/<data>/. Defaults to the module's
//             name. Everything the module keeps lives under it.
//   root      core only: templates for the record's root, which belongs to the
//             harness — README.md, PROFILE.yaml, safety/, archive/. Keyed
//             template → path under data/.
//   standing  template → path under data/<data>/. Files every record starts with.
//   growing   folders under data/<data>/ that fill one file per entry.
//   router    rows for the session router: { she, skill, must }. `must` is what
//             holds even if the skill never loads.
//   views     dashboard routes this module owns: { "/route": "Label" }.
//
// A module that also carries .claude-plugin/plugin.json is a Claude Code plugin:
// its skills/ load from inside the module, namespaced <module>:<skill>, through
// the local marketplace that ux/scripts/modules.mjs generates. core is not a
// plugin — its skills stay in .claude/skills/, always loaded, because the
// everyday session and the safety floor must not depend on a plugin loading.
//
// No dependencies, like everything under hooks/: this runs before anything is
// installed.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/** Only core may write outside its own folder, and only to the record's root. */
export const ROOT_OWNER = 'core';

/**
 * core's folder in the record, data/core/. Named here once because code that
 * runs before any manifest is read — the session hooks, the dashboard — reads
 * core's files by path; `manifestProblems` holds core's module.json to it.
 */
export const CORE_DATA = 'core';

// Where core's timeline entries are, once split. CLAUDE.md splits them into one file a
// year past ~300 rows and leaves the Eras in timeline.md, in core's own folder,
// `data/core/timeline/YYYY.md`; it once named `data/timeline/YYYY.md`. Both are read, so a split
// done either way is never taken for an empty timeline: after one, the session brief once
// saw no dated line and opened FIRST CONTACT over a full record (round 3 of the set-up
// edge cases, D14).

/** timeline.md first, then every year file, oldest year first, from both split folders. */
export function timelineFiles(dataDir) {
  const years = [];
  for (const dir of [join(dataDir, CORE_DATA, 'timeline'), join(dataDir, 'timeline')]) {
    try {
      for (const f of readdirSync(dir)) if (/^\d{4}\.md$/.test(f)) years.push({ year: f, path: join(dir, f) });
    } catch {
      // no split folder here
    }
  }
  years.sort((a, b) => a.year.localeCompare(b.year));
  return [join(dataDir, CORE_DATA, 'timeline.md'), ...years.map((y) => y.path)];
}

/** The text of every timeline file, joined, read with the caller's `read` (a missing file reads ''). */
export const timelineText = (dataDir, read) => timelineFiles(dataDir).map((p) => read(p)).join('\n');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * Every module under `repoRoot/modules/`, sorted by name, core first.
 * `shapes` is every blank shape resolved to its path under data/:
 * `[templateRelToRepo, pathRelToData]`, and `grows` every growing folder
 * relative to data/.
 */
export function readModules(repoRoot) {
  const base = join(repoRoot, 'modules');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, 'module.json')))
    .map((e) => {
      const name = e.name;
      const dir = join(base, name);
      const manifest = readJson(join(dir, 'module.json'));
      const ns = manifest.data ?? name;
      const src = (from) => posix.join('modules', name, from);
      const shapes = [
        ...Object.entries(manifest.root ?? {}).map(([from, to]) => [src(from), posix.normalize(to)]),
        ...Object.entries(manifest.standing ?? {}).map(([from, to]) => [src(from), posix.join(ns, to)]),
      ];
      const pluginPath = join(dir, '.claude-plugin', 'plugin.json');
      return {
        name,
        dir,
        data: ns,
        manifest,
        shapes,
        grows: (manifest.growing ?? []).map((f) => posix.join(ns, f)),
        router: manifest.router ?? [],
        views: manifest.views ?? {},
        plugin: existsSync(pluginPath) ? readJson(pluginPath) : null,
      };
    })
    .sort((a, b) => (a.name === ROOT_OWNER ? -1 : b.name === ROOT_OWNER ? 1 : a.name.localeCompare(b.name)));
}

const holdsFile = (dir) =>
  readdirSync(dir, { withFileTypes: true }).some((e) => e.isFile() || (e.isDirectory() && holdsFile(join(dir, e.name))));

/**
 * Folders at the top of a record that no module owns and that hold a file: what
 * a session still on old code writes after a module or its folder is renamed
 * (2026-11-06: blank copies came back at data/nutrition/ after it became
 * data/fitness/). Owned: each module's data folder, the root's own folders
 * (safety/, archive/, from core's "root"), and archive-local/, kept off GitHub.
 */
export function strayFolders(dataDir, modules) {
  if (!existsSync(dataDir)) return [];
  const owned = new Set(['archive', 'archive-local', ...modules.map((m) => m.data)]);
  for (const m of modules) for (const to of Object.values(m.manifest.root ?? {})) if (to.includes('/')) owned.add(posix.normalize(to).split('/')[0]);
  return readdirSync(dataDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !owned.has(e.name) && holdsFile(join(dataDir, e.name)))
    .map((e) => e.name)
    .sort();
}

/** What is wrong with a module's manifest, as sentences. Empty when it is sound. */
export function manifestProblems(mod) {
  const problems = [];
  if (mod.manifest.root && mod.name !== ROOT_OWNER) problems.push(`${mod.name}: only ${ROOT_OWNER} may declare "root"`);
  if (mod.name === ROOT_OWNER && mod.data !== CORE_DATA) problems.push(`${mod.name}: "data" must be "${CORE_DATA}"`);
  if (!/^[a-z][a-z0-9-]*$/.test(mod.data)) problems.push(`${mod.name}: "data" must be one lowercase folder name`);
  for (const [, to] of mod.shapes) if (to.startsWith('..')) problems.push(`${mod.name}: ${to} escapes data/`);
  if (mod.plugin && mod.plugin.name !== mod.name) problems.push(`${mod.name}: plugin.json name "${mod.plugin.name}" differs from the folder`);
  for (const row of mod.router) {
    if (!row.she || !row.skill || !row.must) problems.push(`${mod.name}: a router row needs she, skill and must`);
  }
  return problems;
}
