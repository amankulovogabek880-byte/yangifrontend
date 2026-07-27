'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userTelegramApi, facebookLeadsApi } from '@/services/api';

// v29: "Boshlash uchun qadamlar" — kompaniya birinchi marta kirganda
// (OnboardingWizard'dan keyin) ekranda nima qilish kerakligi umuman
// ko'rsatilmasdi: bo'sh Dashboard, bo'sh Mijozlar ro'yxati. Tur agentliklari
// aynan shu yerda adashib, "tushunarsiz" deb qolishayotgan edi.
//
// Bu karta — Bitrix24/amoCRM'dagi kabi — TENANT_ADMIN va MANAGER'ga har
// safar Dashboard'ga kirganda, muhim qadamlar bajarilmagunicha, aniq
// "keyingi qadam" ko'rsatib turadi. Barcha qadamlar bajarilgach avtomatik
// yashiriladi (yoki qo'lda yopish mumkin — localStorage'da eslab qolinadi).

interface StepDef {
  key: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
}

const STEPS: StepDef[] = [
  {
    key: 'telegram',
    title: 'Telegram ulang',
    desc: 'Mijozlar bilan yozishmalar shu yerdan boradi — ulanmasa, Inbox bo\'sh qoladi.',
    href: '/settings?tab=telegram',
    cta: 'Ulash',
  },
  {
    key: 'client',
    title: 'Birinchi mijozni qo\'shing',
    desc: 'Qo\'lda qo\'shing yoki Facebook/Instagram orqali avtomatik oqim sozlang.',
    href: '/clients?new=1',
    cta: 'Qo\'shish',
  },
  {
    key: 'offer',
    title: 'Birinchi taklifni yuboring',
    desc: 'Mijozga tur taklifi yuboring — bosilsa avtomatik bookingga aylanadi.',
    href: '/clients',
    cta: "Ko'rish",
  },
  {
    key: 'leadchannel',
    title: 'Facebook yoki Instagram ulang (ixtiyoriy)',
    desc: 'Reklama orqali kelgan leadlar avtomatik CRM\'ga tushadi.',
    href: '/settings?tab=facebook',
    cta: 'Ulash',
  },
];

function storageKey(tenantId?: string) {
  return `getting_started_dismissed_${tenantId || 'default'}`;
}

export default function GettingStartedCard({ tenantId, hasClients, hasOffers }: { tenantId?: string; hasClients: boolean; hasOffers: boolean }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // localStorage tekshirilguncha yashirin
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const [leadChannelConnected, setLeadChannelConnected] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(storageKey(tenantId)));
  }, [tenantId]);

  useEffect(() => {
    Promise.all([
      // getMyAccount() ulanmagan bo'lsa `null` qaytaradi (connected maydoni yo'q)
      userTelegramApi.getMyAccount().then((r: any) => !!r?.data).catch(() => false),
      // getConfig() har doim obyekt qaytaradi — isEnabled = token + pageId ikkalasi ham bor
      facebookLeadsApi.getConfig().then((r: any) => !!r?.data?.isEnabled).catch(() => false),
    ]).then(([tg, fb]) => {
      setTelegramConnected(tg);
      setLeadChannelConnected(fb);
      setChecked(true);
    });
  }, []);

  if (dismissed || !checked) return null;

  const done: Record<string, boolean> = {
    telegram: !!telegramConnected,
    client: hasClients,
    offer: hasOffers,
    leadchannel: !!leadChannelConnected,
  };

  // Ixtiyoriy qadam (Facebook) hisoblanmasa ham, majburiy 3 tasi bajarilgan
  // bo'lsa kartani butunlay yashiramiz — foydalanuvchi allaqachon CRM'ni
  // tushungan va faol ishlatayotgan bo'ladi.
  const requiredDone = done.telegram && done.client && done.offer;
  if (requiredDone) return null;

  const doneCount = Object.values(done).filter(Boolean).length;

  function dismiss() {
    localStorage.setItem(storageKey(tenantId), '1');
    setDismissed(true);
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-2)',
      padding: '16px 18px', marginBottom: 4, position: 'relative',
    }}>
      <button
        onClick={dismiss}
        title="Yopish — keyinroq bajarasiz"
        style={{
          position: 'absolute', top: 12, right: 12, border: 'none', background: 'none',
          color: 'var(--fg-4)', cursor: 'pointer', fontSize: 14,
        }}
      >✕</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>🚀 Boshlash uchun qadamlar</span>
        <span style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 600 }}>{doneCount}/{STEPS.length}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>
        CRM'dan to'liq foydalanish uchun quyidagilarni bajaring — har biri 1 daqiqa vaqt oladi.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map((s) => {
          const isDone = done[s.key];
          return (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
              borderRadius: 9, background: isDone ? 'var(--success-soft)' : 'var(--bg-3)',
              opacity: isDone ? 0.65 : 1,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? 'var(--success)' : 'var(--bg)', color: isDone ? '#fff' : 'var(--fg-4)',
                fontSize: 12, fontWeight: 700, border: isDone ? 'none' : '1px solid var(--border)',
              }}>{isDone ? '✓' : ''}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textDecoration: isDone ? 'line-through' : 'none' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{s.desc}</div>
              </div>
              {!isDone && (
                <button
                  onClick={() => router.push(s.href)}
                  style={{
                    padding: '6px 12px', borderRadius: 7, border: 'none', background: '#3d7eff',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  }}
                >{s.cta}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}