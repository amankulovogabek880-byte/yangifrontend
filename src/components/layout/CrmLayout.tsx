'use client';
import { OmonLogoSvg } from '@/components/OmonLogo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { disconnectSocket } from '@/hooks/useSocket';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';
// v36: `CommandPalette` OLIB TASHLANDI — u `GlobalSearch` bilan BIR XIL
// Ctrl+K tugmasiga bog'langan edi, shuning uchun Ctrl+K bosilganda IKKALASI
// HAM bir vaqtda ochilib qolardi (biri ikkinchisining ustida, ko'rinmas
// holda). Natijada tashqarisiga bosib yopmoqchi bo'lsangiz, faqat tepadagi
// (CommandPalette) yopilardi — ostidagi GlobalSearch esa OCHIQ qolardi va
// "yopilmayapti" bo'lib ko'rinardi. Fayl o'chirilmadi
// (src/components/CommandPalette.tsx joyida turibdi), agar kelajakda kerak
// bo'lsa — boshqa tugma (masalan Ctrl+Shift+K) bilan qayta ulash mumkin.
// import CommandPalette from '@/components/CommandPalette';
import { Avatar } from '@/components/ui';

// ─── Premium SVG Icons ───────────────────────────────────────────
const Icons = {
  Owner: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>
    </svg>
  ),
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Pipeline: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h4v12H3zM10 3h4v18h-4zM17 9h4v9h-4z"/>
    </svg>
  ),
  Clients: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  ),
  Tasks: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Bookings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11 19.79 19.79 0 0 1 1.08 2.18 2 2 0 0 1 3.07.01h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15l.92 1.92z"/>
    </svg>
  ),
  Calls: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11 19.79 19.79 0 0 1 1.08 2.18 2 2 0 0 1 3.07.01h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15l.92 1.92z"/>
      <line x1="15" y1="2" x2="15" y2="6"/><line x1="17" y1="4" x2="13" y2="4"/>
    </svg>
  ),
  Marketplace: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"/><path d="M8 13h8"/>
    </svg>
  ),
  MpRequests: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Sun: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  TourSearch: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  AiMarketing: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5-5 18-4-8-9-5z"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

