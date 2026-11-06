// Rule test for linkPackages in lib/worktree-packages.mjs: a linked worktree with no ux/node_modules
// borrows the main checkout's, so the commit gate's checks find their packages
// (3 to 4 Nov: every worktree agent's first commit was refused on react, next,
// marked and js-yaml until its brief said to link them). Run by selftest.mjs.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { makeTemp } from './temp-litter.mjs';
import { linkPackages, mainCheckout } from './worktree-packages.mjs';

const dir = realpathSync(makeTemp('dear-worktree-packages-'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const main = join(dir, 'main');
mkdirSync(join(main, 'ux'), { recursive: true });
git(main, 'init', '-q', '-b', 'main');
writeFileSync(join(main, 'ux', 'package.json'), '{"name":"ux","private":true}\n');
writeFileSync(join(main, '.gitignore'), 'node_modules\n');
git(main, 'add', '.');
git(main, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
// The main checkout's install: one package the gate's checks would load.
mkdirSync(join(main, 'ux', 'node_modules', 'fake-pkg'), { recursive: true });
writeFileSync(join(main, 'ux', 'node_modules', 'fake-pkg', 'package.json'), '{"name":"fake-pkg","main":"index.js"}\n');
writeFileSync(join(main, 'ux', 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 42;\n');
const wt = join(dir, 'wt');
git(main, 'worktree', 'add', '-q', '-b', 'side', wt);

const load = (root) => {
  try {
    return createRequire(join(root, 'ux', 'package.json'))('fake-pkg');
  } catch {
    return null;
  }
};

// The incident: in the worktree the package is not found where the gate looks.
assert.equal(load(wt), null, 'a fresh worktree has no packages where the gate looks');
assert.equal(realpathSync(mainCheckout(wt)), main, 'a worktree knows its main checkout');
assert.equal(mainCheckout(main), null, 'the main checkout is no worktree');

// The fix.
const made = linkPackages(wt);
assert.ok(made && lstatSync(made).isSymbolicLink(), 'the worktree gets a link');
assert.equal(realpathSync(readlinkSync(made)), join(main, 'ux', 'node_modules'), 'to the main checkout\'s install');
assert.equal(load(wt), 42, 'and the package is found through it');
assert.equal(linkPackages(wt), null, 'a second run leaves the link as it is');
assert.equal(linkPackages(main), null, 'the main checkout is left as it is');

// A worktree with its own install keeps it; a main with none lends nothing.
const own = join(dir, 'own');
git(main, 'worktree', 'add', '-q', '-b', 'own', own);
mkdirSync(join(own, 'ux', 'node_modules'));
assert.equal(linkPackages(own), null, 'a worktree with its own install keeps it');
assert.ok(!lstatSync(join(own, 'ux', 'node_modules')).isSymbolicLink(), 'its folder is untouched');
const bare = join(dir, 'bare');
mkdirSync(join(bare, 'ux'), { recursive: true });
git(bare, 'init', '-q', '-b', 'main');
writeFileSync(join(bare, 'ux', 'package.json'), '{}\n');
git(bare, 'add', '.');
git(bare, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
const bareWt = join(dir, 'bare-wt');
git(bare, 'worktree', 'add', '-q', '-b', 'side', bareWt);
assert.equal(linkPackages(bareWt), null, 'a main checkout with no install lends nothing');
assert.ok(!existsSync(join(bareWt, 'ux', 'node_modules')), 'and no dangling link is made');

// The link out first, so the folder's clearing never follows it (a junction on Windows would).
unlinkSync(made);
assert.ok(existsSync(join(main, 'ux', 'node_modules', 'fake-pkg')), 'taking the link out leaves the install');

console.log('worktree packages: a linked worktree borrows the main checkout\'s install; its own install, the main checkout and a main with none are left alone');
