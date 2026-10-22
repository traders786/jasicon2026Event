import type { Metadata, Viewport } from 'next';
import { HeaderNav } from '@/components/HeaderNav';
import './globals.css';

export const metadata: Metadata = {
  title: '25th JASICON 2026 — Check-In & 19-Entitlement Platform',
  description: '25th Annual State Conference of Jharkhand Chapter, Association of Surgeons of India (ASI). Real-time delegate attendance & 19-entitlement QR tracking.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <HeaderNav />
        <main className="app-container">{children}</main>
      </body>
    </html>
  );
}
