'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showBackendInfo, setShowBackendInfo] = useState(false);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      setSuccessMsg(`Authenticated as ${data.user.name} (${data.user.role}). Redirecting...`);
      setTimeout(() => {
        if (data.user.role === 'VENDOR') {
          router.push('/scanner');
        } else if (data.user.role === 'OPERATOR') {
          router.push('/participants');
        } else {
          router.push('/');
        }
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    await performLogin(email, password);
  };

  const handleQuickFill = (testEmail: string, testPass: string, autoLogin = false) => {
    setEmail(testEmail);
    setPassword(testPass);
    setError(null);
    if (autoLogin) {
      void performLogin(testEmail, testPass);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '2.5rem auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: '#ffffff',
            boxShadow: '0 8px 24px rgba(13, 98, 94, 0.12)',
            border: '1px solid #dce7e4',
            marginBottom: '1rem',
            overflow: 'hidden',
            padding: '6px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/evently-logo.jpg"
            alt="Evently Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          JASICON 2026
        </h1>
        <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 700, marginTop: '2px', letterSpacing: '0.5px' }}>
          25TH ANNUAL STATE CONFERENCE • ASI JHARKHAND
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
          Staff Desk, Scanner &amp; Check-In Portal
        </p>
      </div>

      {/* Security notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '10px',
          background: 'rgba(13, 98, 94, 0.06)',
          border: '1px solid rgba(13, 98, 94, 0.15)',
          fontSize: '0.8rem',
          color: 'var(--primary)',
          fontWeight: 600,
        }}
      >
        <span>🔒</span>
        <span>All portal pages are protected. Please sign in to access your role.</span>
      </div>

      {/* Login Card */}
      <div className="card">
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@jasicon2026.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Role Quick Fill Buttons */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Quick 1-Click Role Login</span>
            <span style={{ fontWeight: 600, color: 'var(--primary)', textTransform: 'none' }}>Click to auto-fill</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Super Admin */}
            <button
              type="button"
              onClick={() => handleQuickFill('admin@jasicon2026.com', 'Admin123!', true)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
                background: '#ecfdf5',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👑</span>
                  <span>Super Admin</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                  admin@jasicon2026.com • Full Control
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ffffff', padding: '3px 8px', borderRadius: '6px' }}>
                Sign In →
              </span>
            </button>

            {/* Registration Desk Operator */}
            <button
              type="button"
              onClick={() => handleQuickFill('desk@jasicon2026.com', 'Desk123!', true)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                background: '#f0f9ff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#075985', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💻</span>
                  <span>Desk Operator</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#0369a1' }}>
                  desk@jasicon2026.com • Badge &amp; Check-In
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', background: '#ffffff', padding: '3px 8px', borderRadius: '6px' }}>
                Sign In →
              </span>
            </button>

            {/* Catering Vendor */}
            <button
              type="button"
              onClick={() => handleQuickFill('caterer@jasicon2026.com', 'Vendor123!', true)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #fde68a',
                background: '#fffbeb',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🍽️</span>
                  <span>Catering Vendor</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#b45309' }}>
                  caterer@jasicon2026.com • Counter Redemptions
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', background: '#ffffff', padding: '3px 8px', borderRadius: '6px' }}>
                Sign In →
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Backend & Database Quick Status Box */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Database: PostgreSQL 16 (Port 5433)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBackendInfo((prev) => !prev)}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showBackendInfo ? 'Hide Details ▲' : 'Backend Details ▼'}
          </button>
        </div>

        {showBackendInfo && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            <div style={{ marginBottom: '4px' }}>
              • <strong>Database Engine:</strong> PostgreSQL on <code>127.0.0.1:5433/eventcheck_dev</code>
            </div>
            <div style={{ marginBottom: '4px' }}>
              • <strong>Prisma Schema:</strong> <code>prisma/schema.prisma</code> (6 models)
            </div>
            <div style={{ marginBottom: '4px' }}>
              • <strong>Visual GUI:</strong> Run <code>npx prisma studio</code> in terminal to view all tables at <code>http://localhost:5555</code>
            </div>
            <div>
              • <strong>System Status API:</strong> <code>/api/backend/status</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
