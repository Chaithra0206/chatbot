import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Minimal Chatbot',
  description: 'Minimal LLM Wrapper & Simple Chatbot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="bg-zinc-950 text-zinc-100 antialiased h-full">
        {children}
      </body>
    </html>
  );
}

