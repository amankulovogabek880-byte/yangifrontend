export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: '🆕 Yangi Lead',
  CONTACTED: '📞 Bog\'lanildi',
  INTERESTED: '👍 Qiziqdi',
  OFFER_SENT: '📨 Taklif yuborildi',
  NEGOTIATION: '💬 Muzokara',
  DEPOSIT_PAID: '💰 Avans olindi',
  CONFIRMED: '✅ Tasdiqlandi',
  TRAVELING: '✈️ Sayohatda',
  COMPLETED: '🎉 Yakunlandi',
  LOST: '❌ Yo\'qotildi',
};

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

export const TIER_LABELS: Record<string, string> = {
  REGULAR: '⚪ Oddiy',
  SILVER: '🥈 Silver',
  GOLD: '🥇 Gold',
  VIP: '💎 VIP',
};

export const TIER_COLORS: Record<string, string> = {
  REGULAR: '#64748b',
  SILVER: '#94a3b8',
  GOLD: '#f59e0b',
  VIP: '#a855f7',
};

export const SOURCE_LABELS: Record<string, string> = {
  TELEGRAM: '✈ Telegram',
  INSTAGRAM: '📷 Instagram',
  WHATSAPP: '💬 WhatsApp',
  REFERRAL: '🤝 Tavsiya',
  WALKIN: '🚶 Ofisga keldi',
  WEBSITE: '🌐 Sayt',
  CALL: '📞 Qo\'ng\'iroq',
  FACEBOOK: '📘 Facebook',
  GOOGLE_ADS: '🔍 Google',
  OTHER: '❔ Boshqa',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  DRAFT: '📝 Qoralama',
  CONFIRMED: '✅ Tasdiqlangan',
  IN_PROGRESS: '⏳ Jarayonda',
  COMPLETED: '🎉 Yakunlangan',
  CANCELLED: '❌ Bekor qilingan',
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',
  CONFIRMED: '#3d7eff',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: '💵 Naqd',
  BANK_TRANSFER: '🏦 Bank',
  CARD: '💳 Karta',
  PAYME: 'Payme',
  CLICK: 'Click',
  UZUM: 'Uzum',
  CRYPTO: '₿ Crypto',
  OTHER: 'Boshqa',
};

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
