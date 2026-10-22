'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BackendData {
  status: string;
  database: {
    engine: string;
    host: string;
    port: number;
    name: string;
    latencyMs: number;
    connectionState: string;
    orm: string;
  };
  counts: {
    users: number;
    participants: number;
    registrations: number;
    checkedIn: number;
    entitlements: {
      total: number;
      redeemed: number;
      available: number;
      meals: { total: number; redeemed: number };
      sessions: { total: number; redeemed: number };
    };
    auditLogs: number;
  };
  event: {
    id: string;
    title: string;
    slug: string;
    venue: string;
    isActive: boolean;
  } | null;
  apiEndpoints: Array<{
    method: string;
    path: string;
    description: string;
  }>;
  prismaStudioCommand: string;
  prismaStudioUrl: string;
}

export default function BackendDetailsPage() {
  const [data, setData] = useState<BackendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const fetchBackendStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/backend/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to retrieve backend details`);
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendStatus();
    const interval = setInterval(fetchBackendStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="card dashboard-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-available">● Backend &amp; Architecture</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              JASICON 2026 Engine
            </span>
          </div>
          <h1 className="dashboard-banner-title">
            Backend &amp; Database Architecture Details
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            Live status of PostgreSQL 16 database, Prisma ORM schema, REST API endpoints, and data tables.
          </p>
        </div>

        <div className="dashboard-banner-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchBackendStatus}
            disabled={loading}
          >
            <span>🔄</span> Refresh Status
          </button>
          <Link href="/audit" className="btn btn-primary btn-sm">
            <span>🕒</span> View Live Audit Logs
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading live backend metadata and database connectivity...
        </div>
      ) : error ? (
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <strong>Error loading backend details:</strong> {error}
        </div>
      ) : (
        data && (
          <>
            {/* Visual Database & GUI Explorer Highlight Card */}
            <div
              className="card"
              style={{
                background: 'linear-gradient(135deg, rgba(13, 98, 94, 0.05) 0%, rgba(5, 150, 105, 0.08) 100%)',
                border: '1.5px solid rgba(13, 98, 94, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🗄️</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      Visual Database Explorer (Prisma Studio)
                    </h2>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', maxWidth: '650px' }}>
                    You can inspect, search, filter, and edit all raw records (Users, Delegates, 19 Entitlements, Scans) visually in your browser using Prisma Studio.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(data.prismaStudioCommand)}
                    className="btn btn-primary btn-sm"
                    style={{ fontFamily: 'monospace' }}
                  >
                    <span>{copiedCmd ? '✓ Copied!' : '📋 Copy command: npx prisma studio'}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>How to launch:</span>
                <span style={{ color: 'var(--text-main)' }}>Open your terminal and run <code>npx prisma studio</code>. It will open in your browser at <code>http://localhost:5555</code>.</span>
              </div>
            </div>

            {/* Quick KPI Stats for Backend Models */}
            <div className="grid-stats">
              <div className="stat-card">
                <div className="stat-label">Database Engine</div>
                <div className="stat-val" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                  {data.database.engine}
                </div>
                <div className="stat-sub">
                  Port: <strong>{data.database.port}</strong> • Latency: {data.database.latencyMs}ms
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>
                  ● {data.database.connectionState}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Registered Attendees</div>
                <div className="stat-val">{data.counts.registrations}</div>
                <div className="stat-sub">
                  {data.counts.checkedIn} checked in ({data.counts.registrations > 0 ? Math.round((data.counts.checkedIn / data.counts.registrations) * 100) : 0}%)
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Stored in <code>event_registrations</code> &amp; <code>people</code>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Total Entitlements</div>
                <div className="stat-val">{data.counts.entitlements.total}</div>
                <div className="stat-sub">
                  {data.counts.entitlements.redeemed} redeemed • {data.counts.entitlements.available} available
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {data.counts.entitlements.meals.total} Meals + {data.counts.entitlements.sessions.total} Sessions
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Audit Scan Logs</div>
                <div className="stat-val">{data.counts.auditLogs}</div>
                <div className="stat-sub">
                  Immutable event entries
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Zero-PII SHA-256 tokens
                </div>
              </div>
            </div>

            {/* Technical Connection Details & File Locations */}
            <div className="card">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '1rem' }}>
                System Configuration &amp; File Map
              </h2>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Location / Value</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Prisma Schema</td>
                      <td><code>prisma/schema.prisma</code></td>
                      <td>Complete database models: User, Person, Event, EventRegistration, Entitlement, RedemptionLog</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Database Storage</td>
                      <td><code>.pgdata/</code></td>
                      <td>Local isolated PostgreSQL 16 data cluster on port 5433</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Database Scripts</td>
                      <td><code>scripts/db.mjs</code></td>
                      <td>Lifecycle commands: <code>npm run db:status</code>, <code>npm run db:start</code>, <code>npm run db:stop</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Environment Config</td>
                      <td><code>.env</code></td>
                      <td><code>DATABASE_URL</code>, <code>SESSION_SECRET</code>, <code>RATE_LIMIT</code></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Authentication &amp; Security</td>
                      <td><code>src/lib/auth.ts</code></td>
                      <td>HTTP-only cookies, HMAC-SHA256 signatures, scrypt password hashing, role enforcement</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Route Guarding</td>
                      <td><code>src/middleware.ts</code></td>
                      <td>Automatic redirection to <code>/login</code> when no active user session exists</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* REST API Endpoints Overview */}
            <div className="card">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '1rem' }}>
                REST API Backend Endpoints
              </h2>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Endpoint Route</th>
                      <th>Purpose &amp; Security</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.apiEndpoints.map((ep) => (
                      <tr key={ep.path}>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              background: ep.method === 'POST' ? '#e0f2fe' : '#ecfdf5',
                              color: ep.method === 'POST' ? '#0369a1' : '#047857',
                            }}
                          >
                            {ep.method}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontWeight: 700, color: 'var(--primary)' }}>{ep.path}</code>
                        </td>
                        <td style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {ep.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Seed Staff Accounts */}
            <div className="card">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
                System Staff Accounts (Pre-configured)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Use these credentials to authenticate into different roles when testing portal features.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0', background: '#ecfdf5' }}>
                  <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem' }}>👑 Super Administrator</div>
                  <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '4px' }}>
                    Email: <code>admin@jasicon2026.com</code>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>
                    Password: <code>Admin123!</code>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '6px' }}>
                    Privileges: Full CRUD on Attendees, Bulk Import, Backend Details &amp; Audit Logs.
                  </div>
                </div>

                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #bae6fd', background: '#f0f9ff' }}>
                  <div style={{ fontWeight: 800, color: '#075985', fontSize: '0.95rem' }}>💻 Registration Desk Operator</div>
                  <div style={{ fontSize: '0.82rem', color: '#0369a1', marginTop: '4px' }}>
                    Email: <code>desk@jasicon2026.com</code>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#0369a1', marginTop: '2px' }}>
                    Password: <code>Desk123!</code>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '6px' }}>
                    Privileges: Attendee Check-In, Walk-in Registrations &amp; Badge Printing.
                  </div>
                </div>

                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #fde68a', background: '#fffbeb' }}>
                  <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>🍽️ Station Vendor / Caterer</div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '4px' }}>
                    Email: <code>caterer@jasicon2026.com</code>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: '2px' }}>
                    Password: <code>Vendor123!</code>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '6px' }}>
                    Privileges: Dedicated 1-Scan Counter Station for rapid meal redemption.
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
