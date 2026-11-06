// Module resolution hooks for the dashboard's unit tests: what Next does for the
// app, so a lib/ module is imported by node's own test runner unchanged, with no
// bundler and no new dependency.
//
//   @/x       ux/x         (jsconfig.json's paths)
//   ./x       ./x.js       an import without its extension, as Next allows
//   x         a package from ux/node_modules, or, in the commit gate's snapshot
//             of the staged tree, which has none, the real repository's
//   x.js      an ES module, as Next reads it
//
// The dashboard's own copy, beside dev/ui/test/aliases.mjs: ux/ runs whole
// without dev/ (ARC-008), so it cannot borrow the admin app's.
// Registered by register.mjs; nothing else uses it.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const UX = new URL('../', import.meta.url);
const ENDINGS = ['', '.js', '.mjs', '/index.js'];

const fileFor = (url) => {
  const path = fileURLToPath(url);
  const found = ENDINGS.map((end) => `${path}${end}`).find((p) => existsSync(p) && statSync(p).isFile());
  return found && { url: pathToFileURL(found).href, shortCircuit: true };
};

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return fileFor(new URL(specifier.slice(2), UX)) ?? next(specifier, context);
  try {
    return await next(specifier, context);
  } catch (error) {
    if (/^\.\.?\//.test(specifier) && context.parentURL) {
      const found = fileFor(new URL(specifier, context.parentURL));
      if (found) return found;
    }
    if (/^[./]|^[a-z]+:/i.test(specifier)) throw error;
    // A package path without its extension (`next/headers`), as a bundler allows.
    const tries = /^(@[^/]+\/)?[^/@]+\/.+/.test(specifier) && !/\.\w+$/.test(specifier) ? [specifier, `${specifier}.js`] : [specifier];
    const roots = [new URL('package.json', UX).href];
    if (process.env.DEAR_GIT_ROOT) roots.push(pathToFileURL(join(process.env.DEAR_GIT_ROOT, 'ux', 'package.json')).href);
    for (const parentURL of roots) {
      for (const s of tries) {
        try {
          return await next(s, { ...context, parentURL });
        } catch {
          /* the next spelling, then the snapshot's packages */
        }
      }
    }
    throw error;
  }
}

// The app's .js files are ES modules to Next; package.json does not say so, so
// node would read them as CommonJS. Packages keep their own format.
export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.js') && !url.includes('/node_modules/')) return next(url, { ...context, format: 'module' });
  return next(url, context);
}
