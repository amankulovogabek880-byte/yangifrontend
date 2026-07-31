'use client';
import { useEffect, useState } from 'react';
import { bookingsApi, api } from '@/services/api';
import { useAuth } from '@/lib/store';
import { Btn, Badge, Label, Input, Select, Modal, Textarea } from '@/components/ui';
import { errMsg, BOOKING_STATUS_LABELS } from '@/lib/helpers';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════
// Booking'ni to'liq tahrirlash modali — bir necha joydan qayta
// ishlatiladi (booking detail sahifasi va klient 360 sahifasi),
// shuning uchun umumiy komponent sifatida ajratilgan.
// ═══════════════════════════════════════════════════════════

const EDIT_TABS = [
  { id: 'main',      label: '📋 Asosiy' },
  { id: 'price',     label: '💰 Narx' },
  { id: 'hotel',     label: '🏨 Mehmonxona' },
  { id: 'flight',    label: '✈️ Aviachipta' },
  { id: 'taxi',      label: '🚖 Taksi' },
  { id: 'insurance', label: '🛡️ Sug\'urta' },
  { id: 'visa',      label: '🛂 Viza' },
  { id: 'notes',     label: '📝 Izohlar' },
];

export function toDateInput(d: any) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
}
export function toDateTimeInput(d: any) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 16); } catch { return ''; }
}

