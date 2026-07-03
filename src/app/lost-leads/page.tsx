'use client';

// ════════════════════════════════════════════════════════════════════
// YO'QOTILGAN LEADLAR — umumiy hovuz
// Pipeline'da "Yo'qotildi" (LOST) bosqichiga o'tgan barcha leadlar shu yerda.
// • Hamma agent KO'RADI (agentga bo'linmaydi) — istalgan agent qayta bog'lanadi.
// • To'liq ma'lumot: mijoz kartasiga o'tib bo'ladi (xuddi Mijozlardagidek).
// ════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { clientsApi } from '@/services/api';

function fmtDate(d: any): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}
function initials(name: string): string {
  return String(name || '?').trim().split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

const SOURCE_LABEL: Record<string, string> = {
  TELEGRAM: 'Telegram', INSTAGRAM: 'Instagram', WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook', WEBSITE: 'Website', REFERRAL: 'Tavsiya',
  WALK_IN: 'Walk-in', WALKIN: 'Walk-in', PHONE: 'Telefon', OTHER: 'Boshqa',
};

export default function LostLeadsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    clientsApi.lost({ search: search || undefined, limit: 100 })
      .then((r: any) => {
        const arr = Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
        setItems(arr);
        setTotal(r?.data?.total ?? arr.length);
      })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <CrmLayout>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>Yo&apos;qotilgan leadlar</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
              Umumiy hovuz · hamma agent ko&apos;rishi mumkin · {total} ta
            </div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism yoki telefon…"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input, var(--bg-3))', color: 'var(--fg)', fontSize: 13, minWidth: 220 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, padding: 30 }}>Yuklanmoqda…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 14, padding: 40 }}>
            Yo&apos;qotilgan lead yo&apos;q 👍
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {items.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/clients/${c.id}`)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', flexShrink: 0 }}>
                    {initials(c.fullName)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</div>
                    <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{c.phone || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                  {c.source && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>
                      {SOURCE_LABEL[c.source] || c.source}
                    </span>
                  )}
                  {typeof c._count?.bookings === 'number' && c._count.bookings > 0 && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>
                      {c._count.bookings} booking
                    </span>
                  )}
                  {c.assignedAgent?.name && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-3)' }}>
                      avval: {c.assignedAgent.name}
                    </span>
                  )}
                </div>

                {c.notes && (
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {c.notes}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--fg-3)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <span>Yo&apos;qotilgan: {fmtDate(c.pipelineStageAt)}</span>
                  <span style={{ color: 'var(--accent, #3d7eff)' }}>Ochish →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}