// No harness example is a name anyone is called: a test of the privacy check's
// ground (check-privacy.mjs, ARC-004), claimed with it.
//
//   node scripts/test-example-names.mjs              (runs as part of `npm run check`)
//   node scripts/test-example-names.mjs --hash <word> the hash to add for a new name
//
// The privacy check refuses any harness file holding a name from the copy's own
// record. Examples written here with common first names, in a comment, a test,
// the dashboard's fixtures or the invented record, stopped any copy whose owner
// or her people shared one: a file that came with the download, which no one in
// her copy wrote (dev/skills/set-up/cases.md, 2026-10-27, "a name of hers that
// matches an invented example stops the copy"). The developer chose placeholders
// over loosening that check, so examples are `Person-B`, `person-b.md`, never a
// name; this keeps them so.
//
// Two rules, each first proven on a tree made for it (SFG-007 design 5), then
// run over this repository:
//
//   NAMES    No word in a harness file is a common first name, or one of the
//            examples retired for this. The list is held as hashes, and the
//            planted names are assembled at run time, so this file names no
//            one: a list in plain words would be the very collision it guards
//            against. Words are compared whole and lowercased, as the privacy
//            check compares them.
//   SAMPLE   The invented record's people are `person-<letter>` and its owner
//            `Person-<letter>`, so a name can never be added there unnoticed.
//
// A clean run is not proof: no list holds every name. It keeps the ones that
// were here from coming back, and the commonest from arriving.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileName } from '../../.claude/hooks/lib/profile-schema.mjs';
import { readPeople } from '../../.claude/hooks/lib/people.mjs';
import { CORE_DATA } from '../../.claude/hooks/lib/modules.mjs';
import { harnessFiles } from './check-privacy.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

/** The hash a name is listed by: the first 16 hex of SHA-256 over the lowercased word. */
export const nameHash = (word) => createHash('sha256').update(String(word).normalize('NFC').toLowerCase()).digest('hex').slice(0, 16);

