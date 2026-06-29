'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { clientsApi } from '@/services/api';
import { Btn, Input, Select, Card, Empty, Skeleton, Badge, Modal, Label, Textarea } from '@/components/ui';
import { TIER_COLORS, TIER_LABELS, SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS, errMsg, timeAgo } from '@/lib/helpers';
import toast from 'react-hot-toast';

export default function ClientsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', tier: '', source: '', stage: '', leadScore: '', sortBy: 'recent' });
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 25 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    clientsApi.list(params)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters, page]);

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>👤 Klientlar</h1>
          <Btn onClick={() => setShowAdd(true)}>+ Yangi Klient</Btn>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
            <Input placeholder="Qidirish (ism, telefon, email...)" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <Select value={filters.tier} onChange={(e) => setFilters({ ...filters, tier: e.target.value })}>
              <option value="">Barcha tier</option>
              {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <option value="">Barcha manba</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
              <option value="">Barcha bosqich</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.leadScore} onChange={(e) => setFilters({ ...filters, leadScore: e.target.value })}>
              <option value="">Barcha score</option>
              <option value="hot">🔥 ISSIQ (80+)</option>
              <option value="warm">⚡ O'RTA (50-79)</option>
              <option value="cold">❄️ SOVUQ (0-49)</option>
            </Select>
          </div>
          <div style={{ marginTop: 10 }}>
            <Select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
              <option value="recent">Yangi</option>
              <option value="name">Ism</option>
              <option value="revenue">Daromad</option>
              <option value="score">Score</option>
            </Select>
          </div>
        </Card>

        {loading && <Skeleton height={400} />}

        {!loading && data && (
          <>
            {data.data.length === 0 ? (
              <Empty icon="👤" title="Klient yo'q" hint="Yangi klient qo'shing" />
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg)' }}>
                    <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: 12, textAlign: 'left' }}>F.I.SH.</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Aloqa</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Tier</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Bosqich</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Manba</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Bookings</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Score</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Aloqa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((c: any) => (
                      <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}
                          style={{ borderTop: '1px solid var(--border-2)', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                          {c.email && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.email}</div>}
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>
                          <div>{c.phone}</div>
                          {c.assignedAgent && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>👤 {c.assignedAgent.name}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <Badge color={TIER_COLORS[c.tier]}>{TIER_LABELS[c.tier]}</Badge>
                        </td>
                        <td style={{ padding: 12 }}>
                          <Badge color={STAGE_COLORS[c.pipelineStage]}>{STAGE_LABELS[c.pipelineStage]?.replace(/^\S+\s/, '')}</Badge>
                        </td>
                        <td style={{ padding: 12, fontSize: 11, color: 'var(--fg-2)' }}>
                          {SOURCE_LABELS[c.source]}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ fontWeight: 600 }}>{c._count?.bookings || 0}</span>
                          {c.totalRevenue > 0 && <div style={{ fontSize: 11, color: 'var(--success)' }}>${Math.round(c.totalRevenue)}</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                            background: c.leadScore >= 80 ? '#ef444420' : c.leadScore >= 50 ? '#eab30820' : '#0ea5e920',
                            color: c.leadScore >= 80 ? '#ef4444' : c.leadScore >= 50 ? '#eab308' : '#0ea5e9',
                          }}>
                            {c.leadScore >= 80 ? '🔥' : c.leadScore >= 50 ? '⚡' : '❄️'} {c.leadScore}
                          </span>
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
