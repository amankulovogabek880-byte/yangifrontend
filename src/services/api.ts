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
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && typeof window !== 'undefined') {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh ham ishlamadi — sessiya tugagan
      setAccessToken(null);
      if (!window.location.pathname.startsWith('/login') &&
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
  disable2FA: (password: string) => api.post('/auth/2fa/disable', { password }),

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
  stats: () => api.get('/clients/stats'),
  one: (id: string) => api.get(`/clients/${id}`),
  timeline: (id: string) => api.get(`/clients/${id}/timeline`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  addNote: (id: string, note: string) => api.post(`/clients/${id}/notes`, { note }),
  setTier: (id: string, tier: string) => api.patch(`/clients/${id}/tier`, { tier }),
  // v5: Open Chat va Call
  getConversation: (id: string) => api.get(`/clients/${id}/conversation`),
  call: (id: string) => api.post(`/clients/${id}/call`),
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
  // v7: Oxirgi 50 ta login urinishlari
  recentLogins: (limit = 50) => api.get('/owner/recent-logins', { params: { limit } }),
};

// ── API KEYS ─────────────────────────────────────────────────
export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (name: string) => api.post('/api-keys', { name }),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
};

// ── AUDIT ────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }),
};

// ── CALLS v6 ─────────────────────────────────────────────────
export const callsApi = {
  list: (clientId?: string) => api.get('/calls', { params: { clientId } }),
  active: () => api.get('/calls/active'),
  stats: () => api.get('/calls/stats'),
  initiate: (data: { toPhone: string; clientId?: string; bookingId?: string }) =>
    api.post('/calls/initiate', data),
  hangup: (id: string) => api.post(`/calls/${id}/hangup`),
  addNote: (id: string, notes: string) => api.post(`/calls/${id}/note`, { notes }),
  log: (data: any) => api.post('/calls/log', data),
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
  sendMessage: (data: { conversationId?: string; phone?: string; username?: string; userId?: string; text: string; clientId?: string }) =>
    api.post('/user-telegram/send', data),
  // Status
  getMyAccount: () => api.get('/user-telegram/me'),
  disconnect: () => api.delete('/user-telegram/me'),
};

// ─── Instagram Lead Bot ───────────────────────────────────────────────────────
export const instagramApi = {
  getConfig: () => api.get('/instagram/config'),
  saveConfig: (data: any) => api.post('/instagram/config', data),
  getStats: () => api.get('/instagram/stats'),
};