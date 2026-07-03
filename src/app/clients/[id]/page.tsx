'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { v8Api, clientsApi, tasksApi, followUpsApi, telegramApi, bookingsApi, userTelegramApi, paymentsApi, api, getAccessToken } from '@/services/api';
import { Card, Btn, Badge, Skeleton, Avatar, Textarea, Label, Modal, Input, Select, Empty } from '@/components/ui';
import { useDialer } from '@/lib/dialer';
import { useAuth } from '@/lib/store';
import { fmtDate, fmtDateTime, fmtMoney, timeAgo, errMsg, SOURCE_LABELS, TIER_LABELS } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { FaWhatsapp, FaTelegramPlane, FaPen, FaEllipsisH, FaTrash, FaPhoneAlt, FaPaperPlane, FaLock, FaChevronDown } from 'react-icons/fa';
import { EditBookingModal } from '@/components/EditBookingModal';

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

// Mehmonxona xizmat darajasi bo'yicha toifalar (yulduzdan tashqari, sayohat
// agentliklarida keng qo'llaniladigan amaliy tasnif — byudjetdan lyuksgacha)
const HOTEL_TYPE_LABELS: Record<string, string> = {
  BUDGET: '💰 Byudjet (ekonom)',
  STANDARD: '🏨 Standart',
  COMFORT: '🌟 Komfort',
  BUSINESS: '💼 Biznes',
  LUXURY: '👑 Premium / Lyuks',
};

const STAGE_OPTIONS = Object.keys(STAGE_LABELS);

// v10.4: Bitta taklif formasi tasodifan 2-3 marta yuborilganda backend'da
// bir xil nomli/narxli alohida yozuvlar paydo bo'lardi va ular ro'yxatda
// bir xil kartalar sifatida takrorlanardi. Bu yerda faqat KO'RINISH
// darajasida (hech qanday ma'lumot o'chirilmaydi) bir xil takliflarni
// bitta guruhga yig'amiz.
function offerSignature(o: any): string {
  return [o.tourName, o.destination, o.clientPrice, o.actualPrice, o.status].join('|');
}
function groupDuplicateOffers(offers: any[]): any[][] {
  const groups: Record<string, any[]> = {};
  const order: string[] = [];
  for (const o of offers) {
    const sig = offerSignature(o);
    if (!groups[sig]) { groups[sig] = []; order.push(sig); }
    groups[sig].push(o);
  }
  return order.map((sig) => groups[sig]);
}

