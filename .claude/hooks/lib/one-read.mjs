// One read: every file outside the record stays short enough for an agent to
// read whole in one go (HYG-002, E-031's bounded-size, A-071). The line, the
// cut and the warning, in one place for every generator and check.
//
// The pattern is the Transcript's months (T-499, lib/transcript-parts.mjs): a
// generated file keeps its name as its first part, and its later parts follow
// as `<name>-2.<ext>`, `-3`…, each cut only between whole items and well short
// of the line, so every reader reads them in order as one. A generator cuts its
// own output here before it reaches the line; a hand-written file cannot, so
// the size check warns from WARN_LINES on, naming the file and how to split it,
// before it fails at ONE_READ.
//
// Only names and arithmetic here, never a read: a copy without dev/ still loads it (ARC-008).

/** The one-read line every tracked file outside the record stays at or under. Never raised. */
export const ONE_READ = 1000;
/** Where a generator cuts a part: short of the line, with room for a day's growth before it is cut again. */
export const PART_LINES = 900;
/** Where the size check starts warning about a hand-written file, before it fails at ONE_READ. */
export const WARN_LINES = 900;

/** Lines as the size check counts them. */
export const lineCount = (text) => String(text).split('\n').length;

/** Part n of a file: the file itself for 1, else `-n` before its extension (`a.md` → `a-2.md`). */
export function partPath(file, n) {
  if (n === 1) return file;
  const m = String(file).match(/^(.*?)(\.[^./]+)?$/);
  return `${m[1]}-${n}${m[2] ?? ''}`;
}

/** Whether `name` is part n > 1 of `file`, and which: 0 when it is not. */
export function partNumber(file, name) {
  const m = String(file).match(/^(.*?)(\.[^./]+)?$/);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hit = String(name).match(new RegExp(`^${esc(m[1])}-([2-9]|[1-9]\\d+)${esc(m[2] ?? '')}$`));
  return hit ? Number(hit[1]) : name === file ? 1 : 0;
}

/**
 * Items packed into parts, each part's text `render(n, items)` at most `limit`
 * lines, cut only between items and in order. An item too long alone still gets
 * a part of its own (the check then names it). Returns [[n, items]], at least one.
 */
export function packParts(items, render, limit = PART_LINES) {
  const out = [];
  let list = [];
  let n = 1;
  for (const item of items) {
    if (list.length && lineCount(render(n, [...list, item])) > limit) {
      out.push([n, list]);
      n += 1;
      list = [];
    }
    list.push(item);
  }
  out.push([n, list]);
  return out;
}

/** Files, as [{ path, lines }], at or past WARN_LINES and still within ONE_READ: the early warning. */
export const nearOneRead = (files, { warn = WARN_LINES, limit = ONE_READ } = {}) => files.filter((f) => f.lines >= warn && f.lines <= limit);

/** How to split a file near the line, by what it is. */
export function howToSplit(path) {
  if (/^dev\/specs\/.+\.md$/.test(path)) return 'move a group of rows, word for word, to a new register beside it (ux/scripts/spec-move.mjs), with its own prefix, and update the index, trace.md and the citations';
  if (/^dev\/dialogue\/transcript\//.test(path)) return 'run node ux/scripts/dialogue.mjs split (T-499)';
  if (/\.(?:mjs|js|jsx|ts|tsx)$/.test(path)) return 'move a self-contained part into a module beside it, imported back, as dialogue-views.mjs was from dialogue.mjs';
  if (/\.css$/.test(path)) return 'move one component\'s rules to a stylesheet of their own, imported where this one is';
  if (/\.jsonl?$/.test(path)) return `have its writer start a new part, ${partPath(path.split('/').pop(), 2)}, before this one passes ${PART_LINES} lines (lib/one-read.mjs)`;
  return `cut it at a heading into parts, ${partPath(path.split('/').pop(), 2)} beside it, and link each from the first`;
}
