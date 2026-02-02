import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Video Catalog",
  description: "Catalog, review and publish videos from Dropbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-semibold text-lg text-white">
              Video Catalog
            </Link>
            <nav className="flex gap-4">
              <Link href="/inbox" className="text-zinc-400 hover:text-white transition">
                Inbox
              </Link>
              <Link href="/settings" className="text-zinc-400 hover:text-white transition">
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
