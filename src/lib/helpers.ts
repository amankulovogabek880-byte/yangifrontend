// v14: yorliqlar til-sezgir (uz/ru) — joriy tilni localStorage'dan o'qiydi.
// Proxy tufayli `X_LABELS[key]` va `Object.entries(X_LABELS)` avvalgidek ishlaydi,
// lekin qiymatlar tanlangan tilга qarab qaytadi. Hech bir ishlatilish joyi o'zgармaydi.
function _lang(): 'uz' | 'ru' {
  try { return (localStorage.getItem('lang') as 'uz' | 'ru') || 'uz'; } catch { return 'uz'; }
}
function makeLabel(uz: Record<string, string>, ru: Record<string, string>): Record<string, string> {
  return new Proxy(uz, {
    get: (_t, k: string) => (_lang() === 'ru' ? ru : uz)[k as string] ?? (uz as any)[k],
    ownKeys: () => Reflect.ownKeys(uz),
    getOwnPropertyDescriptor: (_t, k) => ({ enumerable: true, configurable: true, value: (_lang() === 'ru' ? ru : uz)[k as string] ?? (uz as any)[k] }),
  }) as Record<string, string>;
}

const STAGE_UZ: Record<string, string> = {
  NEW_LEAD: '🆕 Yangi Lead', CONTACTED: '📞 Bog\'lanildi', INTERESTED: '👍 Qiziqdi',
  OFFER_SENT: '📨 Taklif yuborildi', NEGOTIATION: '💬 Muzokara', DEPOSIT_PAID: '💰 Avans olindi',
  CONFIRMED: '✅ Tasdiqlandi', TRAVELING: '✈️ Sayohatda', COMPLETED: '🎉 Yakunlandi', LOST: '❌ Yo\'qotildi',
};
const STAGE_RU: Record<string, string> = {
  NEW_LEAD: '🆕 Новый лид', CONTACTED: '📞 Связались', INTERESTED: '👍 Заинтересован',
  OFFER_SENT: '📨 Предложение отправлено', NEGOTIATION: '💬 Переговоры', DEPOSIT_PAID: '💰 Аванс получен',
  CONFIRMED: '✅ Подтверждён', TRAVELING: '✈️ В поездке', COMPLETED: '🎉 Завершён', LOST: '❌ Потерян',
};
export const STAGE_LABELS = makeLabel(STAGE_UZ, STAGE_RU);

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#6366f1',
  CONTACTED: '#3b82f6',
  INTERESTED: '#06b6d4',
  OFFER_SENT: '#f59e0b',
  NEGOTIATION: '#8b5cf6',
  DEPOSIT_PAID: '#22c55e',
  CONFIRMED: '#10b981',
  TRAVELING: '#84cc16',
  COMPLETED: '#64748b',
  LOST: '#ef4444',
};

const TIER_UZ: Record<string, string> = { REGULAR: '⚪ Oddiy', SILVER: '🥈 Silver', GOLD: '🥇 Gold', VIP: '💎 VIP' };
const TIER_RU: Record<string, string> = { REGULAR: '⚪ Обычный', SILVER: '🥈 Silver', GOLD: '🥇 Gold', VIP: '💎 VIP' };
export const TIER_LABELS = makeLabel(TIER_UZ, TIER_RU);

export const TIER_COLORS: Record<string, string> = {
  REGULAR: '#64748b',
  SILVER: '#94a3b8',
  GOLD: '#f59e0b',
  VIP: '#a855f7',
};

