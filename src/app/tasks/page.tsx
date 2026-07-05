'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { tasksApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const { user } = useAuth();
  const { t: tr } = useI18n();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sf, setSf] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [nt, setNt] = useState({ title: '', dueAt: '', priority: 'MEDIUM' });

  const load = () => { setLoading(true); tasksApi.list({ status: sf || undefined, limit: 100 }).then(r => setTasks(Array.isArray(r.data) ? r.data : (r.data?.data || []))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [sf]);

  async function create() {
    if (!nt.title.trim()) { toast.error(tr('tasks.nameRequired')); return; }
    try { await tasksApi.create({ ...nt, dueAt: nt.dueAt || undefined, assigneeId: user?.id }); toast.success(tr('common.added')); setShowNew(false); setNt({ title: '', dueAt: '', priority: 'MEDIUM' }); load(); } catch { toast.error(tr('common.error')); }
  }
  async function toggle(t: any) {
    try { await tasksApi.update(t.id, { status: t.status === 'DONE' ? 'TODO' : 'DONE' }); load(); } catch {}
  }

  const PC: Record<string,string> = { URGENT:'#dc2626', HIGH:'#ef4444', MEDIUM:'#f59e0b', LOW:'#94a3b8' };
  const now = new Date();

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>☑ {tr('tasks.title')}</h1>
          <button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{tr('common.new')}</button>
        </div>
        {showNew && (
          <div style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={{ gridColumn: '1/-1', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }} value={nt.title} onChange={e => setNt(n => ({ ...n, title: e.target.value }))} placeholder={tr('tasks.namePlaceholder')} />
            <input type="datetime-local" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }} value={nt.dueAt} onChange={e => setNt(n => ({ ...n, dueAt: e.target.value }))} />
            <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }} value={nt.priority} onChange={e => setNt(n => ({ ...n, priority: e.target.value }))}>
              {['URGENT','HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{tr('priority.'+p)}</option>)}
            </select>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>{tr('common.cancel')}</button>
              <button onClick={create} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{tr('common.save')}</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['','common.all'],['TODO','tasks.todo'],['IN_PROGRESS','tasks.inProgress'],['DONE','tasks.done']].map(([v,l]) => (
            <button key={v} onClick={() => setSf(v)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: sf === v ? '#3d7eff' : 'var(--bg-3)', color: sf === v ? 'white' : 'var(--fg-2)' }}>{tr(l)}</button>
          ))}
        </div>
        {loading ? <div style={{ color: 'var(--fg-3)' }}>{tr('common.loading')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('tasks.empty')}</div>}
            {tasks.map((t: any) => {
              const ov = t.dueAt && new Date(t.dueAt) < now && t.status !== 'DONE';
              return (
                <div key={t.id} style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${PC[t.priority]||'#94a3b8'}`, display: 'flex', gap: 12 }}>
                  <input type="checkbox" checked={t.status === 'DONE'} onChange={() => toggle(t)} style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, textDecoration: t.status === 'DONE' ? 'line-through' : 'none', color: t.status === 'DONE' ? 'var(--fg-3)' : 'var(--fg)' }}>{t.title}</div>
                    {t.client && <div onClick={() => router.push(`/clients/${t.client.id}`)} style={{ fontSize: 11, color: '#3d7eff', cursor: 'pointer', marginTop: 2 }}>👤 {t.client.fullName}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                      {t.dueAt && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: ov ? '#ef444420' : 'var(--bg-3)', color: ov ? '#ef4444' : 'var(--fg-3)' }}>⏰ {new Date(t.dueAt).toLocaleString('uz-UZ')}</span>}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: `${PC[t.priority]}20`, color: PC[t.priority]||'#94a3b8' }}>{tr('priority.'+t.priority)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}