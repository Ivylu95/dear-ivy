// DES-007: "Everywhere the surface names the person, the name is the one the
// record holds."
//
//   node scripts/check-shown-name.mjs     (in the commit gate and `npm run check`)
//
// On 2026-10-03 the profile chip showed the sign-in username, a credential in
// .env, beside a wordmark that read the record: two names for one person on one
// screen. The chip now takes `name` from getIdentity(). This fails if the account
// finds its way back onto the screen: the chip taking it as a prop, or the chip
// itself reading the session.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk-skip.mjs';

const ux = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => {
  if (!existsSync(dir)) throw new Error(`no ${dir}`);
  return walkFiles(dir, { names: new Set(['node_modules', '.next']), keep: (n) => /\.(m?js|jsx)$/.test(n) });
};

const problems = [];
const chip = readFileSync(join(ux, 'components', 'shell', 'Profile.jsx'), 'utf8');
if (/\baccount\b|sessionUser|SESSION_COOKIE/.test(chip.replace(/\/\/.*$/gm, ''))) {
  problems.push('components/shell/Profile.jsx reads the account or the session');
}
for (const file of [...walk(join(ux, 'app')), ...walk(join(ux, 'components'))]) {
  const text = readFileSync(file, 'utf8');
  if (/<Profile\b[^>]*\baccount=/.test(text)) {
    problems.push(`${relative(ux, file).replace(/\\/g, '/')} hands the account to the profile chip`);
  }
}

if (problems.length) {
  console.error(`\n  The name on screen is not the record's (DES-007):\n\n${problems.map((p) => `  - ${p}`).join('\n')}\n\n  Show the name getIdentity() reads; the username is a credential.\n`);
  process.exit(1);
}
console.log('  ok  shown name: the profile chip shows the record\'s name, never the account');
