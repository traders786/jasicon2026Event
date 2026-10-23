'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface EventItem {
  id: string;
  title: string;
  venue: string;
}

interface NewBadgeResult {
  registration: {
    id: string;
    ticketCode: string;
    status: string;
    person: {
      name: string;
      email: string;
      company: string | null;
    };
  };
  qrToken: string;
  qrDataUrl: string;
}

export default function RegisterPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState<'DELEGATE' | 'FACULTY' | 'PG STUDENT'>('DELEGATE');
  const [savedPhone, setSavedPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBadge, setCreatedBadge] = useState<NewBadgeResult | null>(null);

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setSelectedEventId(data.events[0].id);
        }
      })
      .catch((err) => console.error('Failed to load events:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formattedPhone = phone ? `+91${phone}` : undefined;
      setSavedPhone(phone);

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          firstName,
          lastName,
          email,
          phone: formattedPhone,
          company: company || undefined,
          jobTitle: category,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setCreatedBadge(data);
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setCategory('DELEGATE');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
          Attendee Registration
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Instantly register an attendee, provision all 19 entitlements, and generate a zero-PII QR access badge.
        </p>
      </div>

      {error && (
        <div className="card" style={{ color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          {error}
        </div>
      )}

      {/* Registration Form */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Event</label>
            <select
              className="form-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              required
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.venue})
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="jane.doe@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number (10 Digits)</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: '#f1f5f9',
                    border: '1px solid var(--border)',
                    borderRight: 'none',
                    borderRadius: '8px 0 0 8px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    userSelect: 'none',
                  }}
                >
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  className="form-input"
                  style={{ borderRadius: '0 8px 8px 0' }}
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(digits);
                  }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Pre-added country code +91. Limited to exactly 10 digits.
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Doctor Category *</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'DELEGATE' | 'FACULTY' | 'PG STUDENT')}
                required
              >
                <option value="DELEGATE">DELEGATE</option>
                <option value="FACULTY">FACULTY</option>
                <option value="PG STUDENT">PG STUDENT</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Institution / Hospital / District</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AIIMS Deoghar / Ranchi"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="header-actions-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: '180px' }}>
              {loading ? 'Registering...' : 'Register Attendee & Issue Badge'}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Badge Modal / Preview */}
      {createdBadge && (
        <div className="modal-overlay" onClick={() => setCreatedBadge(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-available">Registration Issued</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                  {createdBadge.registration.person.name}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatedBadge(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '1.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>
              {/* QR Code */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-md)',
                  border: '2px solid var(--primary)',
                }}
              >
                <Image
                  src={createdBadge.qrDataUrl}
                  alt="Attendee QR Access Badge"
                  width={220}
                  height={220}
                  style={{ display: 'block', borderRadius: '4px' }}
                  unoptimized
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Ticket Code
                </div>
                <code style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.05em' }}>
                  {createdBadge.registration.ticketCode}
                </code>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  background: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                  SCANNABLE BEARER TOKEN (COPY TO TEST IN SCANNER):
                </div>
                <code
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--accent)',
                    wordBreak: 'break-all',
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {createdBadge.qrToken}
                </code>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href="/scanner"
                  className="btn btn-primary btn-sm"
                >
                  Go to Scanner to Test
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                >
                  Print Badge
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const cleanPhone = savedPhone.replace(/\D/g, '');
                    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventt-nu.vercel.app';
                    const badgeUrl = `${origin}/badge/${createdBadge.registration.ticketCode}`;
                    const rawName = createdBadge.registration.person.name || '';
                    const cleanName = rawName.trim().replace(/^Dr\.?\s+/i, '');
                    const displayName = `Dr. ${cleanName}`;
                    const categoryText = (category || 'Delegate').toUpperCase();
                    const text = `Dear ${displayName},\n\nGreetings from JASICON 2026, Deoghar.\n\nYour registration for the 25th Annual Conference of ASI (Jharkhand Chapter) is confirmed.\n\nRegistration Details:\n• Delegate: ${displayName}\n• Category: ${categoryText}\n• Reg No: ${createdBadge.registration.ticketCode}\n• Venue: Deoghar, Jharkhand\n\nAccess your Digital Badge & Entry QR Code:\n${badgeUrl}\n\nPlease show this QR code at the registration desk for express check-in, conference kit, and meal access.\n\nWarm regards,\nOrganizing Committee\nJASICON 2026, Deoghar`;
                    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                >
                  <span>📱</span> Send to WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
