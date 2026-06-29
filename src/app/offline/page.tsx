'use client';
export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0c16',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center',
      fontFamily: '-apple-system, sans-serif', color: '#e2e8f0',
    }}>
      <div style={{ fontSize: 64 }}>📡</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Internet yo'q</h1>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, maxWidth: 280 }}>
        Tarmoqqa ulanishni tekshiring va qayta urinib ko'ring.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 10,
          background: 'linear-gradient(135deg, #3d7eff, #a855f7)',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
        }}
      >
        🔄 Qayta urinish
      </button>
    </div>
  );
}
