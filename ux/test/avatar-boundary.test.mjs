// DSH-002, "What they made is never read back as their account": the single
// exception to the read-only surface (DSH-001) is her picture, and it stays
// narrow. Read from the sources, so a second write, a second write route, or a
// path that reads the picture as words fails here before it ships.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_TYPES, saveAvatar } from '@/lib/avatar';

const ux = join(import.meta.dirname, '..');
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const sources = ['app', 'components', 'lib']
  .flatMap((d) => walk(join(ux, d)))
  .filter((f) => /\.(js|jsx|mjs)$/.test(f))
  .map((f) => ({ rel: relative(ux, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }));
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// lib/spec-edit.mjs is the developer's spec tooling, run from scripts, never by the app.
const WRITES = /\b(writeFile|writeFileSync|appendFile|appendFileSync|renameSync|rename|unlink|unlinkSync|rm|rmSync|copyFile|copyFileSync|createWriteStream)\b/;

// Every way a route module can export a write verb: a function, an async
// function, a const or let arrow, or a re-export list. The first form alone
// would let `export const POST = async () => {}` pass as no route at all.
const WRITE_VERB = /export\s+(?:(?:async\s+)?function\s*\*?\s*|(?:const|let|var)\s+)(POST|PUT|PATCH|DELETE)\b|export\s*\{[^}]*\b(POST|PUT|PATCH|DELETE)\b[^}]*\}/;

describe('her picture is the one thing the surface writes (DSH-002)', () => {
  test('no file in the app writes to disk except lib/avatar.js', () => {
    const writers = sources
      .filter((s) => s.rel !== 'lib/avatar.js' && s.rel !== 'lib/spec-edit.mjs' && WRITES.test(code(s.text)))
      .map((s) => s.rel);
    assert.deepEqual(writers, []);
  });
  test('only the avatar route writes the record; the other POSTs write no file', () => {
    const verbs = WRITE_VERB;
    const routes = sources.filter((s) => s.rel.startsWith('app/') && verbs.test(s.text)).map((s) => s.rel);
    assert.deepEqual(routes.sort(), [
      'app/api/avatar/route.js',
      'app/api/login/route.js',
      'app/api/logout/route.js',
      'app/api/record/route.js',
    ]);
  });
  test('the write-verb detector sees every way of exporting one', () => {
    for (const text of [
      'export async function POST(req) {}',
      'export function DELETE() {}',
      'export const POST = async () => {};',
      'export let PUT = handler;',
      'export { handler as PATCH, handler as GET };',
      'export { POST } from "./elsewhere";',
    ]) assert.match(text, WRITE_VERB, text);
    assert.doesNotMatch('export async function GET() {}', WRITE_VERB);
  });
  test('the API holds exactly the five known route files', () => {
    const routeFiles = sources.filter((s) => /^app\/api\/.+\/route\.js$/.test(s.rel)).map((s) => s.rel).sort();
    assert.deepEqual(routeFiles, [
      'app/api/avatar/route.js',
      'app/api/login/route.js',
      'app/api/logout/route.js',
      'app/api/record/route.js',
      'app/api/watch/route.js',
    ]);
  });
  test('the avatar route takes no file name or path from the request', () => {
    const route = sources.find((s) => s.rel === 'app/api/avatar/route.js').text;
    assert.doesNotMatch(code(route), /searchParams|params\.|formData\(\)[\s\S]*?\.get\((?!'avatar')/);
  });
});

describe('what she made is never words she said (DSH-002)', () => {
  test('only inert picture formats are accepted, never text, markdown or SVG', () => {
    assert.deepEqual(Object.keys(AVATAR_TYPES).sort(), ['gif', 'jpg', 'png', 'webp']);
    for (const type of Object.values(AVATAR_TYPES)) assert.match(type, /^image\/(png|jpeg|webp|gif)$/);
  });
  test('markdown or script bytes are refused before anything is written', () => {
    const text = Buffer.from('# Dear me\n\nSomething I said, long enough to pass the length floor.\n');
    assert.deepEqual(saveAvatar(text), { ok: false, error: 'unsupported' });
  });
  test('no reader of the record opens the folder the picture lives in', () => {
    const readers = sources
      .filter((s) => /^lib\/(content|content-read|read\/)/.test(s.rel) && s.rel !== 'lib/avatar.js')
      .filter((s) => /['"`/]assets['"`/]/.test(code(s.text)))
      .map((s) => s.rel);
    assert.deepEqual(readers, []);
  });
  test('the picture is reached only through the avatar module, as a stamp or bytes', () => {
    const users = sources.filter((s) => s.rel !== 'lib/avatar.js' && /['"]@\/lib\/avatar['"]/.test(s.text));
    for (const u of users) {
      const imported = [...u.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/avatar'/g)]
        .flatMap((m) => m[1].split(',').map((n) => n.trim()).filter(Boolean));
      for (const name of imported) {
        assert.ok(
          ['avatarStamp', 'findAvatar', 'readAvatarBytes', 'saveAvatar', 'removeAvatar', 'MAX_BYTES', 'AVATAR_TYPES'].includes(name),
          `${u.rel} imports ${name}`,
        );
      }
    }
  });
});
