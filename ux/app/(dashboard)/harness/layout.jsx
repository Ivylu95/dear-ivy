import { FolderLayout } from '@/components/harness/FolderLayout';
import { HARNESS_VIEW } from '@/lib/folder-views';
import { harnessView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

// The Harness tab is a folder read as a tree beside the file it opens. The page
// and its reasons are components/harness/FolderLayout.jsx.
export default function HarnessLayout({ children }) {
  return (
    <FolderLayout view={harnessView} tab={HARNESS_VIEW}>
      {children}
    </FolderLayout>
  );
}
