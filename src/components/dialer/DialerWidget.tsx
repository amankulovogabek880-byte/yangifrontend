'use client';
import { useState, useEffect } from 'react';
import { useDialer } from '@/lib/dialer';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Qongiroq tayyorlanmoqda...',
  INITIATED: 'Sizning telefoningiz jiringlamoqda',
  RINGING: 'Klient telefoni jiringlamoqda...',
  IN_PROGRESS: 'Suhbat davom etmoqda',
  COMPLETED: 'Qongiroq tugadi',
  NO_ANSWER: 'Javob berilmadi',
  FAILED: 'Qongiroq amalga oshmadi',
};

const STATUS_COLOR: Record<string, string> = {
  QUEUED: 'var(--info)',
  INITIATED: 'var(--info)',
  RINGING: 'var(--warning)',
  IN_PROGRESS: 'var(--success)',
  COMPLETED: 'var(--fg-3)',
  NO_ANSWER: 'var(--danger)',
  FAILED: 'var(--danger)',
};

export default function DialerWidget() {
  const { state, hangup, close, addNote } = useDialer();
  const [note, setNote] = useState('');
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (state.status === 'COMPLETED' || state.status === 'NO_ANSWER' || state.status === 'FAILED') {
      // Auto-close after 6 seconds
      const t = setTimeout(() => {
        if (!note) close();
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [state.status, note, close]);

  if (!state.open) return null;

  const isActive = ['QUEUED', 'INITIATED', 'RINGING', 'IN_PROGRESS'].includes(state.status);
  const isWaitingAgent = state.status === 'QUEUED' || state.status === 'INITIATED';
  const isEnded = ['COMPLETED', 'NO_ANSWER', 'FAILED'].includes(state.status);

  async function saveNote() {
    if (!note.trim()) return;
    await addNote(note);
    setNote('');
    close();
  }

  // Minimized — small pill
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9000,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 50, padding: '8px 14px',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
        className="slide-in-right"
      >
        <div className={state.status === 'RINGING' ? 'ringing' : ''} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: STATUS_COLOR[state.status] || 'var(--primary)',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{state.clientName}</span>
        {state.status === 'IN_PROGRESS' && (
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'monospace' }}>
            {formatTime(state.duration)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9000,
        width: 340,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-lg), 0 0 0 1px var(--border)',
        overflow: 'hidden',
      }}
      className="slide-up"
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--gradient)',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📞</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {STATUS_LABEL[state.status] || state.status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setMinimized(true)} title="Yig'ish" style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6,
            color: 'white', cursor: 'pointer', padding: 4, width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>—</button>
          {isEnded && (
            <button onClick={close} title="Yopish" style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6,
              color: 'white', cursor: 'pointer', padding: 4, width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 20, textAlign: 'center' }}>
        {/* Avatar with ring animation */}
        <div
          className={state.status === 'RINGING' ? 'ringing' : ''}
          style={{
            width: 90, height: 90, margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'var(--gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 36, fontWeight: 800,
          }}
        >
          {state.clientName?.[0]?.toUpperCase() || '?'}
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
          {state.clientName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', fontFamily: 'monospace' }}>
          {state.phone}
        </div>

        {isWaitingAgent && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'var(--info-soft)',
            borderRadius: 8, fontSize: 11,
            color: 'var(--info)', lineHeight: 1.7,
          }}>
            <b>Qanday ishlaydi:</b><br/>
            1. Avval <b>sizning</b> telefoningiz jiringlaydi<br/>
            2. Ko'taring → klientga ulanasiz<br/>
            3. Klient telefoni jiringlaydi
          </div>
        )}

        {/* Timer */}
        {state.status === 'IN_PROGRESS' && (
          <div style={{
            marginTop: 14, padding: '8px 16px',
            background: 'var(--success-soft)',
            borderRadius: 50,
            display: 'inline-block',
            fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
            color: 'var(--success)',
          }}>
            {formatTime(state.duration)}
          </div>
        )}

        {/* Hangup button */}
        {isActive && (
          <button
            onClick={hangup}
            style={{
              marginTop: 18,
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--gradient-danger)',
              border: 'none', cursor: 'pointer',
              color: 'white', fontSize: 22,
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            📴
          </button>
        )}

        {/* End status message */}
        {isEnded && (
          <div style={{
            marginTop: 14, padding: 12,
            background: state.status === 'COMPLETED' ? 'var(--success-soft)' : 'var(--danger-soft)',
            borderRadius: 10,
            color: state.status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)',
            fontSize: 13, fontWeight: 600,
          }}>
            {state.status === 'COMPLETED' && state.duration > 0 && (
              <>✅ Suhbat tugadi: {formatTime(state.duration)}</>
            )}
            {state.status === 'NO_ANSWER' && '📞 Javob bermadi'}
            {state.status === 'FAILED' && '❌ Xato'}
          </div>
        )}
      </div>

      {/* Note input — after call ends */}
      {isEnded && (
        <div style={{ padding: '0 20px 16px' }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Suhbat haqida izoh..."
            style={{
              width: '100%', minHeight: 60,
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 10, fontSize: 13,
              color: 'var(--fg)', outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={close}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--fg-2)',
                borderRadius: 8, padding: '8px 12px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              O'tkazib
            </button>
            <button
              onClick={saveNote}
              disabled={!note.trim()}
              style={{
                flex: 1,
                background: 'var(--primary)',
                border: 'none',
                color: 'white',
                borderRadius: 8, padding: '8px 12px',
                cursor: note.trim() ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 600,
                opacity: note.trim() ? 1 : 0.5,
              }}
            >
              Saqlash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
