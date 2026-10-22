'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ParticipantProfileView } from '@/components/ParticipantProfileView';

interface ParticipantItem {
  id: string;
  ticketCode: string;
  status: string;
  checkedInAt: string | null;
  createdAt: string;
  person: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    photoUrl: string | null;
  };
  event: {
    title: string;
    venue: string;
  };
  entitlementsSummary: {
    total: number;
    mealsTotal: number;
    mealsRedeemed: number;
    sessionsTotal: number;
    sessionsRedeemed: number;
  };
}

interface ImportPreviewData {
  selectedSheet: string;
  sheetNames: string[];
  detectedHeaders: string[];
  headerRowIndex: number;
  columnMapping: Record<string, string>;
  totalRows: number;
  potentialDuplicates: number;
  invalidRows: Array<{ rowNumber: number; reason: string }>;
  previewRows: Array<{
    rowNumber: number;
    fullName: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    registrationNo?: string;
    isDuplicate?: boolean;
  }>;
}

interface ReconcileDiffItem {
  ticketCode: string;
  isOrphanHeader: boolean;
  before: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
  };
  after: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    regNo?: string;
  } | null;
}

interface ReconcilePreviewData {
  totalPlaceholderRecords: number;
  totalMatchedToSpreadsheet: number;
  orphanHeaderRecordsCount: number;
  selectedSheet: string;
  diffPreview: ReconcileDiffItem[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  // Role detection
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Selected participant for profile modal
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'details' | 'badge'>('details');

  // Placeholder detection state
  const [placeholderCount, setPlaceholderCount] = useState<number>(0);

  // Fetch current user role once
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user?.role) setCurrentUserRole(d.user.role);
      })
      .catch(() => {});
  }, []);

  // Super Admin delete target state
  const [deleteTarget, setDeleteTarget] = useState<ParticipantItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteParticipant = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeletingId(targetId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/registrations/${targetId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete registration');

      // Optimistically remove immediately from table rows in-memory (no full page reload)
      setParticipants((prev) => prev.filter((p) => p.id !== targetId));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeletingId(null);
    }
  };

  // Close profile modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedParticipantId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    totalProcessed: number;
    errors: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reconciliation Modal State
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileSheet, setReconcileSheet] = useState<string>('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcilePreview, setReconcilePreview] = useState<ReconcilePreviewData | null>(null);
  const [reconcileConfirmed, setReconcileConfirmed] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const reconcileFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch placeholder count once on mount or when refreshKey changes (decoupled from search)
  useEffect(() => {
    fetch('/api/registrations/reconcile')
      .then((res) => (res.ok ? res.json() : null))
      .then((recData) => {
        if (recData && typeof recData.placeholderCount === 'number') {
          setPlaceholderCount(recData.placeholderCount);
        }
      })
      .catch(() => {});
  }, [refreshKey]);

  // Fetch paginated participants
  useEffect(() => {
    let isMounted = true;
    if (participants.length === 0) {
      setLoading(true);
    }
    const fetchRegistrations = async () => {
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (appliedQuery) {
          queryParams.set('q', appliedQuery);
        }
        const res = await fetch(`/api/registrations?${queryParams.toString()}`);
        const data = await res.json();
        if (isMounted) {
          setParticipants(data.registrations || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchRegistrations();
    return () => {
      isMounted = false;
    };
  }, [appliedQuery, page, pageSize, refreshKey]);

  // Instant auto-search as the user types (250ms debounce), resets page to 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(searchInput.trim());
  };

  const handleClear = () => {
    setSearchInput('');
    setAppliedQuery('');
  };

  // --- Import Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setImportPreview(null);
    setImportError(null);
    setImportResult(null);
    setAvailableSheets([]);
    setSelectedSheet('');
  };

  const handleRequestPreview = async (sheetOverride?: string) => {
    setPreviewLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      let res: Response;
      const targetSheet = sheetOverride !== undefined ? sheetOverride : selectedSheet;

      if (importMode === 'file') {
        if (!selectedFile) {
          throw new Error('Please select an Excel (.xlsx, .xls) or CSV file first.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('preview', 'true');
        if (targetSheet) formData.append('sheetName', targetSheet);

        res = await fetch('/api/registrations/import', {
          method: 'POST',
          body: formData,
        });
      } else {
        if (!importText.trim()) {
          throw new Error('Please paste CSV content.');
        }
        res = await fetch('/api/registrations/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent: importText, preview: true, sheetName: targetSheet }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse file preview.');
      }

      setImportPreview(data);
      if (data.sheetNames && data.sheetNames.length > 0) {
        setAvailableSheets(data.sheetNames);
        setSelectedSheet(data.selectedSheet || data.sheetNames[0]);
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Preview generation failed.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setImportLoading(true);
    setImportError(null);

    try {
      let res: Response;
      if (importMode === 'file') {
        if (!selectedFile) throw new Error('No file selected');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('preview', 'false');
        if (selectedSheet) formData.append('sheetName', selectedSheet);

        res = await fetch('/api/registrations/import', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/registrations/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent: importText, preview: false, sheetName: selectedSheet }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed.');
      }

      setImportResult(data);
      setImportPreview(null);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  // --- Reconciliation Handlers ---
  const handleReconcileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setReconcileFile(file);
    setReconcilePreview(null);
    setReconcileError(null);
    setReconcileSuccess(null);
  };

  const handleReconcileDryRun = async () => {
    if (!reconcileFile) {
      setReconcileError('Please choose the original Excel or CSV spreadsheet file.');
      return;
    }
    setReconcileLoading(true);
    setReconcileError(null);
    setReconcileSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', reconcileFile);
      formData.append('confirmed', 'false');
      formData.append('cleanupOrphan', 'true');
      if (reconcileSheet) formData.append('sheetName', reconcileSheet);

      const res = await fetch('/api/registrations/reconcile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dry-run reconciliation failed.');
      }

      setReconcilePreview(data);
    } catch (err: unknown) {
      setReconcileError(err instanceof Error ? err.message : 'Failed to generate reconciliation diff.');
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleApplyReconcile = async () => {
    if (!reconcileFile) return;
    if (!reconcileConfirmed) {
      setReconcileError('Please tick the confirmation checkbox to verify you approve applying corrections.');
      return;
    }

    setReconcileLoading(true);
    setReconcileError(null);
    setReconcileSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', reconcileFile);
      formData.append('confirmed', 'true');
      formData.append('cleanupOrphan', 'true');
      if (reconcileSheet) formData.append('sheetName', reconcileSheet);

      const res = await fetch('/api/registrations/reconcile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Reconciliation update failed.');
      }

      setReconcileSuccess(data.message || 'Records successfully reconciled!');
      setReconcilePreview(null);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setReconcileError(err instanceof Error ? err.message : 'Reconciliation execution failed.');
    } finally {
      setReconcileLoading(false);
    }
  };

  const loadSampleTemplate = () => {
    const sample = `Sl No.,Name,Catogry,Mobile No.,Distt.,Date of Registration,Mode of Payment,Amount
119,Dr. Ajay Kumar,Faculty,9007731038,Ranchi,13-Oct-2026,Online,3500
72,Dr. Akanchha Kedia,PG,8709259577,Ranchi,23-Sep-2026,Online,2360
41,Dr. Anant Sinha,Faculty,9431109615,Ranchi,19-Aug-2026,Online,3500`;
    setImportText(sample);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            Event Participants
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage registered attendees, track individual check-in status, and monitor 19-entitlement utilization.
          </p>
        </div>

        <div className="header-actions-group">
          {currentUserRole !== 'OPERATOR' && (
            <>
              <a
                href="/api/registrations/export"
                download
                className="btn btn-secondary"
                title="Download CSV report of attendees & redemption counts"
              >
                <span>📊</span> Export CSV
              </a>
              <button
                onClick={() => {
                  setShowImportModal(true);
                  setImportResult(null);
                  setImportError(null);
                  setImportPreview(null);
                }}
                className="btn btn-secondary"
              >
                <span>📥</span> Import Spreadsheet
              </button>

              {placeholderCount > 0 && (
                <button
                  onClick={() => {
                    setShowReconcileModal(true);
                    setReconcileError(null);
                    setReconcileSuccess(null);
                    setReconcilePreview(null);
                  }}
                  style={{
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    color: 'var(--warning)',
                    fontWeight: 700,
                  }}
                  className="btn"
                  title="Safe reconciliation to correct placeholder attendee records from spreadsheet"
                >
                  <span>⚡</span> Reconcile ({placeholderCount})
                </button>
              )}
            </>
          )}

          <Link href="/register" className="btn btn-primary">
            <span>+</span> Register Attendee
          </Link>
        </div>
      </div>

      {/* Placeholder Banner Alert - Super Admin only */}
      {placeholderCount > 0 && !bannerDismissed && currentUserRole !== 'OPERATOR' && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(180, 83, 9, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#b45309', fontSize: '0.95rem' }}>
                {placeholderCount} Placeholder Records Detected
              </div>
              <div style={{ fontSize: '0.82rem', color: '#92400e', marginTop: '2px', lineHeight: 1.4 }}>
                Previous import stored records as &ldquo;Guest Participant&rdquo;. You can safely restore real names, phone numbers, and districts from your original spreadsheet without affecting ticket codes, QR codes, or entitlements.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => {
                setShowReconcileModal(true);
                setReconcileError(null);
                setReconcileSuccess(null);
                setReconcilePreview(null);
              }}
              className="btn btn-secondary btn-sm"
              style={{ borderColor: '#f59e0b', color: '#b45309', fontWeight: 700 }}
            >
              Reconcile Records Now
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="btn btn-secondary btn-sm"
              style={{ color: '#92400e', padding: '4px 10px' }}
              title="Dismiss notice"
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
        <form onSubmit={handleSearch} className="search-bar-form">
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '1rem', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              className="form-input"
              placeholder="Search attendee by name, ticket code, phone, email, or hospital..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.4rem' }}>
              Search
            </button>
            {searchInput && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClear}
                style={{ padding: '0.65rem 1.2rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Mobile Horizontal Scroll Hint */}
      <div
        className="mobile-only"
        style={{
          display: 'none',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          padding: '0 4px',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>👉</span>
        <span>Swipe table horizontally to view all columns • Tap any attendee to view profile &amp; badge</span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0' }}>
        {loading && participants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading participants...
          </div>
        ) : participants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No registered attendees found matching the filter.
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ border: 'none', borderRadius: '14px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Attendee</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th>Meals (9 Total)</th>
                  <th>Sessions (10 Total)</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem', minWidth: '185px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const isPlaceholder = p.person.name === 'Guest Participant' || p.person.email.includes('@attendee.eventcheck.local');
                  const initials = p.person.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join('');

                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setModalInitialTab('details');
                        setSelectedParticipantId(p.id);
                      }}
                      className="participant-row-clickable"
                      title="Click to view full attendee profile, QR code, and print badge"
                    >
                      <td>
                        <code style={{ fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '3px 8px', borderRadius: '6px' }}>
                          {p.ticketCode}
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {p.person.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.person.photoUrl}
                              alt={p.person.name}
                              className="attendee-mini-avatar"
                            />
                          ) : (
                            <div className="attendee-mini-avatar-placeholder">
                              {initials || 'EC'}
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{p.person.name}</span>
                              {isPlaceholder && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--warning-bg)',
                                    color: 'var(--warning)',
                                    border: '1px solid var(--warning-border)',
                                    fontWeight: 700,
                                  }}
                                >
                                  Placeholder
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {p.person.jobTitle ? `${p.person.jobTitle} • ` : ''}{p.person.company || 'Independent'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{p.person.email}</div>
                        {p.person.phone && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{p.person.phone}</div>
                        )}
                      </td>
                      <td>
                        {p.status === 'CHECKED_IN' ? (
                          <span className="badge badge-available">CHECKED-IN</span>
                        ) : (
                          <span className="badge badge-confirmed">CONFIRMED</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                            {p.entitlementsSummary.mealsRedeemed} / {p.entitlementsSummary.mealsTotal}
                          </span>
                          <div style={{ width: '60px', height: '6px', background: 'var(--bg-mint)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${(p.entitlementsSummary.mealsRedeemed / p.entitlementsSummary.mealsTotal) * 100}%`,
                                height: '100%',
                                backgroundColor: '#059669',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {p.entitlementsSummary.sessionsRedeemed} / {p.entitlementsSummary.sessionsTotal}
                          </span>
                          <div style={{ width: '60px', height: '6px', background: 'var(--bg-mint)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${(p.entitlementsSummary.sessionsRedeemed / p.entitlementsSummary.sessionsTotal) * 100}%`,
                                height: '100%',
                                backgroundColor: 'var(--primary)',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '1.25rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setModalInitialTab('details');
                              setSelectedParticipantId(p.id);
                            }}
                            className="action-btn-profile"
                            title="Open attendee profile and QR code"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalInitialTab('badge');
                              setSelectedParticipantId(p.id);
                            }}
                            className="action-btn-badge"
                            title="Print attendee badge with QR code"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="16" rx="3"></rect>
                              <circle cx="9" cy="10" r="2"></circle>
                              <line x1="15" y1="8" x2="17" y2="8"></line>
                              <line x1="15" y1="12" x2="17" y2="12"></line>
                              <line x1="7" y1="16" x2="17" y2="16"></line>
                            </svg>
                            <span>Badge</span>
                          </button>
                          {currentUserRole === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(p);
                              }}
                              className="action-btn-delete"
                              title="Permanently delete attendee registration (Super Admin)"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                              <span>Delete</span>
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

          {/* Snappy Pagination Controls */}
          {pagination.total > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '0.9rem 1.25rem',
                borderTop: '1px solid var(--border-color)',
                background: '#fafbfc',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}
            >
              <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Showing{' '}
                <strong style={{ color: 'var(--text-heading)' }}>
                  {Math.min((page - 1) * pageSize + 1, pagination.total)}
                </strong>{' '}
                to{' '}
                <strong style={{ color: 'var(--text-heading)' }}>
                  {Math.min(page * pageSize, pagination.total)}
                </strong>{' '}
                of{' '}
                <strong style={{ color: 'var(--text-heading)' }}>{pagination.total}</strong> attendees
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'white',
                      fontSize: '0.82rem',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="btn btn-secondary btn-sm"
                  style={{
                    opacity: page <= 1 ? 0.45 : 1,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    padding: '5px 12px',
                    fontWeight: 600,
                  }}
                >
                  « Prev
                </button>

                {/* Page Pill Buttons */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    // Window centered around current page
                    let pageNum = i + 1;
                    if (pagination.totalPages > 5) {
                      if (page > 3) {
                        pageNum = page - 2 + i;
                        if (pageNum > pagination.totalPages) {
                          pageNum = pagination.totalPages - 4 + i;
                        }
                      }
                    }
                    const isCurrent = pageNum === page;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        style={{
                          minWidth: '32px',
                          height: '32px',
                          padding: '0 6px',
                          borderRadius: '8px',
                          border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: isCurrent ? 'var(--primary)' : 'white',
                          color: isCurrent ? 'white' : 'var(--text-main)',
                          fontWeight: isCurrent ? 800 : 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="btn btn-secondary btn-sm"
                  style={{
                    opacity: page >= pagination.totalPages ? 0.45 : 1,
                    cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    padding: '5px 12px',
                    fontWeight: 600,
                  }}
                >
                  Next »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>

      {/* ======================================================== */}
      {/* BULK IMPORT MODAL (CSV & EXCEL) */}
      {/* ======================================================== */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div
            className="modal-card modal-card-large"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Bulk Import Participants
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Supports <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong> spreadsheets. Each imported attendee receives 19 entitlements &amp; a zero-PII QR code.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowImportModal(false)}
              >
                ✕ Close
              </button>
            </div>

            {/* Template Download Section */}
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '0.95rem 1.15rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>Download Standard Template</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Includes required and optional columns with a clearly labelled sample row.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href="/api/registrations/template?format=csv"
                  download
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem' }}
                >
                  📥 .CSV Template
                </a>
                <a
                  href="/api/registrations/template?format=xlsx"
                  download
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem' }}
                >
                  📥 .XLSX Template
                </a>
              </div>
            </div>

            {/* Error Message */}
            {importError && (
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
                {importError}
              </div>
            )}

            {/* Success Message */}
            {importResult && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 700 }}>Import Complete!</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  Successfully imported: <strong>{importResult.importedCount}</strong> attendees • Skipped duplicates: <strong>{importResult.skippedCount}</strong> of {importResult.totalProcessed} total.
                </div>
              </div>
            )}

            {/* Mode Selector Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setImportMode('file'); setImportPreview(null); }}
                style={{
                  background: importMode === 'file' ? 'var(--primary-glow)' : 'transparent',
                  color: importMode === 'file' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                📁 Upload Spreadsheet File (.xlsx, .xls, .csv)
              </button>
              <button
                type="button"
                onClick={() => { setImportMode('text'); setImportPreview(null); }}
                style={{
                  background: importMode === 'text' ? 'var(--primary-glow)' : 'transparent',
                  color: importMode === 'text' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                📝 Paste CSV / Text
              </button>
            </div>

            {/* File Upload Mode */}
            {importMode === 'file' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Select File <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(Supports .xlsx, .xls, .csv up to 10MB)</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-input)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            )}

            {/* Paste CSV Mode */}
            {importMode === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Paste CSV Content</label>
                  <button
                    type="button"
                    onClick={loadSampleTemplate}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-light)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Paste Sample Template
                  </button>
                </div>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder={`Sl No.,Name,Catogry,Mobile No.,Distt.,Date of Registration\n119,Dr. Ajay Kumar,Faculty,9007731038,Ranchi,13-Oct-2026`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              </div>
            )}

            {/* Sheet Selection if multi-sheet detected */}
            {availableSheets.length > 1 && (
              <div style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Select Worksheet</label>
                <select
                  className="form-input"
                  value={selectedSheet}
                  onChange={(e) => {
                    const sheet = e.target.value;
                    setSelectedSheet(sheet);
                    void handleRequestPreview(sheet);
                  }}
                >
                  {availableSheets.map((s) => (
                    <option key={s} value={s}>
                      Worksheet: {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview Button */}
            {!importPreview && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowImportModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={previewLoading || (importMode === 'file' ? !selectedFile : !importText.trim())}
                  onClick={() => void handleRequestPreview()}
                >
                  {previewLoading ? 'Analyzing Headers...' : 'Preview Column Mapping'}
                </button>
              </div>
            )}

            {/* Mapping Preview Box */}
            {importPreview && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                      Worksheet: &ldquo;{importPreview.selectedSheet}&rdquo; • Header Row: #{importPreview.headerRowIndex + 1}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Total Valid Rows: <strong>{importPreview.totalRows}</strong> • Potential Duplicates: <strong>{importPreview.potentialDuplicates}</strong>
                    </div>
                  </div>

                  {/* Column mappings */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    Detected Mapping:
                    {Object.entries(importPreview.columnMapping).map(([k, v]) => (
                      <span key={k} style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>
                        {v}
                      </span>
                    ))}
                  </div>

                  {/* Warning on invalid rows */}
                  {importPreview.invalidRows && importPreview.invalidRows.length > 0 && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem', borderRadius: '6px', color: '#fbbf24', fontSize: '0.8rem', marginTop: '4px' }}>
                      {importPreview.invalidRows.length} blank or malformed rows will be skipped (e.g. Row #{importPreview.invalidRows[0].rowNumber}: {importPreview.invalidRows[0].reason}).
                    </div>
                  )}
                </div>

                {/* Preview Table */}
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Previewing First {importPreview.previewRows.length} Attendee Records:</div>
                <div className="table-wrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Attendee Name</th>
                        <th>Phone</th>
                        <th>Category / District</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.previewRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.registrationNo || row.rowNumber}</td>
                          <td style={{ fontWeight: 600, color: '#fff' }}>{row.fullName}</td>
                          <td>{row.phone || '—'}</td>
                          <td>{row.jobTitle || row.company || '—'}</td>
                          <td>
                            {row.isDuplicate ? (
                              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Already Registered</span>
                            ) : (
                              <span style={{ color: '#34d399', fontWeight: 600 }}>Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setImportPreview(null)}
                  >
                    Back to File
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={importLoading || importPreview.totalRows === 0}
                    onClick={() => void handleConfirmImport()}
                  >
                    {importLoading ? 'Importing Participants...' : `Confirm & Import ${importPreview.totalRows} Attendees`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SAFE RECONCILIATION MODAL */}
      {/* ======================================================== */}
      {showReconcileModal && (
        <div className="modal-overlay" onClick={() => setShowReconcileModal(false)}>
          <div
            className="modal-card modal-card-large"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '1.5rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span> Safe Participant Reconciliation
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Restores attendee names, phone numbers, and categories from your original spreadsheet. <strong>Existing ticket codes, QR token hashes, and 19 entitlements are 100% preserved.</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReconcileModal(false)}
              >
                ✕ Close
              </button>
            </div>

            {/* Error Message */}
            {reconcileError && (
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
                {reconcileError}
              </div>
            )}

            {/* Success Message */}
            {reconcileSuccess && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 700 }}>Reconciliation Applied!</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  {reconcileSuccess}
                </div>
              </div>
            )}

            {/* File Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Select Original Spreadsheet <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(e.g. 25th Jasicon registration... .xlsx or .csv)</span>
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                ref={reconcileFileInputRef}
                onChange={handleReconcileFileChange}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.6rem',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Sheet Input if multi-sheet workbook */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Worksheet Name (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Leave blank for automatic detection (e.g. Sorted Registrations)"
                value={reconcileSheet}
                onChange={(e) => setReconcileSheet(e.target.value)}
              />
            </div>

            {/* Dry-Run Trigger Button */}
            {!reconcilePreview && !reconcileSuccess && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReconcileModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={reconcileLoading || !reconcileFile}
                  onClick={() => void handleReconcileDryRun()}
                >
                  {reconcileLoading ? 'Comparing Records...' : 'Generate Safe Dry-Run Preview'}
                </button>
              </div>
            )}

            {/* Dry-Run Diff Preview */}
            {reconcilePreview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                    Dry-Run Reconciliation Summary:
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.85rem' }}>
                    <div>
                      Placeholders in DB: <strong>{reconcilePreview.totalPlaceholderRecords}</strong>
                    </div>
                    <div>
                      Matched to Attendees: <strong style={{ color: '#34d399' }}>{reconcilePreview.totalMatchedToSpreadsheet}</strong>
                    </div>
                    <div>
                      Accidental Header Row: <strong style={{ color: '#f87171' }}>{reconcilePreview.orphanHeaderRecordsCount}</strong> (EC-2026-0016)
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                  Diff Preview (Before vs. After):
                </div>

                <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Current State (Corrupted)</th>
                        <th>Reconciled State (From Spreadsheet)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcilePreview.diffPreview.map((diff) => (
                        <tr key={diff.ticketCode}>
                          <td>
                            <code style={{ color: 'var(--primary-light)', fontWeight: 700 }}>
                              {diff.ticketCode}
                            </code>
                          </td>
                          <td>
                            <div style={{ color: 'var(--text-muted)' }}>{diff.before.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              Ref: {diff.before.company || '—'}
                            </div>
                          </td>
                          <td>
                            {diff.isOrphanHeader ? (
                              <div style={{ color: '#f87171', fontStyle: 'italic' }}>
                                Accidental header row from earlier import (will be safely pruned)
                              </div>
                            ) : diff.after ? (
                              <div>
                                <div style={{ color: '#fff', fontWeight: 600 }}>{diff.after.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                                  {diff.after.jobTitle ? `${diff.after.jobTitle} • ` : ''}{diff.after.company || ''} • {diff.after.phone || ''}
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-dim)' }}>No match found</div>
                            )}
                          </td>
                          <td>
                            {diff.isOrphanHeader ? (
                              <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.75rem' }}>Prune Header</span>
                            ) : (
                              <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.75rem' }}>Ready to Update</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Explicit Confirmation Checkbox */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={reconcileConfirmed}
                      onChange={(e) => setReconcileConfirmed(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>
                      I confirm updating the <strong>{reconcilePreview.totalMatchedToSpreadsheet}</strong> attendee records and safely removing the 1 accidental header record. Existing ticket codes, QR token hashes, and 19 entitlements will remain unchanged.
                    </span>
                  </label>
                </div>

                {/* Confirm Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReconcilePreview(null)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={reconcileLoading || !reconcileConfirmed}
                    onClick={() => void handleApplyReconcile()}
                    style={{
                      background: reconcileConfirmed ? 'var(--primary)' : 'rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    {reconcileLoading ? 'Applying Corrections...' : 'Confirm & Apply Safe Reconcile'}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

      {/* Participant Profile & Badge Modal */}
      {selectedParticipantId && (
        <div
          className="profile-modal-overlay"
          onClick={() => setSelectedParticipantId(null)}
        >
          <div
            className="profile-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <ParticipantProfileView
              participantId={selectedParticipantId}
              initialTab={modalInitialTab}
              onClose={() => setSelectedParticipantId(null)}
              onUpdate={() => setRefreshKey((k) => k + 1)}
              onDelete={(deletedId) => {
                // Optimistically remove without table flash or full page reload
                setParticipants((prev) => prev.filter((p) => p.id !== deletedId));
                setPagination((prev) => ({
                  ...prev,
                  total: Math.max(0, prev.total - 1),
                }));
                setSelectedParticipantId(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Super Admin Delete Confirmation Modal from Table */}
      {deleteTarget && (
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
            if (!deletingId) setDeleteTarget(null);
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
              Are you sure you want to permanently delete registration for{' '}
              <strong>{deleteTarget.person.name}</strong> (<code>{deleteTarget.ticketCode}</code>)?
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
                <li>QR code ticket pass</li>
                <li>Redemption audit logs</li>
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
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDeleteParticipant()}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '8px',
                  cursor: deletingId ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingId ? 'Deleting...' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

