import { FolderRail } from '@/components/harness/FolderRail';
import { HARNESS_VIEW } from '@/lib/folder-views';
import { harnessView } from '@/lib/harness';

export default function HarnessRail() {
  return <FolderRail view={harnessView} tab={HARNESS_VIEW} />;
}
