'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { marketplaceApi, clientsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

/**
 * TURLAR BOZORI — agentlar ko'radigan asosiy sahifa.
 *
 * Turlar SHU KOMPANIYA (tenant) qo'shgan operatorlarnikidir.
 * Turni bosish → to'liq ma'lumot ochiladi → o'sha yerdan BOOKING qilinadi.
 * Oraliq "so'rov" bosqichi yo'q — booking darhol yaratiladi.
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
  const { user } = useAuth();
  const router = useRouter();

  // Netto narx va foydani faqat rahbariyat ko'radi — agentga ko'rsatilmaydi
  const canSeeCost = ['TENANT_ADMIN', 'MANAGER', 'PLATFORM_OWNER'].includes(user?.role || '');

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

  // Tanlangan tur (to'liq ma'lumot + booking formasi)
  const [sel, setSel] = useState<any>(null);
  const [form, setForm] = useState<any>({
    adults: 1, children: 0, infants: 0, clientId: '', note: '',
  });
  const [clients, setClients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Booking oynasi ichida yangi mijoz yaratish — agent Mijozlar
  // bo'limiga o'tib qaytmasligi uchun
  const [newClient, setNewClient] = useState<any>(null); // null = yopiq
  const [creatingClient, setCreatingClient] = useState(false);

  // Rasm galereyasi (tanlangan rasm indeksi)
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    marketplaceApi.getFilters().then(r => setFilters(r.data || {})).catch(() => {});
    clientsApi.list({ limit: 300 })
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
      .then(r => { setTours(r.data?.data || []); setTotal(r.data?.meta?.total || 0); })
      .catch(() => toast.error(tr('common.error')))
      .finally(() => setLoading(false));
  }, [f, page]);

  useEffect(() => { setPage(1); }, [f]);
  useEffect(() => { load(); }, [load]);

  function openTour(t: any) {
    setSel(t);
    setImgIdx(0);
    setNewClient(null);
    setForm({ adults: 1, children: 0, infants: 0, clientId: '', note: '' });
  }

  /** Booking oynasidan chiqmasdan yangi mijoz yaratadi va uni tanlaydi */
  async function createClientInline() {
    const name = String(newClient?.fullName || '').trim();
    if (!name) { toast.error(tr('mp.clientNameRequired')); return; }
    setCreatingClient(true);
    try {
      const r = await clientsApi.create({
        fullName: name,
        phone: newClient?.phone?.trim() || undefined,
        source: 'MANUAL',
      });
      const created = r.data?.data || r.data;
      if (!created?.id) throw new Error('id yo\'q');
      // Ro'yxatga qo'shamiz va darhol tanlaymiz
      setClients((prev) => [created, ...prev]);
      setForm((f: any) => ({ ...f, clientId: created.id }));
      setNewClient(null);
      toast.success(tr('mp.clientCreated'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setCreatingClient(false);
    }
  }

  // Jami narx: 1 kishilik narx × (kattalar + bolalar)
  const pax = Math.max(1, (Number(form.adults) || 0) + (Number(form.children) || 0));
  const totalPrice = sel ? Number(sel.price) * pax : 0;

  async function createBooking() {
    if (!sel) return;
    if (!form.clientId) { toast.error(tr('mp.clientRequired')); return; }
    setSaving(true);
    try {
      const r = await marketplaceApi.bookTour(sel.id, {
        clientId: form.clientId,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        note: form.note || undefined,
      });
      toast.success(tr('mp.booked'));
      setSel(null);
      const bid = r.data?.booking?.id;
      if (bid) router.push(`/bookings/${bid}`);
      else { load(); router.push('/bookings'); }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setSaving(false);
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

            <input style={inp} type="date" value={f.dateFrom}
              onChange={e => setF((s: any) => ({ ...s, dateFrom: e.target.value }))} />
            <input style={inp} type="date" value={f.dateTo}
              onChange={e => setF((s: any) => ({ ...s, dateTo: e.target.value }))} />

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

        {/* ── Turlar ── */}
        {loading ? (
          <div style={{ color: 'var(--fg-3)', padding: 40, textAlign: 'center' }}>{tr('common.loading')}</div>
        ) : tours.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--fg-2)', fontWeight: 600, marginBottom: 6 }}>{tr('mp.empty')}</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 14 }}>
              {canSeeCost
                ? "Sozlamalar → Tur operatorlar bo'limidan operatorga ulaning"
                : "Administrator hali tur operatorga ulanmagan"}
            </div>
            {/* Operatorlar endi Sozlamalar ichida (faqat admin ko'radi) */}
            {canSeeCost && (
              <button style={btnPrimary} onClick={() => router.push('/settings?tab=operators')}>
                Tur operatorlarni ulash
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {tours.map((t: any) => {
              const img = Array.isArray(t.images) && t.images.length ? t.images[0] : null;
              const noSeats = t.seatsAvailable !== null && t.seatsAvailable !== undefined && t.seatsAvailable <= 0;
              return (
                <div key={t.id} onClick={() => !noSeats && openTour(t)} style={{
                  background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  cursor: noSeats ? 'not-allowed' : 'pointer', opacity: noSeats ? 0.6 : 1,
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

                    {t.hotelName && <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>🏨 {t.hotelName}</div>}

                    <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{money(t.price, t.currency)}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{tr('mp.pricePerPerson')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {noSeats ? (
                          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{tr('mp.noSeats')}</span>
                        ) : (
                          <>
                            {t.seatsAvailable !== null && t.seatsAvailable !== undefined && (
                              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>
                                {t.seatsAvailable} {tr('mp.seats')}
                              </div>
                            )}
                            <span style={{ fontSize: 12, color: '#3d7eff', fontWeight: 700 }}>{tr('mp.details')} →</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, alignItems: 'center' }}>
            <button style={btnGhost} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
            <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{page} / {totalPages}</span>
            <button style={btnGhost} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>

      {/* ── Tur tafsiloti + booking ── */}
      {sel && (
        <div onClick={() => !saving && setSel(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto',
          }}>
            {Array.isArray(sel.images) && sel.images.length > 0 && (
              <div style={{ position: 'relative' }}>
                <div style={{
                  height: 220,
                  background: `center/cover no-repeat url(${sel.images[Math.min(imgIdx, sel.images.length - 1)]})`,
                  borderRadius: '14px 14px 0 0',
                }} />

                {sel.images.length > 1 && (
                  <>
                    {/* Chap/o'ng tugmalar */}
                    <button
                      type="button"
                      onClick={() => setImgIdx(i => (i - 1 + sel.images.length) % sel.images.length)}
                      style={galBtn('left')}
                      aria-label="Oldingi rasm"
                    >‹</button>
                    <button
                      type="button"
                      onClick={() => setImgIdx(i => (i + 1) % sel.images.length)}
                      style={galBtn('right')}
                      aria-label="Keyingi rasm"
                    >›</button>

                    {/* Nuqtalar */}
                    <div style={{
                      position: 'absolute', bottom: 10, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center', gap: 6,
                    }}>
                      {sel.images.map((_: any, i: number) => (
                        <span
                          key={i}
                          onClick={() => setImgIdx(i)}
                          style={{
                            width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                            background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.45)',
                          }}
                        />
                      ))}
                    </div>

                    {/* Hisoblagich */}
                    <div style={{
                      position: 'absolute', top: 10, right: 12,
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    }}>
                      {Math.min(imgIdx, sel.images.length - 1) + 1} / {sel.images.length}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{sel.title}</h2>
                <button onClick={() => setSel(null)} style={{
                  background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 20,
                  cursor: 'pointer', lineHeight: 1,
                }}>×</button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
                📍 {sel.destination}{sel.country ? `, ${sel.country}` : ''}
                {sel.operator ? ` · ${sel.operator.name}` : ''}
              </div>

              {/* Ma'lumotlar jadvali */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
                padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14,
              }}>
                <Info label={tr('mp.departure')} value={fdate(sel.departureDate)} />
                <Info label={tr('mp.return')} value={fdate(sel.returnDate)} />
                <Info label={tr('mp.duration')} value={sel.duration ? `${sel.duration} ${tr('mp.days')}` : '—'} />
                <Info label={tr('mp.hotel')} value={sel.hotelName ? `${sel.hotelName}${sel.hotelStars ? ` ${'⭐'.repeat(Math.min(5, sel.hotelStars))}` : ''}` : '—'} />
                <Info label={tr('mp.meal')} value={sel.mealPlan || '—'} />
                <Info label={tr('mp.seats')} value={
                  sel.seatsAvailable !== null && sel.seatsAvailable !== undefined
                    ? `${sel.seatsAvailable}${sel.seatsTotal ? ` / ${sel.seatsTotal}` : ''}` : '—'
                } />
              </div>

              {/* Narxga nima kiradi */}
              {(sel.includesVisa || sel.includesFlights || sel.includesHotel ||
                sel.includesMeals || sel.includesTransfer || sel.includesInsurance) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 6 }}>
                    {tr('mp.includes')}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sel.includesVisa && <Tag>✓ Viza</Tag>}
                    {sel.includesFlights && <Tag>✓ Aviabilet</Tag>}
                    {sel.includesHotel && <Tag>✓ Mehmonxona</Tag>}
                    {sel.includesMeals && <Tag>✓ Ovqat</Tag>}
                    {sel.includesTransfer && <Tag>✓ Transfer</Tag>}
                    {sel.includesInsurance && <Tag>✓ Sug'urta</Tag>}
                  </div>
                </div>
              )}

              {sel.description && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 5 }}>
                    {tr('mp.tourInfo')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {sel.description}
                  </div>
                </div>
              )}

              {/* Operator aloqasi */}
              {sel.operator && (sel.operator.contactPhone || sel.operator.contactEmail) && (
                <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 16 }}>
                  <b>{tr('mp.operator')}:</b> {sel.operator.name}
                  {sel.operator.contactPhone ? ` · 📞 ${sel.operator.contactPhone}` : ''}
                  {sel.operator.contactEmail ? ` · ✉ ${sel.operator.contactEmail}` : ''}
                </div>
              )}

              {/* ── BOOKING FORMASI ── */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{tr('mp.book')}</div>

                <div style={{ marginBottom: 10 }}>
                  <L>{tr('mp.chooseClient')} *</L>

                  {newClient === null ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select style={{ ...inp, flex: 1 }} value={form.clientId}
                        onChange={e => setForm((s: any) => ({ ...s, clientId: e.target.value }))}>
                        <option value="">—</option>
                        {clients.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName || c.name}{c.phone ? ` (${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setNewClient({ fullName: '', phone: '' })}
                        style={{ ...btnGhost, whiteSpace: 'nowrap' }}
                        title={tr('mp.newClient')}
                      >
                        + {tr('mp.newClient')}
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      padding: 12, background: 'var(--bg-3)', borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                        {tr('mp.newClient')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <input
                          style={inp}
                          autoFocus
                          placeholder={tr('common.name') + ' *'}
                          value={newClient.fullName}
                          onChange={e => setNewClient((c: any) => ({ ...c, fullName: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') createClientInline(); }}
                        />
                        <input
                          style={inp}
                          placeholder="+998..."
                          value={newClient.phone}
                          onChange={e => setNewClient((c: any) => ({ ...c, phone: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') createClientInline(); }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" style={btnGhost} disabled={creatingClient}
                          onClick={() => setNewClient(null)}>
                          {tr('common.cancel')}
                        </button>
                        <button type="button" style={{ ...btnPrimary, opacity: creatingClient ? 0.6 : 1 }}
                          disabled={creatingClient} onClick={createClientInline}>
                          {creatingClient ? tr('common.loading') : tr('common.save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <L>{tr('mp.adults')}</L>
                    <input style={inp} type="number" min={1} value={form.adults}
                      onChange={e => setForm((s: any) => ({ ...s, adults: e.target.value }))} />
                  </div>
                  <div>
                    <L>{tr('mp.children')}</L>
                    <input style={inp} type="number" min={0} value={form.children}
                      onChange={e => setForm((s: any) => ({ ...s, children: e.target.value }))} />
                  </div>
                  <div>
                    <L>{tr('mp.infants')}</L>
                    <input style={inp} type="number" min={0} value={form.infants}
                      onChange={e => setForm((s: any) => ({ ...s, infants: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <L>{tr('mp.note')}</L>
                  <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.note}
                    onChange={e => setForm((s: any) => ({ ...s, note: e.target.value }))} />
                </div>

                <div style={{
                  padding: 12, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
                      {tr('mp.totalPrice')} ({pax} × {money(sel.price, sel.currency)})
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                      {money(totalPrice, sel.currency)}
                    </span>
                  </div>

                  {canSeeCost && (
                    sel.netPrice != null ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-3)' }}>
                          <span>{tr('mp.netPrice')} ({pax} × {money(sel.netPrice, sel.currency)})</span>
                          <span>− {money(Number(sel.netPrice) * pax, sel.currency)}</span>
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', fontSize: 13,
                          fontWeight: 700, color: '#10b981', borderTop: '1px solid var(--border)', paddingTop: 6,
                        }}>
                          <span>{tr('mp.profit')}</span>
                          <span>{money(Math.max(0, totalPrice - Number(sel.netPrice) * pax), sel.currency)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠ {tr('mp.noNetPrice')}</div>
                    )
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={btnGhost} disabled={saving} onClick={() => setSel(null)}>
                    {tr('common.cancel')}
                  </button>
                  <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}
                    onClick={createBooking}>
                    {saving ? tr('common.loading') : tr('mp.confirmBooking')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CrmLayout>
  );
}

/** Galereya o'q tugmasi uslubi */
function galBtn(side: 'left' | 'right'): any {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 8,
    width: 30, height: 30, borderRadius: '50%', border: 'none',
    background: 'rgba(0,0,0,0.5)', color: '#fff',
    fontSize: 20, lineHeight: '28px', cursor: 'pointer',
  };
}

function Tag({ children }: { children: any }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 9px', borderRadius: 6,
      background: '#10b98122', color: '#10b981', fontWeight: 600,
    }}>{children}</span>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg)' }}>{value}</div>
    </div>
  );
}

function L({ children }: { children: any }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>{children}</div>
  );
}