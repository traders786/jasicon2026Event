'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/UserNav';
import { EventSwitcher } from '@/components/EventSwitcher';

interface HeaderNavProps {
  userRole?: string | null;
  isSuperAdmin?: boolean;
  activeEvent?: any;
  showAdminSidebar?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenCreateEvent?: () => void;
}

export function HeaderNav({
  userRole: propUserRole,
  isSuperAdmin: propIsSuperAdmin,
  activeEvent: propActiveEvent,
  showAdminSidebar = false,
  sidebarCollapsed = false,
  onToggleSidebar,
}: HeaderNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const [internalUserRole, setInternalUserRole] = useState<string | null>(null);
  const [internalIsSuperAdmin, setInternalIsSuperAdmin] = useState(false);
  const [internalActiveEvent, setInternalActiveEvent] = useState<any>(null);

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

  // Fetch session if not provided by parent AppShell
  useEffect(() => {
    if (propUserRole !== undefined) return;

    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (isMounted && d?.authenticated && d.user?.role) {
          setInternalUserRole(d.user.role);
          setInternalIsSuperAdmin(d.isSuperAdmin || d.user.role === 'ADMIN');
          setInternalActiveEvent(d.event || null);
        } else if (isMounted) {
          setInternalUserRole(null);
          setInternalIsSuperAdmin(false);
          setInternalActiveEvent(null);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pathname, propUserRole]);

  const userRole = propUserRole !== undefined ? propUserRole : internalUserRole;
  const isSuperAdmin = propIsSuperAdmin !== undefined ? propIsSuperAdmin : internalIsSuperAdmin;
  const activeEvent = propActiveEvent !== undefined ? propActiveEvent : internalActiveEvent;

  const isLoginPage = pathname === '/login';

  // Dynamic role-based navigation links:
  const navLinks = (() => {
    if (!userRole) return [];
    if (userRole === 'VENDOR') {
      return [
        { href: '/scanner', label: 'Vendor Scanner', icon: '📷' },
      ];
    }
    if (userRole === 'OPERATOR') {
      return [
        { href: '/participants', label: 'Participants', icon: '👥' },
        { href: '/scanner', label: 'QR Scanner', icon: '📷' },
        { href: '/register', label: 'New Registration', icon: '➕' },
      ];
    }
    // Super Admin navigation items
    return [
      { href: '/', label: 'Dashboard', icon: '📊' },
      { href: '/participants', label: 'Participants', icon: '👥' },
      { href: '/scanner', label: 'QR Scanner', icon: '📷' },
      { href: '/register', label: 'New Registration', icon: '➕' },
      { href: '/events', label: 'Event Studio', icon: '🎨' },
      { href: '/users', label: 'Staff Accounts', icon: '🛡️' },
      { href: '/audit', label: 'Audit History', icon: '🕒' },
      { href: '/backend', label: 'Backend Details', icon: '⚙️' },
    ];
  })();

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Executive Dashboard';
    if (path === '/participants') return 'Participants Directory';
    if (path === '/register') return 'New Registration';
    if (path === '/scanner') return 'QR Scanner & Check-in';
    if (path === '/events') return 'Event Studio & Branding';
    if (path === '/users') return 'Staff & Operators';
    if (path === '/audit') return 'Audit History';
    if (path === '/backend') return 'Backend & Cloud Health';
    return 'Admin Console';
  };

  return (
    <header className={`top-nav ${showAdminSidebar ? (sidebarCollapsed ? 'has-admin-sidebar sidebar-collapsed' : 'has-admin-sidebar') : ''}`}>
      <div className="nav-inner">
        {/* Left Section: For Super Admin on desktop, show Sidebar Toggle + Breadcrumb. Otherwise Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          {showAdminSidebar ? (
            <>
              {/* Desktop Super Admin breadcrumbs */}
              <div className="admin-header-desktop-left">
                {onToggleSidebar && (
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="admin-header-toggle-btn"
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                )}

                <div className="admin-header-breadcrumb">
                  <span className="admin-breadcrumb-root">Admin</span>
                  <span className="admin-breadcrumb-sep">/</span>
                  <span className="admin-breadcrumb-current">{getPageTitle(pathname)}</span>
                </div>

                {activeEvent?.ticketPrefix && (
                  <span className="admin-header-prefix-pill" title="Current Ticket Prefix">
                    {activeEvent.ticketPrefix}
                  </span>
                )}
              </div>

              {/* Mobile-only brand logo for Super Admin on small screens */}
              <Link
                href="/"
                className="brand-group admin-header-mobile-brand"
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
            </>
          ) : (
            /* Clean Evently Brand Group for non-admin or login page */
            <Link
              href={userRole === 'VENDOR' ? '/scanner' : userRole === 'OPERATOR' ? '/participants' : userRole ? '/' : '/login'}
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
          )}
        </div>

        {/* Desktop Navigation Links:
            IMPORTANT: For Super Admin on Desktop, these are in the left collapsible panel,
            so do NOT render the crowded horizontal nav here! Only render for non-admin roles (Operator/Vendor).
        */}
        {!isLoginPage && !showAdminSidebar && navLinks.length > 0 && (
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
        )}

        {/* Header Right Cluster: Event Switcher + UserNav + Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {!isLoginPage && userRole && (
            <div className="admin-top-event-switcher" style={{ display: 'flex', alignItems: 'center' }}>
              <EventSwitcher
                isSuperAdmin={isSuperAdmin}
                activeEventTitle={activeEvent?.title}
                activeEventCity={activeEvent?.city}
              />
            </div>
          )}

          <div className="desktop-usernav-wrap">
            <UserNav />
          </div>

          {/* Mobile Hamburger Button (Shown on mobile devices for quick sheet menu) */}
          {!isLoginPage && navLinks.length > 0 && (
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
          )}
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
                    {activeEvent?.title || 'Delegate Management'}
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

            {/* Mobile Event Switcher / Status Pill */}
            <div style={{ padding: '0.25rem 0' }}>
              <EventSwitcher
                isSuperAdmin={isSuperAdmin}
                activeEventTitle={activeEvent?.title}
                activeEventCity={activeEvent?.city}
              />
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cloud Database:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }} />
                  PostgreSQL (Neon)
                </span>
              </div>

              <div style={{ position: 'relative', width: '100%' }}>
                <UserNav isMobile dropUp />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
