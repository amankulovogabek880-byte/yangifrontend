'use client';
import { useState, useEffect, useCallback } from 'react';

const SRC_ICON: Record<string, string> = {
  TELEGRAM: '✈️', INSTAGRAM: '📷', WHATSAPP: '💚',
  WEBSITE: '🌐', REFERRAL: '🤝', CALL: '📞',
  FACEBOOK: '📘', WALKIN: '🚶', OTHER: '📋',
};
const STAGE_LABEL: Record<string, string> = {
  NEW_LEAD: 'Yangi', CONTACTED: 'Bog\'landi', INTERESTED: 'Qiziqish',
  OFFER_SENT: 'Taklif', NEGOTIATION: 'Muzokara',
  DEPOSIT_PAID: 'Avans', CONFIRMED: 'Tasdiqlandi',
  COMPLETED: 'Yakunlandi', LOST: 'Yo\'qotildi',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#6b7194', CONFIRMED: '#10b981', COMPLETED: '#3d7eff',
  CANCELLED: '#ef4444', IN_PROGRESS: '#f59e0b',
};

function fmt(d: string | Date) {
  return new Date(d).toLocaleString('uz-UZ', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short', year:'numeric' });
}

function StatCard({ label, value, color, sub }: any) {
  return (
    <div style={{
      padding: '14px 16px', background: 'rgba(255,255,255,0.025)',
      border: '1px solid var(--border)', borderRadius: 14,
      flex: '1 1 140px', minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: -0.4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function KalendarTab({ calendarApi }: { calendarApi: any }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode]     = useState<'single'|'range'>('single');
  const [date, setDate]     = useState(today);
  const [from, setFrom]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo]         = useState(today);
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = mode === 'single' ? { date } : { from, to };
      const r: any = await calendarApi(params);
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [mode, date, from, to, calendarApi]);

  useEffect(() => { load(); }, [load]);

  const inp: React.CSSProperties = {
    padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)', borderRadius: 9,
    color: 'var(--fg)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Sana tanlagich ── */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, gap: 2 }}>
            {(['single','range'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: mode === m ? 'var(--primary)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--fg-4)',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.14s',
              }}>
                {m === 'single' ? '📅 Bitta kun' : '📆 Oraliq'}
              </button>
            ))}
          </div>

          {mode === 'single' ? (
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp}/>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp}/>
              <span style={{ color: 'var(--fg-4)', fontSize: 13 }}>→</span>
              <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={inp}/>
            </div>
          )}

          <button onClick={load} disabled={loading} style={{
            padding: '8px 18px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg,#3d7eff,#a855f7)',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
          }}>
            {loading ? '⏳' : '🔄 Yangilash'}
          </button>

          {data && (
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginLeft: 'auto' }}>
              {mode === 'single' ? fmtDate(date) : `${fmtDate(from)} — ${fmtDate(to)}`}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <span className="spinner spinner-lg"/>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── STAT CARDS ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Jami daromad"    value={`$${(data.stats?.revenue || 0).toLocaleString()}`}       color="#10b981"/>
            <StatCard label="Sof foyda"       value={`$${(data.stats?.profit || 0).toLocaleString()}`}        color="#8b5cf6"/>
            <StatCard label="To'langan"        value={`$${(data.stats?.paid || 0).toLocaleString()}`}          color="#3d7eff"/>
            <StatCard label="Yangi leadlar"   value={data.stats?.newLeads || 0}                               color="#06b6d4"/>
            <StatCard label="Bookinglar"      value={data.stats?.bookingsCount || 0}                          color="#f59e0b" sub={`${data.stats?.confirmedBookings || 0} tasdiqlangan`}/>
          </div>

          {/* ── SINGLE DAY ── */}
          {data.isSingleDay && (
            <>
              {/* 3 ustunli blok */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

                {/* Leadlar ro'yxati */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🎯 Leadlar ({data.leads?.length || 0})</div>
                  {!data.leads?.length ? (
                    <div style={{ color: 'var(--fg-4)', fontSize: 13, textAlign: 'center', padding: 24 }}>Lead yo'q</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                      {data.leads.map((l: any) => (
                        <div key={l.id} style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 9, borderLeft: '3px solid #3d7eff' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)' }}>{l.fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span>{SRC_ICON[l.source] || '📋'} {l.source}</span>
                            {l.assignedAgent && <span>👤 {l.assignedAgent.name}</span>}
                            <span style={{ color: '#3d7eff' }}>{STAGE_LABEL[l.pipelineStage] || l.pipelineStage}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🕐 Amaliyotlar ({data.timeline?.length || 0})</div>
                  {!data.timeline?.length ? (
                    <div style={{ color: 'var(--fg-4)', fontSize: 13, textAlign: 'center', padding: 24 }}>Hodisalar yo'q</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 340, overflowY: 'auto' }}>
                      {data.timeline.slice(0, 40).map((t: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(30,36,64,0.5)' }}>
                          <div style={{ width: 52, fontSize: 10, color: 'var(--fg-5)', flexShrink: 0, paddingTop: 2 }}>
                            {new Date(t.createdAt).toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' })}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.4 }}>{t.title}</div>
                            {t.description && <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 1 }}>{t.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sotuvlar */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>✈️ Sotuvlar ({data.bookings?.length || 0})</div>
                  {!data.bookings?.length ? (
                    <div style={{ color: 'var(--fg-4)', fontSize: 13, textAlign: 'center', padding: 24 }}>Booking yo'q</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                      {data.bookings.map((b: any) => (
                        <div key={b.id} style={{ padding: '9px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: 9, borderLeft: `3px solid ${STATUS_COLOR[b.status] || '#6b7194'}` }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{b.client?.fullName || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{b.tourName}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: STATUS_COLOR[b.status] || 'var(--fg-4)' }}>{b.status}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>${(b.totalPrice||0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent faolligi + Manba */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <AgentActivityTable agentActivity={data.agentActivity}/>
                <SourceBreakdown sourceBreakdown={data.sourceBreakdown}/>
              </div>
            </>
          )}

          {/* ── RANGE MODE ── */}
          {!data.isSingleDay && (
            <>
              {/* Best day */}
              {data.bestDay && (
                <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>🏆</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#10b981' }}>Eng faol kun: {fmtDate(data.bestDay.date)}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                      {data.bestDay.leads} lead · {data.bestDay.bookings} booking · ${(data.bestDay.revenue||0).toLocaleString()} daromad
                    </div>
                  </div>
                </div>
              )}

              {/* Kunlik jadval */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', overflowX: 'auto' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📅 Kunlik ko'rsatkichlar</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Kun','Leadlar','Bookinglar','Daromad','Foyda'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--fg-5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyBreakdown?.map((d: any) => {
                      const isBest = d.date === data.bestDay?.date;
                      return (
                        <tr key={d.date} style={{ borderTop: '1px solid rgba(30,36,64,0.5)', background: isBest ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', fontWeight: isBest ? 700 : 400, color: isBest ? '#10b981' : 'var(--fg-2)' }}>
                            {fmtDate(d.date)} {isBest && '🏆'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#06b6d4', fontWeight: 600 }}>{d.leads}</td>
                          <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 600 }}>{d.bookings}</td>
                          <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 700 }}>{d.revenue > 0 ? `$${d.revenue.toLocaleString()}` : '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#8b5cf6', fontWeight: 700 }}>{d.profit > 0 ? `$${d.profit.toLocaleString()}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Agent + Manba */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <AgentActivityTable agentActivity={data.agentActivity}/>
                <SourceBreakdown sourceBreakdown={data.sourceBreakdown}/>
              </div>
            </>
          )}
        </>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg-4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div>Sana tanlang va ma'lumotlarni yuklansin</div>
        </div>
      )}
    </div>
  );
}

function AgentActivityTable({ agentActivity }: { agentActivity: any[] }) {
  if (!agentActivity?.length) return null;
  const active = agentActivity.filter((a: any) => a.leads + a.bookings + a.calls > 0);
  if (!active.length) return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>👥 Agent faolligi</div>
      <div style={{ color: 'var(--fg-4)', fontSize: 13, textAlign: 'center', padding: 16 }}>Faollik yo'q</div>
    </div>
  );
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', overflowX: 'auto' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>👥 Agent faolligi</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Agent','Leadlar','Bookinglar','Calllar'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--fg-5)', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((a: any) => (
            <tr key={a.agent.id} style={{ borderTop: '1px solid rgba(30,36,64,0.4)' }}>
              <td style={{ padding: '9px 12px', fontWeight: 600 }}>{a.agent.name}</td>
              <td style={{ padding: '9px 12px', color: '#06b6d4', fontWeight: 700 }}>{a.leads}</td>
              <td style={{ padding: '9px 12px', color: '#10b981', fontWeight: 700 }}>{a.bookings}</td>
              <td style={{ padding: '9px 12px', color: '#f59e0b', fontWeight: 700 }}>{a.calls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceBreakdown({ sourceBreakdown }: { sourceBreakdown: any[] }) {
  if (!sourceBreakdown?.length) return null;
  const total = sourceBreakdown.reduce((s: number, x: any) => s + x.count, 0);
  const colors: Record<string, string> = {
    TELEGRAM:'#3d7eff', INSTAGRAM:'#ec4899', WHATSAPP:'#10b981',
    WEBSITE:'#8b5cf6', REFERRAL:'#f59e0b', CALL:'#06b6d4',
    FACEBOOK:'#3b82f6', OTHER:'#6b7194',
  };
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🎯 Manba taqsimoti</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sourceBreakdown.map((s: any) => {
          const pct = total > 0 ? Math.round(s.count / total * 100) : 0;
          const color = colors[s.source] || '#6b7194';
          return (
            <div key={s.source}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{SRC_ICON[s.source] || '📋'} {s.source}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{s.count} ({pct}%)</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%`, transition: 'width 0.4s' }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
