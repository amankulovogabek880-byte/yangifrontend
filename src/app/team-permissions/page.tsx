'use client';

import { useEffect, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { usersApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

// v17: Moslashtiriladigan ruxsatlar (custom permissions) — TENANT_ADMIN
// har bir xodimga (MANAGER/AGENT/ACCOUNTANT) standart rol ruxsatlaridan
// TASHQARI, qo'shimcha alohida ruxsat bera oladi (masalan, bitta AGENT'ga
// eksport qilish huquqini berish, boshqalarga bermaslik). Faqat SIZNING
// kompaniyangiz xodimlari ko'rinadi — backend `/users` allaqachon
// tenantId bo'yicha izolyatsiya qiladi.

const PERMISSION_DEFS = [
  { key: 'export_data', label: 'Eksport qilish', description: 'Excel/PDF hisobot yuklab olish' },
  { key: 'view_all_clients', label: "Barcha mijozlarni ko'rish", description: "Faqat o'ziga emas, boshqa agentlarning mijozlarini ham ko'rish" },
  { key: 'view_salaries', label: 'Maoshlarni ko\'rish', description: "Boshqa xodimlarning maosh/komissiyasini ko'rish" },
  { key: 'manage_users', label: 'Xodimlarni boshqarish', description: "Yangi xodim qo'shish, tahrirlash, o'chirish" },
  { key: 'view_audit_log', label: 'Audit jurnalini ko\'rish', description: "Tizimdagi barcha o'zgarishlar tarixini ko'rish" },
  { key: 'manage_settings', label: 'Sozlamalarni boshqarish', description: 'Telefoniya, integratsiyalar va boshqa sozlamalarni o\'zgartirish' },
  { key: 'delete_records', label: "Yozuvlarni o'chirish", description: "Mijoz, booking va boshqa yozuvlarni butunlay o'chirish" },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  MANAGER: ['export_data', 'view_all_clients', 'view_salaries', 'view_audit_log'],
  AGENT: [],
  ACCOUNTANT: ['export_data', 'view_salaries'],
};

const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Administrator', MANAGER: 'Menejer', AGENT: 'Agent', ACCOUNTANT: 'Hisobchi',
};

export default function TeamPermissionsPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi.list()
      .then((res: any) => setTeam((res.data || []).filter((u: any) => u.role !== 'TENANT_ADMIN')))
      .catch((e: any) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== 'TENANT_ADMIN') {
    return (
      <CrmLayout>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div>Bu sahifa faqat administrator uchun.</div>
        </div>
      </CrmLayout>
    );
  }

  async function toggle(u: any, key: string, currentValue: boolean) {
    setSaving(true);
    const nextPermissions = { ...(u.permissions || {}), [key]: !currentValue };
    try {
      await usersApi.setPermissions(u.id, nextPermissions);
      setTeam(prev => prev.map(m => m.id === u.id ? { ...m, permissions: nextPermissions } : m));
      toast.success('Ruxsat yangilandi');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  function effectiveValue(u: any, key: string): boolean {
    if (typeof u.permissions?.[key] === 'boolean') return u.permissions[key];
    return (ROLE_DEFAULTS[u.role] || []).includes(key);
  }

  return (
    <CrmLayout>
      <div style={{ padding: isMobile ? '14px 12px' : 24, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🔐 Xodimlar ruxsatlari</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>
          Har bir xodimga standart rol ruxsatlaridan tashqari qo'shimcha (yoki kamroq) huquq belgilashingiz mumkin.
          O'zgarishlar darhol kuchga kiradi.
        </p>

        {loading && <div style={{ color: 'var(--fg-3)' }}>Yuklanmoqda...</div>}

        {!loading && team.length === 0 && (
          <div style={{ color: 'var(--fg-3)' }}>Hozircha xodimlar yo'q.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {team.map((u) => (
            <div key={u.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(openId === u.id ? null : u.id)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-2)', border: 'none', cursor: 'pointer', color: 'var(--fg)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b>{u.name}</b>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', padding: '2px 8px', background: 'var(--bg-3)', borderRadius: 6 }}>{ROLE_LABELS[u.role] || u.role}</span>
                </span>
                <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{openId === u.id ? '▲ Yopish' : '▼ Ruxsatlarni ko\'rish'}</span>
              </button>

              {openId === u.id && (
                <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {PERMISSION_DEFS.map((def) => {
                    const value = effectiveValue(u, def.key);
                    const isDefault = typeof u.permissions?.[def.key] !== 'boolean';
                    return (
                      <label key={def.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={value}
                          disabled={saving}
                          onChange={() => toggle(u, def.key, value)}
                          style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {def.label}
                            {isDefault && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>(standart — {ROLE_LABELS[u.role]} uchun {value ? 'yoqilgan' : "o'chirilgan"})</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{def.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </CrmLayout>
  );
}