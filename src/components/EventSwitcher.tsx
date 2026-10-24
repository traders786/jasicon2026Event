'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface EventItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  venue: string;
  city: string | null;
  startDate: string;
  endDate: string;
  primaryColor?: string;
  accentColor?: string;
  registrationsCount?: number;
  isCurrentActive?: boolean;
}

interface EventSwitcherProps {
  isSuperAdmin: boolean;
  activeEventTitle?: string;
  activeEventCity?: string;
}

export function EventSwitcher({ isSuperAdmin, activeEventTitle, activeEventCity }: EventSwitcherProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // New Event Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newStartDate, setNewStartDate] = useState('2026-11-15T09:00');
  const [newEndDate, setNewEndDate] = useState('2026-11-17T18:00');
  const [newPrefix, setNewPrefix] = useState('CONF-2026');
  const [newColor, setNewColor] = useState('#1e40af'); // Default Royal Sapphire
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;

    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.events) {
          setEvents(d.events);
        }
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const activeEvent = events.find((e) => e.isCurrentActive) || events[0];
  const displayTitle = activeEventTitle || activeEvent?.title || 'Active Conference';
  const displayCity = activeEventCity || activeEvent?.city || activeEvent?.venue?.split(',')[0] || '';

  // If NOT Super Admin: Render locked, read-only badge (no switcher!)
  if (!isSuperAdmin) {
    return (
      <div
        className="locked-event-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 12px',
          borderRadius: '9999px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: 'var(--text-heading)',
          maxWidth: '220px',
        }}
        title={`Locked to assigned conference: ${displayTitle}`}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent)',
            flexShrink: 0,
          }}
        />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayTitle}
        </span>
      </div>
    );
  }

  // Super Admin: Switcher Dropdown
  const handleSelectEvent = async (event: EventItem) => {
    if (event.isCurrentActive || switching) return;
    try {
      setSwitching(true);
      const res = await fetch('/api/events/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });

      if (res.ok) {
        setDropdownOpen(false);
        // Refresh router so all server and client components reload with the new active event
        window.location.reload();
      }
    } catch {
      setSwitching(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const slug = newTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          slug,
          subtitle: newSubtitle.trim() || undefined,
          venue: `${newVenue.trim()}${newCity ? ', ' + newCity.trim() : ''}`,
          city: newCity.trim() || undefined,
          startDate: new Date(newStartDate).toISOString(),
          endDate: new Date(newEndDate).toISOString(),
          ticketPrefix: newPrefix.trim() || 'CONF-2026',
          primaryColor: newColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create conference');
      }

      setCreateModalOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error creating conference');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Super Admin Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          borderRadius: '9999px',
          background: dropdownOpen ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
          border: dropdownOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title="Switch Active Conference (Super Admin)"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent)',
            flexShrink: 0,
          }}
        />
        <div style={{ textAlign: 'left', lineHeight: 1.1, maxWidth: '170px' }}>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Active Conference
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayTitle}
          </div>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: 'var(--text-dim)',
            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '320px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid rgba(13, 98, 94, 0.18)',
            boxShadow: '0 12px 36px -4px rgba(13, 98, 94, 0.2), 0 4px 12px rgba(0,0,0,0.06)',
            padding: '1rem',
            zIndex: 999999,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Select Active Conference
            </span>
            <span style={{ fontSize: '0.72rem', background: 'var(--primary-subtle)', color: 'var(--primary)', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
              {events.length} Events
            </span>
          </div>

          {/* Events List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
            {events.map((ev) => {
              const isSelected = ev.isCurrentActive || ev.id === activeEvent?.id;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => handleSelectEvent(ev)}
                  disabled={switching}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--primary-subtle)' : '#ffffff',
                    cursor: isSelected ? 'default' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📍 {ev.venue || 'No venue set'}
                    </div>
                  </div>

                  {isSelected ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, background: '#ffffff', padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--primary)' }}>
                      Active
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {ev.registrationsCount !== undefined ? `${ev.registrationsCount} Regs` : 'Switch'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.75rem 0' }} />

          {/* Create New Conference Action */}
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              setCreateModalOpen(true);
            }}
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '8px 12px',
              borderRadius: '10px',
            }}
          >
            <span>➕</span>
            <span>Create New Conference</span>
          </button>
        </div>
      )}

      {/* Modal: Create New Conference */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 28, 26, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '1rem',
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '1.75rem',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  🏛️ Create New Conference
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Set up a fresh event with custom branding, meals, and ticket codes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {createError && (
              <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Conference Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DOSCON 2026, NEOCON 2027"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Subtitle / Edition
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual National Conference of DOS"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Venue / Hotel *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. India Habitat Centre"
                    value={newVenue}
                    onChange={(e) => setNewVenue(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    City &amp; State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Start Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    End Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Ticket Prefix *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DOS-2026, NEO-2027"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Brand Color Theme
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '2px' }}
                    />
                    <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 600 }}>{newColor}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                  style={{ flex: 1, fontWeight: 800 }}
                >
                  {creating ? 'Creating Conference...' : '🚀 Launch Conference'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
