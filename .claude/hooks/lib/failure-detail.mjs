// What the self-test shows of a rule test that failed. Many tests print their
// "FAIL <case>" lines to stdout and only a count to stderr, so showing stderr
// alone hid which case broke: test-dev-done-notify.mjs failed now and then
// inside the self-test and never by hand, and its failing case was never seen
// (T-871, 2026-11-05). The FAIL lines from stdout come first, then stderr.

const FAIL_LINE = /^\s*(FAIL\b|not ok\b|✗|AssertionError)/;

/** The lines worth showing for a failed test: its failing cases from stdout, then its stderr. */
export function failureDetail(stdout = '', stderr = '') {
  const fails = String(stdout).split('\n').filter((l) => FAIL_LINE.test(l));
  return [...fails, ...String(stderr).split('\n').filter((l) => l.trim())].join('\n');
}
