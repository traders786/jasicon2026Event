import type { Metadata } from 'next';
import Link from 'next/link';
import { UserNav } from '@/components/UserNav';
import './globals.css';

export const metadata: Metadata = {
  title: '25th JASICON 2026 — Check-In & 19-Entitlement Platform',
  description: '25th Annual State Conference of Jharkhand Chapter, Association of Surgeons of India (ASI). Real-time delegate attendance & 19-entitlement QR tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="top-nav">
          <div className="nav-inner">
            <Link href="/" className="brand-group" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 50%, #6366f1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(13, 148, 136, 0.35)',
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4L7 11V22C7 33.2 14.3 43.1 24 46C33.7 43.1 41 33.2 41 22V11L24 4Z" fill="#090d16" fillOpacity="0.5"/>
                  <rect x="21" y="14" width="6" height="20" rx="2" fill="#fbbf24"/>
                  <rect x="14" y="21" width="20" height="6" rx="2" fill="#fbbf24"/>
                  <circle cx="24" cy="24" r="2.5" fill="#ffffff"/>
                </svg>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="brand-title" style={{ fontWeight: 800, letterSpacing: '0.5px' }}>
                    JASICON <span style={{ color: '#fbbf24' }}>2026</span>
                  </span>
                  <span className="brand-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    25th Annual
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.3px', marginTop: '-2px' }}>
                  Jharkhand Chapter • ASI
                </div>
              </div>
            </Link>

            <nav className="nav-links">
              <Link href="/" className="nav-link">
                Dashboard
              </Link>
              <Link href="/scanner" className="nav-link">
                QR Scanner
              </Link>
              <Link href="/register" className="nav-link">
                New Registration
              </Link>
              <Link href="/participants" className="nav-link">
                Participants
              </Link>
              <Link href="/audit" className="nav-link">
                Audit History
              </Link>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                Port 5433 Active
              </span>

              <UserNav />
            </div>
          </div>
        </header>

        <main className="app-container">{children}</main>
      </body>
    </html>
  );
}
