'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientsApi } from '@/services/api';
import { Btn, Badge, Skeleton, Avatar } from '@/components/ui';
import { STAGE_LABELS, STAGE_COLORS, TIER_LABELS, SOURCE_LABELS, fmtDate, timeAgo, errMsg } from '@/lib/helpers';
import { useDialer } from '@/lib/dialer';
import { X, Maximize2, Phone as PhoneIcon, Calendar, Wallet } from 'lucide-react';
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
  const nextFollowUp = c?.followUps?.[0];
  const lastBooking = c?.bookings?.[0];

  return (
    <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <Avatar name={c.fullName} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.fullName}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
                    {c.phone || 'Telefon kiritilmagan'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                <Badge color={STAGE_COLORS[c.pipelineStage]}>
                  {STAGE_LABELS[c.pipelineStage]?.replace(/^\S+\s/, '') || c.pipelineStage}
                </Badge>
                {c.tier && <Badge color="#a855f7">{TIER_LABELS?.[c.tier] || c.tier}</Badge>}
                {c.source && <Badge color="var(--fg-3)">{SOURCE_LABELS?.[c.source] || c.source}</Badge>}
              </div>

              {/* Tezkor amallar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
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

              {/* Biriktirilgan agent */}
              {c.assignedAgent && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14, fontSize: 13,
                }}>
                  <Avatar name={c.assignedAgent.name} size={22} src={c.assignedAgent.avatarUrl} />
                  <span style={{ color: 'var(--fg-2)' }}>Biriktirilgan: <b>{c.assignedAgent.name}</b></span>
                </div>
              )}

              {/* Keyingi follow-up */}
              {nextFollowUp && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                  background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14, fontSize: 13,
                }}>
                  <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ color: 'var(--fg-2)', fontWeight: 600 }}>Keyingi eslatma</div>
                    <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                      {fmtDate(nextFollowUp.dueAt)} — {nextFollowUp.note || nextFollowUp.type}
                    </div>
                  </div>
                </div>
              )}

              {/* Oxirgi bron */}
              {lastBooking && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                  background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14, fontSize: 13,
                }}>
                  <Wallet size={15} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ color: 'var(--fg-2)', fontWeight: 600 }}>Oxirgi bron</div>
                    <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                      {lastBooking.tourName || lastBooking.destination || '—'}
                    </div>
                  </div>
                </div>
              )}

              {/* So'nggi harakatlar (timeline) */}
              {Array.isArray(c.timeline) && c.timeline.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.3 }}>
                    So'nggi harakatlar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {c.timeline.slice(0, 6).map((tItem: any) => (
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
    </div>
  );
}