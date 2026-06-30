'use client';
import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { bookingsApi, paymentsApi, v8Api, passengersApi, servicesApi, telegramApi, approvalsApi, api } from '@/services/api';
import { useAuth } from '@/lib/store';
import { Card, Btn, Skeleton, Badge, Label, Input, Select, Modal, Avatar, Textarea } from '@/components/ui';
import { fmtDate, fmtDateTime, errMsg, BOOKING_STATUS_LABELS } from '@/lib/helpers';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--fg-3)',
  CONFIRMED: 'var(--info)',
  PAID: 'var(--success)',
  IN_PROGRESS: 'var(--primary)',
  COMPLETED: 'var(--success)',
  CANCELLED: 'var(--danger)',
  REFUNDED: 'var(--fg-3)',
};

const TABS = [
  { id: 'overview',    label: '📋 Umumiy' },
  { id: 'passengers',  label: '✈️ Yo\'lovchilar' },
  { id: 'documents',   label: '📎 Hujjatlar' },
  { id: 'payments',    label: '💰 To\'lovlar' },
];

function Info({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '—'}</div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [b, setB] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  // v9: Mijozga invoice yuborish modali
  const [showSendInvoice, setShowSendInvoice] = useState(false);
  // v9-FINAL: Approval modal (chegirma/refund so'rash uchun)
  const [showApproval, setShowApproval] = useState<{ type: string } | null>(null);
  // BUG FIX: Booking ma'lumotlarini (narx, tannarx, chegirma...) to'g'ridan-to'g'ri tahrirlash modali
  const [showEdit, setShowEdit] = useState(false);

  const load = () => {
    setLoading(true);
    bookingsApi.one(id).then((r) => setB(r.data)).finally(() => setLoading(false));
    paymentsApi.list({ bookingId: id }).then((r) => setPayments(r.data?.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <CrmLayout><div style={{ padding: 24 }}><Skeleton height={400} /></div></CrmLayout>;
  if (!b) return <CrmLayout><div style={{ padding: 24 }}>Booking topilmadi</div></CrmLayout>;

  const isAdmin = user?.role !== 'AGENT';
  // BUG FIX: avval faqat admin tahrirlay olardi va hech kim (admin ham) bookingni
  // sahifadan o'chira olmasdi. Endi agent ham O'ZINING bookingini tahrirlay va
  // o'chira oladi (backend ham shunga moslab tuzatildi — BookingsService.delete).
  const isOwner = b.agentId === user?.id;
  const canEdit = isAdmin || isOwner;
  const canDelete = isAdmin || isOwner;
  const visibleTabs = TABS.filter((t: any) => !(t as any).adminOnly || isAdmin);

  async function deleteBooking() {
    if (!window.confirm(`"${b.bookingRef}" bookingni butunlay o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      await bookingsApi.delete(b.id);
      toast.success("✅ Booking o'chirildi");
      router.push('/bookings');
    } catch (e: any) {
      toast.error(errMsg(e));
    }
  }

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, cursor: 'pointer' }} onClick={() => router.push('/bookings')}>
              ← Bookinglar
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--fg-2)', marginRight: 10 }}>{b.bookingRef}</span>
              {b.tourName}
            </h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <Badge color={STATUS_COLORS[b.status] || 'var(--fg-3)'}>{b.status}</Badge>
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>📍 {b.destination}</span>
              {b.country && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>• {b.country}</span>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Sale Price</div>
              {canEdit && (
                <button
                  onClick={() => setShowEdit(true)}
                  title="Bookingni tahrirlash"
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                    cursor: 'pointer', color: 'var(--fg-2)', fontSize: 11, padding: '2px 6px',
                  }}
                >
                  ✏️ Tahrirlash
                </button>
              )}
              {canDelete && (
                <button
                  onClick={deleteBooking}
                  title="Bookingni o'chirish"
                  style={{
                    background: 'none', border: '1px solid var(--danger)', borderRadius: 6,
                    cursor: 'pointer', color: 'var(--danger)', fontSize: 11, padding: '2px 6px',
                  }}
                >
                  🗑 O'chirish
                </button>
              )}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{b.currency} {b.totalPrice}</div>
            {isAdmin && b.supplierCost > 0 && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <span style={{ color: 'var(--fg-3)' }}>Cost: </span>
                <b style={{ color: 'var(--fg-2)' }}>{b.supplierCost}</b>
                <span style={{ marginLeft: 8, color: 'var(--fg-3)' }}>Profit: </span>
                <b style={{ color: 'var(--success)' }}>{b.profit}</b>
              </div>
            )}

            {/* v9: Mijozga yuborish tugmasi */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Btn variant="gradient" onClick={() => setShowSendInvoice(true)}>
                📤 Mijozga yuborish
              </Btn>
              {/* v9-FINAL: Tasdiq so'rash tugmalari */}
              <div style={{ display: 'flex', gap: 4 }}>
                <Btn size="sm" variant="secondary" onClick={() => setShowApproval({ type: 'DISCOUNT' })}>
                  💰 Chegirma so'rash
                </Btn>
                <Btn size="sm" variant="secondary" onClick={() => setShowApproval({ type: 'REFUND' })}>
                  ↩️ Refund so'rash
                </Btn>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {visibleTabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', padding: '10px 14px',
              color: tab === t.id ? 'var(--primary)' : 'var(--fg-2)',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t.id ? 600 : 500,
              borderBottom: '2px solid ' + (tab === t.id ? 'var(--primary)' : 'transparent'),
              marginBottom: -1, whiteSpace: 'nowrap',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <Card>
              <Label>👤 Mijoz</Label>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{b.client?.fullName}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{b.client?.phone}</div>
              <Btn size="sm" variant="ghost" onClick={() => router.push(`/clients/${b.clientId}`)} style={{ marginTop: 8 }}>
                Profil →
              </Btn>
            </Card>

            <Card>
              <Label>📅 Sayohat sanasi</Label>
              <div style={{ fontSize: 14 }}>
                {b.departureDate ? fmtDate(b.departureDate) : '—'}
                {b.returnDate && <> → {fmtDate(b.returnDate)}</>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                {b.duration && `${b.duration} kun`}
              </div>
            </Card>

            <Card>
              <Label>👥 Yo'lovchilar</Label>
              <div style={{ fontSize: 14 }}>
                {b.adults} kattalar
                {b.children > 0 && ` + ${b.children} bola`}
                {b.infants > 0 && ` + ${b.infants} chaqaloq`}
              </div>
            </Card>

            <Card>
              <Label>✅ Xizmatlar</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {b.includesFlights && <Badge color="var(--info)">✈ Reys</Badge>}
                {b.includesHotel && <Badge color="var(--primary)">🏨 Hotel</Badge>}
                {b.includesMeals && <Badge color="var(--success)">🍽 Ovqat</Badge>}
                {b.includesVisa && <Badge color="var(--warning)">🛂 Viza</Badge>}
                {b.includesTransfer && <Badge color="var(--info)">🚕 Transfer</Badge>}
                {b.includesInsurance && <Badge color="var(--success)">🛡 Sug'urta</Badge>}
              </div>
            </Card>

            {b.notes && (
              <Card style={{ gridColumn: '1/-1' }}>
                <Label>📝 Izoh</Label>
                <p style={{ margin: 0, fontSize: 13 }}>{b.notes}</p>
              </Card>
            )}

            {b.internalNotes && (
              <Card style={{ gridColumn: '1/-1', borderLeft: '3px solid var(--warning)' }}>
                <Label>🔒 Ichki izoh</Label>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-2)' }}>{b.internalNotes}</p>
              </Card>
            )}
          </div>
        )}

        {tab === 'hotel' && (
          <Card>
            {b.hotelName ? (
              <>
                <h3 style={{ marginTop: 0 }}>{b.hotelName} {b.hotelStars && '★'.repeat(b.hotelStars)}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <Info label="Shahar" value={b.hotelCity} />
                  <Info label="Manzil" value={b.hotelAddress} />
                  <Info label="Kirish" value={b.hotelCheckIn && fmtDate(b.hotelCheckIn)} />
                  <Info label="Chiqish" value={b.hotelCheckOut && fmtDate(b.hotelCheckOut)} />
                  <Info label="Xona turi" value={b.roomType} />
                  <Info label="Ovqatlanish" value={b.mealPlan} />
                </div>
              </>
            ) : <p style={{ color: 'var(--fg-3)' }}>Mehmonxona ma'lumotlari yo'q</p>}
          </Card>
        )}

        {tab === 'flight' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card>
              <h3 style={{ marginTop: 0 }}>✈️ Borish</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                <Info label="Aviakompaniya" value={b.airline} />
                <Info label="Reys raqami" value={b.flightNumber} />
                <Info label="Aeroport (uchish)" value={b.departureAirport} />
                <Info label="Vaqt (uchish)" value={b.departureTime && fmtDateTime(b.departureTime)} />
                <Info label="Aeroport (qo'nish)" value={b.arrivalAirport} />
                <Info label="Vaqt (qo'nish)" value={b.arrivalTime && fmtDateTime(b.arrivalTime)} />
                <Info label="Class" value={b.flightClass} />
                <Info label="PNR" value={b.pnr} mono />
              </div>
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>✈️ Qaytish</h3>
              {b.returnAirline ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <Info label="Aviakompaniya" value={b.returnAirline} />
                  <Info label="Reys raqami" value={b.returnFlightNumber} />
                  <Info label="Vaqt (uchish)" value={b.returnDepartureTime && fmtDateTime(b.returnDepartureTime)} />
                  <Info label="Vaqt (qo'nish)" value={b.returnArrivalTime && fmtDateTime(b.returnArrivalTime)} />
                  <Info label="PNR" value={b.returnPnr} mono />
                </div>
              ) : <p style={{ color: 'var(--fg-3)' }}>Qaytish ma'lumotlari yo'q</p>}
            </Card>
          </div>
        )}

        {tab === 'taxi' && (
          <Card>
            <h3 style={{ marginTop: 0 }}>🚕 Transfer</h3>
            {b.taxiPickupAddress || b.taxiDriverName ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <Info label="Olib ketish" value={b.taxiPickupAddress} />
                <Info label="Yetkazib berish" value={b.taxiDropoffAddress} />
                <Info label="Vaqt" value={b.taxiPickupTime && fmtDateTime(b.taxiPickupTime)} />
                <Info label="Haydovchi" value={b.taxiDriverName} />
                <Info label="Telefon" value={b.taxiDriverPhone} />
                <Info label="Kompaniya" value={b.taxiCompany} />
              </div>
            ) : <p style={{ color: 'var(--fg-3)' }}>Transfer ma'lumotlari yo'q</p>}
          </Card>
        )}

        {tab === 'insurance' && (
          <Card>
            <h3 style={{ marginTop: 0 }}>🛡 Sug'urta</h3>
            {b.insuranceCompany ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <Info label="Kompaniya" value={b.insuranceCompany} />
                <Info label="Polis raqami" value={b.insurancePolicyNo} mono />
                <Info label="Boshlanish" value={b.insuranceStartDate && fmtDate(b.insuranceStartDate)} />
                <Info label="Tugash" value={b.insuranceEndDate && fmtDate(b.insuranceEndDate)} />
                <div style={{ gridColumn: '1/-1' }}>
                  <Info label="Qoplash" value={b.insuranceCoverage} />
                </div>
              </div>
            ) : <p style={{ color: 'var(--fg-3)' }}>Sug'urta yo'q</p>}
          </Card>
        )}

        {tab === 'visa' && (
          <Card>
            <h3 style={{ marginTop: 0 }}>🛂 Viza</h3>
            {b.visaStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <Label>Holat</Label>
                  <Badge color={b.visaStatus === 'approved' ? 'var(--success)' : b.visaStatus === 'rejected' ? 'var(--danger)' : 'var(--warning)'}>
                    {b.visaStatus}
                  </Badge>
                </div>
                <Info label="Turi" value={b.visaType} />
                <Info label="Raqami" value={b.visaNumber} mono />
                <Info label="Berilgan" value={b.visaIssueDate && fmtDate(b.visaIssueDate)} />
                <Info label="Muddati" value={b.visaExpiryDate && fmtDate(b.visaExpiryDate)} />
              </div>
            ) : <p style={{ color: 'var(--fg-3)' }}>Viza yo'q</p>}
          </Card>
        )}

        {tab === 'supplier' && isAdmin && (
          <Card style={{ borderLeft: '3px solid var(--warning)' }}>
            <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700, marginBottom: 8 }}>
              🔒 FAQAT ADMIN/AGENT KO'RADI — MIJOZGA YUBORILMAYDI
            </div>
            <h3 style={{ marginTop: 0 }}>🏢 Provider / Supplier</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Info label="Supplier nomi" value={b.supplierName} />
              <Info label="Aloqa" value={b.supplierContact} />
              <Info label="Provider Cost" value={`${b.currency} ${b.supplierCost || 0}`} />
              <Info label="To'langan" value={`${b.currency} ${b.supplierPaid || 0}`} />
              <Info label="Booking Ref" value={b.supplierRef} mono />
              <div style={{ gridColumn: '1/-1' }}>
                <Info label="Izohlar" value={b.supplierNotes} />
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Profit hisoboti</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 14, flexWrap: 'wrap' }}>
                <div>Sale: <b>{b.currency} {b.totalPrice}</b></div>
                <div>Cost: <b style={{ color: 'var(--fg-2)' }}>{b.currency} {b.supplierCost || 0}</b></div>
                <div>Discount: <b>{b.currency} {b.discount || 0}</b></div>
                <div>= <b style={{ color: 'var(--success)' }}>Profit {b.currency} {b.profit}</b></div>
              </div>
            </div>
          </Card>
        )}

        {tab === 'documents' && <DocumentsTab bookingId={id} booking={b} />}
        {tab === 'passengers' && <PassengersTab bookingId={id} />}


        {tab === 'payments' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>💰 To'lovlar tarixi</h3>
              <div style={{ fontSize: 13 }}>
                To'langan: <b style={{ color: 'var(--success)' }}>{b.currency} {b.paidAmount}</b>
                {' / '}
                <b>{b.currency} {b.totalPrice}</b>
              </div>
            </div>
            {payments.length === 0 ? (
              <p style={{ color: 'var(--fg-3)' }}>To'lovlar yo'q</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Sana</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Method</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Summa</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                      <td style={{ padding: 10 }}>{fmtDate(p.paidAt)}</td>
                      <td style={{ padding: 10 }}>{p.method}</td>
                      <td style={{ padding: 10, textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>
                        {p.currency} {p.amount}
                      </td>
                      <td style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      {/* v9: Mijozga invoice yuborish modali */}
      {showSendInvoice && (
        <SendInvoiceModal
          booking={b}
          onClose={() => setShowSendInvoice(false)}
          onSent={() => { setShowSendInvoice(false); load(); }}
        />
      )}

      {/* v9-FINAL: Tasdiq so'rash modali */}
      {showApproval && (
        <RequestApprovalModal
          booking={b}
          type={showApproval.type}
          onClose={() => setShowApproval(null)}
          onSent={() => { setShowApproval(null); toast.success("✅ Tasdiq so'rovi yuborildi"); }}
        />
      )}

      {/* BUG FIX: Narx/tannarx/chegirma to'g'ridan-to'g'ri tahrirlash modali.
          Saqlangach booking qayta yuklanadi (load()) — backend esa
          'dashboard:update' socket eventini yuboradi, shu sababli
          Dashboard sahifasidagi raqamlar ham avtomatik yangilanadi. */}
      {showEdit && (
        <EditBookingModal
          booking={b}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </CrmLayout>
  );
}

// ─── v8: Booking Checklist ───
function ChecklistTab({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  const load = () => {
    setLoading(true);
    v8Api.getChecklist(bookingId).then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [bookingId]);

  async function toggle(itemId: string, isDone: boolean) {
    try {
      await v8Api.toggleChecklistItem(itemId, !isDone);
      load();
    } catch (e: any) { toast.error('Xato'); }
  }

  async function add() {
    if (!newItem.trim()) return;
    try {
      await v8Api.addChecklistItem(bookingId, newItem);
      setNewItem('');
      load();
    } catch (e: any) { toast.error('Xato'); }
  }

  async function remove(itemId: string) {
    if (!confirm("O'chirish?")) return;
    try {
      await v8Api.deleteChecklistItem(itemId);
      load();
    } catch (e: any) { toast.error('Xato'); }
  }

  if (loading) return <Card><Skeleton height={40} count={5} /></Card>;
  if (!data) return <Card><p style={{ color: 'var(--fg-3)' }}>Yuklab bo'lmadi</p></Card>;

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>☑ Booking checklist</h3>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            {data.done} / {data.total} ({data.progress}%)
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${data.progress}%`,
            background: 'var(--gradient)', transition: 'width 0.3s',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.items.map((it: any) => (
          <div key={it.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 10, background: 'var(--bg-3)', borderRadius: 8,
            opacity: it.isDone ? 0.6 : 1,
          }}>
            <input type="checkbox" checked={it.isDone} onChange={() => toggle(it.id, it.isDone)}
              style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, textDecoration: it.isDone ? 'line-through' : 'none' }}>
                {it.item}
              </div>
              {it.isDone && it.doneBy && (
                <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                  ✓ {it.doneBy.name} • {new Date(it.doneAt).toLocaleString('uz-UZ')}
                </div>
              )}
            </div>
            <button onClick={() => remove(it.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--fg-3)', fontSize: 14,
            }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Yangi qadam qo'shish..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--fg)', fontSize: 13, outline: 'none',
          }}
        />
        <Btn onClick={add} disabled={!newItem.trim()}>+ Qo'shish</Btn>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// v9: PASSENGERS TAB — Yo'lovchilar
// ═══════════════════════════════════════════════════════════

const TYPE_LABELS_PASS: Record<string, string> = {
  ADULT: '👨 Katta',
  CHILD: '👧 Bola',
  INFANT: '👶 Chaqaloq',
  SENIOR: '👴 Keksa',
};

function PassengersTab({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      passengersApi.list(bookingId),
      passengersApi.stats(bookingId),
    ]).then(([list, st]: any[]) => {
      setData(list.data || []);
      setStats(st.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [bookingId]);

  async function deletePassenger(id: string) {
    if (!confirm("O'chirilsinmi?")) return;
    try {
      await passengersApi.delete(id);
      toast.success("O'chirildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Card><Skeleton height={200} /></Card>;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>👨‍👩‍👧 Yo'lovchilar ({data.length})</h3>
          {stats && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
              Kattalar: {stats.adults} • Bolalar: {stats.children} • Chaqaloqlar: {stats.infants} • Keksalar: {stats.seniors}
            </div>
          )}
        </div>
        <Btn variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>+ Yo'lovchi qo'shish</Btn>
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 40, opacity: 0.4 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Yo'lovchilar yo'q</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((p) => (
            <div key={p.id} style={{
              padding: 14, background: 'var(--bg-3)', borderRadius: 10,
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <Avatar name={p.fullName} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.fullName}</span>
                  <Badge color="var(--primary)">{TYPE_LABELS_PASS[p.passengerType]}</Badge>
                  {p.gender && <Badge color="var(--info)">{p.gender}</Badge>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                  {p.dateOfBirth && `🎂 ${new Date(p.dateOfBirth).toLocaleDateString('uz-UZ')} • `}
                  {p.passportNo && `📕 ${p.passportNo} `}
                  {p.passportCountry && `(${p.passportCountry})`}
                  {p.ticketNo && <span style={{ fontSize: 11, color: 'var(--info)' }}> 🎫 {p.ticketNo}</span>}
                  {p.flightNo && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}> ✈️ {p.flightNo} {p.flightFrom}→{p.flightTo}</span>}
                  {p.seatNo && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}> 💺 {p.seatNo}</span>}
                </div>
                {(p.mealPreference || p.seatPreference || p.specialRequest) && (
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6 }}>
                    {p.mealPreference && `🍽 ${p.mealPreference} `}
                    {p.seatPreference && `💺 ${p.seatPreference} `}
                    {p.specialRequest && `📝 ${p.specialRequest}`}
                  </div>
                )}
                {p.pricePerPerson > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                    💰 ${p.pricePerPerson}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setEditing(p); setShowForm(true); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 14, padding: 6,
                }}>✏</button>
                <button onClick={() => deletePassenger(p.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: 6,
                }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PassengerForm
          bookingId={bookingId}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </Card>
  );
}

function PassengerForm({ bookingId, editing, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    fullName: editing?.fullName || '',
    dateOfBirth: editing?.dateOfBirth?.slice(0, 10) || '',
    gender: editing?.gender || '',
    passengerType: editing?.passengerType || 'ADULT',
    passportNo: editing?.passportNo || '',
    passportCountry: editing?.passportCountry || '',
    passportExpiry: editing?.passportExpiry?.slice(0, 10) || '',
    nationality: editing?.nationality || '',
    phone: editing?.phone || '',
    email: editing?.email || '',
    mealPreference: editing?.mealPreference || '',
    seatPreference: editing?.seatPreference || '',
    specialRequest: editing?.specialRequest || '',
    pricePerPerson: editing?.pricePerPerson || '',
    ticketNo: editing?.ticketNo || '',
    flightNo: editing?.flightNo || '',
    flightFrom: editing?.flightFrom || '',
    flightTo: editing?.flightTo || '',
    flightDate: editing?.flightDate?.slice?.(0, 10) || '',
    seatNo: editing?.seatNo || '',
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!form.fullName.trim()) { toast.error("Ism kerak"); return; }
    setLoading(true);
    try {
      const data = { ...form, pricePerPerson: form.pricePerPerson ? Number(form.pricePerPerson) : undefined };
      if (editing) await passengersApi.update(editing.id, data);
      else await passengersApi.create(bookingId, data);
      toast.success("Saqlandi");
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Tahrirlash" : "Yangi yo'lovchi"} maxWidth={600} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} loading={loading}>Saqlash</Btn>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>To'liq ism *</Label>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <Label>Turi</Label>
          <Select value={form.passengerType} onChange={(e) => setForm({ ...form, passengerType: e.target.value })}>
            <option value="ADULT">👨 Katta</option>
            <option value="CHILD">👧 Bola</option>
            <option value="INFANT">👶 Chaqaloq</option>
            <option value="SENIOR">👴 Keksa</option>
          </Select>
        </div>
        <div>
          <Label>Tug'ilgan sana</Label>
          <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
        </div>
        <div>
          <Label>Jinsi</Label>
          <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">—</option>
            <option value="male">Erkak</option>
            <option value="female">Ayol</option>
          </Select>
        </div>
        <div>
          <Label>Millati</Label>
          <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="O'zbek" />
        </div>
        <div>
          <Label>Pasport raqami</Label>
          <Input value={form.passportNo} onChange={(e) => setForm({ ...form, passportNo: e.target.value })} placeholder="AB1234567" />
        </div>
        <div>
          <Label>Pasport beruvchi davlat</Label>
          <Input value={form.passportCountry} onChange={(e) => setForm({ ...form, passportCountry: e.target.value })} placeholder="Uzbekistan" />
        </div>
        <div>
          <Label>Pasport amal qiladi</Label>
          <Input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} />
        </div>
        <div>
          <Label>Alohida narx ($)</Label>
          <Input type="number" value={form.pricePerPerson} onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })} />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>🍽 Taom xohishi</Label>
          <Select value={form.mealPreference} onChange={(e) => setForm({ ...form, mealPreference: e.target.value })}>
            <option value="">—</option>
            <option value="halal">Halal</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="kosher">Kosher</option>
            <option value="diabetic">Diabetic</option>
          </Select>
        </div>
        <div>
          <Label>💺 O'rindiq xohishi</Label>
          <Select value={form.seatPreference} onChange={(e) => setForm({ ...form, seatPreference: e.target.value })}>
            <option value="">—</option>
            <option value="window">Deraza yonida</option>
            <option value="aisle">Yo'lakda</option>
            <option value="middle">O'rta</option>
          </Select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>📝 Maxsus iltimoslar</Label>
          <Input value={form.specialRequest} onChange={(e) => setForm({ ...form, specialRequest: e.target.value })} placeholder="Wheelchair, allergy va h.k." />
        </div>

        {/* Flight info section */}
        <div style={{ gridColumn: '1/-1', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Parvoz malumotlari
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <Label>Bilet raqami</Label>
              <Input value={form.ticketNo} onChange={(e) => setForm({ ...form, ticketNo: e.target.value })} placeholder="TK-123456789" />
            </div>
            <div>
              <Label>Reys raqami</Label>
              <Input value={form.flightNo} onChange={(e) => setForm({ ...form, flightNo: e.target.value })} placeholder="HY101" />
            </div>
            <div>
              <Label>Uchish sanasi</Label>
              <Input type="date" value={form.flightDate} onChange={(e) => setForm({ ...form, flightDate: e.target.value })} />
            </div>
            <div>
              <Label>Qayerdan (IATA)</Label>
              <Input value={form.flightFrom} onChange={(e) => setForm({ ...form, flightFrom: e.target.value })} placeholder="TAS" />
            </div>
            <div>
              <Label>Qayerga (IATA)</Label>
              <Input value={form.flightTo} onChange={(e) => setForm({ ...form, flightTo: e.target.value })} placeholder="DXB" />
            </div>
            <div>
              <Label>Orindig nomeri</Label>
              <Input value={form.seatNo} onChange={(e) => setForm({ ...form, seatNo: e.target.value })} placeholder="14A" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9: SERVICES TAB — Xizmatlar (taxi, insurance, visa, ...)
// ═══════════════════════════════════════════════════════════
const SERVICE_TYPES = [
  { value: 'TAXI', label: '🚕 Taxi' },
  { value: 'TRANSFER', label: '🚐 Transfer' },
  { value: 'INSURANCE', label: '🛡 Sug\'urta' },
  { value: 'VISA', label: '🛂 Viza' },
  { value: 'SIM_CARD', label: '📱 SIM-karta' },
  { value: 'VIP_MEET', label: '⭐ VIP Meet' },
  { value: 'GUIDE', label: '🗺 Gid' },
  { value: 'HOTEL_UPGRADE', label: '🏨 Otel upgrade' },
  { value: 'TOUR_GUIDE', label: '🎒 Tour guide' },
  { value: 'EXCURSION', label: '🏞 Ekskursiya' },
  { value: 'RESTAURANT', label: '🍽 Restoran' },
  { value: 'OTHER', label: '📋 Boshqa' },
];

const STATUS_LABELS_SVC: Record<string, string> = {
  PENDING: '⏳ Kutilmoqda',
  CONFIRMED: '✓ Tasdiqlangan',
  COMPLETED: '✅ Bajarilgan',
  CANCELLED: '❌ Bekor',
};

function ServicesTab({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      servicesApi.list(bookingId),
      servicesApi.total(bookingId),
    ]).then(([list, t]: any[]) => {
      setData(list.data || []);
      setTotal(t.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [bookingId]);

  async function deleteSvc(id: string) {
    if (!confirm("O'chirilsinmi?")) return;
    try { await servicesApi.delete(id); toast.success("O'chirildi"); load(); }
    catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Card><Skeleton height={200} /></Card>;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>🛎 Xizmatlar ({data.length})</h3>
          {total && (
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>
              Jami: ${total.totalAmount?.toFixed(2)}
            </div>
          )}
        </div>
        <Btn variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>+ Xizmat qo'shish</Btn>
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 40, opacity: 0.4 }}>🛎</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Xizmatlar yo'q</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((s) => {
            const typeLabel = SERVICE_TYPES.find((t) => t.value === s.type)?.label || s.type;
            return (
              <div key={s.id} style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Badge color="var(--primary)">{typeLabel}</Badge>
                    <Badge color={s.status === 'COMPLETED' ? 'var(--success)' : s.status === 'CONFIRMED' ? 'var(--info)' : 'var(--warning)'}>
                      {STATUS_LABELS_SVC[s.status]}
                    </Badge>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  {s.fromLocation && s.toLocation && (
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                      📍 {s.fromLocation} → {s.toLocation}
                    </div>
                  )}
                  {s.date && (
                    <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                      📅 {new Date(s.date).toLocaleDateString('uz-UZ')}{s.time && ` ${s.time}`}
                    </div>
                  )}
                  {s.providerName && (
                    <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                      🏢 {s.providerName}{s.providerPhone && ` (${s.providerPhone})`}
                    </div>
                  )}
                  {s.notes && (
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6, padding: 6, background: 'var(--bg-2)', borderRadius: 5 }}>
                      💬 {s.notes}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                    ${s.totalAmount?.toFixed(2)}
                  </div>
                  {s.quantity > 1 && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                      ${s.price} × {s.quantity}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 14, padding: 4 }}>✏</button>
                    <button onClick={() => deleteSvc(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: 4 }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ServiceForm bookingId={bookingId} editing={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </Card>
  );
}

function ServiceForm({ bookingId, editing, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    type: editing?.type || 'TAXI',
    name: editing?.name || '',
    description: editing?.description || '',
    fromLocation: editing?.fromLocation || '',
    toLocation: editing?.toLocation || '',
    date: editing?.date?.slice(0, 10) || '',
    time: editing?.time || '',
    price: editing?.price || '',
    quantity: editing?.quantity || 1,
    status: editing?.status || 'PENDING',
    notes: editing?.notes || '',
    providerName: editing?.providerName || '',
    providerPhone: editing?.providerPhone || '',
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast.error("Nom kerak"); return; }
    if (!form.price) { toast.error("Narx kerak"); return; }
    setLoading(true);
    try {
      const data = { ...form, price: Number(form.price), quantity: Number(form.quantity) };
      if (editing) await servicesApi.update(editing.id, data);
      else await servicesApi.create(bookingId, data);
      toast.success("Saqlandi");
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  const total = (Number(form.price) || 0) * (Number(form.quantity) || 1);

  return (
    <Modal open onClose={onClose} title={editing ? "Tahrirlash" : "Yangi xizmat"} maxWidth={600} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} loading={loading}>Saqlash</Btn>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <Label>Xizmat turi *</Label>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div>
          <Label>Holat</Label>
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="PENDING">⏳ Kutilmoqda</option>
            <option value="CONFIRMED">✓ Tasdiqlangan</option>
            <option value="COMPLETED">✅ Bajarilgan</option>
            <option value="CANCELLED">❌ Bekor</option>
          </Select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Nomi *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Airport → Hilton Hotel" />
        </div>
        <div>
          <Label>Qayerdan</Label>
          <Input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="Airport" />
        </div>
        <div>
          <Label>Qayerga</Label>
          <Input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="Hilton Hotel" />
        </div>
        <div>
          <Label>Sana</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <Label>Vaqt</Label>
          <Input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="22:00" />
        </div>
        <div>
          <Label>Narxi ($) *</Label>
          <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div>
          <Label>Miqdori</Label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1', padding: 10, background: 'var(--bg-3)', borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>JAMI: </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>${total.toFixed(2)}</span>
        </div>
        <div>
          <Label>Provayder nomi</Label>
          <Input value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} placeholder="Yandex Taxi" />
        </div>
        <div>
          <Label>Provayder telefoni</Label>
          <Input value={form.providerPhone} onChange={(e) => setForm({ ...form, providerPhone: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Izoh</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// BUG FIX: BOOKING'NI TO'LIQ TAHRIRLASH MODALI
// ═══════════════════════════════════════════════════════════
//
// Avval booking detail sahifasida hech qanday tahrirlash imkoni
// yo'q edi (faqat admin tasdiqlash orqali chegirma/refund so'rash
// mumkin edi). Bu modal asosiy ma'lumotlar, narx, sana, status,
// mehmonxona, aviachipta (borish/qaytish), taksi, sug'urta, viza
// va izohlarni bevosita PUT /bookings/:id orqali yangilaydi.
// Backend profit'ni avtomatik qayta hisoblaydi, klient
// statistikasini (recalcStats) va dashboard'ni
// (dashboard:update socket event) ham yangilaydi.
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

function toDateInput(d: any) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
}
function toDateTimeInput(d: any) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 16); } catch { return ''; }
}

function EditBookingModal({ booking, onClose, onSaved }: any) {
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

          <div style={row2}>
            <div>
              <Label>Manzil *</Label>
              <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} />
            </div>
            <div>
              <Label>Mamlakat</Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
          </div>

          <div style={row2}>
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

          <div style={row2}>
            <div>
              <Label>Jo'nash sanasi</Label>
              <Input type="date" value={form.departureDate} onChange={(e) => set('departureDate', e.target.value)} />
            </div>
            <div>
              <Label>Qaytish sanasi</Label>
              <Input type="date" value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><Label>Kun</Label><Input type="number" value={form.duration} onChange={(e) => set('duration', e.target.value)} /></div>
            <div><Label>Kattalar</Label><Input type="number" value={form.adults} onChange={(e) => set('adults', e.target.value)} /></div>
            <div><Label>Bolalar</Label><Input type="number" value={form.children} onChange={(e) => set('children', e.target.value)} /></div>
            <div><Label>Chaqaloqlar</Label><Input type="number" value={form.infants} onChange={(e) => set('infants', e.target.value)} /></div>
          </div>

          <Label>Tavsif</Label>
          <Textarea value={form.description} onChange={(e: any) => set('description', e.target.value)} style={mb} rows={3} />

          <Label>Tarkibiga kiradi</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
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
          <div style={row2}>
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
            </div>
          </div>

          {isAdmin && (
            <>
              <div style={row2}>
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
                <b style={{ color: 'var(--success)' }}>{form.currency} {previewProfit.toLocaleString()}</b>
              </div>

              <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
                Provayder ma'lumotlari 🔒
              </div>
              <div style={row2}>
                <div><Label>Provayder nomi</Label><Input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} /></div>
                <div><Label>Provayder kontakt</Label><Input value={form.supplierContact} onChange={(e) => set('supplierContact', e.target.value)} /></div>
              </div>
              <div style={row2}>
                <div><Label>Provayder ref</Label><Input value={form.supplierRef} onChange={(e) => set('supplierRef', e.target.value)} /></div>
                <div><Label>Provayderga to'langan</Label><Input type="number" value={form.supplierPaid} onChange={(e) => set('supplierPaid', e.target.value)} /></div>
              </div>
              <Label>Provayder izohi</Label>
              <Textarea value={form.supplierNotes} onChange={(e: any) => set('supplierNotes', e.target.value)} rows={2} />
            </>
          )}
        </div>
      )}

      {edTab === 'hotel' && (
        <div>
          <div style={row2}>
            <div><Label>Mehmonxona nomi</Label><Input value={form.hotelName} onChange={(e) => set('hotelName', e.target.value)} /></div>
            <div><Label>Shahar</Label><Input value={form.hotelCity} onChange={(e) => set('hotelCity', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Yulduzlar</Label><Input type="number" min={1} max={7} value={form.hotelStars} onChange={(e) => set('hotelStars', e.target.value)} /></div>
            <div><Label>Xona turi</Label><Input value={form.roomType} onChange={(e) => set('roomType', e.target.value)} /></div>
          </div>
          <div style={row2}>
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
          <div style={row2}>
            <div><Label>Aviakompaniya</Label><Input value={form.airline} onChange={(e) => set('airline', e.target.value)} /></div>
            <div><Label>Reys raqami</Label><Input value={form.flightNumber} onChange={(e) => set('flightNumber', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Jo'nash aeroporti</Label><Input value={form.departureAirport} onChange={(e) => set('departureAirport', e.target.value)} /></div>
            <div><Label>Kelish aeroporti</Label><Input value={form.arrivalAirport} onChange={(e) => set('arrivalAirport', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Jo'nash vaqti</Label><Input type="datetime-local" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} /></div>
            <div><Label>Kelish vaqti</Label><Input type="datetime-local" value={form.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Klass</Label><Input value={form.flightClass} onChange={(e) => set('flightClass', e.target.value)} placeholder="Economy/Business" /></div>
            <div><Label>PNR</Label><Input value={form.pnr} onChange={(e) => set('pnr', e.target.value)} /></div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, margin: '14px 0 8px' }}>
            Qaytish reysi
          </div>
          <div style={row2}>
            <div><Label>Aviakompaniya</Label><Input value={form.returnAirline} onChange={(e) => set('returnAirline', e.target.value)} /></div>
            <div><Label>Reys raqami</Label><Input value={form.returnFlightNumber} onChange={(e) => set('returnFlightNumber', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Jo'nash vaqti</Label><Input type="datetime-local" value={form.returnDepartureTime} onChange={(e) => set('returnDepartureTime', e.target.value)} /></div>
            <div><Label>Kelish vaqti</Label><Input type="datetime-local" value={form.returnArrivalTime} onChange={(e) => set('returnArrivalTime', e.target.value)} /></div>
          </div>
          <Label>PNR (qaytish)</Label>
          <Input value={form.returnPnr} onChange={(e) => set('returnPnr', e.target.value)} />
        </div>
      )}

      {edTab === 'taxi' && (
        <div>
          <div style={row2}>
            <div><Label>Olib ketish manzili</Label><Input value={form.taxiPickupAddress} onChange={(e) => set('taxiPickupAddress', e.target.value)} /></div>
            <div><Label>Tushirish manzili</Label><Input value={form.taxiDropoffAddress} onChange={(e) => set('taxiDropoffAddress', e.target.value)} /></div>
          </div>
          <Label>Olib ketish vaqti</Label>
          <Input type="datetime-local" value={form.taxiPickupTime} onChange={(e) => set('taxiPickupTime', e.target.value)} style={mb} />
          <div style={row2}>
            <div><Label>Haydovchi</Label><Input value={form.taxiDriverName} onChange={(e) => set('taxiDriverName', e.target.value)} /></div>
            <div><Label>Haydovchi telefoni</Label><Input value={form.taxiDriverPhone} onChange={(e) => set('taxiDriverPhone', e.target.value)} /></div>
          </div>
          <Label>Kompaniya</Label>
          <Input value={form.taxiCompany} onChange={(e) => set('taxiCompany', e.target.value)} />
        </div>
      )}

      {edTab === 'insurance' && (
        <div>
          <div style={row2}>
            <div><Label>Sug'urta kompaniyasi</Label><Input value={form.insuranceCompany} onChange={(e) => set('insuranceCompany', e.target.value)} /></div>
            <div><Label>Polis raqami</Label><Input value={form.insurancePolicyNo} onChange={(e) => set('insurancePolicyNo', e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div><Label>Boshlanish sanasi</Label><Input type="date" value={form.insuranceStartDate} onChange={(e) => set('insuranceStartDate', e.target.value)} /></div>
            <div><Label>Tugash sanasi</Label><Input type="date" value={form.insuranceEndDate} onChange={(e) => set('insuranceEndDate', e.target.value)} /></div>
          </div>
          <Label>Qamrov</Label>
          <Textarea value={form.insuranceCoverage} onChange={(e: any) => set('insuranceCoverage', e.target.value)} rows={2} />
        </div>
      )}

      {edTab === 'visa' && (
        <div>
          <div style={row2}>
            <div><Label>Viza statusi</Label><Input value={form.visaStatus} onChange={(e) => set('visaStatus', e.target.value)} placeholder="Topshirildi/Tayyor/Rad etildi" /></div>
            <div><Label>Viza turi</Label><Input value={form.visaType} onChange={(e) => set('visaType', e.target.value)} /></div>
          </div>
          <Label>Viza raqami</Label>
          <Input value={form.visaNumber} onChange={(e) => set('visaNumber', e.target.value)} style={mb} />
          <div style={row2}>
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

function SendInvoiceModal({ booking, onClose, onSent }: any) {
  const [client360, setClient360] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState(0);

  // Klient ma'lumotini va activeConversation ni olish
  useEffect(() => {
    if (!booking?.clientId) { setLoading(false); return; }
    v8Api.getClient360(booking.clientId)
      .then((r: any) => setClient360(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [booking?.clientId]);

  const client = client360?.client || booking?.client;
  const activeConv = client360?.activeConversation;

  // Yakuniy summa (klient ko'radigan)
  const finalAmount = (booking?.totalPrice || 0) - (Number(discount) || 0);

  async function sendViaTelegram() {
    if (!activeConv?.id) {
      toast.error("Klient bilan Telegram suhbati yo'q");
      return;
    }
    setSending(true);
    try {
      await telegramApi.sendInvoice(activeConv.id, {
        bookingId: booking.id,
        salePrice: booking.totalPrice,
        providerCost: booking.supplierCost || 0,
        discount: Number(discount) || 0,
        currency: booking.currency,
        notes,
        dueDate: dueDate || undefined,
      });
      toast.success("✅ Invoice mijozga Telegram orqali yuborildi");
      onSent();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  function openWhatsApp() {
    if (!client?.phone) {
      toast.error("Klientning telefoni yo'q");
      return;
    }
    // Klientga yuboriladigan xabar matnini tayyorlash
    const lines = [
      `🧾 *Hisob-faktura*`,
      `📋 ${booking.bookingRef}`,
      ``,
      `✈️ ${booking.tourName}`,
      `📍 ${booking.destination}`,
    ];
    if (booking.departureDate) {
      lines.push(`📅 ${new Date(booking.departureDate).toLocaleDateString('uz-UZ')}`);
    }
    lines.push(``, `💰 Jami to'lash kerak: *${booking.currency} ${finalAmount.toFixed(2)}*`);
    if (Number(discount) > 0) {
      lines.push(`🎁 Chegirma: ${booking.currency} ${discount}`);
    }
    if (dueDate) {
      lines.push(`⏰ To'lov muddati: ${new Date(dueDate).toLocaleDateString('uz-UZ')}`);
    }
    if (notes) lines.push(``, `📝 ${notes}`);
    lines.push(``, `💳 Naqd / Karta / Payme / Click / Uzum`);

    const text = encodeURIComponent(lines.join('\n'));
    const phone = client.phone.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    toast.success("WhatsApp ochildi");
    onSent();
  }

  if (loading) {
    return (
      <Modal open onClose={onClose} title="📤 Mijozga yuborish">
        <Skeleton height={200} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="📤 Mijozga yuborish" maxWidth={520} footer={
      <Btn variant="secondary" onClick={onClose}>Yopish</Btn>
    }>
      {/* Klient ma'lumoti */}
      <div style={{
        padding: 12, background: 'var(--bg-3)', borderRadius: 10,
        marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{ fontSize: 24 }}>👤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{client?.fullName || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {client?.phone && `📞 ${client.phone}`}
            {client?.telegramUsername && ` • ✈ @${client.telegramUsername}`}
          </div>
        </div>
      </div>

      {/* Invoice ma'lumoti */}
      <div style={{
        padding: 12, background: 'var(--bg-3)', borderRadius: 10,
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          Mijoz ko'radigan ma'lumot
        </div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          ✈️ <b>{booking.tourName}</b>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
          📍 {booking.destination} • {booking.bookingRef}
        </div>
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>JAMI</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
            {booking.currency} {finalAmount.toFixed(2)}
          </span>
        </div>
        {/* Eslatma: profit, supplierCost ko'rinmaydi - klient yuboradigan xabarda */}
      </div>

      {/* Qo'shimcha sozlamalar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <Label>Chegirma (ixtiyoriy)</Label>
          <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0" />
        </div>
        <div>
          <Label>To'lov muddati</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <Label>Izoh (ixtiyoriy)</Label>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Masalan: To'lovni iltimos shu hafta bering" style={{ marginBottom: 14 }} />

      {/* YUBORISH KANALLARI */}
      <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        Kanal tanlang
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Telegram */}
        <button
          onClick={sendViaTelegram}
          disabled={!activeConv || sending}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 14,
            background: activeConv ? 'var(--bg-3)' : 'var(--bg-3)',
            border: '2px solid ' + (activeConv ? '#0088cc' : 'var(--border)'),
            borderRadius: 10, cursor: activeConv ? 'pointer' : 'not-allowed',
            color: 'var(--fg)', textAlign: 'left',
            opacity: activeConv ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 24 }}>✈️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Telegram orqali yuborish</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
              {activeConv
                ? `✓ Klient bilan suhbat ochiq — to'g'ridan-to'g'ri yuboriladi`
                : "❌ Klient bilan Telegram suhbati yo'q"}
            </div>
          </div>
          {sending && <span className="spinner" />}
        </button>

        {/* WhatsApp */}
        <button
          onClick={openWhatsApp}
          disabled={!client?.phone}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 14,
            background: 'var(--bg-3)',
            border: '2px solid ' + (client?.phone ? '#25D366' : 'var(--border)'),
            borderRadius: 10, cursor: client?.phone ? 'pointer' : 'not-allowed',
            color: 'var(--fg)', textAlign: 'left',
            opacity: client?.phone ? 1 : 0.5,
          }}
        >
          <div style={{ fontSize: 24 }}>💚</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>WhatsApp orqali yuborish</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
              {client?.phone
                ? `WhatsApp Web ochiladi, klient: ${client.phone}`
                : "Klientning telefoni yo'q"}
            </div>
          </div>
        </button>

        {/* Manual kopiya */}
        <button
          onClick={() => {
            const text = `🧾 ${booking.bookingRef}\n✈️ ${booking.tourName}\n📍 ${booking.destination}\n💰 ${booking.currency} ${finalAmount.toFixed(2)}`;
            navigator.clipboard.writeText(text);
            toast.success("Klipboardga nusxa olindi");
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 14, background: 'var(--bg-3)',
            border: '2px solid var(--border)', borderRadius: 10,
            cursor: 'pointer', color: 'var(--fg)', textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 24 }}>📋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Matnni nusxa olish</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
              Boshqa ilovaga (SMS, Email, Instagram DM) qo'yish uchun
            </div>
          </div>
        </button>
      </div>

      {/* Klientga nima ko'rinishini eslatish */}
      <div style={{
        marginTop: 14, padding: 10,
        background: 'var(--bg-3)', borderRadius: 8,
        fontSize: 11, color: 'var(--fg-3)',
      }}>
        🔒 <b>Maxfiylik:</b> Klient faqat <b>{booking.currency} {finalAmount.toFixed(2)}</b> ko'radi.
        Provayder tannarxi va sizning foydangiz <b>klientga ko'rinmaydi</b>.
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9-FINAL: TASDIQ SO'RASH MODAL
// Agent chegirma/refund so'raydi → Admin tasdiqlaydi (/approvals'da)
// ═══════════════════════════════════════════════════════════
function RequestApprovalModal({ booking, type, onClose, onSent }: any) {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const typeLabels: Record<string, string> = {
    DISCOUNT: '💰 Chegirma so\'rash',
    REFUND: '↩️ Refund so\'rash',
    PRICE_CHANGE: '💵 Narx o\'zgartirish',
    BOOKING_CANCEL: '❌ Booking bekor qilish',
  };

  async function submit() {
    if (amount <= 0) {
      toast.error("Summa kerak");
      return;
    }
    if (!reason.trim()) {
      toast.error("Sabab yozing");
      return;
    }
    setLoading(true);
    try {
      await approvalsApi.create({
        type,
        entityType: 'BOOKING',
        entityId: booking.id,
        title: `${typeLabels[type]} — ${booking.bookingRef}`,
        reason: reason.trim(),
        amount,
        oldValue: { totalPrice: booking.totalPrice },
        newValue: { discount: amount },
      });
      onSent();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={typeLabels[type] || 'Tasdiq so\'rash'} maxWidth={460} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={submit} loading={loading}>So'rovni yuborish</Btn>
      </>
    }>
      <div style={{
        padding: 10, background: 'var(--bg-3)', borderRadius: 8,
        marginBottom: 12, fontSize: 11, color: 'var(--fg-3)',
      }}>
        💡 So'rov adminga yuboriladi. Tasdiqlangach avtomatik qo'llaniladi.
      </div>

      <div style={{
        padding: 10, background: 'var(--bg-3)', borderRadius: 8,
        marginBottom: 12, fontSize: 12,
      }}>
        <div><b>Booking:</b> {booking.bookingRef}</div>
        <div><b>Tour:</b> {booking.tourName}</div>
        <div><b>Joriy narx:</b> {booking.currency} {booking.totalPrice}</div>
      </div>

      <Label>Summa ({booking.currency}) *</Label>
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value) || 0)}
        placeholder={type === 'DISCOUNT' ? "Chegirma summasi" : "Refund summasi"}
        style={{ marginBottom: 12 }}
      />

      <Label>Sabab *</Label>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Nima uchun shu o'zgarish kerak..."
      />
    </Modal>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────
function DocumentsTab({ bookingId, booking }: any) {
  const [docs, setDocs] = React.useState<any[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    api.get('/uploads?entityType=booking&entityId=' + bookingId)
      .then((r: any) => setDocs(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [bookingId]);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'booking');
      fd.append('entityId', bookingId);
      const r = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs((prev: any[]) => [...prev, r.data]);
      toast.success('Hujjat yuklandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setUploading(false); }
  }

  const ext = (name: string) => name?.split('.').pop()?.toLowerCase() || '';
  const icon = (name: string) => {
    const e = ext(name);
    if (['pdf'].includes(e)) return '📄';
    if (['jpg','jpeg','png','webp'].includes(e)) return '🖼';
    if (['doc','docx'].includes(e)) return '📝';
    if (['xls','xlsx'].includes(e)) return '📊';
    return '📎';
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📎 Hujjatlar</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          >
            {uploading ? 'Yuklanmoqda...' : '+ Fayl biriktirish'}
          </button>
          <input ref={inputRef} type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }} />
        </div>
      </div>

      {/* Booking summary card */}
      {booking && (
        <div style={{ padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 10, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Tur</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{booking.tourName}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Yonalish</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>📍 {booking.destination}</div>
          </div>
          {booking.departureDate && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Sana</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>✈️ {new Date(booking.departureDate).toLocaleDateString('uz-UZ')}</div>
            </div>
          )}
          {booking.adults && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Mehmonlar</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>👥 {booking.adults} katta{booking.children > 0 ? `, ${booking.children} bola` : ''}</div>
            </div>
          )}
          {booking.hotelName && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Mehmonxona</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>🏨 {booking.hotelName} {'⭐'.repeat(booking.hotelStars || 0)}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase' }}>Narx</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>${(booking.totalPrice || 0).toLocaleString()} {booking.currency}</div>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div>Hujjatlar yo'q. PDF, rasm yoki hujjat biriktiing.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((doc: any) => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 24 }}>{icon(doc.originalName || doc.filename || '')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.originalName || doc.filename || 'Fayl'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  {doc.size ? Math.round(doc.size / 1024) + ' KB' : ''} · {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('uz-UZ') : ''}
                </div>
              </div>
              <a
                href={`${doc.url}${doc.url?.includes('?') ? '&' : '?'}token=${typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : ''}`}
                target="_blank" rel="noreferrer"
                style={{ padding: '5px 10px', borderRadius: 7, background: 'var(--primary-soft)', color: 'var(--primary)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                Ko'rish
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Booking Send Menu ────────────────────────────────────────────────────────
function BookingSendMenu({ booking: b }: any) {
  const [sending, setSending] = useState(false);
  const c = b?.client;

  async function send() {
    if (!c?.phone && !c?.telegramUsername) {
      toast.error("Klientda telefon yoki Telegram username yo'q");
      return;
    }
    setSending(true);
    try {
      const { userTelegramApi } = await import('@/services/api');
      const paid = b.paidAmount || 0;
      const debt = (b.totalPrice || 0) - paid;

      const lines = [
        '✈️ *BOOKING TASDIQLANDI!*',
        '',
        c?.fullName ? `Hurmatli *${c.fullName}*,` : null,
        'Sizning buyurtmangiz qabul qilindi:',
        '',
        '📋 *Booking tafsilotlari:*',
        b.bookingRef ? `• Ref: \`${b.bookingRef}\`` : null,
        b.tourName   ? `• Tur: ${b.tourName}` : null,
        b.destination ? `• Yo\'nalish: 📍${b.destination}` : null,
        b.tourType   ? `• Tur turi: ${b.tourType}` : null,
        '',
        (b.adults || b.children) ? '👥 *Yo\'lovchilar:*' : null,
        b.adults   ? `• ${b.adults} ta katta` : null,
        b.children ? `• ${b.children} ta bola` : null,
        b.adults || b.children ? '' : null,
        b.departureDate ? `📅 *Ketish:* ${new Date(b.departureDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : null,
        b.returnDate    ? `🔙 *Qaytish:* ${new Date(b.returnDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : null,
        '',
        '💰 *To\'lov ma\'lumotlari:*',
        `• Jami narx: *${b.currency || 'USD'} ${Number(b.totalPrice || 0).toLocaleString()}*`,
        paid > 0 ? `• To\'langan: ${b.currency || 'USD'} ${Number(paid).toLocaleString()}` : null,
        debt > 0 ? `• Qoldi: *${b.currency || 'USD'} ${Number(debt).toLocaleString()}*` : `• ✅ To\'liq to\'langan`,
        '',
        '📞 Savollar uchun biz bilan bog\'laning!',
        '_Omon Travel Agency_',
      ].filter((l: any) => l !== null).join('\n');

      await userTelegramApi.sendMessage({
        phone: c?.phone || undefined,
        username: c?.telegramUsername || undefined,
        text: lines,
        clientId: b.clientId,
      });
      toast.success('✅ Booking ma\'lumotlari yuborildi!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Yuborib bo\'lmadi');
    } finally { setSending(false); }
  }

  return (
    <button onClick={send} disabled={sending} style={{
      padding: '7px 14px', borderRadius: 8, border: 'none',
      background: 'linear-gradient(135deg, var(--primary), #a855f7)',
      color: '#fff', cursor: sending ? 'not-allowed' : 'pointer',
      fontWeight: 700, fontSize: 12, opacity: sending ? 0.7 : 1,
    }}>
      {sending ? '⏳ Yuborilmoqda...' : '📤 Mijozga yuborish'}
    </button>
  );
}