#!/usr/bin/env node
// Brings this machine and the remote into agreement, in one step.
//
// WKB-015, "The developer can bring every copy of the repository into agreement in
// one step." Run by the git-reconcile skill, for the developer or for an agent; never
// by a hook. The work is .claude/hooks/lib/branches.mjs, shared with the session-start
// prune (DEP-011) so the two can never clear branches by different rules.
//
//   npm run git:reconcile            fix what is safe, list the rest
//   npm run git:reconcile -- --dry   only say what it would do

import { reconcile } from '../../.claude/hooks/lib/branches.mjs';

const dry = process.argv.includes('--dry');
const { fixed, left, notes } = reconcile(process.cwd(), { dry });

console.log(dry ? 'Would fix:' : 'Fixed:');
console.log(fixed.length ? fixed.map((f) => `  - ${f}`).join('\n') : '  nothing needed');
console.log('\nLeft as is:');
console.log(left.length ? left.map((l) => `  - ${l.what}\n    why: ${l.why}\n    to settle: ${l.command}`).join('\n') : '  nothing');
if (notes.length) console.log(`\nOn GitHub:\n${notes.map((n) => `  - ${n}`).join('\n')}`);
console.log(left.length ? '\nNot yet in full agreement: each item above says what settles it.' : '\nIn agreement: main matches GitHub and nothing is left over.');
