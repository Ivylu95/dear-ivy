import { RailNav } from '@/components/shell/RailNav';
import { getTherapy } from '@/lib/content';
import { dateLabel } from '@/lib/dates';
import { slugify } from '@/lib/views';

// The standing sections first, then every appointment by date. Appointments are
// the part that grows without limit, so they sit below the fixed rows rather than
// pushing them off the top.
export default async function TherapyRail() {
  const { focus, appointments } = await getTherapy();

  const items = [
    ...(focus ? [{ href: `#${slugify("What you're working on")}`, label: "What you're working on" }] : []),
    ...(appointments.length
      ? [{ href: `#${slugify('Appointments')}`, label: 'Appointments', meta: String(appointments.length) }]
      : []),
    ...appointments.map((a) => ({
      href: `#${a.slug}`,
      label: a.title ?? dateLabel(a.date),
      meta: a.title ? dateLabel(a.date) : null,
    })),
  ];

  return <RailNav title="On this page" items={items} />;
}
