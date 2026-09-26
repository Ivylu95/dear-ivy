import { FolderOverview } from '@/components/harness/FolderOverview';
import { HARNESS_VIEW } from '@/lib/folder-views';
import { harnessView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default function Harness() {
  return <FolderOverview view={harnessView} tab={HARNESS_VIEW} />;
}
