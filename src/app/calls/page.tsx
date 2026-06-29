'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { callsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useDialer } from '@/lib/dialer';
import { fmtDate, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  QUEUED: '⏳ Navbatda', INITIATED: '📞 Boshlandi', RINGING: '🔔 Jiringlayapti',
  IN_PROGRESS: '🟢 Suhbatda', COMPLETED: '✅ Tugadi', FAILED: '❌ Xato',
  NO_ANSWER: '📵 Javob yo\'q', BUSY: '🔴 Band', CANCELED: '🚫 Bekor',
};
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981', IN_PROGRESS: '#3d7eff', FAILED: '#ef4444',
  NO_ANSWER: '#f97316', BUSY: '#ef4444', QUEUED: '#94a3b8',
  INITIATED: '#3b82f6', RINGING: '#f59e0b', CANCELED: '#94a3b8',
};

function fmtDuration(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallsPage() {
  const { user } = useAuth();
  const { callNumber } = useDialer();
  const router = useRouter();
  const isAdmin = ['TENANT_ADMIN', 'MANAGER'].includes(user?.role || '');

  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState({ status: '', direction: '', clientId: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 30 };
    if (filter.status) params.status = filter.status;
    if (filter.direction) params.direction = filter.direction;
    callsApi.list().then(r => {
      const d = r.data;
      setCalls(Array.isArray(d) ? d : (d?.data || []));
      setTotal(d?.total || 0);
    }).finally(() => setLoading(false));
    callsApi.stats().then(r => setStats(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [filter, page]);

  function playRecording(url: string, callId: string) {
    if (playing === callId) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      setPlaying(callId);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    }
  }

  async function callBack(phone: string, clientId?: string, clientName?: string) {
    try {
      await callNumber(phone, clientId, clientName);
    } catch (e: any) {
      toast.error(errMsg(e));
    }
  }

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📞 Qo'ng'iroqlar tarixi</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Jami', value: stats.total || 0, color: '#3d7eff' },
              { label: 'Muvaffaqiyatli', value: stats.completed || 0, color: '#10b981' },
              { label: 'Javob yo\'q', value: stats.noAnswer || 0, color: '#f97316' },
              { label: 'Jami vaqt', value: fmtDuration(stats.totalDuration || 0), color: '#8b5cf6' },
              { label: 'O\'rt. vaqt', value: fmtDuration(stats.avgDuration || 0), color: '#06b6d4' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filter.status} onChange={e => setFilter(f => ({...f, status: e.target.value}))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Barcha status</option>
            {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filter.direction} onChange={e => setFilter(f => ({...f, direction: e.target.value}))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Ikkala yo'nalish</option>
            <option value="OUTBOUND">📤 Chiquvchi</option>
            <option value="INBOUND">📥 Kiruvchi</option>
          </select>
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer', color: 'var(--fg)', fontSize: 13 }}>🔄 Yangilash</button>
        </div>

        {/* Audio player (hidden) */}
        <audio ref={audioRef} onEnded={() => setPlaying(null)} style={{ display: 'none' }} />

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>
        ) : (
          <>
            {calls.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📞</div>
                <div>Qo'ng'iroqlar yo'q</div>
                <div style={{ fontSize: 12, marginTop: 8, color: 'var(--fg-3)' }}>
                  Sozlamalar → Telefon → OnlinePBX konfiguratsiyasi kerak
                </div>
              </div>
            )}
            {calls.length > 0 && (
              <div style={{ background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-3)', fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                      {['Sana', 'Yo\'nalish', 'Raqam', 'Klient', 'Agent', 'Davomiylik', 'Status', 'Yozuv', 'Harakat'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((c: any) => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--fg-3)', fontSize: 11 }}>
                          {c.startedAt ? new Date(c.startedAt).toLocaleString('uz-UZ') : fmtDate(c.createdAt)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.direction === 'OUTBOUND' ? '📤' : '📥'} {c.direction === 'OUTBOUND' ? 'Chiquvchi' : 'Kiruvchi'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                          {c.toMasked || c.fromMasked || '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.client ? (
                            <span onClick={() => router.push(`/clients/${c.client.id}`)}
                              style={{ color: '#3d7eff', cursor: 'pointer', fontWeight: 600 }}>
                              {c.client.fullName}
                            </span>
                          ) : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--fg-3)', fontSize: 12 }}>
                          {c.agent?.name || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          {fmtDuration(c.duration)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: `${STATUS_COLORS[c.status] || '#94a3b8'}20`,
                            color: STATUS_COLORS[c.status] || '#94a3b8',
                          }}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.recordingUrl ? (
                            <button onClick={() => playRecording(c.recordingUrl, c.id)} style={{
                              padding: '4px 10px', borderRadius: 7, border: 'none',
                              background: playing === c.id ? '#10b981' : '#3d7eff',
                              color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            }}>
                              {playing === c.id ? '⏸ Stop' : '▶ Play'}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {(c.toMasked || c.fromMasked) && (c.status === 'NO_ANSWER' || c.status === 'BUSY') && (
                            <button onClick={() => callBack(c.toMasked || c.fromMasked, c.client?.id, c.client?.fullName)} style={{
                              padding: '4px 10px', borderRadius: 7, border: 'none',
                              background: '#f97316', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            }}>📞 Qayta</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {total > 30 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer' }}>← Oldingi</button>
                <span style={{ padding: '6px 14px' }}>{page} / {Math.ceil(total/30)}</span>
                <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/30)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer' }}>Keyingi →</button>
              </div>
            )}
          </>
        )}
      </div>
    </CrmLayout>
  );
}
