'use client';
import { useEffect, useState, useCallback } from 'react';
import { marketplaceApi } from '@/services/api';
import toast from 'react-hot-toast';

/**
 * TUR OPERATORLAR — Sozlamalar bo'limi (faqat TENANT_ADMIN).
 *
 * MODEL:
 *   Platforma egasi operatorlar bilan shartnoma tuzadi va ularning
 *   API manzillarini serverga (.env) joylaydi. Agentlik faqat
 *   O'Z login/parolini kiritadi.
 *
 * OQIM:
 *   Kartochka (logo + nom) → bosish → login/parol → tekshiriladi →
 *   "Ulandingiz" → turlar avtomatik yuklanadi → agentlar ko'radi.
 *
 * XAVFSIZLIK: parol serverda shifrlanadi va hech qachon qaytarilmaydi.
 */

const inp: any = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
};
const btnPrimary: any = {
  padding: '9px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

export default function TourOperatorsSettings() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ulanish oynasi
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState({ login: '', password: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    marketplaceApi.listCatalog()
      .then((r) => setItems(r.data?.data || []))
      .catch(() => toast.error("Operatorlar ro'yxatini olishda xato"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openConnect(op: any) {
    if (!op.configured) {
      toast.error(`"${op.name}" hali sozlanmagan. Platforma administratoriga murojaat qiling.`);
      return;
    }
    setActive(op);
    setForm({ login: '', password: '' });
  }

  async function connect() {
    if (!active) return;
    if (active.authType !== 'apikey' && !form.login.trim()) {
      toast.error(`${active.loginLabel || 'Login'} kiriting`);
      return;
    }
    if (!form.password.trim()) {
      toast.error(`${active.passwordLabel || 'Parol'} kiriting`);
      return;
    }

    setBusy(true);
    const tid = toast.loading('Tekshirilmoqda...');
    try {
      const r = await marketplaceApi.connectCatalog(active.slug, {
        login: form.login.trim() || undefined,
        password: form.password.trim(),
      });
      toast.success(r.data?.message || 'Ulandingiz', { id: tid });
      setActive(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Ulanib bo'lmadi", { id: tid });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(op: any) {
    if (!confirm(`"${op.name}" ulanishi uziladi va uning barcha turlari o'chadi. Davom etasizmi?`)) return;
    try {
      await marketplaceApi.disconnectCatalog(op.slug);
      toast.success('Ulanish uzildi');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xato');
    }
  }

  async function resync(op: any) {
    if (!op.operatorId) return;
    const tid = toast.loading('Turlar yangilanmoqda...');
    try {
      const r = await marketplaceApi.syncOperator(op.operatorId);
      const d = r.data || {};
      toast.success(`+${d.created || 0} yangi, ${d.updated || 0} yangilandi`, { id: tid });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xato', { id: tid });
    }
  }

  const connectedCount = items.filter((i) => i.connected).length;
  const totalTours = items.reduce((sum, i) => sum + (i.toursCount || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>🏢 Tur operatorlar</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          Ishlaydigan operatoringizni tanlab, o'sha operatordagi login va parolingizni kiriting.
          Ulangach barcha turlari <b>Turlar bozori</b> bo'limida agentlarga ko'rinadi.
        </div>
      </div>

      {!loading && (
        <div style={{
          display: 'flex', gap: 16, padding: '10px 14px', marginBottom: 16,
          background: 'var(--bg-3)', borderRadius: 10, fontSize: 12, flexWrap: 'wrap',
        }}>
          <span>Ulangan: <b style={{ color: '#10b981' }}>{connectedCount}</b> / {items.length}</span>
          <span>Jami turlar: <b>{totalTours}</b></span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {items.map((op) => {
            const isError = op.status === 'ERROR';
            return (
              <div
                key={op.slug}
                onClick={() => !op.connected && openConnect(op)}
                style={{
                  padding: 14,
                  background: 'var(--bg-2)',
                  border: `1px solid ${op.connected ? (isError ? '#ef4444' : '#10b981') : 'var(--border)'}`,
                  borderRadius: 12,
                  cursor: op.connected ? 'default' : (op.configured ? 'pointer' : 'not-allowed'),
                  opacity: op.configured ? 1 : 0.55,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {/* Logo + nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {op.logoUrl ? (
                    <img
                      src={op.logoUrl}
                      alt={op.name}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: '#fff' }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: 'var(--bg-4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: 'var(--fg-3)',
                    }}>
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{op.name}</div>
                    {op.connected && (
                      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                        {op.toursCount || 0} ta tur
                      </div>
                    )}
                  </div>
                </div>

                {/* Holat */}
                {op.connected ? (
                  isError ? (
                    <div style={{ fontSize: 11, color: '#ef4444', lineHeight: 1.5 }}>
                      ⚠ {op.lastSyncError || 'Sinxronizatsiya xatosi'}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                      ✅ Ulandingiz
                    </div>
                  )
                ) : op.configured ? (
                  <div style={{ fontSize: 11, color: '#3d7eff', fontWeight: 600 }}>
                    Ulanish uchun bosing →
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    Hali mavjud emas
                  </div>
                )}

                {/* Amallar */}
                {op.connected && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button style={{ ...btnGhost, flex: 1 }}
                      onClick={(e) => { e.stopPropagation(); resync(op); }}>
                      ↻ Yangilash
                    </button>
                    <button
                      style={{ ...btnGhost, borderColor: '#ef4444', color: '#ef4444' }}
                      onClick={(e) => { e.stopPropagation(); disconnect(op); }}>
                      Uzish
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Ulanish oynasi ── */}
      {active && (
        <div
          onClick={() => !busy && setActive(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
              padding: 22, width: '100%', maxWidth: 400,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              {active.logoUrl && (
                <img src={active.logoUrl} alt="" style={{
                  width: 44, height: 44, borderRadius: 8, objectFit: 'contain', background: '#fff',
                }} />
              )}
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{active.name}</h3>
            </div>

            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 16, lineHeight: 1.6 }}>
              {active.helpText || "Shu operatordagi shaxsiy kabinetingiz ma'lumotlarini kiriting."}
            </div>

            {active.authType !== 'apikey' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>
                  {active.loginLabel || 'Login'}
                </div>
                <input
                  style={inp}
                  autoFocus
                  autoComplete="off"
                  value={form.login}
                  onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') connect(); }}
                />
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>
                {active.passwordLabel || 'Parol'}
              </div>
              <input
                style={inp}
                type="password"
                autoComplete="new-password"
                autoFocus={active.authType === 'apikey'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') connect(); }}
              />
            </div>

            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 18 }}>
              🔒 Ma'lumotlaringiz shifrlangan holda saqlanadi va hech kimga ko'rsatilmaydi.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={busy} onClick={() => setActive(null)}>
                Bekor qilish
              </button>
              <button
                style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
                disabled={busy}
                onClick={connect}
              >
                {busy ? 'Tekshirilmoqda...' : 'Ulanish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}