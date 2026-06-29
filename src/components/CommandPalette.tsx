'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { commandPaletteApi } from '@/services/api';

/**
 * v9: ⌘K COMMAND PALETTE
 * Ctrl+K (yoki Cmd+K) bossa universal qidiruv ochiladi
 *
 * Foydalanish:
 *   - Aziz → klient topadi
 *   - INV-2024 → invoice topadi
 *   - "yangi" → tezkor amallar ko'rsatadi
 *   - Arrow keys → harakatlanish, Enter → tanlash
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Open bo'lganda fokus
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIdx(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      commandPaletteApi.search(query)
        .then((r: any) => {
          setResults(r.data.results || []);
          setActions(r.data.actions || []);
          setSelectedIdx(0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const allItems = [...results, ...actions];

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = allItems[selectedIdx];
      if (item) {
        router.push(item.url);
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center',
      paddingTop: '10vh',
      zIndex: 9999,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(640px, 92vw)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Klient, booking, invoice, harakat qidiring..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--fg)',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <kbd style={{
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 10,
            color: 'var(--fg-3)',
            fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              Qidirilmoqda...
            </div>
          )}

          {!loading && allItems.length === 0 && query && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
              <div style={{ fontSize: 36, opacity: 0.4 }}>🔎</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>"{query}" bo'yicha hech narsa topilmadi</div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', padding: '8px 12px', fontWeight: 700 }}>
                Natijalar
              </div>
              {results.map((item, idx) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  selected={selectedIdx === idx}
                  onClick={() => { router.push(item.url); setOpen(false); }}
                />
              ))}
            </>
          )}

          {actions.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', padding: '8px 12px', fontWeight: 700 }}>
                Tezkor amallar
              </div>
              {actions.map((item, idx) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  selected={selectedIdx === results.length + idx}
                  onClick={() => { router.push(item.url); setOpen(false); }}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 14, padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--fg-3)',
        }}>
          <span>↑↓ Tanlash</span>
          <span>↵ Ochish</span>
          <span>ESC Yopish</span>
        </div>
      </div>
    </div>
  );
}

function PaletteItem({ item, selected, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: selected ? 'var(--primary-soft)' : 'transparent',
      cursor: 'pointer',
      transition: 'background 0.1s',
    }}>
      <div style={{ fontSize: 18 }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--primary)' : 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.subtitle}
          </div>
        )}
      </div>
      {item.shortcut && (
        <kbd style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderRadius: 5, padding: '2px 6px',
          fontSize: 10, color: 'var(--fg-3)',
          fontFamily: 'monospace',
        }}>{item.shortcut}</kbd>
      )}
    </div>
  );
}
