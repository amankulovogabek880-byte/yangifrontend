'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { v8Api, clientsApi, tasksApi, followUpsApi, telegramApi, bookingsApi, userTelegramApi, api } from '@/services/api';
import { Card, Btn, Badge, Skeleton, Avatar, Textarea, Label, Modal, Input, Select, Empty } from '@/components/ui';
import { useDialer } from '@/lib/dialer';
import { useAuth } from '@/lib/store';
import { fmtDate, fmtDateTime, fmtMoney, timeAgo, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';

const TIER_COLORS: Record<string, string> = {
  VIP: '#a855f7', GOLD: '#f59e0b', SILVER: '#94a3b8', REGULAR: 'var(--fg-3)',
};

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: 'var(--info)', CONTACTED: '#0891b2', INTERESTED: '#3b82f6',
  OFFER_SENT: '#8b5cf6', NEGOTIATION: '#a855f7', DEPOSIT_PAID: '#ec4899',
  CONFIRMED: '#10b981', TRAVELING: '#06b6d4',
  COMPLETED: 'var(--success)', LOST: 'var(--danger)',
};

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'Yangi', CONTACTED: 'Aloqa qilingan', INTERESTED: 'Qiziqayapti',
  OFFER_SENT: 'Taklif yuborildi', NEGOTIATION: 'Muzokara',
  DEPOSIT_PAID: 'Avans to\'landi', CONFIRMED: 'Tasdiqlandi',
  TRAVELING: 'Sayohatda', COMPLETED: 'Tugadi', LOST: 'Yo\'qotildi',
};

const TIMELINE_ICONS: Record<string, string> = {
  created: '👤', call: '📞', message: '💬', booking: '✈️',
  payment: '💰', stage_change: '🔄', note: '📝', task: '☑',
  document: '📄', invoice: '🧾',
};

const TABS = [
  { id: 'overview',  label: '📋 Umumiy' },
  { id: 'chat',      label: '💬 Chat' },
  { id: 'offers',    label: '📨 Takliflar' },
  { id: 'timeline',  label: '🕐 Tarix' },
  { id: 'bookings',  label: '✈️ Bookinglar' },
  { id: 'payments',  label: '💳 To\'lovlar & Invoice' },
  { id: 'tasks',     label: '☑ Vazifalar' },
  { id: 'notes',     label: '📝 Izohlar' },
  { id: 'documents', label: '📁 Hujjatlar' },
];

