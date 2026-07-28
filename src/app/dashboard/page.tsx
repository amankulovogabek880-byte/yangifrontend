'use client';
import KalendarTab from './KalendarTab';
import dynamic from 'next/dynamic';
const OnboardingWizard = dynamic(() => import('@/components/OnboardingWizard'), { ssr: false });
import GettingStartedCard from '@/components/GettingStartedCard';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { Card, Stat, Btn, Empty, Skeleton, Avatar, Badge, StatCard, EmptyState } from '@/components/ui';
import { reportsApi, reportsV6, followUpsApi, bookingsApi, callsApi, api, getAccessToken } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useDialer } from '@/lib/dialer';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { Trophy, DollarSign, TrendingUp, Calendar, Wallet, TrendingUp as TrendUpIc, Users as UsersIc, UserPlus as UserPlusIc, Banknote, CalendarCheck, Percent, Briefcase, PhoneCall, Plus, ClipboardCheck } from 'lucide-react';
import { fmtDate, fmtMoney } from '@/lib/helpers';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Pul summalarini har doim ko'pi bilan 2 xona (tiyin) gacha ko'rsatadi —
// standart toLocaleString() default holatda 3 xonagacha chiqarib yuborishi
// mumkin (masalan $57,374.852), bu funksiya buni oldini oladi.
function money(n: any) {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function ExportButton() {
  const { t } = useI18n();
  const [exporting, setExporting] = React.useState(false);

  async function doExport(type: string) {
    setExporting(true);
    try {
      const token = getAccessToken() || ''; // XAVFSIZLIK TUZATISH: memory'dan
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/v1/reports/export?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error(t('dash.exportError')); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('dash.exportError')); }
    finally { setExporting(false); }
  }

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
      <select
        onChange={e => { if (e.target.value) { doExport(e.target.value); e.target.value = ''; } }}
        defaultValue=""
        disabled={exporting}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', fontSize: 12, cursor: 'pointer' }}
      >
        <option value="" disabled>{exporting ? 'Yuklanmoqda...' : 'Export CSV'}</option>
        <option value="bookings">{t('dash.bookings')}</option>
        <option value="clients">{t('dash.clients')}</option>
        <option value="payments">{t('dash.payments')}</option>
        <option value="calls">{t('dash.calls')}</option>
      </select>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Birinchi kirish - onboarding ko'rsatish
    if (user?.role === 'TENANT_ADMIN') {
      const key = `onboarding_done_${user.tenantId || user.id}`;
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  function completeOnboarding() {
    if (user) {
      const key = `onboarding_done_${user.tenantId || user.id}`;
      localStorage.setItem(key, '1');
    }
    setShowOnboarding(false);
  }
  const { t } = useI18n();
  const { callClient } = useDialer();
  const isAgent = user?.role === 'AGENT';

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  // Date range
  const today = new Date().toISOString().slice(0,10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo,   setDateTo]   = useState(today);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [bySource, setBySource] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [callData, setCallData] = useState<any>(null);
  const [leadData, setLeadData] = useState<any>(null);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useSocket();

  const reload = () => {
    setLoading(true);
    const ps: Promise<any>[] = [
      isAgent
        ? reportsV6.myStats(dateFrom, dateTo).catch(() => ({ data: null }))
        : reportsApi.dashboard(dateFrom, dateTo).catch(() => ({ data: null })),
      reportsV6.revenueChart('month').catch(() => ({ data: [] })),
      followUpsApi.list({ done: 'false', limit: '6' }).catch(() => ({ data: [] })),
    ];
    if (!isAgent) {
      ps.push(reportsApi.agents ? reportsApi.agents({ from: dateFrom, to: dateTo }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }));
    }
    Promise.all(ps).then(([s, rc, fu, ag]) => {
      setStats(s?.data || null);
      setRevenueChart(Array.isArray(rc?.data) ? rc.data : (rc?.data?.data || []));
      const fuArr = Array.isArray(fu?.data) ? fu.data : (fu?.data?.data || []);
      // Backend /followups har qanday bajarilmagan eslatmani (kelajakdagilarini
      // ham) qaytaradi va `limit` parametrini e'tiborga olmaydi — shuning
      // uchun "Bugungi eslatmalar" bo'limida faqat bugungi kunga (yoki undan
      // oldingi, muddati o'tgan) eslatmalarni ko'rsatamiz, kelajakdagilarini
      // filtrlab tashlaymiz.
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const todayOnly = fuArr.filter((f: any) => f?.dueAt && new Date(f.dueAt) <= endOfToday);
      setTodayTasks(todayOnly.slice(0, 6));
      if (ag) setAgentsList(Array.isArray(ag.data) ? ag.data : (ag?.data?.agents || []));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const days = 30;
    api.get('/reports/call-analytics', { params: { days } }).then(r => setCallData(r.data)).catch(() => {});
    if (!isAgent) {
      api.get('/reports/lead-analytics', { params: { days } }).then(r => setLeadData(r.data)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = () => reload();
    socket.on('dashboard:update', onUpdate);
    socket.on('lead:assigned', (data: any) => {
      // Agent yangi lead olganini toast bilan ko'rsatish
      import('react-hot-toast').then(({ default: toast }) => {
        toast.success(`🎯 Yangi lead: ${data.fullName}`, { duration: 5000 });
      });
      onUpdate(); // Dashboardni yangilash
    });
    socket.on('notification:new', (notif: any) => {
      if (notif.type === 'CLIENT_ASSIGNED') {
        onUpdate();
      }
    });
    return () => {
      socket.off('dashboard:update', onUpdate);
      socket.off('lead:assigned');
      socket.off('notification:new');
    };
  }, []);

  // Bir xil manba - booking.totalPrice (agent uchun o'z bookinglar)
  const totalRevenue = stats?.thisMonth?.revenue ?? stats?.revenue?.thisMonth ?? 0;
  const totalCost    = stats?.thisMonth?.cost ?? stats?.cost?.thisMonth ?? 0;
  const totalProfit  = stats?.thisMonth?.profit ?? stats?.profit?.thisMonth ?? 0;
  const netProfit    = stats?.thisMonth?.netProfit ?? stats?.netProfit?.thisMonth ?? 0;

  const tabs = isAgent
    ? [
        { id: 'overview', label: t('dash.overall') },
        { id: 'agents', label: t('dash.myRank') },
        { id: 'calls', label: t('dash.myCalls') },
      ]
    : [
        { id: 'overview', label: t('dash.overall') },
        { id: 'revenue', label: t('dash.finance') },
        { id: 'agents', label: t('dash.agents') },
        { id: 'calls', label: "Qo'ng'iroqlar" },
        { id: 'leads', label: t('dash.leadSources') },
      { id: 'calendar', label: t('dash.calendar') },
      ];

  return (
    <CrmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tab bar */}
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0 }}>
          {/* Tabs + Date range */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', overflowX: 'auto', gap: 4 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '12px 18px', fontSize: 13, fontWeight: 600, border: 'none',
                background: 'none', cursor: 'pointer', flexShrink: 0,
                borderBottom: activeTab === tab.id ? '2px solid #3d7eff' : '2px solid transparent',
                color: activeTab === tab.id ? '#3d7eff' : 'var(--fg-2)', whiteSpace: 'nowrap',
              }}>
                {tab.id === 'overview' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                ) : tab.id === 'revenue' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                ) : tab.id === 'agents' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>
                ) : tab.id === 'calls' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11 19.79 19.79 0 0 1 1.08 2.18 2 2 0 0 1 3.07.01h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 15l.92 1.92z"/></svg>
                ) : tab.id === 'calendar' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                )}
                {tab.label}
              </button>
            ))}
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <ExportButton />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? <Skeleton height={400} /> : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab stats={stats} isAgent={isAgent} revenueChart={revenueChart} todayTasks={todayTasks} totalRevenue={totalRevenue} router={router} tenantId={user?.tenantId} />
              )}
              {activeTab === 'revenue' && !isAgent && (
                <RevenueTab stats={stats} revenueChart={revenueChart} from={dateFrom} to={dateTo} />
              )}
              {activeTab === 'agents' && (
                <AgentsTab agents={agentsList} from={dateFrom} to={dateTo} onDateChange={(f,t)=>{setDateFrom(f);setDateTo(t);}} isAgent={isAgent} />
              )}
              {activeTab === 'calls' && (
                <CallsTab data={callData} isAgent={isAgent} />
              )}
              {activeTab === 'leads' && !isAgent && (
                <LeadsTab data={leadData} from={dateFrom} to={dateTo} />
              )}
              {activeTab === 'calendar' && (
                <KalendarTab calendarApi={reportsV6.calendar} />
              )}
            </>
          )}
        </div>
      </div>
    </CrmLayout>
  );
}

