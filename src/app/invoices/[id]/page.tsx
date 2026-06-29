'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { invoicesApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { Card, Btn, Skeleton, Badge, Modal, Input, Label } from '@/components/ui';
import { fmtDate, errMsg } from '@/lib/helpers';
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

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const load = () => {
    setLoading(true);
    invoicesApi.one(id)
      .then((r) => setInv(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  async function downloadPdf() {
    try {
      const res = await invoicesApi.pdf(id);
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(res.data);
        w.document.close();
        setTimeout(() => w.print(), 300);
      }
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function sendTelegram() {
    if (!confirm('Invoiceni Telegram orqali yuborishni xohlaysizmi?')) return;
    try {
      await invoicesApi.sendTelegram(id);
      toast.success('Yuborildi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function deleteInv() {
    if (!confirm("Invoiceni o'chirishni xohlaysizmi?")) return;
    try {
      await invoicesApi.delete(id);
      toast.success("O'chirildi");
      router.push('/invoices');
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function updateStatus(status: string) {
    try {
      await invoicesApi.update(id, { status });
      toast.success('Holat yangilandi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) {
    return <CrmLayout><div style={{ padding: 24 }}><Skeleton height={400} /></div></CrmLayout>;
  }
  if (!inv) return <CrmLayout><div style={{ padding: 24 }}>Invoice topilmadi</div></CrmLayout>;

  const isAdmin = user?.role !== 'AGENT';
  const balance = (inv.totalAmount || 0) - (inv.paidAmount || 0);

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>
              <a onClick={() => router.push('/invoices')} style={{ cursor: 'pointer' }}>← Invoicelar</a>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, fontFamily: 'monospace' }}>{inv.invoiceNumber}</h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge color={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{fmtDate(inv.issuedAt)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="secondary" size="sm" onClick={downloadPdf}>📥 PDF</Btn>
            <Btn variant="secondary" size="sm" onClick={sendTelegram}>📨 Telegram</Btn>
            {isAdmin && (
              <Btn variant="ghost" size="sm" onClick={deleteInv}>🗑 O'chirish</Btn>
            )}
          </div>
        </div>

        {/* Status update */}
        {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
          <Card style={{ marginBottom: 16, padding: 14 }}>
            <Label>Holat o'zgartirish</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {['DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
                <Btn key={s} size="sm" variant={inv.status === s ? 'primary' : 'secondary'} onClick={() => updateStatus(s)}>
                  {s}
                </Btn>
              ))}
            </div>
          </Card>
        )}

        {/* Klient + Booking */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Card>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 6 }}>Mijoz</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{inv.client?.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{inv.client?.phone}</div>
            {inv.client?.email && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{inv.client.email}</div>}
            <Btn size="sm" variant="ghost" onClick={() => router.push(`/clients/${inv.clientId}`)} style={{ marginTop: 8 }}>
              Klient profili →
            </Btn>
          </Card>
          <Card>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 6 }}>Booking</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{inv.booking?.bookingRef}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{inv.booking?.tourName}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{inv.booking?.destination}</div>
            <Btn size="sm" variant="ghost" onClick={() => router.push(`/bookings/${inv.bookingId}`)} style={{ marginTop: 8 }}>
              Booking →
            </Btn>
          </Card>
        </div>

        {/* Moliya */}
        <Card style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>💰 Moliyaviy ma'lumotlar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Sale Price</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {inv.currency} {inv.salePrice?.toFixed(2)}
              </div>
            </div>
            {isAdmin && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Provider Cost</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-2)' }}>
                  {inv.currency} {inv.providerCost?.toFixed(2) || '0.00'}
                </div>
              </div>
            )}
            {isAdmin && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Profit</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
                  {inv.currency} {inv.profit?.toFixed(2)}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Jami</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                {inv.currency} {inv.totalAmount?.toFixed(2)}
              </div>
            </div>
          </div>

          {inv.discount > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-3)' }}>
              Chegirma: <b style={{ color: 'var(--success)' }}>-{inv.currency} {inv.discount?.toFixed(2)}</b>
            </div>
          )}

          {/* To'lov */}
          <div style={{
            marginTop: 14, padding: 12,
            background: 'var(--bg-3)', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>To'langan</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--info)' }}>
                {inv.currency} {inv.paidAmount?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Qoldi</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {inv.currency} {balance.toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        {/* Izohlar */}
        {inv.notes && (
          <Card style={{ marginBottom: 14 }}>
            <Label>📝 Izoh (mijozga ko'rinadi)</Label>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{inv.notes}</p>
          </Card>
        )}

        {inv.internalNotes && (
          <Card style={{ marginBottom: 14, borderLeft: '3px solid var(--warning)' }}>
            <Label>🔒 Ichki izoh (admin/agent ko'radi)</Label>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--fg-2)' }}>{inv.internalNotes}</p>
          </Card>
        )}

        {/* Yuborish holati */}
        {inv.sentViaTelegram && (
          <Card style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary)' }}>
            <div style={{ fontSize: 13 }}>
              ✅ Telegram orqali yuborildi: <b>{fmtDate(inv.sentAt)}</b>
            </div>
          </Card>
        )}
      </div>
    </CrmLayout>
  );
}
