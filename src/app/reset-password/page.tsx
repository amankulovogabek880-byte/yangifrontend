'use client';
import { OmonLogoSvg } from '@/components/OmonLogo';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { authApi } from '@/services/api';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !email) setError("Havola noto'g'ri. Qayta so'rang.");
  }, [token, email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Parol kamida 8 belgi'); return; }
    if (newPassword !== confirm) { setError('Parollar mos kelmaydi'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(email, token, newPassword);
      setDone(true);
      setTimeout(() => router.replace('/login'), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || "Xato yuz berdi. Havola muddati tugagan bo'lishi mumkin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <button onClick={toggleTheme} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
        color: 'var(--fg-2)', fontSize: 14, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>{theme === 'dark' ? '☀' : '☾'}</button>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 20, padding: '36px 28px',
        boxShadow: 'var(--shadow-lg)',
      }}>
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

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>Parol yangilandi!</h2>
            <p style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 20 }}>
              Kirish sahifasiga yo'naltirilmoqda...
            </p>
            <Link href="/login" className="btn btn-gradient" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, textDecoration: 'none', color: '#fff', fontWeight: 600 }}>
              Kirish →
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Yangi parol o'rnatish</h2>
            {email && <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--fg-3)' }}>📧 {decodeURIComponent(email)}</p>}

            {error && (
              <div style={{
                background: 'var(--danger-soft)', color: 'var(--danger)',
                border: '1px solid var(--danger)', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, marginBottom: 16,
              }}>{error}</div>
            )}

            {!error || error !== "Havola noto'g'ri. Qayta so'rang." ? (
              <form onSubmit={submit}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Yangi parol
                </label>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <input
                    type={showPwd ? 'text' : 'password'} required autoFocus
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Kamida 8 belgi"
                    className="form-input"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                    position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--fg-3)', fontSize: 13,
                  }}>{showPwd ? '🙈' : '👁'}</button>
                </div>

                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Parolni tasdiqlang
                </label>
                <input
                  type={showPwd ? 'text' : 'password'} required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Parolni qayta kiriting"
                  className="form-input"
                  style={{ marginBottom: 20 }}
                />

                {/* Parol kuchi ko'rsatgich */}
                {newPassword && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => {
                        const strength = [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /\d/.test(newPassword),
                          /[^A-Za-z0-9]/.test(newPassword),
                        ].filter(Boolean).length;
                        const colors = ['', '#ef4444','#f97316','#eab308','#10b981'];
                        return <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? colors[strength] : 'var(--border)' }} />;
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                      {(() => {
                        const s = [newPassword.length>=8,/[A-Z]/.test(newPassword),/\d/.test(newPassword),/[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
                        return ['','Zaif','O\'rtacha','Yaxshi','Kuchli'][s];
                      })()}
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-gradient btn-lg" style={{ width: '100%' }}>
                  {loading
                    ? <><span className="spinner spinner-sm" style={{ borderTopColor: '#fff' }} /> Saqlanmoqda...</>
                    : '🔐 Parolni yangilash'}
                </button>
              </form>
            ) : null}

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                ← Qayta havola so'rash
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span className="spinner spinner-lg" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
