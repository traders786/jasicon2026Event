'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface EventData {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  organizerName: string | null;
  venue: string;
  city: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  ticketPrefix: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  organizerLogoUrl: string | null;
  categories: string[];
  stations: Array<{ code: string; label: string; category: string; icon: string }>;
  whatsappTemplate: string | null;
  registrationsCount?: number;
  staffCount?: number;
  isCurrentActive?: boolean;
}

export default function EventsManagementPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editOrganizer, setEditOrganizer] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPrefix, setEditPrefix] = useState('');
  const [editColor, setEditColor] = useState('#0d625e');
  const [editAccent, setEditAccent] = useState('#10b981');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const loadEvents = () => {
    setLoading(true);
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.events) {
          setEvents(data.events);
          const active = data.events.find((e: EventData) => e.isCurrentActive) || data.events[0];
          if (active) {
            selectForEdit(active);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const selectForEdit = (ev: EventData) => {
    setSelectedEvent(ev);
    setEditTitle(ev.title || '');
    setEditSubtitle(ev.subtitle || '');
    setEditOrganizer(ev.organizerName || '');
    setEditVenue(ev.venue || '');
    setEditCity(ev.city || '');
    setEditPrefix(ev.ticketPrefix || 'CONF-2026');
    setEditColor(ev.primaryColor || '#0d625e');
    setEditAccent(ev.accentColor || '#10b981');
    setEditCategories(Array.isArray(ev.categories) ? ev.categories : ['DELEGATE', 'PG STUDENT', 'FACULTY']);
    setEditWhatsapp(ev.whatsappTemplate || '');
    setFeedback(null);
  };

  const handleActivate = async (eventId: string) => {
    try {
      const res = await fetch('/api/events/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Failed to switch active event' });
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          subtitle: editSubtitle.trim() || null,
          organizerName: editOrganizer.trim() || null,
          venue: editVenue.trim(),
          city: editCity.trim() || null,
          ticketPrefix: editPrefix.trim() || 'CONF-2026',
          primaryColor: editColor,
          accentColor: editAccent,
          categories: editCategories,
          whatsappTemplate: editWhatsapp.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update event');
      }

      setFeedback({ type: 'success', text: 'Conference branding & settings updated successfully!' });
      loadEvents();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Error updating event' });
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const val = newCatInput.trim().toUpperCase();
    if (val && !editCategories.includes(val)) {
      setEditCategories([...editCategories, val]);
      setNewCatInput('');
    }
  };

  const removeCategory = (catToRemove: string) => {
    setEditCategories(editCategories.filter((c) => c !== catToRemove));
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '9999px', background: 'var(--primary-subtle)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
            <span>🎨</span> Event Studio &amp; Multi-Conference Management
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            Conference Branding &amp; Entitlements Studio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Configure conference identities, ticket prefixes, categories, badge colors, and meal stations.
          </p>
        </div>

        <Link href="/users" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>🛡️</span> Manage Event Staff
        </Link>
      </div>

      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1.5px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#dc2626',
            fontSize: '0.88rem',
            fontWeight: 700,
          }}
        >
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.text}
        </div>
      )}

      {/* Main Grid: Left Event List, Right Event Studio Editor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Events Selector List */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              All Conferences ({events.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.map((ev) => {
              const isSelected = selectedEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => selectForEdit(ev)}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--bg-subtle)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(13, 98, 94, 0.1)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ev.primaryColor || 'var(--primary)' }} />
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-heading)' }}>
                          {ev.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {ev.subtitle || 'Conference Edition'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        📍 {ev.venue} • Code: <strong>{ev.ticketPrefix}</strong>
                      </div>
                    </div>

                    {ev.isCurrentActive ? (
                      <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                        ● Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActivate(ev.id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '3px 9px' }}
                      >
                        Set Active
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>👥 {ev.registrationsCount || 0} Registrations</span>
                    <span>🛡️ {ev.staffCount || 0} Staff</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Studio Customization Form for Selected Event */}
        {selectedEvent && (
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Branding &amp; Badging Studio
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Editing conference parameters for <strong>{selectedEvent.title}</strong>
                </p>
              </div>

              {!selectedEvent.isCurrentActive && (
                <button
                  type="button"
                  onClick={() => handleActivate(selectedEvent.id)}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700 }}
                >
                  🚀 Switch To This Event
                </button>
              )}
            </div>

            <form onSubmit={handleSaveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Conference Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Subtitle / Edition
                  </label>
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    className="form-input"
                    placeholder="e.g. 25th Annual State Conference of ASI"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Host Society / Chapter
                  </label>
                  <input
                    type="text"
                    value={editOrganizer}
                    onChange={(e) => setEditOrganizer(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Association of Surgeons of India"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Venue *
                  </label>
                  <input
                    type="text"
                    required
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Deoghar, Jharkhand"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Deoghar"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Ticket Code Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g. JC-2026, DOS-2026"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Brand Theme Colors
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                      title="Primary brand color"
                    />
                    <input
                      type="color"
                      value={editAccent}
                      onChange={(e) => setEditAccent(e.target.value)}
                      style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                      title="Accent color"
                    />
                    <span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{editColor}</span>
                  </div>
                </div>
              </div>

              {/* Delegate Categories Customizer */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem', background: '#f8fafc' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '6px' }}>
                  🏷️ Delegate Categories (Badge Roles)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {editCategories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text-heading)',
                      }}
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => removeCategory(cat)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontWeight: 800, fontSize: '0.8rem' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="Add category (e.g. VIP, EXHIBITOR, GUEST)"
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 700 }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* WhatsApp Message Template */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  💬 WhatsApp Confirmation Template
                </label>
                <textarea
                  rows={4}
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.4 }}
                  placeholder="Dear Dr. {{delegate_name}}, Greetings from {{conference_title}}!..."
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Available tags: <code>{'{{delegate_name}}'}</code>, <code>{'{{ticket_code}}'}</code>, <code>{'{{conference_title}}'}</code>, <code>{'{{venue}}'}</code>, <code>{'{{badge_url}}'}</code>
                </span>
              </div>

              {/* Live Mini Badge Preview */}
              <div style={{ border: '1.5px dashed var(--border-color)', borderRadius: '14px', padding: '1rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: editColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '1.5rem', fontWeight: 800 }}>
                  🏛️
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {editTitle || 'Conference Name'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {editSubtitle || 'Conference Edition'} • {editCity || editVenue}
                  </div>
                  <div style={{ display: 'inline-flex', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: editColor, color: '#ffffff', fontWeight: 700 }}>
                      {editPrefix}-0001
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: editAccent, color: '#ffffff', fontWeight: 700 }}>
                      {editCategories[0] || 'DELEGATE'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '10px 24px' }}
                >
                  {saving ? 'Saving Changes...' : '💾 Save Event Branding'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
