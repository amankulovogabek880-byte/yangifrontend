'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { followUpsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

export default function FollowupsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', note: '', dueAt: '' });

  const load = () => { setLoading(true); followUpsApi.list({ done: 'false' }).then(r => setItems(Array.isArray(r.data) ? r.data : (r.data?.data || []))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  async function done(id: string) { try { await followUpsApi.complete(id); toast.success(t('fu.done')); load(); } catch {} }
  async function create() {
    if (!form.title.trim() || !form.dueAt) { toast.error(t('fu.required')); return; }
    try { await followUpsApi.create({ ...form, agentId: user?.id }); toast.success('Qo\'shildi'); setShowNew(false); setForm({ title: '', note: '', dueAt: '' }); load(); } catch { toast.error(t('common.error')); }
  }

  const now = new Date();
  const overdue = items.filter(i => new Date(i.dueAt) < now);
  const upcoming = items.filter(i => new Date(i.dueAt) >= now);

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 700 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('fu.title')}</h1>
          <button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Yangi</button>
        </div>
        {showNew && (
          <div style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder={t('tasks.namePlaceholder')} />
            <input type="datetime-local" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }} value={form.dueAt} onChange={e => setForm(f => ({...f, dueAt: e.target.value}))} />
            <textarea style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, minHeight: 60, resize: 'vertical' }} value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} placeholder={t('fu.notePh')} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={create} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{t('common.save')}</button>
            </div>
          </div>
        )}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{t('common.loading')}</div> : (
          <>
            {overdue.length > 0 && <><h3 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Muddati o'tgan ({overdue.length})</h3>
              {overdue.map((it: any) => <FItem key={it.id} item={it} onDone={() => done(it.id)} router={router} color="#ef4444" />)}</>}
            {upcoming.length > 0 && <><h3 style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6', margin: '16px 0 8px' }}>Kutilmoqda ({upcoming.length})</h3>
              {upcoming.map((it: any) => <FItem key={it.id} item={it} onDone={() => done(it.id)} router={router} color="#3b82f6" />)}</>}
            {items.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('fu.empty')}</div>}
          </>
        )}
      </div>
    </CrmLayout>
  );
}
function FItem({ item, onDone, router, color }: any) {
  return (
    <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, display: 'flex', gap: 12, marginBottom: 8 }}>
      <input type="checkbox" onChange={onDone} style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
        {item.note && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{item.note}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
          <span style={{ fontSize: 11, color }}>{new Date(item.dueAt).toLocaleString('uz-UZ')}</span>
          {item.client && <span onClick={() => router.push(`/clients/${item.client.id}`)} style={{ fontSize: 11, color: '#3d7eff', cursor: 'pointer' }}>👤 {item.client.fullName}</span>}
        </div>
      </div>
    </div>
  );
}