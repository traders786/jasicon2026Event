'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/UserNav';

export function HeaderNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (isMounted && d?.authenticated && d.user?.role) {
          setUserRole(d.user.role);
        } else if (isMounted) {
          setUserRole(null);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  // Dynamic role-based navigation links
  const navLinks = (() => {
    if (userRole === 'VENDOR') {
      return [
        { href: '/scanner', label: 'Vendor Scanner', icon: '📷' },
      ];
    }
    if (userRole === 'OPERATOR') {
      return [
        { href: '/', label: 'Dashboard', icon: '📊' },
        { href: '/scanner', label: 'QR Scanner', icon: '📷' },
        { href: '/register', label: 'New Registration', icon: '➕' },
        { href: '/participants', label: 'Participants', icon: '👥' },
      ];
    }
    // Default / Super Admin: Full navigation
    return [
      { href: '/', label: 'Dashboard', icon: '📊' },
      { href: '/scanner', label: 'QR Scanner', icon: '📷' },
      { href: '/register', label: 'New Registration', icon: '➕' },
      { href: '/participants', label: 'Participants', icon: '👥' },
      { href: '/audit', label: 'Audit History', icon: '🕒' },
    ];
  })();

  return (
    <header className="top-nav">
      <div className="nav-inner">
        {/* Clean Evently Brand Group */}
        <Link
          href="/"
          className="brand-group"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="brand-logo-wrap">
            <Image
              src="/evently-logo.jpg"
              alt="Evently"
              width={38}
              height={38}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <span className="brand-title">Evently</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-links desktop-only-nav">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Header Right Cluster: Status + UserNav + Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Status badge: Hidden on medium/small screens, visible on large desktop */}
          <span className="desktop-status-pill">
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                boxShadow: '0 0 6px var(--accent)',
                flexShrink: 0,
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>PostgreSQL 5433</span>
          </span>

          <div className="desktop-usernav-wrap">
            <UserNav />
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Backdrop & Sheet rendered via Portal to document.body */}
      {mounted && mobileMenuOpen && createPortal(
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="mobile-menu-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Header Bar */}
            <div className="mobile-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="brand-logo-wrap" style={{ width: '34px', height: '34px' }}>
                  <Image
                    src="/evently-logo.jpg"
                    alt="Evently"
                    width={34}
                    height={34}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '1.15rem' }}>
                    Evently
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    JASICON 2026 • Delegate Management
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="mobile-nav-list">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span style={{ fontSize: '1.25rem', width: '28px', textAlign: 'center' }}>
                      {link.icon}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>{link.label}</span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary)',
                          background: 'var(--primary-subtle)',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                        }}
                      >
                        Active
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Footer Status & User Profile */}
            <div className="mobile-sheet-footer">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Database Connection:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }} />
                  PostgreSQL (Port 5433)
                </span>
              </div>

              <div>
                <UserNav />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