export default function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { callClient } = useDialer();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showNote, setShowNote] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [showOfferCreate, setShowOfferCreate] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showPersonalMsg, setShowPersonalMsg] = useState(false);
  const [editingTravel, setEditingTravel] = useState(false);
  const [travelForm, setTravelForm] = useState<any>({});
  const [showEditClient, setShowEditClient] = useState(false);

  const isAdmin = user?.role !== 'AGENT';

  const load = () => {
    setLoading(true);
    v8Api.getClient360(id)
      .then((r) => setData(r.data))
      .then(() => {
        // Load offers separately (persist across tab changes)
        api.get('/offers/client/' + id)
          .then((or: any) => setOffers(Array.isArray(or.data) ? or.data : []))
          .catch(() => {});
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  async function openInbox() {
    if (!data?.activeConversation?.id) {
      toast.error("Klient bilan hali suhbat yo'q");
      return;
    }
    router.push(`/inbox?conv=${data.activeConversation.id}`);
  }

  if (loading) return <CrmLayout><div style={{ padding: 24 }}><Skeleton height={400} /></div></CrmLayout>;
  if (!data?.client) return <CrmLayout><div style={{ padding: 24 }}>Klient topilmadi</div></CrmLayout>;

  const c = data.client;
  const f = data.financial || {};

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
          <Avatar name={c.fullName} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, cursor: 'pointer' }} onClick={() => router.push('/clients')}>
              ← Klientlar
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{c.fullName}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <Badge color={TIER_COLORS[c.tier]}>{c.tier}</Badge>
              <Badge color={STAGE_COLORS[c.pipelineStage]}>{STAGE_LABELS[c.pipelineStage] || c.pipelineStage}</Badge>
              {c.source && <Badge color="var(--info)">{c.source}</Badge>}
              {(c.tags || []).map((t: string) => (
                <Badge key={t} color="var(--fg-3)">#{t}</Badge>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap' }}>
              {c.phone && <span>📞 {c.phone}</span>}
              {c.email && <span>✉ {c.email}</span>}
              {c.telegramUsername && <span>✈ @{c.telegramUsername}</span>}
              {c.country && <span>🌍 {c.country}</span>}
              {c.assignedAgent && <span>👤 {c.assignedAgent.name}</span>}
            </div>
          </div>
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {c.phone && (
            <Btn variant="gradient" icon="📞" onClick={() => callClient(c.id, c.fullName, c.phone)}>
              Qo'ng'iroq
            </Btn>
          )}
          {data.activeConversation && (
            <Btn variant="primary" icon="💬" onClick={openInbox}>
              Suhbatga o'tish
            </Btn>
          )}
          {c.telegramUsername && (
            <Btn variant="secondary" icon="✈" onClick={() => window.open(`https://t.me/${c.telegramUsername}`, '_blank')}>
              Telegram
            </Btn>
          )}
          {c.phone && (
            <Btn variant="secondary" icon="💚" onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`, '_blank')}>
              WhatsApp
            </Btn>
          )}
          <Btn variant="secondary" icon="📋" onClick={() => setShowBooking(true)}>
            Yangi booking
          </Btn>
          <Btn variant="ghost" icon="✏" onClick={() => setShowEditClient(true)}>
            Tahrirlash
          </Btn>
        </div>

        {/* ═══ FINANCIAL SUMMARY (admin only) ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Jami xarid</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(f.totalSpent || 0)}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{f.bookingsCount || 0} ta booking</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>To'langan</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{fmtMoney(f.totalPaid || 0)}</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Qoldi</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: (f.balance || 0) > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {fmtMoney(f.balance || 0)}
            </div>
          </Card>
          {isAdmin && (
            <Card style={{ padding: 14, borderLeft: '3px solid var(--warning)' }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Foyda 🔒</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{fmtMoney(f.totalProfit || 0)}</div>
            </Card>
          )}
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map((tt) => (
            <button key={tt.id} onClick={() => setTab(tt.id)} style={{
              background: 'none', border: 'none', padding: '10px 14px',
              color: tab === tt.id ? 'var(--primary)' : 'var(--fg-2)',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === tt.id ? 600 : 500,
              borderBottom: '2px solid ' + (tab === tt.id ? 'var(--primary)' : 'transparent'),
              marginBottom: -1, whiteSpace: 'nowrap',
            }}>
              {tt.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB CONTENT ═══ */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>👤 Mijoz ma'lumotlari</h3>
              <Info label="To'liq ism" value={c.fullName} />
              <Info label="Telefon" value={c.phone} />
              <Info label="Telefon 2" value={c.phone2} />
              <Info label="Email" value={c.email} />
              <Info label="Telegram" value={c.telegramUsername && `@${c.telegramUsername}`} />
              <Info label="Tug'ilgan sana" value={c.dateOfBirth && fmtDate(c.dateOfBirth)} />
              <Info label="Jinsi" value={c.gender} />
              <Info label="Davlat" value={c.country} />
              <Info label="Shahar" value={c.city} />
              <Info label="Manzil" value={c.address} />
            </Card>

            {(c.passportNo || c.passportExpiry) && (
              <Card>
                <h3 style={{ marginTop: 0, fontSize: 14 }}>📕 Passport</h3>
                <Info label="Raqami" value={c.passportNo} mono />
                <Info label="Beruvchi davlat" value={c.passportCountry} />
                <Info label="Amal qilish muddati" value={c.passportExpiry && fmtDate(c.passportExpiry)} />
                <Info label="Millati" value={c.nationality} />
              </Card>
            )}

            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>📊 CRM ma'lumoti</h3>
              
              {/* Lead Score - Enhanced */}
              <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>🎯 Lead Score</span>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                    background: c.leadScore >= 80 ? '#ef444420' : c.leadScore >= 50 ? '#eab30820' : '#0ea5e920',
                    color: c.leadScore >= 80 ? '#ef4444' : c.leadScore >= 50 ? '#eab308' : '#0ea5e9',
                  }}>
                    {c.leadScore >= 80 ? '🔥 ISSIQ' : c.leadScore >= 50 ? '⚡ O\'RTA' : '❄️ SOVUQ'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${c.leadScore || 0}%`,
                      background: c.leadScore >= 80 ? '#ef4444' : c.leadScore >= 50 ? '#eab308' : '#0ea5e9',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 30 }}>{c.leadScore || 0}</span>
                </div>
              </div>

              <Info label="Yaratilgan" value={fmtDateTime(c.createdAt)} />
              <Info label="Bosqichdan beri" value={c.pipelineStageAt && timeAgo(c.pipelineStageAt)} />
              <Info label="Tayinlangan agent" value={c.assignedAgent?.name} />
              <Info label="Manba" value={c.source} />
              {c.utmSource && <Info label="UTM Source" value={c.utmSource} />}
            </Card>

            {/* ✈️ Travel Info Card */}
            <Card style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>✈️ Sayohat ma'lumotlari</h3>
                <button onClick={() => { setTravelForm({ travelDestination: c.travelDestination || '', travelPax: c.travelPax || 1, travelDepartDate: c.travelDepartDate ? c.travelDepartDate.slice(0, 10) : '', travelReturnDate: c.travelReturnDate ? c.travelReturnDate.slice(0, 10) : '', hotelName: c.hotelPreference?.name || '', hotelStars: c.hotelPreference?.stars || '', hotelLocation: c.hotelPreference?.location || '', breakfast: c.hotelPreference?.breakfast || false }); setEditingTravel(true); }} style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-2)' }}>✏️ Tahrirlash</button>
              </div>
              {!editingTravel ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
                  {c.travelDestination && <Info label="📍 Yo'nalish" value={c.travelDestination} />}
                  {c.travelPax > 1 && <Info label="👥 Sayohatchilar" value={`${c.travelPax} kishi`} />}
                  {c.travelDepartDate && <Info label="🛫 Jo'nab ketish" value={fmtDate(c.travelDepartDate)} />}
                  {c.travelReturnDate && <Info label="🛬 Qaytish" value={fmtDate(c.travelReturnDate)} />}
                  {c.hotelPreference?.name && <Info label="🏨 Mehmonxona" value={`${c.hotelPreference.name} ${'⭐'.repeat(c.hotelPreference.stars || 0)}`} />}
                  {c.hotelPreference?.location && <Info label="📍 Joylashuv" value={c.hotelPreference.location} />}
                  {c.hotelPreference?.breakfast && <Info label="🍳 Nonushta" value="Kiradi" />}
                  {!c.travelDestination && !c.travelDepartDate && <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Sayohat ma'lumotlari kiritilmagan</span>}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Yo\'nalish', 'travelDestination', 'text', ''],
                    ['Kishi soni', 'travelPax', 'number', ''],
                    ['Jo\'nab ketish', 'travelDepartDate', 'date', ''],
                    ['Qaytish', 'travelReturnDate', 'date', ''],
                    ['Mehmonxona nomi', 'hotelName', 'text', ''],
                    ['Mehmonxona yulduzlar', 'hotelStars', 'number', ''],
                    ['Joylashuv', 'hotelLocation', 'text', ''],
                  ].map(([lbl, key, type]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 4 }}>{lbl}</div>
                      <input type={type} value={travelForm[key] || ''} onChange={e => setTravelForm((f: any) => ({...f, [key]: e.target.value}))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={travelForm.breakfast || false} onChange={e => setTravelForm((f: any) => ({...f, breakfast: e.target.checked}))} />
                    <span style={{ fontSize: 13 }}>Nonushta kiradi</span>
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingTravel(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 13 }}>Bekor</button>
                    <button onClick={async () => {
                      try {
                        await clientsApi.update(id, {
                          travelDestination: travelForm.travelDestination || null,
                          travelPax: parseInt(travelForm.travelPax) || 1,
                          travelDepartDate: travelForm.travelDepartDate || null,
                          travelReturnDate: travelForm.travelReturnDate || null,
                          hotelPreference: { name: travelForm.hotelName, stars: parseInt(travelForm.hotelStars) || null, location: travelForm.hotelLocation, breakfast: travelForm.breakfast },
                        });
                        toast.success('Saqlandi'); setEditingTravel(false); load();
                      } catch (e: any) { toast.error(errMsg(e)); }
                    }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Saqlash</button>
                  </div>
                </div>
              )}
            </Card>

            {c.notes && (
              <Card style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ marginTop: 0, fontSize: 14 }}>📝 Asosiy izoh</h3>
                <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.notes}</p>
              </Card>
            )}

            {c.internalNotes && (
              <Card style={{ gridColumn: '1 / -1', borderLeft: '3px solid var(--warning)' }}>
                <h3 style={{ marginTop: 0, fontSize: 14 }}>🔒 Ichki izoh (faqat xodimlar)</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>{c.internalNotes}</p>
              </Card>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <Card>
            {!c.timeline?.length ? (
              <Empty title="Hali harakatlar yo'q" icon="🕐" />
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 18, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
                {c.timeline.map((t: any, i: number) => (
                  <div key={t.id} style={{ display: 'flex', gap: 14, marginBottom: 14, position: 'relative' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'var(--bg-3)', border: '2px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0, zIndex: 1,
                    }}>
                      {TIMELINE_ICONS[t.type] || '•'}
                    </div>
                    <div style={{ flex: 1, paddingTop: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{t.description}</div>}
                      <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 4 }}>{timeAgo(t.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'bookings' && (
          <>
            {!c.bookings?.length ? (
              <Empty title="Bookinglar yo'q" icon="✈️" action={
                <Btn onClick={() => setShowBooking(true)}>+ Yangi booking</Btn>
              } />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.bookings.map((b: any) => (
                  <Card key={b.id} hover style={{ cursor: 'pointer' }} onClick={() => router.push(`/bookings/${b.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-3)' }}>{b.bookingRef}</span>
                          <Badge color="var(--info)">{b.status}</Badge>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{b.tourName}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                          📍 {b.destination}
                          {b.departureDate && ` • ${fmtDate(b.departureDate)}`}
                          {b.returnDate && ` → ${fmtDate(b.returnDate)}`}
                          {b.adults > 0 && ` • ${b.adults}+${b.children || 0}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{b.currency} {b.totalPrice}</div>
                        {isAdmin && b.profit > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                            Foyda: {fmtMoney(b.profit)}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--info)', marginTop: 2 }}>
                          To'langan: {b.currency} {b.paidAmount || 0}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'payments' && (
          <ClientPaymentsInvoiceTab client={c} bookings={c.bookings || []} onRefresh={load} />
        )}
        {tab === '__payments_old__' && (  /* also shows invoices */
          <Card>
            {(() => {
              const allPayments = (c.bookings || []).flatMap((b: any) =>
                (b.payments || []).map((p: any) => ({ ...p, bookingRef: b.bookingRef }))
              );
              if (!allPayments.length) return <Empty title="To'lovlar yo'q" icon="💰" />;
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                      <th style={{ padding: 8, textAlign: 'left' }}>Sana</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Booking</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Usul</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((p: any) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                        <td style={{ padding: 10 }}>{p.paidAt && fmtDate(p.paidAt)}</td>
                        <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{p.bookingRef}</td>
                        <td style={{ padding: 10 }}>{p.method}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                          {p.currency} {p.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </Card>
        )}

        {/* CHAT TAB */}
        {tab === 'chat' && (
          <ClientChatTab
            conversation={data?.activeConversation}
            msgs={chatMsgs}
            setMsgs={setChatMsgs}
            draft={chatDraft}
            setDraft={setChatDraft}
            loading={chatLoading}
            setLoading={setChatLoading}
          />
        )}

        {/* OFFERS TAB */}
        {tab === 'offers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📨 Takliflar</h3>
              <button onClick={() => setShowOfferCreate(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Yangi taklif</button>
            </div>
            {offers.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Hali taklif yuborilmagan</div>}
            {offers.map((o: any) => (
              <div key={o.id} style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{o.tourName}</div>
                    {o.destination && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>📍 {o.destination}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 700, background: o.status === 'SENT' ? '#3d7eff20' : '#94a3b820', color: o.status === 'SENT' ? '#3d7eff' : '#94a3b8' }}>{o.status}</span>
                    {o.status === 'DRAFT' && (
                      <OfferSendMenu offerId={o.id} clientId={id} clientPhone={(data as any)?.phone}
                        clientUsername={(data as any)?.telegramUsername}
                        onSent={() => setOffers((prev: any[]) => prev.map((x: any) => x.id === o.id ? { ...x, status: 'SENT' } : x))}
                      />
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Operator narxi</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>${(o.actualPrice || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Markup</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>+${(o.markup || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Mijozga narx</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>${(o.clientPrice || o.actualPrice + o.markup || 0).toLocaleString()}</div>
                  </div>
                </div>
                {[o.departDate && `✈️ ${fmtDate(o.departDate)}`, o.pax > 1 && `👥 ${o.pax} kishi`, o.hotelName && `🏨 ${o.hotelName}${'⭐'.repeat(o.hotelStars||0)}`].filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {[o.departDate && `✈️ ${fmtDate(o.departDate)}`, o.pax > 1 && `👥 ${o.pax} kishi`, o.hotelName && `🏨 ${o.hotelName}`].filter(Boolean).map((t: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-3)' }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {showOfferCreate && <OfferCreateModal clientId={id} onClose={() => setShowOfferCreate(false)} onSaved={(o: any) => { setOffers((prev: any[]) => [o, ...prev]); setShowOfferCreate(false); }} />}
          </div>
        )}

        {tab === 'invoices' && (
          <Card>
            {!data.invoices?.length ? <Empty title="Invoicelar yo'q" icon="🧾" /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>#</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Sana</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Sotuv</th>
                    {isAdmin && <th style={{ padding: 8, textAlign: 'right' }}>Foyda</th>}
                    <th style={{ padding: 8, textAlign: 'right' }}>To'langan</th>
                    <th style={{ padding: 8, textAlign: 'center' }}>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv: any) => (
                    <tr key={inv.id} style={{ borderTop: '1px solid var(--border-2)', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: 10 }}>{fmtDate(inv.createdAt)}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>{inv.currency} {inv.salePrice}</td>
                      {isAdmin && <td style={{ padding: 10, textAlign: 'right', color: 'var(--success)' }}>{inv.currency} {inv.profit || 0}</td>}
                      <td style={{ padding: 10, textAlign: 'right', color: 'var(--info)' }}>{inv.currency} {inv.paidAmount || 0}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}><Badge color="var(--info)">{inv.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'tasks' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>☑ Vazifalar va eslatmalar</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn size="sm" variant="secondary" onClick={() => setShowFollowUp(true)}>+ Eslatma</Btn>
                <Btn size="sm" onClick={() => setShowTask(true)}>+ Vazifa</Btn>
              </div>
            </div>

            <h4 style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 14 }}>FAOL VAZIFALAR ({data.tasks?.length || 0})</h4>
            {!data.tasks?.length ? <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Faol vazifa yo'q</p> : (
              <div>
                {data.tasks.map((t: any) => (
                  <div key={t.id} style={{
                    padding: 12, background: 'var(--bg-3)', borderRadius: 8, marginBottom: 8,
                    borderLeft: `3px solid ${t.priority === 'HIGH' || t.priority === 'URGENT' ? 'var(--danger)' : 'var(--warning)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <Badge color="var(--info)">{t.status}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                      {t.assignee?.name} • {t.dueAt && fmtDateTime(t.dueAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 14 }}>ESLATMALAR ({data.followUps?.length || 0})</h4>
            {!data.followUps?.length ? <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Eslatmalar yo'q</p> : (
              <div>
                {data.followUps.map((f: any) => (
                  <div key={f.id} style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                      ⏰ {fmtDateTime(f.dueAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'notes' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>📝 Izohlar</h3>
              <Btn size="sm" onClick={() => setShowNote(true)}>+ Izoh qo'shish</Btn>
            </div>
            {c.notes && (
              <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, marginBottom: 10 }}>
                <Label>Asosiy izoh</Label>
                <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.notes}</p>
              </div>
            )}
            {c.internalNotes && (
              <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, borderLeft: '3px solid var(--warning)' }}>
                <Label>🔒 Ichki izoh (faqat xodimlarga)</Label>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>{c.internalNotes}</p>
              </div>
            )}
            {!c.notes && !c.internalNotes && <Empty title="Izohlar yo'q" icon="📝" />}
          </Card>
        )}

        {tab === 'documents' && (
          <ClientDocumentsTab clientId={c.id} initialDocs={data.documents || []} onUploaded={load} />
        )}
      </div>

      {showNote && <NoteModal clientId={c.id} current={c} onClose={() => setShowNote(false)} onSaved={() => { setShowNote(false); load(); }} />}
      {showTask && <TaskModal clientId={c.id} onClose={() => setShowTask(false)} onSaved={() => { setShowTask(false); load(); }} />}
      {showFollowUp && <FollowUpModal clientId={c.id} onClose={() => setShowFollowUp(false)} onSaved={() => { setShowFollowUp(false); load(); }} />}
      {showPersonalMsg && (
        <ClientPersonalMsgModal
          client={c}
          onClose={() => setShowPersonalMsg(false)}
          onSent={() => { setShowPersonalMsg(false); toast.success('Xabar yuborildi!'); }}
        />
      )}
      {showBooking && (
        <InlineBookingModal
          clientId={id}
          clientName={c.fullName}
          onClose={() => setShowBooking(false)}
          onSaved={(bookingData?: any) => {
            setShowBooking(false);
            load();
            toast.success('Booking yaratildi!');
          }}
        />
      )}
      {showEditClient && (
        <EditClientModal
          client={c}
          onClose={() => setShowEditClient(false)}
          onSaved={() => { setShowEditClient(false); load(); toast.success('Mijoz ma\'lumotlari yangilandi'); }}
        />
      )}
    </CrmLayout>
  );
}

// ─── Mijoz ma'lumotlarini tahrirlash modali ───────────────────────────
function EditClientModal({ client, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    fullName: client.fullName || '',
    phone: client.phone || '',
    phone2: client.phone2 || '',
    email: client.email || '',
    telegramUsername: client.telegramUsername || '',
    tier: client.tier || 'REGULAR',
    source: client.source || 'OTHER',
    country: client.country || '',
    city: client.city || '',
    notes: client.notes || '',
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error("Ism va telefon raqam to'ldirilishi shart");
      return;
    }
    setSaving(true);
    try {
      await clientsApi.update(client.id, form);
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 9,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' as const,
  };

  return (
    <Modal open onClose={onClose} title="✏ Mijoz ma'lumotlarini tahrirlash" maxWidth={520} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} disabled={saving}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</Btn>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label>To'liq ism *</Label>
          <input style={inputStyle} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Telefon *</Label>
            <input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+998901234567" />
          </div>
          <div>
            <Label>Qo'shimcha telefon</Label>
            <input style={inputStyle} value={form.phone2} onChange={(e) => set('phone2', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Email</Label>
            <input style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} type="email" />
          </div>
          <div>
            <Label>Telegram username</Label>
            <input style={inputStyle} value={form.telegramUsername} onChange={(e) => set('telegramUsername', e.target.value)} placeholder="@username" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Daraja</Label>
            <select style={inputStyle} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
              <option value="REGULAR">Regular</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
          <div>
            <Label>Manba</Label>
            <select style={inputStyle} value={form.source} onChange={(e) => set('source', e.target.value)}>
              <option value="TELEGRAM">Telegram</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="REFERRAL">Referral</option>
              <option value="WALKIN">Walk-in</option>
              <option value="WEBSITE">Website</option>
              <option value="CALL">Call</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="GOOGLE_ADS">Google Ads</option>
              <option value="OTHER">Boshqa</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Davlat</Label>
            <input style={inputStyle} value={form.country} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div>
            <Label>Shahar</Label>
            <input style={inputStyle} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Izoh</Label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  );
}

function NoteModal({ clientId, current, onClose, onSaved }: any) {
  const [notes, setNotes] = useState(current.notes || '');
  const [internalNotes, setInternalNotes] = useState(current.internalNotes || '');
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    try {
      await clientsApi.update(clientId, { notes, internalNotes });
      toast.success('Saqlandi');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }
  return (
    <Modal open onClose={onClose} title="📝 Izohlar" maxWidth={520} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn onClick={save} loading={loading}>Saqlash</Btn>
      </>
    }>
      <Label>Asosiy izoh (klient ham ko'rishi mumkin)</Label>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ marginBottom: 12 }} />
      <Label>🔒 Ichki izoh (faqat xodimlar ko'radi)</Label>
      <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} />
    </Modal>
  );
}

function TaskModal({ clientId, onClose, onSaved }: any) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueAt: '' });
  const [loading, setLoading] = useState(false);
  async function save() {
    if (!form.title.trim()) return toast.error('Sarlavha kerak');
    setLoading(true);
    try {
      await tasksApi.create({ ...form, clientId, dueAt: form.dueAt || undefined });
      toast.success('Vazifa yaratildi');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }
  return (
    <Modal open onClose={onClose} title="☑ Yangi vazifa" footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn onClick={save} loading={loading}>Yaratish</Btn>
      </>
    }>
      <Label>Sarlavha *</Label>
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ marginBottom: 12 }} />
      <Label>Tavsif</Label>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <Label>Prioritet</Label>
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="LOW">Past</option>
            <option value="MEDIUM">O'rta</option>
            <option value="HIGH">Yuqori</option>
            <option value="URGENT">Shoshilinch</option>
          </Select>
        </div>
        <div>
          <Label>Muddat</Label>
          <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function FollowUpModal({ clientId, onClose, onSaved }: any) {
  const [form, setForm] = useState({ title: '', note: '', dueAt: '' });
  const [loading, setLoading] = useState(false);
  async function save() {
    if (!form.title.trim() || !form.dueAt) return toast.error('Sarlavha va sana kerak');
    setLoading(true);
    try {
      await followUpsApi.create({ ...form, clientId });
      toast.success('Eslatma qo\'shildi');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }
  return (
    <Modal open onClose={onClose} title="⏰ Eslatma qo'shish" footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn onClick={save} loading={loading}>Qo'shish</Btn>
      </>
    }>
      <Label>Sarlavha *</Label>
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Masalan: Klientga qaytadan qo'ng'iroq qilish" style={{ marginBottom: 12 }} />
      <Label>Izoh</Label>
      <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} style={{ marginBottom: 12 }} />
      <Label>Qachon *</Label>
      <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
    </Modal>
  );
}

// ─── Inline Chat Component ────────────────────────────────────────────────────
function ClientChatTab({ conversation, msgs, setMsgs, draft, setDraft, loading, setLoading, onStartChat }: any) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversation?.id) return;
    setLoading(true);
    telegramApi.messages(conversation.id)
      .then((r: any) => setMsgs(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversation?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const text = draft.trim();
    if (!text || !conversation?.id) return;
    setDraft('');
    // Optimistic update - show immediately
    const tmpId = 'tmp-' + Date.now();
    setMsgs((m: any[]) => [...m, {
      id: tmpId, text, direction: 'OUTBOUND',
      createdAt: new Date().toISOString(),
      isDelivered: false,
      _source: conversation.isPersonal ? 'personal' : 'bot',
    }]);
    try {
      if (conversation.isPersonal) {
        await userTelegramApi.sendMessage({
          userId: conversation.externalChatId,
          text,
          clientId: conversation.clientId || undefined,
        });
      } else {
        await telegramApi.sendMessage(conversation.id, text);
      }
      // Mark as delivered
      setMsgs((m: any[]) => m.map((msg: any) =>
        msg.id === tmpId ? { ...msg, isDelivered: true } : msg
      ));
    } catch (e: any) {
      // Remove failed msg and restore draft
      setMsgs((m: any[]) => m.filter((msg: any) => msg.id !== tmpId));
      setDraft(text);
      toast.error('Yuborib bolmadi: ' + (e?.response?.data?.message || e?.message || 'Server xatosi'));
    }
  }

  if (!conversation) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)' }}>Suhbat yo'q</div>
        <div style={{ fontSize: 12, marginTop: 6, marginBottom: 16 }}>
          Shaxsiy Telegram accountingiz orqali birinchi xabarni yuboring
        </div>
        {onStartChat && (
          <button onClick={onStartChat} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--gradient)', color: 'white',
            cursor: 'pointer', fontWeight: 700, fontSize: 13,
          }}>
            📱 Birinchi xabar yuborish
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 500, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>}
        {!loading && msgs.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>Xabarlar yo'q</div>}
        {msgs.map((m: any, i: number) => {
          const isOut = m.direction === 'OUTBOUND' || m.direction === 'outbound';
          return (
            <div key={m.id || i} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: isOut ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isOut ? '#3d7eff' : 'var(--bg-3)', color: isOut ? 'white' : 'var(--fg)', fontSize: 13 }}>
                {isOut && (
                  <div style={{ fontSize: 9, opacity: 0.7, marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                    {m._source === 'personal' ? '📱 Shaxsiy' : '🤖 Bot'}
                    {m.isDelivered === false && <span style={{ opacity: 0.6 }}>⏳</span>}
                    {m.isDelivered === true && <span>✓</span>}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text || m.caption}</div>
                <div style={{ fontSize: 9, opacity: 0.6, textAlign: 'right', marginTop: 3 }}>
                  {new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  {isOut && ' ✓'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Xabar yozing... (Enter — yuborish)"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, resize: 'none', minHeight: 38, maxHeight: 100 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} style={{ padding: '8px 16px', background: '#3d7eff', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>→</button>
      </div>
    </div>
  );
}

// ─── Offer Create Modal ───────────────────────────────────────────────────────
function OfferCreateModal({ clientId, onClose, onSaved }: any) {
  const { user } = useAuth();
  const [f, setF] = useState({ tourName: '', destination: '', pax: 1, departDate: '', returnDate: '', actualPrice: '', markup: '0', currency: 'USD', hotelName: '', hotelStars: '', includesVisa: false, includesFlight: true, includesHotel: true, notes: '' });
  const [saving, setSaving] = useState(false);
  const [sendNow, setSendNow] = useState(false);
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const clientPrice = (parseFloat(f.actualPrice) || 0) + (parseFloat(f.markup) || 0);

  const inp: any = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' };
  const lbl: any = { fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 };
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };

  async function save() {
    if (!f.tourName.trim() || !f.actualPrice) { toast.error('Tur nomi va narx kerak'); return; }
    setSaving(true);
    try {
      const { api } = await import('@/services/api') as any;
      const data = { clientId, ...f, actualPrice: parseFloat(f.actualPrice), markup: parseFloat(f.markup) || 0, clientPrice, pax: parseInt(String(f.pax)) || 1, hotelStars: f.hotelStars ? parseInt(f.hotelStars) : null };
      const r = await api.post('/offers', data);
      if (sendNow) await api.post(`/offers/${r.data.id}/send`);
      toast.success(sendNow ? 'Taklif yuborildi!' : 'Taklif saqlandi');
      onSaved(r.data);
    } catch (e: any) { toast.error(errMsg(e)); setSaving(false); }
  }

  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>📨 Yangi taklif</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Tur nomi *</label><input style={inp} value={f.tourName} onChange={e => set('tourName', e.target.value)} placeholder="Turkiya — Antalya 7 kun" /></div>
          <div><label style={lbl}>Yo'nalish</label><input style={inp} value={f.destination} onChange={e => set('destination', e.target.value)} /></div>
          <div><label style={lbl}>Kishi soni</label><input type="number" min={1} style={inp} value={f.pax} onChange={e => set('pax', e.target.value)} /></div>
          <div><label style={lbl}>Jo'nab ketish</label><input type="date" style={inp} value={f.departDate} onChange={e => set('departDate', e.target.value)} /></div>
          <div><label style={lbl}>Qaytish</label><input type="date" style={inp} value={f.returnDate} onChange={e => set('returnDate', e.target.value)} /></div>
          {/* Pricing */}
          <OfferPricingBox f={f} set={set} inp={inp} lbl={lbl} clientPrice={clientPrice} />
          <div><label style={lbl}>Mehmonxona</label><input style={inp} value={f.hotelName} onChange={e => set('hotelName', e.target.value)} /></div>
          <div><label style={lbl}>Yulduzlar</label>
            <select style={inp} value={f.hotelStars} onChange={e => set('hotelStars', e.target.value)}>
              <option value="">—</option>
              {[3,4,5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[['includesFlight','✈️ Parvoz'],['includesHotel','🏨 Mehmonxona'],['includesVisa','🛂 Viza']].map(([k,l]) => (
              <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={(f as any)[k]} onChange={e => set(k, e.target.checked)} /> {l}
              </label>
            ))}
          </div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Izoh</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} /> Darhol yuborish
            </label>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>Bekor</button>
            <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{saving ? '...' : sendNow ? '✉️ Yuborish' : '💾 Saqlash'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Booking Modal (client detail ichida) ──────────────────────────────
function InlineBookingModal({ clientId, clientName, onClose, onSaved }: any) {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';
  const [form, setForm] = useState<any>({
    clientId,
    tourName: '', destination: '', tourType: 'PACKAGE',
    adults: 1, children: 0,
    totalPrice: '', supplierCost: '', discount: 0,
    currency: 'USD', departureDate: '', returnDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const totalPrice = Number(form.totalPrice) || 0;
  const supplierCost = Number(form.supplierCost) || 0;
  const discount = Number(form.discount) || 0;
  const profit = Math.max(0, totalPrice - supplierCost - discount);

  async function save() {
    if (!form.tourName.trim() || !form.destination.trim() || !form.totalPrice) {
      toast.error('Tur nomi, yo\'nalish va narx kerak');
      return;
    }
    setSaving(true);
    try {
      await bookingsApi.create({
        ...form,
        totalPrice: Number(form.totalPrice),
        supplierCost: Number(form.supplierCost) || 0,
        discount: Number(form.discount) || 0,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
      });
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const inp: any = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' };
  const lbl: any = { fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 5 };
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.35)' };

  return (
    <div style={S}>
      <div style={W}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>✈️ Yangi booking</h2>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>👤 {clientName}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Tur nomi *</label>
            <input style={inp} value={form.tourName} onChange={e => set('tourName', e.target.value)} placeholder="Masalan: Dubay 7 kunlik" />
          </div>
          <div>
            <label style={lbl}>Yo'nalish *</label>
            <input style={inp} value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="Dubay, UAE" />
          </div>
          <div>
            <label style={lbl}>Tur turi</label>
            <select style={inp} value={form.tourType} onChange={e => set('tourType', e.target.value)}>
              <option value="PACKAGE">Paket</option>
              <option value="FLIGHT_ONLY">Faqat parvoz</option>
              <option value="HOTEL_ONLY">Faqat mehmonxona</option>
              <option value="CRUISE">Kruiz</option>
              <option value="VISA_ONLY">Faqat viza</option>
              <option value="CUSTOM">Boshqa</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Jo'nab ketish sanasi</label>
            <input type="date" style={inp} value={form.departureDate} onChange={e => set('departureDate', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Qaytish sanasi</label>
            <input type="date" style={inp} value={form.returnDate} onChange={e => set('returnDate', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Kattalar soni</label>
            <input type="number" min={1} style={inp} value={form.adults} onChange={e => set('adults', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Bolalar soni</label>
            <input type="number" min={0} style={inp} value={form.children} onChange={e => set('children', e.target.value)} />
          </div>

          {/* Pricing */}
          <div style={{ gridColumn: '1/-1', padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Klient narxi (Sale Price) *</label>
              <input type="number" style={inp} value={form.totalPrice} onChange={e => set('totalPrice', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Operator narxi (Cost)</label>
              <input type="number" style={inp} value={form.supplierCost} onChange={e => set('supplierCost', e.target.value)} placeholder="0" />
            </div>
            {isAdmin && (
              <div>
                <label style={lbl}>Chegirma</label>
                <input type="number" style={inp} value={form.discount} onChange={e => set('discount', e.target.value)} placeholder="0" />
              </div>
            )}
            {isAdmin && totalPrice > 0 && (
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: '#6366f115', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>KLIENT NARXI</div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>${totalPrice.toLocaleString()}</div>
                </div>
                {supplierCost > 0 && (
                  <div style={{ padding: '8px 14px', background: '#f59e0b15', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>MARKUP (USTAMA)</div>
                    <div style={{ fontWeight: 800, color: '#f59e0b' }}>+${(totalPrice - supplierCost - discount).toLocaleString()}</div>
                  </div>
                )}
                <div style={{ padding: '8px 14px', background: profit > 0 ? '#10b98115' : '#ef444415', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>FOYDA (OYLIK ASOSI)</div>
                  <div style={{ fontWeight: 800, color: profit > 0 ? '#10b981' : '#ef4444' }}>${profit.toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Valyuta</label>
            <select style={inp} value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['USD','EUR','UZS','RUB'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Izoh</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Bekor</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              {saving ? 'Saqlanmoqda...' : '✈️ Booking yaratish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Client Personal Message Modal ────────────────────────────────────────────
function ClientPersonalMsgModal({ client, onClose, onSent }: any) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const phone = client?.phone;
  const username = client?.telegramUsername;

  async function send() {
    if (!text.trim()) { toast.error('Xabar matni kerak'); return; }
    if (!phone && !username) { toast.error('Klientda telefon yoki Telegram username yo\'q'); return; }
    setLoading(true);
    try {
      await userTelegramApi.sendMessage({
        phone: phone || undefined,
        username: username || undefined,
        text: text.trim(),
        clientId: client.id,
      });
      toast.success('✅ Xabar yuborildi!');
      onSent();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' };
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };

  return (
    <div style={S}>
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>📱 Birinchi xabar</h2>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--fg-3)' }}>
          {client?.fullName} ga shaxsiy Telegram orqali xabar
        </p>
        <div style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
          {phone && <div>📞 {phone}</div>}
          {username && <div>@{username}</div>}
        </div>
        <textarea style={{ ...inp, minHeight: 100, resize: 'vertical', marginBottom: 14 }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Xabar matni..." autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) send(); }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer' }}>Bekor</button>
          <button onClick={send} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {loading ? '...' : '📨 Yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Offer Pricing Box (admin sees all, agent sees only client price) ─────────
function OfferPricingBox({ f, set, inp, lbl, clientPrice }: any) {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';

  if (isAdmin) {
    // Admin: sees actualPrice (operator cost), markup, clientPrice
    return (
      <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
        <div>
          <label style={lbl}>Operator narxi (maxfiy)</label>
          <input type="number" style={inp} value={f.actualPrice} onChange={(e: any) => set('actualPrice', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={lbl}>Markup (agent ulushi)</label>
          <input type="number" style={inp} value={f.markup} onChange={(e: any) => set('markup', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={lbl}>Mijozga narx</label>
          <div style={{ padding: '7px 10px', background: '#10b98115', borderRadius: 7, fontSize: 16, fontWeight: 700, color: '#10b981' }}>
            ${clientPrice.toLocaleString()}
          </div>
        </div>
        {f.actualPrice && Number(f.actualPrice) > 0 && (
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12, padding: '8px 10px', background: '#8b5cf610', borderRadius: 7, fontSize: 12 }}>
            <span>Foyda: <b style={{ color: '#8b5cf6' }}>${(clientPrice - Number(f.actualPrice)).toLocaleString()}</b></span>
            <span style={{ color: 'var(--fg-3)' }}>({Math.round(((clientPrice - Number(f.actualPrice)) / clientPrice) * 100)}% margin)</span>
          </div>
        )}
      </div>
    );
  }

  // Agent: ONLY sees client price (what customer pays)
  return (
    <div style={{ gridColumn: '1/-1', padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
      <label style={lbl}>Klient narxi (mijoz to'laydigan summa) *</label>
      <input
        type="number"
        style={{ ...inp, fontSize: 18, fontWeight: 700 }}
        value={f.actualPrice}
        onChange={(e: any) => set('actualPrice', e.target.value)}
        placeholder="0"
      />
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
        Faqat mijozga ko'rsatiladigan narxni kiriting
      </div>
    </div>
  );
}

// ─── Offer Send Menu (Telegram / Instagram) ──────────────────────────────────
function OfferSendMenu({ offerId, clientId, clientPhone, clientUsername, onSent }: any) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState('');

  async function sendVia(channel: 'telegram' | 'instagram' | 'personal') {
    setSending(channel);
    try {
      // 1. Mark offer as sent
      await api.post('/offers/' + offerId + '/send', { clientId });
      onSent();

      // 2. Build offer text
      const offerRes = await api.get('/offers/client/' + clientId);
      const offer = (Array.isArray(offerRes.data) ? offerRes.data : []).find((o: any) => o.id === offerId);
      if (!offer) { toast.success('Taklif yuborildi!'); setOpen(false); return; }

      const text = [
        '🌍 SAYOHAT TAKLIFI',
        '',
        '✈️ Tur: ' + offer.tourName,
        offer.destination ? '📍 Yo\'nalish: ' + offer.destination : '',
        offer.departDate ? '📅 Sana: ' + new Date(offer.departDate).toLocaleDateString('uz-UZ') : '',
        offer.pax > 1 ? '👥 Kishilar: ' + offer.pax : '',
        offer.hotelName ? '🏨 Mehmonxona: ' + offer.hotelName + ' ' + ('⭐'.repeat(offer.hotelStars || 0)) : '',
        '',
        '💰 Narx: $' + ((offer.clientPrice || offer.actualPrice || 0)).toLocaleString() + ' ' + (offer.currency || 'USD'),
        offer.notes ? '\n📝 ' + offer.notes : '',
        '',
        'Qo\'shimcha ma\'lumot uchun murojaat qiling.',
      ].filter(v => v !== undefined).join('\n');

      if (channel === 'personal') {
        await userTelegramApi.sendMessage({
          phone: clientPhone || undefined,
          username: clientUsername ? clientUsername.replace('@', '') : undefined,
          userId: undefined,
          text,
          clientId,
        });
      }
      // Bot (telegram/instagram) channels are notified via offer send API
      toast.success('✅ Taklif ' + (channel === 'personal' ? 'Telegram' : channel) + ' orqali yuborildi!');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSending('');
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} disabled={!!sending} style={{
        padding: '3px 10px', borderRadius: 6, border: 'none',
        background: 'var(--success-soft)', color: 'var(--success)',
        cursor: 'pointer', fontSize: 11, fontWeight: 700,
      }}>
        {sending ? '...' : '📤 Yuborish ▾'}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--bg-2)', border: '1px solid var(--border-strong)',
            borderRadius: 10, boxShadow: 'var(--shadow-lg)',
            padding: 6, zIndex: 100, minWidth: 180,
          }}>
            {[
              { key: 'personal', label: '📱 Shaxsiy Telegram', icon: '📱' },
            ].map(opt => (
              <button key={opt.key} onClick={() => sendVia(opt.key as any)} style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                borderRadius: 7, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--fg)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ─── Client Documents Tab ─────────────────────────────────────────────────────
function ClientDocumentsTab({ clientId, initialDocs, onUploaded }: { clientId: string; initialDocs: any[]; onUploaded?: () => void }) {
  const [docs, setDocs] = useState<any[]>(initialDocs || []);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // initialDocs o'zgarganda yangilaymiz
  useEffect(() => { setDocs(initialDocs || []); }, [initialDocs]);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('clientId', clientId);
      const { api } = await import('@/services/api');
      // /documents endpoint - DB ga saqlaydi va client ga bog'laydi
      const r: any = await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs((prev: any[]) => [...prev, r.data]);
      toast.success('Hujjat yuklandi ✅');
      onUploaded?.();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setUploading(false); }
  }

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
  }

  function fileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return '📄';
    if (['jpg','jpeg','png','webp','gif'].includes(ext)) return '🖼';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    return '📎';
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📁 Hujjatlar ({docs.length})</h3>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: uploading ? 0.7 : 1 }}
        >
          {uploading ? '⏳ Yuklanmoqda...' : '+ Fayl yuklash'}
        </button>
        <input
          ref={inputRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.zip"
          onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }}
        />
      </div>

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 13 }}>Hujjatlar yo'q</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Fayl yuklash tugmasini bosing</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {docs.map((d: any) => {
            const url = d.fileUrl || d.url || '';
            const name = d.fileName || d.originalName || d.filename || 'Fayl';
            const urlWithToken = url ? `${url}${url.includes('?') ? '&' : '?'}token=${getToken()}` : '#';
            return (
              <a
                key={d.id}
                href={urlWithToken}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                  textDecoration: 'none', color: 'var(--fg)',
                  display: 'flex', gap: 10, alignItems: 'center',
                  border: '1px solid var(--border)', transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: 28, flexShrink: 0 }}>{fileIcon(name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                    {d.uploadedBy?.name || d.createdBy || ''}{d.createdAt ? ' • ' + new Date(d.createdAt).toLocaleDateString('uz-UZ') : ''}
                  </div>
                  {d.size && <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>{Math.round(d.size / 1024)} KB</div>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Client Payments & Invoice Tab ────────────────────────────────────────────
function ClientPaymentsInvoiceTab({ client: c, bookings, onRefresh }: { client: any; bookings: any[]; onRefresh?: () => void }) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showBookingSendModal, setShowBookingSendModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const router = useRouter();

  useEffect(() => {
    import('@/services/api').then(({ invoicesApi }) =>
      invoicesApi.list({ clientId: c.id })
        .then((r: any) => setInvoices(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
        .catch(() => {})
        .finally(() => setLoadingInvoices(false))
    );
  }, [c.id]);

  const allPayments = bookings.flatMap((b: any) =>
    (b.payments || []).map((p: any) => ({ ...p, bookingRef: b.bookingRef, bookingId: b.id }))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* To'lovlar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>💳 To'lovlar</h3>
          {bookings.length > 0 && (
            <button onClick={() => { setSelectedBooking(bookings[0]); setShowBookingSendModal(true); }}
              style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              📤 Bookingni yuborish
            </button>
          )}
        </div>
        {!allPayments.length ? <Empty title="To'lovlar yo'q" icon="💳" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                {['Sana','Booking','Usul','Summa'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Summa' ? 'right' : 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {allPayments.map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 10px', color: 'var(--fg-3)' }}>{p.paidAt && new Date(p.paidAt).toLocaleDateString('uz-UZ')}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--primary)' }}>{p.bookingRef}</td>
                  <td style={{ padding: '9px 10px' }}>{p.method}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{p.currency} {Number(p.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Invoice */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🧾 Invoice</h3>
          <button onClick={() => setShowInvoiceModal(true)}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Invoice yaratish
          </button>
        </div>
        {loadingInvoices ? <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div> :
         !invoices.length ? <Empty title="Invoice yo'q" icon="🧾" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                {['#','Sana','Summa','Holat','Amallar'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Summa' || h === 'Amallar' ? 'right' : 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                  <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{inv.invoiceNo || inv.invoiceNumber || '#'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--fg-3)' }}>{inv.issuedAt && new Date(inv.issuedAt).toLocaleDateString('uz-UZ')}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{inv.currency || 'USD'} {Number(inv.totalAmount || inv.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: inv.status === 'PAID' ? 'var(--success-soft)' : inv.status === 'SENT' ? 'var(--warning-soft)' : 'var(--bg-3)',
                      color: inv.status === 'PAID' ? 'var(--success)' : inv.status === 'SENT' ? 'var(--warning)' : 'var(--fg-3)',
                    }}>{inv.status}</span>
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => window.open(`/invoices/print?id=${inv.id}`, '_blank')}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 11, marginRight: 6 }}>
                      🖨 Print
                    </button>
                    <SendInvoiceBtn invoice={inv} client={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showInvoiceModal && (
        <CreateInvoiceModal
          client={c}
          bookings={bookings}
          onClose={() => setShowInvoiceModal(false)}
          onSaved={(inv: any) => { setInvoices(p => [inv, ...p]); setShowInvoiceModal(false); }}
        />
      )}
      {showBookingSendModal && selectedBooking && (
        <BookingSendModal
          booking={selectedBooking}
          client={c}
          bookings={bookings}
          onClose={() => setShowBookingSendModal(false)}
        />
      )}
    </div>
  );
}

// ─── Send Invoice Button ───────────────────────────────────────────────────────
function SendInvoiceBtn({ invoice: inv, client: c }: { invoice: any; client: any }) {
  const [sending, setSending] = useState(false);
  async function send() {
    if (!c.phone && !c.telegramUsername) { toast.error("Klientda telefon yoki Telegram yo'q"); return; }
    setSending(true);
    try {
      const { userTelegramApi } = await import('@/services/api');
      const lines = [
        '🧾 *HISOB-FAKTURA*',
        '',
        `Hurmatli *${c.fullName}*,`,
        '',
        `Invoice: \`${inv.invoiceNo || inv.invoiceNumber || inv.id?.slice(-8)}\``,
        `Sana: ${inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('uz-UZ') : ''}`,
        `Summa: *${inv.currency || 'USD'} ${Number(inv.totalAmount || inv.amount || 0).toLocaleString()}*`,
        inv.dueDate ? `Muddat: ${new Date(inv.dueDate).toLocaleDateString('uz-UZ')}` : null,
        '',
        "To'lov uchun biz bilan bog'laning.",
      ].filter(Boolean).join('\n');
      await userTelegramApi.sendMessage({ phone: c.phone || undefined, username: c.telegramUsername || undefined, text: lines, clientId: c.id });
      toast.success('✅ Invoice yuborildi!');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Yuborib bo\'lmadi'); }
    finally { setSending(false); }
  }
  return (
    <button onClick={send} disabled={sending}
      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary-soft)', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
      {sending ? '...' : '📤 Yuborish'}
    </button>
  );
}

// ─── Create Invoice Modal ─────────────────────────────────────────────────────
function CreateInvoiceModal({ client: c, bookings, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    bookingId: bookings[0]?.id || '',
    amount: bookings[0]?.totalPrice || '',
    currency: bookings[0]?.currency || 'USD',
    dueDate: '',
    notes: '',
    discount: 0,
    taxPercent: 0,
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Summa kiriting"); return; }
    setLoading(true);
    try {
      const { invoicesApi } = await import('@/services/api');
      const r: any = await invoicesApi.create({
        clientId: c.id,
        bookingId: form.bookingId || undefined,
        amount: Number(form.amount),
        totalAmount: Number(form.amount) * (1 + form.taxPercent / 100) - form.discount,
        currency: form.currency,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        discount: form.discount,
        taxPercent: form.taxPercent,
        status: 'DRAFT',
      });
      toast.success('✅ Invoice yaratildi!');
      onSaved(r.data);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="🧾 Invoice yaratish" maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bookings.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Booking</label>
            <select value={form.bookingId} onChange={e => {
              const b = bookings.find((b: any) => b.id === e.target.value);
              setForm(p => ({ ...p, bookingId: e.target.value, amount: b?.totalPrice || p.amount, currency: b?.currency || p.currency }));
            }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }}>
              <option value="">— Tanlang —</option>
              {bookings.map((b: any) => <option key={b.id} value={b.id}>{b.bookingRef} — {b.tourName}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Summa *</label>
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Valyuta</label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }}>
              {['USD','UZS','EUR','RUB'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>To'lov muddati</label>
          <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' as const }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Izoh</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
            placeholder="Ixtiyoriy izoh..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, resize: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', fontWeight: 600 }}>Bekor</button>
          <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {loading ? '⏳...' : '✅ Yaratish'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Booking Send Modal ────────────────────────────────────────────────────────
function BookingSendModal({ booking: bk, client: c, bookings, onClose }: any) {
  const [selected, setSelected] = useState(bk?.id || bookings[0]?.id || '');
  const [sending, setSending] = useState(false);
  const b = bookings.find((x: any) => x.id === selected) || bk || bookings[0];

  async function send() {
    if (!c.phone && !c.telegramUsername) { toast.error("Klientda telefon yoki Telegram username yo'q"); return; }
    if (!b) { toast.error('Booking tanlanmagan'); return; }
    setSending(true);
    try {
      const { userTelegramApi } = await import('@/services/api');
      const paid = (b.payments || []).filter((p: any) => p.status === 'COMPLETED').reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const debt = (b.totalPrice || 0) - paid;

      const lines = [
        '✈️ *BOOKING TASDIQLANDI!*',
        '',
        `Hurmatli *${c.fullName}*,`,
        'Sizning buyurtmangiz qabul qilindi. Tafsilotlar:',
        '',
        '📋 *Booking ma\'lumotlari:*',
        b.bookingRef ? `• Ref: \`${b.bookingRef}\`` : null,
        b.tourName ? `• Tur nomi: ${b.tourName}` : null,
        b.destination ? `• Yo'nalish: 📍${b.destination}` : null,
        b.tourType ? `• Tur turi: ${b.tourType}` : null,
        '',
        '👥 *Yo\'lovchilar:*',
        (b.adults || b.children) ? [b.adults && `${b.adults} katta`, b.children && `${b.children} bola`].filter(Boolean).map((x: string) => `• ${x}`).join('\n') : null,
        '',
        b.departureDate ? `📅 *Ketish:* ${new Date(b.departureDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : null,
        b.returnDate ? `🔙 *Qaytish:* ${new Date(b.returnDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : null,
        '',
        '💰 *To\'lov:*',
        `• Jami narx: *${b.currency || 'USD'} ${Number(b.totalPrice || 0).toLocaleString()}*`,
        paid > 0 ? `• To'langan: ${b.currency || 'USD'} ${Number(paid).toLocaleString()}` : null,
        debt > 0 ? `• Qoldi: *${b.currency || 'USD'} ${Number(debt).toLocaleString()}*` : `• ✅ To'liq to'langan`,
        '',
        '📞 Savollar uchun biz bilan bog\'laning!',
        '_Omon Travel Agency_',
      ].filter((l: any) => l !== null).join('\n');

      await userTelegramApi.sendMessage({
        phone: c.phone || undefined,
        username: c.telegramUsername || undefined,
        text: lines,
        clientId: c.id,
      });
      toast.success('✅ Booking ma\'lumotlari yuborildi!');
      onClose();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Yuborib bo\'lmadi'); }
    finally { setSending(false); }
  }

  return (
    <Modal open onClose={onClose} title="📤 Booking yuborish" maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bookings.length > 1 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Booking tanlang</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }}>
              {bookings.map((bk: any) => <option key={bk.id} value={bk.id}>{bk.bookingRef} — {bk.tourName}</option>)}
            </select>
          </div>
        )}
        {b && (
          <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 Yuborilajak ma'lumot:</div>
            <div style={{ color: 'var(--fg-2)', lineHeight: 1.7 }}>
              {b.bookingRef && <div>Ref: <b>{b.bookingRef}</b></div>}
              {b.tourName && <div>Tur: <b>{b.tourName}</b></div>}
              {b.destination && <div>Yo'nalish: {b.destination}</div>}
              {b.departureDate && <div>Ketish: {new Date(b.departureDate).toLocaleDateString('uz-UZ')}</div>}
              <div>Narx: <b>{b.currency || 'USD'} {Number(b.totalPrice || 0).toLocaleString()}</b></div>
            </div>
          </div>
        )}
        <div style={{ background: 'var(--warning-soft)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
          📱 Telegram orqali klientga yuboriladi
          {!c.telegramUsername && !c.phone && <span style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>⚠️ Klientda Telegram username yoki telefon raqam yo'q!</span>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', fontWeight: 600 }}>Bekor</button>
          <button onClick={send} disabled={sending || (!c.phone && !c.telegramUsername)}
            style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: (!c.phone && !c.telegramUsername) ? 0.5 : 1 }}>
            {sending ? '⏳ Yuborilmoqda...' : '📤 Yuborish'}
          </button>
        </div>
      </div>
    </Modal>
  );
}