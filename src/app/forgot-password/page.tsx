'use client';
import { OmonLogoSvg } from '@/components/OmonLogo';
import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { authApi } from '@/services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      // Xavfsizlik uchun har doim muvaffaqiyat ko'rsatamiz
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', position: 'relative',
    }}>
      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
        color: 'var(--fg-2)', fontSize: 14, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>{theme === 'dark' ? '☀' : '☾'}</button>

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 20, padding: '36px 28px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: 'var(--gradient)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 900,
            boxShadow: 'var(--shadow-glow)', marginBottom: 14,
          }}>O</div>
          <div className="gradient-text" style={{ fontSize: 22, fontWeight: 900 }}><OmonLogoSvg size={36}/> Omon CRM</div>
        </div>

        {!sent ? (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>
              Parolni tiklash
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
              Email manzilingizni kiriting. Parolni tiklash havolasi yuboramiz.
            </p>

            <form onSubmit={submit}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Email
              </label>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@kompaniya.uz"
                className="form-input"
                style={{ marginBottom: 18 }}
              />
              <button
                type="submit" disabled={loading}
                className="btn btn-gradient btn-lg"
                style={{ width: '100%' }}
              >
                {loading
                  ? <><span className="spinner spinner-sm" style={{ borderTopColor: '#fff' }} /> Yuborilmoqda...</>
                  : '📧 Havola yuborish'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>
              Email yuborildi!
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.6 }}>
              Agar bu email tizimda mavjud bo'lsa, parolni tiklash havolasi yuborildi.
              Spam papkasini ham tekshiring.
            </p>
            <p style={{ fontSize: 12, color: 'var(--fg-4)', margin: '0 0 20px' }}>
              Havola <b>1 soat</b> amal qiladi.
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            ← Kirish sahifasiga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
