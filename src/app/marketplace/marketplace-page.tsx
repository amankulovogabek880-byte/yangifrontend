'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { marketplaceApi, clientsApi } from '@/services/api';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

/**
 * TURLAR BOZORI — agentlar ko'radigan asosiy sahifa.
 *
 * Bu yerdagi turlar BARCHA agentliklar uchun umumiy (global).
 * Agent turni tanlab "Bron qilish" bosadi → operatorga so'rov ketadi.
 */

const inp: any = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
};
const btnPrimary: any = {
  padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 13,
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

export default function MarketplacePage() {
  const { t: tr } = useI18n();
  const router = useRouter();

  const [tours, setTours] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>({ countries: [], operators: [], destinations: [] });

  const [f, setF] = useState<any>({
    search: '', country: '', operatorId: '',
    priceMin: '', priceMax: '', dateFrom: '', dateTo: '',
    onlyAvailable: false, sort: '',
  });

  // Bron modali
  const [sel, setSel] = useState<any>(null);
  const [req, setReq] = useState<any>({ adults: 1, children: 0, infants: 0, contactName: '', contactPhone: '', note: '', clientId: '' });
  const [clients, setClients] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  // Filtr qiymatlarini bir marta yuklaymiz
  useEffect(() => {
    marketplaceApi.getFilters()
      .then(r => setFilters(r.data || {}))
      .catch(() => {});
    clientsApi.list({ limit: 200 })
      .then(r => setClients(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { page, limit: 24 };
    Object.entries(f).forEach(([k, v]) => {
      if (v !== '' && v !== false && v !== undefined && v !== null) params[k] = v;
    });
    marketplaceApi.listTours(params)
      .then(r => {
        setTours(r.data?.data || []);
        setTotal(r.data?.meta?.total || 0);
      })
      .catch(() => toast.error(tr('common.error')))
      .finally(() => setLoading(false));
  }, [f, page]);

  // Filtr o'zgarsa 1-sahifaga qaytamiz
  useEffect(() => { setPage(1); }, [f]);
  useEffect(() => { load(); }, [load]);

  function openBooking(tour: any) {
    setSel(tour);
    setReq({ adults: 1, children: 0, infants: 0, contactName: '', contactPhone: '', note: '', clientId: '' });
  }

  async function sendRequest() {
    if (!sel) return;
    setSending(true);
    try {
      await marketplaceApi.createRequest(sel.id, {
        adults: Number(req.adults) || 1,
        children: Number(req.children) || 0,
        infants: Number(req.infants) || 0,
        contactName: req.contactName || undefined,
        contactPhone: req.contactPhone || undefined,
        note: req.note || undefined,
        clientId: req.clientId || undefined,
      });
      toast.success(tr('mp.requestSent'));
      setSel(null);
      router.push('/marketplace/requests');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setSending(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🧳 {tr('mp.title')}</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{total} {tr('mpo.tours')}</div>
        </div>

        {/* ── Filtrlar ── */}
        <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <input style={{ ...inp, gridColumn: 'span 2' }} placeholder={tr('mp.searchPlaceholder')}
              value={f.search} onChange={e => setF((s: any) => ({ ...s, search: e.target.value }))} />

            <select style={inp} value={f.country} onChange={e => setF((s: any) => ({ ...s, country: e.target.value }))}>
              <option value="">{tr('mp.allCountries')}</option>
              {(filters.countries || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select style={inp} value={f.operatorId} onChange={e => setF((s: any) => ({ ...s, operatorId: e.target.value }))}>
              <option value="">{tr('mp.allOperators')}</option>
              {(filters.operators || []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>

            <input style={inp} type="number" placeholder={tr('mp.priceFrom')}
              value={f.priceMin} onChange={e => setF((s: any) => ({ ...s, priceMin: e.target.value }))} />
            <input style={inp} type="number" placeholder={tr('mp.priceTo')}
              value={f.priceMax} onChange={e => setF((s: any) => ({ ...s, priceMax: e.target.value }))} />

            <input style={inp} type="date" title={tr('mp.dateFrom')}
              value={f.dateFrom} onChange={e => setF((s: any) => ({ ...s, dateFrom: e.target.value }))} />
            <input style={inp} type="date" title={tr('mp.dateTo')}
              value={f.dateTo} onChange={e => setF((s: any) => ({ ...s, dateTo: e.target.value }))} />

            <select style={inp} value={f.sort} onChange={e => setF((s: any) => ({ ...s, sort: e.target.value }))}>
              <option value="">{tr('mp.sortNew')}</option>
              <option value="price_asc">{tr('mp.sortPriceAsc')}</option>
              <option value="price_desc">{tr('mp.sortPriceDesc')}</option>
              <option value="date_asc">{tr('mp.sortDate')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer', color: 'var(--fg-2)' }}>
              <input type="checkbox" checked={f.onlyAvailable}
                onChange={e => setF((s: any) => ({ ...s, onlyAvailable: e.target.checked }))} />
              {tr('mp.onlyAvailable')}
            </label>
            <button style={btnGhost} onClick={() => setF({
              search: '', country: '', operatorId: '', priceMin: '', priceMax: '',
              dateFrom: '', dateTo: '', onlyAvailable: false, sort: '',
            })}>{tr('mp.reset')}</button>
          </div>
        </div>

        {/* ── Turlar ro'yxati ── */}
        {loading ? (
          <div style={{ color: 'var(--fg-3)', padding: 40, textAlign: 'center' }}>{tr('common.loading')}</div>
        ) : tours.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            {tr('mp.empty')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {tours.map((t: any) => {
              const img = Array.isArray(t.images) && t.images.length ? t.images[0] : null;
              const noSeats = t.seatsAvailable !== null && t.seatsAvailable !== undefined && t.seatsAvailable <= 0;
              return (
                <div key={t.id} style={{
                  background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                }}>
                  {img && (
                    <div style={{ height: 140, background: `center/cover no-repeat url(${img})`, borderBottom: '1px solid var(--border)' }} />
                  )}
                  <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>
                        📍 {t.destination}{t.country ? `, ${t.country}` : ''}
                      </div>
                    </div>

                    {t.operator && (
                      <div style={{ fontSize: 11, color: '#3d7eff', fontWeight: 600 }}>{t.operator.name}</div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--fg-2)' }}>
                      {t.departureDate && <span>🗓 {fdate(t.departureDate)}</span>}
                      {t.duration ? <span>⏱ {t.duration} {tr('mp.days')}</span> : null}
                      {t.hotelStars ? <span>{'⭐'.repeat(Math.min(5, t.hotelStars))}</span> : null}
                      {t.mealPlan ? <span>🍽 {t.mealPlan}</span> : null}
                    </div>

                    {t.hotelName && (
                      <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>🏨 {t.hotelName}</div>
                    )}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {t.includesVisa && <Tag>Viza</Tag>}
                      {t.includesFlights && <Tag>Aviabilet</Tag>}
                      {t.includesHotel && <Tag>Mehmonxona</Tag>}
                      {t.includesTransfer && <Tag>Transfer</Tag>}
                      {t.includesInsurance && <Tag>Sug'urta</Tag>}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{money(t.price, t.currency)}</div>
                        {t.seatsAvailable !== null && t.seatsAvailable !== undefined && (
                          <div style={{ fontSize: 11, color: noSeats ? '#ef4444' : 'var(--fg-3)' }}>
                            {t.seatsAvailable} {tr('mp.seats')}
                          </div>
                        )}
                      </div>
                      <button
                        disabled={noSeats}
                        onClick={() => openBooking(t)}
                        style={{
                          ...btnPrimary,
                          background: noSeats ? 'var(--bg-4)' : '#3d7eff',
                          color: noSeats ? 'var(--fg-3)' : 'white',
                          cursor: noSeats ? 'not-allowed' : 'pointer',
                        }}>
                        {tr('mp.book')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Sahifalash ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, alignItems: 'center' }}>
            <button style={btnGhost} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
            <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{page} / {totalPages}</span>
            <button style={btnGhost} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>

      {/* ── Bron so'rovi modali ── */}
      {sel && (
        <div onClick={() => !sending && setSel(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{tr('mp.requestTitle')}</h2>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 4 }}>{sel.title}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>
              {sel.operator?.name} · {money(sel.price, sel.currency)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label={tr('mp.adults')}>
                <input style={inp} type="number" min={1} value={req.adults}
                  onChange={e => setReq((s: any) => ({ ...s, adults: e.target.value }))} />
              </Field>
              <Field label={tr('mp.children')}>
                <input style={inp} type="number" min={0} value={req.children}
                  onChange={e => setReq((s: any) => ({ ...s, children: e.target.value }))} />
              </Field>
              <Field label={tr('mp.infants')}>
                <input style={inp} type="number" min={0} value={req.infants}
                  onChange={e => setReq((s: any) => ({ ...s, infants: e.target.value }))} />
              </Field>
            </div>

            <Field label={tr('mp.client')}>
              <select style={{ ...inp, marginBottom: 10 }} value={req.clientId}
                onChange={e => setReq((s: any) => ({ ...s, clientId: e.target.value }))}>
                <option value="">—</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.fullName || c.name}</option>)}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label={tr('mp.contactName')}>
                <input style={inp} value={req.contactName}
                  onChange={e => setReq((s: any) => ({ ...s, contactName: e.target.value }))} />
              </Field>
              <Field label={tr('common.phone')}>
                <input style={inp} value={req.contactPhone}
                  onChange={e => setReq((s: any) => ({ ...s, contactPhone: e.target.value }))} />
              </Field>
            </div>

            <Field label={tr('mp.note')}>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical', marginBottom: 14 }}
                value={req.note} onChange={e => setReq((s: any) => ({ ...s, note: e.target.value }))} />
            </Field>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={sending} onClick={() => setSel(null)}>{tr('common.cancel')}</button>
              <button style={{ ...btnPrimary, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={sendRequest}>
                {sending ? tr('common.loading') : tr('mp.sendRequest')}
              </button>
            </div>
          </div>
        </div>
      )}
    </CrmLayout>
  );
}

function Tag({ children }: { children: any }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 6,
      background: 'var(--bg-4)', color: 'var(--fg-2)', fontWeight: 600,
    }}>{children}</span>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}