// Common first names, and the examples renamed on 2026-10-27. Add one with --hash.
// prettier-ignore
const NAMES = new Set(`
a50128d59f482a86 02b6bb0bd1c5831b df955c5275aecee4 d7ce1c3c7a236929 8c72d75f09108721 b1e3c2ec1a80a8cc
5705a82920cee05c 03cdf3e00e74fb35 e96e02d8e47f2a7c 49915e0d7d4b402e b6e1557a1ed3900d 24d4b96f58da6d4a
78f8d5941ef4029d 1b2fc9341a16ae4e d994e1d001886fe5 2752b88686847fa5 e396363791cf28ee 8f09a8c7679ad321
3c38aafb0579dafe 2c9e0a2585dc7406 7717a57ec3d7fb93 2bd806c97f0e00af 4d1e58c90b3b94bc d233633d9524e84c
39fdbdb8ddf75a00 3614f7e180d90005 81c52b4457b49665 f7f376a1fcd0d0e1 c23ad6f184120146 37742e00d990d888
e4bb33e05498befc 3bf8fd1a8fc44d4a 9e691cc3bf80c449 db42328112177c2d 72d0166b5707d129 4135aa9dc1b842a6
7764735c5d4d88ae 9f2a08fde416cef2 c80194cefba53b4a 40fcacc47f46aabd ecd18c6a66631988 52e8e47b38e85458
f0d9991c5e47e0d2 1574ad62d48a37f8 1906bc7c801f03c4 5f3d6952c5c5e220 d979885447a413ab 6177321eac992341
79a6a933dfc9b197 55579b557896d0ce 90b8de4051f02b7a 71be92cbdfe91357 502913bfdd49eab5 fa4f7155e110eac1
befa156f0283eb00 bf446ea38129b6f1 99c215a550764c27 4da860a59a46e88c 07356e8a472bca7e 7904841598a49a87
8ee9938e4b960a50 dc814a25c3ae905a 6bf3d7f77d878d88 af7c752bf81f575e 061b67d6e7ab579d e31d426b5d3ff725
e4d6dc0f6e2842e9 69ff8042237aeef5 f3fe5a51a2be8c6d b6564e12882d39b1 6fef2d9315ca9bc3 17fc19d5d0ffa46d
813a0c3c8e054214 8813d406421e0063 7b85175b455060e3 4c26d9074c27d89e 05c5f6ef21bb02be 9d82529905cccc37
10fe82adb964fa73 b9dd960c1753459a 4a2b5e1822ca1158 ec5c41c127a484eb 5d7f15f2fce8ddb2 5e608d7beca7513c
9d0c52ae7023170c c4cf94e75b6067e8 7814459b3f23f455 4c1001c251c1c923 cc0b8a95a883bc0b 3910df2fbded4510
bd3dae5fb91f88a4 668e2b73ac556a2f 27223b82963b3a8f 61ea0803f8853523 07d046d5fac12b3f 591e94c45b4cb95d
548a39619a812e45 bb647e29b3433407 1b6d6d8b061bfd14 ab3a903f4bc80a35 ed62c6fd9f1b9900 69db31976ead37b8
e5a726a3cf969c02 c898ab690b82d903 c0e7aec81a1a194e 3b9d8298f1b5086d 2632ec06e2c2e54a 59cea62bbdfb4dc0
befd812b4e37a441 cd0299854a830cfd 0ce93c9606f0685b 288aa2a8991efe00 b54f08623ae4039f fb2cb45b6b443241
027434cce1114811 a1f478977aa8f3ff e8e9689deac5bac9 f4aa0655cdb8d4fc 6f9edcd3408cbda1 7cbccb0c4caadf9f
7b8bd6c0abf53d22 02b15ef87562676a 44e5bf55761da563 10c932ece8048a73 4c0db82499ca9a6d 46b6f0ae97088f72
404d5354e1c63780 d73aa61655f9a19f ff06535ac1029cca 21dfc18dd04cd6a3 3fb22a5597fb91ee 0522a55e2d5f0993
21aafe2f10e974a8 030923893f54c3d0 38bc14a268a3da3e 0d2c690e7dd5f947 a0fd0fa62fe7fa30 4b325568e344db63
fc881aa34d44660e 0a348ac4d94f9da0 f1c072414387df13 df46219531cb5d52 80c95d0e9e710a56 927a3aed189d610b
0478721f1106c2a6 1fd6227a46521189 eb5094069f5e287a da2da8e71c82b18a c15e1d9e72274cba cd0b9452fc376fc4
ae50ad81a2d4006e c35d6aaf3b3885df e7a4477ec945697c 81f8f6dde88365f3 0c081477c9bcc99e 06b9a6eacd7a77b9
6d1c5859550824d4 2e0b8d61fa2a6959 c24762dad798ed1a 239127e09157cbaf 9ce8db922a8f4a7a 73ecb4b9d82c620a
00f2e65596ab8c19 e1fc45f7880e0505 d2dae6d1b4625413 ecbd105358e381d7 78675cc176081372 96d9632f363564cc
d808cfd66215b9ca bb472edb86809a76 628612b803c647a7 1ec4ed037766aa18 7ee8118150e0ce02 386a85d8c88778b0
fc52fabe94c0e037 005195352c13e184 ed08c290d7e22f7b 71db428976f15f4f d277670919a94ba3 ce0fee7e61f9c74f
b025079c90813d46 102cf10b5286bad9 904294d8c54b1c63 2c249473aa501c43 3460eb8087523e19 745cc9f7c761ae00
a4e463d7dec930ea 4ca6f6d5a544bf57 85f5e10431f69bc2 bb44bf07cf9a2db0 5d702eb07928ed7b b918c3f9116ce3a6
2db317222c996b63 1534cf2af76ecd84 f73137d930c31d18 40903c59d19feef1 6bab3007f56e2a91 d84fe7e07bedb227
df1a2933b9872d13 47acf82a48cfa5c3 5f16795c54ab7de4 eee9e0172bbf5a80 7cadab457ad8d811 dc99e9aa86fab83a
cccf52f3d03c5072 358a3cd454c38404 aae5be5f6474904b 94aec9fbed989ece c6d17a3613b9914e 7dbef27a673fea64
6915771be1c5aa0c 68be7550846ecd87 a95db5b0ac159e43 68d85a0a124d90d9 8def3bf5d78abb24 a6ae07ad556c5f93
34550715062af006 01621148306fc8fb 13adffea089b5090 f6f7e983afc59354 ca0b642ed0c1c990 dbaf86dd80e3bcd5
1d78b370ad96e7a8 46c4c923178acf98 cd879f74c6ffe6e4 d2653ff7cbb2d8ff 4bbfa1f1b0462b48 c9ae5a10ae8824d7
a5c299e2fdd21869 cf3a3bbe331c3950 b21ec07effd3fe30 7dfef7aed2105b7e b2471d941bf88836 21297e6e966afbd0
f5a1971c2ef02a5a b8746e3fc5eb4f3d cbbcacaf0d582e76 d86dc6e60b0632e3 23ddda4810068cc4 0c086cdc772aa579
026ad9b14a7453b7 b026bccaaff344ac 899e468e1413205f 64c675d19da904ce 44bcff24eb6751fd 972964b66bdfe6b5
af4a400a2ceb7963 2c3827a002d7a48c 372fb41298889bc4 6bdf0b2dfc2e0221 61bffea9215f6516 4007d46292298e83
4387134784cf3aa4 dcd79ebce907b98a 6a61eb7383e868f2 ef2af8d7a9663b18 e0e3a2b6471d044a 97897a111d485af1
c5422c052bfbd7bb 90cc33a41b541af2 83ed5207a4117960 3a6d64c24cf80b69 12a303c224c250d0 2d1d92b1f4cc7fd3
56e1239485139d3d 4c2af77ab7d1edff 0a5d17d3b19f82f8 86846e84f9bfb205 fc5a299cd6cd644f 5e0176c9d2070a5a
f9860d4c1fe72330 267eed33dc459584 f148389d080cfe85 7deead025aea61ac b78469618fb15871 b587ba7df64e6fc3
9e88b067408182d0 7134aac53eddcc48 1cf8531a22348eeb d38681074467c0bc 193d3043e029a9f9 d148bfa1bbe1ce46
a10089eeb0bd6b43 fb0f00141e6ce1ae 044f4b3501cd8e81 e9e326d5f3b4741f b1efc77a39364d74 a2114e464a6b5670
ab1cb712f2dca756 65c3f75641b22925 962cd22346a772be a95dc4e899ac156e d5e7d945ccf8829e 1a637788c9e469bd
9d017e2681b7f317 86e68363a3da0c8a 82d67710b3e2d59a b52c75123406063a 10b5a5146d49b0e8 ba8b3393947777fa
950771ddde4e2816 177b773d483d3fe5 a7ad5342de24cf9a 260f43c2851ddb8e 55d9bf4f187ef3f9 259dbe8cfc8c4e77
d7ebc9cfd9f1b9f4 2dc899c8e59c150e 443721509b79d08a db30c4677e7c26fe 8e195c4a0f8cf5a1 9c804f2550e31d8f
4894d50eed4fc7c9 d5a5d66b94e8da0c 7c8ccc86c11654af e4c2eed8a6df0147 d70f47790f689414 254835d73cc88095
34ddf679b4b0ed44 00e48a815525529b 6326e0e8cfdaab9a 26079e41910bcde0 57f62077f2be1597 87789fc21897702e
ec6b64f31af43e90 effdb4e5ce2a7e4f d41dc6385e804fd6 b35eed2559a1f798 3b1b8dff699fbcb1 e798f61c76f63ea7
1372c63b35ea72a5 4cfbf05e4493d171 c9197fb972feabb8 47cd7dd52abc74f7 d4595ee7d9bca0d6 a5cd1d7cbdd49c27
b1cc53f5f6e82099 5c97b89159ff8b70 cefdb23cf2ce0d0f 93ca779659f5e42e cafb41334d62257c 1d3be47532e45748
76c32abc03629dd0 04df7707fcfebae5 898a544621959e0e cc967443070ab409 2eb4e402831c134c b18aaa6c6b929b86
79063e8037fff16d a34530c30dec412c 36033babfb48ec64 c9affe7f758723c3 33939d07e25f54e6 3fa987493ca3ccfc
97bdac9cc3df255a d7f8303ddd44fa7f 0df89317e0253590 a38933a27dad50fd 88bf31488ddf9d2f b811f03f712c066b
599ba25a0d7c7d67 8444da51ab98379d b11c8e067932c333 70c64570680ddcef 175fe25e87635a04 4b7bb8c301065be3
021fb044d1c216bc 6c344a9f30f57d35 0962ef04822f8ca5 60fd844475d56a9d 56f09d7fa9eb77b9 a03ea09072d789ad
9b89025ce7a6d932 0a9a9cb69fd7c2dd a3dbe29f1bb15c00
`.split(/\s+/).filter(Boolean));

