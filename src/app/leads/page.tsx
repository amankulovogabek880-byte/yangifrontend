'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { clientsApi } from '@/services/api';
import { useAuth } from '@/lib/store';

const SL: Record<string,string> = { NEW_LEAD:'Yangi', CONTACTED:'Aloqa', NO_CONTACT:'Javob yo\'q', OFFER_SENT:'Taklif', FOLLOW_UP:'Qayta', INVITED_TO_OFFICE:'Chaqirildi', CAME_TO_OFFICE:'Keldi', DID_NOT_COME:'Kelmadi', ADVANCE_PAID:'Avans', PAID:'To\'landi', LOST:'Yo\'qotildi' };
const SI: Record<string,string> = { TELEGRAM:'📨', INSTAGRAM:'📷', WHATSAPP:'💚', WEBSITE:'🌐', REFERRAL:'🤝', OTHER:'📋' };

export default function LeadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [stage, setStage] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = () => { setLoading(true); clientsApi.list({ search: search || undefined, source: source || undefined, stage: stage || undefined, page, limit: 30 }).then(r => { const d = r.data; setLeads(Array.isArray(d) ? d : (d?.data || d?.clients || [])); setTotal(d?.total || 0); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [search, source, stage, page]);

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🎯 Leadlar ({total})</h1>
          <button onClick={() => router.push('/clients/new')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Yangi</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Qidirish..." style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }} />
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Barcha manba</option>
            {['TELEGRAM','INSTAGRAM','WHATSAPP','WEBSITE','REFERRAL','OTHER'].map(s => <option key={s} value={s}>{SI[s]} {s}</option>)}
          </select>
          <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Barcha bosqich</option>
            {Object.entries(SL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leads.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>Lead topilmadi</div>}
            {leads.map((c: any) => (
              <div key={c.id} onClick={() => router.push(`/clients/${c.id}`)} style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{SI[c.source]||'📋'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{c.phone}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'var(--bg-3)', color: 'var(--fg-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{SL[c.pipelineStage] || c.pipelineStage}</span>
                {c.leadScore > 0 && <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 8, background: c.leadScore>70?'#10b98115':'var(--bg-3)', color: c.leadScore>70?'#10b981':'var(--fg-3)', fontWeight: 700 }}>🎯 {c.leadScore}%</span>}
                {user?.role !== 'AGENT' && c.assignedAgent && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>👤 {c.assignedAgent.name}</span>}
                <span style={{ color: 'var(--fg-3)' }}>›</span>
              </div>
            ))}
            {total > 30 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>← Oldingi</button>
                <span style={{ padding: '6px 14px' }}>{page}/{Math.ceil(total/30)}</span>
                <button onClick={() => setPage(p => p+1)} disabled={page>=Math.ceil(total/30)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>Keyingi →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}
