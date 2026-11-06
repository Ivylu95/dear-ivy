import { NavLink } from '@/components/shell/NavLink';
import { VIEW_ICON, VIEW_LABEL } from '@/lib/views';
import { Icon } from '@/components/ui/icons';

// What this app is and what it will not do, at the foot of the rail rather than
// in the list of views above.
//
// It was a tab, and being a tab made a claim about it that is not true: the rows
// above are her record — what happened, who with, what she is working on — and
// this is the app explaining itself. A page about the software sitting in the
// same list as a page about her life is the tenth row on a list read on bad
// nights, and it is the one row there that is never the reason she opened this.
//
// So it sits with Settings, which is the other thing here that is about the
// machine rather than about her. Last, quietest, and still one click from
// anywhere.
// `away`: rendered in the admin app (WKB-002); see NavLink.
export function AboutLink({ away = false }) {
  return (
    <NavLink href="/about" away={away} className="foot-link">
      <Icon name={VIEW_ICON['/about']} size={16} className="settings-icon" />
      {/* Fades out with every other open-rail-only element, so the collapsed
          rail keeps the glyph and loses only the word. */}
      <span className="foot-link-label">{VIEW_LABEL['/about']}</span>
    </NavLink>
  );
}
