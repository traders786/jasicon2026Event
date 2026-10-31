'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ParticipantBadge } from './ParticipantBadge';

export interface EntitlementItem {
  id: string;
  code: string;
  title: string;
  category: 'MEAL' | 'SESSION';
  status: 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'REVOKED';
  redeemedAt: string | null;
}

export interface ActivityLogItem {
  id: string;
  result: string;
  scannedAt: string;
  notes: string | null;
  itemTitle: string;
  operatorName: string;
}

export interface ParticipantDetailData {
  id: string;
  ticketCode: string;
  status: string;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
  accompanyingPersons?: Array<{ name: string; relation?: string }> | null;
  qrPayload: string;
  qrDataUrl: string;
  person: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    photoUrl: string | null;
  };
  event: {
    id: string;
    title: string;
    venue: string;
    startDate: string;
    endDate: string;
    logoUrl?: string | null;
  };
  entitlements: EntitlementItem[];
  meals: EntitlementItem[];
  sessions: EntitlementItem[];
  stats: {
    mealsTotal: number;
    mealsRedeemed: number;
    sessionsTotal: number;
    sessionsRedeemed: number;
    checkedIn: boolean;
  };
  recentActivity: ActivityLogItem[];
}

interface ParticipantProfileViewProps {
  participantId: string;
  initialData?: ParticipantDetailData | null;
  initialTab?: 'details' | 'badge' | 'entitlements' | 'logs';
  onClose?: () => void;
  onUpdate?: () => void;
  onDelete?: (deletedId: string) => void;
}

