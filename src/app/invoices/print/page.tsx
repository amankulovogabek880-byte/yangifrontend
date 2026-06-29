'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoicesApi } from '@/services/api';

function PrintContent() {
  const params = useSearchParams();
  const id = params.get('id');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    invoicesApi.one(id).then(r => {
      setInvoice(r.data);
      setLoading(false);
      setTimeout(() => window.print(), 500);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, fontFamily: 'sans-serif' }}>Yuklanmoqda...</div>;
  if (!invoice) return <div style={{ textAlign: 'center', padding: 40, fontFamily: 'sans-serif' }}>Invoice topilmadi</div>;

  const subtotal = invoice.amount || 0;
  const tax = invoice.taxAmount || 0;
  const total = invoice.totalAmount || subtotal + tax;

  return (
    <div style={{ fontFamily: '-apple-system, Arial, sans-serif', maxWidth: 680, margin: '0 auto', padding: '24px 32px', color: '#1a1f2e' }}>
      {/* Print button - ekranda ko'rinadi, print da yo'qoladi */}
      <div style={{ textAlign: 'right', marginBottom: 20 }} className="no-print">
        <button onClick={() => window.print()} style={{
          background: 'linear-gradient(135deg,#3d7eff,#a855f7)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '10px 20px',
          cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>🖨 Chop etish / PDF</button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid #3d7eff' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg,#3d7eff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Omon CRM
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Sayohat agentligi boshqaruv tizimi</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1f2e' }}>HISOB-FAKTURA</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>#{invoice.invoiceNo || invoice.id?.slice(-8).toUpperCase()}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('uz-UZ') : new Date().toLocaleDateString('uz-UZ')}
          </div>
        </div>
      </div>

      {/* Client & Company info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Kimga</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1f2e' }}>{invoice.client?.fullName || '—'}</div>
          {invoice.client?.phone && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{invoice.client.phone}</div>}
          {invoice.client?.email && <div style={{ fontSize: 13, color: '#64748b' }}>{invoice.client.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>To'lov ma'lumotlari</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            <div>Holat: <b style={{ color: invoice.status === 'PAID' ? '#10b981' : '#f59e0b' }}>{invoice.status}</b></div>
            {invoice.dueDate && <div>Muddati: {new Date(invoice.dueDate).toLocaleDateString('uz-UZ')}</div>}
            {invoice.booking?.bookingRef && <div>Booking: {invoice.booking.bookingRef}</div>}
          </div>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Xizmat', 'Miqdor', 'Narx', 'Jami'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Xizmat' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, border: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(invoice.items || [{ description: invoice.booking?.tourName || 'Tur xizmati', qty: 1, price: subtotal }]).map((item: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '10px 12px', fontSize: 13, border: '1px solid #e2e8f0', color: '#1a1f2e' }}>{item.description || item.name}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.qty || 1}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, border: '1px solid #e2e8f0', textAlign: 'right' }}>${(item.price || item.unitPrice || 0).toFixed(2)}</td>
              <td style={{ padding: '10px 12px', fontSize: 13, border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>${((item.qty || 1) * (item.price || item.unitPrice || 0)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <div style={{ width: 240 }}>
          {[
            { label: 'Jami:', value: subtotal },
            ...(tax > 0 ? [{ label: `Soliq (${invoice.taxPercent || 0}%):`, value: tax }] : []),
            ...(invoice.discount > 0 ? [{ label: 'Chegirma:', value: -invoice.discount }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#64748b' }}>
              <span>{row.label}</span>
              <span>${row.value.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', borderTop: '2px solid #1a1f2e', marginTop: 6, fontSize: 16, fontWeight: 800, color: '#1a1f2e' }}>
            <span>To'lash kerak:</span>
            <span style={{ color: '#3d7eff' }}>${total.toFixed(2)} {invoice.currency || 'USD'}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Izoh</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{invoice.notes}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: 20, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
        Omon CRM tomonidan yaratildi · {new Date().getFullYear()}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}

export default function PrintInvoicePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>}>
      <PrintContent />
    </Suspense>
  );
}
