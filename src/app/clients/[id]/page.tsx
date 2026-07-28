'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { v8Api, clientsApi, tasksApi, followUpsApi, telegramApi, bookingsApi, userTelegramApi, paymentsApi, api, getAccessToken, callsApi } from '@/services/api';
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
  // v14: Faoliyat filtri parent'da — "Takliflar" bosilganda pastdagi taklif
  // kartalari ko'rinadi, "Chat"da yashiriladi.
  const [activeFilter, setActiveFilter] = useState<'all' | 'chat' | 'offer' | 'note'>('all');
  const [showOfferCreate, setShowOfferCreate] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  // v29: "Nusxalash" — eski taklifni asos qilib, YANGI taklif ochadi (tahrirlash emas)
  const [duplicatingOffer, setDuplicatingOffer] = useState<any>(null);
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
            // v14 FIX: backend { messages, conversation } qaytaradi — avval noto'g'ri
            // `mr.data.data` o'qilardi, shu sabab CHAT xabarlari umuman chiqmasdi.
            .then((mr: any) => setChatMsgs(Array.isArray(mr.data) ? mr.data : (mr.data?.messages || mr.data?.data || [])))
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
                <StagePill clientId={c.id} stage={c.pipelineStage} />
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
            {/* v29: eng birinchi ko'rinadigan narsa — mijoz qayerga bormoqchi
                va qancha puli bor. Bu ma'lumot ilgari umuman ko'rinmasdi
                (offer/booking yaratilmaguncha) yoki erkin eslatmalar ichida
                yo'qolib qolardi. */}
            <KeyInfoBlock client={c} />

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

            <CollapsibleSection title="Umumiy ma'lumot" storageKey="client-general-info" defaultOpen={true}>
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

              {/* v15: So'nggi booking qisqacha — agent bir qarashda mijoz
                  hozir qanday bosqichda ekanini (tur, holat, to'lov) ko'radi,
                  pastga tushib Bookinglar bo'limini qidirishi shart emas. */}
              {c.bookings?.length > 0 && (() => {
                const latest = c.bookings[0];
                return (
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--fg-4)', fontSize: 11, marginBottom: 4 }}>So'nggi booking</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{latest.tourName}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{latest.status}{latest.destination ? ' · ' + latest.destination : ''}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{latest.currency} {latest.paidAmount || 0} / {latest.totalPrice}</div>
                  </div>
                );
              })()}
            </div>
            </CollapsibleSection>

            {/* v14: mijozning ixtiyoriy ma'lumotlari (key = value) —
                CustomFields o'zining sarlavhasi/Tahrirlash tugmasini o'zi
                boshqaradi, shuning uchun qo'shimcha CollapsibleSection bilan
                o'ralmaydi (aks holda ikki sarlavha ustma-ust chiqib qolardi). */}
            <CustomFields client={c} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
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

          {/* ── O'NG: faoliyat (chat) tepada qotib turadi + takliflar + bookinglar pastda aylanadi ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, minWidth: 0 }}>

            {/* v15: Faoliyat (chat) ENDI ENG TEPADA — agent sahifaga kirgan
                zahoti chatni ko'radi va yoza oladi, uni qidirib pastga
                tushirishi shart emas. "sticky" bo'lgani uchun Takliflar/
                Bookinglar ro'yxatini pastga aylantirsa ham, chat ekranning
                yuqorisida QOTIB turadi. */}
            <div style={{
              position: 'sticky', top: 70, zIndex: 5,
              maxHeight: 'calc(100vh - 90px)', overflowY: 'auto',
              background: 'var(--bg)', borderRadius: 12,
            }}>
              <ActivityFeed
                client={c}
                conversation={data.activeConversation}
                chatMsgs={chatMsgs}
                chatLoading={chatLoading}
                onStartChat={() => setShowPersonalMsg(true)}
                onRefresh={load}
                filter={activeFilter}
                onFilterChange={setActiveFilter}
              />
            </div>

            {/* Takliflar — v14: faqat "Hammasi" yoki "Takliflar" filtrida ko'rinadi
                (Chat/Izohlar tanlanganda yashiriladi — orqada chiqib turmaydi) */}
            {(activeFilter === 'all' || activeFilter === 'offer') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Takliflar</span>
                <button onClick={() => setShowOfferCreate(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer' }}>+ Yangi</button>
              </div>

              {offers.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8 }}>
                  Hali taklif yuborilmagan
                </div>
              ) : (() => {
                // v14: booking'ga aylangan (sotilgan) takliflar ro'yxatning ENG PASTIDA
                const isSold = (o: any) => o?.status === 'SOLD' || o?.status === 'CONVERTED' || !!o?.bookingId;
                const offersSorted = [...offers].sort((a: any, b: any) => (isSold(a) ? 1 : 0) - (isSold(b) ? 1 : 0));
                const groups = groupDuplicateOffers(offersSorted);
                return (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  {groups.map((group: any[], gi: number) => (
                    <OfferGroupRow
                      key={group[0].id}
                      group={group}
                      isLast={gi === groups.length - 1}
                      clientId={id}
                      clientPhone={c.phone}
                      clientUsername={c.telegramUsername}
                      onSent={(offerId: string) => setOffers((prev: any[]) => prev.map((x: any) => x.id === offerId ? { ...x, status: 'SENT' } : x))}
                      onEdit={(o: any) => setEditingOffer(o)}
                      onDuplicate={(o: any) => setDuplicatingOffer(o)}
                      onSold={(o: any) => setOfferBooking(o)}
                      sellingOfferId={sellingOfferId}
                    />
                  ))}
                </div>
                );
              })()}

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
              {/* v29: Nusxalash — eski taklif asosida YANGI taklif yaratadi (POST, PUT emas) */}
              {duplicatingOffer && (
                <OfferCreateModal
                  clientId={id}
                  duplicateOffer={duplicatingOffer}
                  onClose={() => setDuplicatingOffer(null)}
                  onSaved={(o: any) => { setOffers((prev: any[]) => [o, ...prev]); setDuplicatingOffer(null); }}
                />
              )}
            </div>
            )}

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

            {/* Qo'ng'iroqlar va ovoz yozuvlari — booking bo'lmasa ham ko'rinadi */}
            <ClientCalls clientId={c.id} />
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


/**
 * QO'NG'IROQLAR VA YOZUVLAR — mijoz kartochkasi ichida.
 *
 * Shu mijoz bilan bo'lgan barcha suhbatlar: sana/vaqt, yo'nalish
 * (kiruvchi/chiquvchi), davomiylik va ovoz yozuvi.
 *
 * Yozuv faqat ATS uni bergan bo'lsa ko'rinadi (OnlinePBX'da
 * "yozib olish" yoqilgan bo'lishi kerak).
 */
