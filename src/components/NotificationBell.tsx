'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/services/api';
import { timeAgo } from '@/lib/helpers';
import { useRealtimeNotifications } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const ICONS: Record<string, string> = {
  LEAD_ASSIGNED: '🔥',
  LEAD_NEW: '🔥',
  NEW_MESSAGE: '💬',
  TASK_DUE: '⏰',
  TASK_ASSIGNED: '📋',
  FOLLOWUP_DUE: '⏰',
  BOOKING_CREATED: '✈',
  BOOKING_UPDATED: '✈',
  PAYMENT_RECEIVED: '💰',
  CALL_MISSED: '📞',
  CALL_INCOMING: '📞',
  CALL_COMPLETED: '✅',
  STAGE_CHANGED: '📊',
  MENTION: '@',
  SYSTEM: 'ℹ',
  SECURITY_NEW_LOGIN: '🔔',
  SECURITY_FAILED_LOGIN: '⚠️',
  SECURITY_2FA_ENABLED: '🔐',
  SECURITY_PASSWORD_CHANGED: '🔐',
  SECURITY_SUSPICIOUS_ACTIVITY: '⚠️',
};

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Real-time notifications via WebSocket
  useRealtimeNotifications((n: any) => {
    setCount((c) => c + 1);
    setItems((prev) => [n, ...prev].slice(0, 50));
    // Toast bildirishnoma
    toast(
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{ICONS[n.type] || '🔔'} {n.title}</div>
        {n.body && <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{n.body}</div>}
      </div>,
      { duration: 5000, position: 'top-right' },
    );
  });

  // Initial count + fallback polling (har 60s)
  useEffect(() => {
    const fetchCount = () =>
      notificationsApi.count().then((r) => setCount(r.data?.count || 0)).catch(() => {});
    fetchCount();
    const t = setInterval(fetchCount, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle() {
    if (!open) {
      setLoading(true);
      notificationsApi.list().then((r) => setItems(r.data || [])).finally(() => setLoading(false));
    }
    setOpen(!open);
  }

  async function onItemClick(n: any) {
    try { await notificationsApi.markRead(n.id); } catch {}
    setCount((c) => Math.max(0, c - (n.isRead ? 0 : 1)));
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await notificationsApi.markAllRead().catch(() => {});
    setCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button onClick={toggle} title="Bildirishnomalar" style={{
        position: 'relative', background: 'none',
        border: ' 1px solid var(--border)', borderRadius: 8,
        width: 36, height: 36, cursor: 'pointer',
        color: 'var(--fg-2)', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--danger)', color: 'white',
            borderRadius: 10, minWidth: 16, height: 16, padding: '0 4px',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 44, right: 0,
          width: 360, maxHeight: 500,
          background: 'var(--bg-2)', border: ' 1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Bildirishnomalar</span>
            {items.some((n) => !n.isRead) && (
              <button onClick={readAll} style={{
                background: 'none', border: 'none', color: 'var(--primary)',
                fontSize: 12, cursor: 'pointer',
              }}>Hammasini o&apos;qildim</button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 440 }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>}
            {!loading && items.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>Bildirishnoma yo&apos;q</div>
            )}
            {!loading && items.map((n) => (
              <div key={n.id} onClick={() => onItemClick(n)} style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border-2)',
                cursor: 'pointer', display: 'flex', gap: 10,
                background: n.isRead ? 'transparent' : 'rgba(61,126,255,0.05)',
              }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{ICONS[n.type] || 'ℹ'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: n.isRead ? 500 : 700,
                    color: n.isRead ? 'var(--fg-2)' : 'var(--fg)',
                  }}>{n.title}</div>
                  {n.body && (
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
