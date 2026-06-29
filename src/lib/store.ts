import { create } from 'zustand';
import { authApi } from '@/services/api';

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

      const { accessToken, refreshToken, user } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      set({ user, loading: false, hydrated: true });
      return { user };
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },
  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, hydrated: true });
      window.location.href = '/login';
    }
  },
  hydrate: async () => {
    if (get().hydrated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data, hydrated: true });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ hydrated: true });
    }
  },
}));