export function EditBookingModal({ booking, onClose, onSaved }: any) {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';
  const [edTab, setEdTab] = useState('main');
  const [form, setForm] = useState<any>({
    // Asosiy
    tourName: booking.tourName || '',
    destination: booking.destination || '',
    country: booking.country || '',
    tourType: booking.tourType || 'PACKAGE',
    status: booking.status || 'DRAFT',
    description: booking.description || '',
    departureDate: toDateInput(booking.departureDate),
    returnDate: toDateInput(booking.returnDate),
    duration: booking.duration ?? '',
    adults: booking.adults ?? 1,
    children: booking.children ?? 0,
    infants: booking.infants ?? 0,
    includesVisa: !!booking.includesVisa,
    includesFlights: !!booking.includesFlights,
    includesHotel: !!booking.includesHotel,
    includesMeals: !!booking.includesMeals,
    includesTransfer: !!booking.includesTransfer,
    includesInsurance: !!booking.includesInsurance,
    // Narx
    totalPrice: booking.totalPrice ?? '',
    currency: booking.currency || 'USD',
    supplierCost: booking.supplierCost ?? '',
    discount: booking.discount ?? '',
    // Mehmonxona
    hotelName: booking.hotelName || '',
    hotelCity: booking.hotelCity || '',
    hotelStars: booking.hotelStars ?? '',
    hotelCheckIn: toDateInput(booking.hotelCheckIn),
    hotelCheckOut: toDateInput(booking.hotelCheckOut),
    hotelAddress: booking.hotelAddress || '',
    mealPlan: booking.mealPlan || '',
    roomType: booking.roomType || '',
    // Aviachipta (borish)
    airline: booking.airline || '',
    flightNumber: booking.flightNumber || '',
    departureAirport: booking.departureAirport || '',
    arrivalAirport: booking.arrivalAirport || '',
    departureTime: toDateTimeInput(booking.departureTime),
    arrivalTime: toDateTimeInput(booking.arrivalTime),
    flightClass: booking.flightClass || '',
    pnr: booking.pnr || '',
    // Aviachipta (qaytish)
    returnAirline: booking.returnAirline || '',
    returnFlightNumber: booking.returnFlightNumber || '',
    returnDepartureTime: toDateTimeInput(booking.returnDepartureTime),
    returnArrivalTime: toDateTimeInput(booking.returnArrivalTime),
    returnPnr: booking.returnPnr || '',
    // Taksi
    taxiPickupAddress: booking.taxiPickupAddress || '',
    taxiDropoffAddress: booking.taxiDropoffAddress || '',
    taxiPickupTime: toDateTimeInput(booking.taxiPickupTime),
    taxiDriverName: booking.taxiDriverName || '',
    taxiDriverPhone: booking.taxiDriverPhone || '',
    taxiCompany: booking.taxiCompany || '',
    // Sug'urta
    insuranceCompany: booking.insuranceCompany || '',
    insurancePolicyNo: booking.insurancePolicyNo || '',
    insuranceStartDate: toDateInput(booking.insuranceStartDate),
    insuranceEndDate: toDateInput(booking.insuranceEndDate),
    insuranceCoverage: booking.insuranceCoverage || '',
    // Viza
    visaStatus: booking.visaStatus || '',
    visaType: booking.visaType || '',
    visaNumber: booking.visaNumber || '',
    visaIssueDate: toDateInput(booking.visaIssueDate),
    visaExpiryDate: toDateInput(booking.visaExpiryDate),
    // Supplier (admin only)
    supplierName: booking.supplierName || '',
    supplierContact: booking.supplierContact || '',
    supplierRef: booking.supplierRef || '',
    supplierPaid: booking.supplierPaid ?? '',
    supplierNotes: booking.supplierNotes || '',
    // Izohlar
    notes: booking.notes || '',
    internalNotes: booking.internalNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const totalPrice = Number(form.totalPrice) || 0;
  const supplierCost = Number(form.supplierCost) || 0;
  const discount = Number(form.discount) || 0;
  const previewProfit = Math.max(0, totalPrice - supplierCost - discount);

  // Valyuta USD bo'lmasa — CBU.uz kursini live tortib kelamiz (faqat
  // ko'rsatish/preview uchun; haqiqiy konvertatsiya backendda amalga oshiriladi)
  const [fxRate, setFxRate] = useState<number | null>(null);
  const isForeignCur = form.currency && form.currency !== 'USD';
  useEffect(() => {
    if (!isForeignCur) { setFxRate(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/exchange-rate/usd', { params: { currency: form.currency } });
        if (!cancelled) setFxRate(r.data?.rate || null);
      } catch { if (!cancelled) setFxRate(null); }
    })();
    return () => { cancelled = true; };
  }, [form.currency, isForeignCur]);
  const usdTotalPreview = isForeignCur && fxRate ? totalPrice / fxRate : null;
  const usdProfitPreview = isForeignCur && fxRate ? previewProfit / fxRate : null;

  async function save() {
    if (!form.tourName.trim() || !form.destination.trim()) {
      toast.error("Tur nomi va manzil to'ldirilishi shart");
      setEdTab('main');
      return;
    }
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      toast.error("Narx musbat son bo'lishi kerak");
      setEdTab('price');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        tourName: form.tourName.trim(),
        destination: form.destination.trim(),
        country: form.country || undefined,
        tourType: form.tourType,
        status: form.status,
        description: form.description || undefined,
        departureDate: form.departureDate || undefined,
        returnDate: form.returnDate || undefined,
        duration: form.duration === '' ? undefined : Number(form.duration),
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        includesVisa: form.includesVisa,
        includesFlights: form.includesFlights,
        includesHotel: form.includesHotel,
        includesMeals: form.includesMeals,
        includesTransfer: form.includesTransfer,
        includesInsurance: form.includesInsurance,

        totalPrice,
        currency: form.currency,
        supplierCost,
        discount,

        hotelName: form.hotelName || undefined,
        hotelCity: form.hotelCity || undefined,
        hotelStars: form.hotelStars === '' ? undefined : Number(form.hotelStars),
        hotelCheckIn: form.hotelCheckIn || undefined,
        hotelCheckOut: form.hotelCheckOut || undefined,
        hotelAddress: form.hotelAddress || undefined,
        mealPlan: form.mealPlan || undefined,
        roomType: form.roomType || undefined,

        airline: form.airline || undefined,
        flightNumber: form.flightNumber || undefined,
        departureAirport: form.departureAirport || undefined,
        arrivalAirport: form.arrivalAirport || undefined,
        departureTime: form.departureTime || undefined,
        arrivalTime: form.arrivalTime || undefined,
        flightClass: form.flightClass || undefined,
        pnr: form.pnr || undefined,

        returnAirline: form.returnAirline || undefined,
        returnFlightNumber: form.returnFlightNumber || undefined,
        returnDepartureTime: form.returnDepartureTime || undefined,
        returnArrivalTime: form.returnArrivalTime || undefined,
        returnPnr: form.returnPnr || undefined,

        taxiPickupAddress: form.taxiPickupAddress || undefined,
        taxiDropoffAddress: form.taxiDropoffAddress || undefined,
        taxiPickupTime: form.taxiPickupTime || undefined,
        taxiDriverName: form.taxiDriverName || undefined,
        taxiDriverPhone: form.taxiDriverPhone || undefined,
        taxiCompany: form.taxiCompany || undefined,

        insuranceCompany: form.insuranceCompany || undefined,
        insurancePolicyNo: form.insurancePolicyNo || undefined,
        insuranceStartDate: form.insuranceStartDate || undefined,
        insuranceEndDate: form.insuranceEndDate || undefined,
        insuranceCoverage: form.insuranceCoverage || undefined,

        visaStatus: form.visaStatus || undefined,
        visaType: form.visaType || undefined,
        visaNumber: form.visaNumber || undefined,
        visaIssueDate: form.visaIssueDate || undefined,
        visaExpiryDate: form.visaExpiryDate || undefined,

        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
      };
      if (isAdmin) {
        payload.supplierName = form.supplierName || undefined;
        payload.supplierContact = form.supplierContact || undefined;
        payload.supplierRef = form.supplierRef || undefined;
        payload.supplierPaid = form.supplierPaid === '' ? undefined : Number(form.supplierPaid);
        payload.supplierNotes = form.supplierNotes || undefined;
      }
      await bookingsApi.update(booking.id, payload);
      toast.success('✅ Saqlandi');
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 } as const;
  const mb = { marginBottom: 12 } as const;

  return (
    <Modal open onClose={onClose} title="✏️ Bookingni tahrirlash" maxWidth={620} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} loading={saving}>Saqlash</Btn>
      </>
    }>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {EDIT_TABS.map((t) => (
          <button key={t.id} onClick={() => setEdTab(t.id)} style={{
            background: 'none', border: 'none', padding: '8px 10px',
            color: edTab === t.id ? 'var(--primary)' : 'var(--fg-2)',
            cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
            fontWeight: edTab === t.id ? 600 : 500,
            borderBottom: '2px solid ' + (edTab === t.id ? 'var(--primary)' : 'transparent'),
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {edTab === 'main' && (
        <div>
          <Label>Tur nomi *</Label>
          <Input value={form.tourName} onChange={(e) => set('tourName', e.target.value)} style={mb} />

          <div className="grid-auto" style={row2}>
            <div>
              <Label>Manzil *</Label>
              <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} />
            </div>
            <div>
              <Label>Mamlakat</Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
          </div>

          <div className="grid-auto" style={row2}>
            <div>
              <Label>Tur turi</Label>
              <Select value={form.tourType} onChange={(e) => set('tourType', e.target.value)}>
                <option value="PACKAGE">Paket</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Guruh</option>
                <option value="VISA_SUPPORT">Viza</option>
                <option value="HOTEL_ONLY">Faqat mehmonxona</option>
                <option value="FLIGHT_ONLY">Faqat aviabilet</option>
                <option value="CRUISE">Kruiz</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]: any) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid-auto" style={row2}>
            <div>
              <Label>Jo'nash sanasi</Label>
              <Input type="date" value={form.departureDate} onChange={(e) => set('departureDate', e.target.value)} />
            </div>
            <div>
              <Label>Qaytish sanasi</Label>
              <Input type="date" value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
            </div>
          </div>

          <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><Label>Kun</Label><Input type="number" value={form.duration} onChange={(e) => set('duration', e.target.value)} /></div>
            <div><Label>Kattalar</Label><Input type="number" value={form.adults} onChange={(e) => set('adults', e.target.value)} /></div>
            <div><Label>Bolalar</Label><Input type="number" value={form.children} onChange={(e) => set('children', e.target.value)} /></div>
            <div><Label>Chaqaloqlar</Label><Input type="number" value={form.infants} onChange={(e) => set('infants', e.target.value)} /></div>
          </div>

          <Label>Tavsif</Label>
          <Textarea value={form.description} onChange={(e: any) => set('description', e.target.value)} style={mb} rows={3} />

          <Label>Tarkibiga kiradi</Label>
          <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
            {[
              ['includesFlights', '✈️ Aviachipta'],
              ['includesHotel', '🏨 Mehmonxona'],
              ['includesMeals', '🍽️ Ovqatlanish'],
              ['includesTransfer', '🚖 Transfer'],
              ['includesInsurance', '🛡️ Sug\'urta'],
              ['includesVisa', '🛂 Viza'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {edTab === 'price' && (
        <div>
          <div className="grid-auto" style={row2}>
            <div>
              <Label>Sotuv narxi ({form.currency}) *</Label>
              <Input type="number" value={form.totalPrice} onChange={(e) => set('totalPrice', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Valyuta</Label>
              <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="UZS">UZS</option>
                <option value="EUR">EUR</option>
                <option value="RUB">RUB</option>
              </Select>
              {isForeignCur && (
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
                  {fxRate
                    ? `1 USD ≈ ${fxRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${form.currency}${usdTotalPreview != null ? ` · ≈ $${usdTotalPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}`
                    : 'Kurs yuklanmoqda...'}
                </div>
              )}
            </div>
          </div>

          {isForeignCur && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}>
              💱 Saqlanganda CBU.uz rasmiy kursi bo'yicha avtomatik USD ga o'giriladi va shu tarzda hisoblanadi.
            </div>
          )}

          {/* v11: agent ham admin bilan bir xil to'liq narx/provayder formasini ko'radi —
              komissiyasi shu yerdagi foydadan (totalPrice - supplierCost - discount) hisoblanadi. */}
          <div className="grid-auto" style={row2}>
            <div>
              <Label>Tannarx / Provayder narxi 🔒</Label>
              <Input type="number" value={form.supplierCost} onChange={(e) => set('supplierCost', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Chegirma</Label>
              <Input type="number" value={form.discount} onChange={(e) => set('discount', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div style={{
            padding: 10, background: 'var(--bg-3)', borderRadius: 8,
            fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 14,
          }}>
            <span style={{ color: 'var(--fg-3)' }}>Yangi foyda (avtomatik hisoblanadi)</span>
            <span style={{ textAlign: 'right' }}>
              <b style={{ color: 'var(--success)' }}>{form.currency} {previewProfit.toLocaleString()}</b>
              {isForeignCur && usdProfitPreview != null && (
                <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>≈ ${usdProfitPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              )}
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Provayder ma'lumotlari 🔒
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Provayder nomi</Label><Input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} /></div>
            <div><Label>Provayder kontakt</Label><Input value={form.supplierContact} onChange={(e) => set('supplierContact', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Provayder ref</Label><Input value={form.supplierRef} onChange={(e) => set('supplierRef', e.target.value)} /></div>
            <div><Label>Provayderga to'langan</Label><Input type="number" value={form.supplierPaid} onChange={(e) => set('supplierPaid', e.target.value)} /></div>
          </div>
          <Label>Provayder izohi</Label>
          <Textarea value={form.supplierNotes} onChange={(e: any) => set('supplierNotes', e.target.value)} rows={2} />
        </div>
      )}

      {edTab === 'hotel' && (
        <div>
          <div className="grid-auto" style={row2}>
            <div><Label>Mehmonxona nomi</Label><Input value={form.hotelName} onChange={(e) => set('hotelName', e.target.value)} /></div>
            <div><Label>Shahar</Label><Input value={form.hotelCity} onChange={(e) => set('hotelCity', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Yulduzlar</Label><Input type="number" min={1} max={7} value={form.hotelStars} onChange={(e) => set('hotelStars', e.target.value)} /></div>
            <div><Label>Xona turi</Label><Input value={form.roomType} onChange={(e) => set('roomType', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Check-in</Label><Input type="date" value={form.hotelCheckIn} onChange={(e) => set('hotelCheckIn', e.target.value)} /></div>
            <div><Label>Check-out</Label><Input type="date" value={form.hotelCheckOut} onChange={(e) => set('hotelCheckOut', e.target.value)} /></div>
          </div>
          <Label>Ovqatlanish rejasi</Label>
          <Input value={form.mealPlan} onChange={(e) => set('mealPlan', e.target.value)} placeholder="BB, HB, AI..." style={mb} />
          <Label>Manzil</Label>
          <Textarea value={form.hotelAddress} onChange={(e: any) => set('hotelAddress', e.target.value)} rows={2} />
        </div>
      )}

      {edTab === 'flight' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
            Borish reysi
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Aviakompaniya</Label><Input value={form.airline} onChange={(e) => set('airline', e.target.value)} /></div>
            <div><Label>Reys raqami</Label><Input value={form.flightNumber} onChange={(e) => set('flightNumber', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Jo'nash aeroporti</Label><Input value={form.departureAirport} onChange={(e) => set('departureAirport', e.target.value)} /></div>
            <div><Label>Kelish aeroporti</Label><Input value={form.arrivalAirport} onChange={(e) => set('arrivalAirport', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Jo'nash vaqti</Label><Input type="datetime-local" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} /></div>
            <div><Label>Kelish vaqti</Label><Input type="datetime-local" value={form.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Klass</Label><Input value={form.flightClass} onChange={(e) => set('flightClass', e.target.value)} placeholder="Economy/Business" /></div>
            <div><Label>PNR</Label><Input value={form.pnr} onChange={(e) => set('pnr', e.target.value)} /></div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, margin: '14px 0 8px' }}>
            Qaytish reysi
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Aviakompaniya</Label><Input value={form.returnAirline} onChange={(e) => set('returnAirline', e.target.value)} /></div>
            <div><Label>Reys raqami</Label><Input value={form.returnFlightNumber} onChange={(e) => set('returnFlightNumber', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Jo'nash vaqti</Label><Input type="datetime-local" value={form.returnDepartureTime} onChange={(e) => set('returnDepartureTime', e.target.value)} /></div>
            <div><Label>Kelish vaqti</Label><Input type="datetime-local" value={form.returnArrivalTime} onChange={(e) => set('returnArrivalTime', e.target.value)} /></div>
          </div>
          <Label>PNR (qaytish)</Label>
          <Input value={form.returnPnr} onChange={(e) => set('returnPnr', e.target.value)} />
        </div>
      )}

      {edTab === 'taxi' && (
        <div>
          <div className="grid-auto" style={row2}>
            <div><Label>Olib ketish manzili</Label><Input value={form.taxiPickupAddress} onChange={(e) => set('taxiPickupAddress', e.target.value)} /></div>
            <div><Label>Tushirish manzili</Label><Input value={form.taxiDropoffAddress} onChange={(e) => set('taxiDropoffAddress', e.target.value)} /></div>
          </div>
          <Label>Olib ketish vaqti</Label>
          <Input type="datetime-local" value={form.taxiPickupTime} onChange={(e) => set('taxiPickupTime', e.target.value)} style={mb} />
          <div className="grid-auto" style={row2}>
            <div><Label>Haydovchi</Label><Input value={form.taxiDriverName} onChange={(e) => set('taxiDriverName', e.target.value)} /></div>
            <div><Label>Haydovchi telefoni</Label><Input value={form.taxiDriverPhone} onChange={(e) => set('taxiDriverPhone', e.target.value)} /></div>
          </div>
          <Label>Kompaniya</Label>
          <Input value={form.taxiCompany} onChange={(e) => set('taxiCompany', e.target.value)} />
        </div>
      )}

      {edTab === 'insurance' && (
        <div>
          <div className="grid-auto" style={row2}>
            <div><Label>Sug'urta kompaniyasi</Label><Input value={form.insuranceCompany} onChange={(e) => set('insuranceCompany', e.target.value)} /></div>
            <div><Label>Polis raqami</Label><Input value={form.insurancePolicyNo} onChange={(e) => set('insurancePolicyNo', e.target.value)} /></div>
          </div>
          <div className="grid-auto" style={row2}>
            <div><Label>Boshlanish sanasi</Label><Input type="date" value={form.insuranceStartDate} onChange={(e) => set('insuranceStartDate', e.target.value)} /></div>
            <div><Label>Tugash sanasi</Label><Input type="date" value={form.insuranceEndDate} onChange={(e) => set('insuranceEndDate', e.target.value)} /></div>
          </div>
          <Label>Qamrov</Label>
          <Textarea value={form.insuranceCoverage} onChange={(e: any) => set('insuranceCoverage', e.target.value)} rows={2} />
        </div>
      )}

      {edTab === 'visa' && (
        <div>
          <div className="grid-auto" style={row2}>
            <div><Label>Viza statusi</Label><Input value={form.visaStatus} onChange={(e) => set('visaStatus', e.target.value)} placeholder="Topshirildi/Tayyor/Rad etildi" /></div>
            <div><Label>Viza turi</Label><Input value={form.visaType} onChange={(e) => set('visaType', e.target.value)} /></div>
          </div>
          <Label>Viza raqami</Label>
          <Input value={form.visaNumber} onChange={(e) => set('visaNumber', e.target.value)} style={mb} />
          <div className="grid-auto" style={row2}>
            <div><Label>Berilgan sana</Label><Input type="date" value={form.visaIssueDate} onChange={(e) => set('visaIssueDate', e.target.value)} /></div>
            <div><Label>Amal qilish muddati</Label><Input type="date" value={form.visaExpiryDate} onChange={(e) => set('visaExpiryDate', e.target.value)} /></div>
          </div>
        </div>
      )}

      {edTab === 'notes' && (
        <div>
          <Label>Izoh (klient ham ko'rishi mumkin bo'lgan joylarda)</Label>
          <Textarea value={form.notes} onChange={(e: any) => set('notes', e.target.value)} rows={3} style={mb} />
          <Label>Ichki izoh 🔒 (faqat xodimlar)</Label>
          <Textarea value={form.internalNotes} onChange={(e: any) => set('internalNotes', e.target.value)} rows={3} />
        </div>
      )}
    </Modal>
  );
}