'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import CrmLayout from '@/components/layout/CrmLayout';
import { invoicesApi, bookingsApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { Card, Btn, Input, Label, Select, Modal, Empty, Skeleton, Badge, Textarea } from '@/components/ui';
import { fmtDate, errMsg, fmtMoney } from '@/lib/helpers';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--fg-3)',
  ISSUED: 'var(--info)',
  SENT: 'var(--primary)',
  PARTIALLY_PAID: 'var(--warning)',
  PAID: 'var(--success)',
  OVERDUE: 'var(--danger)',
  CANCELLED: 'var(--fg-3)',
  REFUNDED: 'var(--fg-3)',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Qoralama', ISSUED: 'Berildi', SENT: 'Yuborildi',
  PARTIALLY_PAID: 'Qisman to\'langan', PAID: "To'langan",
  OVERDUE: 'Muddati o\'tgan', CANCELLED: 'Bekor qilingan', REFUNDED: 'Qaytarildi',
};

export default function InvoicesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filter) params.status = filter;
    if (search) params.search = search;
    invoicesApi.list(params)
      .then((r) => setInvoices(r.data?.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const showAdmin = user?.role !== 'AGENT';

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('inv.title')}</h1>
            <p style={{ color: 'var(--fg-3)', fontSize: 13, margin: 0 }}>
              Mijozlarga yuborilgan hisob-fakturalar
            </p>
          </div>
          <Btn onClick={() => setShowCreate(true)}>+ Yangi invoice</Btn>
        </div>

        <Card style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Input
              placeholder={t('inv.searchPh')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">{t('common.all')}</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Btn variant="secondary" onClick={load}>{t('common.search')}</Btn>
          </div>
        </Card>

        {loading && <Skeleton height={60} count={4} />}
        {!loading && invoices.length === 0 && (
          <Empty title={t('pay.noInvoice')} description={t('inv.emptyDesc')} />
        )}

        {!loading && invoices.length > 0 && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-3)', textTransform: 'uppercase', fontSize: 10, color: 'var(--fg-3)' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>№</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>{t('pay.client')}</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Booking</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>{t('inv.salePrice')}</th>
                    {showAdmin && <th style={{ padding: 12, textAlign: 'right' }}>{t('inv.provider')}</th>}
                    {showAdmin && <th style={{ padding: 12, textAlign: 'right' }}>{t('inv.profit')}</th>}
                    <th style={{ padding: 12, textAlign: 'right' }}>{t('inbox.paid')}</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>{t('inv.statusCol')}</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>{t('common.date')}</th>
                    <th style={{ padding: 12 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                      style={{
                        borderTop: '1px solid var(--border-2)',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: 12, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ padding: 12 }}>{inv.client?.fullName || '—'}</td>
                      <td style={{ padding: 12, fontSize: 11, color: 'var(--fg-3)' }}>
                        {inv.booking?.bookingRef}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>
                        {inv.currency} {inv.salePrice?.toFixed(0)}
                      </td>
                      {showAdmin && (
                        <td style={{ padding: 12, textAlign: 'right', color: 'var(--fg-3)' }}>
                          {inv.currency} {inv.providerCost?.toFixed(0) || '0'}
                        </td>
                      )}
                      {showAdmin && (
                        <td style={{ padding: 12, textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>
                          {inv.currency} {inv.profit?.toFixed(0)}
                        </td>
                      )}
                      <td style={{ padding: 12, textAlign: 'right', color: 'var(--info)' }}>
                        {inv.currency} {inv.paidAmount?.toFixed(0) || '0'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <Badge color={STATUS_COLORS[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', fontSize: 11, color: 'var(--fg-3)' }}>
                        {fmtDate(inv.issuedAt)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <Btn size="sm" variant="ghost" onClick={() => router.push(`/invoices/${inv.id}`)}>→</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {showCreate && (
          <CreateInvoiceModal
            onClose={() => setShowCreate(false)}
            onDone={(id) => {
              setShowCreate(false);
              load();
              if (id) router.push(`/invoices/${id}`);
            }}
          />
        )}
      </div>
    </CrmLayout>
  );
}

function CreateInvoiceModal({ onClose, onDone }: any) {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [form, setForm] = useState({
    bookingId: '',
    salePrice: '',
    providerCost: '',
    discount: '',
    taxAmount: '',
    dueDate: '',
    notes: '',
    internalNotes: '',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    bookingsApi.list({ limit: 100 })
      .then((r) => setBookings(r.data?.data || []))
      .finally(() => setLoadingBookings(false));
  }, []);

  // Booking tanlanganda narxlarni avtomatik to'ldirish
  useEffect(() => {
    if (!form.bookingId) return;
    const b = bookings.find((b) => b.id === form.bookingId);
    if (b) {
      setForm((f) => ({
        ...f,
        salePrice: String(b.totalPrice || ''),
        providerCost: String(b.supplierCost || ''),
        discount: String(b.discount || 0),
        currency: b.currency || 'USD',
      }));
    }
  }, [form.bookingId, bookings]);

  const sale = Number(form.salePrice) || 0;
  const cost = Number(form.providerCost) || 0;
  const discount = Number(form.discount) || 0;
  const profit = Math.max(0, sale - cost - discount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bookingId) return toast.error(t('inbox.selectBooking'));
    setLoading(true);
    try {
      const res = await invoicesApi.create({
        ...form,
        salePrice: Number(form.salePrice),
        providerCost: Number(form.providerCost) || 0,
        discount: Number(form.discount) || 0,
        taxAmount: Number(form.taxAmount) || 0,
        dueDate: form.dueDate || undefined,
      });
      toast.success(`Invoice yaratildi: ${res.data.invoiceNumber}`);
      onDone(res.data.id);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('inv.newTitle')} maxWidth={560}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <Label>{t('inv.bookingReq')}</Label>
          {loadingBookings ? <Skeleton height={40} /> : (
            <Select required value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })}>
              <option value="">{t('inbox.selectDash')}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingRef} • {b.client?.fullName} • {b.tourName}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>{t('inv.salePriceReq')}</Label>
            <Input type="number" required value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
          </div>
          <div>
            <Label>{t('inv.providerCost')}</Label>
            <Input type="number" value={form.providerCost} onChange={(e) => setForm({ ...form, providerCost: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>{t('inbox.discount')}</Label>
            <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </div>
          <div>
            <Label>{t('inv.tax')}</Label>
            <Input type="number" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>{t('common.currency')}</Label>
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
            </Select>
          </div>
          <div>
            <Label>{t('inv.dueDate')}</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>

        {/* Profit ko'rsatkichi */}
        <div style={{
          padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 12,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Sale Price</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{form.currency} {sale.toFixed(0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Provider Cost</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-2)' }}>{form.currency} {cost.toFixed(0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Profit</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{form.currency} {profit.toFixed(0)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Label>{t('inbox.noteVisible')}</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Label>{t('inv.internalNote')}</Label>
          <Textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} rows={2} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel')}</Btn>
          <Btn type="submit" loading={loading} style={{ flex: 1 }}>{t('common.create')}</Btn>
        </div>
      </form>
    </Modal>
  );
}