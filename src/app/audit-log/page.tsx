'use client';

import { useEffect, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { auditApi } from '@/services/api';
import { fmtDate, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';

// v17: Audit jurnali — tizimda kim, qachon, nimani o'zgartirgani.
// Backend allaqachon tenantId bo'yicha izolyatsiya qilingan (faqat
// o'z kompaniyangiz yozuvlarini ko'rasiz) va faqat `view_audit_log`
// ruxsatiga ega foydalanuvchilar kira oladi (standart: TENANT_ADMIN,
// MANAGER — kerak bo'lsa Sozlamalar > Ruxsatlar orqali boshqalarga
// ham berish mumkin).

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#10b981', UPDATE: '#3d7eff', DELETE: '#ef4444', LOGIN: '#94a3b8',
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [options, setOptions] = useState<{ entities: string[]; actions: string[] }>({ entities: [], actions: [] });
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    auditApi.list({ entity: entity || undefined, action: action || undefined, from: from || undefined, to: to || undefined, page, limit: 30 })
      .then((res: any) => {
        if (cancelled) return;
        setRows(res.data?.data || []);
        setTotalPages(res.data?.meta?.totalPages || 1);
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 403) setForbidden(true);
        else toast.error(errMsg(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entity, action, from, to, page]);

  useEffect(() => {
    // Filtr variantlarini (mavjud entity/action turlari) bir marta yuklab olamiz
    auditApi.filterOptions()
      .then((res: any) => setOptions(res.data))
      .catch(() => {});
  }, []);

  if (forbidden) {
    return (
      <CrmLayout>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div>Audit jurnalini ko'rish uchun ruxsatingiz yo'q.</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Administratordan "Audit jurnalini ko'rish" ruxsatini so'rang.</div>
        </div>
      </CrmLayout>
    );
  }

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📜 Audit jurnali</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>
          Kompaniyangizdagi barcha o'zgarishlar tarixi — kim, qachon, nimani yaratgan/o'zgartirgan/o'chirgan.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={entity} onChange={e => { setEntity(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Barcha bo'limlar</option>
            {options.entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="">Barcha amallar</option>
            {options.actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }} />
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }} />
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Vaqt</th>
                <th style={{ padding: '10px 14px' }}>Foydalanuvchi</th>
                <th style={{ padding: '10px 14px' }}>Amal</th>
                <th style={{ padding: '10px 14px' }}>Bo'lim</th>
                <th style={{ padding: '10px 14px' }}>Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>Hech narsa topilmadi</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>{r.user?.name || '—'} <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>({r.user?.role})</span></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#fff', background: ACTION_COLORS[r.action] || '#64748b' }}>{r.action}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>{r.entity}{r.entityId ? ` #${String(r.entityId).slice(0,8)}` : ''}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--fg-3)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description || (r.metadata ? JSON.stringify(r.metadata).slice(0, 80) : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
              ← Oldingi
            </button>
            <span style={{ padding: '6px 10px', fontSize: 13, color: 'var(--fg-3)' }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>
              Keyingi →
            </button>
          </div>
        )}
      </div>
    </CrmLayout>
  );
}