const NAV = [
  { href: '/owner',     labelKey: 'nav.owner',     label: 'Owner',        Icon: Icons.Owner,     roles: ['PLATFORM_OWNER'] },
  { href: '/dashboard', labelKey: 'nav.dashboard', label: 'Dashboard',    Icon: Icons.Dashboard, roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  { href: '/inbox',     labelKey: 'nav.inbox',     label: 'Inbox',        Icon: Icons.Inbox,     roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  // v29: "Pipeline" — inglizcha atama, ko'p agentlar tushunmaydi. amoCRM'dan
  // kelgan foydalanuvchilar "voronka" so'ziga o'rganib qolgan — shu tanish
  // atamani ishlatamiz, bu yangi mijozlar uchun o'tishni osonlashtiradi.
  { href: '/pipeline',  labelKey: 'nav.pipeline',  label: 'Voronka',     Icon: Icons.Pipeline,  roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  { href: '/clients',   labelKey: 'nav.clients',   label: 'Mijozlar',     Icon: Icons.Clients,   roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  { href: '/tasks',     labelKey: 'nav.tasks',     label: 'Vazifalar',    Icon: Icons.Tasks,     roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  { href: '/bookings',  labelKey: 'nav.bookings',  label: 'Bookinglar',   Icon: Icons.Bookings,  roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  // v46: "Turlar bozori" asosiy menyudan olib tashlandi (kelajakda alohida
  // qayta qo'shiladi — backend/marketplace moduli o'zgarishsiz qoladi,
  // shunchaki menyuda ko'rinmaydi). O'rniga "Qo'ng'iroqlar" sahifasi
  // (avval faqat to'g'ridan-to'g'ri URL orqali ochilardi) asosiy menyuga
  // chiqarildi.
  { href: '/calls',                labelKey: 'nav.calls',         label: "Qo'ng'iroqlar", Icon: Icons.Calls, roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  // v19: AI Marketing — TurMaker-uslubidagi reklama generatori.
  // Tur ma'lumotlaridan avtomatik banner + Instagram/Telegram/Facebook posti yasaydi.
  { href: '/ai-marketing',         labelKey: 'nav.aiMarketing',   label: 'Tur yaratish', Icon: Icons.AiMarketing, roles: ['TENANT_ADMIN','MANAGER','AGENT'] },
  // v18: "Yo'qotilgan leadlar" alohida menyu bandi emas — endi Mijozlar
  // sahifasidagi "Yo'qotilgan mijozlar" tugmasi orqali modal sifatida ochiladi.
  // v29: "Tur qidirish" OLIB TASHLANDI — "Turlar bozori" bilan bir xil vazifani
  // bajarardi (ikkalasi ham tur/operator qidirish), ikkitasi chalkashtirardi.
  // "Sozlamalar" ham asosiy menyudan OLIB TASHLANDI — u allaqachon yuqorida,
  // foydalanuvchi ismini bosganda ochiladigan menyuda bor (pastroqda ko'ring),
  // shu yerda dublikat sifatida turishi shart emas edi.
];

const MOBILE_NAV_KEYS = ['/dashboard', '/clients', '/bookings', '/inbox', '/pipeline'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout, hydrate, hydrated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile && localStorage.getItem('sidebarCollapsed') === '1') setCollapsed(true);
    hydrate();
  }, [hydrate, isMobile]);

  // v33: Mijoz kartochkasi (/clients/{id}) ochilganda chap menyu ekranda
  // ortiqcha joy band qilmasligi uchun avtomatik ravishda ixcham (faqat
  // ikonkalar) holatga o'tadi — foydalanuvchining o'zi tanlagan holatidan
  // qat'i nazar. Boshqa har qanday sahifaga qaytilganda (masalan "← Klientlar"
  // tugmasi bosilganda) menyu foydalanuvchi saqlagan odatiy holatiga qaytadi.
  const isClientDetail = /^\/clients\/[^/]+$/.test(pathname);
  useEffect(() => {
    if (isMobile) return;
    if (isClientDetail) {
      setCollapsed(true);
    } else {
      setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
    }
  }, [pathname, isMobile, isClientDetail]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  // v36: "Sozlamalar/Chiqish" dropdown (userMenu) tashqarisiga bosilganda
  // yopiladi (backdrop orqali), lekin Escape tugmasi ISHLAMAS edi —
  // qidiruv oynasidagi kabi izchillik uchun shu yerga ham qo'shildi.
  useEffect(() => {
    if (!userMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [userMenu]);

  if (!hydrated) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span className="spinner spinner-lg" />
    </div>
  );
  if (!user) return null;

  const role = user.role;
  const visible = NAV.filter(i => i.roles.includes('*') || i.roles.includes(role));
  const mobileVisible = visible.filter(i => MOBILE_NAV_KEYS.includes(i.href));
  const W = collapsed ? 60 : 216;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
  }

  // ─── MOBILE ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Mobile Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', height: 54, gap: 12,
          boxShadow: '0 1px 12px rgba(0,0,0,0.15)',
        }}>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-2)', padding: 4, display: 'flex', alignItems: 'center',
          }}><Icons.Menu /></button>

          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <OmonLogoSvg size={28}/>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: 'var(--fg)' }}>Omon<span style={{ color: '#7ab8d4' }}> CRM</span></span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GlobalSearch />
            <NotificationBell />
            <button onClick={() => setUserMenu(!userMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Avatar name={user.name || '?'} size={30} />
            </button>
          </div>

          {userMenu && (
            <>
              <div onClick={() => setUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', top: 58, right: 10,
                width: 210, background: 'var(--bg-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 14, boxShadow: 'var(--shadow-lg)',
                padding: 6, zIndex: 100,
              }}>
                <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{user.email}</div>
                </div>
                <button onClick={() => { setUserMenu(false); toggleTheme(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />} {theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
                </button>
                <button onClick={() => { setUserMenu(false); router.push('/settings'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.Settings /> Sozlamalar
                </button>
                {(user.role === 'TENANT_ADMIN' || user.role === 'MANAGER') && (
                  <button onClick={() => { setUserMenu(false); router.push('/audit-log'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📜 Audit jurnali
                  </button>
                )}
                {user.role === 'TENANT_ADMIN' && (
                  <button onClick={() => { setUserMenu(false); router.push('/team-permissions'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔐 Xodimlar ruxsatlari
                  </button>
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={() => { disconnectSocket(); logout(); setUserMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.LogOut /> Chiqish
                </button>
              </div>
            </>
          )}
        </header>

        {/* Drawer */}
        {mobileMenuOpen && (
          <>
            <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
            <div style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 248, zIndex: 201,
              background: 'var(--bg-2)',
              borderRight: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '6px 0 32px rgba(0,0,0,0.25)',
              animation: 'slideRight 0.22s ease',
            }}>
              <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <OmonLogoSvg size={32}/>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.3 }}>Omon<span style={{ color: '#7ab8d4' }}> CRM</span></div>
                    {user.tenantName && <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500, marginTop: 1 }}>{user.tenantName}</div>}
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex' }}><Icons.X /></button>
              </div>

              <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
                {visible.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link key={item.href} href={item.href} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px', borderRadius: 11,
                      textDecoration: 'none', marginBottom: 2,
                      background: active ? 'var(--primary-soft)' : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--fg-2)',
                      fontWeight: active ? 700 : 500, fontSize: 14,
                      transition: 'all 0.14s',
                    }}>
                      <item.Icon />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>

              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={user.name || '?'} size={34}/>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg)' }}>{user.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>{user.role?.replace('TENANT_','')}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <main style={{ flex: 1, minWidth: 0, paddingBottom: 68 }}>{children}</main>

        {/* Bottom Nav */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 60, background: 'var(--bg-2)',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}>
          {mobileVisible.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, textDecoration: 'none', flex: 1, padding: '6px 4px',
                color: active ? 'var(--primary)' : 'var(--fg-3)',
                transition: 'color 0.14s',
              }}>
                <item.Icon />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <style>{`@keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: W, flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        scrollbarWidth: 'none',
      }}>

        {/* Logo area */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, marginBottom: 4,
        }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <OmonLogoSvg size={34}/>
            {!collapsed && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.1, color: 'var(--fg)' }}>
                  Omon<span style={{ color: '#7ab8d4' }}> CRM</span>
                </div>
                {user.tenantName && <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 2, fontWeight: 500, letterSpacing: 0.3 }}>{user.tenantName}</div>}
              </div>
            )}
          </Link>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 8px' }} />

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '0 6px' }}>
          {visible.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} title={collapsed ? t(item.labelKey) : undefined} style={{
                display: 'flex', alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: 10, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'var(--primary-soft)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--fg-2)',
                fontWeight: active ? 600 : 450, fontSize: 13,
                transition: 'all 0.14s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}>
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: 3,
                    background: 'var(--primary)',
                  }} />
                )}
                <item.Icon />
                {!collapsed && t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user card — click to collapse/expand */}
        <div style={{ padding: '8px 8px 16px' }}>
          <button onClick={toggle} title={collapsed ? 'Kengaytirish' : 'Qisqartirish'} style={{
            width: '100%', padding: collapsed ? '10px 0' : '10px 12px',
            borderRadius: 10, border: '1px solid var(--border)',
            cursor: 'pointer',
            background: 'var(--bg-3)',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 9, transition: 'all 0.15s',
          }}>
            <Avatar name={user.name || '?'} size={30}/>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{user.role?.replace('TENANT_','')}</div>
              </div>
            )}
            {!collapsed && (
              <span style={{ color: 'var(--fg-3)', flexShrink: 0 }}>
                <Icons.ChevronLeft />
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--bg-glass, rgba(10,13,22,0.88))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 22px', height: 54, gap: 12,
          boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
        }}>
          <GlobalSearch />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Lang switcher */}
            <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
              {(['uz','ru','en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  background: lang === l ? 'var(--bg-2)' : 'transparent',
                  border: 'none', borderRadius: 6, padding: '4px 9px',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                  color: lang === l ? 'var(--primary)' : 'var(--fg-3)',
                  cursor: 'pointer', textTransform: 'uppercase',
                  boxShadow: lang === l ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.14s',
                }}>{l}</button>
              ))}
            </div>

            {/* Theme toggle */}
            <button onClick={toggleTheme} style={{
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
              color: 'var(--fg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.14s',
            }}>
              {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
            </button>

            <NotificationBell />

            {/* User menu */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setUserMenu(!userMenu)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '4px 12px 4px 4px',
                borderRadius: 24, border: '1px solid var(--border)',
                background: 'var(--bg-3)', cursor: 'pointer',
                transition: 'all 0.14s',
              }}>
                <Avatar name={user.name || '?'} size={28} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.2 }}>{user.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>{user.role?.replace('TENANT_','')}</div>
                </div>
              </button>

              {userMenu && (
                <>
                  <div onClick={() => setUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                  <div className="scale-in" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 210, background: 'var(--bg-2)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 14, boxShadow: 'var(--shadow-lg)',
                    padding: 6, zIndex: 100,
                  }}>
                    <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{user.email}</div>
                    </div>
                    <button onClick={() => { setUserMenu(false); toggleTheme(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />} {theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
                    </button>
                    <button onClick={() => { setUserMenu(false); router.push('/settings'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icons.Settings /> Sozlamalar
                    </button>
                    {(user.role === 'TENANT_ADMIN' || user.role === 'MANAGER') && (
                      <button onClick={() => { setUserMenu(false); router.push('/audit-log'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📜 Audit jurnali
                      </button>
                    )}
                    {user.role === 'TENANT_ADMIN' && (
                      <button onClick={() => { setUserMenu(false); router.push('/team-permissions'); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔐 Xodimlar ruxsatlari
                      </button>
                    )}
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button onClick={() => { disconnectSocket(); logout(); setUserMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icons.LogOut /> Chiqish
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}