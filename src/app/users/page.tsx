'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VENDOR' | 'VOLUNTEER';
  isActive: boolean;
  assignedEventId?: string | null;
  assignedStationCode?: string | null;
  assignedEvent?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  createdAt: string;
  redemptionsCount: number;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function UsersManagementPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<StaffUser | null>(null);

  // Form State for Adding User
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'OPERATOR' | 'VENDOR' | 'ADMIN' | 'VOLUNTEER'>('OPERATOR');
  const [formEventId, setFormEventId] = useState<string>('');
  const [formStationCode, setFormStationCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Success Created Details Modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    passwordPlain: string;
    role: string;
    eventTitle?: string;
    eventSlug?: string;
    stationCode?: string;
  } | null>(null);

  // Form State for Editing User
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'OPERATOR' | 'VENDOR' | 'ADMIN' | 'VOLUNTEER'>('OPERATOR');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editEventId, setEditEventId] = useState<string>('');
  const [editStationCode, setEditStationCode] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate random readable strong password
  const generateRandomPassword = (role: string) => {
    const prefixes = role === 'OPERATOR' ? ['Desk', 'Counter', 'Reg'] : role === 'VENDOR' ? ['Vendor', 'Meal', 'Food'] : ['Staff', 'Jasi'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const digits = Math.floor(100 + Math.random() * 900);
    const symbols = ['!', '@', '#', '$'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    return `${prefix}${digits}${symbol}`;
  };

  // Load current session
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!d?.authenticated || !d.user) {
          router.replace('/login');
          return;
        }
        if (d.user.role !== 'ADMIN') {
          router.replace(d.user.role === 'VENDOR' ? '/scanner' : '/participants');
          return;
        }
        setCurrentUser(d.user);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  // Load all users & events
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, eventsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/events'),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEventsList(evData.events || []);
        const activeEv = evData.events?.find((e: any) => e.isCurrentActive) || evData.events?.[0];
        if (activeEv) {
          setFormEventId((prev) => prev || activeEv.id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle Add User Submit
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);

    const name = formName.trim();
    const email = formEmail.trim().toLowerCase();
    const password = formPassword.trim();

    if (!name || name.length < 2) {
      setAddFormError('Staff name must be at least 2 characters.');
      return;
    }
    if (!email || !email.includes('@')) {
      setAddFormError('Please enter a valid login email address.');
      return;
    }
    if (!password || password.length < 6) {
      setAddFormError('Password must be at least 6 characters.');
      return;
    }

    try {
      setSubmittingAdd(true);
      const selectedEv = eventsList.find((e) => e.id === formEventId);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role: formRole,
          assignedEventId: formEventId || null,
          assignedStationCode: formRole === 'VENDOR' ? (formStationCode || null) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }

      // Success
      setCreatedCredentials({
        name,
        email,
        passwordPlain: password,
        role: formRole,
        eventTitle: selectedEv?.title,
        eventSlug: selectedEv?.slug,
        stationCode: formRole === 'VENDOR' ? formStationCode : undefined,
      });

      setIsAddModalOpen(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('OPERATOR');
      setFormStationCode('');
      await loadUsers();
      showToast(`Staff account "${name}" created successfully!`);
    } catch (err: unknown) {
      setAddFormError(err instanceof Error ? err.message : 'Error creating account');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPassword('');
    setEditIsActive(u.isActive);
    setEditEventId(u.assignedEventId || '');
    setEditStationCode(u.assignedStationCode || '');
    setEditFormError(null);
  };

  // Handle Edit User Submit
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFormError(null);

    try {
      setSubmittingEdit(true);
      const payload: {
        id: string;
        name: string;
        role: 'ADMIN' | 'OPERATOR' | 'VENDOR' | 'VOLUNTEER';
        isActive: boolean;
        password?: string;
        assignedEventId?: string | null;
        assignedStationCode?: string | null;
      } = {
        id: editingUser.id,
        name: editName.trim(),
        role: editRole,
        isActive: editIsActive,
        assignedEventId: editEventId || null,
        assignedStationCode: editRole === 'VENDOR' ? (editStationCode || null) : null,
      };

      if (editPassword.trim()) {
        if (editPassword.trim().length < 6) {
          setEditFormError('New password must be at least 6 characters.');
          setSubmittingEdit(false);
          return;
        }
        payload.password = editPassword.trim();
      }

      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff account');
      }

      setEditingUser(null);
      await loadUsers();
      showToast(`Account for "${editName}" updated successfully!`);
    } catch (err: unknown) {
      setEditFormError(err instanceof Error ? err.message : 'Error updating account');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    try {
      const res = await fetch(`/api/users?id=${deleteTargetUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      setDeleteTargetUser(null);
      await loadUsers();
      showToast(`Account "${deleteTargetUser.name}" removed successfully.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  // Toggle user active status quickly
  const handleToggleActive = async (u: StaffUser) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own active admin account.');
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: u.id,
          isActive: !u.isActive,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update status');
      }
      await loadUsers();
      showToast(`Account "${u.name}" ${!u.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Copy Login Credentials to Clipboard
  const copyCredentials = (
    name: string,
    email: string,
    role: string,
    pass?: string,
    eventTitle?: string,
    eventSlug?: string,
    stationCode?: string
  ) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventt-nu.vercel.app';
    const evTitle = eventTitle || 'Conference';
    const loginUrl = eventSlug ? `${origin}/login?event=${eventSlug}` : `${origin}/login`;
    const roleLabel =
      role === 'OPERATOR'
        ? 'Registration Desk Operator (Badge Print & Check-in)'
        : role === 'VENDOR'
        ? 'Vendor Station Scanner (Entitlement & Meal Redemptions)'
        : role === 'ADMIN'
        ? 'Super Administrator'
        : 'Conference Volunteer';

    const text = `*${evTitle} Staff Portal Login Credentials*
----------------------------------------
👤 Staff Name: ${name}
🏛️ Assigned Conference: ${evTitle}
🏷️ Assigned Role: ${roleLabel}
${stationCode ? `🍽️ Assigned Counter: ${stationCode}\n` : ''}📧 Login Email / ID: ${email}
${pass ? `🔑 Password: ${pass}\n` : ''}🌐 Staff Login Portal: ${loginUrl}
----------------------------------------
Please keep these credentials confidential.`;

    navigator.clipboard.writeText(text);
    showToast('Login credentials copied to clipboard!');
  };

  // Share via WhatsApp
  const shareCredentialsWhatsApp = (
    name: string,
    email: string,
    role: string,
    pass: string,
    eventTitle?: string,
    eventSlug?: string,
    stationCode?: string
  ) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventt-nu.vercel.app';
    const evTitle = eventTitle || 'Conference';
    const loginUrl = eventSlug ? `${origin}/login?event=${eventSlug}` : `${origin}/login`;
    const roleLabel =
      role === 'OPERATOR'
        ? 'Registration Desk Operator'
        : role === 'VENDOR'
        ? 'Vendor Station Scanner'
        : role === 'ADMIN'
        ? 'Super Administrator'
        : 'Volunteer';

    const text = `*${evTitle} Staff Login Credentials* 🏥✨

Hello ${name},
Here are your official login credentials for the ${evTitle} staff portal:

🏛️ *Conference:* ${evTitle}
🏷️ *Role:* ${roleLabel}
${stationCode ? `🍽️ *Assigned Counter:* ${stationCode}\n` : ''}📧 *Email / Login ID:* ${email}
🔑 *Password:* ${pass}

🌐 *Login Portal:*
${loginUrl}

Please log in and ensure your device is ready. Contact the Organizing Committee for assistance.`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    let result = users;
    if (selectedRoleFilter !== 'ALL') {
      result = result.filter((u) => u.role === selectedRoleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, selectedRoleFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: users.length,
      operators: users.filter((u) => u.role === 'OPERATOR').length,
      vendors: users.filter((u) => u.role === 'VENDOR').length,
      admins: users.filter((u) => u.role === 'ADMIN').length,
      active: users.filter((u) => u.isActive).length,
    };
  }, [users]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OPERATOR':
        return {
          label: 'Registration Desk',
          icon: '💻',
          bg: '#e0f2fe',
          color: '#0369a1',
          border: '#bae6fd',
          desc: 'Check-in & Badges (No Scanner)',
        };
      case 'VENDOR':
        return {
          label: 'Vendor Scanner',
          icon: '📷',
          bg: '#fef3c7',
          color: '#92400e',
          border: '#fde68a',
          desc: 'Meal & Kit Scanner Only',
        };
      case 'ADMIN':
        return {
          label: 'Super Admin',
          icon: '🛡️',
          bg: '#ede9fe',
          color: '#6d28d9',
          border: '#ddd6fe',
          desc: 'Full System Control',
        };
      case 'VOLUNTEER':
      default:
        return {
          label: 'Volunteer',
          icon: '🤝',
          bg: '#f1f5f9',
          color: '#475569',
          border: '#e2e8f0',
          desc: 'Read-only Attendee Lookup',
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1160px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0d625e',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            zIndex: 99999,
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInModal 0.2s ease',
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="card dashboard-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-available">● Staff &amp; Access Control</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              JASICON 2026 Administration
            </span>
          </div>
          <h1 className="dashboard-banner-title">
            Staff Accounts &amp; Credential Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            Provision and configure login credentials for <strong>Registration Desk Operators</strong> and <strong>Vendor Station Scanners</strong>.
          </p>
        </div>

        <div className="dashboard-banner-actions">
          <button
            type="button"
            onClick={() => {
              setFormName('');
              setFormEmail('');
              setFormPassword(generateRandomPassword('OPERATOR'));
              setFormRole('OPERATOR');
              setAddFormError(null);
              setIsAddModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <span>➕</span>
            <span>Add New Staff User</span>
          </button>
          <button
            type="button"
            onClick={loadUsers}
            className="btn btn-secondary"
            title="Refresh staff accounts list"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="card stat-card" style={{ borderLeft: '4px solid #0d625e' }}>
          <div className="stat-label">Total Staff Users</div>
          <div className="stat-value" style={{ color: '#0d625e' }}>{stats.total}</div>
          <div className="stat-desc">{stats.active} Active accounts in system</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="stat-label">Registration Desk Operators</div>
          <div className="stat-value" style={{ color: '#0284c7' }}>{stats.operators}</div>
          <div className="stat-desc">Check-in, badge print &amp; registration</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="stat-label">Vendor Scanners</div>
          <div className="stat-value" style={{ color: '#d97706' }}>{stats.vendors}</div>
          <div className="stat-desc">Meal counters &amp; kit redemption</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="stat-label">Super Administrators</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>{stats.admins}</div>
          <div className="stat-desc">Full system access &amp; governance</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search staff by name or email address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Staff' },
              { id: 'OPERATOR', label: 'Desk Operators' },
              { id: 'VENDOR', label: 'Vendors' },
              { id: 'ADMIN', label: 'Admins' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRoleFilter(tab.id)}
                className={`btn btn-sm ${selectedRoleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '9999px', fontSize: '0.82rem', padding: '6px 14px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Accounts List / Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <div>Loading staff accounts and permissions...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div>{error}</div>
            <button onClick={loadUsers} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
              Try Again
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-heading)' }}>
              No Staff Accounts Found
            </div>
            <p style={{ marginTop: '0.4rem', fontSize: '0.88rem' }}>
              {searchQuery
                ? `No accounts matching "${searchQuery}". Try a different search.`
                : 'Click "+ Add New Staff User" above to create desk operators and vendors.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Staff Name &amp; Login ID</th>
                  <th style={{ width: '25%' }}>Assigned Role</th>
                  <th style={{ width: '13%' }}>Account Status</th>
                  <th style={{ width: '12%' }}>Activity</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isCurrent = u.id === currentUser?.id;
                  const initials = u.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join('');

                  return (
                    <tr key={u.id}>
                      {/* Name & Email */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              background: roleBadge.bg,
                              color: roleBadge.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              border: `1px solid ${roleBadge.border}`,
                              flexShrink: 0,
                            }}
                          >
                            {initials || 'ST'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Permissions */}
                      <td>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: roleBadge.bg,
                            color: roleBadge.color,
                            border: `1px solid ${roleBadge.border}`,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                          }}
                        >
                          <span>{roleBadge.icon}</span>
                          <span>{roleBadge.label}</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {roleBadge.desc}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '2px 7px',
                              color: '#334155',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Assigned Conference"
                          >
                            <span>🏛️</span>
                            <span>{u.assignedEvent?.title || 'Global / Unassigned'}</span>
                          </span>
                          {u.assignedStationCode && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                background: '#fef3c7',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                padding: '2px 7px',
                                color: '#92400e',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Locked Station Counter"
                            >
                              <span>🍽️</span>
                              <span>{u.assignedStationCode}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active Status Toggle */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          disabled={isCurrent}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            border: u.isActive ? '1px solid #a7f3d0' : '1px solid #fca5a5',
                            background: u.isActive ? '#ecfdf5' : '#fef2f2',
                            color: u.isActive ? '#065f46' : '#991b1b',
                            cursor: isCurrent ? 'not-allowed' : 'pointer',
                          }}
                          title={isCurrent ? 'Cannot deactivate your own account' : 'Click to toggle status'}
                        >
                          <span>{u.isActive ? '●' : '○'}</span>
                          <span>{u.isActive ? 'Active' : 'Suspended'}</span>
                        </button>
                      </td>

                      {/* Redemptions / Activity */}
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                          {u.redemptionsCount} scans
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Copy credentials button */}
                          <button
                            type="button"
                            onClick={() =>
                              copyCredentials(
                                u.name,
                                u.email,
                                u.role,
                                undefined,
                                u.assignedEvent?.title,
                                u.assignedEvent?.slug,
                                u.assignedStationCode || undefined
                              )
                            }
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 9px', fontSize: '0.78rem' }}
                            title="Copy login details to clipboard"
                          >
                            📋 Copy
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 9px', fontSize: '0.78rem' }}
                            title="Edit user details or reset password"
                          >
                            ✏️ Edit
                          </button>

                          {/* Delete button */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetUser(u)}
                              className="btn btn-sm"
                              style={{
                                padding: '5px 9px',
                                fontSize: '0.78rem',
                                color: '#dc2626',
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                              }}
                              title="Delete staff account"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD NEW STAFF USER MODAL                                              */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          className="profile-modal-overlay"
          onClick={() => !submittingAdd && setIsAddModalOpen(false)}
        >
          <div
            className="profile-modal-card"
            style={{ maxWidth: '580px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with red hover cross close button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="modal-top-close-btn"
              title="Close modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                ➕
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Add New Staff User
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Assign role, display name, and login credentials for event operations.
                </p>
              </div>
            </div>

            {addFormError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{addFormError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Role Selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-heading)' }}>
                  Select Staff Role &amp; Permissions *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {/* Desk Operator Option */}
                  <label
                    style={{
                      border: formRole === 'OPERATOR' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                      background: formRole === 'OPERATOR' ? '#f0f9ff' : 'var(--bg-subtle)',
                      borderRadius: '12px',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="OPERATOR"
                      checked={formRole === 'OPERATOR'}
                      onChange={() => {
                        setFormRole('OPERATOR');
                        if (!formPassword) setFormPassword(generateRandomPassword('OPERATOR'));
                      }}
                      style={{ position: 'absolute', opacity: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' }}>
                      <span>💻</span> Registration Desk
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      Check-in, spot registrations, badge printing. <strong>No scanner access.</strong>
                    </div>
                  </label>

                  {/* Vendor Option */}
                  <label
                    style={{
                      border: formRole === 'VENDOR' ? '2px solid #d97706' : '1px solid var(--border-color)',
                      background: formRole === 'VENDOR' ? '#fffbeb' : 'var(--bg-subtle)',
                      borderRadius: '12px',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="VENDOR"
                      checked={formRole === 'VENDOR'}
                      onChange={() => {
                        setFormRole('VENDOR');
                        if (!formPassword) setFormPassword(generateRandomPassword('VENDOR'));
                      }}
                      style={{ position: 'absolute', opacity: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#b45309', fontSize: '0.9rem' }}>
                      <span>📷</span> Vendor Station
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      Camera QR scanner only for meals, kits &amp; session passes.
                    </div>
                  </label>

                  {/* Administrator Option */}
                  <label
                    style={{
                      border: formRole === 'ADMIN' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                      background: formRole === 'ADMIN' ? '#faf5ff' : 'var(--bg-subtle)',
                      borderRadius: '12px',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="ADMIN"
                      checked={formRole === 'ADMIN'}
                      onChange={() => setFormRole('ADMIN')}
                      style={{ position: 'absolute', opacity: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#6d28d9', fontSize: '0.9rem' }}>
                      <span>🛡️</span> Super Admin
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      Complete system privileges, audit logs &amp; user management.
                    </div>
                  </label>

                  {/* Volunteer Option */}
                  <label
                    style={{
                      border: formRole === 'VOLUNTEER' ? '2px solid #0d625e' : '1px solid var(--border-color)',
                      background: formRole === 'VOLUNTEER' ? '#f0fdfa' : 'var(--bg-subtle)',
                      borderRadius: '12px',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="VOLUNTEER"
                      checked={formRole === 'VOLUNTEER'}
                      onChange={() => setFormRole('VOLUNTEER')}
                      style={{ position: 'absolute', opacity: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f766e', fontSize: '0.9rem' }}>
                      <span>🤝</span> Volunteer
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      Read-only participant and delegate information lookup.
                    </div>
                  </label>
                </div>
              </div>

              {/* Assigned Conference Selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  🏛️ Assigned Conference / Event *
                </label>
                <select
                  value={formEventId}
                  onChange={(e) => {
                    setFormEventId(e.target.value);
                    setFormStationCode('');
                  }}
                  className="form-control"
                  style={{ width: '100%', fontWeight: 600 }}
                  required
                >
                  {eventsList.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} {ev.city ? `(${ev.city})` : ''} {ev.isCurrentActive ? '★ (Active Now)' : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {formRole === 'ADMIN'
                    ? 'Default starting conference for this admin account.'
                    : 'The staff account will be strictly locked to this conference and cannot view or access other events.'}
                </span>
              </div>

              {/* If Vendor, select specific Station Counter */}
              {formRole === 'VENDOR' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                    🍽️ Assigned Station / Meal Counter *
                  </label>
                  <select
                    value={formStationCode}
                    onChange={(e) => setFormStationCode(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  >
                    <option value="">All Stations (Unrestricted scanning for this conference)</option>
                    {(() => {
                      const selEv = eventsList.find((e) => e.id === formEventId);
                      const stList: Array<{ code: string; label?: string; title?: string }> = Array.isArray(selEv?.stations) ? selEv.stations : [];
                      return stList.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label || s.title || s.code} ({s.code})
                        </option>
                      ));
                    })()}
                  </select>
                  <span style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    🔒 Security: This vendor will ONLY be authorized to scan and redeem this specific counter.
                  </span>
                </div>
              )}

              {/* Staff Display Name */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  Staff Full Name / Counter Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formRole === 'OPERATOR'
                      ? 'e.g. Counter 1 - Registration Desk'
                      : formRole === 'VENDOR'
                      ? 'e.g. Food Stall A - Lunch Counter'
                      : 'e.g. Dr. Ramesh Gupta'
                  }
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Login Email */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  Login Email / Username *
                </label>
                <input
                  type="email"
                  required
                  placeholder={
                    formRole === 'OPERATOR'
                      ? 'e.g. desk1@jasicon2026.com'
                      : formRole === 'VENDOR'
                      ? 'e.g. vendor.lunch@jasicon2026.com'
                      : 'e.g. staff@jasicon2026.com'
                  }
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  The user will enter this email address on the login screen.
                </span>
              </div>

              {/* Password with generator & show toggle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)' }}>
                    Password Credentials *
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormPassword(generateRandomPassword(formRole))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🎲 Generate Secure Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 6 characters password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '45px' }}
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
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submittingAdd}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="btn btn-primary"
                  style={{ fontWeight: 700, minWidth: '150px' }}
                >
                  {submittingAdd ? 'Provisioning...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CREATED CREDENTIALS CONFIRMATION MODAL                                */}
      {/* ========================================================================= */}
      {createdCredentials && (
        <div
          className="profile-modal-overlay"
          onClick={() => setCreatedCredentials(null)}
        >
          <div
            className="profile-modal-card"
            style={{ maxWidth: '520px', padding: '2rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              Staff Account Ready!
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '1.5rem' }}>
              The account for <strong>{createdCredentials.name}</strong> has been created. Share these credentials with the staff member:
            </p>

            {/* Credential Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Assigned Conference:</span>
                <span style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '0.95rem' }}>
                  🏛️ {createdCredentials.eventTitle || 'All Conferences (Global)'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Assigned Role:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {createdCredentials.role === 'OPERATOR'
                    ? '💻 Registration Desk Operator'
                    : createdCredentials.role === 'VENDOR'
                    ? '📷 Vendor Station Scanner'
                    : createdCredentials.role}
                </span>
              </div>
              {createdCredentials.stationCode && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Locked Counter:</span>
                  <span style={{ fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                    🍽️ {createdCredentials.stationCode}
                  </span>
                </div>
              )}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Login Email / ID:</span>
                <code style={{ fontSize: '0.95rem', fontWeight: 700, background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                  {createdCredentials.email}
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Password:</span>
                <code style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                  {createdCredentials.passwordPlain}
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Custom Login Portal:</span>
                <a
                  href={createdCredentials.eventSlug ? `/login?event=${createdCredentials.eventSlug}` : '/login'}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/login${createdCredentials.eventSlug ? `?event=${createdCredentials.eventSlug}` : ''}`
                    : `https://eventt-nu.vercel.app/login${createdCredentials.eventSlug ? `?event=${createdCredentials.eventSlug}` : ''}`}
                </a>
              </div>
            </div>

            {/* Sharing buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() =>
                  copyCredentials(
                    createdCredentials.name,
                    createdCredentials.email,
                    createdCredentials.role,
                    createdCredentials.passwordPlain,
                    createdCredentials.eventTitle,
                    createdCredentials.eventSlug,
                    createdCredentials.stationCode
                  )
                }
                className="btn btn-secondary"
                style={{ fontWeight: 700 }}
              >
                📋 Copy All Details
              </button>
              <button
                type="button"
                onClick={() =>
                  shareCredentialsWhatsApp(
                    createdCredentials.name,
                    createdCredentials.email,
                    createdCredentials.role,
                    createdCredentials.passwordPlain,
                    createdCredentials.eventTitle,
                    createdCredentials.eventSlug,
                    createdCredentials.stationCode
                  )
                }
                className="btn"
                style={{
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📱</span> Send via WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. EDIT STAFF USER MODAL                                                 */}
      {/* ========================================================================= */}
      {editingUser && (
        <div
          className="profile-modal-overlay"
          onClick={() => !submittingEdit && setEditingUser(null)}
        >
          <div
            className="profile-modal-card"
            style={{ maxWidth: '540px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with red hover cross close button */}
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="modal-top-close-btn"
              title="Close modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                ✏️
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Edit Staff Account
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {editingUser.email}
                </p>
              </div>
            </div>

            {editFormError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  marginBottom: '1rem',
                }}
              >
                ⚠️ {editFormError}
              </div>
            )}

            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  Staff Name / Counter Label
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Role Selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  Assigned Role &amp; Permissions
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="form-control"
                  style={{ width: '100%' }}
                >
                  <option value="OPERATOR">💻 Registration Desk Operator (Check-in, Badges - No Scanner)</option>
                  <option value="VENDOR">📷 Vendor Station Scanner (Meals &amp; Kits Only)</option>
                  <option value="ADMIN">🛡️ Super Administrator (Full Control)</option>
                  <option value="VOLUNTEER">🤝 Volunteer (Read-Only)</option>
                </select>
              </div>

              {/* Assigned Conference */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                  🏛️ Assigned Conference / Event
                </label>
                <select
                  value={editEventId}
                  onChange={(e) => {
                    setEditEventId(e.target.value);
                    setEditStationCode('');
                  }}
                  className="form-control"
                  style={{ width: '100%', fontWeight: 600 }}
                >
                  <option value="">Global / Unassigned (Admin Only)</option>
                  {eventsList.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} {ev.city ? `(${ev.city})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Restricts this staff member exclusively to this conference.
                </span>
              </div>

              {/* If Vendor, Station Counter */}
              {editRole === 'VENDOR' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-heading)' }}>
                    🍽️ Assigned Station / Meal Counter
                  </label>
                  <select
                    value={editStationCode}
                    onChange={(e) => setEditStationCode(e.target.value)}
                    className="form-control"
                    style={{ width: '100%' }}
                  >
                    <option value="">All Stations (Unrestricted scanning for this conference)</option>
                    {(() => {
                      const selEv = eventsList.find((e) => e.id === editEventId);
                      const stList: Array<{ code: string; label?: string; title?: string }> = Array.isArray(selEv?.stations) ? selEv.stations : [];
                      return stList.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label || s.title || s.code} ({s.code})
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              )}

              {/* Reset Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)' }}>
                    Reset Password (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditPassword(generateRandomPassword(editRole))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🎲 Generate New
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Leave blank to keep existing password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="form-control"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Only fill this if you want to change the staff user&apos;s password.
                </span>
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="editIsActive" style={{ fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: 'var(--text-heading)' }}>
                  Account is Active (User is permitted to log in)
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={submittingEdit}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DELETE CONFIRMATION DIALOG                                            */}
      {/* ========================================================================= */}
      {deleteTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setDeleteTargetUser(null)}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-heading, #0f172a)',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Delete Staff Account
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Permanent account removal
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
              Are you sure you want to delete the staff account for <strong>{deleteTargetUser.name}</strong> (<code>{deleteTargetUser.email}</code>)?
              The user will immediately lose portal access.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="btn"
                style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700 }}
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
