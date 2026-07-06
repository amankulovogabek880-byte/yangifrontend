'use client';

/**
 * FacebookConnectionHelp
 *
 * Facebook Lead Ads sozlamalar sahifasiga qo'shiladigan yordamchi komponent.
 * Ikki narsani qiladi:
 *   1. OAuth qaytishidan keyingi `?fb=...` query parametrini o'qib, tushunarli
 *      xabar va tegishli Facebook havolasini ko'rsatadi.
 *   2. "Nega ishlamayapti?" tugmasi — backend'dagi yangi
 *      GET /facebook-leads/diagnose endpointini chaqirib, aniq tashxis beradi.
 *
 * INTEGRATSIYA: bu faylni loyihangizdagi Facebook sozlamalar sahifasi
 * (masalan settings/facebook-tab komponenti) ichiga import qiling va
 * mos joyga joylashtiring. `apiFetch` funksiyasini o'zingizning mavjud
 * API client'ingizga (axios instance yoki fetch wrapper) moslang —
 * pastda oddiy fetch bilan yozilgan, JWT tokenni o'zingiz qo'shing.
 */

import { useEffect, useState } from 'react';

type FbErrorCode =
  | 'success'
  | 'denied'
  | 'error'
  | 'nopages'
  | 'no_admin_access'
  | 'missing_permissions'
  | 'invalid_token'
  | 'connected_no_admin_access'
  | 'connected_subscribe_failed';

const ERROR_CONTENT: Record<
  FbErrorCode,
  { title: string; message: string; linkLabel?: string; linkHref?: string; tone: 'success' | 'warning' | 'error' }
> = {
  success: {
    title: '✅ Muvaffaqiyatli ulandi',
    message: 'Facebook Page CRM bilan ulandi. Endi lead formalarni tekshirish uchun "Tekshirish/Yangilash" tugmasini bosing.',
    tone: 'success',
  },
  denied: {
    title: 'Ruxsat berish bekor qilindi',
    message: 'Siz Facebook orqali ruxsat berishni bekor qildingiz. Davom etish uchun "Tezkor ulanish"ni qaytadan bosing.',
    tone: 'warning',
  },
  error: {
    title: 'Ulanishda xatolik',
    message: "Noma'lum xatolik yuz berdi. Birozdan so'ng qaytadan urinib ko'ring, agar takrorlansa — texnik yordamga murojaat qiling.",
    tone: 'error',
  },
  nopages: {
    title: 'Page topilmadi',
    message: 'Bu Facebook akkaunt hech qanday Page\'ni boshqarmaydi. Boshqa akkaunt bilan urinib ko\'ring, yoki pastdagi "Qo\'lda ulash (System User)" usulidan foydalaning.',
    tone: 'warning',
  },
  no_admin_access: {
    title: 'Bu Page uchun yetarli huquq yo\'q',
    message: 'Login qilingan Facebook akkauntda tanlangan Page uchun kerakli vazifa (task) yo\'q. Page egasidan Business Manager orqali sizga "Manage Page" yoki "Advertise" vazifasini berishini so\'rang.',
    linkLabel: 'Business Manager → Pages sozlamalarini ochish',
    linkHref: 'https://business.facebook.com/settings/pages',
    tone: 'error',
  },
  missing_permissions: {
    title: 'Kerakli ruxsatlar berilmadi',
    message: 'Facebook login paytida barcha so\'ralgan ruxsatlar berilmagan. "Tezkor ulanish"ni qaytadan bosib, ochilgan oynada barcha ruxsatlarni yoqing.',
    tone: 'error',
  },
  invalid_token: {
    title: 'Token muddati tugagan',
    message: 'Saqlangan Facebook token endi yaroqsiz. "Tezkor ulanish"ni qaytadan bosib, akkauntni qayta ulang.',
    tone: 'error',
  },
  connected_no_admin_access: {
    title: 'Page ulandi, lekin obuna muvaffaqiyatsiz',
    message: 'Page saqlandi, ammo lead xabarlariga obuna bo\'lish uchun bu akkauntda yetarli huquq yo\'q. Page egasidan Business Manager orqali kerakli vazifani so\'rang, keyin "Tekshirish/Yangilash"ni bosing.',
    linkLabel: 'Business Manager → Pages sozlamalarini ochish',
    linkHref: 'https://business.facebook.com/settings/pages',
    tone: 'warning',
  },
  connected_subscribe_failed: {
    title: 'Page ulandi, lekin obuna hozircha muvaffaqiyatsiz',
    message: 'Bir necha daqiqadan so\'ng "Tekshirish/Yangilash" tugmasini bosib qayta urining.',
    tone: 'warning',
  },
};

