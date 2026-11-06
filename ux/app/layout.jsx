import Document from '@/components/shell/Document';

export { metadata, viewport } from '@/components/shell/Document';

// The document lives in components/shell/Document.jsx, shared with the admin
// app in dev/ui/ (WKB-002).
export default function RootLayout({ children }) {
  return <Document>{children}</Document>;
}
