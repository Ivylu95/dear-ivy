import { FolderOverview } from '@/components/harness/FolderOverview';
import { SPECS_VIEW } from '@/lib/folder-views';
import { specsView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default function Specs() {
  return <FolderOverview view={specsView} tab={SPECS_VIEW} />;
}
