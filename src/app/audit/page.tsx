'use client';

import { useState, useEffect } from 'react';

interface AuditLogItem {
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

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      setLogs(data.recentLogs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (isMounted) {
          setLogs(data.recentLogs || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initialLoad();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
            Redemption Audit History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Complete tamper-evident log of all check-in scans, successful entitlement claims, and rejected attempts.
          </p>
        </div>

        <button onClick={() => void refreshLogs()} className="btn btn-secondary btn-sm">
          ↻ Refresh Logs
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No redemption events recorded yet.
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: '14px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Attendee</th>
                  <th>Ticket</th>
                  <th>Entitlement</th>
                  <th>Outcome</th>
                  <th>Device / Scanner Station</th>
                  <th>Audit Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {new Date(log.scannedAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{log.participantName}</td>
                    <td>
                      <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                        {log.ticketCode}
                      </code>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {log.entitlementCategory === 'MEAL' ? '🍱' : '🎤'} {log.entitlementTitle}
                      </span>
                    </td>
                    <td>
                      {log.result === 'SUCCESS' ? (
                        <span className="badge badge-available">SUCCESS</span>
                      ) : log.result === 'ALREADY_REDEEMED' ? (
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                          DUPLICATE ATTEMPT
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
                          {log.result}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      {log.deviceInfo || 'Default Scanner'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {log.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