export default function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { callClient } = useDialer();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [showOfferCreate, setShowOfferCreate] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [sellingOfferId, setSellingOfferId] = useState<string | null>(null);
  // v10.3: Taklifdan booking yaratish modali (6-rasm ko'rinishida, prefilled)
  const [offerBooking, setOfferBooking] = useState<any>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showPersonalMsg, setShowPersonalMsg] = useState(false);
  const [showClientEdit, setShowClientEdit] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const isAdmin = user?.role !== 'AGENT';

  const load = () => {
    setLoading(true);
    v8Api.getClient360(id)
      .then((r) => {
        setData(r.data);
        // Faol suhbat bo'lsa — xabarlarni ham darhol tortib kelamiz (Faoliyat
        // oqimida ko'rsatish uchun; endi alohida "Chat" tabga o'tish shart emas)
        const conv = r.data?.activeConversation;
        if (conv?.id) {
          setChatLoading(true);
          telegramApi.messages(conv.id)
            .then((mr: any) => setChatMsgs(Array.isArray(mr.data) ? mr.data : (mr.data?.data || [])))
            .catch(() => {})
            .finally(() => setChatLoading(false));
        } else {
          setChatMsgs([]);
        }
      })
      .then(() => {
        // Load offers separately (persist across reloads)
        api.get('/offers/client/' + id)
          .then((or: any) => setOffers(Array.isArray(or.data) ? or.data : []))
          .catch(() => {});
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <CrmLayout><div style={{ padding: 24 }}><Skeleton height={400} /></div></CrmLayout>;
  if (!data?.client) return <CrmLayout><div style={{ padding: 24 }}>Klient topilmadi</div></CrmLayout>;

  const c = data.client;
  const f = data.financial || {};

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
            <Avatar name={c.fullName} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 2, cursor: 'pointer' }} onClick={() => router.push('/clients')}>
                ← Klientlar
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{c.fullName}</h1>
                <StagePill clientId={c.id} stage={c.pipelineStage} onChanged={load} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
                {[c.phone, c.telegramUsername && '@' + c.telegramUsername, c.source].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {/* ═══ QUICK ACTIONS ═══ */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {c.phone && (
              <Btn variant="gradient" icon="📞" onClick={() => callClient(c.id, c.fullName, c.phone)}>
                Qo'ng'iroq
              </Btn>
            )}
            {c.phone && (
              <button aria-label="WhatsApp" title="WhatsApp" onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`, '_blank')} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: '#25D366', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center' }}><FaWhatsapp /></button>
            )}
            {c.telegramUsername && (
              <button aria-label="Telegram" title="Telegram" onClick={() => window.open(`https://t.me/${c.telegramUsername}`, '_blank')} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: '#229ED9', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center' }}><FaTelegramPlane /></button>
            )}
            <button aria-label="Tahrirlash" title="Tahrirlash" onClick={() => setShowClientEdit(true)} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}><FaPen /></button>
            <div style={{ position: 'relative' }}>
              <button aria-label="Ko'proq" title="Ko'proq" onClick={() => setHeaderMenuOpen((v) => !v)} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}><FaEllipsisH /></button>
              {headerMenuOpen && (
                <>
                  <div onClick={() => setHeaderMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', right: 0, top: 38, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 11, minWidth: 170 }}>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          setHeaderMenuOpen(false);
                          if (!window.confirm(`"${c.fullName}" klientini butunlay o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`)) return;
                          try {
                            await clientsApi.delete(c.id);
                            toast.success("✅ Klient o'chirildi");
                            router.push('/clients');
                          } catch (e: any) { toast.error(errMsg(e)); }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      ><FaTrash size={12} /> Klientni o'chirish</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ MAIN LAYOUT: chap — mijoz ma'lumoti, o'ng — takliflar + faoliyat ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28, alignItems: 'start' }}>

          {/* ── CHAP: mijoz ma'lumoti ── */}
          <div>
            {/* v10.4: Jami / sotilgan — avval faqat "sotilmagan" takliflar
                yig'indisi umumiy summa sifatida ko'rsatilardi, bu ro'yxatdagi
                raqamlar bilan mos kelmasdi. Endi ikkalasi ham aniq ko'rsatiladi. */}
            {(() => {
              const totalSum = offers.reduce((s: number, o: any) => s + (o.clientPrice || 0), 0);
              const soldOffers = offers.filter((o: any) => o.status === 'SOLD');
              const soldSum = soldOffers.reduce((s: number, o: any) => s + (o.clientPrice || 0), 0);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>${totalSum.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{offers.length} ta taklif yuborilgan</div>
                  </div>
                  {soldOffers.length > 0 && (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--success-soft)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>${soldSum.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--success)' }}>{soldOffers.length} ta sotildi</div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              {c.assignedAgent && (
                <div>
                  <div style={{ color: 'var(--fg-4)', fontSize: 11, marginBottom: 2 }}>Mas'ul agent</div>
                  <div>{c.assignedAgent.name}</div>
                </div>
              )}
              {c.firstContactAt && (
                <div>
                  <div style={{ color: 'var(--fg-4)', fontSize: 11, marginBottom: 2 }}>Birinchi murojaat</div>
                  <div>{fmtDate(c.firstContactAt)}</div>
                </div>
              )}
              <div>
                <div style={{ color: 'var(--fg-4)', fontSize: 11, marginBottom: 2 }}>Manba</div>
                <div>{c.source}{c.tier ? ' · ' + c.tier : ''}</div>
              </div>

              {/* Keyingi vazifa */}
              {(() => {
                const nextTask = (data.tasks || [])[0];
                const nextFollowUp = (data.followUps || [])[0];
                const next = nextTask || nextFollowUp;
                if (!next) {
                  return (
                    <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => setShowTask(true)} style={{ fontSize: 12, padding: '5px 0', color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Vazifa qo'shish</button>
                    </div>
                  );
                }
                return (
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      ⏰ {next.dueAt ? fmtDateTime(next.dueAt) : ''}
                    </div>
                    <div style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>{next.title}</div>
                    <button onClick={() => setShowTask(true)} style={{ fontSize: 11, padding: '4px 0', color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>+ Yana vazifa</button>
                  </div>
                );
              })()}

              <button onClick={() => setShowMoreInfo((v) => !v)} style={{ fontSize: 11, color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: 4 }}>
                {showMoreInfo ? '– Kamroq ma\'lumot' : '+ Batafsil ma\'lumot'}
              </button>
            </div>

            {showMoreInfo && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <Info label="Email" value={c.email} />
                <Info label="Telefon 2" value={c.phone2} />
                <Info label="Tug'ilgan sana" value={c.dateOfBirth && fmtDate(c.dateOfBirth)} />
                <Info label="Davlat / Shahar" value={[c.country, c.city].filter(Boolean).join(', ')} />
                <Info label="Manzil" value={c.address} />
                {(c.passportNo || c.passportExpiry) && <Info label="Passport" value={c.passportNo} mono />}
                {c.passportExpiry && <Info label="Passport amal qilish muddati" value={fmtDate(c.passportExpiry)} />}
                {c.nationality && <Info label="Millati" value={c.nationality} />}
                <Info label="Yaratilgan" value={fmtDateTime(c.createdAt)} />
                <Info label="Bosqichdan beri" value={c.pipelineStageAt && timeAgo(c.pipelineStageAt)} />
                {c.utmSource && <Info label="UTM Source" value={c.utmSource} />}
                <div>
                  <div style={{ color: 'var(--fg-4)', fontSize: 11, marginBottom: 4 }}>Lead score</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.leadScore || 0}%`, background: c.leadScore >= 80 ? '#ef4444' : c.leadScore >= 50 ? '#eab308' : '#0ea5e9' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{c.leadScore || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── O'NG: takliflar + faoliyat ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, minWidth: 0 }}>

            {/* Takliflar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Takliflar</span>
                <button onClick={() => setShowOfferCreate(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer' }}>+ Yangi</button>
              </div>

              {offers.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8 }}>
                  Hali taklif yuborilmagan
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  {/* v10.4: Bir xil taklif (masalan, forma tasodifan 2 marta
                      yuborilganda) endi bitta karta sifatida, "×N" belgisi
                      bilan ko'rsatiladi — ro'yxat cho'zilib ketmaydi. */}
                  {groupDuplicateOffers(offers).map((group: any[], gi: number) => (
                    <OfferGroupRow
                      key={group[0].id}
                      group={group}
                      isLast={gi === groupDuplicateOffers(offers).length - 1}
                      clientId={id}
                      clientPhone={c.phone}
                      clientUsername={c.telegramUsername}
                      onSent={(offerId: string) => setOffers((prev: any[]) => prev.map((x: any) => x.id === offerId ? { ...x, status: 'SENT' } : x))}
                      onEdit={(o: any) => setEditingOffer(o)}
                      onSold={(o: any) => setOfferBooking(o)}
                      sellingOfferId={sellingOfferId}
                    />
                  ))}
                </div>
              )}

              <button onClick={() => setShowBooking(true)} style={{ fontSize: 11, color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0' }}>
                yoki to'g'ridan-to'g'ri booking yarating →
              </button>

              {offerBooking && (
                <OfferBookingModal
                  offer={offerBooking}
                  clientId={id}
                  onClose={() => setOfferBooking(null)}
                  onSaved={() => { setOfferBooking(null); load(); }}
                />
              )}
              {showOfferCreate && (
                <OfferCreateModal
                  clientId={id}
                  onClose={() => setShowOfferCreate(false)}
                  onSaved={(o: any) => { setOffers((prev: any[]) => [o, ...prev]); setShowOfferCreate(false); }}
                />
              )}
              {editingOffer && (
                <OfferCreateModal
                  clientId={id}
                  existingOffer={editingOffer}
                  onClose={() => setEditingOffer(null)}
                  onSaved={(o: any) => { setOffers((prev: any[]) => prev.map((x: any) => x.id === o.id ? o : x)); setEditingOffer(null); }}
                />
              )}
            </div>

            {/* Faoliyat — chat + izohlar + vazifalar + bosqich o'zgarishlari bitta oqimda */}
            <ActivityFeed
              client={c}
              conversation={data.activeConversation}
              chatMsgs={chatMsgs}
              chatLoading={chatLoading}
              onStartChat={() => setShowPersonalMsg(true)}
              onRefresh={load}
            />

            {/* Sotilgandan keyin: booking / to'lov / hujjatlar shu yerda ochiladi */}
            {c.bookings?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>✅ Bookinglar</span>
                    <button onClick={() => setShowBooking(true)} style={{ fontSize: 11, padding: '4px 8px', color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Yana booking</button>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                    {c.bookings.map((b: any, i: number) => (
                      <div key={b.id} onClick={() => router.push(`/bookings/${b.id}`)} style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: i === c.bookings.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 13 }}>{b.tourName} <span style={{ color: 'var(--fg-4)', fontFamily: 'monospace', fontSize: 11 }}>· {b.bookingRef}</span></div>
                          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{b.status} · {b.destination}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{b.currency} {b.paidAmount || 0} / {b.totalPrice}</div>
                            {b.profit > 0 && <div style={{ fontSize: 11, color: 'var(--success)' }}>foyda {fmtMoney(b.profit)}</div>}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setEditingBooking(b); }} title="Tahrirlash" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}><FaPen size={11} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {showNote && <NoteModal clientId={c.id} current={c} onClose={() => setShowNote(false)} onSaved={() => { setShowNote(false); load(); }} />}
      {showTask && <TaskModal clientId={c.id} onClose={() => setShowTask(false)} onSaved={() => { setShowTask(false); load(); }} />}
      {showFollowUp && <FollowUpModal clientId={c.id} onClose={() => setShowFollowUp(false)} onSaved={() => { setShowFollowUp(false); load(); }} />}
      {showPersonalMsg && (
        <ClientPersonalMsgModal
          client={c}
          onClose={() => setShowPersonalMsg(false)}
          onSent={() => { setShowPersonalMsg(false); toast.success('Xabar yuborildi!'); load(); }}
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
      {showClientEdit && (
        <ClientEditModal
          client={c}
          onClose={() => setShowClientEdit(false)}
          onSaved={() => { setShowClientEdit(false); load(); toast.success("✅ Klient ma'lumotlari yangilandi"); }}
        />
      )}
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSaved={() => { setEditingBooking(null); load(); toast.success('✅ Booking yangilandi'); }}
        />
      )}
    </CrmLayout>
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

// ─── Stage Pill (bosqichni tez almashtirish) ───────────────────────────────────
function StagePill({ clientId, stage, onChanged }: any) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function change(newStage: string) {
    if (newStage === stage) { setOpen(false); return; }
    setSaving(true);
    try {
      const { pipelineApi } = await import('@/services/api');
      await pipelineApi.move(clientId, newStage);
      toast.success('Bosqich yangilandi');
      onChanged?.();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} disabled={saving} style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: '2px 10px', borderRadius: 999,
        background: (STAGE_COLORS[stage] || 'var(--fg-3)') + '20', color: STAGE_COLORS[stage] || 'var(--fg-3)',
        border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>
        {STAGE_LABELS[stage] || stage} <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{ position: 'absolute', left: 0, top: 26, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 11, minWidth: 170, maxHeight: 300, overflowY: 'auto' }}>
            {STAGE_OPTIONS.map((s) => (
              <button key={s} onClick={() => change(s)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                background: s === stage ? 'var(--bg-3)' : 'none', color: STAGE_COLORS[s] || 'var(--fg)',
                fontWeight: s === stage ? 700 : 500,
              }}>{STAGE_LABELS[s]}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Activity Feed (chat + izohlar + vazifalar + bosqich o'zgarishlari) ────────
function ActivityFeed({ client, conversation, chatMsgs, chatLoading, onStartChat, onRefresh }: any) {
  const [mode, setMode] = useState<'message' | 'note'>('message');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    const val = text.trim();
    if (!val) return;
    setSending(true);
    try {
      if (mode === 'note') {
        await clientsApi.addNote(client.id, val);
        toast.success('Izoh saqlandi');
      } else {
        if (!conversation) { onStartChat?.(); setSending(false); return; }
        if (conversation.isPersonal) {
          await userTelegramApi.sendMessage({ userId: conversation.externalChatId, text: val, clientId: client.id });
        } else {
          try {
            await telegramApi.sendMessage(conversation.id, val);
          } catch (botErr: any) {
            // BOT ulanmagan/aktiv bo'lmasa — shaxsiy Telegram orqali qayta urinamiz,
            // shu tenant uchun bot sozlanmagan bo'lishi tez-tez uchraydi.
            const msg = botErr?.response?.data?.message || '';
            if (String(msg).toLowerCase().includes('bot')) {
              await userTelegramApi.sendMessage({ userId: conversation.externalChatId, text: val, clientId: client.id });
            } else {
              throw botErr;
            }
          }
        }
        toast.success('Xabar yuborildi');
      }
      setText('');
      onRefresh?.();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  // Timeline hodisalari va chat xabarlarini bitta xronologik oqimga birlashtiramiz
  const feed = [
    ...(client.timeline || []).map((t: any) => ({
      id: 't-' + t.id, ts: t.createdAt, icon: TIMELINE_ICONS[t.type] || '•',
      title: t.title, subtitle: t.description, isNote: t.type === 'note',
    })),
    ...(chatMsgs || []).map((m: any) => {
      const isOut = m.direction === 'OUTBOUND' || m.direction === 'outbound';
      return {
        id: 'm-' + m.id, ts: m.createdAt, icon: isOut ? '↗️' : '↘️',
        title: m.text || m.caption,
        subtitle: (isOut ? 'Siz' : client.fullName) + ' · ' + (m._source === 'personal' ? 'Telegram' : (isOut ? 'yuborildi' : 'keldi')),
        isNote: false,
      };
    }),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const inp: any = { width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--fg)', fontSize: 13, resize: 'vertical', minHeight: 44 };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 10 }}>Faoliyat</div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button onClick={() => setMode('message')} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
            border: mode === 'message' ? 'none' : '1px solid var(--border)',
            background: mode === 'message' ? '#3d7eff' : 'none',
            color: mode === 'message' ? 'white' : 'var(--fg-2)',
          }}>Xabar</button>
          <button onClick={() => setMode('note')} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
            border: mode === 'note' ? 'none' : '1px solid var(--border)',
            background: mode === 'note' ? '#3d7eff' : 'none',
            color: mode === 'note' ? 'white' : 'var(--fg-2)',
          }}>Izoh</button>
        </div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} style={inp}
          placeholder={mode === 'note' ? "Ichki izoh yozing... (faqat xodimlar ko'radi)" : (conversation ? 'Mijozga xabar yozing...' : "Mijoz bilan hali suhbat yo'q — bosing va birinchi xabarni yuboring")}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
            {mode === 'note' ? '🔒 Faqat sizga ko\'rinadi' : '✈️ Mijoz ko\'radi'}
          </span>
          <button onClick={send} disabled={sending || !text.trim()} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', opacity: sending || !text.trim() ? 0.6 : 1 }}>
            {sending ? '...' : mode === 'note' ? 'Saqlash' : 'Yuborish'}
          </button>
        </div>
      </div>

      {chatLoading && <div style={{ fontSize: 12, color: 'var(--fg-4)', marginBottom: 10 }}>Yuklanmoqda...</div>}

      {feed.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>Hali faoliyat yo'q</div>
      ) : (
        <div>
          {feed.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, marginTop: 2, flexShrink: 0, opacity: 0.8 }}>{item.isNote ? '🔒' : item.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                  {item.subtitle ? item.subtitle + ' · ' : ''}{timeAgo(item.ts)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Offer Row (ro'yxat ko'rinishidagi taklif qatori, "..." menyu bilan) ───────
function OfferGroupRow({ group, isLast, clientId, clientPhone, clientUsername, onSent, onEdit, onSold, sellingOfferId }: any) {
  const [expanded, setExpanded] = useState(false);
  const primary = group[0];
  const extra = group.length - 1;

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <OfferRow
        offer={primary}
        isLast
        clientId={clientId}
        clientPhone={clientPhone}
        clientUsername={clientUsername}
        onSent={() => onSent(primary.id)}
        onEdit={() => onEdit(primary)}
        onSold={() => onSold(primary)}
        selling={sellingOfferId === primary.id}
        noBorder
      />
      {extra > 0 && (
        <div style={{ padding: '0 14px 11px' }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 11, color: 'var(--fg-3)', background: 'var(--bg-3)', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}
          >
            {expanded ? '– Yashirish' : `Yana ${extra} ta bir xil taklif →`}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.slice(1).map((o: any) => (
                <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 8, opacity: 0.85 }}>
                  <OfferRow
                    offer={o}
                    isLast
                    clientId={clientId}
                    clientPhone={clientPhone}
                    clientUsername={clientUsername}
                    onSent={() => onSent(o.id)}
                    onEdit={() => onEdit(o)}
                    onSold={() => onSold(o)}
                    selling={sellingOfferId === o.id}
                    noBorder
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OfferRow({ offer: o, isLast, clientId, clientPhone, clientUsername, onSent, onEdit, onSold, selling, noBorder }: any) {
  const hotels = Array.isArray(o.hotels) && o.hotels.length ? o.hotels : (o.hotelName ? [{ name: o.hotelName, stars: o.hotelStars }] : []);
  const mealLabel: Record<string, string> = { BREAKFAST: '🍳 Nonushta', FULL_BOARD: '🍽 3 mahal' };
  const tags = [
    o.departDate && `✈️ ${fmtDate(o.departDate)}${o.departFlightTime ? ' ' + o.departFlightTime : ''}`,
    o.pax > 1 && `👥 ${o.pax} kishi`,
    ...hotels.map((h: any) => `🏨 ${h.name}${h.stars ? '⭐'.repeat(h.stars) : ''}`),
    o.mealPlan && mealLabel[o.mealPlan],
    o.includesTransfer && '🚕 Transfer',
    o.includesInsurance && "🛡 Sug'urta",
    o.includesVisa && '🛂 Viza',
  ].filter(Boolean);

  return (
    <div style={{ padding: '11px 14px', borderBottom: (noBorder || isLast) ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{o.tourName}</div>
          {o.destination && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>📍 {o.destination}</div>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {tags.map((t: any, i: number) => (
                <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-3)', color: 'var(--fg-3)' }}>{t}</span>
              ))}
            </div>
          )}
          {hotels.some((h: any) => h.photos?.length > 0) && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hotels.filter((h: any) => h.photos?.length > 0).map((h: any, hi: number) => (
                <div key={hi}>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 5, fontWeight: 600 }}>
                    🏨 {h.name}{h.stars ? ' ' + '⭐'.repeat(h.stars) : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {(h.photos || []).slice(0, 8).map((p: string, i: number) => (
                      <a key={i} href={p} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                        <img
                          src={p}
                          alt={h.name}
                          style={{
                            width: 68, height: 68, borderRadius: 9, objectFit: 'cover',
                            border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,.15)',
                            transition: 'transform .15s ease',
                          }}
                          onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                          onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {o.status === 'SOLD' && o.bookingId && (
            <a href={`/bookings/${o.bookingId}`} style={{ fontSize: 11, color: 'var(--success)', marginTop: 6, display: 'inline-block' }}>→ Bookingni ko'rish</a>
          )}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>${(o.clientPrice || 0).toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>tan narx ${(o.actualPrice || 0).toLocaleString()} · foyda ${(o.markup || 0).toLocaleString()}</div>
            <div style={{
              fontSize: 10, padding: '1px 8px', borderRadius: 999, fontWeight: 700, marginTop: 3, display: 'inline-block',
              background: o.status === 'SOLD' ? 'var(--success-soft)' : o.status === 'SENT' ? 'var(--info-soft)' : 'var(--warning-soft)',
              color: o.status === 'SOLD' ? 'var(--success)' : o.status === 'SENT' ? 'var(--info)' : 'var(--warning)',
            }}>{o.status === 'SOLD' ? '✅ sotildi' : o.status === 'SENT' ? 'yuborildi' : "ko'rib chiqilmoqda"}</div>
          </div>
        </div>
      </div>

      {/* v10.3: Ko'rinadigan amallar — mijoz taklifni yoqtirsa,
          BITTA bosishda avtomatik booking yaratiladi. Tahrirlash ham ochiq.
          v11: "Taklif yuborish" endi "⋯" menyu ichida yashirin emas —
          har doim, doimiy ko'rinadigan tugma sifatida turadi. */}
      {o.status !== 'SOLD' && (
        <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
          <button
            disabled={selling}
            onClick={onSold}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: selling ? 0.7 : 1,
            }}
          >
            {selling ? 'Yaratilmoqda...' : '✓ Booking yaratish'}
          </button>
          <OfferSendMenu offerId={o.id} clientId={clientId} onSent={onSent} />
          <button
            onClick={onEdit}
            title="Taklifni tahrirlash"
            style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-3)',
              color: 'var(--fg-2)', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ✏️ Tahrirlash
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Offer Create Modal ───────────────────────────────────────────────────────
function OfferCreateModal({ clientId, onClose, onSaved, existingOffer }: any) {
  const isEdit = !!existingOffer;
  const [f, setF] = useState(() => {
    if (existingOffer) {
      return {
        tourName: existingOffer.tourName || '',
        destination: existingOffer.destination || '',
        pax: existingOffer.pax || 1,
        departDate: existingOffer.departDate ? existingOffer.departDate.slice(0, 10) : '',
        returnDate: existingOffer.returnDate ? existingOffer.returnDate.slice(0, 10) : '',
        departFlightTime: existingOffer.departFlightTime || '',
        returnFlightTime: existingOffer.returnFlightTime || '',
        // Asl kiritilgan valyuta/summa qaytarib ko'rsatiladi (agar EUR/UZS bo'lgan bo'lsa)
        actualPrice: String(existingOffer.originalActualPrice ?? existingOffer.actualPrice ?? ''),
        markup: String(existingOffer.originalMarkup ?? existingOffer.markup ?? '0'),
        currency: existingOffer.originalCurrency || existingOffer.currency || 'USD',
        hotels: Array.isArray(existingOffer.hotels) && existingOffer.hotels.length
          ? existingOffer.hotels.map((h: any) => ({ name: h.name || '', stars: h.stars || '', photos: h.photos || [] }))
          : [{ name: existingOffer.hotelName || '', stars: existingOffer.hotelStars || '', photos: [] as string[] }],
        mealPlan: existingOffer.mealPlan || 'NONE',
        includesVisa: !!existingOffer.includesVisa,
        includesFlight: existingOffer.includesFlight !== false,
        includesHotel: existingOffer.includesHotel !== false,
        includesTransfer: !!existingOffer.includesTransfer,
        includesInsurance: !!existingOffer.includesInsurance,
        notes: existingOffer.notes || '',
      };
    }
    return {
      tourName: '', destination: '', pax: 1,
      departDate: '', returnDate: '', departFlightTime: '', returnFlightTime: '',
      actualPrice: '', markup: '0', currency: 'USD',
      hotels: [{ name: '', stars: '', photos: [] as string[] }],
      mealPlan: 'NONE',
      includesVisa: false, includesFlight: true, includesHotel: true,
      includesTransfer: false, includesInsurance: false,
      notes: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [sendNow, setSendNow] = useState(false);
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const setHotels = (hotels: any[]) => setF(prev => ({ ...prev, hotels }));
  const clientPrice = (parseFloat(f.actualPrice) || 0) + (parseFloat(f.markup) || 0);

  const inp: any = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', colorScheme: 'dark' };
  const lbl: any = { fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 };
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };

  async function save() {
    if (!f.tourName.trim() || !f.actualPrice) { toast.error('Tur nomi va narx kerak'); return; }
    setSaving(true);
    try {
      const hotels = f.hotels
        .map(h => ({ name: h.name.trim(), stars: h.stars ? parseInt(String(h.stars)) : null, photos: h.photos || [] }))
        .filter(h => h.name);
      const data = {
        clientId, ...f,
        actualPrice: parseFloat(f.actualPrice),
        markup: parseFloat(f.markup) || 0,
        clientPrice,
        pax: parseInt(String(f.pax)) || 1,
        hotels,
      };
      const r = isEdit
        ? await api.put(`/offers/${existingOffer.id}`, data)
        : await api.post('/offers', data);
      if (sendNow && !isEdit) await api.post(`/offers/${r.data.id}/send`, { clientId });
      toast.success(isEdit ? 'Taklif yangilandi!' : (sendNow ? 'Taklif yuborildi!' : 'Taklif saqlandi'));
      onSaved(r.data);
    } catch (e: any) { toast.error(errMsg(e)); setSaving(false); }
  }

  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{isEdit ? '✏️ Taklifni tahrirlash' : '📨 Yangi taklif'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Tur nomi *</label><input style={inp} value={f.tourName} onChange={e => set('tourName', e.target.value)} placeholder="Turkiya — Antalya 7 kun" /></div>
          <div><label style={lbl}>Yo'nalish</label><input style={inp} value={f.destination} onChange={e => set('destination', e.target.value)} /></div>
          <div><label style={lbl}>Kishi soni</label><input type="number" min={1} style={inp} value={f.pax} onChange={e => set('pax', e.target.value)} /></div>
          <div>
            <label style={lbl}>Jo'nab ketish</label>
            <input type="date" style={inp} value={f.departDate} onChange={e => set('departDate', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Qaytish</label>
            <input type="date" style={inp} value={f.returnDate} onChange={e => set('returnDate', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Parvoz vaqti (ixtiyoriy)</label>
            <input type="time" style={inp} value={f.departFlightTime} onChange={e => set('departFlightTime', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Qaytish parvoz vaqti (ixtiyoriy)</label>
            <input type="time" style={inp} value={f.returnFlightTime} onChange={e => set('returnFlightTime', e.target.value)} />
          </div>
          {/* Pricing */}
          <OfferPricingBox f={f} set={set} inp={inp} lbl={lbl} clientPrice={clientPrice} />

          {/* Hotels (2-5 ta variant + rasmlar) */}
          <HotelsPicker hotels={f.hotels} setHotels={setHotels} inp={inp} lbl={lbl} />

          {/* Ovqatlanish — bitta tanlov */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Ovqatlanish</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['NONE', 'Yo\'q'], ['BREAKFAST', '🍳 Nonushta'], ['FULL_BOARD', '🍽 3 mahal (to\'liq)']].map(([val, label]) => {
                const active = f.mealPlan === val;
                return (
                  <button key={val} type="button" onClick={() => set('mealPlan', val)} style={{
                    padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
                    background: active ? 'var(--primary)' : 'var(--bg-2)',
                    color: active ? '#fff' : 'var(--fg)',
                  }}>{label}</button>
                );
              })}
            </div>
          </div>

          {/* Kiritilgan xizmatlar */}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[['includesFlight','✈️ Aviabilet'],['includesHotel','🏨 Mehmonxona'],['includesTransfer','🚕 Transfer'],['includesInsurance','🛡 Sug\'urta'],['includesVisa','🛂 Viza']].map(([k,l]) => (
              <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={(f as any)[k]} onChange={e => set(k, e.target.checked)} /> {l}
              </label>
            ))}
          </div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Izoh</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {!isEdit && (
              <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} /> Darhol yuborish
              </label>
            )}
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>Bekor</button>
            <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
              {saving ? '...' : isEdit ? '💾 Saqlash' : sendNow ? '✉️ Yuborish' : '💾 Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hotels Picker (2-5 ta mehmonxona variant, har biriga rasm) ───────────────
function HotelsPicker({ hotels, setHotels, inp, lbl }: any) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const addHotel = () => { if (hotels.length < 5) setHotels([...hotels, { name: '', stars: '', photos: [] }]); };
  const removeHotel = (i: number) => setHotels(hotels.filter((_: any, idx: number) => idx !== i));
  const updateHotel = (i: number, patch: any) => setHotels(hotels.map((h: any, idx: number) => idx === i ? { ...h, ...patch } : h));

  const uploadPhotos = async (i: number, files: FileList | null) => {
    if (!files || !files.length) return;
    setUploadingIdx(i);
    try {
      const fd = new FormData();
      Array.from(files).slice(0, 6).forEach((file) => fd.append('files', file));
      const r = await api.post('/uploads/batch', fd);
      const urls = (r.data?.files || []).map((x: any) => x.url).filter(Boolean);
      updateHotel(i, { photos: [...(hotels[i].photos || []), ...urls].slice(0, 6) });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setUploadingIdx(null);
    }
  };
  const removePhoto = (i: number, url: string) => updateHotel(i, { photos: (hotels[i].photos || []).filter((p: string) => p !== url) });

  return (
    <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={lbl}>Mehmonxonalar (klientga 2-5 ta variant taklif qilish mumkin)</label>
      {hotels.map((h: any, i: number) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: hotels.length > 1 ? '2fr 1fr auto' : '2fr 1fr', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ ...lbl, marginBottom: 2 }}>Nomi</label>
              <input style={inp} value={h.name} onChange={(e: any) => updateHotel(i, { name: e.target.value })} placeholder={`Mehmonxona ${i + 1}`} />
            </div>
            <div>
              <label style={{ ...lbl, marginBottom: 2 }}>Yulduz</label>
              <select style={inp} value={h.stars || ''} onChange={(e: any) => updateHotel(i, { stars: e.target.value })}>
                <option value="">—</option>
                {[3, 4, 5].map((n) => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
              </select>
            </div>
            {hotels.length > 1 && (
              <button type="button" onClick={() => removeHotel(i)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-3)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {(h.photos || []).map((p: string) => (
              <div key={p} style={{ position: 'relative', width: 46, height: 46, borderRadius: 6, overflow: 'hidden' }}>
                <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                <button type="button" onClick={() => removePhoto(i, p)} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', width: 16, height: 16, fontSize: 10, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>✕</button>
              </div>
            ))}
            <label style={{ width: 46, height: 46, borderRadius: 6, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: 'var(--fg-3)' }}>
              {uploadingIdx === i ? '…' : '📷'}
              <input type="file" accept="image/*" multiple hidden onChange={(e: any) => uploadPhotos(i, e.target.files)} />
            </label>
          </div>
        </div>
      ))}
      {hotels.length < 5 && (
        <button type="button" onClick={addHotel} style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Yana mehmonxona qo'shish</button>
      )}
    </div>
  );
}

// ─── Inline Booking Modal (client detail ichida) ──────────────────────────────
// ─── v10.3: Taklifdan booking yaratish (6-rasm ko'rinishida, prefilled + editable) ───
function OfferBookingModal({ offer: o, clientId, onClose, onSaved }: any) {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';
  const [form, setForm] = useState<any>({
    tourName: o.tourName || '',
    destination: o.destination || '',
    tourType: 'PACKAGE',
    departureDate: o.departDate ? String(o.departDate).slice(0, 10) : '',
    returnDate: o.returnDate ? String(o.returnDate).slice(0, 10) : '',
    adults: o.pax || 1,
    children: 0,
    totalPrice: o.clientPrice ?? '',
    supplierCost: o.actualPrice ?? '',
    discount: 0,
    currency: 'USD',
    notes: o.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const profit = Math.max(0, (Number(form.totalPrice) || 0) - (Number(form.supplierCost) || 0) - (Number(form.discount) || 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tourName.trim() || !form.destination.trim() || !form.totalPrice) {
      toast.error("Tur nomi, yo'nalish va narx kerak");
      return;
    }
    setSaving(true);
    try {
      // mark-sold: booking yaratadi + tasdiqlaydi + taklifni "sotildi" qiladi
      await api.post(`/offers/${o.id}/mark-sold`, { clientId, overrides: form });
      toast.success('✅ Booking yaratildi — taklif sotildi deb belgilandi!');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  const lbl: any = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 };
  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 14, padding: 24, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>✈️ Yangi booking</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 14, padding: '7px 11px', background: 'var(--bg-2)', borderRadius: 8 }}>
          "{o.tourName}" taklifidan to'ldirildi — kerakli joyini tahrirlab, tasdiqlang.
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Tur nomi *</label>
            <input style={inp} value={form.tourName} onChange={(e) => set('tourName', e.target.value)} placeholder="Masalan: Dubay 7 kunlik" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Yo'nalish *</label>
              <input style={inp} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Dubay, UAE" />
            </div>
            <div>
              <label style={lbl}>Tur turi</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.tourType} onChange={(e) => set('tourType', e.target.value)}>
                <option value="PACKAGE">Paket</option>
                <option value="CUSTOM">Individual</option>
                <option value="GROUP">Guruh</option>
                <option value="UMRAH">Umra</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Jo'nab ketish sanasi</label>
              <input type="date" style={inp} value={form.departureDate} onChange={(e) => set('departureDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Qaytish sanasi</label>
              <input type="date" style={inp} value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Kattalar soni</label>
              <input type="number" min={1} style={inp} value={form.adults} onChange={(e) => set('adults', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Bolalar soni</label>
              <input type="number" min={0} style={inp} value={form.children} onChange={(e) => set('children', e.target.value)} />
            </div>
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Klient narxi (Sale Price) *</label>
              <input type="number" min={0} step="0.01" style={{ ...inp, background: 'var(--bg)' }} value={form.totalPrice} onChange={(e) => set('totalPrice', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Operator narxi (Cost)</label>
              <input type="number" min={0} step="0.01" style={{ ...inp, background: 'var(--bg)' }} value={form.supplierCost} onChange={(e) => set('supplierCost', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Chegirma</label>
              <input type="number" min={0} step="0.01" style={{ ...inp, background: 'var(--bg)' }} value={form.discount} onChange={(e) => set('discount', e.target.value)} placeholder="0" />
            </div>
            <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--fg-3)' }}>
              Foyda: <b style={{ color: 'var(--success)' }}>{form.currency} {profit.toLocaleString()}</b>
            </div>
          </div>
          <div>
            <label style={lbl}>Valyuta</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {['USD', 'UZS', 'EUR'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Izoh</label>
            <textarea style={{ ...inp, minHeight: 76, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontWeight: 600 }}>Bekor</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Yaratilmoqda...' : '✈️ Booking yaratish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

  // Valyuta USD bo'lmasa — CBU.uz kursini live tortib kelamiz (faqat
  // ko'rsatish/preview uchun; haqiqiy konvertatsiya backendda amalga oshiriladi)
  const [fxRate, setFxRate] = useState<number | null>(null);
  const isForeign = form.currency && form.currency !== 'USD';
  useEffect(() => {
    if (!isForeign) { setFxRate(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/exchange-rate/usd', { params: { currency: form.currency } });
        if (!cancelled) setFxRate(r.data?.rate || null);
      } catch { if (!cancelled) setFxRate(null); }
    })();
    return () => { cancelled = true; };
  }, [form.currency, isForeign]);
  const usdTotalPreview = isForeign && fxRate ? totalPrice / fxRate : null;

  const usdSupplierCostPreview = isForeign && fxRate ? supplierCost / fxRate : null;
  const usdProfitPreview = isForeign && fxRate ? profit / fxRate : null;
  const currencySymbol = form.currency === 'USD' ? '$' : '';
  const currencySuffix = form.currency !== 'USD' ? ' ' + form.currency : '';
  const fmtAmt = (n: number) => currencySymbol + n.toLocaleString() + currencySuffix;

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

  const inp: any = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', colorScheme: 'dark' };
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
            <div>
              <label style={lbl}>Chegirma</label>
              <input type="number" style={inp} value={form.discount} onChange={e => set('discount', e.target.value)} placeholder="0" />
            </div>
            {totalPrice > 0 && (
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: '#6366f115', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>KLIENT NARXI</div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{fmtAmt(totalPrice)}</div>
                  {isForeign && usdTotalPreview != null && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>≈ ${usdTotalPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  )}
                </div>
                {supplierCost > 0 && (
                  <div style={{ padding: '8px 14px', background: '#f59e0b15', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>MARKUP (USTAMA)</div>
                    <div style={{ fontWeight: 800, color: '#f59e0b' }}>+{fmtAmt(totalPrice - supplierCost - discount)}</div>
                  </div>
                )}
                <div style={{ padding: '8px 14px', background: profit > 0 ? '#10b98115' : '#ef444415', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>FOYDA (OYLIK ASOSI)</div>
                  <div style={{ fontWeight: 800, color: profit > 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(profit)}</div>
                  {isForeign && usdProfitPreview != null && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>≈ ${usdProfitPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  )}
                </div>
              </div>
            )}
            {isForeign && (
              <div style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--fg-3)' }}>
                💱 Saqlanganda CBU.uz rasmiy kursi bo'yicha avtomatik USD ga o'giriladi va shu tarzda hisoblanadi.
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Valyuta</label>
            <select style={inp} value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['USD','EUR','UZS','RUB'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {isForeign && (
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
                {fxRate
                  ? `1 USD ≈ ${fxRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${form.currency}${usdTotalPreview != null ? ` · ≈ $${usdTotalPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}`
                  : 'Kurs yuklanmoqda...'}
              </div>
            )}
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

  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', colorScheme: 'dark' };
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

// ─── Client Edit Modal (Tahrirlash) — Mijoz + Sayohat ma'lumotlari birgalikda ──
function ClientEditModal({ client, onClose, onSaved }: any) {
  const ti = client.preferences?.travelInfo || {};
  const [form, setForm] = useState<any>({
    // ── Mijoz ma'lumotlari ──
    fullName: client.fullName || '',
    phone: client.phone || '',
    telegramUsername: client.telegramUsername || '',
    source: client.source || 'OTHER',
    tier: client.tier || 'REGULAR',
    status: client.status || 'ACTIVE',
    notes: client.notes || '',
    // ── Sayohat ma'lumotlari (Client.preferences.travelInfo ichida saqlanadi) ──
    destination: ti.destination || '',      // 4. Qayerga sayohat qilishi
    fromCity: ti.fromCity || '',             // 5. Qaysi shahardan
    adults: ti.adults ?? 1,                  // 6. Kattalar soni
    children: ti.children ?? 0,              // 6. Bolalar soni
    departDate: ti.departDate ? ti.departDate.slice(0, 10) : '',   // 7. Sana
    returnDate: ti.returnDate ? ti.returnDate.slice(0, 10) : '',   // 7. Sana
    approxDays: ti.approxDays ?? '',         // 7. Aniq sana yo'q bo'lsa — taxminiy kun
    hotelName: ti.hotelName || '',           // 8. Mehmonxona nomi
    hotelType: ti.hotelType || '',           // 9. Mehmonxona turi
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const inp: any = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', colorScheme: 'dark' };
  const lbl: any = { fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 5 };

  async function save() {
    if (!form.fullName.trim()) { toast.error('Mijoz ismi kerak'); return; }
    setSaving(true);
    try {
      await clientsApi.update(client.id, {
        fullName: form.fullName.trim(),
        phone: form.phone || undefined,
        telegramUsername: form.telegramUsername || undefined,
        source: form.source,
        tier: form.tier,
        status: form.status,
        notes: form.notes || undefined,
        // preferences: mavjud offerlar (va boshqa saqlangan ma'lumotlar) yo'qolib
        // ketmasligi uchun MAVJUD preferences bilan birlashtirib yuboramiz —
        // faqat travelInfo qismini yangilaymiz.
        preferences: {
          ...(client.preferences || {}),
          travelInfo: {
            destination: form.destination || undefined,
            fromCity: form.fromCity || undefined,
            adults: parseInt(String(form.adults)) || 1,
            children: parseInt(String(form.children)) || 0,
            departDate: form.departDate || undefined,
            returnDate: form.returnDate || undefined,
            approxDays: form.approxDays ? parseInt(String(form.approxDays)) : undefined,
            hotelName: form.hotelName || undefined,
            hotelType: form.hotelType || undefined,
          },
        },
      });
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="✏️ Mijoz va sayohat ma'lumotlari" maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ── Mijoz ma'lumotlari ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.3 }}>👤 Mijoz</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Ismi *</label>
              <input style={inp} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Telefon raqami</label>
              <input style={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+998901234567" />
            </div>
            <div>
              <label style={lbl}>Telegram username</label>
              <input style={inp} value={form.telegramUsername} onChange={(e) => set('telegramUsername', e.target.value)} placeholder="username (@ siz)" />
            </div>
            <div>
              <label style={lbl}>Manba</label>
              <select style={inp} value={form.source} onChange={(e) => set('source', e.target.value)}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tier</label>
              <select style={inp} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
                {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Sayohat ma'lumotlari ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.3 }}>✈️ Sayohat</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Qayerga sayohat qiladi</label>
              <input style={inp} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Masalan: Antalya, Turkiya" />
            </div>
            <div>
              <label style={lbl}>Qaysi shahardan</label>
              <input style={inp} value={form.fromCity} onChange={(e) => set('fromCity', e.target.value)} placeholder="Masalan: Toshkent" />
            </div>
            <div>
              <label style={lbl}>Kattalar</label>
              <input type="number" min={1} style={inp} value={form.adults} onChange={(e) => set('adults', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Bolalar</label>
              <input type="number" min={0} style={inp} value={form.children} onChange={(e) => set('children', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Jo'nab ketish sanasi</label>
              <input type="date" style={inp} value={form.departDate} onChange={(e) => set('departDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Qaytish sanasi</label>
              <input type="date" style={inp} value={form.returnDate} onChange={(e) => set('returnDate', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Taxminiy davomiyligi (kun) — aniq sana hali noma'lum bo'lsa</label>
              <input type="number" min={1} style={{ ...inp, maxWidth: 160 }} value={form.approxDays} onChange={(e) => set('approxDays', e.target.value)} placeholder="Masalan: 7" />
            </div>
            <div>
              <label style={lbl}>Mehmonxona nomi</label>
              <input style={inp} value={form.hotelName} onChange={(e) => set('hotelName', e.target.value)} placeholder="Agar mijoz allaqachon tanlagan bo'lsa" />
            </div>
            <div>
              <label style={lbl}>Mehmonxona turi</label>
              <select style={inp} value={form.hotelType} onChange={(e) => set('hotelType', e.target.value)}>
                <option value="">—</option>
                {Object.entries(HOTEL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label style={lbl}>Izoh</label>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
          <Btn onClick={save} loading={saving} style={{ flex: 1 }}>Saqlash</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Offer Pricing Box (admin sees all, agent sees only client price) ─────────
function OfferPricingBox({ f, set, inp, lbl, clientPrice }: any) {
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  // Valyuta USD bo'lmasa — CBU.uz kursini live tortib kelamiz (faqat ko'rsatish uchun,
  // haqiqiy konvertatsiya saqlanganda backendda amalga oshiriladi)
  useEffect(() => {
    if (!f.currency || f.currency === 'USD') { setFxRate(null); return; }
    let cancelled = false;
    setFxLoading(true);
    (async () => {
      try {
        const r = await api.get('/exchange-rate/usd', { params: { currency: f.currency } });
        if (!cancelled) setFxRate(r.data?.rate || null);
      } catch { if (!cancelled) setFxRate(null); }
      finally { if (!cancelled) setFxLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [f.currency]);

  const isForeign = f.currency && f.currency !== 'USD';
  const usdClientPrice = isForeign && fxRate ? clientPrice / fxRate : null;
  const paxNum = Math.max(1, parseInt(String(f.pax)) || 1);
  const perPerson = paxNum > 0 ? clientPrice / paxNum : clientPrice;
  const money = (n: number) => isForeign ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + f.currency : '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Diqqat: bu blokda ko'rinadigan Operator narxi/Foyda FAQAT CRM ichida
  // (taklifni yaratayotgan xodimga) ko'rinadi. Klientga yuboriladigan
  // xabar (OfferSendMenu) faqat "Mijozga narx"ni o'z ichiga oladi —
  // tan narx va foyda hech qachon mijozga chiqarilmaydi.
  return (
    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Operator narxi</label>
        <input type="number" style={inp} value={f.actualPrice} onChange={(e: any) => set('actualPrice', e.target.value)} placeholder="0" />
      </div>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Markup (ustama)</label>
        <input type="number" style={inp} value={f.markup} onChange={(e: any) => set('markup', e.target.value)} placeholder="0" />
      </div>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Valyuta</label>
        <select style={inp} value={f.currency || 'USD'} onChange={(e: any) => set('currency', e.target.value)}>
          {['USD', 'EUR', 'UZS', 'RUB'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isForeign && (
          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
            {fxLoading ? 'Kurs yuklanmoqda...' : fxRate ? `1 USD ≈ ${fxRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${f.currency}` : ''}
          </div>
        )}
      </div>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Mijozga narx (jami)</label>
        <div style={{ padding: '7px 10px', background: '#10b98115', borderRadius: 7, fontSize: 16, fontWeight: 700, color: '#10b981' }}>
          {money(clientPrice)}
        </div>
        {isForeign && usdClientPrice != null && (
          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>≈ ${usdClientPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        )}
        {paxNum > 1 && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{money(perPerson)} / kishi</div>}
      </div>
      {f.actualPrice && Number(f.actualPrice) > 0 && (
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12, padding: '8px 10px', background: '#8b5cf610', borderRadius: 7, fontSize: 12 }}>
          <span>Foyda: <b style={{ color: '#8b5cf6' }}>{money(clientPrice - Number(f.actualPrice))}</b></span>
          <span style={{ color: 'var(--fg-3)' }}>({Math.round(((clientPrice - Number(f.actualPrice)) / clientPrice) * 100)}% margin)</span>
        </div>
      )}
      {isForeign && (
        <div style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--fg-3)' }}>
          💱 Saqlanganda CBU.uz rasmiy kursi bo'yicha avtomatik USD ga o'giriladi va shu tarzda hisoblanadi.
        </div>
      )}
      <div style={{ gridColumn: '1/-1', fontSize: 10, color: 'var(--fg-3)' }}>
        🔒 Operator narxi va foyda faqat CRM ichida ko'rinadi — mijozga yuboriladigan xabarda chiqmaydi.
      </div>
    </div>
  );
}

// ─── Offer Send Menu (Telegram) ──────────────────────────────────
// v11: matn shabloni va bot/shaxsiy akkaunt tanlovi endi BACKEND tomonida
// (OffersService.buildOfferMessage + send()) hal qilinadi — mavjud suhbat
// bo'lsa o'shandan davom etadi, bo'lmasa (birinchi xabar) avtomatik
// shaxsiy akkauntdan yuboradi. Frontend faqat bitta so'rov yuboradi —
// oldingi versiyada bu yerda IKKINCHI marta (qo'lda) userTelegramApi orqali
// ham yuborilardi, natijada xabar DUBLIKAT ketardi. Endi olib tashlandi.
function OfferSendMenu({ offerId, clientId, onSent, fullWidth }: any) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const r = await api.post('/offers/' + offerId + '/send', { clientId });
      onSent();
      const via = r.data?.via;
      toast.success(
        via === 'personal'
          ? '✅ Taklif shaxsiy Telegram orqali yuborildi!'
          : '✅ Taklif Telegram orqali yuborildi!'
      );
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <button onClick={send} disabled={sending} style={fullWidth ? {
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
      padding: '9px 12px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fg)',
    } : {
      padding: '7px 14px', borderRadius: 8, border: 'none',
      background: 'var(--info-soft)', color: 'var(--info)',
      cursor: 'pointer', fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      opacity: sending ? 0.7 : 1,
    }}>
      {sending ? '⏳ Yuborilmoqda...' : '📤 Yuborish'}
    </button>
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
    // XAVFSIZLIK TUZATISH: token memory'dan (localStorage emas)
    return getAccessToken() || '';
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
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';
  const [showBookingSendModal, setShowBookingSendModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const allPayments = bookings.flatMap((b: any) =>
    (b.payments || []).map((p: any) => ({ ...p, bookingRef: b.bookingRef, bookingId: b.id }))
  );

  async function markPaid(b: any) {
    const balance = Math.max(0, (b.totalPrice || 0) - (b.paidAmount || 0));
    if (balance <= 0) return;
    if (!window.confirm(`"${b.tourName}" uchun qolgan ${b.currency} ${balance.toLocaleString()} to'landi deb belgilaysizmi?`)) return;
    setMarkingPaidId(b.id);
    try {
      await paymentsApi.addManual({ bookingId: b.id, amount: balance, currency: b.currency, method: 'CASH', note: "Agent tomonidan to'landi deb belgilandi" });
      toast.success("✅ To'landi deb belgilandi");
      onRefresh?.();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Booking bo'yicha xulosa: narx, markup/foyda, to'langan, qoldiq */}
      {bookings.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>💰 To'lov holati</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bookings.map((b: any) => {
              const total = b.totalPrice || 0;
              const paid = b.paidAmount || 0;
              const balance = Math.max(0, total - paid);
              const markup = Math.max(0, total - (b.supplierCost || 0) - (b.discount || 0));
              const isPaid = balance <= 0 && total > 0;
              return (
                <div key={b.id} style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{b.tourName} <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>· {b.bookingRef}</span></div>
                    <span style={{
                      fontSize: 10, padding: '2px 9px', borderRadius: 999, fontWeight: 700,
                      background: isPaid ? 'var(--success-soft)' : 'var(--warning-soft)',
                      color: isPaid ? 'var(--success)' : 'var(--warning)',
                    }}>{isPaid ? "✅ TO'LANDI" : "⏳ TO'LANMAGAN"}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--fg-4)', fontSize: 10 }}>Narx</div>
                      <div style={{ fontWeight: 700 }}>{b.currency} {total.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--fg-4)', fontSize: 10 }}>Markup / foyda</div>
                      <div style={{ fontWeight: 700, color: '#f59e0b' }}>{b.currency} {markup.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--fg-4)', fontSize: 10 }}>To'langan</div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>{b.currency} {paid.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--fg-4)', fontSize: 10 }}>Qoldiq</div>
                      <div style={{ fontWeight: 700, color: balance > 0 ? 'var(--warning)' : 'var(--fg-4)' }}>{b.currency} {balance.toLocaleString()}</div>
                    </div>
                  </div>
                  {balance > 0 && (
                    <button
                      disabled={markingPaidId === b.id}
                      onClick={() => markPaid(b)}
                      style={{ marginTop: 8, fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--success)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                    >{markingPaidId === b.id ? '...' : "✅ To'landi deb belgilash"}</button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* To'lovlar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>💳 To'lovlar tarixi</h3>
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