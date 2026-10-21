'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Placeholder detection state
  const [placeholderCount, setPlaceholderCount] = useState<number>(0);

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
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileSheet, setReconcileSheet] = useState<string>('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcilePreview, setReconcilePreview] = useState<ReconcilePreviewData | null>(null);
  const [reconcileConfirmed, setReconcileConfirmed] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const reconcileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const url = appliedQuery ? `/api/registrations?q=${encodeURIComponent(appliedQuery)}` : '/api/registrations';
        const [res, recRes] = await Promise.all([
          fetch(url),
          fetch('/api/registrations/reconcile'),
        ]);
        const data = await res.json();
        if (isMounted) {
          setParticipants(data.registrations || []);
        }
        if (recRes.ok) {
          const recData = await recRes.json();
          if (isMounted) {
            setPlaceholderCount(recData.placeholderCount || 0);
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

    void fetchAll();
    return () => {
      isMounted = false;
    };
  }, [appliedQuery, refreshKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAppliedQuery(searchInput.trim());
  };

  const handleClear = () => {
    setSearchInput('');
    setLoading(true);
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
            Event Participants
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage registered attendees, track individual check-in status, and monitor 19-entitlement utilization.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                fontWeight: 600,
              }}
              className="btn"
              title="Safe reconciliation to correct placeholder attendee records from spreadsheet"
            >
              <span>⚡</span> Reconcile ({placeholderCount} Placeholders)
            </button>
          )}

          <Link href="/register" className="btn btn-primary">
            <span>+</span> Register Attendee
          </Link>
        </div>
      </div>

      {/* Placeholder Banner Alert */}
      {placeholderCount > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>
                {placeholderCount} Placeholder Records Detected
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Previous import stored records as &ldquo;Guest Participant&rdquo;. You can safely restore real names, phone numbers, and districts from your original spreadsheet without affecting ticket codes, QR codes, or entitlements.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setShowReconcileModal(true);
              setReconcileError(null);
              setReconcileSuccess(null);
              setReconcilePreview(null);
            }}
            className="btn btn-secondary btn-sm"
            style={{ borderColor: 'rgba(245, 158, 11, 0.5)', color: '#fbbf24' }}
          >
            Reconcile Records Now
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by attendee name, email, company, or ticket code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
          {searchInput && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading participants...
          </div>
        ) : participants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No registered attendees found matching the filter.
          </div>
        ) : (
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
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const isPlaceholder = p.person.name === 'Guest Participant' || p.person.email.includes('@attendee.eventcheck.local');
                  return (
                    <tr key={p.id}>
                      <td>
                        <code style={{ fontWeight: 700, color: 'var(--primary-light)', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                          {p.ticketCode}
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{p.person.name}</span>
                          {isPlaceholder && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              Placeholder
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {p.person.jobTitle ? `${p.person.jobTitle} • ` : ''}{p.person.company || 'Independent'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{p.person.email}</div>
                        {p.person.phone && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{p.person.phone}</div>
                        )}
                      </td>
                      <td>
                        {p.status === 'CHECKED_IN' ? (
                          <span className="badge badge-available">CHECKED-IN</span>
                        ) : (
                          <span className="badge badge-pending">CONFIRMED</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                            {p.entitlementsSummary.mealsRedeemed} / {p.entitlementsSummary.mealsTotal}
                          </span>
                          <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                            <div
                              style={{
                                width: `${(p.entitlementsSummary.mealsRedeemed / p.entitlementsSummary.mealsTotal) * 100}%`,
                                height: '100%',
                                backgroundColor: '#f59e0b',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#06b6d4' }}>
                            {p.entitlementsSummary.sessionsRedeemed} / {p.entitlementsSummary.sessionsTotal}
                          </span>
                          <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
                            <div
                              style={{
                                width: `${(p.entitlementsSummary.sessionsRedeemed / p.entitlementsSummary.sessionsTotal) * 100}%`,
                                height: '100%',
                                backgroundColor: '#06b6d4',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* BULK IMPORT MODAL (CSV & EXCEL) */}
      {/* ======================================================== */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '750px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  Bulk Import Participants
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Supports <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong> spreadsheets. Each imported attendee receives 19 entitlements & a zero-PII QR code.
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
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Download Standard Template</div>
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '850px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    </div>
  );
}
