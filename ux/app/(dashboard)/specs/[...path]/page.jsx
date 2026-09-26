import { FolderPath } from '@/components/harness/FolderPath';
import { specsView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

export default function SpecsPath({ params }) {
  return <FolderPath params={params} view={specsView} />;
}
