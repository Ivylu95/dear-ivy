import { FolderPath } from '@/components/harness/FolderPath';
import { harnessView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default function HarnessPath({ params }) {
  return <FolderPath params={params} view={harnessView} />;
}
