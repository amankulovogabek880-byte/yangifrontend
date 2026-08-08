'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { clientsApi, usersApi } from '@/services/api';
import { Btn, Input, Select, Card, Skeleton, Badge, Modal, Label, Textarea, Avatar, Checkbox, EmptyState } from '@/components/ui';
import { TIER_LABELS, SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS, errMsg, timeAgo } from '@/lib/helpers';
import {
  Users, UserPlus, Search, Download, GitBranch, UserCheck, X, Loader2, CheckSquare,
  Globe, Phone as PhoneIcon, Handshake, Footprints, HelpCircle, UserX, Maximize2,
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { FaTelegram, FaInstagram, FaWhatsapp, FaFacebook } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import { ClientQuickView } from '@/components/ClientQuickView';
import { useIsMobile } from '@/hooks/useIsMobile';

// ─── Manba indikatori: har bir manba uchun mos brand ikoni + rangi ──────────────
// ─── Bosqich nomi/rangi: avval maxsus (Kanban) bosqichni ko'rsatadi, bo'lmasa eski enum'ga qaytadi ──
function stageLabel(c: any): string {
  if (c.customStage?.name) return c.customStage.name;
  return (STAGE_LABELS[c.pipelineStage] || c.pipelineStage || '').replace(/^\S+\s/, '');
}
function stageColor(c: any): string | undefined {
  if (c.customStage?.color) return c.customStage.color;
  return STAGE_COLORS[c.pipelineStage];
}
const SOURCE_META: Record<string, { label: string; color: string; Icon: any }> = {
  TELEGRAM:   { label: 'Telegram',   color: '#229ED9', Icon: FaTelegram },
  INSTAGRAM:  { label: 'Instagram',  color: '#E1306C', Icon: FaInstagram },
  WHATSAPP:   { label: 'WhatsApp',   color: '#25D366', Icon: FaWhatsapp },
  FACEBOOK:   { label: 'Facebook',   color: '#1877F2', Icon: FaFacebook },
  REFERRAL:   { label: 'Tavsiya',    color: '#8b5cf6', Icon: Handshake },
  WALKIN:     { label: 'Ofisga keldi', color: '#f59e0b', Icon: Footprints },
  WEBSITE:    { label: 'Sayt',       color: '#0ea5e9', Icon: Globe },
  CALL:       { label: "Qo'ng'iroq", color: '#10b981', Icon: PhoneIcon },
  GOOGLE_ADS: { label: 'Google',     color: '#EA4335', Icon: Search },
  OTHER:      { label: 'Boshqa',     color: 'var(--fg-3)', Icon: HelpCircle },
};

function SourceBadge({ source }: { source?: string }) {
  const meta = SOURCE_META[source || ''] || SOURCE_META.OTHER;
  const Icon = meta.Icon;
  return (
    <span
      title={meta.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
        borderRadius: 999, fontSize: 12, fontWeight: 600, color: meta.color,
        background: 'color-mix(in srgb, ' + meta.color + ' 12%, transparent)',
        border: '1px solid color-mix(in srgb, ' + meta.color + ' 30%, transparent)',
      }}
    >
      <Icon size={13} style={{ flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', source: '', stage: '', sortBy: 'recent' });
  const [showAdd, setShowAdd] = useState(false);
  // v30: mijozga bosilganda ilgari DOIM to'liq sahifaga (/clients/[id])
  // o'tib ketilardi — ko'p mijoz bilan ketma-ket ishlaydigan agent uchun
  // bu noqulay edi (har safar ro'yxatga qaytish kerak). Endi bosilganda
  // avval kichkina "tezkor ko'rinish" paneli (drawer) ochiladi — ro'yxat
  // orqada ko'rinib turadi. Kimga to'liq profil (bron/to'lov/xabarlar
  // tarixi) kerak bo'lsa, drawer ichidagi "To'liq profil" tugmasi orqali
  // katta ekranga o'tadi.
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  // v29: Dashboard'dagi "Boshlash uchun qadamlar" kartasidan "/clients?new=1"
  // orqali kelinsa, mijoz qo'shish oynasi avtomatik ochiladi — foydalanuvchi
  // yana "Yangi mijoz" tugmasini qidirib yurishi shart emas.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowAdd(true);
  }, []);
  // v18: "Yo'qotilgan leadlar" endi alohida sahifa emas — shu yerdan modal
  // sifatida ochiladi.
  const [showLostLeads, setShowLostLeads] = useState(false);
  // v33: Excel/CSV orqali ko'p sonli lead import qilish (eski tizimdan ko'chirish)
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);

  // ── v10.3: BULK ACTIONS — checkboxlar faqat "Tanlash" rejimida ko'rinadi
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 25 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    clientsApi.list(params)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); setSelected(new Set()); }, [filters, page]);
  useEffect(() => { if (!selectMode) setSelected(new Set()); }, [selectMode]);
  useEffect(() => {
    usersApi.list().then((r: any) => {
      const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setAgents(list.filter((u: any) => ['AGENT', 'MANAGER', 'TENANT_ADMIN'].includes(u.role)));
    }).catch(() => {});
  }, []);

  const rows: any[] = data?.data || [];
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const someSelected = rows.some((c) => selected.has(c.id));

  function toggleAll(v: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      rows.forEach((c) => (v ? n.add(c.id) : n.delete(c.id)));
      return n;
    });
  }
  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      v ? n.add(id) : n.delete(id);
      return n;
    });
  }

  // Tanlanganlarga bosqich/agent qo'llash — mavjud update endpoint orqali
  async function bulkApply(patch: any, label: string) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    let ok = 0, fail = 0;
    // 5 talik guruhlarda — serverni bosib qo'ymaslik uchun
    for (let i = 0; i < ids.length; i += 5) {
      const chunk = ids.slice(i, i + 5);
      const results = await Promise.allSettled(chunk.map((id) => clientsApi.update(id, patch)));
      results.forEach((r) => (r.status === 'fulfilled' ? ok++ : fail++));
    }
    setBulkBusy(false);
    setSelected(new Set());
    load();
    if (fail === 0) toast.success(`${ok} ta klientga ${label} qo'llandi`);
    else toast.error(`${ok} ta muvaffaqiyatli, ${fail} ta xato`);
  }

  // Tanlanganlarni CSV qilib yuklab olish
  function exportCsv() {
    const chosen = rows.filter((c) => selected.has(c.id));
    const list = chosen.length > 0 ? chosen : rows;
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['FISH', 'Telefon', 'Email', 'Bosqich', 'Manba', 'Tier', 'Agent'];
    const lines = list.map((c) => [
      esc(c.fullName), esc(c.phone), esc(c.email),
      esc(stageLabel(c)),
      esc(SOURCE_LABELS[c.source] || c.source),
      esc(TIER_LABELS[c.tier] || c.tier),
      esc(c.assignedAgent?.name),
    ].join(','));
    const csv = '\uFEFF' + header.map(esc).join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klientlar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${list.length} ta klient CSV'ga eksport qilindi`);
  }

  return (
    <CrmLayout>
      <div style={{ padding: isMobile ? '14px 12px' : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={isMobile ? 18 : 22} style={{ color: 'var(--primary)' }} /> {t('clients.title')}
            {data?.meta?.total != null && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-3)' }}>({data.meta.total})</span>}
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {/* Tanlash rejimi: bosilganda checkboxlar chiqadi */}
            <Btn variant={selectMode ? 'primary' : 'secondary'} icon={<CheckSquare size={14} />}
              onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelected(new Set()); }}
              style={isMobile ? { flex: '1 1 auto' } : undefined}>
              {selectMode ? t('clients.selectClose') : t('clients.select')}
            </Btn>
            {!isMobile && <Btn variant="secondary" icon={<Download size={14} />} onClick={exportCsv}>CSV</Btn>}
            <Btn variant="secondary" icon={<Upload size={14} />} onClick={() => setShowImport(true)} style={isMobile ? { flex: '1 1 auto' } : undefined}>Import</Btn>
            <Btn variant="secondary" icon={<UserX size={14} />} onClick={() => setShowLostLeads(true)} style={isMobile ? { flex: '1 1 auto' } : undefined}>{t('clients.lost')}</Btn>
            <Btn icon={<UserPlus size={14} />} onClick={() => setShowAdd(true)} style={isMobile ? { flex: '1 1 100%' } : undefined}>{t('clients.newClient')}</Btn>
          </div>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)', pointerEvents: 'none' }} />
              <Input style={{ paddingLeft: 32 }} placeholder={t('clients.searchPh')} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <Select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <option value="">{t('clients.allSources')}</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
              <option value="">{t('clients.allStages')}</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            {/* 3-chi "Yangi" (saralash) filtri olib tashlandi — ro'yxat sukut bo'yicha
                eng yangi mijozlardan boshlab ko'rsatiladi (sortBy: 'recent'). */}
          </div>
        </Card>

        {/* ── BULK ACTION BAR ── */}
        {selectMode && selected.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', marginBottom: 12,
            background: 'var(--primary-soft, rgba(61,126,255,.08))',
            border: '1px solid var(--primary)', borderRadius: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              {selected.size} {t('clients.selected')}
            </span>
            <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={13} style={{ color: 'var(--fg-3)' }} />
              <Select disabled={bulkBusy} style={{ minWidth: 150, padding: '5px 10px', fontSize: 12 }} value=""
                onChange={(e) => { if (e.target.value) bulkApply({ pipelineStage: e.target.value }, 'yangi bosqich'); }}>
                <option value="">{t('clients.changeStage')}</option>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck size={13} style={{ color: 'var(--fg-3)' }} />
              <Select disabled={bulkBusy || agents.length === 0} style={{ minWidth: 150, padding: '5px 10px', fontSize: 12 }} value=""
                onChange={(e) => { if (e.target.value) bulkApply({ assignedAgentId: e.target.value }, 'agent'); }}>
                <option value="">{t('clients.assignAgent')}</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <Btn size="sm" variant="secondary" icon={<Download size={13} />} disabled={bulkBusy} onClick={exportCsv}>CSV</Btn>
            {bulkBusy && <Loader2 size={15} className="spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />}
            <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <X size={13} /> {t('clients.cancel2')}
            </button>
          </div>
        )}

        {loading && <Skeleton height={400} />}

        {!loading && data && (
          <>
            {rows.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Users size={28} />}
                  title={t('clients.emptyTitle')}
                  description={t('clients.emptyDesc')}
                  actionLabel={t('clients.emptyAction')}
                  onAction={() => setShowAdd(true)}
                />
              </Card>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => selectMode ? toggleOne(c.id, !selected.has(c.id)) : setQuickViewId(c.id)}
                    style={{
                      background: selected.has(c.id) ? 'var(--primary-soft, rgba(61,126,255,.08))' : 'var(--bg-2)',
                      border: '1px solid ' + (selected.has(c.id) ? 'var(--primary)' : 'var(--border)'),
                      borderRadius: 12, padding: 12, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {selectMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(c.id)} onChange={(v) => toggleOne(c.id, v)} />
                        </div>
                      )}
                      <Avatar name={c.fullName} size={34} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{c.phone || '—'}</div>
                      </div>
                      {!selectMode && (
                        <button
                          title="To'liq profilda ochish"
                          onClick={(e) => { e.stopPropagation(); router.push(`/clients/${c.id}`); }}
                          style={{
                            background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
                            cursor: 'pointer', color: 'var(--fg-2)', padding: 7, display: 'flex', flexShrink: 0,
                          }}
                        >
                          <Maximize2 size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <Badge color={stageColor(c)}>{stageLabel(c)}</Badge>
                      <SourceBadge source={c.source} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--fg-3)', borderTop: '1px solid var(--border-2)', paddingTop: 8 }}>
                      <span>{t('clients.colOffers')}: <b style={{ color: 'var(--fg-2)' }}>{(c.preferences?.offers?.length) || 0}</b></span>
                      <span>{timeAgo(c.lastContactAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg)' }}>
                    <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      {selectMode && (
                        <th style={{ padding: '12px 8px 12px 14px', width: 34 }}>
                          <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
                        </th>
                      )}
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colName')}</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colPhone')}</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colStage')}</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colSource')}</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colOffers')}</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>{t('clients.colLastContact')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c: any) => (
                      <tr key={c.id} onClick={() => selectMode ? toggleOne(c.id, !selected.has(c.id)) : setQuickViewId(c.id)}
                          style={{ borderTop: '1px solid var(--border-2)', cursor: 'pointer', background: selected.has(c.id) ? 'var(--primary-soft, rgba(61,126,255,.06))' : 'transparent' }}
                          onMouseEnter={(e) => !selected.has(c.id) && (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={(e) => !selected.has(c.id) && (e.currentTarget.style.background = 'transparent')}>
                        {selectMode && (
                          <td style={{ padding: '12px 8px 12px 14px' }} onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected.has(c.id)} onChange={(v) => toggleOne(c.id, v)} />
                          </td>
                        )}
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={c.fullName} size={30} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                              {c.email && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.email}</div>}
                            </div>
                            {/* v30: ro'yxatdan chiqmasdan, to'g'ridan-to'g'ri
                                to'liq profilga (katta ekran) o'tish tugmasi —
                                bosilganda tezkor ko'rinish drawer'i OCHILMAYDI. */}
                            {!selectMode && (
                              <button
                                title="To'liq profilda ochish"
                                onClick={(e) => { e.stopPropagation(); router.push(`/clients/${c.id}`); }}
                                style={{
                                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                                  color: 'var(--fg-4)', padding: 6, borderRadius: 6, display: 'flex', flexShrink: 0,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--bg)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-4)'; e.currentTarget.style.background = 'none'; }}
                              >
                                <Maximize2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          <div>{c.phone}</div>
                          {c.assignedAgent && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.assignedAgent.name}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <Badge color={stageColor(c)}>{stageLabel(c)}</Badge>
                        </td>
                        <td style={{ padding: 12 }}>
                          <SourceBadge source={c.source} />
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ fontWeight: 600 }}>{(c.preferences?.offers?.length) || 0}</span>
                        </td>
                        <td style={{ padding: 12, fontSize: 11, color: 'var(--fg-3)' }}>{timeAgo(c.lastContactAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {data.meta.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                <Btn variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Btn>
                <span style={{ padding: '6px 14px', color: 'var(--fg-2)', fontSize: 13 }}>{page} / {data.meta.totalPages}</span>
                <Btn variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>→</Btn>
              </div>
            )}
          </>
        )}

        {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
        {showLostLeads && <LostLeadsModal onClose={() => setShowLostLeads(false)} router={router} />}
        {showImport && <ImportLeadsModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} />}
        {quickViewId && (
          <ClientQuickView clientId={quickViewId} onClose={() => setQuickViewId(null)} />
        )}
      </div>
    </CrmLayout>
  );
}