// Real people and real things that share a name with someone, each with why it
// stays. A file listed without hashes is exempt whole; with them, only for those.
const ALLOWED = [
  { path: 'dev/dialogue/', why: "the developer's own words, kept verbatim" },
  { path: '.claude/hooks/state/', why: "this machine's hook state, untracked, copied from files read here" },
  // Its persona names grow with each run, and the policy is the safety core's.
  { path: 'policies/SAFETY_POLICY.md', why: "the safety benchmark's own persona names, quoted in its results" },
  // Read since .tsv joined the privacy check's files (A-155, 2026-11-01); never edited (its SOURCE.md).
  { path: 'dev/skills/safety-eval/vera-mh/personas.tsv', why: "the vendored safety benchmark's own invented personas" },
  { path: 'dev/specs/REFERENCES.md', hashes: ['34550715062af006'], why: 'cited authors' },
  { path: 'dev/skills/bright-spots/log.md', hashes: ['0a9a9cb69fd7c2dd'], why: 'a cited author' },
  { path: 'dev/projects/mission-driven-dev/notes/human-logic.md', hashes: ['3460eb8087523e19', 'd808cfd66215b9ca'], why: "cited sources' URLs" },
  { path: 'dev/skills/supplements/evals.json', hashes: ['96d9632f363564cc'], why: "a herb's common name" },
  { path: 'ux/lib/everyday-names.json', hashes: ['96d9632f363564cc'], why: "the privacy check's reviewed everyday phrases: a herb's common name" },
];

