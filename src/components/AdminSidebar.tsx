'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeEvent?: {
    id?: string;
    title?: string;
    city?: string;
    ticketPrefix?: string;
    primaryColor?: string;
  } | null;
  onOpenCreateEvent?: () => void;
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/participants',
    label: 'Participants',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/badge/management',
    label: 'Badge Studio',
    badge: 'JASICON',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="8" cy="15" r="2" />
        <line x1="13" y1="14" x2="18" y2="14" />
        <line x1="13" y1="17" x2="16" y2="17" />
      </svg>
    ),
  },
  {
    href: '/register',
    label: 'New Registration',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    href: '/scanner',
    label: 'QR Scanner',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3z" />
        <path d="M21 14v3h-3" />
        <path d="M14 21h3" />
        <path d="M21 21v.01" />
      </svg>
    ),
  },
  {
    href: '/events',
    label: 'Event Studio',
    badge: 'Custom',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
  },
  {
    href: '/users',
    label: 'Staff Accounts',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: '/audit',
    label: 'Audit History',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: '/backend',
    label: 'Backend Details',
    badge: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
];

export function AdminSidebar({
  collapsed,
  onToggle,
  activeEvent,
  onOpenCreateEvent,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`admin-sidebar ${collapsed ? 'admin-sidebar-collapsed' : 'admin-sidebar-expanded'}`}
      aria-label="Super Admin Navigation"
    >
      {/* Sidebar Top: Logo, Brand & Collapse Toggle */}
      <div className="admin-sidebar-header">
        <Link href="/" className="admin-sidebar-brand" title="Evently Super Admin">
          <div className="admin-sidebar-logo-wrap">
            <Image
              src="/evently-logo.jpg"
              alt="Evently"
              width={34}
              height={34}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          {!collapsed && (
            <div className="admin-sidebar-brand-text">
              <span className="admin-brand-title">Evently</span>
              <span className="admin-brand-badge">Super Admin</span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          className="admin-sidebar-toggle-btn"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Active Conference Quick Summary Widget */}
      <div className="admin-sidebar-event-widget">
        {!collapsed ? (
          <div className="admin-event-card">
            <div className="admin-event-card-header">
              <span className="admin-event-indicator" />
              <span className="admin-event-label">ACTIVE CONFERENCE</span>
            </div>
            <div className="admin-event-card-title" title={activeEvent?.title || 'JASICON 2026'}>
              {activeEvent?.title || 'JASICON 2026'}
            </div>
            <div className="admin-event-card-subtitle">
              📍 {activeEvent?.city || 'Deoghar, Jharkhand'}
            </div>
            {onOpenCreateEvent && (
              <button
                type="button"
                onClick={onOpenCreateEvent}
                className="admin-event-quick-add"
                title="Launch a new conference"
              >
                <span>➕</span>
                <span>Add Conference</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className="admin-event-card-collapsed"
            title={`Active: ${activeEvent?.title || 'JASICON 2026'}`}
            onClick={onOpenCreateEvent}
          >
            <span className="admin-event-indicator" />
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
              {(activeEvent?.title || 'EVT').slice(0, 3).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="admin-sidebar-nav">
        {!collapsed && (
          <div className="admin-nav-section-title">ADMIN TOOLS</div>
        )}
        <ul className="admin-nav-list">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="admin-nav-item">
                <Link
                  href={item.href}
                  className={`admin-nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  {!collapsed && (
                    <span className="admin-nav-label">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="admin-nav-badge">{item.badge}</span>
                  )}
                  {!collapsed && isActive && (
                    <span className="admin-nav-active-dot" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer Info */}
      <div className="admin-sidebar-footer">
        {!collapsed ? (
          <div className="admin-footer-box">
            <div className="admin-db-status">
              <span className="admin-db-dot" />
              <span>Neon PostgreSQL Cloud</span>
            </div>
            <div className="admin-version-tag">Evently Console v2.6</div>
          </div>
        ) : (
          <div className="admin-footer-box-collapsed" title="PostgreSQL (Neon Cloud Connected)">
            <span className="admin-db-dot" />
          </div>
        )}
      </div>
    </aside>
  );
}
