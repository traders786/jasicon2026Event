'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (newEvent: any) => void;
}

export function CreateEventModal({ isOpen, onClose, onCreated }: CreateEventModalProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('2026-11-15T09:00');
  const [endDate, setEndDate] = useState('2026-11-17T18:00');
  const [prefix, setPrefix] = useState('CONF-2026');
  const [primaryColor, setPrimaryColor] = useState('#0d625e');
  const [accentColor, setAccentColor] = useState('#10b981');
  const [logoUrl, setLogoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSubtitle('');
      setOrganizer('');
      setVenue('');
      setCity('');
      setPrefix('CONF-2026');
      setPrimaryColor('#0d625e');
      setAccentColor('#10b981');
      setLogoUrl('');
      setErrorMsg(null);
      setCreating(false);
    }
  }, [isOpen]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanVenue = venue.trim();
    const cleanCity = city.trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      setErrorMsg('Please enter a valid Conference Title (at least 2 characters).');
      return;
    }

    if (!cleanVenue) {
      setErrorMsg('Please enter the Venue or Hotel name for this conference.');
      return;
    }

    try {
      setCreating(true);
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `event-${Date.now()}`;

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          slug,
          subtitle: subtitle.trim() || undefined,
          organizerName: organizer.trim() || undefined,
          venue: cleanCity ? `${cleanVenue}, ${cleanCity}` : cleanVenue,
          city: cleanCity || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          ticketPrefix: prefix.trim().toUpperCase() || 'CONF-2026',
          primaryColor,
          accentColor,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create conference');
      }

      if (onCreated) {
        onCreated(data.event);
      } else {
        window.location.reload();
      }
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creating conference');
    } finally {
      setCreating(false);
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(8, 28, 26, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '2rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          border: '1.5px solid var(--border-color)',
          position: 'relative',
          margin: 'auto',
          animation: 'fadeInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              🏛️
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0, lineHeight: 1.2 }}>
                Launch New Conference
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                Set up a fresh conference with isolated attendees, custom branding, and stations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="modal-top-close-btn"
            title="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Conference Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
              Conference Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. DOSCON 2026, NEOCON 2027, APICON 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-control"
              style={{ width: '100%', fontSize: '0.95rem', fontWeight: 600 }}
            />
          </div>

          {/* Subtitle / Edition */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Subtitle / Edition
              </label>
              <input
                type="text"
                placeholder="e.g. 26th Annual Conference"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Host Society / Chapter
              </label>
              <input
                type="text"
                placeholder="e.g. Delhi Orthopaedic Assoc."
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Venue & City */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Venue / Convention Centre *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. India Habitat Centre, Lodhi Rd"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                City &amp; State
              </label>
              <input
                type="text"
                placeholder="e.g. New Delhi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Start Date &amp; Time *
              </label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                End Date &amp; Time *
              </label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Ticket Prefix & Colors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Ticket Code Prefix *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DOS-2026, NEO-2027"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                className="form-control"
                style={{ width: '100%', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                Used for badges, e.g. {prefix || 'CONF'}-0001
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-heading)' }}>
                Brand Colors
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    title="Primary Brand Color"
                    style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '2px' }}
                  />
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Primary</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    title="Accent Color"
                    style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '2px' }}
                  />
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Accent</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conference Logo */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.75rem', background: '#f8fafc' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-heading)' }}>
              🏛️ Conference Logo &amp; Badge Emblem (Optional)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {logoUrl ? (
                <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', overflow: 'hidden', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '8px', border: '1px dashed var(--border-color)', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', opacity: 0.5 }}>
                  🖼️
                </div>
              )}
              <div style={{ flex: 1, minWidth: '180px', display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Paste URL or upload..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '4px 8px' }}>
                  <span>📁 Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) setLogoUrl(String(ev.target.result));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="btn btn-secondary"
              style={{ flex: 1, fontWeight: 700 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
              style={{
                flex: 1.4,
                fontWeight: 800,
                background: primaryColor || 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {creating ? (
                <>
                  <span>⏳</span>
                  <span>Launching Conference...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Launch Conference</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
