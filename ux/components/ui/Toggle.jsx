import { Count } from './index';

// The one on/off switch (DES-001 design 3): a track with a knob that slides
// across on the same spring as Segmented's pill. The shape is an earlier admin app's
// `.swix`, at the developer's ask; the values are this theme's
// (DES-004). For a choice between named options, use Segmented instead.
//
// `badge` is a short count shown while off, of what turning it on would add
// (e.g. "+12"), and hidden once on.
export function Toggle({ on, onChange, children, badge, title, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      className={['toggle', className].filter(Boolean).join(' ')}
      onClick={() => onChange(!on)}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      <span>{children}</span>
      {badge != null && badge !== '' && !on && <Count>{badge}</Count>}
    </button>
  );
}
