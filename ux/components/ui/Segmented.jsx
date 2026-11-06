import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

// The one switch for picking one of a few: Timeline | Calendar, Tree | Graph,
// Light | Dark | System, and every other choice of two to five (DES-001 design
// 3). A view passes its options and never restates the look; the admin app in
// dev/ui/ borrows this, never the reverse (ARC-008). A list longer than that,
// such as tags, is a row of chips, not a switch.
//
// The shape and the motion are an earlier admin app's `.seg`, at the developer's
// ask: equal columns, and a pill under the chosen option that slides to it on a
// spring. The values are this theme's (DES-004), so it follows her colour and
// mode rather than carrying the earlier admin app's.
//
// Three ways to act, picked by the options and props, so one look serves all:
//   links    an option with `href` is a Next <Link>, marked aria-current. Next's
//            Link, never a plain <a>: the admin app is served under /admin
//            (basePath), and only Link adds it.
//   buttons  `onSelect(key, event)` is called on a press, marked aria-pressed.
//   a form   `form={{ action, name }}` posts the chosen key with no script, for
//            a choice the server has to read before it renders anything.
//
// The pill is placed from the chosen index at render, so it is right in the
// server HTML; it slides wherever the same control re-renders with a new choice.
// `block` stretches the control to its container's width.
//
// An option with an icon and no label is drawn as the glyph alone, and its
// title names it for a screen reader too (the dashboard switch, WKB-002).
//
// options: [{ key, label?, href?, icon?, title? }]
export function Segmented({ options, current, label, onSelect, form, block = false, className }) {
  const index = options.findIndex((o) => o.key === current);
  const chosen = index >= 0;
  const classes = ['seg', block && 'seg-block', className].filter(Boolean).join(' ');
  const style = { '--seg-n': options.length, '--seg-i': Math.max(0, index) };
  const Box = form ? 'form' : options.some((o) => o.href) ? 'nav' : 'div';
  const boxProps = form
    ? { action: form.action, method: 'post' }
    : Box === 'div'
      ? { role: 'group' }
      : {};

  return (
    <Box className={classes} style={style} aria-label={label} {...boxProps}>
      {chosen && <span className="seg-pill" aria-hidden="true" />}
      {options.map((o) => {
        const on = o.key === current;
        const inner = (
          <>
            {o.icon && <Icon name={o.icon} size={o.label ? 13 : 15} />}
            {o.label && <span>{o.label}</span>}
          </>
        );
        if (o.href) {
          return (
            <Link key={o.key} href={o.href} title={o.title} aria-label={o.label ? undefined : o.title} aria-current={on ? 'page' : undefined}>
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={o.key}
            type={form ? 'submit' : 'button'}
            name={form?.name}
            value={form ? o.key : undefined}
            title={o.title}
            aria-label={o.label ? undefined : o.title}
            aria-pressed={on}
            onClick={onSelect ? (e) => onSelect(o.key, e) : undefined}
          >
            {inner}
          </button>
        );
      })}
    </Box>
  );
}
