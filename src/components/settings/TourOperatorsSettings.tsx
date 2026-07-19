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


/**
 * CSV parser — qo'shtirnoq ichidagi vergullarni ham to'g'ri o'qiydi.
 * Kutubxona kerak emas (papaparse va shunga o'xshash paket o'rnatilmagan).
 */
function parseCSV(text: string): any[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map((h) => String(h).trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: any = {};
    headers.forEach((h, i) => { if (h) obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

/** Namuna CSV — admin ustun nomlarini qo'lda yozmasin */
function downloadTemplate() {
  const headers = [
    'title', 'destination', 'country', 'price', 'netPrice', 'currency',
    'departureDate', 'returnDate', 'duration', 'seatsTotal', 'seatsAvailable',
    'hotelName', 'hotelStars', 'mealPlan',
    'includesVisa', 'includesFlights', 'includesHotel', 'includesTransfer',
    'externalId', 'description',
  ];
  const rows = [
    ['Dubay 5 kun 4 kecha', 'Dubay', 'BAA', '450', '380', 'USD',
      '2026-09-10', '2026-09-15', '5', '20', '20',
      'Rove Downtown', '4', 'BB', 'ha', 'ha', 'ha', 'ha',
      'DXB-001', 'Aviabilet va mehmonxona narxga kiradi'],
    ['Antalya All Inclusive', 'Antalya', 'Turkiya', '520', '440', 'USD',
      '2026-08-01', '2026-08-08', '7', '30', '25',
      'Delphin Imperial', '5', 'AI', "yo'q", 'ha', 'ha', 'ha',
      'AYT-014', 'Hammasi kiritilgan'],
  ];
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'omoncrm-turlar-namuna.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TourOperatorsSettings() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ulanish oynasi
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState({ login: '', password: '' });
  const [busy, setBusy] = useState(false);

  // ── Qo'lda qo'shilgan operatorlar (API'siz — Excel/CSV bilan ishlaydi) ──
  const [manual, setManual] = useState<any[]>([]);
  const [newOp, setNewOp] = useState<any>(null);      // qo'shish formasi
  const [importFor, setImportFor] = useState<any>(null); // CSV oynasi
  const [rows, setRows] = useState<any[]>([]);
  const [replaceAll, setReplaceAll] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      marketplaceApi.listCatalog().catch(() => ({ data: { data: [] } })),
      marketplaceApi.listOperators({ limit: 100 }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([cat, ops]: any[]) => {
        const catalog = cat.data?.data || [];
        setItems(catalog);

        // Katalogdan ulanganlar yuqorida ko'rsatiladi — bu yerda
        // faqat QO'LDA qo'shilganlar (Excel/CSV bilan ishlaydiganlar)
        const catalogSlugs = new Set(catalog.map((c: any) => c.slug));
        const all = ops.data?.data || [];
        setManual(all.filter((o: any) => !catalogSlugs.has(o.slug)));
      })
      .catch(() => toast.error("Operatorlar ro'yxatini olishda xato"))
      .finally(() => setLoading(false));
  }, []);

  // ── Qo'lda operator qo'shish ──
  async function createManual() {
    const name = String(newOp?.name || '').trim();
    if (!name) { toast.error('Operator nomini kiriting'); return; }
    setBusy(true);
    try {
      await marketplaceApi.createOperator({
        name,
        contactPhone: newOp?.contactPhone?.trim() || undefined,
        contactEmail: newOp?.contactEmail?.trim() || undefined,
        integrationType: 'EXCEL',
      });
      toast.success(`"${name}" qo'shildi. Endi turlarini yuklang.`);
      setNewOp(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xato');
    } finally {
      setBusy(false);
    }
  }

  async function removeManual(op: any) {
    if (!confirm(`"${op.name}" va uning barcha turlari o'chiriladi. Davom etasizmi?`)) return;
    try {
      await marketplaceApi.deleteOperator(op.id);
      toast.success("O'chirildi");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xato');
    }
  }

  // ── CSV fayl o'qish ──
  function onFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = text.trim().startsWith('[') ? JSON.parse(text) : parseCSV(text);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          toast.error("Fayl bo'sh yoki noto'g'ri formatda");
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length} ta qator o'qildi`);
      } catch {
        toast.error("Faylni o'qib bo'lmadi");
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function doImport() {
    if (!importFor || rows.length === 0) return;
    setBusy(true);
    const tid = toast.loading('Yuklanmoqda...');
    try {
      const r = await marketplaceApi.importTours(importFor.id, rows, replaceAll);
      const d = r.data || {};
      toast.success(
        `+${d.created || 0} yangi, ${d.updated || 0} yangilandi` +
        (d.skippedCount ? `, ${d.skippedCount} o'tkazildi` : ''),
        { id: tid },
      );
      setImportFor(null);
      setRows([]);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xato', { id: tid });
    } finally {
      setBusy(false);
    }
  }

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

      {/* ══════════════════════════════════════════════════════
          EXCEL / CSV BILAN ISHLAYDIGAN OPERATORLAR
          API'si yo'q operatorlar uchun — aksariyati shunday.
          ══════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12,
        }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>
              📄 Excel / CSV bilan ishlaydigan operatorlar
            </h4>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6, maxWidth: 620 }}>
              Operatorning API'si bo'lmasa — bu yerdan qo'shing va turlar ro'yxatini
              Excel'dan CSV qilib yuklang. Turlar xuddi shu tarzda agentlarga ko'rinadi.
            </div>
          </div>
          <button style={btnPrimary} onClick={() => setNewOp({ name: '', contactPhone: '', contactEmail: '' })}>
            + Operator qo'shish
          </button>
        </div>

        {manual.length === 0 ? (
          <div style={{
            padding: 24, textAlign: 'center', background: 'var(--bg-3)',
            borderRadius: 10, fontSize: 13, color: 'var(--fg-3)',
          }}>
            Hali qo'shilmagan. Operatordan Excel ro'yxatini oling va shu yerdan yuklang.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manual.map((op) => (
              <div key={op.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 12, padding: 12, background: 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{op.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                    {op.toursCount || 0} ta tur
                    {op.lastSyncAt
                      ? ` · oxirgi yuklash: ${new Date(op.lastSyncAt).toLocaleDateString('ru-RU')}`
                      : " · hali yuklanmagan"}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={btnPrimary} onClick={() => { setImportFor(op); setRows([]); }}>
                    ⬆ Turlarni yuklash
                  </button>
                  <button
                    style={{ ...btnGhost, borderColor: '#ef4444', color: '#ef4444' }}
                    onClick={() => removeManual(op)}
                  >
                    O'chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Qo'lda operator qo'shish oynasi ── */}
      {newOp && (
        <div onClick={() => !busy && setNewOp(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 22, width: '100%', maxWidth: 400,
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              Yangi operator
            </h3>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>
                Nomi *
              </div>
              <input style={inp} autoFocus value={newOp.name}
                placeholder="Masalan: Asia Tour"
                onChange={(e) => setNewOp((o: any) => ({ ...o, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') createManual(); }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>
                  Telefon
                </div>
                <input style={inp} value={newOp.contactPhone} placeholder="+998..."
                  onChange={(e) => setNewOp((o: any) => ({ ...o, contactPhone: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>
                  Email
                </div>
                <input style={inp} value={newOp.contactEmail}
                  onChange={(e) => setNewOp((o: any) => ({ ...o, contactEmail: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={busy} onClick={() => setNewOp(null)}>
                Bekor qilish
              </button>
              <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}
                disabled={busy} onClick={createManual}>
                Qo'shish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV yuklash oynasi ── */}
      {importFor && (
        <div onClick={() => !busy && setImportFor(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
              Turlarni yuklash
            </h3>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
              {importFor.name}
            </div>

            <div style={{
              padding: 12, background: 'var(--bg-3)', borderRadius: 10,
              border: '1px solid var(--border)', marginBottom: 14, fontSize: 11,
              color: 'var(--fg-2)', lineHeight: 1.8,
            }}>
              <b>Qanday qilinadi:</b><br />
              1. Namunani yuklab oling → Excel'da oching<br />
              2. Operatordan olgan turlarni kiriting<br />
              3. <b>Fayl → Farqli saqlash → CSV UTF-8</b><br />
              4. Shu yerga yuklang
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <b>Majburiy ustunlar:</b> <code>title</code>, <code>destination</code>, <code>price</code><br />
                <b style={{ color: '#10b981' }}>Foyda hisoblanishi uchun:</b> <code>netPrice</code> (operatorga to'lanadigan narx)
              </div>
            </div>

            <button type="button" onClick={downloadTemplate}
              style={{ ...btnGhost, width: '100%', marginBottom: 10, padding: '10px 12px' }}>
              ⬇ Namuna faylni yuklab olish
            </button>

            <input type="file" accept=".csv,.txt,.json" onChange={onFile}
              style={{ ...inp, padding: 8, marginBottom: 12 }} />

            {rows.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>
                  ✓ {rows.length} ta qator tayyor
                </div>
                <div style={{
                  maxHeight: 140, overflowY: 'auto', fontSize: 11, background: 'var(--bg)',
                  borderRadius: 8, border: '1px solid var(--border)', padding: 8,
                  color: 'var(--fg-2)',
                }}>
                  {rows.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      {Object.values(r).slice(0, 5).join(' · ')}
                    </div>
                  ))}
                  {rows.length > 5 && (
                    <div style={{ paddingTop: 4, color: 'var(--fg-3)' }}>… yana {rows.length - 5} ta</div>
                  )}
                </div>
              </div>
            )}

            <label style={{
              display: 'flex', gap: 6, alignItems: 'center', fontSize: 12,
              cursor: 'pointer', color: 'var(--fg-2)', marginBottom: 16,
            }}>
              <input type="checkbox" checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)} />
              Eski turlarni arxivlash (yangi ro'yxat bilan almashtirish)
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={busy}
                onClick={() => { setImportFor(null); setRows([]); }}>
                Bekor qilish
              </button>
              <button
                style={{ ...btnPrimary, opacity: (busy || !rows.length) ? 0.5 : 1 }}
                disabled={busy || !rows.length}
                onClick={doImport}
              >
                Yuklash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}