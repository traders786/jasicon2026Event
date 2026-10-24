'use client';

import { useState, useEffect, useRef, Suspense } from 'react';

interface EventOption {
  id: string;
  title: string;
  slug: string;
  venue: string;
  city: string | null;
  isActive: boolean;
  logoUrl?: string | null;
}

interface MealStat {
  code: string;
  title: string;
  claimedCount: number;
  totalCount: number;
  claimRate: number;
}

interface AuditSummary {
  totalScans: number;
  successfulScans: number;
  duplicateScans: number;
  failedScans: number;
  totalMealsClaimed: number;
  totalMealsEligible: number;
  uniqueAttendeesServed: number;
  mealBreakdown: MealStat[];
  sessionBreakdown: MealStat[];
  stationBreakdown: Array<{ station: string; count: number }>;
}

interface AuditLogItem {
  id: string;
  scannedAt: string;
  result: string;
  participantName: string;
  doctorName: string;
  ticketCode: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  category: string;
  entitlementCode: string;
  entitlementTitle: string;
  deviceInfo: string;
  operatorName: string;
  notes: string;
}

function AuditPageContent() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [currentEvent, setCurrentEvent] = useState<EventOption | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MEAL' | 'SESSION'>('ALL');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'ALREADY_REDEEMED' | 'FAILED'>('ALL');

  const pdfPrintContainerRef = useRef<HTMLDivElement>(null);

  const fetchAuditData = async (eventId?: string) => {
    try {
      setLoading(true);
      const url = eventId
        ? `/api/audit?eventId=${encodeURIComponent(eventId)}`
        : '/api/audit';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load audit data');
      const data = await res.json();
      setEvents(data.events || []);
      setCurrentEvent(data.currentEvent || null);
      if (data.currentEvent?.id) {
        setSelectedEventId(data.currentEvent.id);
      }
      setSummary(data.summary || null);
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentDateStr(new Date().toLocaleString());
    void fetchAuditData();
  }, []);

  const handleEventChange = (newId: string) => {
    setSelectedEventId(newId);
    void fetchAuditData(newId);
  };

  const handleExportExcel = async () => {
    if (!selectedEventId) return;
    setExportingExcel(true);
    try {
      const res = await fetch(`/api/audit/export?eventId=${encodeURIComponent(selectedEventId)}`);
      if (!res.ok) throw new Error('Excel export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeSlug = currentEvent?.slug || 'audit';
      const dateStamp = new Date().toISOString().split('T')[0];
      a.download = `${safeSlug}-meal-audit-${dateStamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      alert('Could not download Excel file. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      if (!pdfPrintContainerRef.current) {
        throw new Error('Print container ref not found');
      }

      // Temporarily reveal container for canvas capture
      const container = pdfPrintContainerRef.current;
      container.style.display = 'block';

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      container.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / pdfWidth;
      const totalPdfHeight = canvasHeight / ratio;

      let position = 0;
      let heightLeft = totalPdfHeight;

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
      heightLeft -= pdfHeight;

      // Additional pages if report exceeds A4 page height
      while (heightLeft > 0) {
        position = heightLeft - totalPdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
        heightLeft -= pdfHeight;
      }

      const safeSlug = currentEvent?.slug || 'audit';
      const dateStamp = new Date().toISOString().split('T')[0];
      pdf.save(`${safeSlug}-audit-settlement-${dateStamp}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback: window print dialog
      window.print();
    } finally {
      setExportingPdf(false);
    }
  };

  // Filter logs locally based on search, category, and result
  const filteredLogs = logs.filter((log) => {
    if (categoryFilter !== 'ALL' && log.category !== categoryFilter) {
      return false;
    }
    if (resultFilter !== 'ALL' && log.result !== resultFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        log.participantName.toLowerCase().includes(q) ||
        log.ticketCode.toLowerCase().includes(q) ||
        log.phone.toLowerCase().includes(q) ||
        log.company.toLowerCase().includes(q) ||
        log.jobTitle.toLowerCase().includes(q) ||
        log.entitlementTitle.toLowerCase().includes(q) ||
        log.deviceInfo.toLowerCase().includes(q) ||
        log.operatorName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header bar with Conference Switcher & Export buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'var(--card-bg)',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ flex: '1', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              Scan &amp; Meal Audit History
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px', margin: 0 }}>
            Tamper-evident record of all entitlement redemptions, meals claimed per doctor, timestamps, and station activity.
          </p>
        </div>

        {/* Actions: Conference Picker + Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Conference Switcher */}
          {events.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Event:
              </span>
              <select
                className="form-input"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  background: 'var(--bg-subtle)',
                  borderColor: 'var(--border-color)',
                  cursor: 'pointer',
                  minWidth: '180px',
                }}
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} {evt.isActive ? '★ Active' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Excel Export Button */}
          <button
            onClick={() => void handleExportExcel()}
            disabled={exportingExcel || loading || logs.length === 0}
            className="btn btn-sm"
            style={{
              background: '#047857',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(4,120,87,0.25)',
            }}
            title="Download complete multi-sheet Excel file (.xlsx) with summaries & detailed logs"
          >
            <span>📊</span>
            <span>{exportingExcel ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>

          {/* PDF Export Button */}
          <button
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf || loading || logs.length === 0}
            className="btn btn-sm"
            style={{
              background: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(185,28,28,0.25)',
            }}
            title="Download executive audit settlement report PDF with meal counts and doctor logs"
          >
            <span>📄</span>
            <span>{exportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => void fetchAuditData(selectedEventId)}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '10px', padding: '8px 12px' }}
            title="Reload latest scan logs"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0d625e' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Scans Conducted
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
            {summary?.totalScans ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            All barcode / QR verification events
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
            Total Meals Claimed
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
            {summary?.totalMealsClaimed ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Out of {summary?.totalMealsEligible ?? 0} eligible meal coupons
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
            Successful Claims
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
            {summary?.successfulScans ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Verified check-ins &amp; meal issues
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
            Duplicate Scans Blocked
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
            {summary?.duplicateScans ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Tamper-proof second scans prevented
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase' }}>
            Unique Doctors Served
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4338ca', marginTop: '4px' }}>
            {summary?.uniqueAttendeesServed ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Individual doctors/delegates redeemed
          </div>
        </div>
      </div>

      {/* Meal Breakdown Section */}
      {summary?.mealBreakdown && summary.mealBreakdown.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🍱</span>
                <span>Meal-by-Meal Claim Totals ({currentEvent?.title || 'Active Conference'})</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, marginTop: '2px' }}>
                Detailed breakdown of exact meals redeemed for catering invoice reconciliation and attendance tracking.
              </p>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              Total Claimed: {summary.totalMealsClaimed} Meals
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {summary.mealBreakdown.map((meal) => (
              <div
                key={meal.code}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                    {meal.title}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0d625e' }}>
                    {meal.claimRate}%
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Claimed: <strong>{meal.claimedCount}</strong></span>
                  <span>Total Coupons: {meal.totalCount}</span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginTop: '2px' }}>
                  <div
                    style={{
                      width: `${Math.min(meal.claimRate, 100)}%`,
                      height: '100%',
                      background: meal.claimRate > 0 ? '#10b981' : '#cbd5e1',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
          <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.88rem', borderRadius: '10px' }}
            placeholder="Search by Doctor Name, Ticket Code, Mobile Number, or Meal Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Category:
            </span>
            <select
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '0.82rem', borderRadius: '8px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
            >
              <option value="ALL">All Categories</option>
              <option value="MEAL">🍱 Meals Only</option>
              <option value="SESSION">🎤 Sessions Only</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Outcome:
            </span>
            <select
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '0.82rem', borderRadius: '8px' }}
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as any)}
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">✅ Successful Only</option>
              <option value="ALREADY_REDEEMED">⚠️ Duplicates Only</option>
            </select>
          </div>

          {(searchQuery || categoryFilter !== 'ALL' || resultFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setResultFilter('ALL');
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '6px 10px', borderRadius: '8px' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Scan Log Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-heading)' }}>
            Scan Audit Trail ({filteredLogs.length} Records)
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing verified redemption records for <strong>{currentEvent?.title || 'Selected Event'}</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>⏳</div>
            Loading audit history and entitlement records...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📋</div>
            <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>No Scan Records Found</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {logs.length === 0
                ? 'No redemptions or scans have been conducted for this conference yet.'
                : 'No scan logs match your current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: '0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Date &amp; Time</th>
                  <th>Doctor / Attendee</th>
                  <th>Ticket</th>
                  <th>Meal / Entitlement</th>
                  <th>Status</th>
                  <th>Station / Counter</th>
                  <th>Audit Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.scannedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <div style={{ fontWeight: 700, color: 'var(--text-heading)', marginTop: '1px' }}>
                        {new Date(log.scannedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '0.92rem' }}>
                        {log.doctorName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        <span style={{ fontWeight: 600, color: '#0d625e' }}>{log.jobTitle || 'Doctor'}</span>
                        {log.phone ? ` • 📞 ${log.phone}` : ''}
                        {log.company ? ` • 🏥 ${log.company}` : ''}
                      </div>
                    </td>
                    <td>
                      <code
                        style={{
                          background: 'var(--bg-subtle)',
                          color: 'var(--primary)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                        }}
                      >
                        {log.ticketCode}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>{log.category === 'MEAL' ? '🍱' : '🎤'}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.88rem' }}>
                          {log.entitlementTitle}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Code: {log.entitlementCode}
                      </div>
                    </td>
                    <td>
                      {log.result === 'SUCCESS' ? (
                        <span
                          className="badge"
                          style={{
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                          }}
                        >
                          ✓ CLAIMED
                        </span>
                      ) : log.result === 'ALREADY_REDEEMED' ? (
                        <span
                          className="badge"
                          style={{
                            background: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                          }}
                        >
                          ⚠️ DUPLICATE BLOCKED
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                          }}
                        >
                          ✕ {log.result}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {log.deviceInfo}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        By: {log.operatorName}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '240px' }}>
                      {log.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden PDF Capture Container (Rendered off-screen during export) */}
      <div
        ref={pdfPrintContainerRef}
        style={{
          display: 'none',
          width: '780px',
          background: '#ffffff',
          color: '#0f172a',
          padding: '36px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* PDF Header */}
        <div style={{ borderBottom: '2px solid #0d625e', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0d625e', letterSpacing: '-0.5px' }}>
              EVENTLY • AUDIT &amp; MEAL SETTLEMENT REPORT
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', marginTop: '3px' }}>
              {currentEvent?.title || 'Conference Report'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              📍 {currentEvent?.venue}{currentEvent?.city ? `, ${currentEvent.city}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
            <div><strong>Generated:</strong> {currentDateStr || 'Official Record'}</div>
            <div><strong>Status:</strong> Official Audit Record</div>
            <div><strong>Scope:</strong> Complete Entitlement Ledger</div>
          </div>
        </div>

        {/* PDF Metrics Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Scans</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{summary?.totalScans ?? 0}</div>
          </div>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Meals Claimed</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#047857', marginTop: '2px' }}>{summary?.totalMealsClaimed ?? 0}</div>
          </div>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Valid Redemptions</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0369a1', marginTop: '2px' }}>{summary?.successfulScans ?? 0}</div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Duplicates Blocked</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>{summary?.duplicateScans ?? 0}</div>
          </div>
        </div>

        {/* PDF Meal Breakdown Table */}
        {summary?.mealBreakdown && summary.mealBreakdown.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0d625e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Meal Consumption Breakdown Ledger
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>Meal Code</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>Meal Description</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px' }}>Claimed Count</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px' }}>Total Eligible</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px' }}>Claim Rate %</th>
                </tr>
              </thead>
              <tbody>
                {summary.mealBreakdown.map((m) => (
                  <tr key={m.code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{m.code}</td>
                    <td style={{ padding: '6px 10px' }}>{m.title}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#047857' }}>{m.claimedCount}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{m.totalCount}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>{m.claimRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF Detailed Scan Table */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0d625e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Detailed Scan Log (Doctor &amp; Timestamp Record)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Doctor / Attendee</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ticket</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Meal Claimed</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Result</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Counter / Station</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 150).map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '5px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(log.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '5px 8px', fontWeight: 700, color: '#1e293b' }}>
                    {log.doctorName}
                    <span style={{ fontSize: '9px', color: '#64748b', display: 'block', fontWeight: 400 }}>
                      {log.jobTitle} {log.phone ? `(${log.phone})` : ''}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 600 }}>{log.ticketCode}</td>
                  <td style={{ padding: '5px 8px' }}>{log.entitlementTitle}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: log.result === 'SUCCESS' ? '#047857' : '#b45309' }}>
                    {log.result}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#64748b' }}>{log.deviceInfo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length > 150 && (
            <div style={{ textAlign: 'center', padding: '10px', fontSize: '10px', color: '#64748b' }}>
              Showing first 150 records in PDF summary. Download the complete Excel export (.xlsx) for all {filteredLogs.length} rows.
            </div>
          )}
        </div>

        {/* PDF Signature & Verification Footer */}
        <div style={{ marginTop: '36px', borderTop: '1px solid #cbd5e1', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b' }}>
          <div>
            Verified Evently Settlement Report • Conference: {currentEvent?.title}
          </div>
          <div style={{ display: 'flex', gap: '40px' }}>
            <div style={{ textAlign: 'center', borderTop: '1px dashed #94a3b8', paddingTop: '4px', minWidth: '120px' }}>
              Catering Vendor Sign
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px dashed #94a3b8', paddingTop: '4px', minWidth: '120px' }}>
              Organizing Secretary Sign
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>Loading audit records...</div>}>
      <AuditPageContent />
    </Suspense>
  );
}
