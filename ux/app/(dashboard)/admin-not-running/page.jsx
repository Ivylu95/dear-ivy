import { notFound, redirect } from 'next/navigation';
import { Card, Enter, PageHead, Prose } from '@/components/ui';
import { ADMIN_BASE, ADMIN_PRESENT } from '@/config/admin.mjs';
import { adminAnswers } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// Where /admin lands when the developer's app is here but not answering
// (WKB-002): the gate in proxy.js sends it here rather than letting a refused
// connection surface as a proxy error. Every other view is untouched by it.
// Where that app is absent this page does not exist either.
// Opened directly while the app is up, it would say something untrue, so it
// sends the reader to the views instead.
export default async function AdminNotRunning() {
  if (!ADMIN_PRESENT) notFound();
  if (await adminAnswers({ fresh: true })) redirect(ADMIN_BASE);
  return (
    <Enter>
      <PageHead route="/changes" title="The developer's views aren't running" sub="Everything else here works as usual." />
      <Card>
        <Prose>
          <p>
            They are a separate app in <code>dev/ui/</code>, which the dashboard starts with it. It
            has stopped, or never started. Start the dashboard again from <code>ux/</code> with{' '}
            <code>npm run dev</code>, or start them on their own from <code>dev/ui/</code> with{' '}
            <code>npm run dev</code>, then reload this page.
          </p>
        </Prose>
      </Card>
    </Enter>
  );
}