function ClientCalls({ clientId }: { clientId: string }) {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      callsApi.list(clientId)
        .then((r: any) => { if (alive) setCalls(r.data?.data || r.data || []); })
        .catch(() => { /* telefoniya sozlanmagan bo'lishi mumkin — jim */ })
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    // Yozuv qo'ng'iroq tugagach bir necha daqiqa kechikib kelishi mumkin
    // (MoiZvonki uni serverida qayta ishlab, keyin CRM'ga jo'natadi) —
    // shu sabab sahifa ochiq turganda har 30 soniyada avtomatik yangilanadi.
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [clientId]);

  if (loading) return null;
  if (!calls.length) return null;

  const fmtDur = (sec: number) => {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} son`;
  };

  const withRec = calls.filter((c: any) => c.recordingUrl).length;
  const totalDuration = calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0);

  return (
    <div style={{ paddingTop: 18, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          📞 Qo'ng'iroqlar
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-bg, #3d7eff1a)',
            padding: '1px 8px', borderRadius: 999,
          }}>{calls.length}</span>
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
          {withRec > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>🎙 {withRec} yozuv</span>}
          {withRec > 0 && totalDuration > 0 && ' · '}
          {totalDuration > 0 && `jami ${fmtDur(totalDuration)}`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {calls.map((c: any) => {
          const inbound = c.direction === 'INBOUND';
          const missed = ['NO_ANSWER', 'MISSED', 'BUSY', 'FAILED'].includes(c.status);
          const when = c.startedAt || c.createdAt;
          // Suhbat bo'lgan (davomiyligi bor), lekin yozuv HALI kelmagan —
          // odatiy holat, chunki MoiZvonki yozuvni qo'ng'iroqdan keyin
          // qayta ishlab, biroz kechikib yuboradi. Bunda "yozuv yo'q" deb
          // emas, "tayyorlanmoqda" deb ko'rsatamiz — foydalanuvchi
          // tashvishlanmasin.
          const recordingPending = !c.recordingUrl && !missed && (c.duration || 0) > 0;

          return (
            <div key={c.id} style={{
              border: '1px solid var(--border)', borderRadius: 12,
              background: 'var(--bg-2, #fff)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
                {/* Yo'nalish ikonkasi */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  background: missed ? '#ef444418' : (inbound ? '#10b98118' : '#3d7eff18'),
                  color: missed ? '#ef4444' : (inbound ? '#10b981' : '#3d7eff'),
                }}>
                  {missed ? '✕' : (inbound ? '↙' : '↗')}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {inbound ? 'Kiruvchi qo\u2018ng\u2018iroq' : 'Chiquvchi qo\u2018ng\u2018iroq'}
                    </span>
                    {missed && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#ef4444', background: '#ef444414', padding: '1px 7px', borderRadius: 999 }}>
                        JAVOBSIZ
                      </span>
                    )}
                    {c.agent?.name && (
                      <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                        · 👤 {c.agent.name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 1 }}>
                    {when ? new Date(when).toLocaleString('uz-UZ', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                    {c.duration > 0 && <> · ⏱ {fmtDur(c.duration)}</>}
                  </div>
                </div>

                {recordingPending && (
                  <span style={{ fontSize: 10.5, color: 'var(--fg-4)', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                    ⏳ yozuv tayyorlanmoqda
                  </span>
                )}
              </div>

              {/* Ovoz pleyeri — yozuv bo'lsa doim ko'rinadi (yashirilmaydi) */}
              {c.recordingUrl && (
                <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <audio controls src={c.recordingUrl} style={{ flex: 1, height: 36 }}>
                    Brauzeringiz audio pleyerni qo'llab-quvvatlamaydi.
                  </audio>
                  <a
                    href={c.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Yuklab olish"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      border: '1px solid var(--border)', color: 'var(--fg-2)', textDecoration: 'none', fontSize: 13,
                    }}
                  >
                    ⬇
                  </a>
                </div>
              )}

              {c.notes && (
                <div style={{ padding: '0 14px 12px', fontSize: 12, color: 'var(--fg-3)' }}>
                  {c.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  // v15: bosqich o'zgarganda BUTUN sahifa refresh bo'lardi (onChanged→load).
  // Endi lokal holatда optimistik yangilanadi — sahifa qayta yuklanmaydi.
  const [localStage, setLocalStage] = useState(stage);
  useEffect(() => { setLocalStage(stage); }, [stage]);

  async function change(newStage: string) {
    if (newStage === localStage) { setOpen(false); return; }
    const prev = localStage;
    setLocalStage(newStage);   // optimistik — darhol ko'rinadi
    setOpen(false);
    setSaving(true);
    try {
      const { pipelineApi } = await import('@/services/api');
      await pipelineApi.move(clientId, newStage);
      toast.success('Bosqich yangilandi');
      onChanged?.(newStage);   // ixtiyoriy: reload EMAS, faqat xabar
    } catch (e: any) {
      setLocalStage(prev);     // xato bo'lsa qaytaramiz
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} disabled={saving} style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: '2px 10px', borderRadius: 999,
        background: (STAGE_COLORS[localStage] || 'var(--fg-3)') + '20', color: STAGE_COLORS[localStage] || 'var(--fg-3)',
        border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>
        {STAGE_LABELS[localStage] || localStage} <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{ position: 'absolute', left: 0, top: 26, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 11, minWidth: 170, maxHeight: 300, overflowY: 'auto' }}>
            {STAGE_OPTIONS.map((s) => (
              <button key={s} onClick={() => change(s)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                background: s === localStage ? 'var(--bg-3)' : 'none', color: STAGE_COLORS[s] || 'var(--fg)',
                fontWeight: s === localStage ? 700 : 500,
              }}>{STAGE_LABELS[s]}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── v29: HubSpot uslubidagi yig'iladigan bo'lim — sarlavha bosilsa
// ichidagi kontent yashiriladi/ko'rsatiladi, holat brauzerda eslab qolinadi
// (sahifani qayta ochganda ham saqlanadi). Chap paneldagi ma'lumotlarni
// tartibli, kerak bo'lganda yig'ib qo'yish mumkin qilib beradi. ──────────
function CollapsibleSection({ title, defaultOpen = true, storageKey, children }: any) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const saved = window.localStorage.getItem(`cf_section_${storageKey}`);
    return saved === null ? defaultOpen : saved === '1';
  });
  function toggle() {
    setOpen((prev: boolean) => {
      const next = !prev;
      window.localStorage.setItem(`cf_section_${storageKey}`, next ? '1' : '0');
      return next;
    });
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 6px',
          color: 'var(--fg-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}>▼</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Mijoz qo'shimcha ma'lumotlari (chiroyli ko'rinish + tahrirlash) ──────────
// ─── v29: "Nima xohlaydi" — Yo'nalish + Byudjet. Har bir mijozda BIR XIL
// joyda, bir xil nom bilan turadi (CustomFields'dagi kabi erkin nom emas).
// Agent kartaga kirgan zahoti — hatto pastga tushmasdan — mijoz qayerga
// bormoqchi va qancha puli borligini ko'radi. ────────────────────────────
function KeyInfoBlock({ client }: any) {
  const initial = client?.preferences?.keyInfo || { destination: '', budget: '', budgetCurrency: 'USD' };
  const [val, setVal] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasData = !!(baseline.destination || baseline.budget);

  function startEdit() { setVal(baseline); setEditing(true); }
  function cancel() { setVal(baseline); setEditing(false); }
  async function save() {
    setSaving(true);
    try {
      await clientsApi.setKeyInfo(client.id, val);
      setBaseline(val);
      setEditing(false);
      toast.success('Saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  const inp: any = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' };

  if (editing) {
    return (
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', marginBottom: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 3 }}>🎯 Qayerga borishni xohlaydi</div>
            <input style={inp} placeholder="masalan: Antalya, Turkiya" value={val.destination} onChange={e => setVal((v: any) => ({ ...v, destination: e.target.value }))} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 3 }}>💰 Taxminiy byudjet</div>
              <input style={inp} placeholder="masalan: 2000" value={val.budget} onChange={e => setVal((v: any) => ({ ...v, budget: e.target.value }))} />
            </div>
            <div style={{ width: 78 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 3 }}>Valyuta</div>
              <select style={inp} value={val.budgetCurrency} onChange={e => setVal((v: any) => ({ ...v, budgetCurrency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="UZS">UZS</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={cancel} disabled={saving} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }}>Bekor</button>
          <button onClick={save} disabled={saving} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 600 }}>{saving ? '...' : 'Saqlash'}</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={startEdit}
      title="Bosib tahrirlash"
      style={{
        padding: 12, borderRadius: 10, marginBottom: 18, cursor: 'pointer',
        background: hasData ? 'rgba(61,126,255,0.07)' : 'var(--bg-3)',
        border: '1px solid ' + (hasData ? 'rgba(61,126,255,0.25)' : 'var(--border)'),
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Yo'nalish</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: baseline.destination ? 'var(--fg)' : 'var(--fg-4)' }}>
            {baseline.destination || 'Kiritilmagan — bosing'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 16 }}>💰</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Taxminiy byudjet</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: baseline.budget ? 'var(--fg)' : 'var(--fg-4)' }}>
            {baseline.budget ? `${baseline.budget} ${baseline.budgetCurrency}` : 'Kiritilmagan — bosing'}
          </div>
        </div>
      </div>
    </div>
  );
}

// v29: amoCRM uslubida — maydon NOMINI agent har safar o'zi o'ylab
// yozmaydi (natijada "dfdf", "asd" kabi mazmunsiz yozuvlar chiqardi).
// Buning o'rniga tayyor, sayohat agentligiga xos nomlar ro'yxatidan
// tanlanadi; kerak bo'lsa "Boshqa..." orqali o'zi ham kiritishi mumkin.
const PRESET_FIELD_LABELS = [
  "Pasport seriyasi",
  "Pasport amal qilish muddati",
  "Tug'ilgan sana",
  "Viza holati",
  "Necha kishi safar qiladi",
  "Bolalar yoshi",
  "Otel darajasi (masalan: 5*)",
  "Ovqatlanish turi",
  "Uy manzili",
  "Qo'shimcha telefon raqami",
  "Izoh",
];

function CustomFields({ client }: any) {
  const initial = Array.isArray(client?.preferences?.customFields) ? client.preferences.customFields : [];
  const [fields, setFields] = useState<{ key: string; value: string }[]>(initial);
  // v29: qaysi qatorlar "erkin nom" rejimida ekanini kuzatib boradi (preset
  // ro'yxatida bo'lmagan, eski saqlangan nomlar uchun).
  const [customKeyMode, setCustomKeyMode] = useState<Set<number>>(() => new Set(
    initial.map((f: any, i: number) => (f.key && !PRESET_FIELD_LABELS.includes(f.key) ? i : -1)).filter((i: number) => i >= 0)
  ));
  const [baseline, setBaseline] = useState<{ key: string; value: string }[]>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const upd = (i: number, k: 'key' | 'value', v: string) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  const add = () => setFields((prev) => [...prev, { key: '', value: '' }]);
  const remove = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));
  const markCustom = (i: number) => setCustomKeyMode((prev) => new Set(prev).add(i));

  function startEdit() {
    const base = baseline.length ? baseline : [{ key: '', value: '' }];
    setFields(base);
    setCustomKeyMode(new Set(base.map((f, i) => (f.key && !PRESET_FIELD_LABELS.includes(f.key) ? i : -1)).filter((i) => i >= 0)));
    setEditing(true);
  }
  function cancel() {
    setFields(baseline);
    setEditing(false);
  }
  async function save() {
    setSaving(true);
    try {
      const clean = fields.filter((f) => f.key.trim() || f.value.trim());
      await clientsApi.setCustomFields(client.id, clean);
      setFields(clean);
      setBaseline(clean);
      setEditing(false);
      toast.success('Ma\'lumot saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  const inp: any = { flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 12.5, boxSizing: 'border-box' };
  const saved = baseline.filter((f) => f.key.trim() || f.value.trim());

  return (
    <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ color: 'var(--fg-4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Qo'shimcha ma'lumot
        </div>
        {!editing && (
          <button onClick={startEdit} title="Tahrirlash" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
            padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', fontWeight: 600,
          }}>
            <FaPen size={9} /> Tahrirlash
          </button>
        )}
      </div>

      {/* KO'RISH REJIMI — chiroyli "yorliq: qiymat" ro'yxati */}
      {!editing && (
        saved.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {saved.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                padding: '9px 11px', background: 'var(--bg-3)', borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500, flexShrink: 0 }}>{f.key || '—'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{f.value || '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic', padding: '4px 0' }}>
            Hozircha ma'lumot yo'q — qo'shish uchun "Tahrirlash"ni bosing
          </div>
        )
      )}

      {/* TAHRIRLASH REJIMI — v29: "Nomi" endi erkin matn emas, tayyor
          ro'yxatdan tanlanadi (amoCRM uslubida) — mazmunsiz yozuvlarning
          oldi olinadi. Kerak bo'lsa "Boshqa..." bilan o'zi ham yozadi. */}
      {editing && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {fields.map((f, i) => {
              const isCustomKey = customKeyMode.has(i);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCustomKey ? (
                    <input
                      style={inp}
                      placeholder="Maydon nomi"
                      value={f.key}
                      onChange={(e) => upd(i, 'key', e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <select
                      style={inp}
                      value={f.key}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') { upd(i, 'key', ''); markCustom(i); }
                        else upd(i, 'key', e.target.value);
                      }}
                    >
                      <option value="">— Nomini tanlang —</option>
                      {PRESET_FIELD_LABELS.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                      <option value="__custom__">✏️ Boshqa (o'zim yozaman)</option>
                    </select>
                  )}
                  <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>:</span>
                  <input style={inp} placeholder="Qiymati" value={f.value} onChange={(e) => upd(i, 'value', e.target.value)} />
                  <button onClick={() => remove(i)} title="O'chirish" style={{
                    border: 'none', background: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer',
                    padding: '4px 6px', display: 'flex', alignItems: 'center',
                  }}><FaTrash size={11} /></button>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={add} style={{ fontSize: 12, padding: '5px 0', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              + Ma'lumot qo'shish
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={cancel} disabled={saving} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }}>
              Bekor
            </button>
            <button onClick={save} disabled={saving} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 600 }}>
              {saving ? '...' : 'Saqlash'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ActivityFeed({ client, conversation, chatMsgs, chatLoading, onStartChat, onRefresh, filter, onFilterChange }: any) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // v14: filter endi PARENT'da (controlled) — "Takliflar" bosilganda pastdagi
  // haqiqiy taklif kartalari ko'rinadi, "Chat"da esa ular yashiriladi.
  const feedFilter = filter || 'all';
  const setFeedFilter = (v: any) => onFilterChange?.(v);
  // v15: yozish qutisi endi FAQAT "Chat" va "Izohlar" tablarida ko'rinadi.
  // Rejim tab'ga bog'liq: Chat → mijozga xabar, Izohlar → ichki izoh.
  const composerMode: 'message' | 'note' = feedFilter === 'note' ? 'note' : 'message';
  const showComposer = feedFilter === 'chat' || feedFilter === 'note';
  // v14 FIX: har xabar yuborilganda BUTUN sahifa refresh bo'lardi (onRefresh→load)
  // va yozishmalar "sakrab" ketardi. Endi xabarlar LOKAL holatda saqlanadi:
  // yuborilgani darhol ko'rinadi (optimistik), so'ng jimgina qayta o'qiladi —
  // sahifa qayta yuklanmaydi.
  const [msgs, setMsgs] = useState<any[]>(chatMsgs || []);
  useEffect(() => { setMsgs(chatMsgs || []); }, [chatMsgs]);
  // v14: sahifa pastga scroll qilinganda yozishmalar paneli KICHRAYADI (headerga
  // taqalib faqat yozish maydoni qoladi) — shunda pastdagi ma'lumotlar oson topiladi.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const onScroll = () => setCollapsed((window.scrollY || document.documentElement.scrollTop || 0) > 120);
    window.addEventListener('scroll', onScroll, true);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  async function refetchMsgs() {
    if (!conversation?.id) return;
    try {
      const r = await telegramApi.messages(conversation.id);
      const list = r.data?.messages || r.data?.items || r.data || [];
      if (Array.isArray(list)) setMsgs(list);
    } catch {}
  }

  async function send() {
    const val = text.trim();
    if (!val) return;
    setSending(true);
    try {
      if (composerMode === 'note') {
        await clientsApi.addNote(client.id, val);
        toast.success('Izoh saqlandi');
        setText('');
        onRefresh?.(); // izoh timeline'ga tushadi — bir marta yangilaymiz
        return;
      }
      if (!conversation) { onStartChat?.(); setSending(false); return; }
      // Optimistik: yuborilgan xabarni darhol ko'rsatamiz
      const optimistic = { id: 'tmp-' + Date.now(), direction: 'OUTBOUND', text: val, createdAt: new Date().toISOString() };
      setMsgs((prev) => [...prev, optimistic]);
      setText('');

      if (conversation.isPersonal) {
        await userTelegramApi.sendMessage({ userId: conversation.externalChatId, text: val, clientId: client.id });
      } else {
        try {
          await telegramApi.sendMessage(conversation.id, val);
        } catch (botErr: any) {
          const msg = botErr?.response?.data?.message || '';
          if (String(msg).toLowerCase().includes('bot')) {
            await userTelegramApi.sendMessage({ userId: conversation.externalChatId, text: val, clientId: client.id });
          } else {
            throw botErr;
          }
        }
      }
      // Jimgina qayta o'qiymiz (sahifa reload QILINMAYDI)
      await refetchMsgs();
    } catch (e: any) {
      toast.error(errMsg(e));
      await refetchMsgs(); // optimistik xabarni haqiqiy holat bilan almashtiramiz
    } finally {
      setSending(false);
    }
  }

  // Timeline hodisalari va chat xabarlarini bitta xronologik oqimga birlashtiramiz
  // (faqat "Tarixni ko'rish" modalida ko'rsatiladi)
  const feed = [
    ...(client.timeline || []).map((t: any) => {
      // v14: filter uchun turini aniqlaymiz (taklif / bron / izoh / boshqa)
      const type = String(t.type || '');
      const kind = type === 'note' ? 'note'
        : type.startsWith('offer') ? 'offer'
        : type.startsWith('booking') ? 'booking'
        : 'other';
      return {
        id: 't-' + t.id, ts: t.createdAt, icon: TIMELINE_ICONS[t.type] || '•',
        title: t.title, subtitle: t.description, isNote: type === 'note', kind,
      };
    }),
    ...(msgs || []).map((m: any) => {
      const isOut = m.direction === 'OUTBOUND' || m.direction === 'outbound';
      return {
        id: 'm-' + m.id, ts: m.createdAt, icon: isOut ? '↗️' : '↘️',
        title: m.text || m.caption,
        subtitle: (isOut ? 'Siz' : client.fullName) + ' · ' + (m._source === 'personal' ? 'Telegram' : (isOut ? 'yuborildi' : 'keldi')),
        isNote: false, kind: 'chat',
      };
    }),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // v14: yozish/izoh maydoni endi kattaroq va ko'rinarli
  const inp: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 14, resize: 'vertical', minHeight: 64, maxHeight: 160, lineHeight: 1.4 };

  return (
    <div>
      {/* v14: Yozish maydoni endi "qotib" (sticky) turadi — sahifa scroll
          bo'lganda ham ko'rinib turadi, shu bilan yozishmalarni o'qib turib
          bemalol yozib boraverasiz. */}
      <div style={{ position: 'sticky', top: 8, zIndex: 5, background: 'var(--bg)', paddingBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Faoliyat</span>
          {chatLoading && <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>Yuklanmoqda...</span>}
        </div>

        {/* v29: HubSpot'dagi "About/Activities/Revenue" tab qatoriga o'xshab —
            pastki chiziq bilan, kattaroq. Ilgari kichik "pill" tugmalar edi,
            bu esa asosiy tab navigatsiyasi ekanini yetarlicha ko'rsatmasdi. */}
        <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)' }}>
          {([
            ['all', `Hammasi (${feed.length})`],
            ['chat', '💬 Chat'],
            ['offer', '📨 Takliflar'],
            ['note', '🔒 Izohlar'],
          ] as [any, string][]).map(([id, label]) => {
            const active = feedFilter === id;
            return (
              <button key={id} onClick={() => setFeedFilter(id)} style={{
                padding: '0 0 9px', cursor: 'pointer', fontSize: 13, background: 'none',
                border: 'none', borderBottom: '2px solid ' + (active ? '#3d7eff' : 'transparent'),
                marginBottom: -1,
                color: active ? 'var(--fg)' : 'var(--fg-3)', fontWeight: active ? 700 : 500,
              }}>{label}</button>
            );
          })}
        </div>

        {/* v15: Yozish qutisi FAQAT "Chat" (mijozga xabar) va "Izohlar" (ichki izoh)
            tablarida. "Hammasi" va "Takliflar"da ko'rinmaydi — faqat kontent chiqadi. */}
        {showComposer && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '6px 8px', marginTop: 8 }}>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} style={inp}
              placeholder={composerMode === 'note' ? "Ichki izoh... (faqat xodimlar ko'radi)" : (conversation ? 'Mijozga xabar yozing...' : "Suhbat yo'q — bosing va birinchi xabarni yuboring")}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>
                {composerMode === 'note' ? '🔒 Faqat sizga' : '✈️ Mijoz ko\'radi'}
              </span>
              <button onClick={send} disabled={sending || !text.trim()} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', opacity: sending || !text.trim() ? 0.6 : 1 }}>
                {sending ? '...' : composerMode === 'note' ? 'Saqlash' : 'Yuborish'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline yozishmalar oynasi — ichida scroll bo'ladi (yangi xabar tepada,
          yozish maydoniga eng yaqin). */}
      {(() => {
        const filtered = feedFilter === 'all' ? feed : feed.filter((x: any) => x.kind === feedFilter);
        // v14: "Takliflar" tanlanganda inline jurnal EMAS — pastda haqiqiy
        // taklif kartalari ko'rsatiladi (2-rasmdagidek). Shu yerda faqat ishorat.
        if (feedFilter === 'offer') {
          return (
            <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 12, marginTop: 6 }}>
              📨 Takliflar quyida ↓
            </div>
          );
        }
        if (filtered.length === 0) {
          return (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 12, marginTop: 6 }}>
              {feedFilter === 'all' ? "Hali faoliyat yo'q" : 'Bu turda yozuv yo\'q'}
            </div>
          );
        }
        const bigView = feedFilter === 'note' || feedFilter === 'all';
        const collapseThis = feedFilter === 'chat' && collapsed;
        return (
          <div style={{ marginTop: 8, maxHeight: collapseThis ? 0 : (bigView ? 640 : 300), opacity: collapseThis ? 0 : 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4, transition: 'max-height .25s ease, opacity .2s ease' }}>
            {filtered.map((item: any) => {
              const isChatMsg = item.id.startsWith('m-');
              const isOut = item.icon === '↗️';
              if (isChatMsg) {
                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                      background: isOut ? '#3d7eff' : 'var(--bg-2)',
                      color: isOut ? 'white' : 'var(--fg)',
                      fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {item.title}
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{timeAgo(item.ts)}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', color: 'var(--fg-3)' }}>
                  <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.8 }}>{item.isNote ? '🔒' : item.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 1 }}>
                      {item.subtitle ? item.subtitle + ' · ' : ''}{timeAgo(item.ts)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Offer Row (ro'yxat ko'rinishidagi taklif qatori, "..." menyu bilan) ───────
function OfferGroupRow({ group, isLast, clientId, clientPhone, clientUsername, onSent, onEdit, onDuplicate, onSold, sellingOfferId }: any) {
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
        onDuplicate={() => onDuplicate(primary)}
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
                    onDuplicate={() => onDuplicate(o)}
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

// ─── Mehmonxona rasmlari bloki: rasmlar ustida, ma'lumot (nomi/yulduzi)
// pastida — nechta rasm bo'lishidan qat'i nazar chiroyli grid bilan
// joylashadi. Yuklanmagan/buzuq rasm ko'rinishni buzmasligi uchun
// xato bergan rasm ro'yxatdan chetlashtiriladi. ─────────────────────
function HotelPhotoBlock({ name, stars, photos }: { name: string; stars?: number | string; photos: string[] }) {
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const valid = photos.slice(0, 10).map((p, i) => ({ p, i })).filter(({ i }) => !broken[i]);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, background: 'var(--bg-3)' }}>
      {valid.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
          {valid.map(({ p, i }) => (
            <a key={i} href={p} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              <img
                src={p}
                alt={name}
                onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                style={{
                  width: '100%', aspectRatio: '1 / 1', borderRadius: 8, objectFit: 'cover',
                  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,.15)',
                  transition: 'transform .15s ease', display: 'block',
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'scale(1)'; }}
              />
            </a>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--fg-4)', padding: '10px 0', textAlign: 'center' }}>
          🖼 Rasm yuklanmadi
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 7, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        🏨 {name}{stars ? <span style={{ color: '#f59e0b' }}>{' ' + '⭐'.repeat(Number(stars))}</span> : null}
        {photos.length > 1 && <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>· {photos.length} ta rasm</span>}
      </div>
    </div>
  );
}

function OfferRow({ offer: o, isLast, clientId, clientPhone, clientUsername, onSent, onEdit, onDuplicate, onSold, selling, noBorder }: any) {
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
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hotels.filter((h: any) => h.photos?.length > 0).map((h: any, hi: number) => (
                <HotelPhotoBlock key={hi} name={h.name} stars={h.stars} photos={h.photos || []} />
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
          {/* v29: shu taklifni asos qilib, tez YANGI taklif yaratish (masalan bir mijozga 2-3 xil variant) */}
          <button
            onClick={onDuplicate}
            title="Shu taklif asosida yangi taklif yaratish"
            style={{
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-3)',
              color: 'var(--fg-2)', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ⧉ Nusxalash
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Offer Create Modal ───────────────────────────────────────────────────────
function OfferCreateModal({ clientId, onClose, onSaved, existingOffer, duplicateOffer }: any) {
  const isEdit = !!existingOffer;
  // v29: Tahrirlashda `existingOffer` ishlatiladi (PUT), nusxalashda esa
  // `duplicateOffer` (POST — yangi taklif sifatida saqlanadi). Ikkalasi ham
  // bir xil shaklda bo'lgani uchun bitta manba sifatida birlashtiramiz.
  const prefillSource = existingOffer || duplicateOffer;
  const [f, setF] = useState(() => {
    if (prefillSource) {
      // v14: narxlar endi 1 KISHI uchun kiritiladi. Saqlangan qiymatlar JAMI —
      // shuning uchun tahrirlashda kishi soniga bo'lib, 1 kishilik narxni ko'rsatamiz.
      const exPax = Math.max(1, prefillSource.adults ?? prefillSource.pax ?? 1);
      const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
      const opTotal = Number(prefillSource.originalActualPrice ?? prefillSource.actualPrice ?? 0);
      const mkTotal = Number(prefillSource.originalMarkup ?? prefillSource.markup ?? 0);
      return {
        tourName: prefillSource.tourName || '',
        destination: prefillSource.destination || '',
        // v14: pax = KATTALAR soni (eski takliflarda pax = jami odam, bola yo'q edi)
        pax: prefillSource.adults ?? prefillSource.pax ?? 1,
        // v14: bolalar (alohida, arzonroq narx)
        children: prefillSource.children || 0,
        // v29: nusxalashda sana ko'chirilmaydi — yangi mijoz/sana uchun bo'sh
        // qoldiriladi, aks holda eski (o'tib ketgan) sana bilan yuborilib qolishi mumkin.
        departDate: existingOffer && prefillSource.departDate ? prefillSource.departDate.slice(0, 10) : '',
        returnDate: existingOffer && prefillSource.returnDate ? prefillSource.returnDate.slice(0, 10) : '',
        departFlightTime: prefillSource.departFlightTime || '',
        returnFlightTime: prefillSource.returnFlightTime || '',
        // 1 KATTA uchun narx — yangi takliflarda alohida saqlangan; eskilarda
        // jami/kishi soniga bo'lib chiqaramiz.
        actualPrice: prefillSource.adultActualPrice != null ? String(prefillSource.adultActualPrice) : (opTotal ? String(r2(opTotal / exPax)) : ''),
        markup: prefillSource.adultMarkup != null ? String(prefillSource.adultMarkup) : (mkTotal ? String(r2(mkTotal / exPax)) : ''),
        // 1 BOLA uchun narx
        childActualPrice: prefillSource.childActualPrice != null ? String(prefillSource.childActualPrice) : '',
        childMarkup: prefillSource.childMarkup != null ? String(prefillSource.childMarkup) : '',
        currency: prefillSource.originalCurrency || prefillSource.currency || 'USD',
        bookingLink: prefillSource.bookingLink || '',
        hotels: Array.isArray(prefillSource.hotels) && prefillSource.hotels.length
          ? prefillSource.hotels.map((h: any) => ({ name: h.name || '', stars: h.stars || '', photos: h.photos || [] }))
          : [{ name: prefillSource.hotelName || '', stars: prefillSource.hotelStars || '', photos: [] as string[] }],
        mealPlan: prefillSource.mealPlan || 'NONE',
        includesVisa: !!prefillSource.includesVisa,
        includesFlight: prefillSource.includesFlight !== false,
        includesHotel: prefillSource.includesHotel !== false,
        includesTransfer: !!prefillSource.includesTransfer,
        includesInsurance: !!prefillSource.includesInsurance,
        notes: prefillSource.notes || '',
      };
    }
    return {
      tourName: '', destination: '', pax: 1,
      children: 0,
      departDate: '', returnDate: '', departFlightTime: '', returnFlightTime: '',
      // v14: markup ham operator narxi kabi bo'sh boshlansin (majburiy "0" o'chirmasin)
      actualPrice: '', markup: '', currency: 'USD',
      childActualPrice: '', childMarkup: '',
      bookingLink: '',
      hotels: [{ name: '', stars: '', photos: [] as string[] }],
      mealPlan: 'NONE',
      includesVisa: false, includesFlight: true, includesHotel: true,
      includesTransfer: false, includesInsurance: false,
      notes: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [sendNow, setSendNow] = useState(false);
  // v29: Taklif shablonlari — faqat yangi/nusxalangan takliflarda ko'rsatiladi
  // (haqiqiy tahrirlashda emas, u yerda maqsad boshqa).
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  useEffect(() => {
    if (isEdit) return;
    api.get('/offers/templates')
      .then((r: any) => setTemplates(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setTemplatesLoaded(true));
  }, [isEdit]);

  function applyTemplate(t: any) {
    setF(prev => ({
      ...prev,
      tourName: t.tourName || '',
      destination: t.destination || '',
      pax: t.pax ?? 1,
      children: t.children ?? 0,
      departFlightTime: t.departFlightTime || '',
      returnFlightTime: t.returnFlightTime || '',
      actualPrice: t.actualPrice != null ? String(t.actualPrice) : '',
      markup: t.markup != null ? String(t.markup) : '',
      childActualPrice: t.childActualPrice != null ? String(t.childActualPrice) : '',
      childMarkup: t.childMarkup != null ? String(t.childMarkup) : '',
      currency: t.currency || 'USD',
      bookingLink: t.bookingLink || '',
      hotels: Array.isArray(t.hotels) && t.hotels.length ? t.hotels : prev.hotels,
      mealPlan: t.mealPlan || 'NONE',
      includesVisa: !!t.includesVisa,
      includesFlight: t.includesFlight !== false,
      includesHotel: t.includesHotel !== false,
      includesTransfer: !!t.includesTransfer,
      includesInsurance: !!t.includesInsurance,
      notes: t.notes || '',
      // Sana va kishi soni mijozga xos — shablon bilan kelmaydi, agent o'zi kiritadi.
    }));
    toast.success(`"${t.name}" shabloni qo'llanildi`);
  }

  async function saveAsTemplate() {
    if (!f.tourName.trim()) { toast.error('Avval tur nomini kiriting'); return; }
    const name = window.prompt('Shablon nomi (masalan: "Antalya, Rixos 5*")', f.tourName)?.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const r = await api.post('/offers/templates', { ...f, name });
      setTemplates(prev => [r.data, ...prev]);
      toast.success('Shablon saqlandi — endi tez qo\'llash mumkin');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSavingTemplate(false); }
  }
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const setHotels = (hotels: any[]) => setF(prev => ({ ...prev, hotels }));
  // v14: narxlar 1 KISHI uchun. Kattalar va bolalar ALOHIDA hisoblanadi:
  //   jami = kattalar × (op + markup) + bolalar × (bola_op + bola_markup)
  const adultsN = Math.max(1, parseInt(String(f.pax)) || 1);
  const childrenN = Math.max(0, parseInt(String(f.children)) || 0);
  const adultPer = (parseFloat(f.actualPrice) || 0) + (parseFloat(f.markup) || 0);
  const childPer = (parseFloat(f.childActualPrice) || 0) + (parseFloat(f.childMarkup) || 0);
  const clientPrice = adultsN * adultPer + childrenN * childPer;
  // v14: sana tekshiruvi — qaytish sanasi jo'nashdan OLDIN bo'lsa xato
  const dateError = !!(f.departDate && f.returnDate && f.returnDate < f.departDate);

  // v14: colorScheme 'light dark' — sana/vaqt ikonlari va matn temaga moslashadi
  // (yorug'da qora, qorong'ida oq).
  const inp: any = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', colorScheme: 'light dark' };
  const lbl: any = { fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 };
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  // v14: W endi o'zi scroll bo'lmaydi (flex column) — sarlavha va yopish
  // tugmasi doim ko'rinib turadi, faqat ICHIDAGI kontent scroll bo'ladi.
  const W: any = { position: 'relative', background: 'var(--bg)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  async function save() {
    if (!f.tourName.trim() || !f.actualPrice) { toast.error('Tur nomi va narx kerak'); return; }
    if (dateError) { toast.error('Qaytish sanasi jo\'nab ketishdan oldin bo\'lishi mumkin emas'); return; }
    setSaving(true);
    try {
      const hotels = f.hotels
        .map(h => ({ name: h.name.trim(), stars: h.stars ? parseInt(String(h.stars)) : null, photos: h.photos || [] }))
        .filter(h => h.name);
      const data = {
        clientId, ...f,
        // v14: JAMI narxlar (kattalar + bolalar) — backend/hisobotlar uchun.
        actualPrice: (parseFloat(f.actualPrice) || 0) * adultsN + (parseFloat(f.childActualPrice) || 0) * childrenN,
        markup: (parseFloat(f.markup) || 0) * adultsN + (parseFloat(f.childMarkup) || 0) * childrenN,
        clientPrice,
        // pax = JAMI odam (katta + bola) — eski mantiq bilan moslik uchun
        pax: adultsN + childrenN,
        // v14: breakdown — tahrirlash va xabar matni uchun 1 kishilik narxlar
        adults: adultsN,
        children: childrenN,
        adultActualPrice: parseFloat(f.actualPrice) || 0,
        adultMarkup: parseFloat(f.markup) || 0,
        childActualPrice: childrenN > 0 ? (parseFloat(f.childActualPrice) || 0) : null,
        childMarkup: childrenN > 0 ? (parseFloat(f.childMarkup) || 0) : null,
        bookingLink: (f.bookingLink || '').trim() || null,
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
    <div style={S} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={W}>
        {/* v14: yopish tugmasi — doim ko'rinadi (scroll bo'lmaydi), oson bosish uchun yuqori chap burchakda */}
        <button
          onClick={onClose}
          title="Yopish"
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 2,
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
        <div style={{ overflowY: 'auto', padding: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, paddingLeft: 38 }}>
          {isEdit ? '✏️ Taklifni tahrirlash' : duplicateOffer ? '⧉ Nusxadan yangi taklif' : '📨 Yangi taklif'}
        </h2>

        {/* v29: Shablonlar — bir bosishda butun formani to'ldiradi (mehmonxona, narx,
            ovqatlanish va h.k). Faqat yangi/nusxalangan taklifda ko'rinadi.
            Hali birorta shablon yo'q bo'lsa ham — jim qolib "ishlamayapti"
            taassurotini qoldirmaslik uchun, nima qilish kerakligini aytamiz. */}
        {!isEdit && templatesLoaded && (
          templates.length > 0 ? (
            <div style={{ marginBottom: 16, padding: 10, borderRadius: 9, border: '1px dashed var(--border)', background: 'var(--bg-3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 7 }}>⚡ Shablondan boshlash</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {templates.map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    title={`${t.tourName || ''} — bosilsa forma to'liq to'ldiriladi`}
                    style={{
                      padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)',
                    }}
                  >{t.name}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16, padding: '9px 12px', borderRadius: 9, background: 'rgba(61,126,255,0.07)', border: '1px solid rgba(61,126,255,0.2)', fontSize: 12, color: 'var(--fg-2)' }}>
              💡 Hali shablon yo'q. Shu taklifni to'ldirib, pastdagi <b>"⭐ Shablon qilib saqlash"</b> tugmasini bosing — keyingi safar shu yerdan 1 bosishda qo'llaysiz.
            </div>
          )
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Tur nomi *</label><input style={inp} value={f.tourName} onChange={e => set('tourName', e.target.value)} placeholder="Turkiya — Antalya 7 kun" /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Yo'nalish</label><input style={inp} value={f.destination} onChange={e => set('destination', e.target.value)} /></div>
          <div><label style={lbl}>👤 Kattalar</label><input type="number" min={1} style={inp} value={f.pax} onChange={e => set('pax', e.target.value)} /></div>
          <div><label style={lbl}>🧒 Bolalar (arzon narx)</label><input type="number" min={0} style={inp} value={f.children} onChange={e => set('children', e.target.value)} /></div>

          {/* v14: Jo'nab ketish + Qaytish — BIR QATORDA */}
          <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Jo'nab ketish</label>
              <input type="date" style={{ ...inp, colorScheme: 'light dark', border: dateError ? '1px solid #ef4444' : inp.border }} value={f.departDate} onChange={e => set('departDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Qaytish</label>
              <input type="date" style={{ ...inp, colorScheme: 'light dark', border: dateError ? '1px solid #ef4444' : inp.border }} value={f.returnDate} onChange={e => set('returnDate', e.target.value)} min={f.departDate || undefined} />
            </div>
          </div>
          {dateError && (
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, marginTop: -4 }}>
              ❗️ Qaytish sanasi jo'nab ketish sanasidan oldin bo'lishi mumkin emas
            </div>
          )}

          {/* Parvoz vaqtlari — bir qatorda */}
          <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Parvoz vaqti (ixtiyoriy)</label>
              <input type="time" style={{ ...inp, colorScheme: 'light dark' }} value={f.departFlightTime} onChange={e => set('departFlightTime', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Qaytish parvoz vaqti (ixtiyoriy)</label>
              <input type="time" style={{ ...inp, colorScheme: 'light dark' }} value={f.returnFlightTime} onChange={e => set('returnFlightTime', e.target.value)} />
            </div>
          </div>

          {/* v14: Mehmonxonalar — endi Qaytish parvoz vaqtining TAGIDA */}
          <HotelsPicker hotels={f.hotels} setHotels={setHotels} inp={inp} lbl={lbl} />

          {/* v14: Taklifga havola (Booking.com va h.k.) — mijozga yuborilganda
              Telegram avtomatik chiroyli preview (rasm+sarlavha) qilib ko'rsatadi */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>🔗 Havola (ixtiyoriy — Booking.com, mehmonxona sahifasi...)</label>
            <input style={inp} value={f.bookingLink} onChange={e => set('bookingLink', e.target.value)} placeholder="https://www.booking.com/..." />
          </div>
          {/* Pricing */}
          <OfferPricingBox f={f} set={set} inp={inp} lbl={lbl} clientPrice={clientPrice} />

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
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isEdit && (
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={savingTemplate}
                title="Shu turni shablon sifatida saqlab qo'yish — keyingi mijozlarga tez qo'llash uchun"
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
              >
                {savingTemplate ? '...' : '⭐ Shablon qilib saqlash'}
              </button>
            )}
            {!isEdit && (
              <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} /> Darhol yuborish
              </label>
            )}
            <button onClick={save} disabled={saving || dateError} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: dateError ? 'var(--fg-4)' : '#3d7eff', color: 'white', cursor: dateError ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: dateError ? 0.6 : 1 }}>
              {saving ? '...' : isEdit ? '💾 Saqlash' : sendNow ? '✉️ Yuborish' : '💾 Saqlash'}
            </button>
          </div>
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
  const adultsN = Math.max(1, parseInt(String(f.pax)) || 1);
  const childrenN = Math.max(0, parseInt(String(f.children)) || 0);
  const adultPer = (parseFloat(f.actualPrice) || 0) + (parseFloat(f.markup) || 0);
  const childPer = (parseFloat(f.childActualPrice) || 0) + (parseFloat(f.childMarkup) || 0);
  const profitTotal = (parseFloat(f.markup) || 0) * adultsN + (parseFloat(f.childMarkup) || 0) * childrenN;
  const money = (n: number) => isForeign ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + f.currency : '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Diqqat: bu blokda ko'rinadigan Operator narxi/Foyda FAQAT CRM ichida
  // (taklifni yaratayotgan xodimga) ko'rinadi. Klientga yuboriladigan
  // xabar (OfferSendMenu) faqat "Mijozga narx"ni o'z ichiga oladi —
  // tan narx va foyda hech qachon mijozga chiqarilmaydi.
  return (
    <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Operator narxi (1 katta)</label>
        <input type="number" style={inp} value={f.actualPrice} onChange={(e: any) => set('actualPrice', e.target.value)} placeholder="0" />
      </div>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>Markup (1 katta)</label>
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
      </div>

      {/* v14: BOLALAR narxi — faqat bolalar soni > 0 bo'lsa ko'rinadi (arzon narx) */}
      {childrenN > 0 && (
        <>
          <div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>🧒 Operator narxi (1 bola)</label>
            <input type="number" style={inp} value={f.childActualPrice} onChange={(e: any) => set('childActualPrice', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'flex-end', minHeight: 28 }}>🧒 Markup (1 bola)</label>
            <input type="number" style={inp} value={f.childMarkup} onChange={(e: any) => set('childMarkup', e.target.value)} placeholder="0" />
          </div>
          <div style={{ gridColumn: '3/-1', display: 'flex', alignItems: 'flex-end', fontSize: 11, color: 'var(--fg-3)' }}>
            Bolalar alohida, arzon narxda hisoblanadi
          </div>
        </>
      )}

      {/* Hisob-kitob breakdown */}
      <div style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>👤 {adultsN} katta × {money(adultPer)} = <b style={{ color: 'var(--fg-2)' }}>{money(adultsN * adultPer)}</b></span>
        {childrenN > 0 && <span>🧒 {childrenN} bola × {money(childPer)} = <b style={{ color: 'var(--fg-2)' }}>{money(childrenN * childPer)}</b></span>}
      </div>

      {(adultPer > 0 || childPer > 0) && (
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12, padding: '8px 10px', background: '#8b5cf610', borderRadius: 7, fontSize: 12 }}>
          <span>Foyda (jami): <b style={{ color: '#8b5cf6' }}>{money(profitTotal)}</b></span>
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
      const photosSent = r.data?.photosSent ?? 0;
      const photosFailed = r.data?.photosFailed ?? 0;
      const baseMsg = via === 'personal'
        ? '✅ Taklif shaxsiy Telegram orqali yuborildi!'
        : '✅ Taklif Telegram orqali yuborildi!';
      if (photosFailed > 0) {
        // v11: rasm(lar) yuborilmasa ham matn ketgan bo'ladi — buni yashirmasdan
        // agentga ochiq aytamiz, aks holda "nega mijozga rasm bormadi" degan
        // savol javobsiz qoladi.
        toast.error(
          photosSent > 0
            ? `⚠️ Matn yuborildi, lekin ${photosFailed} ta rasm yuborilmadi (${photosSent} tasi ketdi). Birozdan so'ng qayta urinib ko'ring.`
            : `⚠️ Matn yuborildi, lekin rasmlar yuborilmadi. Birozdan so'ng qayta urinib ko'ring yoki Telegram ulanishini tekshiring.`
        );
      } else {
        toast.success(photosSent > 0 ? `${baseMsg} (${photosSent} ta rasm bilan)` : baseMsg);
      }
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