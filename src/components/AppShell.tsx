'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { HeaderNav } from '@/components/HeaderNav';
import { AdminSidebar } from '@/components/AdminSidebar';
import { CreateEventModal } from '@/components/CreateEventModal';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('evently_admin_sidebar_collapsed');
      if (saved === 'true') {
        setSidebarCollapsed(true);
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('evently_admin_sidebar_collapsed', String(next));
      } catch {
        // LocalStorage fallback
      }
      return next;
    });
  };

  const fetchSession = () => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.authenticated && d.user?.role) {
          setUserRole(d.user.role);
          setIsSuperAdmin(d.isSuperAdmin || d.user.role === 'ADMIN');
          setActiveEvent(d.event || null);
        } else {
          setUserRole(null);
          setIsSuperAdmin(false);
          setActiveEvent(null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const isLoginPage = pathname === '/login';
  const showAdminSidebar = mounted && isSuperAdmin && !isLoginPage;

  return (
    <div className={`app-shell ${showAdminSidebar ? (sidebarCollapsed ? 'has-admin-sidebar sidebar-collapsed' : 'has-admin-sidebar') : ''}`}>
      {showAdminSidebar && (
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          activeEvent={activeEvent}
          onOpenCreateEvent={() => setCreateModalOpen(true)}
        />
      )}

      <HeaderNav
        userRole={userRole}
        isSuperAdmin={isSuperAdmin}
        activeEvent={activeEvent}
        showAdminSidebar={showAdminSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onOpenCreateEvent={() => setCreateModalOpen(true)}
      />

      <main
        className={`app-container ${
          showAdminSidebar
            ? sidebarCollapsed
              ? 'has-admin-sidebar sidebar-collapsed'
              : 'has-admin-sidebar'
            : ''
        }`}
      >
        {children}
      </main>

      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          setCreateModalOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
