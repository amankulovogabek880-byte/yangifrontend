'use client';
import { useEffect, useState, useCallback } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { marketplaceApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

/**
 * TUR OPERATORLAR — har bir kompaniya O'Z operatorlarini boshqaradi.
 *
 * Kompaniya administratori istagancha operator qo'shadi (cheklov yo'q),
 * ularning login/parolini kiritadi (backend shifrlab saqlaydi) va
 * turlarini yuklaydi. Boshqa kompaniya bu operatorlarni KO'RMAYDI.
 *
 * Turlarni yuklashning 2 yo'li:
 *   1) CSV fayl (Excel'dan "Save as CSV") — kutubxonasiz, sof JS bilan o'qiladi
 *   2) API sync — operatorda API bo'lsa
 */

const inp: any = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
};
const btnPrimary: any = {
  padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const EMPTY = {
  name: '', contactPhone: '', contactEmail: '', website: '',
  integrationType: 'MANUAL', apiBaseUrl: '',
  credLogin: '', credPassword: '', apiKey: '',
};

/**
 * CSV parser — qo'shtirnoq ichidagi vergullarni ham to'g'ri o'qiydi.
 * Kutubxona kerak emas.
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

  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map(h => String(h).trim());
  return nonEmpty.slice(1).map(r => {
    const obj: any = {};
    headers.forEach((h, i) => { if (h) obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

export default function MarketplaceOperatorsPage() {
  const { t: tr } = useI18n();
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null); // null = yopiq, {} = yangi, {id} = tahrir
  const [busy, setBusy] = useState(false);
  const [importFor, setImportFor] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [replaceAll, setReplaceAll] = useState(true);

  // v12.1: operatorlar TENANTGA tegishli — kompaniya administratori boshqaradi
  const canManage = ['TENANT_ADMIN', 'PLATFORM_OWNER'].includes(user?.role || '');

  const load = useCallback(() => {
    setLoading(true);
    marketplaceApi.listOperators({ limit: 100 })
      .then(r => setItems(r.data?.data || []))
      .catch(() => toast.error(tr('common.error')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form?.name?.trim()) { toast.error(tr('mpo.name')); return; }
    setBusy(true);
    try {
      const payload: any = { ...form };
      // Bo'sh maxfiy maydonlarni yubormaymiz (mavjudi o'chib ketmasin)
      ['credLogin', 'credPassword', 'apiKey'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });
      if (form.id) await marketplaceApi.updateOperator(form.id, payload);
      else await marketplaceApi.createOperator(payload);
      toast.success(tr('common.saved') || 'OK');
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(op: any) {
    if (!confirm(tr('mpo.deleteConfirm'))) return;
    try {
      await marketplaceApi.deleteOperator(op.id);
      toast.success(tr('common.deleted') || 'OK');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'));
    }
  }

  async function sync(op: any) {
    setBusy(true);
    const id = toast.loading(tr('common.loading'));
    try {
      const r = await marketplaceApi.syncOperator(op.id);
      toast.success(`+${r.data?.created || 0} / ~${r.data?.updated || 0}`, { id });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'), { id });
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = text.trim().startsWith('[') ? JSON.parse(text) : parseCSV(text);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          toast.error('CSV bo\'sh yoki noto\'g\'ri');
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length} qator o'qildi`);
      } catch {
        toast.error('Faylni o\'qib bo\'lmadi');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function doImport() {
    if (!importFor || rows.length === 0) return;
    setBusy(true);
    const id = toast.loading(tr('common.loading'));
    try {
      const r = await marketplaceApi.importTours(importFor.id, rows, replaceAll);
      const d = r.data || {};
      toast.success(`${tr('mpo.imported')}: +${d.created || 0} / ~${d.updated || 0}${d.skippedCount ? ` (${d.skippedCount} o'tkazildi)` : ''}`, { id });
      setImportFor(null);
      setRows([]);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('common.error'), { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🏢 {tr('mpo.title')}</h1>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{tr('mpo.subtitle')}</div>
          </div>
          {canManage && (
            <button style={btnPrimary} onClick={() => setForm({ ...EMPTY })}>+ {tr('mpo.new')}</button>
          )}
        </div>

        {!canManage && (
          <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16, fontSize: 13, color: 'var(--fg-2)' }}>
            {tr('mpo.readOnly')}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--fg-3)', padding: 40, textAlign: 'center' }}>{tr('common.loading')}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            {tr('common.empty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((o: any) => (
              <div key={o.id} style={{
                padding: 16, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)',
                borderLeft: `3px solid ${o.status === 'ERROR' ? '#ef4444' : o.status === 'ACTIVE' ? '#10b981' : '#94a3b8'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{o.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-4)', color: 'var(--fg-2)', fontWeight: 700 }}>
                        {o.integrationType}
                      </span>
                      {o.hasCredentials && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#10b98122', color: '#10b981', fontWeight: 700 }}>
                          🔒 {tr('mpo.credentials')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 5 }}>
                      {o.toursCount || 0} {tr('mpo.tours')}
                      {o.lastSyncAt ? ` · ${tr('mpo.lastSync')}: ${new Date(o.lastSyncAt).toLocaleString('ru-RU')}` : ''}
                    </div>
                    {(o.contactPhone || o.contactEmail || o.website) && (
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>
                        {o.contactPhone ? `📞 ${o.contactPhone}  ` : ''}
                        {o.contactEmail ? `✉ ${o.contactEmail}  ` : ''}
                        {o.website ? `🔗 ${o.website}` : ''}
                      </div>
                    )}
                    {o.lastSyncError && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>⚠ {o.lastSyncError}</div>
                    )}
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <button style={btnGhost} onClick={() => { setImportFor(o); setRows([]); }}>{tr('mpo.import')}</button>
                      {o.integrationType === 'API' && (
                        <button style={btnGhost} disabled={busy} onClick={() => sync(o)}>{tr('mpo.sync')}</button>
                      )}
                      <button style={btnGhost} onClick={() => setForm({
                        id: o.id, name: o.name, contactPhone: o.contactPhone || '',
                        contactEmail: o.contactEmail || '', website: o.website || '',
                        integrationType: o.integrationType, apiBaseUrl: o.apiBaseUrl || '',
                        credLogin: '', credPassword: '', apiKey: '',
                      })}>{tr('common.edit')}</button>
                      <button style={{ ...btnGhost, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => remove(o)}>
                        {tr('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Operator formasi ── */}
      {form && (
        <div onClick={() => !busy && setForm(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>
              {form.id ? tr('common.edit') : tr('mpo.new')}
            </h2>

            <F label={tr('mpo.name')}>
              <input style={inp} value={form.name} onChange={e => setForm((s: any) => ({ ...s, name: e.target.value }))} />
            </F>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '10px 0' }}>
              <F label={tr('common.phone')}>
                <input style={inp} value={form.contactPhone} onChange={e => setForm((s: any) => ({ ...s, contactPhone: e.target.value }))} />
              </F>
              <F label={tr('common.email')}>
                <input style={inp} value={form.contactEmail} onChange={e => setForm((s: any) => ({ ...s, contactEmail: e.target.value }))} />
              </F>
            </div>

            <F label="Website">
              <input style={inp} value={form.website} onChange={e => setForm((s: any) => ({ ...s, website: e.target.value }))} />
            </F>

            <div style={{ margin: '10px 0' }}>
              <F label={tr('mpo.integration')}>
                <select style={inp} value={form.integrationType} onChange={e => setForm((s: any) => ({ ...s, integrationType: e.target.value }))}>
                  <option value="MANUAL">MANUAL — qo'lda</option>
                  <option value="EXCEL">EXCEL — CSV import</option>
                  <option value="API">API — avtomatik</option>
                </select>
              </F>
            </div>

            {form.integrationType === 'API' && (
              <F label={tr('mpo.apiUrl')}>
                <input style={inp} placeholder="https://operator.uz/api/tours"
                  value={form.apiBaseUrl} onChange={e => setForm((s: any) => ({ ...s, apiBaseUrl: e.target.value }))} />
              </F>
            )}

            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>🔒 {tr('mpo.credentials')}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>{tr('mpo.encrypted')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <F label={tr('mpo.login')}>
                  <input style={inp} autoComplete="off" value={form.credLogin}
                    onChange={e => setForm((s: any) => ({ ...s, credLogin: e.target.value }))} />
                </F>
                <F label={tr('mpo.password')}>
                  <input style={inp} type="password" autoComplete="new-password" value={form.credPassword}
                    onChange={e => setForm((s: any) => ({ ...s, credPassword: e.target.value }))} />
                </F>
              </div>
              <div style={{ marginTop: 10 }}>
                <F label={tr('mpo.apiKey')}>
                  <input style={inp} type="password" autoComplete="off" value={form.apiKey}
                    onChange={e => setForm((s: any) => ({ ...s, apiKey: e.target.value }))} />
                </F>
              </div>
              {form.id && (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8 }}>
                  Bo'sh qoldirsangiz — eskisi o'zgarmaydi.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button style={btnGhost} disabled={busy} onClick={() => setForm(null)}>{tr('common.cancel')}</button>
              <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{tr('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV import modali ── */}
      {importFor && (
        <div onClick={() => !busy && setImportFor(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)',
            padding: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{tr('mpo.import')}</h2>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 4 }}>{importFor.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>{tr('mpo.csvHint')}</div>

            <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Ustun nomlari (kamida shu 3 tasi):</div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.7 }}>
                <code>title</code> (yoki <code>nomi</code>, <code>название</code>) ·{' '}
                <code>destination</code> (yoki <code>shahar</code>, <code>город</code>) ·{' '}
                <code>price</code> (yoki <code>narx</code>, <code>цена</code>) — mijoz narxi
                <br />
                <b style={{ color: '#10b981' }}>Foyda hisoblanishi uchun:</b>{' '}
                <code>netPrice</code> (yoki <code>netto</code>, <code>tannarx</code>,{' '}
                <code>себестоимость</code>) — operatorga to'lanadigan narx
                <br />
                Qo'shimcha: <code>country</code>, <code>currency</code>, <code>departureDate</code>,{' '}
                <code>returnDate</code>, <code>duration</code>, <code>seatsAvailable</code>,{' '}
                <code>hotelName</code>, <code>hotelStars</code>, <code>mealPlan</code>,{' '}
                <code>externalId</code>, <code>images</code>
              </div>
            </div>

            <input type="file" accept=".csv,.txt,.json" onChange={onFile}
              style={{ ...inp, padding: 8, marginBottom: 12 }} />

            {rows.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>
                  ✓ {rows.length} qator tayyor
                </div>
                <div style={{
                  maxHeight: 160, overflowY: 'auto', fontSize: 11, background: 'var(--bg)',
                  borderRadius: 8, border: '1px solid var(--border)', padding: 8, color: 'var(--fg-2)',
                }}>
                  {rows.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      {Object.values(r).slice(0, 5).join(' · ')}
                    </div>
                  ))}
                  {rows.length > 5 && <div style={{ paddingTop: 4, color: 'var(--fg-3)' }}>… yana {rows.length - 5}</div>}
                </div>
              </div>
            )}

            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', color: 'var(--fg-2)', marginBottom: 16 }}>
              <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
              {tr('mpo.replaceAll')}
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} disabled={busy} onClick={() => { setImportFor(null); setRows([]); }}>{tr('common.cancel')}</button>
              <button style={{ ...btnPrimary, opacity: (busy || !rows.length) ? 0.5 : 1 }}
                disabled={busy || !rows.length} onClick={doImport}>
                {tr('mpo.import')}
              </button>
            </div>
          </div>
        </div>
      )}
    </CrmLayout>
  );
}

function F({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}