const allowed = (rel, hash) =>
  ALLOWED.some((a) => (a.path.endsWith('/') ? rel.startsWith(a.path) : rel === a.path) && (!a.hashes || a.hashes.includes(hash)));

const WORD = /(?<![\p{L}\p{M}\p{N}_])[\p{L}\p{M}]+(?![\p{L}\p{M}\p{N}_])/gu;

/**
 * Each finding one line. Reads the harness files the privacy check reads, and
 * the invented record's people and profile.
 */
export function checkExampleNames(root) {
  const findings = [];
  for (const file of harnessFiles(root)) {
    const rel = relative(root, file).replace(/\\/g, '/');
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const seen = new Set();
    for (const [word] of text.matchAll(WORD)) {
      const lower = word.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      const hash = nameHash(lower);
      if (NAMES.has(hash) && !allowed(rel, hash)) {
        findings.push(`${rel} uses "${word}", a first name: write a placeholder (Person-B, person-b.md) instead`);
      }
    }
  }

  const sample = join(root, 'data-sample');
  if (existsSync(sample)) {
    for (const { slug } of readPeople(join(sample, CORE_DATA, 'people')).people) {
      if (!/^person-[a-z]$/.test(slug)) findings.push(`data-sample/${CORE_DATA}/people/${slug}: an invented person is person-<letter>, never a name`);
    }
    const profile = join(sample, 'PROFILE.yaml');
    const own = existsSync(profile) ? profileName(readFileSync(profile, 'utf8')) : '';
    if (own && !/^Person-[A-Z]$/.test(own)) findings.push(`data-sample/PROFILE.yaml: the invented owner is Person-<letter>, never a name ("${own}")`);
  }
  return findings;
}

