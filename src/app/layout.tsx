import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/shared/styles/variables.css';
import '@/shared/styles/global.css';

export const metadata: Metadata = {
  title: 'makroklar',
};

// Wurzel-Layout für alle Bereiche – jeder Bereich bringt darunter sein eigenes layout.tsx mit
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
