'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function UserNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  if (!user) {
    return (
      <Link
        href="/login"
        className="btn btn-primary btn-sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 700,
          padding: '6px 14px',
          borderRadius: '10px',
        }}
      >
        <span>🔐</span>
        <span>Staff Sign In</span>
      </Link>
    );
  }

  // Generate initials
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || user.role[0] || 'U';

  const roleMeta = (() => {
    switch (user.role) {
      case 'ADMIN':
        return {
          title: 'Super Administrator',
          short: 'Super Admin',
          icon: '👑',
          badgeColor: '#059669',
          badgeBg: '#ecfdf5',
          badgeBorder: '#a7f3d0',
          avatarGrad: 'linear-gradient(135deg, #0d625e 0%, #059669 100%)',
          privileges: 'Full System Authority: Add/Edit/Delete Registrations, Bulk Import, Database Reconciliation & Audit Logs.',
        };
      case 'OPERATOR':
        return {
          title: 'Desk Operator',
          short: 'Desk Staff',
          icon: '💻',
          badgeColor: '#0284c7',
          badgeBg: '#f0f9ff',
          badgeBorder: '#bae6fd',
          avatarGrad: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
          privileges: 'Registration Desk Authority: Participant Search, Check-In, Walk-in Registrations & Badge Generation.',
        };
      case 'VENDOR':
        return {
          title: 'Station Vendor',
          short: 'Vendor',
          icon: '🍽️',
          badgeColor: '#d97706',
          badgeBg: '#fffbeb',
          badgeBorder: '#fde68a',
          avatarGrad: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
          privileges: 'Counter Authority: Station Selection, 1-Scan Auto-Claim for Meals/Kits & Live Counter Tally.',
        };
      default:
        return {
          title: 'Event Staff',
          short: 'Staff',
          icon: '👤',
          badgeColor: '#4b5563',
          badgeBg: '#f3f4f6',
          badgeBorder: '#e5e7eb',
          avatarGrad: 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)',
          privileges: 'General Check-in & Entitlement Verification.',
        };
    }
  })();

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          background: dropdownOpen ? 'var(--bg-subtle)' : '#ffffff',
          border: dropdownOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
          borderRadius: '9999px',
          padding: '4px 12px 4px 5px',
          cursor: 'pointer',
          boxShadow: dropdownOpen ? '0 0 0 3px rgba(13, 98, 94, 0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        aria-label="User account menu"
      >
        {/* Avatar Circle with Online Dot */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: roleMeta.avatarGrad,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.8rem',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {initials}
          </div>
          {/* Green Online Dot */}
          <span
            style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid #ffffff',
            }}
          />
        </div>

        {/* Name and Role Chip */}
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-heading)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: roleMeta.badgeColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>{roleMeta.icon}</span>
            <span>{roleMeta.short}</span>
          </div>
        </div>

        {/* Chevron Icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: 'var(--text-dim)',
            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            marginLeft: '2px',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Flyout Card Dropdown */}
      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '310px',
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid rgba(13, 98, 94, 0.15)',
            boxShadow: '0 12px 36px -4px rgba(13, 98, 94, 0.18), 0 4px 12px rgba(0,0,0,0.06)',
            padding: '1.25rem',
            zIndex: 99999,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header Card Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: roleMeta.avatarGrad,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.14)',
              }}
            >
              {initials}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                {user.email}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '5px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: roleMeta.badgeBg,
                  color: roleMeta.badgeColor,
                  border: `1px solid ${roleMeta.badgeBorder}`,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                <span>{roleMeta.icon}</span>
                <span>{roleMeta.title}</span>
              </div>
            </div>
          </div>

          {/* Role Privileges Card */}
          <div
            style={{
              margin: '0.85rem 0',
              padding: '0.75rem 0.9rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Role Permissions:
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '4px', lineHeight: 1.4 }}>
              {roleMeta.privileges}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '0.5rem 0' }}>
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/audit"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>🕒</span>
                  <span>System Audit Trail</span>
                </Link>
                <Link
                  href="/participants"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>👥</span>
                  <span>Manage Attendees (Full CRUD)</span>
                </Link>
              </>
            )}

            {user.role === 'OPERATOR' && (
              <>
                <Link
                  href="/register"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>➕</span>
                  <span>Spot Registration</span>
                </Link>
                <Link
                  href="/scanner"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>📷</span>
                  <span>Entrance QR Scanner</span>
                </Link>
              </>
            )}

            {user.role === 'VENDOR' && (
              <Link
                href="/scanner"
                onClick={() => setDropdownOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>📷</span>
                <span>Open Counter Scanner</span>
              </Link>
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.6rem 0' }} />

          {/* Sign Out Button */}
          <a
            href="/api/auth/logout"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.color = '#dc2626';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </a>
        </div>
      )}
    </div>
  );
}