function ToneBanner({
  tone,
  title,
  message,
  linkLabel,
  linkHref,
}: {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  linkLabel?: string;
  linkHref?: string;
}) {
  const colors =
    tone === 'success'
      ? { bg: '#ecfdf5', border: '#10b981', text: '#065f46' }
      : tone === 'warning'
        ? { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' }
        : { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' };

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontWeight: 600, color: colors.text, marginBottom: 4 }}>{title}</div>
      <div style={{ color: colors.text, fontSize: 14, lineHeight: 1.5 }}>{message}</div>
      {linkHref && (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 10,
            fontSize: 14,
            fontWeight: 600,
            color: colors.text,
            textDecoration: 'underline',
          }}
        >
          {linkLabel} ↗
        </a>
      )}
    </div>
  );
}

/** OAuth qaytishidan keyingi ?fb=... ni ko'rsatadigan qism. */
export function FacebookOAuthResultBanner() {
  const [fbCode, setFbCode] = useState<FbErrorCode | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get('fb') as FbErrorCode | null;
    if (fb && ERROR_CONTENT[fb]) setFbCode(fb);
  }, []);

  if (!fbCode) return null;
  const content = ERROR_CONTENT[fbCode];
  return <ToneBanner tone={content.tone} title={content.title} message={content.message} linkLabel={content.linkLabel} linkHref={content.linkHref} />;
}

/** "Nega ishlamayapti?" tashxis tugmasi + natija paneli. */
export function FacebookDiagnoseButton({ apiBaseUrl, authToken }: { apiBaseUrl: string; authToken: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runDiagnose = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/facebook-leads/diagnose`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ recommendation: 'ERROR', message: e.message || 'Tarmoq xatosi' });
    } finally {
      setLoading(false);
    }
  };

  const recommendationLink =
    result?.recommendation === 'ASK_ADMIN'
      ? { label: 'Business Manager → Pages sozlamalarini ochish', href: 'https://business.facebook.com/settings/pages' }
      : result?.recommendation === 'SYSTEM_USER'
        ? { label: 'Business Manager → System Users ochish', href: 'https://business.facebook.com/settings/system-users' }
        : result?.recommendation === 'RECONNECT'
          ? null
          : null;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={runDiagnose}
        disabled={loading}
        style={{
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Tekshirilmoqda…' : '🔍 Nega ishlamayapti?'}
      </button>

      {result && (
        <div
          style={{
            marginTop: 12,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
          }}
        >
          <div style={{ marginBottom: 8 }}>{result.message}</div>
          {result.pageTasks && result.pageTasks.length > 0 && (
            <div style={{ color: '#6b7280', marginBottom: 8 }}>
              Mavjud vazifalar: <code>{result.pageTasks.join(', ')}</code>
            </div>
          )}
          {result.missingTasks && result.missingTasks.length > 0 && (
            <div style={{ color: '#6b7280', marginBottom: 8 }}>
              Yetishmayotgan vazifalar: <code>{result.missingTasks.join(', ')}</code>
            </div>
          )}
          {recommendationLink && (
            <a
              href={recommendationLink.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'underline' }}
            >
              {recommendationLink.label} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** "Qo'lda ulash" bo'limi ichiga qo'yiladigan System User bosqichma-bosqich yo'riqnoma. */
export function SystemUserGuide() {
  const steps = [
    {
      text: 'Business Manager\'ga kiring',
      href: 'https://business.facebook.com/settings/system-users',
    },
    {
      text: '"Add" tugmasi bilan yangi System User yarating (nomi: masalan "CRM Integration"), rolini Admin qiling',
      href: 'https://business.facebook.com/settings/system-users',
    },
    {
      text: '"Add Assets" → tegishli Page\'ni tanlang → Full control bering',
      href: 'https://business.facebook.com/settings/system-users',
    },
    {
      text: '"Generate New Token" → ilovangizni tanlang → quyidagi ruxsatlarni belgilang: pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval, ads_management',
      href: 'https://business.facebook.com/settings/system-users',
    },
    {
      text: 'Hosil bo\'lgan tokenni pastdagi "Page Access Token" maydoniga joylashtiring',
    },
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
        Jamoaviy mijozlar uchun tavsiya etiladi (xodimlar tez-tez almashsa):
      </div>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ marginBottom: 10, fontSize: 14, lineHeight: 1.5 }}>
            {s.text}
            {s.href && (
              <>
                {' '}
                <a href={s.href} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Ochish ↗
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
