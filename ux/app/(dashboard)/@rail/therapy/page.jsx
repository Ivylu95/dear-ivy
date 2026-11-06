import { RailNav } from '@/components/shell/RailNav';
import { getTherapy } from '@/lib/content';
import { moduleOn } from '@/lib/modules';
import { titledDate } from '@/lib/dates';
import { slugify } from '@/lib/views';

// The standing sections first, then every appointment by date. Appointments are
// the part that grows without limit, so they sit below the fixed rows rather than
// pushing them off the top.
export default async function TherapyRail() {
  if (!moduleOn('therapy')) return null;
  const { focus, appointments } = await getTherapy();

  const items = [
    ...(focus ? [{ href: `#${slugify("What you're working on")}`, label: "What you're working on" }] : []),
    ...(appointments.length
      ? [{ href: `#${slugify('Appointments')}`, label: 'Appointments' }]
      : []),
    ...appointments.map((a) => {
      const { title, note } = titledDate(a);
      return { href: `#${a.slug}`, label: title, meta: note };
    }),
  ];

  return <RailNav title="On this page" items={items} />;
}
