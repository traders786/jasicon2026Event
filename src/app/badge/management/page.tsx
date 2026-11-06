'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  JASICON_BRAND,
  BadgeAttendeeData,
} from '@/components/jasicon-badge/badgeConstants';
import {
  hasValidPhoto,
  generateInitials,
  formatAttendeeDisplayName,
} from '@/components/jasicon-badge/badgeUtils';
import { JASICONBadgeTemplate } from '@/components/jasicon-badge/JASICONBadgeTemplate';
import { BadgeFront } from '@/components/jasicon-badge/BadgeFront';
import { BadgeBack } from '@/components/jasicon-badge/BadgeBack';
import { createBulkPrintPdf, createBulkBadgesZip } from '@/lib/bulk-badge-zip';
import { generateMasterBackPdf } from '@/lib/badge-pdf-generator';

interface RegistrationRecord {
  id: string;
  ticketCode: string;
  status: string;
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
    id: string;
    title: string;
    venue: string;
  };
}

export default function BadgeManagementPage() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [photoFilter, setPhotoFilter] = useState<'ALL' | 'WITH_PHOTO' | 'MISSING_PHOTO'>('ALL');

  // Selected for Batch Generation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Currently Previewed Attendee
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Generated QR cache
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [scientificProgrammeQr, setScientificProgrammeQr] = useState<string>('');

  // Bulk Generation State
  const [bulkStatus, setBulkStatus] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    successful: number;
    missingPhotos: number;
    failed: number;
    message: string;
  }>({
    isRunning: false,
    current: 0,
    total: 0,
    successful: 0,
    missingPhotos: 0,
    failed: 0,
    message: '',
  });

  // Offscreen rendering container for batch generation
  const bulkContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloadingMasterBack, setIsDownloadingMasterBack] = useState(false);

  // Standalone Master Back Side Download (Common to all attendees, QR -> https://jasicon2026.in/)
  const handleDownloadMasterBackStandalone = async () => {
    const masterBackEl = document.getElementById('master-back-download-target');
    if (!masterBackEl) {
      alert('Master back template element is not ready yet. Please try again.');
      return;
    }
    try {
      setIsDownloadingMasterBack(true);
      await generateMasterBackPdf(masterBackEl, scientificProgrammeQr);
    } catch (err: any) {
      console.error('Error generating master back PDF:', err);
      alert(`Failed to generate master back PDF: ${err.message}`);
    } finally {
      setIsDownloadingMasterBack(false);
    }
  };

  // Load Registrations & Common Back QR
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // Pre-generate scientific programme QR
        const progQr = await QRCode.toDataURL(JASICON_BRAND.scientificProgrammeUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 320,
          color: { dark: '#073226', light: '#FFFFFF' },
        });
        setScientificProgrammeQr(progQr);

        // Fetch all registrations
        const res = await fetch('/api/registrations?all=true');
        if (!res.ok) throw new Error('Failed to fetch attendee records');
        const data = await res.json();
        const items: RegistrationRecord[] = data.items || [];
        setRegistrations(items);

        if (items.length > 0) {
          setActivePreviewId(items[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading attendees');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Helper to get or generate front QR data URL for an attendee
  const getQrForRegistration = async (reg: RegistrationRecord): Promise<string> => {
    if (qrCache[reg.id]) return qrCache[reg.id];
    const payload = `EC_TICKET:${reg.ticketCode}:${reg.id}`;
    const url = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#073226', light: '#FFFFFF' },
    });
    setQrCache((prev) => ({ ...prev, [reg.id]: url }));
    return url;
  };

  // Pre-load QR for currently active preview
  useEffect(() => {
    if (!activePreviewId) return;
    const reg = registrations.find((r) => r.id === activePreviewId);
    if (reg && !qrCache[reg.id]) {
      getQrForRegistration(reg);
    }
  }, [activePreviewId, registrations]);

  // Unique categories in dataset
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      const cat = r.person.jobTitle?.trim() || 'DELEGATE';
      set.add(cat.toUpperCase());
    });
    return Array.from(set).sort();
  }, [registrations]);

  // Filtered dataset
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = reg.person.name?.toLowerCase().includes(q);
        const ticketMatch = reg.ticketCode?.toLowerCase().includes(q);
        const emailMatch = reg.person.email?.toLowerCase().includes(q);
        const companyMatch = reg.person.company?.toLowerCase().includes(q);
        if (!nameMatch && !ticketMatch && !emailMatch && !companyMatch) return false;
      }

      // 2. Category
      if (selectedCategory !== 'ALL') {
        const cat = (reg.person.jobTitle?.trim() || 'DELEGATE').toUpperCase();
        if (cat !== selectedCategory) return false;
      }

      // 3. Status
      if (selectedStatus !== 'ALL') {
        if (reg.status !== selectedStatus) return false;
      }

      // 4. Photo availability
      if (photoFilter === 'WITH_PHOTO' && !hasValidPhoto(reg.person.photoUrl)) {
        return false;
      }
      if (photoFilter === 'MISSING_PHOTO' && hasValidPhoto(reg.person.photoUrl)) {
        return false;
      }

      return true;
    });
  }, [registrations, searchQuery, selectedCategory, selectedStatus, photoFilter]);

  // Multi-Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredRegistrations.map((r) => r.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleSelectMissingPhotos = () => {
    const missing = registrations.filter((r) => !hasValidPhoto(r.person.photoUrl)).map((r) => r.id);
    setSelectedIds(new Set(missing));
  };

  // Convert RegistrationRecord to BadgeAttendeeData
  const toBadgeData = (reg: RegistrationRecord): BadgeAttendeeData => ({
    attendeeId: reg.person.id,
    ticketCode: reg.ticketCode,
    fullName: reg.person.name,
    category: (reg.person.jobTitle || 'DELEGATE').toUpperCase(),
    photoUrl: reg.person.photoUrl,
    institution: reg.person.company,
    email: reg.person.email,
    phone: reg.person.phone,
    eventTitle: reg.event.title,
    venue: reg.event.venue,
  });

  // Active preview object
  const activeRecord = useMemo(() => {
    return registrations.find((r) => r.id === activePreviewId) || registrations[0] || null;
  }, [activePreviewId, registrations]);

  // Bulk PDF Generation Handler
  const handleGenerateBulkPdf = async () => {
    const selectedList = registrations.filter((r) => selectedIds.has(r.id));
    if (selectedList.length === 0) {
      alert('Please select at least one attendee first.');
      return;
    }

    if (!bulkContainerRef.current) return;

    try {
      setBulkStatus({
        isRunning: true,
        current: 0,
        total: selectedList.length,
        successful: 0,
        missingPhotos: 0,
        failed: 0,
        message: 'Preparing high-resolution master badges...',
      });

      // 1. Preload QRs for all selected attendees
      for (let i = 0; i < selectedList.length; i++) {
        await getQrForRegistration(selectedList[i]);
      }

      // 2. Render pairs from offscreen container
      const pairs: Array<{
        attendee: BadgeAttendeeData;
        frontEl: HTMLElement;
        backEl: HTMLElement;
      }> = [];

      let missingCount = 0;

      for (let i = 0; i < selectedList.length; i++) {
        const reg = selectedList[i];
        if (!hasValidPhoto(reg.person.photoUrl)) {
          missingCount++;
        }

        const frontEl = document.getElementById(`bulk-front-${reg.id}`);
        const backEl = document.getElementById(`bulk-back-${reg.id}`);

        if (frontEl && backEl) {
          pairs.push({
            attendee: toBadgeData(reg),
            frontEl,
            backEl,
          });
        }
      }

      setBulkStatus((prev) => ({
        ...prev,
        missingPhotos: missingCount,
        message: `Rendering ${pairs.length} badges to 300 DPI PDF...`,
      }));

      const pdfBlob = await createBulkPrintPdf(pairs, (current, total, statusText) => {
        setBulkStatus((prev) => ({
          ...prev,
          current,
          total,
          successful: current,
          message: statusText,
        }));
      });

      // Trigger download
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `JASICON_2026_Master_Badges_Batch_${selectedList.length}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      setBulkStatus((prev) => ({
        ...prev,
        isRunning: false,
        message: `Successfully generated ${pairs.length} badges!`,
      }));
    } catch (err: any) {
      console.error('Bulk generation error:', err);
      setBulkStatus((prev) => ({
        ...prev,
        isRunning: false,
        failed: prev.total - prev.successful,
        message: `Generation error: ${err.message}`,
      }));
      alert(`Bulk generation failed: ${err.message}`);
    }
  };

  // Bulk ZIP Generation Handler
  const handleGenerateBulkZip = async () => {
    const selectedList = registrations.filter((r) => selectedIds.has(r.id));
    if (selectedList.length === 0) {
      alert('Please select at least one attendee first.');
      return;
    }

    try {
      setBulkStatus({
        isRunning: true,
        current: 0,
        total: selectedList.length,
        successful: 0,
        missingPhotos: 0,
        failed: 0,
        message: 'Packaging individual attendee PDFs into ZIP...',
      });

      // 1. Preload QRs
      for (let i = 0; i < selectedList.length; i++) {
        await getQrForRegistration(selectedList[i]);
      }

      const pairs: Array<{
        attendee: BadgeAttendeeData;
        frontEl: HTMLElement;
        backEl: HTMLElement;
      }> = [];

      let missingCount = 0;
      for (const reg of selectedList) {
        if (!hasValidPhoto(reg.person.photoUrl)) missingCount++;
        const frontEl = document.getElementById(`bulk-front-${reg.id}`);
        const backEl = document.getElementById(`bulk-back-${reg.id}`);
        if (frontEl && backEl) {
          pairs.push({
            attendee: toBadgeData(reg),
            frontEl,
            backEl,
          });
        }
      }

      setBulkStatus((prev) => ({
        ...prev,
        missingPhotos: missingCount,
      }));

      const zipBlob = await createBulkBadgesZip(pairs, (current, total, statusText) => {
        setBulkStatus((prev) => ({
          ...prev,
          current,
          total,
          successful: current,
          message: statusText,
        }));
      });

      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `JASICON_2026_Individual_Badges_${selectedList.length}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      setBulkStatus((prev) => ({
        ...prev,
        isRunning: false,
        message: `Exported ZIP with ${pairs.length} badges!`,
      }));
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      setBulkStatus((prev) => ({
        ...prev,
        isRunning: false,
        message: `ZIP error: ${err.message}`,
      }));
      alert(`ZIP generation failed: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '1.5rem', minHeight: '100vh', background: '#F8FAF9' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '1.5rem',
          background: '#FFFFFF',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: '#0B4333',
                color: '#E8D5A3',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
              }}
            >
              JASICON 2026
            </span>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F2C23', margin: 0 }}>
              Physical Conference Badge Studio
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Automated master badge generation • 105 × 148 mm (A6 Portrait) • 300 DPI Physical Print Ready
          </p>
        </div>

        {/* Global Summary Badges & Standalone Master Back Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadMasterBackStandalone}
            disabled={isDownloadingMasterBack || !scientificProgrammeQr}
            title="Download common reverse side PDF (A6 300 DPI) linking to https://jasicon2026.in/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1.5px solid #064B38',
              background: '#064B38',
              color: '#FFFDF5',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isDownloadingMasterBack ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(6, 75, 56, 0.25)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <rect x="7" y="7" width="3" height="3" />
              <rect x="14" y="7" width="3" height="3" />
              <rect x="7" y="14" width="3" height="3" />
              <path d="M14 14h3v3h-3z" />
            </svg>
            {isDownloadingMasterBack ? 'Generating Master Back...' : 'Download Master Back PDF (A6)'}
          </button>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              background: '#F1F5F9',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0B4333' }}>
              {registrations.length}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Total Attendees
            </div>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              background: selectedIds.size > 0 ? '#E6F4EA' : '#F1F5F9',
              textAlign: 'center',
              border: selectedIds.size > 0 ? '1px solid #34A853' : '1px solid transparent',
            }}
          >
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: selectedIds.size > 0 ? '#137333' : '#64748B',
              }}
            >
              {selectedIds.size}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Selected
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Attendees & Bulk Controls; Right = Live Master Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '24px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Controls & Attendee List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
          <div
            style={{
              background: '#FFFFFF',
              padding: '14px 18px',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Search + Dropdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search attendee by name, ticket, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: '10px', top: '10px' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CHECKED_IN">CHECKED_IN</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            {/* Photo Filter Tabs & Selection Shortcuts */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                paddingTop: '6px',
                borderTop: '1px solid #F1F5F9',
              }}
            >
              {/* Photo Filter Buttons */}
              <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setPhotoFilter('ALL')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: photoFilter === 'ALL' ? '#0B4333' : 'transparent',
                    color: photoFilter === 'ALL' ? '#FFFFFF' : '#475569',
                  }}
                >
                  All ({registrations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoFilter('WITH_PHOTO')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: photoFilter === 'WITH_PHOTO' ? '#0B4333' : 'transparent',
                    color: photoFilter === 'WITH_PHOTO' ? '#FFFFFF' : '#475569',
                  }}
                >
                  📷 Has Photo ({registrations.filter((r) => hasValidPhoto(r.person.photoUrl)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoFilter('MISSING_PHOTO')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: photoFilter === 'MISSING_PHOTO' ? '#0B4333' : 'transparent',
                    color: photoFilter === 'MISSING_PHOTO' ? '#FFFFFF' : '#475569',
                  }}
                >
                  🔤 Initials Fallback ({registrations.filter((r) => !hasValidPhoto(r.person.photoUrl)).length})
                </button>
              </div>

              {/* Selection Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Select All Filtered ({filteredRegistrations.length})
                </button>

                <button
                  type="button"
                  onClick={handleSelectMissingPhotos}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Select Missing Photos
                </button>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid #FDA4AF',
                      background: '#FFF1F2',
                      color: '#E11D48',
                      cursor: 'pointer',
                    }}
                  >
                    Clear ({selectedIds.size})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Generation Action Strip (Sticky Banner) */}
          {selectedIds.size > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #073226 0%, #0B4333 100%)',
                color: '#FFFFFF',
                padding: '12px 18px',
                borderRadius: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 14px rgba(7, 50, 38, 0.25)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#E8D5A3' }}>
                  {selectedIds.size} Attendees Selected for Badge Printing
                </span>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
                  Exact dimensions: 105 × 148 mm A6 Portrait • Front &amp; Back 300 DPI Output
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleGenerateBulkPdf}
                  disabled={bulkStatus.isRunning}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: '1px solid #C5A059',
                    background: 'linear-gradient(135deg, #ECC876 0%, #C5A059 60%, #A07C2E 100%)',
                    color: '#073226',
                    cursor: bulkStatus.isRunning ? 'wait' : 'pointer',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  📄 Combined Print PDF
                </button>

                <button
                  type="button"
                  onClick={handleGenerateBulkZip}
                  disabled={bulkStatus.isRunning}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    cursor: bulkStatus.isRunning ? 'wait' : 'pointer',
                  }}
                >
                  📦 Individual ZIP
                </button>
              </div>
            </div>
          )}

          {/* Progress Modal / Strip */}
          {bulkStatus.isRunning && (
            <div
              style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '12px',
                border: '2px solid #C5A059',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0B4333' }}>
                  Batch Generation in Progress...
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#C5A059' }}>
                  {bulkStatus.current} / {bulkStatus.total}
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${bulkStatus.total > 0 ? (bulkStatus.current / bulkStatus.total) * 100 : 0}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #0B4333, #C5A059)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>
                <span>{bulkStatus.message}</span>
                <span>
                  Missing Photos: <strong>{bulkStatus.missingPhotos}</strong> (Initials Generated)
                </span>
              </div>
            </div>
          )}

          {/* Attendee Table */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                Loading attendee records...
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                No attendee records matched your search filters.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAF9', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.75rem' }}>
                    <th style={{ padding: '10px 14px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredRegistrations.length > 0 &&
                          filteredRegistrations.every((r) => selectedIds.has(r.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleClearSelection();
                        }}
                      />
                    </th>
                    <th style={{ padding: '10px 14px' }}>ATTENDEE</th>
                    <th style={{ padding: '10px 14px' }}>TICKET ID</th>
                    <th style={{ padding: '10px 14px' }}>CATEGORY</th>
                    <th style={{ padding: '10px 14px' }}>PHOTO STATUS</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.map((reg) => {
                    const isSelected = selectedIds.has(reg.id);
                    const isActive = activePreviewId === reg.id;
                    const hasPhoto = hasValidPhoto(reg.person.photoUrl);
                    const initials = generateInitials(reg.person.name);
                    const category = (reg.person.jobTitle || 'DELEGATE').toUpperCase();

                    return (
                      <tr
                        key={reg.id}
                        onClick={() => setActivePreviewId(reg.id)}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isActive ? '#F0FDF4' : isSelected ? '#FAFBF9' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Checkbox */}
                        <td
                          style={{ padding: '12px 14px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(reg.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(reg.id)}
                          />
                        </td>

                        {/* Attendee Avatar + Name */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                border: '1.5px solid #C5A059',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#FFF9EA',
                                flexShrink: 0,
                              }}
                            >
                              {hasPhoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={reg.person.photoUrl!}
                                  alt={reg.person.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                    color: '#0B4333',
                                    fontFamily: 'serif',
                                  }}
                                >
                                  {initials}
                                </span>
                              )}
                            </div>

                            <div>
                              <div style={{ fontWeight: 800, color: '#0F2C23' }}>
                                {formatAttendeeDisplayName(reg.person.name)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {reg.person.email || 'NA'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Ticket Code */}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              padding: '2px 8px',
                              background: '#F1F5F9',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: '#1E293B',
                            }}
                          >
                            {reg.ticketCode}
                          </span>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: '#0B4333',
                              color: '#FFFFFF',
                              border: '1px solid #C5A059',
                            }}
                          >
                            {category}
                          </span>
                        </td>

                        {/* Photo Status */}
                        <td style={{ padding: '12px 14px' }}>
                          {hasPhoto ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#16A34A',
                              }}
                            >
                              ● Photo Active
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#D97706',
                              }}
                            >
                              🔤 Initials: {initials}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePreviewId(reg.id);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              Preview
                            </button>

                            <Link
                              href={`/badge/${reg.ticketCode}`}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #0B4333',
                                background: '#0B4333',
                                color: '#FFFFFF',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              Open ↗
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Master Badge Live Preview Panel (Sticky) */}
        <div style={{ position: 'sticky', top: '1rem' }}>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '0.75rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#C5A059',
                    textTransform: 'uppercase',
                  }}
                >
                  LIVE MASTER PREVIEW
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F2C23', margin: '2px 0 0 0' }}>
                  {activeRecord ? formatAttendeeDisplayName(activeRecord.person.name) : 'No attendee selected'}
                </h3>
              </div>

              {activeRecord && (
                <Link
                  href={`/badge/${activeRecord.ticketCode}`}
                  target="_blank"
                  style={{
                    fontSize: '0.78rem',
                    color: '#0B4333',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Full Page ↗
                </Link>
              )}
            </div>

            {activeRecord ? (
              <JASICONBadgeTemplate
                attendee={toBadgeData(activeRecord)}
                eventQrDataUrl={qrCache[activeRecord.id] || ''}
                scientificProgrammeQrDataUrl={scientificProgrammeQr}
                showLanyardSlots={true}
                initialSide="front"
                allowDownload={true}
              />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                Select an attendee to preview their badge.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OFFSCREEN BULK RENDERING ENGINE (Hidden from view, used for html2canvas capture) */}
      <div
        ref={bulkContainerRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '0',
          left: '-99999px',
          opacity: 0,
          pointerEvents: 'none',
          width: '105mm',
        }}
      >
        {/* Always available standalone master back element for batch printing export */}
        <div id="master-back-download-target">
          <BadgeBack
            scientificProgrammeQrDataUrl={scientificProgrammeQr}
            showLanyardSlots={true}
          />
        </div>

        {registrations
          .filter((r) => selectedIds.has(r.id))
          .map((reg) => (
            <div key={`bulk-pair-${reg.id}`}>
              <div id={`bulk-front-${reg.id}`}>
                <BadgeFront
                  attendee={toBadgeData(reg)}
                  qrDataUrl={qrCache[reg.id] || ''}
                  showLanyardSlots={true}
                />
              </div>
              <div id={`bulk-back-${reg.id}`}>
                <BadgeBack
                  scientificProgrammeQrDataUrl={scientificProgrammeQr}
                  showLanyardSlots={true}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

