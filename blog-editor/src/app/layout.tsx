import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blog Editor',
  description: 'Local blog post editor',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050505] text-[#FAFAFA] antialiased font-sans">
        <header className="border-b border-[#1F1F1F] bg-[#050505]/90 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#00F0FF]">
                Blog Editor
              </span>
            </a>
            <nav className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm font-mono text-[#888888] hover:text-[#FAFAFA] transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/new"
                className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-[#00F0FF] text-[#050505] hover:bg-[#00D4E0] transition-colors"
              >
                New Post
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
