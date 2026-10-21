'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function UserNav() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.authenticated) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-main)',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          👤 {user.name}{' '}
          <strong style={{ color: 'var(--primary-light)', fontSize: '0.75rem' }}>
            ({user.role})
          </strong>
        </span>
        <a
          href="/api/auth/logout"
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
        >
          Sign Out
        </a>
      </div>
    );
  }

  return (
    <Link href="/login" className="btn btn-secondary btn-sm">
      Staff Login
    </Link>
  );
}
