'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';
import { ownerApi } from '@/services/api';
import { Card, Btn, Empty, Skeleton, Modal, Label, Input, Select, Badge } from '@/components/ui';
import { fmt, fmtDate, errMsg } from '@/lib/helpers';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';

const PLAN_COLORS: Record<string, string> = {
  FREE: 'var(--fg-3)', STARTER: 'var(--primary)', PROFESSIONAL: '#8b5cf6', ENTERPRISE: 'var(--warning)',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--success)', TRIAL: 'var(--primary)', SUSPENDED: 'var(--danger)',
};

export default function OwnerPage() {
  const router = useRouter();
  const { user, logout, hydrate, hydrated } = useAuth();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentLogins, setRecentLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
    if (hydrated && user && user.role !== 'PLATFORM_OWNER') router.replace('/dashboard');
  }, [hydrated, user, router]);

  const load = () => {
    setLoading(true);
    Promise.all([ownerApi.stats(), ownerApi.companies(), ownerApi.leaderboard(), ownerApi.recentLogins(50)])
      .then(([s, c, l, r]: any[]) => {
        setStats(s.data);
        setCompanies(c.data || []);
        setLeaderboard(l.data || []);
        setRecentLogins(r.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user?.role === 'PLATFORM_OWNER') load(); }, [user]);

  async function setStatus(id: string, status: string) {
    try {
      await ownerApi.setStatus(id, status);
      toast.success("O'zgartirildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (!hydrated || !user) return <div style={{ padding: 40, color: 'var(--fg-3)' }}>Yuklanmoqda...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '10px 12px' : '12px 24px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            👑 Omon CRM Platform
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Platform Owner Dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <GlobalSearch />
          <NotificationBell />
          <Btn variant="secondary" size="sm" onClick={logout}>Chiqish</Btn>
        </div>
      </header>

      <main style={{ padding: isMobile ? '14px 12px' : 24, maxWidth: 1400, margin: '0 auto' }}>
        {loading && <Skeleton height={500} />}

        {!loading && stats && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
              <StatCard icon="🏢" label="Kompaniyalar" value={stats.tenants} sub={`${stats.activeTenants} faol`} />
              <StatCard icon="👥" label="Xodimlar" value={stats.users} />
              <StatCard icon="✈" label="Bookinglar" value={stats.bookings} />
              <StatCard icon="💰" label="Jami daromad" value={fmt(stats.totalRevenue)} color="#10b981" />
            </div>

            {/* Companies */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>🏢 Kompaniyalar</h3>
                <Btn size="sm" onClick={() => setShowCreate(true)}>+ Yangi Kompaniya</Btn>
              </div>
              {companies.length === 0 ? <Empty title="Kompaniya yo'q" /> : (
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                  <thead>
                    <tr style={{ color: 'var(--fg-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: 10, textAlign: 'left' }}>Nom</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Plan</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Foydalanuvchilar</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Klientlar</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Bookings</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Yaratilgan</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{c.slug}</div>
                        </td>
                        <td style={{ padding: 10 }}><Badge color={PLAN_COLORS[c.plan]}>{c.plan}</Badge></td>
                        <td style={{ padding: 10 }}>{c._count?.users || 0} / {c.maxUsers}</td>
                        <td style={{ padding: 10 }}>{c._count?.clients || 0}</td>
                        <td style={{ padding: 10 }}>{c._count?.bookings || 0}</td>
                        <td style={{ padding: 10, fontSize: 11, color: 'var(--fg-2)' }}>{fmtDate(c.createdAt)}</td>
                        <td style={{ padding: 10 }}>
                          <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} style={{
                            background: STATUS_COLORS[c.status] + '20', color: STATUS_COLORS[c.status],
                            border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}>
                            <option value="ACTIVE" style={{ background: 'var(--bg-2)' }}>ACTIVE</option>
                            <option value="TRIAL" style={{ background: 'var(--bg-2)' }}>TRIAL</option>
                            <option value="SUSPENDED" style={{ background: 'var(--bg-2)' }}>SUSPENDED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Card>

            {/* Leaderboard */}
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🏆 Eng yaxshi agentlar (Top 10)</h3>
              {leaderboard.length === 0 ? <Empty title="Ma'lumot yo'q" /> : leaderboard.slice(0, 10).map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderBottom: '1px solid var(--border-2)' }}>
                  <span style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{a.tenantName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(a.revenue)}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{a.bookings} booking</div>
                  </div>
                </div>
              ))}
            </Card>

            {/* v7: Recent logins — Owner kim kirayotganini ko'radi */}
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 15 }}>👁 Oxirgi 50 ta kirish</h3>
              {recentLogins.length === 0 ? <Empty title="Hozircha kirish yo'q" /> : (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)' }}>
                      <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', textAlign: 'left' }}>
                        <th style={{ padding: 8 }}>Email</th>
                        <th style={{ padding: 8 }}>Kompaniya</th>
                        <th style={{ padding: 8 }}>IP</th>
                        <th style={{ padding: 8, textAlign: 'center' }}>Holat</th>
                        <th style={{ padding: 8 }}>Sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogins.map((r) => (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                          <td style={{ padding: 8 }}>{r.email}</td>
                          <td style={{ padding: 8, color: 'var(--fg-3)' }}>
                            {r.user?.tenant?.name || '—'}
                          </td>
                          <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 10, color: 'var(--fg-3)' }}>
                            {r.ip || '—'}{r.country && ` (${r.country})`}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {r.success ? (
                              <Badge color="var(--success)">✓ OK</Badge>
                            ) : (
                              <Badge color="var(--danger)">✗ {r.reason || 'Xato'}</Badge>
                            )}
                          </td>
                          <td style={{ padding: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                            {fmtDate(r.createdAt)} {new Date(r.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = 'var(--fg)' }: any) {
  return (
    <Card>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{sub}</div>}
    </Card>
  );
}

function CreateCompanyModal({ onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'STARTER',
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Kompaniya nomi majburiy'); return; }
    if (!form.slug.trim()) { toast.error('Slug majburiy'); return; }
    if (!form.adminName.trim()) { toast.error('Admin ismi majburiy'); return; }
    if (!form.adminEmail.trim()) { toast.error('Admin email majburiy'); return; }
    if (!form.adminPassword || form.adminPassword.length < 8) {
      toast.error("Admin paroli kamida 8 belgi bo'lishi kerak"); return;
    }
    setLoading(true);
    try {
      const res = await ownerApi.createCompany(form);
      toast.success(`✅ Kompaniya yaratildi! Admin: ${form.adminEmail} / Parol: ${form.adminPassword}`);
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="Yangi kompaniya" maxWidth={500}>
      <form onSubmit={submit} className="grid-auto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><Label>Kompaniya nomi *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Slug *</Label><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="my-agency" /></div>
        <div style={{ gridColumn: '1/-1' }}>
          <Label>Tarif</Label>
          <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            <option value="FREE">FREE — 2 xodim, 100 klient</option>
            <option value="STARTER">STARTER — 5 xodim, 500 klient</option>
            <option value="PROFESSIONAL">PROFESSIONAL — 20 xodim, 5000 klient</option>
            <option value="ENTERPRISE">ENTERPRISE — cheksiz</option>
          </Select>
        </div>
        <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 8 }}>Administrator</div>
        </div>
        <div style={{ gridColumn: '1/-1' }}><Label>Admin ismi *</Label><Input required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></div>
        <div><Label>Admin email *</Label><Input required type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></div>
        <div><Label>Admin parol *</Label><Input required type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="kamida 8 belgi" /></div>
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn variant="secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
          <Btn type="submit" loading={loading} style={{ flex: 1 }}>Yaratish</Btn>
        </div>
      </form>
    </Modal>
  );
}