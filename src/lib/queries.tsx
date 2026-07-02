'use client';

/**
 * Tayyor TanStack Query hooklar (v10.1)
 *
 * Sahifalarni asta-sekin shu hooklarga ko'chiring. Namuna:
 *
 *   // ESKI (har sahifada takror):
 *   const [clients, setClients] = useState([]);
 *   const [loading, setLoading] = useState(true);
 *   useEffect(() => { clientsApi.list().then(r => { setClients(r.data.data); setLoading(false); }); }, []);
 *
 *   // YANGI:
 *   const { data, isLoading } = useClients({ page: 1 });
 *
 * Mutation'dan keyin ro'yxat o'zi yangilanadi (invalidateQueries).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clientsApi, bookingsApi, tasksApi, paymentsApi,
  invoicesApi, usersApi, tenantsApi,
} from '@/services/api';

// ── Query keys (bir joyda — typo bo'lmasin) ─────────────────
export const qk = {
  clients: (params?: any) => ['clients', params] as const,
  client: (id: string) => ['clients', id] as const,
  bookings: (params?: any) => ['bookings', params] as const,
  booking: (id: string) => ['bookings', id] as const,
  tasks: (params?: any) => ['tasks', params] as const,
  payments: (params?: any) => ['payments', params] as const,
  invoices: (params?: any) => ['invoices', params] as const,
  users: ['users'] as const,
  tenantSettings: ['tenant-settings'] as const,
};

// ── CLIENTS ─────────────────────────────────────────────────
export function useClients(params?: any) {
  return useQuery({
    queryKey: qk.clients(params),
    queryFn: async () => (await clientsApi.list(params)).data,
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: qk.client(id || ''),
    queryFn: async () => (await clientsApi.one(id as string)).data,
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => clientsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => clientsApi.update(id, data),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: qk.client(vars.id) });
    },
  });
}

// ── BOOKINGS ────────────────────────────────────────────────
export function useBookings(params?: any) {
  return useQuery({
    queryKey: qk.bookings(params),
    queryFn: async () => (await bookingsApi.list(params)).data,
  });
}

export function useBooking(id: string | null) {
  return useQuery({
    queryKey: qk.booking(id || ''),
    queryFn: async () => (await bookingsApi.one(id as string)).data,
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => bookingsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

// ── TASKS ───────────────────────────────────────────────────
export function useTasks(params?: any) {
  return useQuery({
    queryKey: qk.tasks(params),
    queryFn: async () => (await tasksApi.list(params)).data,
  });
}

// ── PAYMENTS / INVOICES ─────────────────────────────────────
export function usePayments(params?: any) {
  return useQuery({
    queryKey: qk.payments(params),
    queryFn: async () => (await paymentsApi.list(params)).data,
  });
}

export function useInvoices(params?: any) {
  return useQuery({
    queryKey: qk.invoices(params),
    queryFn: async () => (await invoicesApi.list(params)).data,
  });
}

// ── USERS / SETTINGS ────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => (await usersApi.list()).data,
    staleTime: 60_000,
  });
}

export function useTenantSettings() {
  return useQuery({
    queryKey: qk.tenantSettings,
    queryFn: async () => (await tenantsApi.getSettings()).data,
    staleTime: 60_000,
  });
}