function AddClientModal({ onClose, onSaved }: any) {
  const { t } = useI18n();
  const [form, setForm] = useState<any>({
    fullName: '', phone: '', email: '', source: 'TELEGRAM', language: 'UZ',
    tier: 'REGULAR', notes: '',
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await clientsApi.create(form);
      toast.success(t('clients.added'));
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('clients.addTitle')} maxWidth={500}>
      <form onSubmit={submit} className="grid-auto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>{t('clients.fish')}</Label>
          <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <Label>Telefon *</Label>
          <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998901234567" />
        </div>
        <div>
          <Label>{t('common.email')}</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Manba</Label>
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label>{t('clients.tier')}</Label>
          <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>{t('clients.notes')}</Label>
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
          <Btn type="submit" loading={loading} style={{ flex: 1 }}>Saqlash</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── v18: "Yo'qotilgan mijozlar" — endi Mijozlar sahifasidan modal
// sifatida ochiladi (alohida sahifaga o'tish shart emas). Umumiy hovuz —
// hamma agent ko'radi, istalgan agent qayta bog'lanishi mumkin. ────────────
function fmtLostDate(d: any): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}
function lostInitials(name: string): string {
  return String(name || '?').trim().split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}
const LOST_SOURCE_LABEL: Record<string, string> = {
  TELEGRAM: 'Telegram', INSTAGRAM: 'Instagram', WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook', WEBSITE: 'Website', REFERRAL: 'Tavsiya',
  WALK_IN: 'Walk-in', WALKIN: 'Walk-in', PHONE: 'Telefon', OTHER: 'Boshqa',
};

function LostLeadsModal({ onClose, router }: any) {
  const { t } = useI18n();
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
    <Modal open onClose={onClose} title={t('clients.lostTitle')} maxWidth={860}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            Umumiy hovuz · hamma agent ko'rishi mumkin · {total} ta
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clients.lostSearchPh')}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, minWidth: 200 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, padding: 30 }}>Yuklanmoqda…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 14, padding: 40 }}>
            {t('clients.lostEmpty')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            {items.map((c) => (
              <div
                key={c.id}
                onClick={() => { onClose(); router.push(`/clients/${c.id}`); }}
                style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', flexShrink: 0 }}>
                    {lostInitials(c.fullName)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</div>
                    <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{c.phone || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                  {c.source && (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>
                      {LOST_SOURCE_LABEL[c.source] || c.source}
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
                  <span>Yo'qotilgan: {fmtLostDate(c.pipelineStageAt)}</span>
                  <span style={{ color: 'var(--accent, #3d7eff)' }}>{t('clients.open')} →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── v33: Excel/CSV orqali ko'p sonli lead import qilish ────────────────────
// Turfirma CRM'ni o'rnatganda odatda eski tizimidan (Excel/Google Sheets)
// 1000-2000+ lead ko'chirish kerak bo'ladi. Bu modal faylni yuklaydi va
// backend har bir qatorni alohida mijoz qilib yaratadi (oldingi bosqichi
// saqlanib qoladi), so'ngra natija (import qilindi/dublikat/xato) ko'rsatiladi.
function ImportLeadsModal({ onClose, onImported }: any) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function handleFile(f: File | null) {
    setError('');
    setResult(null);
    setFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const r = await clientsApi.importLeads(file);
      setResult(r.data);
      toast.success(`${r.data.imported} ta lead muvaffaqiyatli import qilindi`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Leadlarni import qilish" maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!result && (
          <>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              Excel (.xlsx) yoki CSV faylni yuklang — har bir qator alohida mijoz
              bo'lib qo'shiladi. Ustunlar: <b>Ism*</b>, Telefon, Email, Manba,
              Bosqich (oldingi turgan bosqichi saqlanadi), Shahar, Yo'nalish,
              Byudjet, Izoh, Teglar, Agent. (* — majburiy)
            </div>

            <label
              htmlFor="import-file-input"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '28px 16px', borderRadius: 12, cursor: 'pointer',
                border: '2px dashed var(--border)', background: 'var(--bg-2)',
                textAlign: 'center' as any,
              }}
            >
              <FileSpreadsheet size={28} style={{ color: 'var(--primary)' }} />
              {file ? (
                <span style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                  Faylni tanlash uchun bosing (.xlsx yoki .csv)
                </span>
              )}
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                borderRadius: 8, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)',
                fontSize: 13, color: '#dc2626',
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={onClose} disabled={loading}>{t('clients.cancel2') || 'Bekor qilish'}</Btn>
              <Btn onClick={handleImport} disabled={!file || loading} icon={loading ? <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}>
                {loading ? 'Import qilinmoqda...' : 'Import qilish'}
              </Btn>
            </div>
          </>
        )}

        {result && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 10, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)',
            }}>
              <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div style={{ fontSize: 13 }}>
                <b>{result.imported}</b> ta lead muvaffaqiyatli import qilindi
                {result.totalRows ? ` (jami ${result.totalRows} qator)` : ''}.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as any, fontSize: 12 }}>
              {result.duplicatesSkipped > 0 && (
                <span style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>
                  Dublikat (o'tkazib yuborildi): {result.duplicatesSkipped}
                </span>
              )}
              {result.invalidRows > 0 && (
                <span style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(220,38,38,.1)', color: '#dc2626' }}>
                  Xato qatorlar: {result.invalidRows}
                </span>
              )}
              {result.stagesCreated?.length > 0 && (
                <span style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(61,126,255,.1)', color: 'var(--primary)' }}>
                  Yangi bosqichlar qo'shildi: {result.stagesCreated.join(', ')}
                </span>
              )}
            </div>

            {result.errors?.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                {result.errors.map((er: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--fg-3)', padding: '3px 0' }}>
                    {er.row}-qator: {er.reason}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="secondary" onClick={() => { setResult(null); setFile(null); }}>Yana bitta fayl</Btn>
              <Btn onClick={onImported}>Tayyor</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}