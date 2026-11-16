import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'chab Bot',
  description: 'AI Customer Care Assistant with Real-time Streaming',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased selection:bg-amber-200 selection:text-stone-900">
        {children}
      </body>
    </html>
  );
}
