'use client';
import { useEffect, useState, useRef } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { documentsApi, clientsApi } from '@/services/api';
import { Card, Empty, Skeleton, Btn, Select, Modal, Label, Input } from '@/components/ui';
import { fmtDateTime, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

const CATEGORIES: Record<string, string> = {
  PASSPORT: '📕 Pasport', VISA: '📋 Viza', TICKET: '🎫 Chipta',
  CONTRACT: '📝 Shartnoma', INVOICE: '💲 Invoice', RECEIPT: '🧾 Receipt',
  PHOTO: '📷 Rasm', OTHER: '📎 Boshqa',
};

export default function DocumentsPage() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const load = () => {
    setLoading(true);
    const params: any = { limit: 100 };
    if (category) params.category = category;
    documentsApi.list(params).then((r) => setItems(r.data?.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [category]);

  async function del(id: string) {
    if (!confirm("O'chirilsinmi?")) return;
    try {
      await documentsApi.delete(id);
      toast.success("O'chirildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  return (
    <CrmLayout>
      <div style={{ padding: isMobile ? '14px 12px' : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>📁 Hujjatlar</h1>
          <Btn onClick={() => setShowUpload(true)}>+ Yuklash</Btn>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Barcha kategoriyalar</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Card>

        {loading && <Skeleton height={300} />}
        {!loading && items.length === 0 && <Empty icon="📁" title="Hujjat yo'q" />}

        {!loading && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {items.map((d) => (
              <Card key={d.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: 28 }}>{CATEGORIES[d.category]?.split(' ')[0] || '📎'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{Math.round(d.fileSize / 1024)} KB • {CATEGORIES[d.category]}</div>
                    {d.client && <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>👤 {d.client.fullName}</div>}
                    {d.booking && <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>✈ {d.booking.bookingRef}</div>}
                    <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 4 }}>{fmtDateTime(d.createdAt)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                    <Btn size="sm" variant="secondary" style={{ width: '100%' }}>📥 Yuklab olish</Btn>
                  </a>
                  <Btn size="sm" variant="ghost" onClick={() => del(d.id)}>🗑</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSaved={() => { setShowUpload(false); load(); }} />}
      </div>
    </CrmLayout>
  );
}

function UploadModal({ onClose, onSaved }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', category: 'OTHER', clientId: '', description: '' });
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientsApi.list({ limit: 200 }).then((r) => setClients(r.data?.data || []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error('Fayl tanlang');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', form.name || file.name);
      fd.append('category', form.category);
      if (form.clientId) fd.append('clientId', form.clientId);
      if (form.description) fd.append('description', form.description);
      await documentsApi.upload(fd);
      toast.success('Yuklandi');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="Hujjat yuklash" maxWidth={460}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label>Fayl *</Label>
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
                 style={{ width: '100%', padding: 10, background: 'var(--bg-3)', border: ' 1px solid var(--border)', borderRadius: 8, color: 'var(--fg)' }} />
          {file && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{file.name} • {Math.round(file.size / 1024)} KB</div>}
        </div>
        <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Avtomatik: fayl nomi" /></div>
        <div>
          <Label>Kategoriya</Label>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <Label>Klient (ixtiyoriy)</Label>
          <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">— Yo'q —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </Select>
        </div>
        <div><Label>Izoh</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
          <Btn type="submit" loading={loading} style={{ flex: 1 }}>Yuklash</Btn>
        </div>
      </form>
    </Modal>
  );
}