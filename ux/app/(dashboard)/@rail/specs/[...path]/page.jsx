import { FolderPathRail } from '@/components/harness/FolderPathRail';
import { specsView } from '@/lib/harness';

export default function SpecsPathRail({ params }) {
  return <FolderPathRail params={params} view={specsView} />;
}
