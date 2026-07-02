'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { clientsApi, usersApi } from '@/services/api';
import { Btn, Input, Select, Card, Skeleton, Badge, Modal, Label, Textarea, Avatar, Checkbox, EmptyState } from '@/components/ui';
import { TIER_LABELS, SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS, errMsg, timeAgo } from '@/lib/helpers';
import {
  Users, UserPlus, Search, Download, GitBranch, UserCheck, X, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', source: '', stage: '', sortBy: 'recent' });
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);

  // ── v10.2: BULK ACTIONS ──────────────────────────────────
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
      esc(STAGE_LABELS[c.pipelineStage] || c.pipelineStage),
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
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} style={{ color: 'var(--primary)' }} /> Klientlar
            {data?.meta?.total != null && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-3)' }}>({data.meta.total})</span>}
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" icon={<Download size={14} />} onClick={exportCsv}>CSV</Btn>
            <Btn icon={<UserPlus size={14} />} onClick={() => setShowAdd(true)}>Yangi Klient</Btn>
          </div>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)', pointerEvents: 'none' }} />
              <Input style={{ paddingLeft: 32 }} placeholder="Qidirish (ism, telefon, email...)" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            <Select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <option value="">Barcha manba</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
              <option value="">Barcha bosqich</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
              <option value="recent">Yangi</option>
              <option value="name">Ism</option>
              <option value="revenue">Daromad</option>
            </Select>
          </div>
        </Card>

        {/* ── BULK ACTION BAR ── */}
        {selected.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', marginBottom: 12,
            background: 'var(--primary-soft, rgba(61,126,255,.08))',
            border: '1px solid var(--primary)', borderRadius: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              {selected.size} ta tanlandi
            </span>
            <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={13} style={{ color: 'var(--fg-3)' }} />
              <Select disabled={bulkBusy} style={{ minWidth: 150, padding: '5px 10px', fontSize: 12 }} value=""
                onChange={(e) => { if (e.target.value) bulkApply({ pipelineStage: e.target.value }, 'yangi bosqich'); }}>
                <option value="">Bosqich o'zgartirish...</option>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck size={13} style={{ color: 'var(--fg-3)' }} />
              <Select disabled={bulkBusy || agents.length === 0} style={{ minWidth: 150, padding: '5px 10px', fontSize: 12 }} value=""
                onChange={(e) => { if (e.target.value) bulkApply({ assignedAgentId: e.target.value }, 'agent'); }}>
                <option value="">Agent biriktirish...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <Btn size="sm" variant="secondary" icon={<Download size={13} />} disabled={bulkBusy} onClick={exportCsv}>CSV</Btn>
            {bulkBusy && <Loader2 size={15} className="spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />}
            <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <X size={13} /> Bekor qilish
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
                  title="Hali klient yo'q"
                  description="Birinchi klientingizni qo'shing yoki Telegram/Instagram'dan kelgan leadlar shu yerda paydo bo'ladi."
                  actionLabel="+ Birinchi klientni qo'shish"
                  onAction={() => setShowAdd(true)}
                />
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg)' }}>
                    <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 8px 12px 14px', width: 34 }}>
                        <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
                      </th>
                      <th style={{ padding: 12, textAlign: 'left' }}>F.I.SH.</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Nomer</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Bosqich</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Manba</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Takliflar</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Oxirgi aloqa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c: any) => (
                      <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}
                          style={{ borderTop: '1px solid var(--border-2)', cursor: 'pointer', background: selected.has(c.id) ? 'var(--primary-soft, rgba(61,126,255,.06))' : 'transparent' }}
                          onMouseEnter={(e) => !selected.has(c.id) && (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={(e) => !selected.has(c.id) && (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 8px 12px 14px' }} onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(c.id)} onChange={(v) => toggleOne(c.id, v)} />
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={c.fullName} size={30} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                              {c.email && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          <div>{c.phone}</div>
                          {c.assignedAgent && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.assignedAgent.name}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <Badge color={STAGE_COLORS[c.pipelineStage]}>{STAGE_LABELS[c.pipelineStage]?.replace(/^\S+\s/, '')}</Badge>
                        </td>
                        <td style={{ padding: 12, fontSize: 11, color: 'var(--fg-2)' }}>
                          {SOURCE_LABELS[c.source]}
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
      </div>
    </CrmLayout>
  );
}

function AddClientModal({ onClose, onSaved }: any) {
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
      toast.success('Klient qo\'shildi');
      onSaved();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="Yangi klient" maxWidth={500}>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>F.I.SH. *</Label>
          <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <Label>Telefon *</Label>
          <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998901234567" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Manba</Label>
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label>Tier</Label>
          <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>Izoh</Label>
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