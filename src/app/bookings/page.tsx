'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { bookingsApi, clientsApi } from '@/services/api';
import { Btn, Card, Input, Select, Empty, Skeleton, Badge, Modal, Label, Textarea } from '@/components/ui';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, fmt, fmtDate, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/store';

export default function BookingsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    const params: any = { page, limit: 25 };
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    bookingsApi.list(params).then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filters, page]);

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>✈ Bookinglar</h1>
          <Btn onClick={() => setShowAdd(true)}>+ Yangi Booking</Btn>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10 }}>
            <Input placeholder="Qidirish (ref, tur, destinatsiya...)" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Barcha status</option>
              {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        </Card>

        {loading && <Skeleton height={400} />}

        {!loading && data && (
          <>
            {data.data.length === 0 ? (
              <Empty icon="✈" title="Booking yo'q" />
            ) : (
              <Card style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg)' }}>
                    <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: 12, textAlign: 'left' }}>Ref</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Klient</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Tur</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Sana</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Narx</th>
                      <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((b: any) => (
                      <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)} style={{ borderTop: '1px solid var(--border-2)', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: 12, fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{b.bookingRef}</td>
                        <td style={{ padding: 12 }}>{b.client?.fullName}</td>
                        <td style={{ padding: 12 }}>
                          <div>{b.tourName}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>📍 {b.destination}</div>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>{fmtDate(b.departureDate)}</td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(b.totalPrice)}</div>
                          {b.paidAmount > 0 && <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{fmt(b.paidAmount)} to&apos;langan</div>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <Badge color={BOOKING_STATUS_COLORS[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            {data.meta.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                <Btn variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Btn>
                <span style={{ padding: '6px 14px', color: 'var(--fg-2)' }}>{page} / {data.meta.totalPages}</span>
                <Btn variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>→</Btn>
              </div>
            )}
          </>
        )}

        {showAdd && <AddBookingModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      </div>
    </CrmLayout>
  );
}

function AddBookingModal({ onClose, onSaved }: any) {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'AGENT';
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    clientId: '', tourName: '', destination: '', tourType: 'PACKAGE',
    adults: 1, children: 0,
    totalPrice: '',         // Client Price — klient ko'rsatadi
    supplierCost: '',       // Supplier Cost — faqat admin/agent ko'radi
    discount: 0,            // Chegirma (admin/agent)
    currency: 'USD',
    departureDate: '', returnDate: '',
  });
  const [loading, setLoading] = useState(false);

  // v9: PROFIT avtomatik hisoblanadi (formula backend bilan bir xil)
  // profit = totalPrice - supplierCost - discount
  const totalPrice = Number(form.totalPrice) || 0;
  const supplierCost = Number(form.supplierCost) || 0;
  const discount = Number(form.discount) || 0;
  const profit = Math.max(0, totalPrice - supplierCost - discount);

  useEffect(() => {
    clientsApi.list({ limit: 200 }).then((r) => setClients(r.data?.data || []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bookingsApi.create({
        ...form,
        totalPrice: Number(form.totalPrice),
        supplierCost: Number(form.supplierCost) || 0,    // v9
        discount: Number(form.discount) || 0,             // v9
        adults: Number(form.adults),
        children: Number(form.children),
      });
      toast.success('Booking yaratildi');
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="Yangi booking" maxWidth={520}>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>Klient *</Label>
          <Select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">— Tanlang —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName} • {c.phone}</option>)}
          </Select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>Tur nomi *</Label>
          <Input required value={form.tourName} onChange={(e) => setForm({ ...form, tourName: e.target.value })} placeholder="Dubay 7 kunlik" />
        </div>
        <div>
          <Label>Yo&apos;nalish *</Label>
          <Input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Dubay" />
        </div>
        <div>
          <Label>Turi</Label>
          <Select value={form.tourType} onChange={(e) => setForm({ ...form, tourType: e.target.value })}>
            <option value="PACKAGE">Paket</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="GROUP">Guruh</option>
            <option value="VISA_SUPPORT">Viza</option>
            <option value="HOTEL_ONLY">Faqat mehmonxona</option>
            <option value="FLIGHT_ONLY">Faqat aviabilet</option>
          </Select>
        </div>
        <div><Label>Kattalar</Label><Input type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} /></div>
        <div><Label>Bolalar</Label><Input type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} /></div>

        {/* ═══ v9: NARX BLOKI — Profit avtomatik hisoblanadi ═══ */}
        <div style={{
          gridColumn: '1/-1',
          padding: 14,
          background: 'var(--bg-3)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10, letterSpacing: 0.3 }}>
            💰 Narx va Foyda
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>Klient narxi * <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 10 }}>(klient to'laydi)</span></Label>
              <Input
                required
                type="number"
                value={form.totalPrice}
                onChange={(e) => setForm({ ...form, totalPrice: e.target.value })}
                placeholder="3000"
                style={{ fontWeight: 700 }}
              />
            </div>
            <div>
              <Label>Valyuta</Label>
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="UZS">UZS</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
            {isAdmin && (
              <div>
                <Label>
                  Provayder tannarxi 🔒
                  <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 10 }}> (klientga ko'rinmaydi)</span>
                </Label>
                <Input
                  type="number"
                  value={form.supplierCost}
                  onChange={(e) => setForm({ ...form, supplierCost: e.target.value })}
                  placeholder="1000"
                />
              </div>
            )}
            {isAdmin && (
              <div>
                <Label>Chegirma <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 10 }}>(ixtiyoriy)</span></Label>
                <Input
                  type="number"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          {/* PROFIT — admin only */}
          {isAdmin && <div style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-2)',
            borderRadius: 8,
            border: '2px solid ' + (profit > 0 ? 'var(--success)' : 'var(--border)'),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>
                FOYDA (avtomatik)
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                {totalPrice} − {supplierCost}{discount > 0 ? ` − ${discount}` : ''}
              </div>
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 800,
              color: profit > 0 ? 'var(--success)' : 'var(--fg-3)',
            }}>
              {form.currency} {profit.toFixed(2)}
            </div>
          </div>}

          {isAdmin && totalPrice > 0 && supplierCost > totalPrice && (
            <div style={{
              marginTop: 8, padding: 8,
              background: 'var(--danger-soft, rgba(239,68,68,0.1))',
              borderRadius: 6, fontSize: 11, color: 'var(--danger)',
            }}>
              ⚠️ Diqqat: Tannarx klient narxidan yuqori!
            </div>
          )}
        </div>

        <div><Label>Ketish</Label><Input type="date" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
        <div><Label>Qaytish</Label><Input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></div>
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
          <Btn type="submit" loading={loading} style={{ flex: 1 }}>Yaratish</Btn>
        </div>
      </form>
    </Modal>
  );
}
