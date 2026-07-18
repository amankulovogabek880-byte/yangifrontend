'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { marketplaceApi, clientsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

/**
 * BRON SO'ROVLARIM
 *
 * Agent yuborgan so'rovlar shu yerda ko'rinadi.
 * Oqim: PENDING → SENT → CONFIRMED → Booking
 *
 * MUHIM: AGENT faqat bekor qila oladi. Tasdiqlash — MANAGER va yuqorisi.
 * (Backend ham buni tekshiradi — bu yerda faqat tugmalar yashiriladi.)
 */

const inp: any = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
};
const btnGhost: any = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const ST: Record<string, { c: string; uz: string; ru: string }> = {
  PENDING:   { c: '#f59e0b', uz: 'Kutilmoqda',  ru: 'Ожидает' },
  SENT:      { c: '#3d7eff', uz: 'Yuborildi',   ru: 'Отправлено' },
  CONFIRMED: { c: '#10b981', uz: 'Tasdiqlandi', ru: 'Подтверждено' },
  REJECTED:  { c: '#ef4444', uz: 'Rad etildi',  ru: 'Отклонено' },
  CANCELLED: { c: '#94a3b8', uz: 'Bekor',       ru: 'Отменено' },
};

const CUR: Record<string, string> = { USD: '$', EUR: '€', RUB: '₽', UZS: "so'm" };
function money(v: any, c: string) {
  const n = Number(v) || 0;
  const s = n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return c === 'UZS' ? `${s} so'm` : `${CUR[c] || ''}${s}`;
}
function fdate(d: any) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('ru-RU');
}

export default function MarketplaceRequestsPage() {
  const { t: tr, lang } = useI18n() as any;
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sf, setSf] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [convertFor, setConvertFor] = useState<any>(null);
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);

  const isAgent = user?.role === 'AGENT';

  const load = useCallback(() => {
    setLoading(true);
    marketplaceApi.listRequests({ status: sf || undefined, limit: 100 })
      .then(r => setItems(r.data?.data || []))
      .catch(() => toast.error(tr('common.error')))
      .finally(() => setLoading(false));
  }, [sf]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 200 })
      .then(r => setClients(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, []);

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await marketplaceApi.updateRequestStatus(id, status);
      toast.success(tr('common.saved') || 'OK');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!convertFor) return;
    if (!clientId) { toast.error(tr('mpr.chooseClient')); return; }
    setBusy(true);
    try {
      const r = await marketplaceApi.convertToBooking(convertFor.id, clientId);
      toast.success(tr('mpr.converted'));
      setConvertFor(null);
      setClientId('');
      const bid = r.data?.booking?.id;
      if (bid) router.push(`/bookings/${bid}`); else load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const label = (s: string) => (lang === 'ru' ? ST[s]?.ru : ST[s]?.uz) || s;

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1100 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 18px' }}>📋 {tr('mpr.title')}</h1>

        {/* Status filtri */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['', tr('common.all') || 'Hammasi'], ...Object.keys(ST).map(k => [k, label(k)])].map(([v, l]: any) => (
            <button key={v} onClick={() => setSf(v)} style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: sf === v ? '#3d7eff' : 'var(--bg-3)',
              color: sf === v ? 'white' : 'var(--fg-2)',
            }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--fg-3)', padding: 40, textAlign: 'center' }}>{tr('common.loading')}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            {tr('mpr.empty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((r: any) => {
              const st = ST[r.status] || ST.PENDING;
              const pax = (r.adults || 0) + (r.children || 0) + (r.infants || 0);
              return (
                <div key={r.id} style={{
                  padding: 16, background: 'var(--bg-2)', borderRadius: 12,
                  border: '1px solid var(--border)', borderLeft: `3px solid ${st.c}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.tour?.title || '—'}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: st.c + '22', color: st.c,
                        }}>{label(r.status)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                        {r.requestRef} · 📍 {r.tour?.destination}
                        {r.tour?.departureDate ? ` · 🗓 ${fdate(r.tour.departureDate)}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>
                        {r.operator?.name}
                        {r.operator?.contactPhone ? ` · 📞 ${r.operator.contactPhone}` : ''}
                        {r.operator?.contactEmail ? ` · ✉ ${r.operator.contactEmail}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>
                        👥 {tr('mpr.pax')}: {pax} ({r.adults}+{r.children}+{r.infants})
                        {r.tour?.price ? ` · ${money(r.tour.price, r.tour.currency)}` : ''}
                      </div>
                      {r.note && (
                        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6, fontStyle: 'italic' }}>💬 {r.note}</div>
                      )}
                      {r.operatorResponse && (
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6 }}>
                          <b>{tr('mpr.response')}:</b> {r.operatorResponse}
                        </div>
                      )}
                    </div>

                    {/* Amallar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      {!isAgent && r.status === 'PENDING' && (
                        <button style={btnGhost} disabled={busy} onClick={() => setStatus(r.id, 'SENT')}>{tr('mpr.markSent')}</button>
                      )}
                      {!isAgent && (r.status === 'PENDING' || r.status === 'SENT') && (
                        <>
                          <button style={{ ...btnGhost, borderColor: '#10b981', color: '#10b981' }}
                            disabled={busy} onClick={() => setStatus(r.id, 'CONFIRMED')}>{tr('mpr.confirm')}</button>
                          <button style={{ ...btnGhost, borderColor: '#ef4444', color: '#ef4444' }}
                            disabled={busy} onClick={() => setStatus(r.id, 'REJECTED')}>{tr('mpr.reject')}</button>
                        </>
                      )}
                      {['PENDING', 'SENT'].includes(r.status) && (
                        <button style={btnGhost} disabled={busy} onClick={() => setStatus(r.id, 'CANCELLED')}>{tr('mpr.cancel')}</button>
                      )}
                      {r.status === 'CONFIRMED' && !r.bookingId && (
                        <button style={{
                          padding: '7px 14px', borderRadius: 8, border: 'none', background: '#10b981',
                          color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        }} disabled={busy} onClick={() => { setConvertFor(r); setClientId(r.clientId || ''); }}>
                          {tr('mpr.toBooking')}
                        </button>
                      )}
                      {r.bookingId && (
                        <button style={btnGhost} onClick={() => router.push(`/bookings/${r.bookingId}`)}>
                          → Booking
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bookingga o'tkazish modali */}
      {convertFor && (
        <div onClick={() => !busy && setConvertFor(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 20, width: '100%', maxWidth: 420,
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>{tr('mpr.toBooking')}</h2>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 14 }}>{convertFor.tour?.title}</div>

            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>{tr('mpr.chooseClient')}</div>
            <select style={{ ...inp, marginBottom: 16 }} value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">—</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.fullName || c.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={busy} onClick={() => setConvertFor(null)}>{tr('common.cancel')}</button>
              <button style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981',
                color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: busy ? 0.6 : 1,
              }} disabled={busy} onClick={convert}>{tr('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </CrmLayout>
  );
}