import { FolderLayout } from '@/components/harness/FolderLayout';
import { SPECS_VIEW } from '@/lib/folder-views';
import { specsView } from '@/lib/harness';

export const dynamic = 'force-dynamic';

// The Specs tab is a folder read as a tree beside the file it opens. The page
// and its reasons are components/harness/FolderLayout.jsx.
export default function SpecsLayout({ children }) {
  return (
    <FolderLayout view={specsView} tab={SPECS_VIEW}>
      {children}
    </FolderLayout>
  );
}
