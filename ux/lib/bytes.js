// Bytes, said the way a file manager says them.
//
// SI rather than binary: this is read beside a folder listing, and every file
// manager a person has open next to it divides by 1000. Being right about
// kibibytes and different from everything else on their screen is the wrong
// trade for a number nobody is going to do arithmetic on.
//
// One decimal under 10 and none above it — 8.4 kB says something 8 kB does not,
// and 312.7 kB is three digits of noise on a number whose whole job is "about
// this big".
//
// Its own module because two rail routes need it: the harness overview and every
// folder under it. A second copy is how two pages start disagreeing about what a
// kilobyte is.
export function sizeLabel(bytes) {
  if (!bytes) return null;
  if (bytes < 1000) return `${bytes} B`;

  const units = ['kB', 'MB', 'GB'];
  let n = bytes / 1000;
  let unit = 0;
  while (n >= 1000 && unit < units.length - 1) {
    n /= 1000;
    unit += 1;
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[unit]}`;
}
