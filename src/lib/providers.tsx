import { create } from 'zustand';
import { authApi, setAccessToken, refreshAccessToken } from '@/services/api';
import { disconnectSocket } from '@/hooks/useSocket';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName?: string;
  tenantSlug?: string;
  tenantPlan?: string;
  twoFactorEnabled?: boolean;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ user?: User; requires2FA?: boolean }>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

// XAVFSIZLIK TUZATISH (v10.1):
//  - Token'lar ENDI localStorage'ga yozilmaydi.
//  - Access token faqat memory'da (setAccessToken), refresh token esa
//    backend qo'ygan httpOnly cookie'da.
//  - hydrate(): sahifa yangilanganda cookie orqali sessiya tiklanadi.

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  hydrated: false,

  login: async (email, password, twoFactorCode) => {
    set({ loading: true });
    try {
      const res = await authApi.login(email, password, twoFactorCode);

      // 2FA required
      if (res.data?.requires2FA) {
        set({ loading: false });
        return { requires2FA: true };
      }

      const { accessToken, user } = res.data;
      setAccessToken(accessToken); // faqat memory
      set({ user, loading: false, hydrated: true });
      return { user };
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      // Cookie server tomonda o'chiriladi (clearCookie)
      await authApi.logout().catch(() => {});
    } finally {
      setAccessToken(null);
      disconnectSocket();
      // Eski versiyadan qolgan tokenlarni ham tozalaymiz (migratsiya)
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } catch {}
      set({ user: null, hydrated: true });
      window.location.href = '/login';
    }
  },

  hydrate: async () => {
    if (get().hydrated) return;

    // Eski versiyadan qolgan localStorage tokenlarni tozalash (bir martalik migratsiya)
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch {}

    // httpOnly cookie bor bo'lsa — yangi access token olamiz
    const token = await refreshAccessToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data, hydrated: true });
    } catch {
      setAccessToken(null);
      set({ hydrated: true });
    }
  },
}));