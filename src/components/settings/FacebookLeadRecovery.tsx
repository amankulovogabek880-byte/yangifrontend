'use client';
import { useEffect, useState, useCallback } from 'react';
import { facebookLeadsApi } from '@/services/api';
import toast from 'react-hot-toast';

/**
 * ═══════════════════════════════════════════════════════════════
 * FACEBOOK — LEAD TIKLASH VA TASHXIS PANELI (v14, YANGI)
 * ═══════════════════════════════════════════════════════════════
 *
 * MUAMMO (bu paneldan oldin):
 *   Facebook leadlari kelmay qolsa, foydalanuvchi buni BILMASDI.
 *   Hech qanday belgi yo'q edi — CRM shunchaki jim turardi. Sabab
 *   esa server loglarida qolib ketardi:
 *     - FACEBOOK_APP_SECRET sozlanmagan → har bir webhook 403
 *     - Token bekor qilingan → Graph API rad etadi
 *     - Webhook o'tkazib yuborilgan → lead butunlay yo'qolgan
 *
 * BU PANEL:
 *   1. Server sozlamalari holatini ko'rsatadi (sir bormi, verify token nima)
 *   2. Navbat holatini ko'rsatadi (nechta lead kutmoqda, nechtasi xato)
 *   3. «Yo'qolgan leadlarni qidirish» — Meta'dan to'g'ridan-to'g'ri
 *      tortib oladi (webhook kelmagan bo'lsa ham)
 *   4. Xato bo'lgan leadlarni qayta ishlash imkonini beradi
 */

