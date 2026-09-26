import { FolderRail } from '@/components/harness/FolderRail';
import { SPECS_VIEW } from '@/lib/folder-views';
import { specsView } from '@/lib/harness';

export default function SpecsRail() {
  return <FolderRail view={specsView} tab={SPECS_VIEW} />;
}
