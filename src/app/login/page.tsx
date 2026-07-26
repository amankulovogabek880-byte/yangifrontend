'use client';
import { OmonLogoSvg } from '@/components/OmonLogo';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
    )}
  </svg>
);

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (requires2FA && !twoFactorCode.trim()) return;
    setLoading(true);
    try {
      const result = await login(email.trim(), password, requires2FA ? twoFactorCode.trim() : undefined);
      if (result.requires2FA) {
        setRequires2FA(true);
        return;
      }
      if (result.user) {
        toast.success('Xush kelibsiz, ' + result.user.name + '!');
        router.replace('/dashboard');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Email yoki parol noto'g'ri");
      if (requires2FA) setTwoFactorCode('');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>

      {/* ─── LEFT: Hero image panel ─────────────────────────────── */}
      <div style={{
        flex: 1, display: 'none', position: 'relative', overflow: 'hidden',
        // Show on desktop
      }} className="login-hero">
        {/* Rasm */}
        <img
          src="/login-bg.jpg"
          alt="Travel"
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          onError={(e) => {
            // Agar rasm yo'q bo'lsa, gradient ko'rsatamiz
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        {/* Dark overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(10,20,40,0.55) 0%, rgba(10,20,40,0.82) 100%)',
        }} />
        {/* Content on image */}
        <div style={{ position: 'relative', zIndex: 2, padding: '48px 52px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <OmonLogoSvg size={40}/>
            <div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Omon CRM</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>Travel Management</div>
            </div>
          </div>

          <div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, marginBottom: 24, lineHeight: 1.6, maxWidth: 380 }}>
              Sayohat agentliklari uchun eng ilg'or CRM tizimi. Barcha mijozlar, bronlar va jarayonlarni bitta joyda boshqaring.
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { num: '500+', label: 'Agentlik' },
                { num: '50K+', label: 'Mijozlar' },
                { num: '99.9%', label: 'Uptime' },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ color: '#7ab8d4', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{stat.num}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Login form ──────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 40px',
        background: 'var(--bg-2)',
        position: 'relative',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
      }}>

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 18, right: 18, display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
            {(['uz','ru','en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? 'var(--bg-4)' : 'transparent',
                border: 'none', borderRadius: 6, padding: '4px 10px',
                fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                color: lang === l ? 'var(--primary)' : 'var(--fg-3)',
                cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.14s',
              }}>{l}</button>
            ))}
          </div>
          <button onClick={toggleTheme} style={{
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
            color: 'var(--fg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <OmonLogoSvg size={60}/>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color: 'var(--fg)', lineHeight: 1 }}>
              Omon<span style={{ color: '#7ab8d4' }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 7, letterSpacing: 0.3 }}>
              Sayohat agentliklari uchun CRM
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)', pointerEvents: 'none' }}>
                  <MailIcon />
                </span>
                <input
                  type="email" required autoFocus disabled={requires2FA}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  style={{
                    width: '100%', padding: '11px 13px 11px 38px',
                    background: 'var(--bg-3)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10, color: 'var(--fg)',
                    fontSize: 14, outline: 'none',
                    transition: 'border-color 0.14s, box-shadow 0.14s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Parol
                </label>
                <Link href="/forgot-password" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                  Unutdingizmi?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)', pointerEvents: 'none' }}>
                  <LockIcon />
                </span>
                <input
                  type={showPass ? 'text' : 'password'} required disabled={requires2FA}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '11px 42px 11px 38px',
                    background: 'var(--bg-3)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10, color: 'var(--fg)',
                    fontSize: 14, outline: 'none',
                    transition: 'border-color 0.14s, box-shadow 0.14s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--fg-3)', display: 'flex', alignItems: 'center',
                }}>
                  <EyeIcon open={showPass}/>
                </button>
              </div>
            </div>

            {/* 2FA code — parol to'g'ri kiritilgach, agar 2FA yoqilgan bo'lsa chiqadi */}
            {requires2FA && (
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  2FA kod
                </label>
                <input
                  type="text" required autoFocus
                  inputMode="numeric"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value)}
                  placeholder="Authenticator kod yoki backup kod"
                  style={{
                    width: '100%', padding: '11px 13px',
                    background: 'var(--bg-3)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10, color: 'var(--fg)',
                    fontSize: 14, outline: 'none',
                    letterSpacing: 2,
                    transition: 'border-color 0.14s, box-shadow 0.14s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => { setRequires2FA(false); setTwoFactorCode(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 11, marginTop: 8, cursor: 'pointer', padding: 0 }}
                >
                  ← Boshqa email bilan kirish
                </button>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? 'var(--bg-4)' : 'linear-gradient(135deg, #5b6ef5 0%, #7ab8d4 100%)',
              border: 'none', borderRadius: 11,
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.14s, transform 0.1s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(91,110,245,0.35)',
              letterSpacing: 0.2,
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}/> Kirish...</> : 'Kirish'}
            </button>
          </form>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: 'var(--fg-3)' }}>
            © {new Date().getFullYear()} Omon CRM. Barcha huquqlar himoyalangan.
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .login-hero { display: block !important; }
        }
      `}</style>
    </div>
  );
}