const card: any = {
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
};
const btnPrimary: any = {
  padding: '9px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer',
  fontSize: 12.5, fontWeight: 600,
};

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
      <span style={{ fontSize: 14, lineHeight: '18px', flexShrink: 0 }}>{ok ? '✅' : '🔴'}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: ok ? 500 : 700, color: ok ? 'var(--fg)' : '#ef4444' }}>
          {label}
        </div>
        {!ok && hint && (
          <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2, lineHeight: 1.6 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FacebookLeadRecovery() {
  const [diag, setDiag] = useState<any>(null);
  const [failed, setFailed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      facebookLeadsApi.diagnose().catch(() => ({ data: null })),
      facebookLeadsApi.listFailed().catch(() => ({ data: { data: [] } })),
    ])
      .then(([d, f]: any[]) => {
        setDiag(d.data || null);
        setFailed(f.data?.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runBackfill() {
    setBusy('backfill');
    const tid = toast.loading("Meta'dan tekshirilmoqda...");
    try {
      const r = await facebookLeadsApi.runBackfill();
      toast.success(r.data?.message || 'Tekshirildi', { id: tid });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik', { id: tid });
    } finally {
      setBusy(null);
    }
  }

  async function retry(id?: string) {
    setBusy(id || 'retry');
    try {
      const r = await facebookLeadsApi.retryFailed(id);
      toast.success(`${r.data?.requeued || 0} ta lead qayta navbatga qo'yildi`);
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div style={{ ...card, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
        Holat tekshirilmoqda...
      </div>
    );
  }

  const server = diag?.server || {};
  const queue = diag?.queue || { pending: 0, failed: 0, done: 0 };
  const serverBroken = server.appSecretConfigured === false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Server sozlamalari ── */}
      <div style={{
        ...card,
        border: serverBroken ? '1px solid #ef4444' : '1px solid var(--border)',
        background: serverBroken ? 'rgba(239,68,68,0.06)' : 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Ulanish holati</h3>
          <button style={btnGhost} onClick={load}>Yangilash</button>
        </div>

        <StatusRow
          ok={!!server.appSecretConfigured}
          label="Server siri (FACEBOOK_APP_SECRET)"
          hint={
            "Sozlanmagan — Meta'dan kelayotgan HAR BIR webhook rad etilmoqda va " +
            "hech qanday lead tushmaydi. Bu server sozlamasi, CRM ichidan tuzatib " +
            "bo'lmaydi: platforma administratoriga murojaat qiling."
          }
        />
        <StatusRow
          ok={!!server.appIdConfigured}
          label="Facebook App ID"
          hint="Sozlanmagan — «Facebook orqali ulash» tugmasi ishlamaydi."
        />
        <StatusRow
          ok={!!server.redirectUriConfigured}
          label="OAuth qaytish manzili"
          hint="Sozlanmagan — Facebook'dan qaytishda xatolik chiqadi."
        />
        <StatusRow
          ok={diag?.tokenValid !== false}
          label="Page Access Token"
          hint="Token yaroqsiz yoki muddati tugagan — yuqoridagi «Tezkor ulanish» tugmasi orqali qaytadan ulang."
        />

        {server.verifyToken && (
          <div style={{
            marginTop: 12, padding: '10px 12px', background: 'var(--bg-3)',
            borderRadius: 8, fontSize: 11.5, lineHeight: 1.7, color: 'var(--fg-2)',
          }}>
            Meta Dashboard → Webhooks → <b>Verify Token</b> maydoniga AYNAN shuni kiriting:
            <code style={{
              display: 'block', marginTop: 6, padding: '6px 10px', borderRadius: 6,
              background: 'var(--bg-2)', fontSize: 12, wordBreak: 'break-all',
            }}>
              {server.verifyToken}
            </code>
          </div>
        )}
      </div>

      {/* ── Navbat va tiklash ── */}
      <div style={card}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Leadlarni tiklash</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Webhook o'tkazib yuborilsa (server o'chgan, yangilanish, ulanish uzilgan)
          Facebook uni qayta yubormaydi. Bu tugma o'sha leadlarni to'g'ridan-to'g'ri
          Facebook'dan tortib oladi.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginBottom: 14,
        }}>
          {[
            { label: 'Qayta ishlanmoqda', value: queue.pending, color: '#f59e0b' },
            { label: 'Xato', value: queue.failed, color: queue.failed > 0 ? '#ef4444' : 'var(--fg-3)' },
            { label: 'Muvaffaqiyatli', value: queue.done, color: '#10b981' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '10px 8px',
              background: 'var(--bg-3)', borderRadius: 8,
            }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...btnPrimary, opacity: busy === 'backfill' ? 0.6 : 1 }}
            disabled={busy === 'backfill'} onClick={runBackfill}>
            {busy === 'backfill' ? 'Tekshirilmoqda...' : "Yo'qolgan leadlarni qidirish"}
          </button>
          {queue.failed > 0 && (
            <button style={{ ...btnGhost, opacity: busy === 'retry' ? 0.6 : 1 }}
              disabled={busy === 'retry'} onClick={() => retry()}>
              Xatolarni qayta ishlash ({queue.failed})
            </button>
          )}
        </div>
      </div>

      {/* ── Xato bo'lgan leadlar ── */}
      {failed.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Qayta ishlanmagan leadlar</h3>
          <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 12px', lineHeight: 1.6 }}>
            Bu leadlar Facebook'dan kelgan, lekin mijoz kartochkasiga aylanmagan.
            Ma'lumot yo'qolmagan — sababni tuzatib, qayta ishlashingiz mumkin.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {failed.map((ev) => (
              <div key={ev.id} style={{
                padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8,
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    Lead {ev.leadgenId}
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)', marginLeft: 8, fontWeight: 400 }}>
                      {new Date(ev.createdAt).toLocaleString('ru-RU')}
                      {ev.attempts > 0 && ` • ${ev.attempts} urinish`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 3, lineHeight: 1.5 }}>
                    {ev.status === 'SKIPPED'
                      ? "Formada telefon ham, email ham topilmadi — Facebook formasiga aloqa maydonini qo'shing"
                      : ev.status === 'NO_TENANT'
                        ? 'Bu Page hali hech qanday hisobga ulanmagan edi'
                        : (ev.lastError || "Noma'lum xato")}
                  </div>
                </div>
                <button
                  style={{ ...btnGhost, flexShrink: 0, opacity: busy === ev.id ? 0.6 : 1 }}
                  disabled={busy === ev.id}
                  onClick={() => retry(ev.id)}
                >
                  Qayta urinish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}