import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Iris Portal',
  description: 'Iris ecosystem dashboard — manage your applications, routes, and events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-3">
          <span className="text-violet-400 font-bold text-lg tracking-tight">iris</span>
          <span className="text-slate-600 text-sm font-mono">portal</span>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