const SOURCE_UZ: Record<string, string> = {
  TELEGRAM: '✈ Telegram', INSTAGRAM: '📷 Instagram', WHATSAPP: '💬 WhatsApp', REFERRAL: '🤝 Tavsiya',
  WALKIN: '🚶 Ofisga keldi', WEBSITE: '🌐 Sayt', CALL: '📞 Qo\'ng\'iroq', FACEBOOK: '📘 Facebook',
  GOOGLE_ADS: '🔍 Google', OTHER: '❔ Boshqa',
};
const SOURCE_RU: Record<string, string> = {
  TELEGRAM: '✈ Telegram', INSTAGRAM: '📷 Instagram', WHATSAPP: '💬 WhatsApp', REFERRAL: '🤝 Рекомендация',
  WALKIN: '🚶 Пришёл в офис', WEBSITE: '🌐 Сайт', CALL: '📞 Звонок', FACEBOOK: '📘 Facebook',
  GOOGLE_ADS: '🔍 Google', OTHER: '❔ Другое',
};
export const SOURCE_LABELS = makeLabel(SOURCE_UZ, SOURCE_RU);

const BST_UZ: Record<string, string> = { DRAFT: '📝 Qoralama', CONFIRMED: '✅ Tasdiqlangan', IN_PROGRESS: '⏳ Jarayonda', COMPLETED: '🎉 Yakunlangan', CANCELLED: '❌ Bekor qilingan' };
const BST_RU: Record<string, string> = { DRAFT: '📝 Черновик', CONFIRMED: '✅ Подтверждён', IN_PROGRESS: '⏳ В процессе', COMPLETED: '🎉 Завершён', CANCELLED: '❌ Отменён' };
export const BOOKING_STATUS_LABELS = makeLabel(BST_UZ, BST_RU);

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',
  CONFIRMED: '#3d7eff',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

const PM_UZ: Record<string, string> = { CASH: '💵 Naqd', BANK_TRANSFER: '🏦 Bank', CARD: '💳 Karta', PAYME: 'Payme', CLICK: 'Click', UZUM: 'Uzum', CRYPTO: '₿ Crypto', OTHER: 'Boshqa' };
const PM_RU: Record<string, string> = { CASH: '💵 Наличные', BANK_TRANSFER: '🏦 Банк', CARD: '💳 Карта', PAYME: 'Payme', CLICK: 'Click', UZUM: 'Uzum', CRYPTO: '₿ Crypto', OTHER: 'Другое' };
export const PAYMENT_METHOD_LABELS = makeLabel(PM_UZ, PM_RU);

export function fmt(n: number | undefined | null, dollar = true): string {
  if (n === undefined || n === null) return dollar ? '$0' : '0';
  return (dollar ? '$' : '') + Math.round(n).toLocaleString('en-US');
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('uz-UZ', {
    dateStyle: 'short', timeStyle: 'short',
  });
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return '';
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return 'hozir';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daq oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} kun oldin`;
  return new Date(d).toLocaleDateString('uz-UZ');
}

export function errMsg(e: any): string {
  return e?.response?.data?.message || e?.message || 'Xato yuz berdi';
}

export function fmtMoney(amount: number, currency = 'USD'): string {
  return `${currency} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

// Valyuta belgisi (USD -> $, EUR -> €, UZS -> so'm, RUB -> ₽)
export function currencySymbol(currency = 'USD'): string {
  const map: Record<string, string> = { USD: '$', EUR: '€', UZS: "so'm", RUB: '₽' };
  return map[currency] || currency;
}

// Narxni valyuta belgisi bilan chiroyli formatlaydi: 1 250 $ yoki 15 000 000 so'm
export function fmtPrice(amount: number, currency = 'USD'): string {
  const val = (amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const sym = currencySymbol(currency);
  // so'm kabi uzun belgilar summadan keyin, $/€/₽ esa oldin qulayroq ko'rinadi
  return sym.length <= 1 ? `${sym}${val}` : `${val} ${sym}`;
}

// USD bo'lmagan summalar uchun kichik "≈ $X" qatorini hosil qiladi (offer.clientPriceUSD kabi
// backend tomonidan yaratilgan paytdagi CBU kursi bilan muzlatilgan qiymatlardan foydalanadi)
export function fmtUsdEquivalent(amountUSD: number | null | undefined, currency: string): string | null {
  if (currency === 'USD' || amountUSD == null) return null;
  return `≈ $${Number(amountUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}