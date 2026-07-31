'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clientsApi } from '@/services/api';
import { Btn, Badge, Skeleton, Avatar } from '@/components/ui';
import { STAGE_LABELS, STAGE_COLORS, TIER_LABELS, SOURCE_LABELS, fmtDate, fmtMoney, timeAgo, errMsg } from '@/lib/helpers';
import { useDialer } from '@/lib/dialer';
import { X, Maximize2, Phone as PhoneIcon, Calendar, Wallet, Mail, Tag, MapPin, FileText, Receipt, PhoneCall, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Mijozning "tezkor ko'rinishi" — kichkina ekran.
 *
 * NEGA KERAK: mijozlar ro'yxatida bitta mijozga bosilganda ilgari
 * DOIM to'liq sahifaga (/clients/[id]) o'tib ketilardi. Ko'p mijoz
 * bilan ketma-ket ishlaydigan agent uchun bu noqulay — har safar
 * ro'yxatga qaytish kerak bo'lardi.
 *
 * Endi: ro'yxatda mijozga bosilsa — shu panel (drawer) o'ng chetdan
 * chiqadi, ro'yxat orqada ko'rinib turaveradi, xohlagan mijozni
 * ketma-ket ochib-yopib chiqish mumkin. Agar to'liq profil (barcha
 * bron, to'lov, xabarlar tarixi) kerak bo'lsa — "To'liq profil"
 * tugmasi orqali katta ekranga (/clients/[id]) o'tiladi.
 */
export function ClientQuickView({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { callClient } = useDialer();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    clientsApi
      .one(clientId)
      .then((res) => { if (alive) setData(res.data); })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientId]);

  // Esc bosilsa yopiladi — ko'p mijozni ketma-ket ko'rib chiqishda qulay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openFull = () => {
    onClose();
    router.push(`/clients/${clientId}`);
  };

  const c = data;
  const upcomingFollowUps = c?.followUps?.slice(0, 3) || [];
  const recentBookings = c?.bookings?.slice(0, 3) || [];
  const keyInfo = c?.preferences?.keyInfo;

  return (
    // v25 FIX: ilgari bu yerda butun ekranni qoplaydigan qorong'i "overlay"
    // bor edi — shu sabab panel ochiq turganda agent ro'yxatdagi boshqa
    // hech narsaga bosa OLMASDI (bosilsa, faqat panel yopilib qolardi).
    // Endi orqa fon UMUMAN to'silmaydi — ro'yxat panel ochiq turgan
    // paytda ham to'liq ishlaydi. Boshqa mijozga bosilsa, panel shu joyda
    // qolib, ICHIDAGI ma'lumot yangi mijozga almashadi (yopib-ochib
    // o'tirish shart emas). Panel Esc yoki ✕ tugmasi bilan yopiladi.
    <div className="drawer-panel">
      {/* Sarlavha */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px',
        borderBottom: '1px solid var(--border-2)', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Tezkor ko'rinish
          </div>
        </div>
        <button
          title="To'liq profilda ochish"
          onClick={openFull}
          style={{
            background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 8,
            cursor: 'pointer', color: 'var(--fg-2)', padding: '7px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
          }}
        >
          <Maximize2 size={13} /> To'liq profil
        </button>
        <button
          title="Yopish (Esc)"
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)',
            padding: 6, borderRadius: 8, display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      </div>

        {/* Kontent */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {loading && (
            <div>
              <Skeleton height={60} />
              <div style={{ height: 12 }} />
              <Skeleton height={100} />
              <div style={{ height: 12 }} />
              <Skeleton height={140} />
            </div>
          )}

          {!loading && c && (
            <>
              {/* Asosiy ma'lumot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar name={c.fullName} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.fullName}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
                    {c.phone || 'Telefon kiritilmagan'}
                  </div>
                  {c.email && (
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Mail size={11} /> {c.email}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <Badge color={STAGE_COLORS[c.pipelineStage]}>
                  {STAGE_LABELS[c.pipelineStage]?.replace(/^\S+\s/, '') || c.pipelineStage}
                </Badge>
                {c.tier && <Badge color="#a855f7">{TIER_LABELS?.[c.tier] || c.tier}</Badge>}
                {c.source && <Badge color="var(--fg-3)">{SOURCE_LABELS?.[c.source] || c.source}</Badge>}
                {Array.isArray(c.tags) && c.tags.map((tag: string) => (
                  <Badge key={tag} color="var(--primary)">
                    <Tag size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{tag}
                  </Badge>
                ))}
              </div>

              {/* Tezkor amallar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Btn
                  size="sm"
                  icon={<PhoneIcon size={13} />}
                  disabled={!c.phone}
                  onClick={() => callClient(c.id, c.fullName, c.phone)}
                  style={{ flex: 1 }}
                >
                  Qo'ng'iroq
                </Btn>
                <Btn size="sm" variant="secondary" onClick={openFull} style={{ flex: 1 }}>
                  To'liq ochish
                </Btn>
              </div>

              {/* v25: Moliya/faollik statistikasi bir qarashda ko'rinsin */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14,
              }}>
                <StatBox label="Bronlar" value={c._count?.bookings ?? c.totalBookings ?? 0} />
                <StatBox label="Jami to'lov" value={fmtMoney ? fmtMoney(c.totalSpent || 0) : `$${c.totalSpent || 0}`} />
                <StatBox label="LTV" value={fmtMoney ? fmtMoney(c.lifetimeValue || 0) : `$${c.lifetimeValue || 0}`} />
              </div>

              {/* Biriktirilgan agent */}
              {c.assignedAgent && (
                <InfoRow icon={<Avatar name={c.assignedAgent.name} size={20} src={c.assignedAgent.avatarUrl} />}>
                  Biriktirilgan: <b>{c.assignedAgent.name}</b>
                </InfoRow>
              )}

              {/* Nima xohlaydi (yo'nalish + byudjet) */}
              {keyInfo && (keyInfo.destination || keyInfo.budget) && (
                <InfoRow icon={<MapPin size={15} style={{ color: 'var(--primary)' }} />}>
                  <div>
                    {keyInfo.destination && <div><b>{keyInfo.destination}</b></div>}
                    {keyInfo.budget && (
                      <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                        Byudjet: {keyInfo.budget} {keyInfo.budgetCurrency}
                      </div>
                    )}
                  </div>
                </InfoRow>
              )}

              {/* Kelayotgan eslatmalar (bittadan ko'p bo'lsa hammasi) */}
              {upcomingFollowUps.length > 0 && (
                <InfoRow icon={<Calendar size={15} style={{ color: 'var(--primary)' }} />}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      Kelayotgan eslatma{upcomingFollowUps.length > 1 ? `lar (${upcomingFollowUps.length})` : ''}
                    </div>
                    {upcomingFollowUps.map((f: any) => (
                      <div key={f.id} style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>
                        {fmtDate(f.dueAt)} — {f.note || f.type}
                      </div>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* So'nggi bronlar */}
              {recentBookings.length > 0 && (
                <InfoRow icon={<Wallet size={15} style={{ color: 'var(--success)' }} />}>
                  <div style={{ width: '100%' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      So'nggi bron{recentBookings.length > 1 ? 'lar' : ''}
                    </div>
                    {recentBookings.map((b: any) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>
                        <span>{b.tourName || b.destination || '—'}</span>
                        <span style={{ flexShrink: 0 }}>{b.status}</span>
                      </div>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* Ichki eslatma (notes) */}
              {c.notes && (
                <InfoRow icon={<FileText size={15} style={{ color: 'var(--fg-3)' }} />}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</span>
                </InfoRow>
              )}

              {/* v25: Hujjat/to'lov/qo'ng'iroq sonlari — pastgacha ko'proq
                  ma'lumot ko'rinsin degan talab bo'yicha qo'shildi. */}
              {c._count && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {c._count.documents > 0 && (
                    <MiniStat icon={<FileText size={12} />} label="Hujjat" value={c._count.documents} />
                  )}
                  {c._count.payments > 0 && (
                    <MiniStat icon={<Receipt size={12} />} label="To'lov" value={c._count.payments} />
                  )}
                  {c._count.calls > 0 && (
                    <MiniStat icon={<PhoneCall size={12} />} label="Qo'ng'iroq" value={c._count.calls} />
                  )}
                  {c._count.followUps > 0 && (
                    <MiniStat icon={<ListChecks size={12} />} label="Vazifa" value={c._count.followUps} />
                  )}
                </div>
              )}

              {c.lastContactAt && (
                <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginBottom: 14 }}>
                  Oxirgi aloqa: {timeAgo(c.lastContactAt)} · Ro'yxatga olindi: {fmtDate(c.createdAt)}
                </div>
              )}

              {/* So'nggi harakatlar (timeline) — 6 dan 10 tagacha kengaytirildi */}
              {Array.isArray(c.timeline) && c.timeline.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.3 }}>
                    So'nggi harakatlar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {c.timeline.slice(0, 10).map((tItem: any) => (
                      <div key={tItem.id} style={{ fontSize: 12.5, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--fg-4)', flexShrink: 0, minWidth: 52 }}>{timeAgo(tItem.createdAt)}</span>
                        <span style={{ color: 'var(--fg-2)' }}>{tItem.description || tItem.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !c && (
            <div style={{ textAlign: 'center', color: 'var(--fg-3)', padding: '40px 0', fontSize: 13 }}>
              Mijoz ma'lumotini yuklab bo'lmadi.
            </div>
          )}
        </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: any }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--fg-2)',
      background: 'var(--bg-3)', padding: '4px 9px', borderRadius: 999,
    }}>
      {icon} {value} {label}
    </span>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
      background: 'var(--bg-3)', borderRadius: 10, marginBottom: 10, fontSize: 13,
    }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
    </div>
  );
}