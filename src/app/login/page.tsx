'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface EventBranding {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  organizerName: string;
  venue: string;
  city: string;
  logoUrl?: string | null;
  organizerLogoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventSlugParam = searchParams.get('event');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [eventBranding, setEventBranding] = useState<EventBranding | null>(null);

  useEffect(() => {
    const url = eventSlugParam
      ? `/api/events/public?slug=${encodeURIComponent(eventSlugParam)}`
      : '/api/events/public';

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.event) {
          setEventBranding(data.event);
        }
      })
      .catch(() => {});
  }, [eventSlugParam]);

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

  const isCustomEvent = Boolean(eventSlugParam && eventSlugParam !== 'jasicon-2026');

  return (
    <div style={{ maxWidth: '460px', margin: '2.5rem auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Brand Header */}
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
            src={eventBranding?.logoUrl || '/evently-logo.jpg'}
            alt={eventBranding?.title || 'Event Logo'}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/evently-logo.jpg';
            }}
          />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          {eventBranding?.title || 'JASICON 2026'}
        </h1>
        <p style={{ color: eventBranding?.primaryColor || 'var(--primary)', fontSize: '0.85rem', fontWeight: 700, marginTop: '2px', letterSpacing: '0.5px' }}>
          {eventBranding?.subtitle || '25TH ANNUAL STATE CONFERENCE • ASI JHARKHAND'}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
          {eventBranding?.venue ? `📍 ${eventBranding.venue} • Staff Portal` : 'Staff Desk, Scanner & Check-In Portal'}
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
          color: eventBranding?.primaryColor || 'var(--primary)',
          fontWeight: 600,
        }}
      >
        <span>🔒</span>
        <span>
          {isCustomEvent
            ? `Protected ${eventBranding?.title || 'Conference'} operations portal. Log in to access your assigned desk or counter.`
            : 'All portal pages are protected. Please sign in to access your role.'}
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
              placeholder={isCustomEvent ? `operator@${eventSlugParam}.com` : 'admin@jasicon2026.com'}
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
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: '0.5rem',
              background: eventBranding?.primaryColor || undefined,
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Role Quick Fill Buttons (shown on default/demo view) */}
        {!isCustomEvent ? (
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
        ) : (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Assigned to <strong>{eventBranding?.title}</strong>? Use the official counter credentials provided by your Administrator.
            </p>
          </div>
        )}
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
