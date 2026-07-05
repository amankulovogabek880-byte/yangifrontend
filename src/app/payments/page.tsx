'use client';
import { useEffect, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { paymentsApi, invoicesApi } from '@/services/api';
import { Card, Empty, Skeleton, Badge, Btn } from '@/components/ui';
import { PAYMENT_METHOD_LABELS, fmt, fmtDateTime, errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

export default function PaymentsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'payments'|'invoices'>('payments');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([paymentsApi.list({ limit: 50 }), paymentsApi.stats(), invoicesApi.list({ limit: 50 }).catch(() => ({ data: [] }))])
      .then(([list, s, inv]) => { setData(list.data); setStats(s.data); const d = inv.data; setInvoices(Array.isArray(d) ? d : (d?.data || [])); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function refund(id: string) {
    if (!confirm("To'lov qaytarilsinmi?")) return;
    try {
      await paymentsApi.refund(id);
      toast.success(t('pay.refunded'));
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  return (
    <CrmLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{t('pay.title')}</h1>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[{id:"payments",l:"💳 To'lovlar"},{id:"invoices",l:"🧾 Invoicelar"}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === t.id ? '2px solid #3d7eff' : '2px solid transparent', color: activeTab === t.id ? '#3d7eff' : 'var(--fg-2)' }}>{t.l}</button>
          ))}
        </div>
        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {invoices.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{t('pay.noInvoice')}</div>}
            {invoices.map((inv: any) => (
              <div key={inv.id} style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>#{inv.invoiceNumber || inv.id?.slice(-6)}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{inv.client?.fullName}</div>
                </div>
                <div style={{ fontWeight: 700, color: inv.status === 'PAID' ? '#10b981' : 'var(--fg)' }}>
                  {(inv.totalAmount || inv.amount || 0).toLocaleString()} {inv.currency || 'USD'}
                </div>
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: inv.status === 'PAID' ? '#10b98120' : '#3b82f620', color: inv.status === 'PAID' ? '#10b981' : '#3b82f6', fontWeight: 700 }}>{inv.status}</span>
              </div>
            ))}
          </div>
        )}

        {loading && <Skeleton height={400} />}

        {!loading && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
            <Card>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase' }}>{t('common.thisMonth')}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{fmt(stats.total?._sum?.amount || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{stats.total?._count?.id || 0} to&apos;lov</div>
            </Card>
            {(stats.byMethod || []).map((m: any) => (
              <Card key={m.method}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{PAYMENT_METHOD_LABELS[m.method]}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmt(m._sum?.amount || 0)}</div>
              </Card>
            ))}
          </div>
        )}

        {!loading && activeTab === 'payments' && data && (
          <Card style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg)' }}>
                <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>{t('common.date')}</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>{t('pay.client')}</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Booking</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>{t('pay.amount')}</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>{t('pay.method')}</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>{t('common.status')}</th>
                  <th style={{ padding: 12 }}></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p: any) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                    <td style={{ padding: 12, fontSize: 12 }}>{fmtDateTime(p.paidAt)}</td>
                    <td style={{ padding: 12 }}>{p.client?.fullName}</td>
                    <td style={{ padding: 12, fontSize: 12, fontFamily: 'monospace' }}>{p.booking?.bookingRef}</td>
                    <td style={{ padding: 12, fontWeight: 600, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                    <td style={{ padding: 12, fontSize: 12 }}>{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td style={{ padding: 12 }}>
                      <Badge color={p.status === 'COMPLETED' ? 'var(--success)' : p.status === 'REFUNDED' ? 'var(--danger)' : 'var(--warning)'}>{p.status}</Badge>
                    </td>
                    <td style={{ padding: 12 }}>
                      {p.status === 'COMPLETED' && <Btn size="sm" variant="ghost" onClick={() => refund(p.id)}>{t('pay.refund')}</Btn>}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && <tr><td colSpan={7}><Empty title={t('pay.noPayment')} /></td></tr>}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </CrmLayout>
  );
}