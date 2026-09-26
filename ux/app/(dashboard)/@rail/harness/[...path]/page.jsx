import { FolderPathRail } from '@/components/harness/FolderPathRail';
import { harnessView } from '@/lib/harness';

export default function HarnessPathRail({ params }) {
  return <FolderPathRail params={params} view={harnessView} />;
}