export function ParticipantProfileView({
  participantId,
  initialData,
  initialTab = 'details',
  onClose,
  onUpdate,
  onDelete,
}: ParticipantProfileViewProps) {
  const [data, setData] = useState<ParticipantDetailData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [activeTab, setActiveTab] = useState<'details' | 'badge' | 'entitlements' | 'logs'>(initialTab);

  // Photo Upload State
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Role & Delete State
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editTicketCode, setEditTicketCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Check-In toggle state
  const [togglingCheckIn, setTogglingCheckIn] = useState(false);

  // Copy status state
  const [copiedToken, setCopiedToken] = useState(false);

  // Fetch current user role once
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.authenticated && d.user?.role) {
          setCurrentUserRole(d.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const fetchParticipant = useCallback(async () => {
    try {
      const res = await fetch(`/api/registrations/${participantId}`);
      if (!res.ok) throw new Error('Participant not found');
      const json = await res.json();
      setData(json.registration);
      setEditFirstName(json.registration.person.firstName || '');
      setEditLastName(json.registration.person.lastName || '');
      setEditEmail(json.registration.person.email || '');
      setEditPhone(json.registration.person.phone || '');
      setEditCompany(json.registration.person.company || '');
      setEditJobTitle(json.registration.person.jobTitle || '');
      setEditTicketCode(json.registration.ticketCode || '');
    } catch (err: unknown) {
      console.error('Failed to load participant:', err);
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    if (!initialData) {
      void fetchParticipant();
    } else {
      setEditFirstName(initialData.person.firstName || '');
      setEditLastName(initialData.person.lastName || '');
      setEditEmail(initialData.person.email || '');
      setEditPhone(initialData.person.phone || '');
      setEditCompany(initialData.person.company || '');
      setEditJobTitle(initialData.person.jobTitle || '');
      setEditTicketCode(initialData.ticketCode || '');
    }
  }, [initialData, fetchParticipant]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/registrations/${participantId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete registration');
      }
      if (onDelete) {
        onDelete(participantId);
      } else {
        if (onUpdate) onUpdate();
        if (onClose) onClose();
        else if (typeof window !== 'undefined') {
          window.location.href = '/participants';
        }
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
      setDeleting(false);
    }
  };

  // Handle Photo File Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoMessage({ type: 'error', text: 'Please choose an image file (JPG, PNG, or WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoMessage({ type: 'error', text: 'File size must be less than 5 MB.' });
      return;
    }

    setUploadingPhoto(true);
    setPhotoMessage(null);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(`/api/registrations/${participantId}/photo`, {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to upload photo');
      }

      setPhotoMessage({ type: 'success', text: 'Profile photo uploaded successfully!' });
      // Update local state immediately
      setData((prev) =>
        prev
          ? {
              ...prev,
              person: {
                ...prev.person,
                photoUrl: resData.photoUrl,
              },
            }
          : null
      );
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      setPhotoMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Photo upload failed',
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Save Info Edits
  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditMessage(null);

    try {
      const res = await fetch(`/api/registrations/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail,
          phone: editPhone,
          company: editCompany,
          jobTitle: editJobTitle,
          ticketCode: editTicketCode,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save changes');

      setData((prev) =>
        prev
          ? {
              ...prev,
              ticketCode: editTicketCode.trim().toUpperCase() || prev.ticketCode,
              person: {
                ...prev.person,
                name: `${editFirstName} ${editLastName}`.trim(),
                firstName: editFirstName,
                lastName: editLastName,
                email: editEmail.trim().toLowerCase() || prev.person.email,
                phone: editPhone || null,
                company: editCompany || null,
                jobTitle: editJobTitle || null,
              },
            }
          : null
      );
      setIsEditing(false);
      setEditMessage('Details updated successfully!');
      if (onUpdate) onUpdate();
    } catch (err: unknown) {
      setEditMessage(err instanceof Error ? err.message : 'Failed to update details');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Check-In status
  const handleToggleCheckIn = async () => {
    if (!data) return;
    setTogglingCheckIn(true);
    const newStatus = data.status === 'CHECKED_IN' ? 'CONFIRMED' : 'CHECKED_IN';

    try {
      const res = await fetch(`/api/registrations/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setData((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              checkedInAt: newStatus === 'CHECKED_IN' ? new Date().toISOString() : null,
              stats: {
                ...prev.stats,
                checkedIn: newStatus === 'CHECKED_IN',
              },
            }
          : null
      );
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingCheckIn(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleHeaderPrintBadge = () => {
    if (activeTab === 'badge') {
      const printBtn = document.querySelector('.badge-toolbar button.btn-primary') as HTMLButtonElement | null;
      if (printBtn) {
        printBtn.click();
      } else {
        window.print();
      }
    } else {
      setActiveTab('badge');
      setTimeout(() => {
        const printBtn = document.querySelector('.badge-toolbar button.btn-primary') as HTMLButtonElement | null;
        if (printBtn) {
          printBtn.click();
        } else {
          window.print();
        }
      }, 150);
    }
  };

  const handleSendWhatsApp = () => {
    if (!data) return;
    let phone = data.person.phone?.trim() || '';
    if (!phone) {
      const input = window.prompt("Doctor's phone number is missing. Please enter their 10-digit mobile number for WhatsApp:", "");
      if (!input) return;
      phone = input.trim();
    }
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      alert('Please enter a valid mobile number with at least 10 digits.');
      return;
    }
    const formattedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventt-nu.vercel.app';
    const badgeUrl = `${origin}/badge/${data.ticketCode}`;
    const cleanName = data.person.name.trim().replace(/^Dr\.?\s+/i, '');
    const displayName = `Dr. ${cleanName}`;
    const categoryText = (data.person.jobTitle || 'Delegate').toUpperCase();

    const confTitle = data.event?.title || 'Conference';
    const confVenue = data.event?.venue || '';

    const text = `Dear ${displayName},

Greetings from ${confTitle}! 🏥✨
Here are your official conference registration and digital badge details:

📋 Delegate: ${displayName}
🎫 Ticket Code: ${data.ticketCode}
🏛️ Conference: ${confTitle}
${confVenue ? `📍 Venue: ${confVenue}\n` : ''}✅ Status: CONFIRMED

📱 View & Download your Digital Badge & QR Code online:
${badgeUrl}

Please present your QR code at the registration desk for quick check-in and access to conference meals & academic sessions.

Warm regards,
Organizing Committee, ${confTitle}`;

    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
        <div>Loading attendee profile and QR code...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <div>Attendee record not found.</div>
        {onClose && (
          <button onClick={onClose} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Back to Participants
          </button>
        )}
      </div>
    );
  }

  const initials = data.person.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <div className="profile-container" style={{ position: 'relative' }}>
      {/* Dedicated Top-Right Close Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="modal-top-close-btn no-print"
          title="Close (Esc)"
          aria-label="Close Profile"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}

      {/* Top Banner / Header Card */}
      <div className="profile-header-card no-print" style={{ paddingRight: '2.5rem' }}>
        <div className="profile-header-main">
          {/* Avatar / Photo with upload trigger */}
          <div className="profile-avatar-container">
            {data.person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.person.photoUrl}
                alt={data.person.name}
                className="profile-avatar-image"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                <span>{initials || 'EC'}</span>
              </div>
            )}

            {/* Photo Upload Trigger Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="photo-upload-badge-btn"
              title="Upload or change profile picture"
            >
              {uploadingPhoto ? '⏳' : '📷'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />
          </div>

          {/* Attendee Summary */}
          <div className="profile-info-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 className="profile-name-title">{data.person.name}</h2>
              <code className="profile-ticket-pill">{data.ticketCode}</code>
              {data.status === 'CHECKED_IN' ? (
                <span className="badge badge-available">✓ CHECKED-IN</span>
              ) : (
                <span className="badge badge-pending">CONFIRMED</span>
              )}
            </div>

            <div className="profile-meta-line">
              {data.person.jobTitle && <span>{data.person.jobTitle} • </span>}
              <span>{data.person.company || 'Independent Attendee'}</span>
            </div>

            <div className="profile-contact-line">
              <span>✉️ {data.person.email}</span>
              {data.person.phone && <span> • 📞 {data.person.phone}</span>}
            </div>

            {photoMessage && (
              <div
                style={{
                  fontSize: '0.85rem',
                  marginTop: '0.5rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background:
                    photoMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: photoMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {photoMessage.text}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="profile-actions-block">
            <button
              type="button"
              onClick={handleHeaderPrintBadge}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              title={activeTab === 'badge' ? 'Print conference badge now' : 'Switch to Badge preview'}
            >
              <span>🖨️</span>
              <span>{activeTab === 'badge' ? 'Print Badge Now' : 'Print Badge'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#25D366',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
                cursor: 'pointer',
              }}
              title="Send conference badge and digital link to doctor on WhatsApp"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.554 1.833.821 2.806.821h.005c3.182 0 5.768-2.586 5.769-5.766.001-3.182-2.585-5.77-5.769-5.772zm3.377 8.169c-.14.394-.716.726-1.026.77-.31.045-.694.075-2.036-.45-1.579-.619-2.588-2.228-2.667-2.333-.078-.105-.644-.858-.644-1.637 0-.779.408-1.162.553-1.32.146-.157.319-.197.426-.197.106 0 .213 0 .306.005.099.006.232-.037.363.277.135.324.462 1.127.502 1.209.04.082.067.177.013.285-.053.107-.08.174-.159.266-.08.093-.167.207-.239.278-.08.08-.163.167-.07.327.093.16.413.682.887 1.103.61.543 1.124.71 1.284.79.16.08.253.067.347-.04.093-.107.4-466.507-.626.107-.16.213-.133.36-.08.146.053.931.439 1.091.518.16.08.267.12.307.186.04.067.04.387-.1 1.082z" />
              </svg>
              <span>WhatsApp Badge</span>
            </button>

            <button
              onClick={handleToggleCheckIn}
              disabled={togglingCheckIn}
              className={`btn ${data.status === 'CHECKED_IN' ? 'btn-secondary' : 'btn-success'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{data.status === 'CHECKED_IN' ? '↩ Revert Check-in' : '✓ Check-in Attendee'}</span>
            </button>

            {currentUserRole === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontWeight: 700,
                }}
                title="Permanently delete registration (Super Admin)"
              >
                <span>🗑️</span>
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tab-bar">
          <button
            onClick={() => setActiveTab('details')}
            className={`profile-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          >
            📋 Profile &amp; QR Code
          </button>
          <button
            onClick={() => setActiveTab('badge')}
            className={`profile-tab-btn ${activeTab === 'badge' ? 'active' : ''}`}
          >
            🖨️ Badge &amp; Print Preview
          </button>
          <button
            onClick={() => setActiveTab('entitlements')}
            className={`profile-tab-btn ${activeTab === 'entitlements' ? 'active' : ''}`}
          >
            🍽️ Entitlements ({data.stats.mealsRedeemed + data.stats.sessionsRedeemed} / 19)
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`profile-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          >
            🕒 Scan History ({data.recentActivity.length})
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DETAILS & QR CODE */}
      {/* ======================================================== */}
      {activeTab === 'details' && (
        <div className="profile-tab-content no-print">
          <div className="profile-two-col">
            {/* Left Column: QR Code & Badge Quick Access */}
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '1rem' }}>
                Official Scannable QR Code
              </h3>

              <div
                style={{
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '16px',
                  display: 'inline-block',
                  boxShadow: 'var(--shadow-md)',
                  border: '2px solid var(--primary)',
                }}
              >
                {data.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.qrDataUrl}
                    alt={`QR Code for ${data.ticketCode}`}
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    Loading QR...
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <code
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {data.ticketCode}
                </code>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('badge')}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>🖨️</span> Print Badge
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="btn btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Send badge and QR to doctor on WhatsApp"
                >
                  <span>📱</span> WhatsApp Badge
                </button>
                <a
                  href={data.qrDataUrl}
                  download={`QR-${data.ticketCode}.png`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                >
                  <span>📥</span> Save QR Image
                </a>
              </div>

              {/* Raw Payload & Copy */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                    QR Scanner Payload
                  </span>
                  <button
                    onClick={() => copyToClipboard(data.qrPayload)}
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                  >
                    {copiedToken ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
                <code style={{ fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                  {data.qrPayload}
                </code>
              </div>

              {/* Photo Upload Box in Left Column */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle)',
                  border: '1px dashed var(--primary)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.35rem' }}>
                  Attendee Photo
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {data.person.photoUrl
                    ? 'Photo uploaded. You can replace it at any time.'
                    : 'No photo uploaded. Uploading a photo adds attendee portrait to printed badges.'}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>📷</span>
                  <span>{uploadingPhoto ? 'Uploading Photo...' : data.person.photoUrl ? 'Replace Photo' : 'Upload Profile Photo'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Participant Details & Edit Form */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  Personal Information
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>{isEditing ? '✕ Cancel' : '✏️ Edit Info'}</span>
                </button>
              </div>

              {editMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    fontSize: '0.85rem',
                  }}
                >
                  {editMessage}
                </div>
              )}

              {isEditing ? (
                /* Edit Form */
                <form onSubmit={handleSaveEdits} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">First Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Last Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                      placeholder="attendee@example.com"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Ticket Code / Badge ID</label>
                      {currentUserRole === 'ADMIN' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Super Admin Override</span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={editTicketCode}
                      onChange={(e) => setEditTicketCode(e.target.value)}
                      required
                      disabled={currentUserRole !== 'ADMIN'}
                      placeholder="JAS-2026-XXXX"
                      style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.5px' }}
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                      {currentUserRole === 'ADMIN'
                        ? 'Note: Updating the ticket code automatically recalculates the participant QR barcode and badge pass.'
                        : 'Ticket codes are generated upon registration and can only be modified by Super Admins.'}
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Company / Hospital / Institute</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      placeholder="e.g. AIIMS New Delhi"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Job Title / Designation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      placeholder="e.g. Consultant Surgeon"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="submit" disabled={savingEdit} className="btn btn-primary">
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* Read-Only Details Grid */
                <div className="profile-details-grid">
                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Full Name</span>
                    <span className="profile-detail-val">{data.person.name}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Email Address</span>
                    <span className="profile-detail-val">{data.person.email}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Phone Number</span>
                    <span className="profile-detail-val">{data.person.phone || '—'}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Organization / Hospital</span>
                    <span className="profile-detail-val">{data.person.company || '—'}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Job Title / Role</span>
                    <span className="profile-detail-val">{data.person.jobTitle || '—'}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Registration Ticket</span>
                    <span className="profile-detail-val">
                      <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{data.ticketCode}</code>
                    </span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Event</span>
                    <span className="profile-detail-val">{data.event.title}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Venue</span>
                    <span className="profile-detail-val">{data.event.venue}</span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Registered On</span>
                    <span className="profile-detail-val">
                      {new Date(data.createdAt).toLocaleDateString()} at{' '}
                      {new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="profile-detail-cell">
                    <span className="profile-detail-label">Check-in Status</span>
                    <span className="profile-detail-val">
                      {data.checkedInAt ? (
                        <span style={{ color: 'var(--success)' }}>
                          Checked in at {new Date(data.checkedInAt).toLocaleTimeString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>Not checked in yet</span>
                      )}
                    </span>
                  </div>

                  {data.accompanyingPersons && data.accompanyingPersons.length > 0 && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        background: '#f0fdf9',
                        border: '1.5px solid #0d625e',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginTop: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>👥</span>
                        <span style={{ fontWeight: 800, color: '#0d625e', fontSize: '0.9rem' }}>
                          Accompanying Persons ({data.accompanyingPersons.length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {data.accompanyingPersons.map((acc, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#ffffff',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #a7f3d0',
                              fontSize: '0.84rem',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              #{idx + 1} {acc.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#065f46',
                                background: '#ecfdf5',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              {acc.relation || 'Guest'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Entitlement Summary Bar */}
              <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                    Access Entitlements Overview
                  </h4>
                  <button
                    onClick={() => setActiveTab('entitlements')}
                    className="btn btn-secondary btn-sm"
                  >
                    View All 19 Items →
                  </button>
                </div>

                <div className="form-grid-2">
                  {/* Meals Progress */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: '#d97706', fontWeight: 600 }}>🍽️ Meals</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        {data.stats.mealsRedeemed} / {data.stats.mealsTotal}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div
                        style={{
                          width: `${(data.stats.mealsRedeemed / (data.stats.mealsTotal || 1)) * 100}%`,
                          height: '100%',
                          background: '#f59e0b',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Sessions Progress */}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🎓 Sessions</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        {data.stats.sessionsRedeemed} / {data.stats.sessionsTotal}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div
                        style={{
                          width: `${(data.stats.sessionsRedeemed / (data.stats.sessionsTotal || 1)) * 100}%`,
                          height: '100%',
                          background: 'var(--primary)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Super Admin Danger Zone */}
            {currentUserRole === 'ADMIN' && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  marginTop: '1.5rem',
                  border: '1px solid #fecaca',
                  background: 'rgba(239, 68, 68, 0.03)',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#dc2626', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️</span> Super Admin Danger Zone
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Permanently remove this registration, barcode pass, all 19 entitlements, and activity logs from the database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn"
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 600,
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    🗑️ Delete Registration
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BADGE & PRINT PREVIEW */}
      {/* ======================================================== */}
      {activeTab === 'badge' && (
        <div className="profile-tab-content">
          <ParticipantBadge
            registrationId={data.id}
            ticketCode={data.ticketCode}
            status={data.status}
            person={data.person}
            event={data.event}
            qrDataUrl={data.qrDataUrl}
            qrPayload={data.qrPayload}
            category={data.person.jobTitle || 'DELEGATE'}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ALL 19 ENTITLEMENTS */}
      {/* ======================================================== */}
      {activeTab === 'entitlements' && (
        <div className="profile-tab-content no-print">
          {/* Meals (9 Items) */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  🍽️ Meals &amp; Catering Entitlements (9 Total)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Day 1, Day 2, and Day 3 Breakfast, Lunch, and Dinner redemptions
                </p>
              </div>
              <span className="badge badge-warning">
                {data.stats.mealsRedeemed} of {data.stats.mealsTotal} Redeemed
              </span>
            </div>

            <div className="matrix-grid">
              {data.meals.map((meal) => (
                <div
                  key={meal.id}
                  className={`matrix-item ${meal.status === 'REDEEMED' ? 'redeemed' : ''}`}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.9rem' }}>{meal.title}</div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{meal.code}</code>
                    {meal.redeemedAt && (
                      <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '2px' }}>
                        ✓ Claimed at {new Date(meal.redeemedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div>
                    {meal.status === 'REDEEMED' ? (
                      <span className="badge badge-redeemed">REDEEMED</span>
                    ) : (
                      <span className="badge badge-available">AVAILABLE</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions (10 Items) */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  🎓 Conference Sessions (10 Total)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Keynotes, Plenary sessions, and Specialized Workshops
                </p>
              </div>
              <span className="badge badge-info" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                {data.stats.sessionsRedeemed} of {data.stats.sessionsTotal} Redeemed
              </span>
            </div>

            <div className="matrix-grid">
              {data.sessions.map((session) => (
                <div
                  key={session.id}
                  className={`matrix-item ${session.status === 'REDEEMED' ? 'redeemed' : ''}`}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.9rem' }}>{session.title}</div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{session.code}</code>
                    {session.redeemedAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px' }}>
                        ✓ Verified at {new Date(session.redeemedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <div>
                    {session.status === 'REDEEMED' ? (
                      <span className="badge badge-redeemed">REDEEMED</span>
                    ) : (
                      <span className="badge badge-available">AVAILABLE</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SCAN HISTORY & AUDIT TRAIL */}
      {/* ======================================================== */}
      {activeTab === 'logs' && (
        <div className="profile-tab-content no-print">
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
              Redemption Audit Log
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Cryptographically verified audit trail of all scans, badge check-ins, and meal/session redemptions
            </p>

            {data.recentActivity.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No redemptions or scans recorded yet for this attendee.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action / Item</th>
                      <th>Result</th>
                      <th>Scanner / Staff</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentActivity.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.scannedAt).toLocaleTimeString()}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {new Date(log.scannedAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{log.itemTitle}</td>
                        <td>
                          {log.result === 'SUCCESS' ? (
                            <span className="badge badge-available">SUCCESS</span>
                          ) : (
                            <span className="badge badge-danger">{log.result}</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{log.operatorName}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {log.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Super Admin Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
          onClick={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-heading, #0f172a)',
              borderRadius: '16px',
              maxWidth: '480px',
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
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#dc2626' }}>
                  Delete Registration?
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                  Super Admin Permanent Deletion
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-body, #334155)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Are you sure you want to delete the registration for{' '}
              <strong>
                {data.person.firstName} {data.person.lastName}
              </strong>{' '}
              (<code>{data.ticketCode}</code>)?
            </p>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#991b1b',
                marginBottom: '1.25rem',
                lineHeight: 1.4,
              }}
            >
              <strong>Notice:</strong> This action is irreversible. It will permanently remove:
              <ul style={{ margin: '6px 0 0 1rem', padding: 0 }}>
                <li>All 19 meal &amp; session entitlements</li>
                <li>QR code ticket and check-in pass</li>
                <li>Audit redemption logs and timestamps</li>
              </ul>
            </div>

            {deleteError && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                ❌ {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '8px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