function OverviewTab({ stats, isAgent, revenueChart, todayTasks, totalRevenue, router, tenantId }: any) {
  const { t } = useI18n();
  // Agent salary loaded separately
  const [mySalary, setMySalary] = useState<any>(null);
  useEffect(() => {
    if (isAgent) {
      api.get('/reports/my-salary').then((r: any) => setMySalary(r.data)).catch(() => {});
    }
  }, [isAgent]);

  const conversionRate = stats?.conversion?.rate ?? 0;

  // ── v12 FIX: Komissiya raqamlari BITTA manbadan (my-salary, KPI tier bo'yicha) ──
  // Ilgari "Mening oyligim" SUMMASI tier foizi (masalan 12%) bilan, lekin uning
  // YORLIG'I va "Kompaniyaga" flat foiz (8%) bilan hisoblanib, bir-biriga mos
  // kelmasdi. Endi foiz, oylik va kompaniya ulushi bitta manbadan olinadi va
  // har doim mos keladi:  oylik + kompaniyaga = foyda.
  const kpiPct = mySalary?.myCommissionPercent ?? stats?.salary?.kpiPercent ?? 10;
  const myProfit = mySalary?.profit ?? stats?.thisMonth?.profit ?? stats?.profit?.thisMonth ?? 0;
  const myCommissionAmount = mySalary?.grossSalary ?? Math.round(myProfit * kpiPct / 100);
  const companyProfit = Math.max(0, myProfit - myCommissionAmount);
  const agentTier = mySalary?.appliedTier ?? null;

  // Conversion yorlig'i rate bilan AYNAN bir xil manbadan:
  // booking qilgan mijozlar (conversion.won) / jami mijozlar (conversion.total).
  const wonCount = stats?.conversion?.won ?? stats?.bookings?.total ?? 0;
  const totalLeads = stats?.conversion?.total ?? stats?.leads?.total ?? 0;

  // v10.2: sparkline seriyalari — oylik revenue-chart ma'lumotidan
  const revSeries: number[] = (revenueChart || []).map((d: any) => Number(d.revenue ?? d.total ?? 0));
  const profitSeries: number[] = (revenueChart || []).map((d: any) => Number(d.profit ?? d.netProfit ?? 0));
  const countSeries: number[] = (revenueChart || []).map((d: any) => Number(d.bookings ?? d.count ?? 0));

  const kpis = isAgent ? [
    // v11: "Daromadim"/"Komissiyam" o'rniga — admin dashbordidagi kabi
    // "Jami daromad" va "Operator narxi", so'ng shulardan kelib chiqib
    // hisoblangan "Mening oyligim". Foiz har doim admin Sozlamalarda
    // qo'ygan komissiya foizidan (kpiPct) olinadi — qattiq kodlangan
    // (masalan 8%) qiymat ishlatilmaydi.
    { label: t('dash.totalRevenue'), value: `$${money(stats?.thisMonth?.revenue ?? stats?.revenue?.thisMonth ?? totalRevenue)}`, color: '#10b981', sub: t('dash.bookingPricesTotal'), icon: <DollarSign size={15} />, series: revSeries },
    { label: t('dash.operatorCost'), value: `$${money(stats?.thisMonth?.cost ?? stats?.cost?.thisMonth ?? 0)}`, color: '#ef4444', sub: t('dash.costTotal'), icon: <Banknote size={15} /> },
    { label: t('dash.mySalary'), value: `$${money(myCommissionAmount)}`, color: '#8b5cf6', sub: `${kpiPct}% ${t('dash.ofProfit')}`, icon: <Wallet size={15} />, emphasis: true },
    { label: t('dash.myBookings'), value: stats?.bookings?.thisMonth ?? 0, color: '#3d7eff', sub: `${t('dash.jami')}: ${stats?.bookings?.total ?? 0}`, icon: <CalendarCheck size={15} />, series: countSeries },
    { label: t('dash.conversionRate'), value: `${conversionRate}%`, color: '#f59e0b', sub: `${wonCount} / ${totalLeads} mijoz booking qildi`, icon: <Percent size={15} /> },
    { label: t('dash.myLeads'), value: stats?.leads?.total ?? 0, color: '#06b6d4', sub: `${t('common.thisMonth')}: +${stats?.leads?.thisMonth ?? 0}`, icon: <UserPlusIc size={15} /> },
    { label: t('dash.toCompany'), value: `$${companyProfit > 0 ? money(companyProfit) : 0}`, color: '#94a3b8', sub: '', icon: <Briefcase size={15} /> },
  ] : [
    // Vizual iyerarxiya: "Sof foyda" — eng muhim metrika, kattaroq (emphasis)
    { label: t('dash.netProfit'), value: `$${money(stats?.thisMonth?.netProfit ?? stats?.netProfit?.thisMonth ?? stats?.profit?.thisMonth ?? 0)}`, color: '#8b5cf6', sub: t('dash.revMinusCostSalary'), icon: <TrendUpIc size={16} />, series: profitSeries, emphasis: true },
    { label: t('dash.totalRevenue'), value: `$${money(stats?.thisMonth?.revenue || stats?.revenue?.thisMonth || 0)}`, color: '#10b981', sub: t('dash.bookingPricesTotal'), icon: <DollarSign size={15} />, series: revSeries },
    { label: t('dash.operatorCost'), value: `$${money(stats?.cost?.thisMonth || 0)}`, color: '#ef4444', sub: t('dash.costTotal'), icon: <Banknote size={15} /> },
    { label: t('dash.clients'), value: stats?.clients?.total ?? 0, color: '#3d7eff', icon: <UsersIc size={15} /> },
    { label: t('dash.newLeads'), value: stats?.clients?.newThisMonth ?? 0, color: '#06b6d4', sub: `${t('common.today')}: +${stats?.clients?.newToday ?? 0}`, icon: <UserPlusIc size={15} /> },
    { label: t('dash.bookingsMonth'), value: stats?.bookings?.thisMonth ?? 0, color: '#84cc16', sub: `${t('dash.jami')}: ${stats?.bookings?.total ?? 0}`, icon: <CalendarCheck size={15} />, series: countSeries },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* v29: "Boshlash uchun qadamlar" — faqat admin/manager ko'radi (Telegram/FB
          ulash agentga tegishli sozlama emas). Hammasi bajarilganda o'zi yashiradi. */}
      {!isAgent && (
        <GettingStartedCard
          tenantId={tenantId}
          hasClients={(stats?.leads?.total ?? 0) > 0}
          hasOffers={(stats?.bookings?.total ?? 0) > 0}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {kpis.map((k: any, i) => (
          <StatCard key={i} label={k.label} value={k.value} color={k.color} sub={k.sub}
            icon={k.icon} series={k.series} emphasis={k.emphasis} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <RevenueChart data={revenueChart} />

        <div style={{ padding: '16px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{t('dash.todayReminders')} ({todayTasks.length})</h3>
          {todayTasks.length === 0 ? (
            <div>
              <EmptyState
                icon={<ClipboardCheck size={22} />}
                title={t('dash.noReminderToday')}
                description="Hammasi nazoratda. Tezkor amallardan foydalaning:"
              />
              {/* Tezkor amallar — bo'sh joy o'rniga */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                {[
                  { label: t('dash.newLead'), icon: <UserPlusIc size={14} />, href: '/clients' },
                  { label: t('dash.newBooking'), icon: <Plus size={14} />, href: '/bookings' },
                  { label: "Qo'ng'iroqlar", icon: <PhoneCall size={14} />, href: '/calls' },
                  { label: t('dash.inbox'), icon: <UsersIc size={14} />, href: '/inbox' },
                ].map((qa) => (
                  <button key={qa.label} onClick={() => router.push(qa.href)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
                    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 9,
                    color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>{qa.icon}</span>
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayTasks.map((t: any) => (
                <div key={t.id} onClick={() => router.push(t.clientId ? `/clients/${t.clientId}` : '/followups')}
                  style={{ padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  {t.dueAt && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                    {new Date(t.dueAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueTab({ stats, revenueChart }: any) {
  const { t } = useI18n();
  const items = [
    { label: t('dash.totalRevenue'), value: `$${money(stats?.revenue?.thisMonth || stats?.cost?.totalSales || 0)}`, color: '#10b981' },
    { label: t('dash.operatorCost'), value: `$${money(stats?.cost?.thisMonth || 0)}`, color: '#ef4444', sub: t('dash.costTotal') },

    { label: t('dash.netProfit'), value: `$${money(stats?.netProfit?.thisMonth ?? stats?.profit?.thisMonth ?? 0)}`, color: '#8b5cf6', sub: t('dash.profitMinusSalary') },
    { label: t('dash.conversion'), value: `${stats?.conversion?.rate ?? 0}%`, color: '#06b6d4', sub: t('dash.leadToBooking') },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ padding: '16px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>{it.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: it.color }}>{it.value}</div>
            {it.sub && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>{it.sub}</div>}
          </div>
        ))}
      </div>
      <RevenueChart data={revenueChart} />
    </div>
  );
}

// v10: 1/2/3-o'rin uchun oltin/kumush/bronza doira ichida raqam
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span style={{ fontSize: 12, color: 'var(--fg-3)', width: 24, textAlign: 'center', display: 'inline-block' }}>{rank}</span>;
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: '50%',
      background: RANK_COLORS[rank - 1], color: '#1a1a1a', fontWeight: 800, fontSize: 12,
      flexShrink: 0,
    }}>{rank}</span>
  );
}

function AgentsTab({ agents, isAgent }: any) {
  const { t } = useI18n();
  // v10: Agent bo'lsa — faqat o'zining reyting/oylik kartochkasi ko'rsatiladi,
  // boshqa agentlarning ismi yoki summasi umuman chiqmaydi.
  if (isAgent) return <MySalaryCard />;

  const [salaries, setSalaries] = useState<Record<string, any>>({});
  const [payStatus, setPayStatus] = useState<Record<string, { paid: boolean; note: string; saving: boolean }>>({});

  useEffect(() => {
    if (!agents?.length) return;
    agents.forEach((a: any) => {
      const agentId = a.agent?.id;
      if (!agentId) return;
      api.get('/reports/my-salary', { params: { agentId } })
        .then((r: any) => {
          setSalaries((prev: any) => ({ ...prev, [agentId]: r.data }));
          setPayStatus((prev: any) => ({
            ...prev,
            [agentId]: {
              paid: r.data?.isPaid || false,
              note: r.data?.adminNote || '',
              saving: false,
            },
          }));
        })
        .catch(() => {});
    });
  }, [agents]);

  async function savePay(agentId: string, newPaid?: boolean) {
    const ps = payStatus[agentId];
    if (!ps) return;
    const isPaid = newPaid !== undefined ? newPaid : ps.paid;
    setPayStatus((prev: any) => ({ ...prev, [agentId]: { ...prev[agentId], saving: true } }));
    try {
      await api.post('/reports/mark-salary-paid', {
        agentId,
        isPaid,
        note: ps.note,
      });
      toast.success(isPaid ? 'Tolov belgilandi ✓' : 'Tolov bekor qilindi');
    } catch { toast.error(t('dash.saveFailed')); }
    finally { setPayStatus((prev: any) => ({ ...prev, [agentId]: { ...prev[agentId], saving: false } })); }
  }

  if (!agents || agents.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('dash.noAgentInfo')}</div>
  );

  // v10: Reyting (leaderboard) — sal.grossSalary bo'yicha kamayish tartibida
  const sortedAgents = [...agents].sort((a: any, b: any) => {
    const sa = salaries[a.agent?.id]?.grossSalary || 0;
    const sb = salaries[b.agent?.id]?.grossSalary || 0;
    return sb - sa;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} color="#f59e0b" />
          Agentlar reytingi
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--bg-3)', fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
              {['#', 'Agent', 'Leadlar', 'Bookinglar', 'Conversion', 'Daromad', 'Komissiya %', 'Maosh (oy)', 'Note'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAgents.map((a: any, i: number) => {
              const agentId = a.agent?.id;
              const sal = salaries[agentId] || {};
              const ps = payStatus[agentId] || { paid: false, note: '', saving: false };
              const rank = i + 1;
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <RankBadge rank={rank} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{a.agent?.name || a.name || 'N/A'}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.agent?.role}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {a.leadsInPeriod ?? 0}
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('dash.jami')}: {a.clients ?? 0}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {a.bookingsInPeriod ?? 0}
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('dash.jami')}: {a.bookings ?? 0}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: (a.conversion ?? 0) >= 30 ? '#10b98120' : '#f59e0b20',
                      color: (a.conversion ?? 0) >= 30 ? '#10b981' : '#f59e0b' }}>
                      {a.conversion ?? 0}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>
                    ${money(a.revenue ?? 0)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#f59e0b', fontWeight: 600 }}>
                    {sal.myCommissionPercent != null ? sal.myCommissionPercent + '%' : '-'}
                    {sal.appliedTier && <div style={{ fontSize: 9, color: 'var(--fg-3)' }}>{t('dash.kpiTier')}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#8b5cf6' }}>
                    {sal.grossSalary != null ? ('$' + money(sal.grossSalary)) : '-'}
                  </td>
                  {/* Note */}
                  <td style={{ padding: '10px 12px', minWidth: 160 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <input
                        style={{
                          flex: 1, padding: '4px 8px', borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--fg)', fontSize: 11, outline: 'none',
                        }}
                        value={ps.note}
                        placeholder={t('pl.notePh')}
                        onChange={e => setPayStatus((prev: any) => ({
                          ...prev,
                          [agentId]: { ...ps, note: e.target.value },
                        }))}
                        onBlur={() => savePay(agentId)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* v10.3: Oyma-oy tarix — admin hamma agentni, agent o'zini ko'radi */}
      <AgentMonthlyHistory isAgent={isAgent} agents={agents} />
    </div>
  );
}

// v10: AGENT roli uchun — faqat o'zining reyting/oylik kartochkasi.
// Boshqa agentlarning ismi yoki aniq summasi bu yerda umuman ko'rinmaydi.
function MySalaryCard() {
  const { t } = useI18n();
  const [sal, setSal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/my-salary')
      .then((r: any) => setSal(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('common.loading')}</div>;
  if (!sal) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('dash.notFound')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
      {sal.myRank != null && sal.totalAgents > 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #8b5cf620, #3d7eff20)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Trophy size={28} color="#f59e0b" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Siz jamoada #{sal.myRank}/{sal.totalAgents} o'rindasiz
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('dash.thisMonthResults')}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <SalaryStatCard icon={<DollarSign size={18} />} label="Oylik (bruto)" value={`$${money(sal.grossSalary || 0)}`} color="#8b5cf6" />
        <SalaryStatCard icon={<TrendingUp size={18} />} label="Komissiya" value={`${sal.myCommissionPercent || 0}%`} color="#f59e0b" sub={sal.appliedTier ? 'KPI tier bo\'yicha' : undefined} />
        <SalaryStatCard icon={<Calendar size={18} />} label="Bookinglar" value={sal.bookingsCount || 0} color="#3d7eff" />
        <SalaryStatCard icon={<Wallet size={18} />} label="To'langan" value={`$${money(sal.alreadyPaid || 0)}`} color="#10b981" sub={sal.pending > 0 ? `kutilmoqda: $${money(sal.pending)}` : "to'liq to'landi"} />
      </div>

      <div style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{t('dash.commissionByBookings')}</h3>
        {!sal.breakdown?.length ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('dash.noBookingThisMonth')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sal.breakdown.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.clientName || 'Klient'}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'monospace' }}>{b.bookingRef}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>+${money(b.myShare)}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>foyda ${money(b.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* v10.3: Mening oyma-oy tarixim */}
      <AgentMonthlyHistory isAgent={true} agents={[]} />
    </div>
  );
}

function SalaryStatCard({ icon, label, value, color, sub }: any) {
  return (
    <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color }}>
        {icon}
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function CallsTab({ data, isAgent }: any) {
  const { t } = useI18n();
  if (!data) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('common.loading')}</div>;
  const { summary = {}, byDay = [], byAgent = [] } = data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: t('dash.jami'), value: summary.total || 0, color: '#3d7eff' },
          { label: t('dash.answered'), value: summary.answered || 0, color: '#10b981' },
          { label: t('dash.noAnswer'), value: summary.noAnswer || 0, color: '#ef4444' },
          { label: 'Conversion', value: `${summary.conversionRate || 0}%`, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      {byDay.length > 0 && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{t('dash.daily')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="total" fill="#3d7eff" name="Jami" radius={[3, 3, 0, 0]} />
              <Bar dataKey="answered" fill="#10b981" name="Javob berildi" radius={[3, 3, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* v14.2: admin/manager uchun — har bir agent qancha gaplashgani va
          yozuvlari, alohida-alohida ko'rinadi */}
      {!isAgent && byAgent.length > 0 && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Agentlar bo'yicha (gaplashgan vaqt va yozuvlar)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byAgent.map((a: any) => (
              <AgentCallsRow key={a.agentId} agent={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDurLong(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}s ${m}d`;
  if (m > 0) return `${m}d ${sec}s`;
  return `${sec}s`;
}

function AgentCallsRow({ agent }: any) {
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && calls === null) {
      setLoading(true);
      try {
        const r: any = await callsApi.list({ agentId: agent.agentId === 'unassigned' ? undefined : agent.agentId, limit: 100 });
        setCalls(r.data?.data || []);
      } catch {
        setCalls([]);
      } finally {
        setLoading(false);
      }
    }
  }

  const fmtShortDur = (sec: number) => {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} son`;
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: '#3d7eff18', color: '#3d7eff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
          }}>
            {(agent.agentName || '?').slice(0, 1).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.agentName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
              {agent.totalCalls} qo'ng'iroq · {agent.answered} javob berildi · 🎙️ {agent.recordingsCount} yozuv
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>{fmtDurLong(agent.totalDurationSec)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>jami gaplashgan vaqt</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--bg-3, #fafafa)' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-4)', fontSize: 12 }}>Yuklanmoqda...</div>
          ) : !calls || calls.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-4)', fontSize: 12 }}>Qo'ng'iroq topilmadi</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {calls.map((c: any) => {
                const missed = ['NO_ANSWER', 'MISSED', 'BUSY', 'FAILED'].includes(c.status);
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                    background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 12, color: missed ? '#ef4444' : (c.direction === 'INBOUND' ? '#10b981' : '#3d7eff') }}>
                      {missed ? '✕' : (c.direction === 'INBOUND' ? '↙' : '↗')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.client?.fullName || c.client?.phone || 'Noma\'lum mijoz'}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>
                        {new Date(c.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {c.duration > 0 && <> · ⏱ {fmtShortDur(c.duration)}</>}
                      </div>
                    </div>
                    {c.recordingUrl ? (
                      <audio controls src={c.recordingUrl} style={{ height: 30, maxWidth: 220 }} />
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
                        {missed ? '—' : '⏳ yozuvsiz'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeadsTab({ data, from, to }: any) {
  const { t } = useI18n();
  const [activeSource, setActiveSource] = useState<string>('ALL');
  if (!data) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{t('common.loading')}</div>;
  const { summary = {}, bySource = [] } = data;

  const SRC: Record<string, { icon: string; color: string }> = {
    TELEGRAM:  { icon: '✈️', color: '#3d7eff' },
    INSTAGRAM: { icon: '📷', color: '#ec4899' },
    WHATSAPP:  { icon: '💚', color: '#10b981' },
    WEBSITE:   { icon: '🌐', color: '#8b5cf6' },
    REFERRAL:  { icon: '🤝', color: '#f59e0b' },
    FACEBOOK:  { icon: '📘', color: '#3b82f6' },
    CALL:      { icon: '📞', color: '#06b6d4' },
    OTHER:     { icon: '📋', color: '#94a3b8' },
  };

  // Filter by source
  const filtered = activeSource === 'ALL' ? bySource : bySource.filter((s: any) => s.source === activeSource);
  
  // Sort by revenue desc
  const sorted = [...filtered].sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0));
  
  // Best source
  const best = bySource.reduce((a: any, b: any) => (b.revenue || 0) > (a.revenue || 0) ? b : a, bySource[0] || null);
  
  const totalRevenue = bySource.reduce((s: number, r: any) => s + (r.revenue || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: t('dash.totalLeads'), value: summary.totalLeads || 0, color: '#3d7eff', sub: t('dash.allSourcesSub') },
          { label: t('dash.bookings'), value: summary.totalBookings || 0, color: '#10b981', sub: t('dash.successful') },
          { label: t('dash.avgConversion'), value: `${(summary.avgConversionRate || 0).toFixed(1)}%`, color: '#f59e0b', sub: "o'rtacha" },
          { label: t('dash.totalRevenue'), value: `$${money(totalRevenue)}`, color: '#8b5cf6', sub: "barcha manbadan" },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-5)', marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Best source highlight */}
      {best && (
        <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{SRC[best.source]?.icon || '🏆'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#10b981' }}>🏆 Eng yaxshi manba: {best.source}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              {best.leads} lead · {best.bookings} booking · ${money(best.revenue||0)} daromad · {best.conversionRate?.toFixed(1)}% conversion
            </div>
          </div>
        </div>
      )}

      {/* Source filter chips */}
      {bySource.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveSource('ALL')} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: activeSource === 'ALL' ? '#3d7eff' : 'rgba(255,255,255,0.05)',
            color: activeSource === 'ALL' ? '#fff' : 'var(--fg-3)',
            fontSize: 12, fontWeight: 600,
          }}>Hammasi ({bySource.length})</button>
          {bySource.map((s: any) => (
            <button key={s.source} onClick={() => setActiveSource(s.source === activeSource ? 'ALL' : s.source)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: activeSource === s.source ? (SRC[s.source]?.color || '#6b7194') : 'rgba(255,255,255,0.05)',
              color: activeSource === s.source ? '#fff' : 'var(--fg-3)',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {SRC[s.source]?.icon || '📋'} {s.source}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 ? (
        <div style={{ padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ fontSize: 11, color: 'var(--fg-5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {['Manba', 'Leadlar', 'Bookinglar', 'Conversion', 'Daromad', 'Ulush'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s: any, i: number) => {
                const share = totalRevenue > 0 ? Math.round((s.revenue || 0) / totalRevenue * 100) : 0;
                const isTop = i === 0 && activeSource === 'ALL';
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', background: isTop ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                      <span style={{ marginRight: 8 }}>{SRC[s.source]?.icon || '📋'}</span>
                      <span style={{ color: isTop ? '#10b981' : 'var(--fg)' }}>{s.source}</span>
                      {isTop && <span style={{ marginLeft: 8, fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>TOP</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#3d7eff', fontWeight: 600 }}>{s.leads || 0}</td>
                    <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 600 }}>{s.bookings || 0}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: (s.conversionRate || 0) >= 50 ? 'rgba(16,185,129,0.15)' : (s.conversionRate || 0) >= 20 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.1)',
                        color: (s.conversionRate || 0) >= 50 ? '#10b981' : (s.conversionRate || 0) >= 20 ? '#f59e0b' : '#ef4444',
                      }}>{(s.conversionRate || 0).toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 700 }}>${money(s.revenue || 0)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', borderRadius: 99, background: SRC[s.source]?.color || '#6b7194', width: `${share}%`, transition: 'width 0.4s' }}/>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, minWidth: 30 }}>{share}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-4)', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <div>{t('dash.noData')}</div>
        </div>
      )}
    </div>
  );
}


// ─── DATE RANGE PICKER ────────────────────────────────────────
function DateRangePicker({ from, to, onChange }: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lFrom, setLFrom] = useState(from);
  const [lTo,   setLTo]   = useState(to);

  const presets = [
    { label: "Bu oy",        f: () => { const n = new Date(); return [new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
    { label: "O'tgan oy",   f: () => { const n = new Date(); return [new Date(n.getFullYear(),n.getMonth()-1,1).toISOString().slice(0,10), new Date(n.getFullYear(),n.getMonth(),0).toISOString().slice(0,10)]; } },
    { label: "Bu hafta",     f: () => { const n = new Date(); const d = n.getDay()||7; return [new Date(n.getFullYear(),n.getMonth(),n.getDate()-d+1).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
    { label: "Bu yil",       f: () => { const n = new Date(); return [new Date(n.getFullYear(),0,1).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
    { label: "So'nggi 7 kun", f: () => { const n = new Date(); return [new Date(n.getTime()-6*864e5).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
    { label: "So'nggi 30 kun", f: () => { const n = new Date(); return [new Date(n.getTime()-29*864e5).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
    { label: "So'nggi 90 kun", f: () => { const n = new Date(); return [new Date(n.getTime()-89*864e5).toISOString().slice(0,10), n.toISOString().slice(0,10)]; } },
  ];

  const label = from && to ? `${from.slice(5)} → ${to.slice(5)}` : 'Sana';

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        padding: '7px 14px', borderRadius: 9, border: '1px solid #1e2440',
        background: '#0c0e1a', color: '#c4c9e0', fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }}/>
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
            background: '#0c0e1a', border: '1px solid #2a3258', borderRadius: 14,
            padding: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            minWidth: 320,
          }}>
            {/* Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => {
                  const [f, t] = p.f();
                  onChange(f, t); setOpen(false);
                }} style={{
                  padding: '5px 11px', borderRadius: 20, border: '1px solid #1e2440',
                  background: 'rgba(61,126,255,0.06)', color: '#9aa0c0',
                  fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: 500, transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(61,126,255,0.15)'; e.currentTarget.style.color='#3d7eff'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(61,126,255,0.06)'; e.currentTarget.style.color='#9aa0c0'; }}
                >{p.label}</button>
              ))}
            </div>

            <div style={{ height: 1, background: '#1e2440', marginBottom: 14 }}/>

            {/* Custom range */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#3d4568', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>Dan</div>
                <input type="date" value={lFrom} onChange={e => setLFrom(e.target.value)} style={{
                  width: '100%', padding: '8px 10px', background: '#111420',
                  border: '1px solid #1e2440', borderRadius: 8, color: '#e8eaf2',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
                }}/>
              </div>
              <div style={{ color: '#3d4568', paddingBottom: 10 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#3d4568', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>Gacha</div>
                <input type="date" value={lTo} onChange={e => setLTo(e.target.value)} style={{
                  width: '100%', padding: '8px 10px', background: '#111420',
                  border: '1px solid #1e2440', borderRadius: 8, color: '#e8eaf2',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
                }}/>
              </div>
              <button onClick={() => { onChange(lFrom, lTo); setOpen(false); }} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg,#3d7eff,#a855f7)',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                paddingBottom: 10,
              }}>✓</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PREMIUM REVENUE CHART ──────────────────────────────────────────
function RevenueChart({ data }: { data: any[] }) {
  const { t } = useI18n();
  const [view, setView] = useState<'year' | 'quarter'>('year');
  const months = ['','Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];

  const chartData = data.map((d: any) => ({
    ...d,
    label: d.period
      ? d.period.slice(0,7).replace(/-(\d+)$/, (_: any, m: string) => ' ' + (months[parseInt(m)] || m))
      : d.month
        ? (() => { const parts = d.month.split('-'); return parts[1] ? months[parseInt(parts[1])] + ' ' + parts[0] : d.month; })()
        : (d.label || ''),
    revenue: d.revenue ?? d.amount ?? 0,
    profit: d.profit ?? d.netProfit ?? 0,
  }));

  const displayed = view === 'quarter' ? chartData.slice(-3) : chartData;

  const isEmpty = displayed.length === 0;
  const currentYear = new Date().getFullYear();

  return (
    <div style={{
      padding: '22px 24px',
      background: 'var(--bg-2)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow bg */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,110,245,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', letterSpacing: -0.3 }}>{t('dash.revenueProfit')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3, fontWeight: 500 }}>
            {t('dash.monthlyPerf')} · {currentYear}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#5b8def', display: 'inline-block' }}/>
              <span style={{ fontSize: 11.5, color: 'var(--fg-2)', fontWeight: 500 }}>{t('dash.revenue')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }}/>
              <span style={{ fontSize: 11.5, color: 'var(--fg-2)', fontWeight: 500 }}>{t('dash.profit')}</span>
            </div>
          </div>

          {/* Year / Quarter toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', gap: 2 }}>
            {(['year','quarter'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600,
                background: view === v ? 'var(--bg-4)' : 'transparent',
                color: view === v ? 'var(--fg)' : 'var(--fg-3)',
                transition: 'all 0.14s',
                boxShadow: view === v ? 'var(--shadow-xs)' : 'none',
              }}>
                {v === 'year' ? t('dash.year') : t('dash.quarter')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          Ma'lumot yo'q
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={displayed} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {/* Revenue — ko'k-indigo gradient */}
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#4f72e3" stopOpacity={0.5}/>
                <stop offset="60%"  stopColor="#3d5fc0" stopOpacity={0.25}/>
                <stop offset="100%" stopColor="#1a2a6e" stopOpacity={0.05}/>
              </linearGradient>
              {/* Profit — violet gradient */}
              <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#a855f7" stopOpacity={0.45}/>
                <stop offset="60%"  stopColor="#7c3aed" stopOpacity={0.18}/>
                <stop offset="100%" stopColor="#3b0764" stopOpacity={0.04}/>
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
              horizontal={true}
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--fg-3)', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--fg-3)', fontSize: 10.5, fontWeight: 500 }}
              tickFormatter={(v: any) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
              width={44}
            />

            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--bg-4)',
                border: '1px solid var(--border-strong)',
                borderRadius: 10,
                fontSize: 12,
                padding: '10px 14px',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--fg)', fontWeight: 700, marginBottom: 6, fontSize: 13 }}
              formatter={(v: any, name: string) => [
                `$${money(v)}`,
                name === 'revenue' ? 'Revenue' : 'Profit'
              ]}
            />

            {/* Revenue — ustida */}
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#5b8def"
              strokeWidth={2.2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#5b8def', stroke: '#fff', strokeWidth: 2 }}
            />
            {/* Profit — pastida */}
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#profGrad)"
              dot={false}
              activeDot={{ r: 4.5, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// v10.3: AGENTLAR OYMA-OY TARIXI
// Admin: agent tanlab (yoki hammasi) oxirgi 3/6/12 oy bo'yicha
// leadlar, bookinglar, conversion, daromad va maoshni ko'radi.
// Agent: faqat o'zining tarixini ko'radi (backend cheklaydi).
// ═════════════════════════════════════════════════════════════
function AgentMonthlyHistory({ isAgent, agents }: { isAgent: boolean; agents: any[] }) {
  const { t } = useI18n();
  const [months, setMonths] = useState(6);
  const [agentId, setAgentId] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsV6.agentsMonthly(months, agentId || undefined)
      .then((r: any) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [months, agentId]);

  const MONTH_UZ = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const mLabel = (mk: string) => {
    const [y, m] = mk.split('-');
    return `${MONTH_UZ[parseInt(m) - 1]} ${y}`;
  };

  const list: any[] = data?.agents || [];
  // Admin "Barcha agentlar" rejimida — jami bo'yicha jadval;
  // bitta agent tanlanganda (yoki agent roli) — oyma-oy qatorlar
  const single = isAgent || !!agentId ? list[0] : (list.length === 1 ? list[0] : null);

  return (
    <div style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Calendar size={15} color="#8b5cf6" />
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          {isAgent ? 'Mening oyma-oy natijalarim' : 'Agentlar — oyma-oy tarix'}
        </h3>
        <div style={{ flex: 1 }} />
        {!isAgent && (
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-3)', color: 'var(--fg)', fontSize: 12, outline: 'none', cursor: 'pointer',
          }}>
            <option value="">{t('dash.allAgents')}</option>
            {agents.map((a: any) => (
              <option key={a.agent?.id || a.id} value={a.agent?.id || a.id}>{a.agent?.name || a.name}</option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 2, gap: 2 }}>
          {[3, 6, 12].map((m) => (
            <button key={m} onClick={() => setMonths(m)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 700,
              background: months === m ? 'var(--primary)' : 'transparent',
              color: months === m ? '#fff' : 'var(--fg-3)',
            }}>{m} oy</button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton height={160} />
      ) : !data || list.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('dash.noData')}</div>
      ) : single ? (
        /* ── BITTA AGENT: oyma-oy qatorlar ── */
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--bg-3)', fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
              {['Oy', 'Leadlar', 'Bookinglar', 'Conversion', 'Daromad', 'Foyda', 'Komissiya %', 'Maosh'].map((h) => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...single.rows].reverse().map((r: any) => (
              <tr key={r.month} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 12px', fontWeight: 700 }}>{mLabel(r.month)}</td>
                <td style={{ padding: '9px 12px' }}>{r.leads}</td>
                <td style={{ padding: '9px 12px' }}>{r.bookings}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: r.conversion >= 30 ? '#10b98120' : '#f59e0b20',
                    color: r.conversion >= 30 ? '#10b981' : '#f59e0b' }}>{r.conversion}%</span>
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 700, color: '#10b981' }}>${money(r.revenue)}</td>
                <td style={{ padding: '9px 12px', color: '#f59e0b', fontWeight: 600 }}>${money(r.profit)}</td>
                <td style={{ padding: '9px 12px', color: 'var(--fg-2)' }}>{r.commissionPercent}%</td>
                <td style={{ padding: '9px 12px', fontWeight: 800, color: '#8b5cf6' }}>${money(r.salary)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-3)' }}>
              <td style={{ padding: '9px 12px', fontWeight: 800 }}>{t('dash.totalCaps')}</td>
              <td style={{ padding: '9px 12px', fontWeight: 700 }}>{single.totals.leads}</td>
              <td style={{ padding: '9px 12px', fontWeight: 700 }}>{single.totals.bookings}</td>
              <td style={{ padding: '9px 12px' }} />
              <td style={{ padding: '9px 12px', fontWeight: 800, color: '#10b981' }}>${money(single.totals.revenue)}</td>
              <td style={{ padding: '9px 12px', fontWeight: 700, color: '#f59e0b' }}>${money(single.totals.profit)}</td>
              <td style={{ padding: '9px 12px' }} />
              <td style={{ padding: '9px 12px', fontWeight: 800, color: '#8b5cf6' }}>${money(single.totals.salary)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        /* ── BARCHA AGENTLAR: davr bo'yicha jami ── */
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--bg-3)', fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
              {['Agent', `Leadlar (${months} oy)`, 'Bookinglar', 'Daromad', 'Foyda', 'Maosh (jami)'].map((h) => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...list].sort((a, b) => (b.totals?.salary || 0) - (a.totals?.salary || 0)).map((row: any) => (
              <tr key={row.agent.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setAgentId(row.agent.id)} title={t('dash.clickMonthly')}>
                <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                  {row.agent.name}
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>{row.agent.role} · oyma-oy uchun bosing</div>
                </td>
                <td style={{ padding: '9px 12px' }}>{row.totals.leads}</td>
                <td style={{ padding: '9px 12px' }}>{row.totals.bookings}</td>
                <td style={{ padding: '9px 12px', fontWeight: 700, color: '#10b981' }}>${money(row.totals.revenue)}</td>
                <td style={{ padding: '9px 12px', color: '#f59e0b', fontWeight: 600 }}>${money(row.totals.profit)}</td>
                <td style={{ padding: '9px 12px', fontWeight: 800, color: '#8b5cf6' }}>${money(row.totals.salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}