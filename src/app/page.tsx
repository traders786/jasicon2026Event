'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  registrations: {
    total: number;
    checkedIn: number;
    pending: number;
    checkInRate: number;
  };
  meals: {
    total: number;
    redeemed: number;
    available: number;
    rate: number;
  };
  sessions: {
    total: number;
    redeemed: number;
    available: number;
    rate: number;
  };
}

interface RecentLog {
  id: string;
  scannedAt: string;
  result: string;
  deviceInfo: string | null;
  notes: string | null;
  participantName: string;
  ticketCode: string;
  entitlementTitle: string;
  entitlementCategory: string | null;
  operatorName: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) throw new Error('Failed to load dashboard metrics');
        const data = await res.json();
        if (isMounted) {
          setStats(data.stats);
          setLogs(data.recentLogs || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load metrics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadMetrics();
    const interval = setInterval(() => {
      void loadMetrics();
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Event Header Banner (Clean White / Mint Theme) */}
      <div className="card dashboard-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-available">● Active Conference</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Ranchi, Jharkhand • 19 Entitlements Per Delegate
            </span>
          </div>
          <h1 className="dashboard-banner-title">
            25th Annual Conference of JASICON 2026
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            Jharkhand Chapter • Association of Surgeons of India (ASI) • Real-Time Attendance &amp; 19-Entitlement QR Tracking
          </p>
        </div>

        <div className="dashboard-banner-actions">
          <Link href="/scanner" className="btn btn-primary">
            <span>📷</span> Launch QR Scanner
          </Link>
          <Link href="/register" className="btn btn-secondary">
            <span>+</span> New Registration
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {loading && !stats ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading live event metrics...
        </div>
      ) : error ? (
        <div className="card" style={{ color: 'var(--danger)', border: '1px solid var(--danger-border)', background: 'var(--danger-bg)' }}>
          Error: {error}
        </div>
      ) : (
        stats && (
          <div className="grid-stats">
            {/* Total Attendees */}
            <div className="stat-card">
              <div className="stat-label">Total Participants</div>
              <div className="stat-val">{stats.registrations.total}</div>
              <div className="stat-sub">
                {stats.registrations.checkedIn} Checked-in ({stats.registrations.checkInRate}%)
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${stats.registrations.checkInRate}%`, backgroundColor: 'var(--primary)' }}
                />
              </div>
            </div>

            {/* Check-In Progress */}
            <div className="stat-card stat-checkin">
              <div className="stat-label">Attendance Rate</div>
              <div className="stat-val">{stats.registrations.checkInRate}%</div>
              <div className="stat-sub">
                {stats.registrations.pending} pending arrival
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${stats.registrations.checkInRate}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
            </div>

            {/* 9 Meals Progress */}
            <div className="stat-card stat-meals">
              <div className="stat-label">Meal Redemptions (9 Meals Max)</div>
              <div className="stat-val">
                {stats.meals.redeemed}{' '}
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                  / {stats.meals.total}
                </span>
              </div>
              <div className="stat-sub">
                {stats.meals.available} meal servings remaining
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${stats.meals.rate}%`, backgroundColor: '#059669' }}
                />
              </div>
            </div>

            {/* 10 Sessions Progress */}
            <div className="stat-card stat-sessions">
              <div className="stat-label">Session Check-Ins (10 Sessions)</div>
              <div className="stat-val">
                {stats.sessions.redeemed}{' '}
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                  / {stats.sessions.total}
                </span>
              </div>
              <div className="stat-sub">
                {stats.sessions.available} seats/access units open
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${stats.sessions.rate}%`, backgroundColor: 'var(--primary)' }}
                />
              </div>
            </div>
          </div>
        )
      )}

      {/* Real-time Activity Feed */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              Live Redemption Audit Activity
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time immutable log of QR scan events and entitlement state transitions
            </p>
          </div>
          <Link href="/audit" className="btn btn-secondary btn-sm">
            View Full Audit History
          </Link>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            No redemptions recorded yet. Launch the QR Scanner to test check-in!
          </div>
        ) : (
          <>
            <div
              className="mobile-only"
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
                marginBottom: '8px',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>👉</span>
              <span>Swipe table horizontally to inspect all scan event details</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Attendee</th>
                    <th>Ticket</th>
                    <th>Entitlement</th>
                    <th>Status</th>
                    <th>Scanner / Station</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(log.scannedAt).toLocaleTimeString()}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{log.participantName}</td>
                      <td>
                        <code style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          {log.ticketCode}
                        </code>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          {log.entitlementCategory === 'MEAL' ? '🍱' : '🎤'} {log.entitlementTitle}
                        </span>
                      </td>
                      <td>
                        {log.result === 'SUCCESS' ? (
                          <span className="badge badge-available">REDEEMED</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
                            {log.result}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        {log.operatorName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
