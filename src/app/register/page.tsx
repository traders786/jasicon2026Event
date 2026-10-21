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
  const [jobTitle, setJobTitle] = useState('');

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
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          company: company || undefined,
          jobTitle: jobTitle || undefined,
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
      setJobTitle('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+1 555 0192"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Organization / Company</label>
              <input
                type="text"
                className="form-input"
                placeholder="Acme Innovations"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="Senior Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
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

            <div style={{ padding: '1.75rem', textAlign: 'center', background: '#090d16' }}>
              {/* QR Code */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
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
                <code style={{ fontSize: '1.35rem', fontWeight: 800, color: '#818cf8', letterSpacing: '0.05em' }}>
                  {createdBadge.registration.ticketCode}
                </code>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '8px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                  SCANNABLE BEARER TOKEN (COPY TO TEST IN SCANNER):
                </div>
                <code
                  style={{
                    fontSize: '0.8rem',
                    color: '#34d399',
                    wordBreak: 'break-all',
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {createdBadge.qrToken}
                </code>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
