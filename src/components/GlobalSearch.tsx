'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchApi } from '@/services/api';
import { useI18n } from '@/lib/i18n';

export default function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(''); setResults(null); }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!q || q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.global(q);
        setResults(res.data);
      } catch { setResults(null); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t('search.title')}
        style={{
          background: 'var(--bg-3)', border: ' 1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px',
          color: 'var(--fg-3)', fontSize: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          minWidth: 220,
        }}
      >
        <Search size={15} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{t('search.btn')}</span>
        <span style={{
          background: 'var(--border)', padding: '1px 6px', borderRadius: 4,
          fontSize: 10, fontFamily: 'monospace',
        }}>Ctrl K</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 1000, padding: '80px 20px 20px',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="fade-in" style={{
            width: '100%', maxWidth: 600,
            background: 'var(--bg-2)', border: ' 1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}>
            <div style={{ borderBottom: '1px solid var(--border)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={18} style={{ color: 'var(--fg-3)', flexShrink: 0, marginLeft: 6 }} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('search.placeholder')}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  padding: '14px 12px', color: 'var(--fg)', fontSize: 15,
                  outline: 'none',
                }}
              />
              {/* v36: tashqarisiga bosish/Escape allaqachon yopadi, lekin
                  ko'rinadigan ✕ tugma qo'shildi — ayniqsa mobil/sensorli
                  ekranlarda buni topish osonroq bo'lsin uchun. */}
              <button
                onClick={() => setOpen(false)}
                title="Yopish (Esc)"
                style={{
                  flexShrink: 0, width: 28, height: 28, marginRight: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 7, color: 'var(--fg-3)', cursor: 'pointer',
                  fontSize: 14, lineHeight: 1,
                }}
              >✕</button>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>Qidirilmoqda...</div>}
              {!loading && q.length < 2 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-4)', fontSize: 12 }}>
                  Kamida 2 ta belgi kiriting
                </div>
              )}
              {!loading && results && (
                <>
                  {results.clients?.length > 0 && (
                    <Section title="👥 Klientlar">
                      {results.clients.map((c: any) => (
                        <Row key={c.id} onClick={() => go(`/clients/${c.id}`)}
                          title={c.fullName} subtitle={`${c.phone}${c.email ? ' • ' + c.email : ''}`}
                          badge={c.tier} />
                      ))}
                    </Section>
                  )}
                  {results.bookings?.length > 0 && (
                    <Section title="✈ Bookinglar">
                      {results.bookings.map((b: any) => (
                        <Row key={b.id} onClick={() => go(`/bookings/${b.id}`)}
                          title={b.bookingRef + ' — ' + b.tourName}
                          subtitle={`${b.destination} • ${b.client?.fullName || ''} • $${b.totalPrice}`}
                          badge={b.status} />
                      ))}
                    </Section>
                  )}
                  {results.conversations?.length > 0 && (
                    <Section title="💬 Suhbatlar">
                      {results.conversations.map((c: any) => (
                        <Row key={c.id} onClick={() => go(`/inbox?conv=${c.id}`)}
                          title={`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.username || 'Anonim'}
                          subtitle={c.lastMessageText} badge={c.channel} />
                      ))}
                    </Section>
                  )}
                  {results.tasks?.length > 0 && (
                    <Section title="📋 Vazifalar">
                      {results.tasks.map((t: any) => (
                        <Row key={t.id} onClick={() => go(`/tasks?id=${t.id}`)}
                          title={t.title} subtitle={t.priority + ' • ' + t.status} />
                      ))}
                    </Section>
                  )}
                  {results.packages?.length > 0 && (
                    <Section title="🌍 Tur paketlari">
                      {results.packages.map((p: any) => (
                        <Row key={p.id} onClick={() => go(`/marketplace`)}
                          title={p.title} subtitle={`${p.destination} • $${p.pricePerAdult}`} />
                      ))}
                    </Section>
                  )}
                  {!results.clients?.length && !results.bookings?.length &&
                   !results.conversations?.length && !results.tasks?.length && !results.packages?.length && (
                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-4)', fontSize: 12 }}>
                      Hech narsa topilmadi
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-2)' }}>
      <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ title, subtitle, badge, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
      transition: 'background 0.1s',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge && (
        <span style={{ fontSize: 10, background: 'var(--border)', padding: '2px 6px', borderRadius: 10, color: 'var(--fg-2)' }}>
          {badge}
        </span>
      )}
    </div>
  );
}