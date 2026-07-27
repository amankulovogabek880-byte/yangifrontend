'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tenantsApi, usersApi } from '@/services/api';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 'welcome',  title: 'Xush kelibsiz!',         icon: '👋' },
  { id: 'company',  title: 'Kompaniya sozlamalari',   icon: '🏢' },
  { id: 'team',     title: 'Birinchi agent',          icon: '👤' },
  { id: 'done',     title: 'Hammasi tayyor!',         icon: '🎉' },
];

interface Props { tenantName: string; onComplete: () => void; }

export default function OnboardingWizard({ tenantName, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({ name: tenantName, timezone: 'Asia/Tashkent', currency: 'USD' });
  const [agent, setAgent] = useState({ name: '', email: '', password: '', phone: '' });
  const [skipAgent, setSkipAgent] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function nextStep() {
    if (step === 1) {
      // Kompaniya saqlash
      setLoading(true);
      try {
        await tenantsApi.updateSettings(company);
      } catch {} finally { setLoading(false); }
    }

    if (step === 2 && !skipAgent) {
      // Agent yaratish
      if (!agent.name.trim() || !agent.email.trim() || !agent.password) {
        toast.error('Ism, email va parol majburiy');
        return;
      }
      if (agent.password.length < 8) {
        toast.error('Parol kamida 8 belgi');
        return;
      }
      setLoading(true);
      try {
        await usersApi.create({ ...agent, role: 'AGENT' });
        toast.success(`✅ ${agent.name} qo'shildi`);
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Agent yaratishda xato');
        setLoading(false);
        return;
      } finally { setLoading(false); }
    }

    if (isLast) { onComplete(); return; }
    setStep(s => s + 1);
  }

  function prevStep() { if (step > 0) setStep(s => s - 1); }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{
        background: 'var(--bg-2)', borderRadius: 20,
        border: '1px solid var(--border)',
        width: '100%', maxWidth: 480,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--bg-3)' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'var(--gradient)',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 24px 0' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div style={{ padding: '24px 28px 28px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{current.icon}</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>
              {current.title}
            </h2>
          </div>

          {/* Step content */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--fg-2)', fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>
                <b>{tenantName}</b> uchun Omon CRM ga xush kelibsiz!
              </p>
              <p style={{ color: 'var(--fg-3)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Ushbu qisqa sozlash jarayoni 2 daqiqa davom etadi.
                Kompaniya ma'lumotlarini kiriting va birinchi agentingizni qo'shing.
              </p>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Kompaniya nomi
                </label>
                <input
                  className="form-input"
                  value={company.name}
                  onChange={e => setCompany({...company, name: e.target.value})}
                  placeholder="Masalan: Omon Travel"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Vaqt mintaqasi
                  </label>
                  <select className="form-input" value={company.timezone} onChange={e => setCompany({...company, timezone: e.target.value})}>
                    <option value="Asia/Tashkent">Toshkent (UTC+5)</option>
                    <option value="Europe/Moscow">Moskva (UTC+3)</option>
                    <option value="Asia/Dubai">Dubai (UTC+4)</option>
                    <option value="Europe/Istanbul">Istanbul (UTC+3)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Valyuta
                  </label>
                  <select className="form-input" value={company.currency} onChange={e => setCompany({...company, currency: e.target.value})}>
                    <option value="USD">USD ($)</option>
                    <option value="UZS">UZS (so'm)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="RUB">RUB (₽)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={skipAgent} onChange={e => setSkipAgent(e.target.checked)}
                  style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Keyinroq agent qo'shaman</span>
              </label>

              {!skipAgent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>To'liq ism *</label>
                      <input className="form-input" value={agent.name} onChange={e => setAgent({...agent, name: e.target.value})} placeholder="Aziz Aliyev" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>Telefon</label>
                      <input className="form-input" value={agent.phone} onChange={e => setAgent({...agent, phone: e.target.value})} placeholder="+998901234567" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>Email *</label>
                    <input className="form-input" type="email" value={agent.email} onChange={e => setAgent({...agent, email: e.target.value})} placeholder="agent@kompaniya.uz" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase' }}>Parol *</label>
                    <input className="form-input" type="password" value={agent.password} onChange={e => setAgent({...agent, password: e.target.value})} placeholder="Kamida 8 belgi" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--fg-2)', fontSize: 15, lineHeight: 1.7, margin: '0 0 20px' }}>
                Ajoyib! Omon CRM ishga tayyor.<br/>
                Endi quyidagi qadamlardan birini tanlang:
              </p>
              {/* v29: bu havolalar ilgari oddiy matn edi — bosib bo'lmasdi.
                  Endi to'g'ridan-to'g'ri o'sha sahifaga olib boradi va oynani
                  yopadi, shunda foydalanuvchi darhol harakatga o'tadi. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                {[
                  { icon: '📨', text: 'Telegram ulash', sub: "Mijozlar bilan yozishmalar shu yerdan boradi", href: '/settings?tab=telegram', primary: true },
                  { icon: '◍', text: 'Birinchi mijozni qo\'shish', sub: "Qo'lda yoki Facebook/Instagram orqali", href: '/clients?new=1' },
                  { icon: '✈', text: 'Bookinglar bo\'limi', sub: "To'g'ridan-to'g'ri booking yaratish", href: '/bookings' },
                ].map(item => (
                  <button
                    key={item.href}
                    onClick={() => { onComplete(); router.push(item.href); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer', width: '100%',
                      border: item.primary ? '1px solid #3d7eff' : '1px solid var(--border)',
                      background: item.primary ? 'rgba(61,126,255,0.08)' : 'var(--bg-3)',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{item.sub}</div>
                    </div>
                    <span style={{ color: 'var(--fg-4)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 0 && !isLast && (
              <button onClick={prevStep} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-3)',
                color: 'var(--fg-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>← Orqaga</button>
            )}
            <button
              onClick={nextStep}
              disabled={loading}
              className="btn btn-gradient"
              style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}
            >
              {loading
                ? <><span className="spinner spinner-sm" style={{ borderTopColor: '#fff' }} /> Saqlanmoqda...</>
                : isLast ? '🚀 Boshlash!' : step === 0 ? 'Boshlash →' : 'Davom etish →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}