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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      setSuccessMsg(`Authenticated as ${data.user.name} (${data.user.role}). Redirecting...`);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3.5rem auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 50%, #6366f1 100%)',
            boxShadow: '0 0 20px rgba(13, 148, 136, 0.4)',
            marginBottom: '1rem',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L7 11V22C7 33.2 14.3 43.1 24 46C33.7 43.1 41 33.2 41 22V11L24 4Z" fill="#090d16" fillOpacity="0.5"/>
            <rect x="21" y="14" width="6" height="20" rx="2" fill="#fbbf24"/>
            <rect x="14" y="21" width="20" height="6" rx="2" fill="#fbbf24"/>
            <circle cx="24" cy="24" r="2.5" fill="#ffffff"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
          JASICON 2026
        </h1>
        <p style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, marginTop: '2px', letterSpacing: '0.5px' }}>
          25TH ANNUAL STATE CONFERENCE • ASI JHARKHAND
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
          Staff Desk, Scanner & Check-In Portal
        </p>
      </div>

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
              placeholder="operator@example.com"
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
      </div>
    </div>
  );
}
