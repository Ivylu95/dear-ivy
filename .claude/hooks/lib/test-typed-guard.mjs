// Rule test for lib/typed-guard.mjs: what writes the record of what the developer typed.
//
// Every shape of the false alarms of 2-4 Nov passes (a variable set in the same
// command, a heredoc's data, the word "write" in a string, a loop reading the
// record's history, a scratch folder outside the repository), and every way of
// writing it is still refused, including through those same shapes. The
// selftest's cases for privacy/guard-secrets.mjs cover the rest. Exits non-zero
// on any failure. Run by selftest.mjs.

import { expandFixed, shellWrites } from './typed-guard.mjs';

const R = ['dev', 'dialogue', 'typed'].join('/') + '.jsonl';
const N = R.split('/').pop();
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
const passes = (what, cmd) => check(`passes ${what}`, !shellWrites(cmd));
const refuses = (what, cmd) => check(`refuses ${what}`, shellWrites(cmd));

// The false alarms, in their shapes.
passes('scratch files under a variable set in the same command, beside the dialogue', 'node ux/scripts/dialogue.mjs check; S=/tmp/scratch; git commit -q -F $S/msg.txt > $S/cc.txt 2>&1 && echo done');
passes('a loop of commits writing to a scratch variable', 'git add dev/dialogue; S=/tmp/s; for n in 1 2 3; do git commit -q -F $S/m.txt > $S/cc.txt 2>&1 && { echo "ok $n"; break; }; done');
passes('Python given an edit to the Transcript in a heredoc', "python3 - <<'EOF'\np='dev/dialogue/transcript/2026-11.md'\ns=open(p).read()\nopen(p,'w').write(s)\nEOF");
passes('a script written to a file whose text names the record', `cat > /tmp/s/x.mjs <<'EOF'\nconst P = '${R}';\nwriteFileSync(out, readFileSync(P));\nEOF`);
passes('node given a string that says "write", a path built in it', 'node -e "const t = `kept as ${id} in dev/dialogue/transcript/${name}; do not write it again`;"');
passes('a loop over the record that only counts it', `for f in ${R}; do wc -l $f; done`);
passes('the record\'s history echoed', `echo "last: $(git log -1 --format=%s -- ${R})"`);
passes('a loop reading the record\'s history', `for h in aa bb; do c=$(git log --format=%h -S"$h" -- ${R} | tail -1); echo "$h $c: $(git log -1 --format=%s $c)"; done`);
passes('a scratch copy of the dialogue folder outside the repository', 'T=/tmp/s/view && rm -rf $T && mkdir -p $T && git archive HEAD dev/dialogue | tar -x -C $T');
passes('a removal under an absolute scratch folder, its name built', 'grep -c x dev/dialogue/agreements.md; rm -rf /tmp/scratch/$T');
// 2026-11-04: a commit whose message only named the record.
passes('a commit whose message names the record', `git commit -m "fix: three lines of ${R} lost in a merge" -- ux/a.mjs`);
passes('a commit whose message names it, single-quoted and with -am', `git commit -am 'the ${N} lines' && git log -1`);
passes('a commit whose --message= names it', `git commit --message="see ${R}" -- ux/a.mjs`);

passes('a sed edit of the Transcript whose pattern ends in $ inside single quotes', "sed -i 's/^- a · b$/- a · c/' dev/dialogue/transcript/2026-11-2.md");

passes('a grep for a quoted pattern holding > in the Transcript', 'grep -c "^> Yes$" dev/dialogue/transcript/2026-11.md');
passes('a grep of the record for a quoted pattern holding >', `grep -c "^> x" ${R}`);

// Still refused: the record written, through each of those shapes.
refuses('a bare > onto the record named in quotes', `echo x > "${R}"`);
refuses('a bare >> after a quoted pattern', `grep "> a" notes.md >> ${R}`);
refuses('an in-place edit of a path built outside the quotes, near its folder', "sed -i 's/a/b/' dev/dialogue/$F");
refuses('a double-quoted expansion, which the shell does expand', 'cd dev/dialogue && rm "$F"');
refuses('an append through a variable set in the same command', `D=dev/dialogue; echo x >> $D/${N}`);
refuses('an append through ${braces}', `D=dev/dialogue; echo x >> \${D}/${N}`);
refuses('its name built from a variable set beside it', 'T=typed; cp x.jsonl dev/dialogue/$T.jsonl');
refuses('a write inside a loop', `for f in a; do echo x > ${R}; done`);
refuses('a removal inside a command substitution', `c=$(rm ${R})`);
refuses('Python writing it from a heredoc', `python3 - <<'EOF'\nopen('${R}','a').write('x')\nEOF`);
refuses('node writing it from a heredoc', `node <<'EOF'\nrequire('fs').appendFileSync('${R}', 'x')\nEOF`);
refuses('a shell given a heredoc that appends to it', `bash <<'EOF'\necho x >> ${R}\nEOF`);
refuses('a write after a heredoc', `cat > /tmp/x <<'EOF'\ndata\nEOF\necho x >> ${R}`);
refuses('a commit naming it as a path, which stages it', `git commit -m x -- ${R}`);
refuses('a commit naming it as a path beside a message that names it too', `git commit -m "about ${N}" ${R}`);
refuses('a commit -o naming it before the message', `git commit -o ${R} -m x`);
refuses('a variable never given a value, near its folder', 'cd dev/dialogue && rm $F');
refuses('a path under $HOME, which may be the repository', 'cd dev/dialogue && rm -f $HOME/x');
const ROOT = (process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(/[\\/]+$/, '');
refuses('a path inside the repository built at run time', `cd dev/dialogue && rm ${ROOT}/dev/$F`);
refuses('a path above the repository built at run time', `cd dev/dialogue && rm ${ROOT.replace(/[^/]*$/, '')}$F`);

// T-768: the record keeps parts (typed-2.jsonl and on), and each is the record.
const P2 = R.replace('.jsonl', '-2.jsonl');
refuses('an append to a later part of the record', `echo x >> ${P2}`);
refuses('a later part removed', `rm -f ${P2}`);
refuses('a later part edited in place', `sed -i '$d' ${P2}`);
refuses('a glob that names only the later parts, beside the folder', 'cd dev/dialogue && rm typed-*.jsonl');
passes('a later part read', `wc -l ${P2} && tail -n 2 ${P2}`);

// expandFixed itself.
check('a fixed value replaces its variable', expandFixed('S=/tmp/a; cat $S/x ${S}/y') === 'S=/tmp/a; cat /tmp/a/x /tmp/a/y');
check('a value that expands is left alone', expandFixed('S=$(pwd); cat $S/x') === 'S=$(pwd); cat $S/x');
check('a longer name is not taken for a shorter', expandFixed('S=/a; echo $SX') === 'S=/a; echo $SX');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
