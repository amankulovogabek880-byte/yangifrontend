'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { tourSearchApi, clientsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import toast from 'react-hot-toast';

/**
 * ═══════════════════════════════════════════════════════════════
 * JONLI TUR QIDIRUVI — v14 (YANGI SAHIFA)
 * ═══════════════════════════════════════════════════════════════
 *
 * NEGA QO'SHILDI:
 *   Backendda `/tour-search/*` endpointlari allaqachon bor edi va
 *   ishlardi. Lekin frontendda ular uchun na sahifa, na havola, na
 *   API funksiyasi bor edi.
 *
 *   Natijada: operatorga ulangan foydalanuvchi "Tur qidirish bo'limida
 *   qidiring" degan xabarni olardi — bunday bo'lim esa MAVJUD EMASDI.
 *   Ya'ni yagona ishlaydigan integratsiya foydalanuvchi uchun butunlay
 *   yopiq edi.
 *
 * BU SAHIFA NIMA QILADI:
 *   1. Yo'nalishni autocomplete orqali ANIQ tanlatadi
 *   2. Ulangan barcha operatorlarda PARALLEL qidiradi
 *   3. Natijadan to'g'ridan-to'g'ri CRM bookingi yaratadi
 *
 * MUHIM: natijalar vaqtinchalik (Ratehawk'da narx identifikatori
 * ~38 daqiqa amal qiladi). Shuning uchun sahifada hech narsa
 * keshlanmaydi va "eskirdi" ogohlantirishi ko'rsatiladi.
 */

const inp: any = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
  boxSizing: 'border-box',
};
const btnPrimary: any = {
  padding: '10px 18px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
};
const card: any = {
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
};
const lbl: any = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 5,
};

const CUR: Record<string, string> = { USD: '$', EUR: '€', RUB: '₽', UZS: "so'm" };
function money(v: any, c: string) {
  const n = Number(v) || 0;
  const s = n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return c === 'UZS' ? `${s} so'm` : `${CUR[c] || ''}${s}`;
}

