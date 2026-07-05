'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import CrmLayout from '@/components/layout/CrmLayout';
import { approvalsApi } from '@/services/api';
import { Card, Btn, Badge, Skeleton, Avatar, Modal, Textarea, Label, Empty } from '@/components/ui';
import { useAuth } from '@/lib/store';
import { fmtDateTime, timeAgo, errMsg, fmtMoney } from '@/lib/helpers';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<string, string> = {
  DISCOUNT: '💰 Chegirma',
  REFUND: '↩️ Pul qaytarish',
  PRICE_CHANGE: '💵 Narx o\'zgarishi',
  BOOKING_CANCEL: '❌ Booking bekor',
  PAYMENT_DELETE: '🗑 To\'lov o\'chirish',
  COMMISSION_OVERRIDE: '📊 Komissiya o\'zgarishi',
  OTHER: '📋 Boshqa',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--warning)',
  APPROVED: 'var(--success)',
  REJECTED: 'var(--danger)',
  CANCELLED: 'var(--fg-3)',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '⏳ Kutilmoqda',
  APPROVED: '✅ Tasdiqlandi',
  REJECTED: '❌ Rad etildi',
  CANCELLED: '⚪ Bekor',
};

function ApprovalsPageInner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'mine'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get('highlight');
  const [actionModal, setActionModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  // Notification dan kelganda - o'sha approval ni modal bilan ochish
  useEffect(() => {
    if (highlightId && data.length > 0) {
      const found = data.find((r: any) => r.id === highlightId);
      if (found && found.status === 'PENDING') {
        setActionModal({ id: highlightId, action: 'approve' });
      }
    }
  }, [highlightId, data]);

  const canApprove = ['TENANT_ADMIN', 'MANAGER'].includes(user?.role || '');

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filter === 'pending') params.status = 'PENDING';
    if (filter === 'mine') params.mine = 'true';
    approvalsApi.list(params)
      .then((r) => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('apr.title')}</h1>
            <p style={{ color: 'var(--fg-3)', fontSize: 13, margin: '4px 0 0' }}>
              Chegirma, refund va muhim o'zgarishlar uchun tasdiq jarayoni
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-3)', padding: 3, borderRadius: 8 }}>
            {['all', 'pending', 'mine'].map((f) => (
              <button key={f} onClick={() => setFilter(f as any)} style={{
                background: filter === f ? 'var(--bg-2)' : 'transparent',
                border: 'none', borderRadius: 6,
                padding: '6px 14px',
                color: filter === f ? 'var(--primary)' : 'var(--fg-3)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
                {f === 'all' ? 'Hammasi' : f === 'pending' ? 'Kutilayotgan' : 'Meniki'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Skeleton height={300} /> : data.length === 0 ? (
          <Empty title={t('apr.empty')} icon="✅" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((r) => (
              <Card key={r.id} style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 6, alignSelf: 'stretch', borderRadius: 3,
                    background: STATUS_COLORS[r.status],
                  }} />
                  <Avatar name={r.requester?.name || '?'} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Badge color="var(--primary)">{TYPE_LABELS[r.type]}</Badge>
                      <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      {r.amount > 0 && (
                        <Badge color="var(--warning)">{fmtMoney(r.amount)}</Badge>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                      {r.requester?.name} • {timeAgo(r.createdAt)}
                    </div>
                    {r.reason && (
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 8, padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
                        💬 {r.reason}
                      </div>
                    )}
                    {r.reviewNote && (
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6, padding: 8, background: 'var(--bg-3)', borderRadius: 6, borderLeft: `3px solid ${STATUS_COLORS[r.status]}` }}>
                        <b>{r.reviewer?.name}:</b> {r.reviewNote}
                      </div>
                    )}
                  </div>

                  {r.status === 'PENDING' && canApprove && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Btn size="sm" variant="gradient" onClick={() => setActionModal({ id: r.id, action: 'approve' })}>✓ Tasdiqlash</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setActionModal({ id: r.id, action: 'reject' })}>✗ Rad etish</Btn>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {actionModal && (
        <ActionModal
          id={actionModal.id}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); load(); }}
        />
      )}
    </CrmLayout>
  );
}

function ActionModal({ id, action, onClose, onDone }: any) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      if (action === 'approve') {
        await approvalsApi.approve(id, note);
        toast.success(t('apr.approved'));
      } else {
        await approvalsApi.reject(id, note);
        toast.success(t('apr.rejected'));
      }
      onDone();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title={action === 'approve' ? '✅ Tasdiqlash' : '❌ Rad etish'} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn variant={action === 'approve' ? 'gradient' : 'primary'} onClick={submit} loading={loading}>
          {action === 'approve' ? 'Tasdiqlash' : 'Rad etish'}
        </Btn>
      </>
    }>
      <Label>{t('apr.noteOpt')}</Label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('apr.notePh')} />
    </Modal>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><span className="spinner spinner-lg" /></div>}>
      <ApprovalsPageInner />
    </Suspense>
  );
}