import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// XAVFSIZLIK TUZATISH (v10.1):
//  - Refresh token ENDI localStorage'da SAQLANMAYDI — u backend tomonidan
//    httpOnly cookie'ga yoziladi (JS o'qiy olmaydi → XSS'dan himoya).
//  - Access token faqat xotirada (memory) ushlanadi. Sahifa yangilansa,
//    cookie orqali /auth/refresh chaqirilib yangi access token olinadi.
//  - withCredentials: true — cookie har so'rovda avtomatik yuboriladi.
// ─────────────────────────────────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  withCredentials: true, // httpOnly refresh cookie uchun
  // v19: har qanday oraliq proksi/CDN (masalan Render) yoki brauzer
  // keshlashini butunlay o'chiramiz — CRM ma'lumotlari doim yangi
  // bo'lishi kerak (masalan yangi kelgan qo'ng'iroq yozuvi kabi).
  headers: { 'Cache-Control': 'no-cache' },
});

// Request interceptor — access tokenni header'ga qo'shish
api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// ── Auto refresh on 401 ─────────────────────────────────────
let refreshPromise: Promise<string | null> | null = null;

/**
 * Cookie'dagi refresh token orqali yangi access token olish.
 * Bir vaqtda faqat bitta refresh so'rovi ketadi (parallel 401'lar
 * bitta promise'ni kutadi).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const t = res.data?.accessToken || null;
        setAccessToken(t);
        return t;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config || {};
    // Xavfsizlik amallari (2FA yoqish/o'chirish, parol almashtirish) — bularда
    // 401/400 xatosi "sessiya tugadi" degani EMAS, balki "kred noto'g'ri" degani.
    // Shuning uchun bu so'rovlarni login sahifasiga uloqtirmaymiz — xatoni
    // to'g'ridan-to'g'ri komponentga qaytaramiz, u foydalanuvchiga ko'rsatadi.
    const url: string = original.url || '';
    const isAuthAction =
      url.includes('/auth/2fa/') || url.includes('/auth/change-password');

    if (err.response?.status === 401 && !original._retry && typeof window !== 'undefined') {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh ham ishlamadi — sessiya tugagan
      setAccessToken(null);
      if (!isAuthAction &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/public') &&
          !window.location.pathname.startsWith('/reset-password') &&
          !window.location.pathname.startsWith('/forgot-password')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }
    return Promise.reject(err);
  },
);

// ── AUTH ─────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string, twoFactorCode?: string) =>
    api.post('/auth/login', { email, password, twoFactorCode }),
  logout: (refreshToken?: string) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  logoutAll: () => api.post('/auth/logout-all'),
  me: () => api.get('/auth/me'),
  createUser: (data: any) => api.post('/auth/users', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post('/auth/reset-password', { email, token, newPassword }),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),

  // ── 2FA (v4) ──
  setup2FA: () => api.post('/auth/2fa/setup'),
  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),
  // credential = akkaunt paroli YOKI authenticator/backup kodi
  disable2FA: (credential: string) => api.post('/auth/2fa/disable', { credential }),

  // ── Sessions (v4) ──
  sessions: () => api.get('/auth/sessions'),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
  loginHistory: () => api.get('/auth/login-history'),
};

// ── USERS ────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  me: () => api.get('/users/me'),
  updateMe: (data: any) => api.patch('/users/me', data),
  one: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  toggle: (id: string) => api.patch(`/users/${id}/toggle`),
  // v5: Admin agent boshqaruvi
  create: (data: any) => api.post('/users', data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  // v9: Advanced Round Robin
  pauseAgent: (id: string, reason?: string, until?: string) =>
    api.post(`/lead-assignment/agents/${id}/pause`, { reason, until }),
  unpauseAgent: (id: string) =>
    api.post(`/lead-assignment/agents/${id}/unpause`),
  setDailyLimit: (id: string, limit: number) =>
    api.patch(`/lead-assignment/agents/${id}/daily-limit`, { limit }),
  // v17: moslashtiriladigan ruxsatlar (custom permissions)
  getPermissions: (id: string) => api.get(`/users/${id}/permissions`),
  setPermissions: (id: string, permissions: Record<string, boolean>) =>
    api.patch(`/users/${id}/permissions`, { permissions }),
};

// ── INVOICES (v5) ──────────────────────────────────────────
export const invoicesApi = {
  list: (params?: any) => api.get('/invoices', { params }),
  one: (id: string) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  update: (id: string, data: any) => api.patch(`/invoices/${id}`, data),
  delete: (id: string) => api.delete(`/invoices/${id}`),
  pdf: (id: string) => api.get(`/invoices/${id}/pdf`, { responseType: 'text' }),
  sendTelegram: (id: string) => api.post(`/invoices/${id}/send-telegram`),
  publicView: (number: string) => api.get(`/public/invoices/${number}`),
};

// ── TENANTS ──────────────────────────────────────────────────
export const tenantsApi = {
  getSettings: () => api.get('/tenants/settings'),
  updateSettings: (data: any) => api.patch('/tenants/settings', data),
  stats: () => api.get('/tenants/stats'),
  getSourceRouting: () => api.get('/tenants/source-routing'),
  updateSourceRouting: (sourceRouting: any) =>
    api.patch('/tenants/source-routing', { sourceRouting }),
  // Har bir agent o'zi o'zining Мои Звонки login emailini sozlashi uchun
  // (admin talab qilinmaydi)
  updateMyMoiZvonkiEmail: (email: string) =>
    api.patch('/tenants/phone-provider/my-moizvonki-email', { email }),
};

// ── AUTO-REPLY ───────────────────────────────────────────────
export const autoReplyApi = {
  list: () => api.get('/auto-reply-rules'),
  create: (data: any) => api.post('/auto-reply-rules', data),
  update: (id: string, data: any) => api.put(`/auto-reply-rules/${id}`, data),
  delete: (id: string) => api.delete(`/auto-reply-rules/${id}`),
  toggle: (id: string) => api.post(`/auto-reply-rules/${id}/toggle`),
};

// ── LEAD FORMS ───────────────────────────────────────────────
export const leadFormsApi = {
  list: () => api.get('/lead-forms'),
  create: (data: any) => api.post('/lead-forms', data),
  update: (id: string, data: any) => api.put(`/lead-forms/${id}`, data),
  delete: (id: string) => api.delete(`/lead-forms/${id}`),
  stats: (id: string) => api.get(`/lead-forms/${id}/stats`),
};

// ── KPI (Commission Tiers) ─────────────────────────────────
export const kpiApi = {
  getTiers: () => api.get('/kpi/tiers'),
  saveTiers: (tiers: any[]) => api.put('/kpi/tiers', { tiers }),
};

// ── CLIENTS ──────────────────────────────────────────────────
export const clientsApi = {
  list: (params?: any) => api.get('/clients', { params }),
  lost: (params?: any) => api.get('/clients/lost', { params }),
  stats: () => api.get('/clients/stats'),
  one: (id: string) => api.get(`/clients/${id}`),
  timeline: (id: string) => api.get(`/clients/${id}/timeline`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  addNote: (id: string, note: string) => api.post(`/clients/${id}/notes`, { note }),
  // v14: mijozning ixtiyoriy key=value ma'lumotlari
  setCustomFields: (id: string, fields: {key:string;value:string}[]) => api.patch(`/clients/${id}/custom-fields`, { fields }),
  // v29: "Nima xohlaydi" — qat'iy 2 ta maydon (yo'nalish + byudjet)
  setKeyInfo: (id: string, data: { destination?: string; companions?: string; peopleCount?: string; kids?: string; dates?: string; duration?: string; budget?: string; budgetCurrency?: string }) => api.patch(`/clients/${id}/key-info`, data),
  setTier: (id: string, tier: string) => api.patch(`/clients/${id}/tier`, { tier }),
  // v5: Open Chat va Call
  getConversation: (id: string) => api.get(`/clients/${id}/conversation`),
  call: (id: string) => api.post(`/clients/${id}/call`),
  // v33: Excel/CSV orqali ko'p sonli lead import qilish (eski tizimdan ko'chirish)
  importLeads: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/clients/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2000+ qator uchun ko'proq vaqt kerak bo'lishi mumkin
    });
  },
};

// ── PIPELINE ─────────────────────────────────────────────────
export const pipelineApi = {
  board: (agentId?: string) => api.get('/pipeline/board', { params: agentId ? { agentId } : {} }),
  analytics: (from?: string, to?: string) =>
    api.get('/pipeline/analytics', { params: { from, to } }),
  history: (clientId: string) => api.get(`/pipeline/client/${clientId}/history`),
  move: (clientId: string, stage: string, note?: string, lostReason?: string) =>
    api.patch(`/pipeline/client/${clientId}/stage`, { stage, note, lostReason }),
  bulkMove: (clientIds: string[], stage: string) =>
    api.post('/pipeline/bulk-move', { clientIds, stage }),
};

// ── BOOKINGS ─────────────────────────────────────────────────
export const bookingsApi = {
  list: (params?: any) => api.get('/bookings', { params }),
  one: (id: string) => api.get(`/bookings/${id}`),
  create: (data: any) => api.post('/bookings', data),
  update: (id: string, data: any) => api.put(`/bookings/${id}`, data),
  delete: (id: string) => api.delete(`/bookings/${id}`),
};

// ── PAYMENTS ─────────────────────────────────────────────────
export const paymentsApi = {
  list: (params?: any) => api.get('/payments', { params }),
  stats: () => api.get('/payments/stats'),
  addManual: (data: any) => api.post('/payments/manual', data),
  refund: (id: string, reason?: string) => api.post(`/payments/${id}/refund`, { reason }),
};

// ── TELEGRAM ─────────────────────────────────────────────────
export const telegramApi = {
  accounts: () => api.get('/telegram/accounts'),
  connectBot: (token: string, name: string) => api.post('/telegram/accounts', { token, name }),
  disconnectBot: (id: string) => api.delete(`/telegram/accounts/${id}`),
  conversations: (params?: any) => api.get('/telegram/conversations', { params }),
  messages: (id: string) => api.get(`/telegram/conversations/${id}/messages`),
  send: (id: string, text: string, isInternal = false) =>
    api.post(`/telegram/conversations/${id}/messages`, { text, isInternal }),
  sendMessage: (id: string, text: string, isInternal = false) =>
    api.post(`/telegram/conversations/${id}/messages`, { text, isInternal }),
  assign: (id: string, agentId: string | null) =>
    api.patch(`/telegram/conversations/${id}/assign`, { agentId }),
  claim: (id: string) => api.patch(`/telegram/conversations/${id}/claim`),
  resolve: (id: string) => api.patch(`/telegram/conversations/${id}/resolve`),
  setRead: (id: string, read: boolean) => api.patch(`/telegram/conversations/${id}/read`, { read }),
  linkClient: (id: string, clientId: string) =>
    api.patch(`/telegram/conversations/${id}/link-client`, { clientId }),
  templates: (params?: any) => api.get('/telegram/templates', { params }),
  createTemplate: (data: any) => api.post('/telegram/templates', data),
  deleteTemplate: (id: string) => api.delete(`/telegram/templates/${id}`),
  updateTemplate: (id: string, data: any) => api.patch(`/telegram/templates/${id}`, data),
  sendInvoice: (convId: string, data: any) => api.post(`/telegram/conversations/${convId}/send-invoice`, data),
};

// ── TASKS ────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: any) => api.get('/tasks', { params }),
  create: (data: any) => api.post('/tasks', data),
  update: (id: string, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// ── FOLLOWUPS ────────────────────────────────────────────────
export const followUpsApi = {
  list: (params?: any) => api.get('/followups', { params }),
  create: (data: any) => api.post('/followups', data),
  complete: (id: string) => api.patch(`/followups/${id}/complete`),
  delete: (id: string) => api.delete(`/followups/${id}`),
};

// ── MEETINGS / KALENDAR ─────────────────────────────────────
export const meetingsApi = {
  list: (params?: any) => api.get('/meetings', { params }),
  calendar: (params?: any) => api.get('/meetings/calendar', { params }),
  create: (data: any) => api.post('/meetings', data),
  update: (id: string, data: any) => api.put(`/meetings/${id}`, data),
  setStatus: (id: string, status: string) => api.patch(`/meetings/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/meetings/${id}`),
};

// ── DOCUMENTS ────────────────────────────────────────────────
export const documentsApi = {
  list: (params?: any) => api.get('/documents', { params }),
  upload: (formData: FormData) =>
    api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ── NOTIFICATIONS ────────────────────────────────────────────
export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api.get('/notifications', { params: unreadOnly ? { unread: 'true' } : {} }),
  count: () => api.get('/notifications/count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

// ── SEARCH ───────────────────────────────────────────────────
export const searchApi = {
  global: (q: string) => api.get('/search', { params: { q } }),
};

// ── REPORTS ──────────────────────────────────────────────────
export const reportsApi = {
  dashboard: (from?: string, to?: string) => api.get('/reports/dashboard', { params: { from, to } }),
  revenue: (params?: any) => api.get('/reports/revenue', { params }),
  agents: (params?: any) => api.get('/reports/agents', { params }),
  bookings: () => api.get('/reports/bookings'),
  // v17: haqiqiy .xlsx va .pdf fayl yuklab olish (blob)
  exportXlsx: (type: string, from?: string, to?: string) =>
    api.get('/reports/export-xlsx', { params: { type, from, to }, responseType: 'blob' }),
  exportPdf: (type: string, from?: string, to?: string) =>
    api.get('/reports/export-pdf', { params: { type, from, to }, responseType: 'blob' }),
};

// ── REPORTS v6 ───────────────────────────────────────────────
export const reportsV6 = {
  bySource: () => api.get('/reports/by-source'),
  byDestination: (params?: any) => api.get('/reports/by-destination', { params }),
  funnel: () => api.get('/reports/conversion-funnel'),
  revenueChart: (period: 'day' | 'month' = 'month') => api.get('/reports/revenue-chart', { params: { period } }),
  byPaymentMethod: () => api.get('/reports/by-payment-method'),
  // v7: Agent shaxsiy stats
  myStats: (from?: string, to?: string) => api.get('/reports/my-stats', { params: { from, to } }),
  calendar: (params: { date?: string; from?: string; to?: string }) => api.get('/reports/calendar', { params }),
  // v10.2: Oylik kalendar eventlari (parvoz, viza, to'lov muddati, vazifa)
  calendarMonth: (year: number, month: number) => api.get('/reports/calendar-month', { params: { year, month } }),
  // v10.3: Agentlar oyma-oy tarixi
  agentsMonthly: (months = 6, agentId?: string) => api.get('/reports/agents-monthly', { params: { months, agentId } }),
};

// ── OWNER ────────────────────────────────────────────────────
export const whatsappApi = {
  getConfig: () => api.get('/whatsapp/config'),
  saveConfig: (data: any) => api.patch('/whatsapp/config', data),
  getStatus: () => api.get('/whatsapp/status'),
  send: (data: { to: string; message: string; mediaUrl?: string }) => api.post('/whatsapp/send', data),
  sendBookingConfirmation: (data: any) => api.post('/whatsapp/send/booking-confirmation', data),
  sendPaymentReminder: (data: any) => api.post('/whatsapp/send/payment-reminder', data),
};

export const ownerApi = {
  stats: () => api.get('/owner/stats'),
  leaderboard: () => api.get('/owner/leaderboard'),
  companies: () => api.get('/owner/companies'),
  createCompany: (data: any) => api.post('/owner/companies', data),
  setStatus: (id: string, status: string) => api.patch(`/owner/companies/${id}/status`, { status }),
  // v26: kompaniyaga AI (transkripsiya + tahlil) xizmatini yoqish/o'chirish
  setAi: (id: string, aiEnabled: boolean) => api.patch(`/owner/companies/${id}/ai`, { aiEnabled }),
  // v27: Kompaniyani TO'LIQ o'chirish — barcha xodimlar, klientlar, bookinglar,
  // to'lovlar va boshqa bog'liq ma'lumotlar bazadan butunlay o'chadi (cascade).
  // Bu amalni ORQAGA QAYTARIB BO'LMAYDI — frontend'da nom yozib tasdiqlanadi.
  deleteCompany: (id: string) => api.delete(`/owner/companies/${id}`),
  // v7: Oxirgi 50 ta login urinishlari
  recentLogins: (limit = 50) => api.get('/owner/recent-logins', { params: { limit } }),
  // v37: Ovozni-matnga o'girish (STT) uchun asosiy provayder — Groq (arzon) yoki OpenAI
  getSttProvider: () => api.get('/owner/stt-provider'),
  setSttProvider: (provider: 'groq' | 'openai') => api.patch('/owner/stt-provider', { provider }),
};

// ── API KEYS ─────────────────────────────────────────────────
export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (name: string) => api.post('/api-keys', { name }),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
};

// ── AUDIT ────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { entity?: string; action?: string; userId?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get('/audit', { params }),
  // v17: filtr dropdown'lari uchun mavjud entity/action turlari
  filterOptions: () => api.get('/audit/filter-options'),
};

// ── CALLS v6 ─────────────────────────────────────────────────
export const callsApi = {
  list: (params?: { clientId?: string; agentId?: string; limit?: number; page?: number; from?: string; to?: string }) =>
    api.get('/calls', { params }),
  active: () => api.get('/calls/active'),
  stats: () => api.get('/calls/stats'),
  initiate: (data: { toPhone: string; clientId?: string; bookingId?: string }) =>
    api.post('/calls/initiate', data),
  hangup: (id: string) => api.post(`/calls/${id}/hangup`),
  addNote: (id: string, notes: string) => api.post(`/calls/${id}/note`, { notes }),
  log: (data: any) => api.post('/calls/log', data),
  // v12.3: telefoniya ulanishini tekshirish (OnlinePBX auth.json)
  testConnection: () => api.post('/calls/test-connection'),
  // v15: AI qo'ng'iroq tahlili — xulosa, e'tirozlar, keyingi qadam, agent bahosi
  setTranscript: (id: string, transcript: string) => api.post(`/calls/${id}/transcript`, { transcript }),
  analyze: (id: string) => api.post(`/calls/${id}/analyze`),
  // v18: AI tahlil xato bergan bo'lsa (masalan sozlama yo'q edi, keyin tuzatildi) — qayta urinish
  retryAi: (id: string) => api.post(`/calls/${id}/retry-ai`),
  objectionsStats: (days = 30, agentId?: string) => api.get('/calls/objections-stats', { params: { days, agentId } }),
};

// v40: AI Yordamchi ("Jarvis") — erkin suhbat, CRM ma'lumotini tool-use orqali o'zi so'rab oladi (1-bosqich: read-only)
export const aiAssistantApi = {
  chat: (data: { conversationId?: string; message: string }) => api.post('/ai-assistant/chat', data),
  // v43: mikrofon tugmasi — ovozli xabarni (Blob) yuboradi, backend Whisper
  // orqali matnga o'girib, xuddi yozma xabar kabi Jarvis'ga yuboradi
  voiceChat: (audioBlob: Blob, conversationId?: string) => {
    const form = new FormData();
    form.append('audio', audioBlob, 'voice.webm');
    if (conversationId) form.append('conversationId', conversationId);
    return api.post('/ai-assistant/voice-chat', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  conversations: () => api.get('/ai-assistant/conversations'),
  messages: (conversationId: string) => api.get(`/ai-assistant/conversations/${conversationId}`),
  deleteConversation: (conversationId: string) => api.delete(`/ai-assistant/conversations/${conversationId}`),
};

// v41: Jarvis Bot — har bir tenant uchun bitta ICHKI Telegram bot
// (qo'ng'iroq tahlili + kunlik brifing push, faqat admin savol-javob)
export const jarvisBotApi = {
  status: () => api.get('/jarvis-bot/status'),
  connect: (token: string) => api.post('/jarvis-bot/connect', { token }),
  disconnect: () => api.post('/jarvis-bot/disconnect'),
  updateSettings: (data: { notifyAdminOnAnalysis?: boolean; dailyDigestEnabled?: boolean; dailyDigestHour?: number }) =>
    api.patch('/jarvis-bot/settings', data),
  linkCode: () => api.post('/jarvis-bot/link-code'),
  unlink: (userId: string) => api.delete(`/jarvis-bot/links/${userId}`),
};

// ── AI MARKETING (Reklama generatori — TurMaker-uslubida) ────
export const aiMarketingApi = {
  // 1-bosqich: rasm + 3 ta tayyor post (Instagram/Telegram/Facebook)
  generate: (data: any) => api.post('/ai-marketing/generate', data),
  // Faqat rasm qidirish (natijani almashtirish uchun). `hotelName` berilsa,
  // agentlik shu mehmonxona uchun avval yuklagan (haqiqiy) suratlar ham
  // stok-fotodan OLDIN qo'shib qaytariladi.
  images: (query: string, count?: number, hotelName?: string) =>
    api.post('/ai-marketing/images', { query, count, hotelName }),
  // Mashhur yo'nalishlar (davlat → joylar) — tanlagich uchun
  destinations: () => api.get('/ai-marketing/destinations'),
  // 2-bosqich: tayyor banner (PNG) — kvadrat yoki Story o'lchamida
  banner: (data: any) => api.post('/ai-marketing/banner', data),
  // Shablon (agentlik nomi, kontakt, brend rangi)
  getTemplate: () => api.get('/ai-marketing/template'),
  saveTemplate: (data: any) => api.patch('/ai-marketing/template', data),
  // Brend logotipi — yuklansa har bir bannerga avtomatik qo'yiladi
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/ai-marketing/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  removeLogo: () => api.delete('/ai-marketing/logo'),
  // Mehmonxona rasm kutubxonasi — agentlikning o'zi yuklagan haqiqiy suratlar
  getHotelPhotos: (hotelName: string) =>
    api.get('/ai-marketing/hotel-photos', { params: { hotelName } }),
  uploadHotelPhoto: (hotelName: string, file: File) => {
    const form = new FormData();
    form.append('hotelName', hotelName);
    form.append('file', file);
    return api.post('/ai-marketing/hotel-photos', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteHotelPhoto: (hotelName: string, url: string) =>
    api.delete('/ai-marketing/hotel-photos', { data: { hotelName, url } }),
  // Telegram kanaliga yuborish
  sendTelegram: (data: { chatId: string; photoUrl: string; caption: string; telegramAccountId?: string }) =>
    api.post('/ai-marketing/send/telegram', data),
  // Instagram — hozircha qo'lda joylash uchun tayyorlaydi (avtomatik emas)
  instagramPrepare: (data: { caption: string; bannerUrl: string }) =>
    api.post('/ai-marketing/instagram/prepare', data),
  // Telegram xabar andozasi (fixed-format shablon) — tur ma'lumotlari bilan to'ldirib ko'rsatadi
  renderTelegramTemplate: (data: any) => api.post('/ai-marketing/telegram/render-template', data),
  // Facebook sahifasiga (Page) avtomatik joylash
  sendFacebook: (data: { photoUrl: string; caption: string }) =>
    api.post('/ai-marketing/send/facebook', data),
  // Tarix — saqlash / ro'yxat / bitta yozuv / o'chirish
  saveHistory: (data: { input: any; bannerUrl?: string; images?: string[]; posts?: any }) =>
    api.post('/ai-marketing/history', data),
  listHistory: () => api.get('/ai-marketing/history'),
  getHistoryItem: (id: string) => api.get(`/ai-marketing/history/${id}`),
  deleteHistoryItem: (id: string) => api.delete(`/ai-marketing/history/${id}`),
};

// ── UPLOADS v6 ───────────────────────────────────────────────
export const uploadsApi = {
  one: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  batch: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post('/uploads/batch', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── TELEGRAM v6 — media, template, invoice ───────────────────
export const telegramV6 = {
  sendMedia: (convId: string, data: any) => api.post(`/telegram/conversations/${convId}/media`, data),
  sendTemplate: (convId: string, templateId: string) => api.post(`/telegram/conversations/${convId}/template/${templateId}`),
  sendInvoice: (convId: string, data: any) => api.post(`/telegram/conversations/${convId}/send-invoice`, data),
  updateTemplate: (id: string, data: any) => api.patch(`/telegram/templates/${id}`, data),
  templatesByCategory: (category: string) => api.get('/telegram/templates', { params: { category } }),
};

// ═══════════════════════════════════════════════════════════
// v8: YANGI ENDPOINTLAR
// ═══════════════════════════════════════════════════════════

export const v8Api = {
  // Duplicate Detection
  checkDuplicate: (params: { phone?: string; email?: string; telegramUsername?: string }) =>
    api.get('/v8/clients/check-duplicate', { params }),

  // Lead Assignment
  reassignClient: (clientId: string, agentId: string | null) =>
    api.patch(`/v8/clients/${clientId}/reassign`, { agentId }),

  // Bulk Actions
  bulkAssign: (ids: string[], agentId: string | null) =>
    api.post('/v8/clients/bulk/assign', { ids, agentId }),
  bulkStage: (ids: string[], stage: string) =>
    api.post('/v8/clients/bulk/stage', { ids, stage }),
  bulkTag: (ids: string[], tag: string) =>
    api.post('/v8/clients/bulk/tag', { ids, tag }),
  bulkDelete: (ids: string[]) =>
    api.post('/v8/clients/bulk/delete', { ids }),

  // Saved Filters
  listSavedFilters: (resource?: string) =>
    api.get('/v8/saved-filters', { params: { resource } }),
  createSavedFilter: (data: { name: string; resource: string; filters: any; isPinned?: boolean }) =>
    api.post('/v8/saved-filters', data),
  deleteSavedFilter: (id: string) =>
    api.delete(`/v8/saved-filters/${id}`),

  // Booking Checklist
  getChecklist: (bookingId: string) =>
    api.get(`/v8/bookings/${bookingId}/checklist`),
  toggleChecklistItem: (itemId: string, isDone: boolean) =>
    api.patch(`/v8/checklist/${itemId}`, { isDone }),
  addChecklistItem: (bookingId: string, item: string) =>
    api.post(`/v8/bookings/${bookingId}/checklist`, { item }),
  deleteChecklistItem: (itemId: string) =>
    api.delete(`/v8/checklist/${itemId}`),

  // Commissions
  listCommissions: () => api.get('/v8/commissions'),
  createCommission: (bookingId: string) =>
    api.post(`/v8/bookings/${bookingId}/commission`),
  markCommissionPaid: (id: string) =>
    api.patch(`/v8/commissions/${id}/paid`),

  // Client 360
  getClient360: (clientId: string) =>
    api.get(`/v8/clients/${clientId}/full`),
};

// ═══════════════════════════════════════════════════════════
// v8 YANGI: Team, Salary, Custom Stages, Telegram new conversation
// ═══════════════════════════════════════════════════════════

export const teamApi = {
  // Jamoa ro'yxati (admin uchun) - barcha agentlar stats bilan
  team: () => api.get('/users/team'),
  // Eski usersApi.list ham bor (oddiy list)
};

export const salaryApi = {
  mySalary: (month = 0) => api.get('/reports/my-salary', { params: { month } }),
  agentSalaries: (month = 0) => api.get('/reports/agent-salaries', { params: { month } }),
};

export const stagesApi = {
  list: () => api.get('/pipeline/stages'),
  create: (data: { name: string; color?: string; isClosing?: boolean }) =>
    api.post('/pipeline/stages', data),
  update: (id: string, data: any) => api.patch(`/pipeline/stages/${id}`, data),
  delete: (id: string) => api.delete(`/pipeline/stages/${id}`),
  reorder: (ids: string[]) => api.post('/pipeline/stages/reorder', { ids }),
};

// v8: Telegram agent shaxsiy bot + yangi suhbat
export const telegramV8 = {
  connectPersonal: (token: string, name?: string) =>
    api.post('/telegram/accounts/personal', { token, name }),
  startNewConversation: (data: {
    chatId?: string;
    username?: string;
    text: string;
    clientId?: string;
    accountId?: string;
  }) => api.post('/telegram/conversations/new', data),
};

// ═══════════════════════════════════════════════════════════
// v9: PREMIUM YANGI FUNKSIYALAR
// ═══════════════════════════════════════════════════════════

// 👨‍👩‍👧 Passenger Management
export const passengersApi = {
  list: (bookingId: string) => api.get(`/passengers/booking/${bookingId}`),
  stats: (bookingId: string) => api.get(`/passengers/booking/${bookingId}/stats`),
  create: (bookingId: string, data: any) => api.post(`/passengers/booking/${bookingId}`, data),
  update: (id: string, data: any) => api.patch(`/passengers/${id}`, data),
  delete: (id: string) => api.delete(`/passengers/${id}`),
};

// 🛎 Services (Taxi, Insurance, Visa, etc.)
export const servicesApi = {
  list: (bookingId: string) => api.get(`/services/booking/${bookingId}`),
  total: (bookingId: string) => api.get(`/services/booking/${bookingId}/total`),
  create: (bookingId: string, data: any) => api.post(`/services/booking/${bookingId}`, data),
  update: (id: string, data: any) => api.patch(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
};

// ✅ Approval Workflow
export const approvalsApi = {
  list: (params?: { status?: string; type?: string; mine?: string }) =>
    api.get('/approvals', { params }),
  one: (id: string) => api.get(`/approvals/${id}`),
  create: (data: {
    type: string;
    entityType: string;
    entityId: string;
    title: string;
    reason?: string;
    oldValue?: any;
    newValue?: any;
    amount?: number;
  }) => api.post('/approvals', data),
  approve: (id: string, note?: string) => api.post(`/approvals/${id}/approve`, { note }),
  reject: (id: string, note?: string) => api.post(`/approvals/${id}/reject`, { note }),
  cancel: (id: string) => api.post(`/approvals/${id}/cancel`),
};

// 🎯 Round Robin Lead Assignment
export const leadAssignmentApi = {
  getStrategy: () => api.get('/lead-assignment/strategy'),
  setStrategy: (strategy: 'MANUAL' | 'ROUND_ROBIN' | 'LEAST_BUSY') =>
    api.post('/lead-assignment/strategy', { strategy }),
  queue: () => api.get('/lead-assignment/queue'),
  assignOne: (clientId: string) => api.post(`/lead-assignment/assign/${clientId}`, {}),
  assignUnassigned: () => api.post('/lead-assignment/assign-unassigned', {}),
};

// ⌘K Command Palette
export const commandPaletteApi = {
  search: (q: string) => api.get('/command-palette/search', { params: { q } }),
};

// ═══════════════════════════════════════════════════════════
// v10: Multi-pipeline + Call attempts APIs
// ═══════════════════════════════════════════════════════════

export const pipelinesApi = {
  list: () => api.get('/pipeline/pipelines'),
  create: (data: any) => api.post('/pipeline/pipelines', data),
  update: (id: string, data: any) => api.patch(`/pipeline/pipelines/${id}`, data),
  delete: (id: string) => api.delete(`/pipeline/pipelines/${id}`),
  board: (pipelineId?: string, agentId?: string) =>
    api.get('/pipeline/board', { params: { pipelineId, agentId } }),
  move: (clientId: string, data: any) =>
    api.patch(`/pipeline/client/${clientId}/stage`, data),
  callAttempt: (clientId: string, data: any) =>
    api.post(`/pipeline/call-attempt/${clientId}`, data),
  stagesList: (pipelineId?: string) =>
    api.get('/pipeline/stages', { params: { pipelineId } }),
  // v34: mijoz profilidagi bosqich tanlagichi uchun — shu mijoz tegishli
  // bo'lgan ANIQ pipelineni va uning haqiqiy bosqichlarini qaytaradi.
  clientStages: (clientId: string) =>
    api.get(`/pipeline/client/${clientId}/stages`),
  stageCreate: (data: any) => api.post('/pipeline/stages', data),
  stageUpdate: (id: string, data: any) => api.patch(`/pipeline/stages/${id}`, data),
  stageDelete: (id: string) => api.delete(`/pipeline/stages/${id}`),
  stageReorder: (orderedIds: string[]) =>
    api.post('/pipeline/stages/reorder', { orderedIds }),
};

// ─── User Telegram (Personal Account via MTProto) ────────────────────────────
export const userTelegramApi = {
  // Auth flow
  sendCode: (phone: string, apiId?: number, apiHash?: string) =>
    api.post('/user-telegram/auth/send-code', { phone, apiId, apiHash }),
  verifyCode: (phone: string, code: string, apiId?: number, apiHash?: string) =>
    api.post('/user-telegram/auth/verify-code', { phone, code, apiId, apiHash }),
  verify2FA: (phone: string, password: string, apiId?: number, apiHash?: string) =>
    api.post('/user-telegram/auth/2fa', { phone, password, apiId, apiHash }),
  // Send message (birinchi xabar - /start shart emas! conversationId berilsa, mavjud
  // suhbatga to'g'ri yoziladi va dublikat suhbat yaratilmaydi — backend shuni afzal ko'radi)
  // v17: accountId — 2+ ta shaxsiy account ulangan bo'lsa, YANGI suhbat qaysi
  // accountdan boshlanishini aniq ko'rsatish uchun (odatda kerak emas — agent
  // buni bir marta tanlagach, backend User.preferredTelegramAccountId'dan
  // avtomatik oladi).
  sendMessage: (data: { conversationId?: string; phone?: string; username?: string; userId?: string; text: string; clientId?: string; accountId?: string }) =>
    api.post('/user-telegram/send', data),
  // v14: rasm / fayl / OVOZLI XABAR yuborish (shaxsiy/kompaniya MTProto account orqali).
  // mediaType: 'photo' | 'voice' | 'document' | 'video'
  sendMedia: (data: { conversationId: string; fileUrl: string; caption?: string; mediaType?: string }) =>
    api.post('/user-telegram/send-media', data),
  // Status
  getMyAccount: () => api.get('/user-telegram/me'),
  disconnect: () => api.delete('/user-telegram/me'),
  // v15: mijozning onlayn/oflayn holati (faqat shaxsiy akkaunt orqali,
  // suhbat ochilganda boshlang'ich holatni olish uchun — keyingi
  // o'zgarishlar 'user:online' socket hodisasi orqali jonli keladi)
  getStatus: (conversationId: string) => api.get(`/user-telegram/status/${conversationId}`),

  // ─── v17: Ko'plikdagi shaxsiy accountlar — tanlov ────────────────────────
  // Tenant'dagi barcha FAOL shaxsiy Telegram accountlari (id, name, phoneNumber, isOnline)
  listAccounts: () => api.get('/user-telegram/accounts'),
  // Inbox ochilganda: { accounts, preferredAccountId, needsSelection }
  getPreferredAccount: () => api.get('/user-telegram/preferred-account'),
  // Agent qaysi accountdan foydalanishni tanlaydi — doimiy saqlanadi
  setPreferredAccount: (accountId: string) =>
    api.post('/user-telegram/preferred-account', { accountId }),
};

// ─── Instagram Lead Bot ───────────────────────────────────────────────────────
export const instagramApi = {
  getConfig: () => api.get('/instagram/config'),
  saveConfig: (data: any) => api.post('/instagram/config', data),
  getStats: () => api.get('/instagram/stats'),
  // "Instagram orqali ulash" tugmasi — Facebook Page shart emas, to'g'ridan-to'g'ri
  // instagram.com orqali OAuth (login/parol faqat Instagram sahifasida kiritiladi).
  getOAuthStartUrl: () => api.get('/instagram/oauth/start-url'),
  // "Instagram uzish" tugmasi — ulangan akkauntni to'liq uzadi
  disconnect: () => api.delete('/instagram/config'),
};

// ─── Facebook Lead Ads ──────────────────────────────────────────────────────
export const facebookLeadsApi = {
  getConfig: () => api.get('/facebook-leads/config'),
  saveConfig: (data: any) => api.post('/facebook-leads/config', data),
  getStats: () => api.get('/facebook-leads/stats'),
  listForms: () => api.get('/facebook-leads/forms'),
  // "Facebook orqali ulash" tugmasi (OAuth) — token/ID qo'lda kiritilmaydi
  getOAuthStartUrl: (origin?: 'facebook' | 'instagram') =>
    api.get('/facebook-leads/oauth/start-url', { params: origin ? { origin } : undefined }),
  getPendingPages: () => api.get('/facebook-leads/oauth/pending-pages'),
  selectPage: (pageId: string) => api.post('/facebook-leads/oauth/select-page', { pageId }),
  // "Nega ishlamayapti?" tashxis + xato leadlarni qo'lda tiklash (backend'da
  // bor edi, lekin UI hech qayerdan chaqirmasdi — endi ulanadi)
  diagnose: () => api.get('/facebook-leads/diagnose'),
  listFailed: () => api.get('/facebook-leads/failed'),
  retryAll: () => api.post('/facebook-leads/retry'),
  retryOne: (id: string) => api.post(`/facebook-leads/retry/${id}`),
  runBackfill: () => api.post('/facebook-leads/backfill'),
};

// ─── Turlar bozori (Marketplace) — v12.1 ─────────────────────────────────────
// Operatorlar va turlar HAR BIR KOMPANIYANIKI alohida (tenant-scoped).
// Bron so'rovi bosqichi yo'q — turdan to'g'ridan-to'g'ri booking yaratiladi.
export const marketplaceApi = {
  // Operatorlar (yozish — TENANT_ADMIN va yuqorisi)
  listOperators: (params?: any) => api.get('/marketplace/operators', { params }),
  getOperator: (id: string) => api.get(`/marketplace/operators/${id}`),
  createOperator: (data: any) => api.post('/marketplace/operators', data),
  updateOperator: (id: string, data: any) => api.patch(`/marketplace/operators/${id}`, data),
  deleteOperator: (id: string) => api.delete(`/marketplace/operators/${id}`),

  // Turlarni yuklash
  importTours: (id: string, tours: any[], replaceAll = false) =>
    api.post(`/marketplace/operators/${id}/import`, { tours, replaceAll }),
  syncOperator: (id: string) => api.post(`/marketplace/operators/${id}/sync`),

  // Turlar (barcha rollar ko'radi)
  listTours: (params?: any) => api.get('/marketplace/tours', { params }),
  getTour: (id: string) => api.get(`/marketplace/tours/${id}`),
  getFilters: () => api.get('/marketplace/tours/filters'),

  // To'g'ridan-to'g'ri booking
  bookTour: (tourId: string, data: any) => api.post(`/marketplace/tours/${tourId}/book`, data),

  // ─── Katalog (Sozlamalar → Tur operatorlar, faqat TENANT_ADMIN) ───
  // Operator API manzillari serverda (env) turadi; agentlik faqat
  // o'z login/parolini kiritadi.
  listCatalog: () => api.get('/marketplace/catalog'),
  connectCatalog: (slug: string, data: { login?: string; password: string }) =>
    api.post(`/marketplace/catalog/${slug}/connect`, data),
  disconnectCatalog: (slug: string) =>
    api.post(`/marketplace/catalog/${slug}/disconnect`),
};

// ─── Jonli tur qidiruvi (Tour Search) — v14 ──────────────────────────────────
// MUHIM TUZATISH: `tour-search/page.tsx` bu eksportni chaqirardi, lekin u
// hech qachon mavjud bo'lmagan — shu sababli Vercel build'i har safar
// "no exported member named 'tourSearchApi'" xatosi bilan yiqilardi.
// Backend controller (`/tour-search/*`) allaqachon bor, faqat shu ko'prik
// yo'q edi.
export const tourSearchApi = {
  // Ulangan operatorlar ro'yxati (qidiruv shular ustida ishlaydi)
  operators: () => api.get('/tour-search/operators'),
  // Yo'nalish autocomplete: ?q=Antalya
  suggest: (q: string, slug?: string) =>
    api.get('/tour-search/suggest', { params: { q, slug } }),
  // Jonli qidiruv: { destination, regionId?, checkin, checkout, adults, childrenAges?, currency? }
  search: (data: any) => api.post('/tour-search/search', data),
  // Jonli natijadan booking yaratish: { clientId, result, checkin, checkout, adults?, children?, totalPrice?, supplierCost?, note? }
  book: (data: any) => api.post('/tour-search/book', data),
};