if (process.argv[2] === '--hash') {
  for (const word of process.argv.slice(3)) console.log(`${nameHash(word)}  ${word}`);
  process.exit(0);
}

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

// A retired example and a common name, never written whole here.
const RETIRED = ['Ju', 'no'].join('');
const COMMON = ['Sa', 'rah'].join('');
const PROFILE = (name) => `mandatory:\n  name:\n    value: ${name}\n    status: answered\n`;
const tree = (files) => {
  const root = makeTemp('dear-example-names-');
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
};
const has = (findings, file, what) => findings.some((f) => f.startsWith(file) && f.includes(what));

const roots = [];
try {
  const clean = tree({
    'data-sample/PROFILE.yaml': PROFILE('Person-J'),
    'data-sample/core/people/person-b.md': '# Person-B\n\nA friend from the pottery class.\n',
    'data-sample/core/people/person-e/README.md': '# Person-E\n',
    'README.md': '# Dear\n\nAsk how Person-B is doing; see `people/person-b.md`.\n',
    'ux/lib/x.js': `// hash 0${RETIRED.toLowerCase()}9 and reis_${COMMON.toLowerCase()} are not words\n`,
    // Her record is never read: a name there is the point of it.
    [`data/core/people/${COMMON.toLowerCase()}.md`]: `# ${COMMON}\n`,
  });
  roots.push(clean);
  check('placeholders pass, and a name only inside a hash or after an underscore is not a word', checkExampleNames(clean).length === 0);

  const leaky = tree({
    'data-sample/PROFILE.yaml': PROFILE(RETIRED),
    [`data-sample/core/people/${RETIRED.toLowerCase()}.md`]: '# x\n',
    'data-sample/core/people/person-b.md': '# Person-B\n',
    '.claude/hooks/lib/people.mjs': `// e.g. \`${COMMON.toLowerCase()}.md\`\n`,
    'ux/test/fixture.test.mjs': `const name = '${RETIRED}';\n`,
    'data-sample/core/timeline.md': `2026-01-02 · lunch with ${COMMON}'s sister\n`,
    'dev/dialogue/transcript/2026-10.md': `> ${COMMON} said so\n`,
    'dev/evals/cards/E-001.md': `As ${COMMON.toUpperCase()}, I ask\n`,
  });
  roots.push(leaky);
  const findings = checkExampleNames(leaky);
  check('a common name in a code comment is found, lowercased as a file name', has(findings, '.claude/hooks/lib/people.mjs', 'first name'));
  check('a retired example in a test is found', has(findings, 'ux/test/fixture.test.mjs', 'first name'));
  check('a name in the invented record is found, before a possessive', has(findings, 'data-sample/core/timeline.md', 'first name'));
  check('a name in capitals is found', has(findings, 'dev/evals/cards/E-001.md', 'first name'));
  check('the invented owner must be Person-<letter>', has(findings, 'data-sample/PROFILE.yaml', 'Person-<letter>'));
  check('an invented person must be person-<letter>', findings.some((f) => f.includes('person-<letter>') && f.includes(RETIRED.toLowerCase())));
  check('a placeholder person is not a finding', !findings.some((f) => f.includes('people/person-b')));
  check("the developer's own words are left as said", !findings.some((f) => f.startsWith('dev/dialogue/')));
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

// And this repository.
const here = checkExampleNames(join(dirname(dirname(fileURLToPath(import.meta.url))), '..'));
for (const f of here) console.error(`FAIL ${f}`);
check(`no first name in this repository's harness (${NAMES.size} listed)`, here.length === 0);

if (failed) {
  console.error(`${failed} failing: a name in a harness file stops any copy whose record holds it (check-privacy.mjs)`);
  process.exit(1);
}