/** Bugundan boshlab N kun keyingi sana (YYYY-MM-DD) */
function dayFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function TourSearchPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Netto narx va foydani faqat rahbariyat ko'radi
  const canSeeCost = ['TENANT_ADMIN', 'MANAGER', 'PLATFORM_OWNER'].includes(user?.role || '');

  const [operators, setOperators] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [form, setForm] = useState({
    destination: '',
    regionId: '' as string | number,
    checkin: dayFromNow(14),
    checkout: dayFromNow(21),
    adults: 2,
    children: 0,
    currency: 'USD',
  });

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [searchedAt, setSearchedAt] = useState<Date | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Booking oynasi
  const [booking, setBooking] = useState<any>(null);
  const [bookForm, setBookForm] = useState<any>({ clientId: '', note: '', totalPrice: '', supplierCost: '' });
  const [booksaving, setBookSaving] = useState(false);

  // ── Boshlang'ich yuklash ──
  useEffect(() => {
    tourSearchApi.operators()
      .then(r => setOperators(r.data?.data || []))
      .catch(() => setOperators([]));
    clientsApi.list({ limit: 300 })
      .then(r => setClients(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, []);

  const connected = operators.filter(o => o.connected);

  // ── Yo'nalish autocomplete ──
  const onDestinationChange = (value: string) => {
    setForm(f => ({ ...f, destination: value, regionId: '' }));
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) { setSuggestions([]); return; }

    suggestTimer.current = setTimeout(() => {
      tourSearchApi.suggest(value.trim())
        .then(r => { setSuggestions(r.data?.data || []); setShowSuggest(true); })
        .catch(() => setSuggestions([]));
    }, 350);
  };

  const pickSuggestion = (s: any) => {
    setForm(f => ({ ...f, destination: s.fullName || s.name, regionId: s.id }));
    setShowSuggest(false);
    setSuggestions([]);
  };

  // ── Qidiruv ──
  const doSearch = useCallback(async () => {
    if (!form.destination.trim()) { toast.error("Yo'nalishni kiriting"); return; }
    if (!form.checkin || !form.checkout) { toast.error('Sanalarni tanlang'); return; }
    if (new Date(form.checkout) <= new Date(form.checkin)) {
      toast.error("Chiqish sanasi kirish sanasidan keyin bo'lishi kerak");
      return;
    }
    if (connected.length === 0) {
      toast.error("Avval Sozlamalar → Tur operatorlar bo'limida operatorga ulaning");
      return;
    }

    setLoading(true);
    setShowSuggest(false);
    try {
      const r = await tourSearchApi.search({
        destination: form.destination.trim(),
        regionId: form.regionId || undefined,
        checkin: form.checkin,
        checkout: form.checkout,
        adults: Number(form.adults) || 2,
        childrenAges: Number(form.children) > 0
          ? Array.from({ length: Number(form.children) }, () => 8)
          : [],
        currency: form.currency,
      });
      setResults(r.data?.data || []);
      setErrors(r.data?.errors || []);
      setSearchedAt(new Date());
      setHasSearched(true);

      if ((r.data?.data || []).length === 0 && (r.data?.errors || []).length === 0) {
        toast('Bu sana va yo\'nalish bo\'yicha variant topilmadi', { icon: 'ℹ️' });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Qidiruvda xatolik");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [form, connected.length]);

  // ── Booking ──
  const openBooking = (r: any) => {
    setBooking(r);
    setBookForm({ clientId: '', note: '', totalPrice: '', supplierCost: '' });
  };

  const submitBooking = async () => {
    if (!bookForm.clientId) { toast.error('Mijozni tanlang'); return; }
    setBookSaving(true);
    try {
      const res = await tourSearchApi.book({
        clientId: bookForm.clientId,
        result: booking,
        checkin: form.checkin,
        checkout: form.checkout,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        totalPrice: bookForm.totalPrice || undefined,
        supplierCost: bookForm.supplierCost || undefined,
        note: bookForm.note || undefined,
      });
      const b = res.data?.booking;
      toast.success(res.data?.message || 'Booking yaratildi');
      if (res.data?.warning) toast(res.data.warning, { icon: '⚠️', duration: 8000 });
      setBooking(null);
      if (b?.id) router.push(`/bookings/${b.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Booking yaratilmadi');
    } finally {
      setBookSaving(false);
    }
  };

  // Natijalar eskirganini bildiramiz (narx identifikatori qisqa muddatli)
  const stale = searchedAt ? (Date.now() - searchedAt.getTime()) > 25 * 60 * 1000 : false;

  return (
    <CrmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>

        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tur qidirish</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-3)' }}>
            Ulangan operatorlarda jonli qidiruv — narx va bo'sh joy shu onda so'raladi.
          </p>
        </div>

        {/* ── Operator ulanmagan bo'lsa ── */}
        {operators.length > 0 && connected.length === 0 && (
          <div style={{
            ...card,
            border: '1px solid #f59e0b',
            background: 'rgba(245,158,11,0.08)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              Hech qanday operatorga ulanmagansiz
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Jonli qidiruv ishlashi uchun kamida bitta operatorga ulanish kerak.
              Ulanish uchun operatorning B2B kabinetidagi kirish ma'lumotlari talab qilinadi.
            </p>
            <button style={btnPrimary} onClick={() => router.push('/settings?tab=operators')}>
              Sozlamalar → Tur operatorlar
            </button>
          </div>
        )}

        {/* ── Qidiruv formasi ── */}
        <div style={card}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}>
            <div style={{ position: 'relative', gridColumn: 'span 2', minWidth: 200 }}>
              <label style={lbl}>Yo'nalish</label>
              <input
                style={inp}
                value={form.destination}
                placeholder="Antalya, Dubay, Sharm el-Sheyx..."
                onChange={e => onDestinationChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                onKeyDown={e => { if (e.key === 'Enter') { setShowSuggest(false); doSearch(); } }}
              />
              {/* Aniq tanlangani ko'rinib tursin — noto'g'ri shahar tanlanishining oldini oladi */}
              {form.regionId ? (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
                  ✓ Yo'nalish aniqlandi
                </div>
              ) : form.destination.length >= 2 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                  Ro'yxatdan tanlang — aniqroq natija beradi
                </div>
              ) : null}

              {showSuggest && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                }}>
                  {suggestions.map((s, i) => (
                    <div
                      key={`${s.operatorSlug}-${s.id}-${i}`}
                      onClick={() => pickSuggestion(s)}
                      style={{
                        padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                        borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {s.fullName || s.name}
                      {s.type && (
                        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 6 }}>
                          {s.type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>Kirish</label>
              <input type="date" style={inp} value={form.checkin}
                onChange={e => setForm(f => ({ ...f, checkin: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Chiqish</label>
              <input type="date" style={inp} value={form.checkout}
                onChange={e => setForm(f => ({ ...f, checkout: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Kattalar</label>
              <input type="number" min={1} max={6} style={inp} value={form.adults}
                onChange={e => setForm(f => ({ ...f, adults: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={lbl}>Bolalar</label>
              <input type="number" min={0} max={4} style={inp} value={form.children}
                onChange={e => setForm(f => ({ ...f, children: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={lbl}>Valyuta</label>
              <select style={inp} value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
            <div>
              <button style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}
                disabled={loading} onClick={doSearch}>
                {loading ? 'Qidirilmoqda...' : 'Qidirish'}
              </button>
            </div>
          </div>

          {connected.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--fg-3)' }}>
              Qidiriladi: {connected.map(o => o.name).join(', ')}
            </div>
          )}
        </div>

        {/* ── Operator xatolari ── */}
        {errors.length > 0 && (
          <div style={{ ...card, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Ba'zi operatorlardan javob kelmadi
            </div>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 4 }}>
                <b>{e.name}:</b> {e.message}
              </div>
            ))}
          </div>
        )}

        {/* ── Natijalar eskirgan bo'lsa ── */}
        {stale && results.length > 0 && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
            background: 'rgba(245,158,11,0.12)', color: '#b45309',
          }}>
            Natijalar 25 daqiqadan oshdi — narx va bo'sh joy o'zgargan bo'lishi mumkin.
            Bron qilishdan oldin qaytadan qidiring.
          </div>
        )}

        {/* ── Natijalar ── */}
        {results.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
            {results.length} ta variant topildi
            {searchedAt && ` • ${searchedAt.toLocaleTimeString('ru-RU').slice(0, 5)}`}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {results.map((r, i) => (
            <div key={`${r.operatorSlug}-${r.externalId}-${i}`} style={{
              ...card,
              display: 'flex', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {r.title}
                  {r.hotelStars ? (
                    <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 13 }}>
                      {'★'.repeat(Math.min(5, r.hotelStars))}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.7 }}>
                  {r.roomName && <>{r.roomName}<br /></>}
                  {r.mealPlan && <>Ovqatlanish: <b>{r.mealPlan}</b> • </>}
                  Operator: <b>{r.operatorName}</b>
                </div>
                {r.cancellationPolicy && (
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 4 }}>
                    {r.cancellationPolicy}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#3d7eff' }}>
                  {money(r.price, r.currency)}
                </div>
                {/* Netto va foyda — faqat rahbariyat ko'radi */}
                {canSeeCost && (
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>
                    {r.netPrice != null
                      ? <>Netto: {money(r.netPrice, r.currency)} • Foyda: {money(r.price - r.netPrice, r.currency)}</>
                      : <span style={{ color: '#b45309' }}>Netto noma'lum — foyda hisoblanmaydi</span>}
                  </div>
                )}
                <button style={{ ...btnPrimary, marginTop: 10 }} onClick={() => openBooking(r)}>
                  Booking qilish
                </button>
              </div>
            </div>
          ))}
        </div>

        {hasSearched && !loading && results.length === 0 && errors.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
            Variant topilmadi. Sanani yoki yo'nalishni o'zgartirib ko'ring.
          </div>
        )}
      </div>

      {/* ── Booking oynasi ── */}
      {booking && (
        <div
          onClick={() => !booksaving && setBooking(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            ...card, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Booking yaratish</h3>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 16 }}>
              {booking.title} • {money(booking.price, booking.currency)} / kishi
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Mijoz *</label>
              <select style={inp} value={bookForm.clientId}
                onChange={e => setBookForm((f: any) => ({ ...f, clientId: e.target.value }))}>
                <option value="">— Mijozni tanlang —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}{c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {canSeeCost && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Sotuv narxi ({booking.currency})</label>
                  <input style={inp} type="number" placeholder="avtomatik"
                    value={bookForm.totalPrice}
                    onChange={e => setBookForm((f: any) => ({ ...f, totalPrice: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Tannarx / netto</label>
                  <input style={inp} type="number" placeholder="avtomatik"
                    value={bookForm.supplierCost}
                    onChange={e => setBookForm((f: any) => ({ ...f, supplierCost: e.target.value }))} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Izoh</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }}
                value={bookForm.note}
                onChange={e => setBookForm((f: any) => ({ ...f, note: e.target.value }))} />
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
              background: 'var(--bg-3)', color: 'var(--fg-2)', marginBottom: 16,
            }}>
              Booking CRM'da <b>Qoralama</b> holatida yaratiladi. Joyni operator
              kabinetida tasdiqlab, keyin bu yerda holatni o'zgartiring.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={booksaving} onClick={() => setBooking(null)}>
                Bekor qilish
              </button>
              <button style={{ ...btnPrimary, opacity: booksaving ? 0.6 : 1 }}
                disabled={booksaving} onClick={submitBooking}>
                {booksaving ? 'Yaratilmoqda...' : 'Booking yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CrmLayout>
  );
}