'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      {/* Evently Brand Header */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '76px',
            height: '76px',
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
            alt="Evently"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/evently-logo.jpg';
            }}
          />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.3px' }}>
          Evently
        </h1>
        <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 700, marginTop: '2px', letterSpacing: '0.5px' }}>
          MULTI-CONFERENCE OPERATIONS &amp; STAFF PORTAL
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
        <span>
          All portal pages are protected. Please sign in to access your role.
        </span>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '44px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Role Quick Fill Buttons (for testing & demo access) */}
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
            <span>Demo 1-Click Role Login</span>
            <span style={{ fontWeight: 600, color: 'var(--primary)', textTransform: 'none' }}>Click to test</span>
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
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #a7f3d0',
                background: '#ecfdf5',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👑</span>
                  <span>Super Admin</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '2px' }}>
                  <strong>admin@jasicon2026.com</strong> • Pass: <code style={{ background: '#d1fae5', padding: '1px 4px', borderRadius: '4px' }}>Admin123!</code>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', background: '#ffffff', padding: '5px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                1-Click Login →
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
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #bae6fd',
                background: '#f0f9ff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#075985', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💻</span>
                  <span>Registration Desk</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#0369a1', marginTop: '2px' }}>
                  <strong>desk@jasicon2026.com</strong> • Pass: <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: '4px' }}>Desk123!</code>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284c7', background: '#ffffff', padding: '5px 10px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                1-Click Login →
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
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #fde68a',
                background: '#fffbeb',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🍽️</span>
                  <span>Catering Vendor &amp; Scanner</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '2px' }}>
                  <strong>caterer@jasicon2026.com</strong> • Pass: <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: '4px' }}>Vendor123!</code>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706', background: '#ffffff', padding: '5px 10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                1-Click Login →
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>Loading portal...</div>}>
      <LoginForm />
    </Suspense>
  );
}
