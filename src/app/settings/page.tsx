'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { tenantsApi, usersApi, api, callsApi } from '@/services/api';
import TourOperatorsSettings from '@/components/settings/TourOperatorsSettings';
import { Card, Btn, Input, Label, Select, Textarea, Badge, Skeleton, Avatar, Modal } from '@/components/ui';
import { useAuth } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';
import { errMsg } from '@/lib/helpers';
import {
  Settings, PhoneCall, FileText, Key, List, User, Users,
  Target, Bot, ClipboardList, DollarSign, Lock, Building2,
} from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane, FaInstagram, FaFacebookF } from 'react-icons/fa';

const ICON = 15;
const TABS = [
  { id: 'general',     label: 'Umumiy',            icon: <Settings size={ICON} /> },
  { id: 'phone',       label: 'Telefon',           icon: <PhoneCall size={ICON} /> },
  { id: 'operators',   label: 'Tur operatorlar',   icon: <Building2 size={ICON} />, adminOnly: true },
  { id: 'whatsapp',    label: 'WhatsApp',          icon: <FaWhatsapp size={ICON} /> },
  { id: 'telegram',    label: 'Telegram',          icon: <FaTelegramPlane size={ICON} /> },
  { id: 'instagram',   label: 'Instagram',         icon: <FaInstagram size={ICON} />, adminOnly: true },
  { id: 'facebook',    label: 'Facebook Ads',      icon: <FaFacebookF size={ICON} />, adminOnly: true },
  { id: 'templates',   label: 'Shablonlar',        icon: <FileText size={ICON} />, adminOnly: true },
  { id: 'api',         label: 'API Keys',          icon: <Key size={ICON} />, adminOnly: true },
  { id: 'webhooklogs', label: 'Webhook Logs',      icon: <List size={ICON} />, adminOnly: true },
  { id: 'profile',     label: 'Profil',            icon: <User size={ICON} /> },
  { id: 'team',        label: 'Jamoa',             icon: <Users size={ICON} />, adminOnly: true },
  { id: 'leads',       label: 'Lead taqsimlash',   icon: <Target size={ICON} />, adminOnly: true },
  { id: 'autoreply',   label: 'Auto-Reply',        icon: <Bot size={ICON} />, adminOnly: true },
  { id: 'forms',       label: 'Web Forms',         icon: <ClipboardList size={ICON} />, adminOnly: true },
  { id: 'kpi',         label: 'Commission Tiers',  icon: <DollarSign size={ICON} />, adminOnly: true },
  { id: 'security',    label: 'Xavfsizlik',        icon: <Lock size={ICON} /> },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useI18n();
  const [tab, setTab] = useState('general');

  // Facebook OAuth redirect qaytganda (?tab=facebook&fb=success kabi)
  // to'g'ri tab'ni ochib qo'yish uchun
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setTab(t);
  }, []);

  const isAdmin = user?.role === 'TENANT_ADMIN';

  return (
    <CrmLayout>
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>⚙ Sozlamalar</h1>
        <p style={{ color: 'var(--fg-3)', fontSize: 13, margin: 0, marginBottom: 20 }}>
          Profil, kompaniya va integratsiyalarni boshqaring
        </p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', padding: '10px 14px',
              color: tab === t.id ? 'var(--primary)' : 'var(--fg-2)',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t.id ? 600 : 500,
              borderBottom: '2px solid ' + (tab === t.id ? 'var(--primary)' : 'transparent'),
              marginBottom: -1, whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'operators' && (
          <Card>
            <TourOperatorsSettings />
          </Card>
        )}

        {tab === 'general' && (
          <Card>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Umumiy sozlamalar</h3>
            <div style={{ marginBottom: 16 }}>
              <Label>Tema</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => theme !== 'dark' && toggleTheme()}>🌙 Tungi</Btn>
                <Btn variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => theme !== 'light' && toggleTheme()}>☀ Yorug</Btn>
              </div>
            </div>
            <div>
              <Label>Til</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant={lang === 'uz' ? 'primary' : 'secondary'} onClick={() => setLang('uz')}>O'zbek</Btn>
                <Btn variant={lang === 'ru' ? 'primary' : 'secondary'} onClick={() => setLang('ru')}>Русский</Btn>
                <Btn variant={lang === 'en' ? 'primary' : 'secondary'} onClick={() => setLang('en')}>English</Btn>
              </div>
            </div>
          </Card>
        )}

        {tab === 'phone' && <PhoneTab isAdmin={isAdmin} />}
        {tab === 'whatsapp' && <WhatsAppTab />}
        {tab === 'telegram' && <TelegramTab isAdmin={isAdmin} />}
        {tab === 'instagram' && <InstagramTab />}
        {tab === 'facebook' && <FacebookLeadsTab />}   {/* ← YANGI */}

        {tab === 'profile' && <ProfileTab />}

        {tab === 'security' && <SecurityTab />}

        {tab === 'team' && isAdmin && <TeamTab />}
        {tab === 'leads' && isAdmin && <LeadAssignmentTab />}
        {tab === 'autoreply' && isAdmin && <AutoReplyTab />}
        {tab === 'forms' && isAdmin && <FormsTab />}
        {tab === 'kpi' && isAdmin && <KPITab />}
        {tab === 'templates' && isAdmin && <TemplatesTab />}
        {tab === 'api' && isAdmin && <ApiKeysTab />}
        {tab === 'webhooklogs' && isAdmin && <WebhookLogsTab />}
      </div>
    </CrmLayout>
  );
}

// ─── Agent Extensions Card (admin uchun) ─────────────────────────────────────
// `provider`/`config`/`setConfig` — PhoneTab'dan keladi. OnlinePBX uchun
// "Extension (ATS)" ustuni ko'rsatiladi (admin ATS ichki raqamini kiritadi).
// MOIZVONKI uchun bu ustun KERAK EMAS (u extension emas, EMAIL orqali
// ishlaydi) — shuning uchun o'rniga ixtiyoriy "MoiZvonki email" ustuni
// chiqadi, va u CRM'ning o'z email/parol tizimidan farqli — Tenant
// darajasidagi `phoneConfig.moizvonki.employeeEmailMap`ga saqlanadi.
function AgentExtensionsCard({
  provider = 'STUB',
  config,
  setConfig,
}: {
  provider?: string;
  config?: any;
  setConfig?: (c: any) => void;
}) {
  const isMoiZvonki = provider === 'MOIZVONKI';
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [vals, setVals] = useState<Record<string, { callbackPhone: string; extension: string }>>({});
  // MoiZvonki uchun: agentId → moizvonki.ru'dagi email (bo'sh bo'lsa CRM email o'zi ishlatiladi)
  const [mzEmails, setMzEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    usersApi.list()
      .then((r: any) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        const agents = list.filter((u: any) => ['AGENT', 'MANAGER'].includes(u.role));
        setAgents(agents);
        const init: Record<string, { callbackPhone: string; extension: string }> = {};
        const mzInit: Record<string, string> = {};
        const map = config?.moizvonki?.employeeEmailMap || {};
        agents.forEach((a: any) => {
          init[a.id] = { callbackPhone: a.callbackPhone || '', extension: a.extension || '' };
          mzInit[a.id] = map[a.email] || '';
        });
        setVals(init);
        setMzEmails(mzInit);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.moizvonki?.employeeEmailMap]);

  async function saveAgent(agentId: string) {
    setSaving(s => ({ ...s, [agentId]: true }));
    try {
      await usersApi.update(agentId, {
        callbackPhone: vals[agentId]?.callbackPhone || '',
        extension: vals[agentId]?.extension || '',
      });
      toast.success('Saqlandi');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(s => ({ ...s, [agentId]: false }));
    }
  }

  // MoiZvonki email moslashtirishni saqlash — bu Tenant darajasida
  // (phoneConfig.moizvonki.employeeEmailMap), shuning uchun boshqa
  // endpoint (/tenants/phone-provider) orqali, alohida saqlanadi.
  async function saveMoiZvonkiEmail(agentId: string, agentCrmEmail: string) {
    if (!setConfig) return;
    setSaving(s => ({ ...s, [agentId]: true }));
    try {
      const overrideEmail = (mzEmails[agentId] || '').trim();
      const prevMap = config?.moizvonki?.employeeEmailMap || {};
      const nextMap = { ...prevMap };
      if (overrideEmail) nextMap[agentCrmEmail] = overrideEmail;
      else delete nextMap[agentCrmEmail];

      const nextConfig = { ...config, moizvonki: { ...(config?.moizvonki || {}), employeeEmailMap: nextMap } };
      await api.patch('/tenants/phone-provider', { provider: 'MOIZVONKI', config: nextConfig });
      setConfig(nextConfig);
      toast.success('Saqlandi');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(s => ({ ...s, [agentId]: false }));
    }
  }

  function setAgentVal(agentId: string, field: 'callbackPhone' | 'extension', value: string) {
    setVals(v => {
      const prev = v[agentId] || { callbackPhone: '', extension: '' };
      return { ...v, [agentId]: { callbackPhone: prev.callbackPhone, extension: prev.extension, [field]: value } };
    });
  }

  const inp: any = {
    padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
    background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, width: '100%', boxSizing: 'border-box',
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>👥 Agentlar telefon raqamlari</h3>
      {isMoiZvonki ? (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 14px' }}>
          Мои Звонки uchun <b>extension shart emas</b> — u agent Android
          ilovasiga kirgan <b>email</b> orqali ishlaydi. Agar agent
          moizvonki.ru ilovasiga xuddi shu CRM email'i bilan kirgan bo'lsa —
          bu yerda hech narsa qilish shart emas, avtomatik ishlaydi.
          Faqat email'lar FARQLI bo'lsa, pastda moslang.
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 14px' }}>
          Har bir agent uchun OnlinePBX extension va telefon raqamini belgilang.
          Extension — ATS ichki raqam (masalan: 101, 102...).
        </p>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>
      ) : agents.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)' }}>Agentlar topilmadi</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: 10, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase' }}>
            <div>Agent</div>
            {isMoiZvonki ? <div>CRM Email (avtomatik)</div> : <div>Telefon raqami</div>}
            <div>{isMoiZvonki ? "MoiZvonki email (farqli bo'lsa)" : 'Extension (ATS)'}</div>
            <div></div>
          </div>

          {agents.map((a: any) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: 10, padding: '10px 10px', background: 'var(--bg-3)', borderRadius: 10, alignItems: 'center' }}>
              {/* Agent info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #3d7eff, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'white', fontWeight: 700,
                }}>
                  {a.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{a.role === 'MANAGER' ? 'Manager' : 'Agent'}</div>
                </div>
              </div>

              {isMoiZvonki ? (
                <>
                  {/* CRM email — faqat ko'rsatiladi, o'zgartirilmaydi (Profil bo'limidan o'zgaradi) */}
                  <div style={{ fontSize: 13, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.email || '—'}
                  </div>

                  {/* MoiZvonki email override */}
                  <input
                    style={inp}
                    value={mzEmails[a.id] || ''}
                    onChange={e => setMzEmails(v => ({ ...v, [a.id]: e.target.value }))}
                    placeholder={a.email || 'bo\u2019sh = CRM email ishlatiladi'}
                  />

                  {/* Save */}
                  <button
                    onClick={() => saveMoiZvonkiEmail(a.id, a.email)}
                    disabled={saving[a.id]}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: saving[a.id] ? '#94a3b8' : '#3d7eff',
                      color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving[a.id] ? '...' : 'Saqlash'}
                  </button>
                </>
              ) : (
                <>
                  {/* Phone */}
                  <input
                    style={inp}
                    value={vals[a.id]?.callbackPhone || ''}
                    onChange={e => setAgentVal(a.id, 'callbackPhone', e.target.value)}
                    placeholder="+998901234567"
                  />

                  {/* Extension */}
                  <input
                    style={{ ...inp, fontFamily: 'monospace', fontWeight: 700 }}
                    value={vals[a.id]?.extension || ''}
                    onChange={e => setAgentVal(a.id, 'extension', e.target.value)}
                    placeholder="101"
                    maxLength={6}
                  />

                  {/* Save */}
                  <button
                    onClick={() => saveAgent(a.id)}
                    disabled={saving[a.id]}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: saving[a.id] ? '#94a3b8' : '#3d7eff',
                      color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving[a.id] ? '...' : 'Saqlash'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Phone Provider sozlash ───
function PhoneTab({ isAdmin }: { isAdmin: boolean }) {
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('STUB');
  // v12.3: OnlinePBX ulanishini tekshirish natijasi
  const [pbxTest, setPbxTest] = useState<{ loading: boolean; ok: boolean | null; msg: string }>({
    loading: false, ok: null, msg: '',
  });
  const [config, setConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // User Profile (admin only manages agents, not self)
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    if (isAdmin) {
      api.get('/tenants/phone-provider').then((r) => {
        setTenant(r.data);
        setProvider(r.data?.provider || 'STUB');
        setConfig(r.data?.config || {});
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    usersApi.me().then((r) => {
      setMe(r.data);
    }).catch(() => {});
  }, [isAdmin]);

  async function saveProvider() {
    setSaving(true);
    try {
      await api.patch('/tenants/phone-provider', { provider, config });
      toast.success('Saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }



  if (loading) return <Skeleton height={200} />;

  return (
    <>
      {/* Admin: barcha agentlar uchun raqam/extension (yoki MoiZvonki uchun email) boshqaruvi */}
      {isAdmin && <AgentExtensionsCard provider={provider} config={config} setConfig={setConfig} />}

      {isAdmin && (
        <Card>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>🏢 Kompaniya telefon provayderi</h3>

          <Label>Provayder</Label>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ marginBottom: 14 }}>
            <option value="STUB">STUB (simulyatsiya - demo uchun)</option>
            <option value="TEL_LINK">tel: link (bepul, agent telefoni)</option>
            <option value="ONLINEPBX">OnlinePBX.uz (O'zbek raqami + recording)</option>
            <option value="MOIZVONKI">Мои Звонки (arzon, Android telefon orqali)</option>
            <option value="TWILIO">Twilio (xalqaro)</option>
            <option value="CUSTOM_SIP">Shaxsiy server (Asterisk/FreePBX)</option>
          </Select>

          {provider === 'CUSTOM_SIP' && (
            <div style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14 }}>
              <h4 style={{ marginTop: 0, fontSize: 13 }}>🖥️ Shaxsiy server sozlamalari</h4>
              <div style={{ padding: '10px 12px', background: '#f59e0b10', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                <b>Asterisk AMI</b> yoki <b>FreePBX / FusionPBX REST API</b> orqali ishlaydi.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Ulanish turi</Label>
                  <Select
                    value={config.customSip?.restType || 'ami'}
                    onChange={e => setConfig({ ...config, customSip: { ...(config.customSip||{}), restType: e.target.value } })}
                  >
                    <option value="ami">Asterisk AMI (TCP port 5038)</option>
                    <option value="freepbx">FreePBX REST API</option>
                    <option value="fusionpbx">FusionPBX REST API</option>
                    <option value="custom">Custom REST API</option>
                  </Select>
                </div>
                {(config.customSip?.restType || 'ami') === 'ami' ? (<>
                  <div>
                    <Label>AMI Host (server IP)</Label>
                    <Input value={config.customSip?.amiHost||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),amiHost:e.target.value}})} placeholder="192.168.1.100 yoki server.com" />
                  </div>
                  <div>
                    <Label>AMI Port</Label>
                    <Input value={config.customSip?.amiPort||'5038'} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),amiPort:e.target.value}})} placeholder="5038" />
                  </div>
                  <div>
                    <Label>AMI Username</Label>
                    <Input value={config.customSip?.amiUser||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),amiUser:e.target.value}})} placeholder="admin" />
                  </div>
                  <div>
                    <Label>AMI Password</Label>
                    <Input type="text" value={config.customSip?.amiPassword||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),amiPassword:e.target.value}})} placeholder="secret" autoComplete="off" name="sip-ami-password-field" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" />
                  </div>
                  <div>
                    <Label>Asterisk Context</Label>
                    <Input value={config.customSip?.context||'from-internal'} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),context:e.target.value}})} placeholder="from-internal" />
                  </div>
                </>) : (<>
                  <div style={{ gridColumn: '1/-1' }}>
                    <Label>REST API URL</Label>
                    <Input value={config.customSip?.restUrl||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),restUrl:e.target.value}})} placeholder="http://192.168.1.100:80/api" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <Label>API Key / Token</Label>
                    <Input type="text" value={config.customSip?.restKey||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),restKey:e.target.value}})} placeholder="api-key" autoComplete="off" name="sip-rest-key-field" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" />
                  </div>
                </>)}
                <div>
                  <Label>Caller ID (chiquvchi raqam)</Label>
                  <Input value={config.customSip?.callerId||''} onChange={e => setConfig({...config,customSip:{...(config.customSip||{}),callerId:e.target.value}})} placeholder="+998712345678" />
                </div>
              </div>
            </div>
          )}
          {provider === 'ONLINEPBX' && (
            <div style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14 }}>
              <h4 style={{ marginTop: 0, fontSize: 13 }}>OnlinePBX.uz sozlamalari</h4>
              <div style={{ padding: '10px 12px', background: '#3d7eff12', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.8 }}>
                <b>API kalitlarini qayerdan olish:</b><br />
                1. <a href="https://api2.onlinepbx.ru/documentation" target="_blank" style={{color:'#3d7eff'}}>OnlinePBX kabineti</a> → Интеграция → API<br />
                2. <b>Domain:</b> kompaniyangiz.onpbx.ru<br />
                3. <b>API Key:</b> API bo'limidan (bitta kalit yetarli)<br />
                4. <b>Caller ID:</b> sizning raqamingiz (+998712XXXXXX)<br />
                5. Har bir agent uchun: <b>Agentlar jadvali</b>da extension kiriting<br />
                6. Kiritgach <b>"Ulanishni tekshirish"</b> tugmasini bosing
              </div>
              <Label>Domain</Label>
              <Input
                placeholder="kompaniyam.onpbx.ru"
                value={config.onlinepbx?.domain || ''}
                onChange={(e) => setConfig({ ...config, onlinepbx: { ...(config.onlinepbx || {}), domain: e.target.value } })}
                style={{ marginBottom: 10 }}
              />
              <Label>API Key</Label>
              <Input
                placeholder="..."
                value={config.onlinepbx?.apiKey || ''}
                onChange={(e) => setConfig({ ...config, onlinepbx: { ...(config.onlinepbx || {}), apiKey: e.target.value } })}
                style={{ marginBottom: 10 }}
              />
              {/* "API ID" maydoni OLIB TASHLANDI — u eski API 1.0 sozlamasi
                  edi va 2020-yildan buyon ishlamaydi. */}

              <Label>Qo'ng'iroq endpointi (odatda o'zgartirilmaydi)</Label>
              <Input
                placeholder="command/reverse.json"
                value={config.onlinepbx?.originatePath || ''}
                onChange={(e) => setConfig({ ...config, onlinepbx: { ...(config.onlinepbx || {}), originatePath: e.target.value } })}
                style={{ marginBottom: 4 }}
              />
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>
                Bo'sh qoldiring. Faqat qo'ng'iroq qilishda "endpoint qabul qilmadi"
                xatosi chiqsa, OnlinePBX hujjatidagi to'g'ri manzilni kiriting.
              </div>
              <Label>Caller ID (kompaniya raqami)</Label>
              <Input
                placeholder="+998712001234"
                value={config.onlinepbx?.callerId || ''}
                onChange={(e) => setConfig({ ...config, onlinepbx: { ...(config.onlinepbx || {}), callerId: e.target.value } })}
                style={{ marginBottom: 10 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox"
                  checked={config.onlinepbx?.recordingEnabled !== false}
                  onChange={(e) => setConfig({ ...config, onlinepbx: { ...(config.onlinepbx || {}), recordingEnabled: e.target.checked } })}
                />
                <span>Qo'ng'iroqlarni yozib olish (recording)</span>
              </div>
              {/* v12.3: ULANISHNI TEKSHIRISH
                  Faqat auth.json chaqiriladi — u rasmiy hujjatda tasdiqlangan,
                  shuning uchun natijaga ishonish mumkin. */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <Btn
                  variant="secondary"
                  onClick={async () => {
                    setPbxTest({ loading: true, ok: null, msg: '' });
                    try {
                      const r = await callsApi.testConnection();
                      const d = r.data || {};
                      setPbxTest({ loading: false, ok: !!d.success, msg: d.message || '' });
                      if (d.success) toast.success(d.message || 'Ulanish muvaffaqiyatli');
                      else toast.error(d.message || 'Ulanmadi');
                    } catch (e: any) {
                      const m = e?.response?.data?.message || 'Tekshirib bo\'lmadi';
                      setPbxTest({ loading: false, ok: false, msg: m });
                      toast.error(m);
                    }
                  }}
                  loading={pbxTest.loading}
                >
                  🔌 Ulanishni tekshirish
                </Btn>

                {pbxTest.ok !== null && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12,
                    background: pbxTest.ok ? '#10b98118' : '#ef444418',
                    color: pbxTest.ok ? '#10b981' : '#ef4444',
                  }}>
                    {pbxTest.ok ? '✅ ' : '❌ '}{pbxTest.msg}
                  </div>
                )}

                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                  Avval sozlamalarni <b>saqlang</b>, keyin tekshiring.
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '10px 12px', background: '#10b98112', borderRadius: 8, fontSize: 12 }}>
                <b>Webhook URL (OnlinePBX kabinetiga kiriting):</b><br />
                <code style={{ background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                  {window.location.origin}/api/v1/calls/webhook
                </code>
              </div>
            </div>
          )}

          {provider === 'MOIZVONKI' && (
            <div style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14 }}>
              <h4 style={{ marginTop: 0, fontSize: 13 }}>Мои Звонки sozlamalari</h4>
              <div style={{ padding: '10px 12px', background: '#3d7eff12', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.8 }}>
                <b>Qanday ishlaydi:</b> qo'ng'iroqning o'zi agentning shaxsiy Android
                telefoni orqali (mobil tarif bo'yicha) amalga oshadi. CRM faqat
                terishni boshlab beradi va natijani (yozuv+davomiylik) qabul qiladi.<br /><br />
                <b>Sozlash tartibi:</b><br />
                1. <a href="https://www.moizvonki.ru/accounts/create/" target="_blank" style={{color:'#3d7eff'}}>Bepul hisob oching</a> (20 kun, kartasiz)<br />
                2. Har bir agentning Android telefoniga ilova o'rnating va shu hisobga kiritilgan email bilan ro'yxatdan o'tkazing<br />
                3. Shaxsiy kabinet → Sozlamalar → Integratsiya sahifasidagi <b>"API manzili"</b> va <b>"API kaliti"</b>ni pastga kiriting<br />
                4. Pastdagi <b>Webhook URL</b>ni xuddi shu Integratsiya sahifasiga qo'ying<br />
                5. Kiritgach <b>"Ulanishni tekshirish"</b> tugmasini bosing
              </div>
              <Label>Hisob subdomeni</Label>
              <Input
                placeholder="kompaniyam (https://kompaniyam.moizvonki.ru)"
                value={config.moizvonki?.subdomain || ''}
                onChange={(e) => setConfig({ ...config, moizvonki: { ...(config.moizvonki || {}), subdomain: e.target.value } })}
                style={{ marginBottom: 10 }}
              />
              <Label>API kaliti</Label>
              <Input
                type="text"
                placeholder="..."
                value={config.moizvonki?.apiKey || ''}
                onChange={(e) => setConfig({ ...config, moizvonki: { ...(config.moizvonki || {}), apiKey: e.target.value } })}
                style={{ marginBottom: 10 }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name="mz-api-key-field"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
              />
              <Label>Admin email (hisob egasi)</Label>
              <Input
                placeholder="admin@kompaniya.uz"
                value={config.moizvonki?.adminEmail || ''}
                onChange={(e) => setConfig({ ...config, moizvonki: { ...(config.moizvonki || {}), adminEmail: e.target.value } })}
                style={{ marginBottom: 10 }}
                autoComplete="off"
                name="mz-admin-email-field"
                data-lpignore="true"
                data-1p-ignore="true"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox"
                  checked={config.moizvonki?.recordingEnabled !== false}
                  onChange={(e) => setConfig({ ...config, moizvonki: { ...(config.moizvonki || {}), recordingEnabled: e.target.checked } })}
                />
                <span>Qo'ng'iroqlarni yozib olish (Мои Звонки'da "Запись" tarifi kerak — 230₽/qurilma/oy)</span>
              </div>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <Btn
                  variant="secondary"
                  onClick={async () => {
                    setPbxTest({ loading: true, ok: null, msg: '' });
                    try {
                      const r = await callsApi.testConnection();
                      const d = r.data || {};
                      setPbxTest({ loading: false, ok: !!d.success, msg: d.message || '' });
                      if (d.success) toast.success(d.message || 'Ulanish muvaffaqiyatli');
                      else toast.error(d.message || 'Ulanmadi');
                    } catch (e: any) {
                      const m = e?.response?.data?.message || 'Tekshirib bo\'lmadi';
                      setPbxTest({ loading: false, ok: false, msg: m });
                      toast.error(m);
                    }
                  }}
                  loading={pbxTest.loading}
                >
                  🔌 Ulanishni tekshirish
                </Btn>

                {pbxTest.ok !== null && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12,
                    background: pbxTest.ok ? '#10b98118' : '#ef444418',
                    color: pbxTest.ok ? '#10b981' : '#ef4444',
                  }}>
                    {pbxTest.ok ? '✅ ' : '❌ '}{pbxTest.msg}
                  </div>
                )}

                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                  Avval sozlamalarni <b>saqlang</b>, keyin tekshiring. Agar javob
                  "moslik topilmadi" desa — yuqoridagi natijadagi xom server
                  javobini menga yuboring, aniq maydon nomlarini moslashtirib beraman.
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '10px 12px', background: '#10b98112', borderRadius: 8, fontSize: 12 }}>
                <b>Webhook URL (moizvonki.ru → Sozlamalar → Integratsiya sahifasiga qo'ying):</b><br />
                <code style={{ background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11, wordBreak: 'break-all' }}>
                  {window.location.origin}/api/v1/calls/webhook/moizvonki/{me?.tenantId || '{tenantId}'}
                </code>
                {!me?.tenantId && (
                  <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>
                    (Sahifa yuklanayotganda tenantId vaqtincha ko'rinmasligi mumkin — bir necha soniyadan so'ng yangilanadi)
                  </div>
                )}
              </div>
            </div>
          )}

          {provider === 'TWILIO' && (
            <div style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, marginBottom: 14 }}>
              <h4 style={{ marginTop: 0, fontSize: 13 }}>Twilio sozlamalari</h4>
              <Label>Account SID</Label>
              <Input
                value={config.twilio?.accountSid || ''}
                onChange={(e) => setConfig({ ...config, twilio: { ...(config.twilio || {}), accountSid: e.target.value } })}
                style={{ marginBottom: 10 }}
              />
              <Label>Auth Token</Label>
              <Input
                type="text"
                value={config.twilio?.authToken || ''}
                onChange={(e) => setConfig({ ...config, twilio: { ...(config.twilio || {}), authToken: e.target.value } })}
                style={{ marginBottom: 10 }}
                autoComplete="off"
                name="twilio-auth-token-field"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
              />
              <Label>From Number</Label>
              <Input
                placeholder="+1XXXXXXXXXX"
                value={config.twilio?.fromNumber || ''}
                onChange={(e) => setConfig({ ...config, twilio: { ...(config.twilio || {}), fromNumber: e.target.value } })}
              />
            </div>
          )}

          {provider === 'TEL_LINK' && (
            <div style={{ padding: 14, background: 'var(--info-soft)', borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
              ℹ️ <b>tel: link rejimi:</b> Call tugmasi bosilganda agentning brauzerida telefon ilovasi ochiladi.
              Agent o'z mobil telefonidan qo'ng'iroq qiladi. Bepul, server kerak emas.
            </div>
          )}

          {provider === 'STUB' && (
            <div style={{ padding: 14, background: 'var(--warning-soft)', borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
              ⚠ <b>STUB rejimi:</b> Faqat simulyatsiya — haqiqiy qo'ng'iroq qilinmaydi.
              Demo va sotuv ko'rsatish uchun.
            </div>
          )}

          <Btn onClick={saveProvider} loading={saving} variant="gradient">💾 Saqlash</Btn>
        </Card>
      )}
    </>
  );
}

function ProfileTab() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi.me().then((r) => {
      setMe(r.data);
      setName(r.data?.name || '');
      setPhone(r.data?.phone || '');
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await usersApi.updateMe({ name, phone });
      toast.success('Saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  if (loading) return <Skeleton height={200} />;

  return (
    <Card>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>👤 Mening profilim</h3>
      <Label>Ism</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
      <Label>Email</Label>
      <Input value={me?.email || ''} disabled style={{ marginBottom: 12, opacity: 0.6 }} />
      <Label>Telefon</Label>
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" style={{ marginBottom: 16 }} />
      <Btn onClick={save} loading={saving}>Saqlash</Btn>
    </Card>
  );
}

function CompanyTab() {
  return (
    <Card>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>🏢 Kompaniya sozlamalari</h3>
      <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>
        Foydalanuvchilar, rollar va kompaniya ma'lumotlari.
      </p>
      <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>Tez orada qo'shiladi...</p>
    </Card>
  );
}

// ─── v8: TEAM TAB — admin uchun jamoa ko'rinishi ───
function TeamTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const router = useRouter();

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ teamApi }) =>
      teamApi.team()
        .then((r: any) => setMembers(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>👥 Jamoa ({members.length})</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>
              Agentlarni qo'shish, ko'rish va boshqarish
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* 2 tugma: list / grid view */}
            <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 8, padding: 3 }}>
              <button onClick={() => setView('list')} style={{
                background: view === 'list' ? 'var(--bg-2)' : 'transparent',
                border: 'none', borderRadius: 6, padding: '6px 12px',
                color: view === 'list' ? 'var(--primary)' : 'var(--fg-3)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>≡ Ro'yxat</button>
              <button onClick={() => setView('grid')} style={{
                background: view === 'grid' ? 'var(--bg-2)' : 'transparent',
                border: 'none', borderRadius: 6, padding: '6px 12px',
                color: view === 'grid' ? 'var(--primary)' : 'var(--fg-3)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>▦ Kartochka</button>
            </div>
            <Btn variant="gradient" onClick={() => setShowCreate(true)}>+ Agent qo'shish</Btn>
          </div>
        </div>

        {members.length === 0 ? (
          <p style={{ color: 'var(--fg-3)', textAlign: 'center', padding: 30 }}>Jamoada hali odam yo'q</p>
        ) : view === 'list' ? (
          /* ─── LIST VIEW (gorizontal) ─── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Agent</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Amallar</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Holat</th>
                  <th style={{ padding: 10 }}>Rol</th>
                  <th style={{ padding: 10 }}>Telefon</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Leadlar</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Bookinglar</th>
                  <th style={{ padding: 10, textAlign: 'right' }}>Daromad (oy)</th>
                  <th style={{ padding: 10, textAlign: 'right' }}>Foyda (oy)</th>
                  <th style={{ padding: 10, textAlign: 'right' }}>Maoshi (oy)</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => setEditingMember(m)} title="Tahrirlash" style={{
                          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
                          width: 28, height: 28, cursor: 'pointer', color: 'var(--fg-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <TeamMemberDeleteBtn member={m} onDeleted={() => window.location.reload()} />
                      </div>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <Badge color={m.status === 'ACTIVE' ? 'var(--success)' : 'var(--fg-3)'}>
                        {m.status === 'ACTIVE' ? 'Faol' : 'Faol emas'}
                      </Badge>
                    </td>
                    <td style={{ padding: 10 }}>
                      <Badge color={m.role === 'TENANT_ADMIN' ? 'var(--primary)' : m.role === 'MANAGER' ? 'var(--info)' : 'var(--success)'}>
                        {m.role}
                      </Badge>
                    </td>
                    <td style={{ padding: 10, fontSize: 12, color: 'var(--fg-3)' }}>
                      {m.callbackPhone || m.phone || '—'}
                      {m.extension && <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>(#{m.extension})</span>}
                    </td>
                    <td style={{ padding: 10, textAlign: 'center', fontWeight: 600 }}>{m.stats?.leadsTotal || 0}</td>
                    <td style={{ padding: 10, textAlign: 'center', fontWeight: 600 }}>{m.stats?.bookingsTotal || 0}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: 'var(--info)' }}>${m.stats?.monthRevenue || 0}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>${m.stats?.monthProfit || 0}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: 'var(--warning)', fontWeight: 700 }}>${m.stats?.monthSalary || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─── GRID VIEW (vertikal) ─── */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {members.map((m) => (
              <div key={m.id} style={{
                background: 'var(--bg-3)', borderRadius: 12,
                padding: 16, textAlign: 'center',
                border: '1px solid var(--border)',
              }}>
                <Avatar name={m.name} size={56} />
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{m.email}</div>
                <div style={{ marginTop: 8 }}>
                  <Badge color={m.role === 'TENANT_ADMIN' ? 'var(--primary)' : m.role === 'MANAGER' ? 'var(--info)' : 'var(--success)'}>
                    {m.role}
                  </Badge>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8, marginTop: 14, padding: '12px 0',
                  borderTop: '1px solid var(--border-2)',
                  borderBottom: '1px solid var(--border-2)',
                }}>
                  <Mini label="Leads" value={m.stats?.leadsTotal || 0} color="var(--info)" />
                  <Mini label="Bookings" value={m.stats?.bookingsTotal || 0} color="var(--primary)" />
                  <Mini label="Maoshi" value={`$${m.stats?.monthSalary || 0}`} color="var(--warning)" />
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 10 }}>
                  Foyda: <b style={{ color: 'var(--success)' }}>${m.stats?.monthProfit || 0}</b>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                  <Btn size="sm" variant="secondary" onClick={() => setEditingMember(m)}>✏ Tahrirlash</Btn>
                  <TeamMemberDeleteBtn member={m} onDeleted={() => window.location.reload()} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {editingMember && (
        <EditTeamMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); load(); toast.success('Agent ma\'lumotlari yangilandi'); }}
        />
      )}
    </>
  );
}

// ─── Agentni o'chirish tugmasi ─────────────────────────────────────
function TeamMemberDeleteBtn({ member, onDeleted }: any) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      const { usersApi } = await import('@/services/api');
      await usersApi.delete(member.id);
      toast.success("Agent o'chirildi");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={doDelete} disabled={deleting} style={{
          background: 'var(--danger)', border: 'none', borderRadius: 7,
          padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700,
        }}>{deleting ? '...' : "Ha, o'chir"}</button>
        <button onClick={() => setConfirming(false)} style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
          padding: '4px 8px', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 10,
        }}>Yo'q</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} title="O'chirish" style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
      width: 28, height: 28, cursor: 'pointer', color: 'var(--danger)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>
  );
}

// ─── Agentni tahrirlash modali ──────────────────────────────────────
function EditTeamMemberModal({ member, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    callbackPhone: member.callbackPhone || '',
    extension: member.extension || '',
    role: member.role || 'AGENT',
    status: member.status || 'ACTIVE',
    dailyLeadLimit: member.dailyLeadLimit || 0,
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: any) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { toast.error("Ism majburiy"); return; }
    setSaving(true);
    try {
      const { usersApi } = await import('@/services/api');
      await usersApi.update(member.id, form);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 9,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' as const,
  };

  return (
    <Modal open onClose={onClose} title={`✏ ${member.name} — tahrirlash`} maxWidth={460} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} disabled={saving}>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</Btn>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label>To'liq ism *</Label>
          <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Telefon</Label>
            <input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <Label>Qayta qo'ng'iroq raqami</Label>
            <input style={inputStyle} value={form.callbackPhone} onChange={(e) => set('callbackPhone', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>Rol</Label>
            <select style={inputStyle} value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="AGENT">Agent</option>
              <option value="MANAGER">Manager</option>
              <option value="TENANT_ADMIN">Admin</option>
              <option value="ACCOUNTANT">Buxgalter</option>
            </select>
          </div>
          <div>
            <Label>Holat</Label>
            <select style={inputStyle} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Faol</option>
              <option value="INACTIVE">Faol emas</option>
              <option value="LOCKED">Bloklangan</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Kunlik lead limiti (0 = cheksiz)</Label>
          <input type="number" style={inputStyle} value={form.dailyLeadLimit} onChange={(e) => set('dailyLeadLimit', Number(e.target.value))} />
        </div>
      </div>
    </Modal>
  );
}

function Mini({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--fg)' }}>{value}</div>
    </div>
  );
}

function CreateAgentModal({ onClose, onCreated }: any) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'AGENT',
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.name.trim()) { toast.error("To'liq ism majburiy"); return; }
    if (!form.email.trim()) { toast.error("Email majburiy"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      toast.error("Email formati noto'g'ri"); return;
    }
    if (!form.password) { toast.error("Parol majburiy"); return; }
    if (form.password.length < 8) {
      toast.error("Parol kamida 8 belgi bo'lishi kerak"); return;
    }
    setLoading(true);
    try {
      const { usersApi } = await import('@/services/api');
      await usersApi.create(form);
      toast.success(`✅ ${form.name} qo'shildi! Email: ${form.email}, Parol: ${form.password}`);
      onCreated();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="👤 Yangi agent qo'shish" footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={submit} loading={loading}>+ Yaratish</Btn>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <Label>To'liq ism *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aziz Aliyev" />
        </div>
        <div>
          <Label>Rol *</Label>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="AGENT">Agent</option>
            <option value="MANAGER">Manager</option>
            <option value="ACCOUNTANT">Buxgalter</option>
          </Select>
        </div>
      </div>
      <Label>Email *</Label>
      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="agent@kompaniyam.uz" style={{ marginBottom: 12 }} />
      <Label>Telefon</Label>
      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998901234567" style={{ marginBottom: 12 }} />
      <Label>Vaqtinchalik parol *</Label>
      <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Kamida 8 belgi" style={{ marginBottom: 8 }} />
      <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>
        💡 Agent birinchi marta kirganda parolni o'zgartirish so'ralishi mumkin
      </p>
    </Modal>
  );
}

// ─── v9: ROUND ROBIN LEAD ASSIGNMENT ───
function LeadAssignmentTab() {
  const [strategy, setStrategy] = useState('MANUAL');
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [sourceRouting, setSourceRouting] = useState<any>({});
  const [sourceRoutingSaving, setSourceRoutingSaving] = useState(false);

  const LEAD_SOURCES = [
    { id: 'TELEGRAM', label: '📨 Telegram' },
    { id: 'INSTAGRAM', label: '📷 Instagram' },
    { id: 'WHATSAPP', label: '💬 WhatsApp' },
    { id: 'WEBSITE', label: '🌐 Web sayt' },
    { id: 'FACEBOOK', label: '👥 Facebook' },
    { id: 'GOOGLE_ADS', label: '📢 Google Ads' },
    { id: 'REFERRAL', label: '🤝 Tavsiya' },
    { id: 'WALKIN', label: '🚶 Shaxsan' },
    { id: 'CALL', label: '☎ Qo\'ng\'iroq' },
    { id: 'OTHER', label: '❓ Boshqa' },
  ];

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ leadAssignmentApi, usersApi, tenantsApi }) =>
      Promise.all([
        leadAssignmentApi.getStrategy(),
        leadAssignmentApi.queue(),
        usersApi.list(),
        tenantsApi.getSourceRouting(),
      ])
        .then(([s, q, agt, sr]: any[]) => {
          const currentStrategy = s.data?.strategy || 'MANUAL';
          setStrategy(currentStrategy);
          setQueue(q.data || []);
          setAgents(agt.data || []);
          setSourceRouting(sr.data || {});
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  async function saveStrategy(newStrategy: string) {
    try {
      const { leadAssignmentApi } = await import('@/services/api');
      await leadAssignmentApi.setStrategy(newStrategy as any);
      setStrategy(newStrategy);
      toast.success("Strategiya saqlandi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function autoAssignAll() {
    setAssigning(true);
    try {
      const { leadAssignmentApi } = await import('@/services/api');
      const r: any = await leadAssignmentApi.assignUnassigned();
      toast.success(`✅ ${r.data.assigned} ta lead agentlarga taqsimlandi (o'tkazib yuborildi: ${r.data.skipped})`);
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setAssigning(false); }
  }

  // v9 FIX: Agentni round-robin taqsimlashdan to'xtatish / qaytarish.
  // Ilgari tugma faqat console.log qilardi — endi haqiqiy API chaqiriladi.
  async function togglePauseAgent(agent: any) {
    const name = agent.name || agent.fullName || agent.email;
    try {
      const { usersApi } = await import('@/services/api');
      if (agent.isPausedFromAssignment) {
        await usersApi.unpauseAgent(agent.id);
        toast.success(`▶️ ${name} — taqsimlashga qaytarildi`);
      } else {
        await usersApi.pauseAgent(agent.id);
        toast.success(`⏸ ${name} — taqsimlashdan to'xtatildi`);
      }
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function saveSourceRouting() {
    setSourceRoutingSaving(true);
    try {
      const { tenantsApi } = await import('@/services/api');
      await tenantsApi.updateSourceRouting(sourceRouting);
      toast.success("Manba bo'yicha yo'naltirish saqlandi");
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSourceRoutingSaving(false); }
  }

  const handleSourceRouting = (source: string, agentId: string | null) => {
    setSourceRouting((prev: any) => {
      const updated = { ...prev };
      if (agentId === null || agentId === '') {
        delete updated[source];
      } else {
        updated[source] = agentId;
      }
      return updated;
    });
  };

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>🎯 Lead taqsimlash strategiyasi</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>
          Yangi mijoz/lead'lar agentlarga qanday taqsimlanadi
        </p>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            onClick={() => saveStrategy('ROUND_ROBIN')}
            style={{
              padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
              background: strategy === 'ROUND_ROBIN' ? 'var(--primary-soft)' : 'var(--bg-3)',
              border: strategy === 'ROUND_ROBIN' ? '2px solid var(--primary)' : '2px solid var(--bg-2)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <span style={{ fontSize: 28 }}>🔄</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: strategy === 'ROUND_ROBIN' ? 'var(--primary)' : 'var(--fg-1)' }}>Round Robin</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                Yangi lead kelganda barcha agentlarga navbat bilan teng taqsimlanadi
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: strategy === 'ROUND_ROBIN' ? 'var(--success)' : 'var(--fg-3)' }}>
              {strategy === 'ROUND_ROBIN' ? '✅ Yoqilgan' : "○ O'chirilgan"}
            </div>
          </div>
          <div
            onClick={() => saveStrategy('MANUAL')}
            style={{
              padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
              background: strategy === 'MANUAL' ? 'rgba(245,158,11,0.12)' : 'var(--bg-3)',
              border: strategy === 'MANUAL' ? '2px solid #f59e0b' : '2px solid var(--bg-2)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <span style={{ fontSize: 28 }}>✋</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: strategy === 'MANUAL' ? '#f59e0b' : 'var(--fg-1)' }}>Manual</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                Admin qo'lda har bir leadni agentga tayinlaydi
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: strategy === 'MANUAL' ? '#f59e0b' : 'var(--fg-3)' }}>
              {strategy === 'MANUAL' ? '✅ Yoqilgan' : "○ O'chirilgan"}
            </div>
          </div>
        </div>
      </Card>

      {true && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>📋 Navbat ({queue.length} agent)</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" onClick={autoAssignAll} loading={assigning}>
                🔄 Barcha leadlarni qayta taqsimlash
              </Btn>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 10, background: a.isNext ? 'var(--primary-soft)' : 'var(--bg-3)',
                borderRadius: 8, border: a.isNext ? '1px solid var(--primary)' : '1px solid transparent',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: a.isNext ? 'var(--primary)' : 'var(--bg-2)',
                  color: a.isNext ? 'white' : 'var(--fg-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 11,
                }}>{a.position}</div>
                <Avatar name={a.name} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {a.name}
                    {a.isNext && <span style={{ marginLeft: 8, color: 'var(--primary)', fontSize: 10, fontWeight: 700 }}>← KEYINGI</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                    Faol klientlar: {a.activeClients}
                    {a.lastAssignedAt && ` • Oxirgi: ${new Date(a.lastAssignedAt).toLocaleDateString('uz-UZ')}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>📍 Manba bo'yicha avtomatik tayinlash</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 16 }}>
          Har bir manba uchun maxsus agentni o'rnating. Agar o'rnatilmagan bo'lsa, Round Robin ishlaydi.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LEAD_SOURCES.map((source) => (
            <div key={source.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--bg-3)', borderRadius: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, minWidth: 140 }}>{source.label}</div>
              <Select
                value={sourceRouting[source.id] || ''}
                onChange={(e) => handleSourceRouting(source.id, e.target.value || null)}
                style={{ flex: 1, maxWidth: 300 }}
              >
                <option value="">🔄 Round Robin (default)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName || a.email}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Btn onClick={saveSourceRouting} loading={sourceRoutingSaving}>✅ Saqlash</Btn>
          <Btn variant="secondary" onClick={() => setSourceRouting({})}>🔄 Tiklash</Btn>
        </div>
      </Card>

      {/* v9: Agent Management */}
      <Card style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>👥 Agentlarni boshqarish</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 16 }}>
          Ta'til, kunlik limit, va Round Robin statusi
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agents.map((agent) => (
            <div key={agent.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--bg-3)', borderRadius: 8, justifyContent: 'space-between',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name || agent.fullName || agent.email}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                  {agent.isPausedFromAssignment ? '⏸ Ta\'til' : '✅ Faol'}
                  {agent.dailyLeadLimit > 0 && ` • Limit: ${agent.dailyLeadLimit}/kun`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn size="sm" variant={agent.isPausedFromAssignment ? 'secondary' : 'primary'} onClick={() => togglePauseAgent(agent)}>
                  {agent.isPausedFromAssignment ? '▶️' : '⏸'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function StrategyCard({ id, current, title, description, onSelect }: any) {
  const active = current === id;
  return (
    <div onClick={() => !active && onSelect(id)} style={{
      padding: 14,
      background: active ? 'var(--primary-soft)' : 'var(--bg-3)',
      border: active ? '2px solid var(--primary)' : '2px solid transparent',
      borderRadius: 10,
      cursor: active ? 'default' : 'pointer',
      transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{description}</div>
      {active && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
          ✓ FAOL
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// v9: TELEGRAM BOT ULASH TAB
// ═══════════════════════════════════════════════════════════
//
// Admin: kompaniya boti (tenant-wide)
// Agent: o'z shaxsiy boti (faqat o'zi uchun)
// Owner ham agent kabi shaxsiy bot ulay oladi
//
function TelegramTab({ isAdmin }: { isAdmin: boolean }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompany, setShowCompany] = useState(false);
  const [showPersonal, setShowPersonal] = useState(false);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ telegramApi }) =>
      telegramApi.accounts()
        .then((r: any) => setAccounts(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  async function disconnectBot(id: string, name: string) {
    if (!confirm(`"${name}" botni uzib qo'yishni xohlaysizmi?`)) return;
    try {
      const { telegramApi } = await import('@/services/api');
      await telegramApi.disconnectBot(id);
      toast.success("Bot uzib qo'yildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Skeleton height={200} />;

  // Botlarni 2 ga ajratamiz
  const companyBots = accounts.filter((a) => !a.userId);
  const personalBots = accounts.filter((a) => a.userId);

  return (
    <>
      {/* Yo'riqnoma */}
      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>📨 Telegram Bot ulash</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '6px 0' }}>
          Telegram bot orqali klientlar bilan inbox'da yozishasiz.
          Bot token olish uchun Telegram'da{' '}
          <a href="https://t.me/BotFather" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            @BotFather
          </a>
          {' '}ga o'ting, <b>/newbot</b> yozing va instruksiyaga ergashing.
        </p>
        <div style={{
          padding: 10, background: 'var(--bg-3)', borderRadius: 8,
          fontSize: 11, color: 'var(--fg-3)', marginTop: 8,
        }}>
          💡 <b>Bot token namunasi:</b> <code style={{ background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4 }}>
            123456789:ABCDEF_ghIJKLmnopQRsTUVwxyz
          </code>
        </div>
      </Card>

      {/* KOMPANIYA BOTI (Admin) */}
      {isAdmin && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>🏢 Kompaniya boti</h3>
              <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0' }}>
                Barcha agentlar ishlatadi. Klientlardan kelgan xabarlar inbox'ga tushadi.
              </p>
            </div>
            <Btn variant="gradient" onClick={() => setShowCompany(true)}>+ Kompaniya boti ulash</Btn>
          </div>

          {companyBots.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center',
              background: 'var(--bg-3)', borderRadius: 10,
              color: 'var(--fg-3)',
            }}>
              <div style={{ fontSize: 32, opacity: 0.4 }}>🤖</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Kompaniya boti hali ulanmagan</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {companyBots.map((b) => (
                <BotCard key={b.id} bot={b} onDisconnect={() => disconnectBot(b.id, b.name)} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* v14: KOMPANIYA (umumiy) TELEGRAM ACCOUNTI — faqat ADMIN ulaydi.
          Agentlar endi o'z shaxsiy raqamini QO'SHMAYDI. Admin bitta umumiy
          account ulaydi, klientlar shu orqali yozadi va yangi lead'lar
          round-robin bilan agentlarga taqsimlanadi. */}
      {isAdmin && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>📱 Kompaniya Telegram accounti (umumiy)</h3>
              <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0' }}>
                Bitta umumiy Telegram raqami. Hamma agent shu orqali ishlaydi. Yangi lead
                avtomatik (round-robin) agentga biriktiriladi — bitta agent yozgan mijozni
                boshqasi ko'rmaydi. <b>Faqat admin ulaydi.</b>
              </p>
            </div>
            <Btn variant="primary" onClick={() => setShowPersonal(true)}>+ Account ulash</Btn>
          </div>

          {personalBots.length === 0 ? (
            <div style={{
              padding: 30, textAlign: 'center',
              background: 'var(--bg-3)', borderRadius: 10,
              color: 'var(--fg-3)',
            }}>
              <div style={{ fontSize: 32, opacity: 0.4 }}>📱</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Kompaniya accounti hali ulanmagan</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {personalBots.map((b) => (
                <BotCard key={b.id} bot={b} onDisconnect={() => disconnectBot(b.id, b.name)} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modallar */}
      {showCompany && (
        <ConnectBotModal
          isPersonal={false}
          onClose={() => setShowCompany(false)}
          onConnected={() => { setShowCompany(false); load(); }}
        />
      )}
      {showPersonal && (
        <PersonalAccountModal
          onClose={() => setShowPersonal(false)}
          onConnected={() => { setShowPersonal(false); load(); }}
        />
      )}
    </>
  );
}

function BotCard({ bot, onDisconnect }: any) {
  return (
    <div style={{
      padding: 14, background: 'var(--bg-3)', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'linear-gradient(135deg, #0088cc, #229ED9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>✈️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{bot.name}</span>
          {bot.isActive ? (
            <Badge color="var(--success)">● Faol</Badge>
          ) : (
            <Badge color="var(--danger)">○ Nofaol</Badge>
          )}
        </div>
        {bot.botUsername && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
            @{bot.botUsername}
            <a
              href={`https://t.me/${bot.botUsername}`}
              target="_blank"
              style={{ marginLeft: 8, color: 'var(--primary)', textDecoration: 'none', fontSize: 10 }}
            >
              Telegram'da ochish →
            </a>
          </div>
        )}
        {bot.createdAt && (
          <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 4 }}>
            Ulangan: {new Date(bot.createdAt).toLocaleDateString('uz-UZ')}
          </div>
        )}
      </div>
      <button onClick={onDisconnect} title="Uzib qo'yish" style={{
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 6, padding: '6px 12px',
        cursor: 'pointer', color: 'var(--danger)',
        fontSize: 12, fontWeight: 600,
      }}>
        🔌 Uzish
      </button>
    </div>
  );
}

function ConnectBotModal({ isPersonal, onClose, onConnected }: any) {
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (isPersonal) {
      // Personal account - connect via username
      if (!username.trim()) {
        toast.error("Telegram username kerak");
        return;
      }
      setLoading(true);
      try {
        const { api } = await import('@/services/api');
        await api.post('/users/me/telegram', { 
          telegramUsername: username.replace('@', '').trim() 
        });
        toast.success("✅ Telegram username saqlandi! Klientlar @" + username.replace('@','') + " orqali sizga yozishlari mumkin");
        onConnected();
      } catch (e: any) {
        toast.error(errMsg(e));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!token.trim()) {
      toast.error("Bot token kerak");
      return;
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token.trim())) {
      toast.error("Token formati noto'g'ri. Namuna: 123456789:ABC...");
      return;
    }
    setLoading(true);
    try {
      const { telegramApi } = await import('@/services/api');
      await telegramApi.connectBot(token.trim(), name.trim() || 'Kompaniya boti');
      toast.success("✅ Bot muvaffaqiyatli ulandi");
      onConnected();
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isPersonal ? "👤 Shaxsiy Telegram account ulash" : "🏢 Kompaniya boti ulash"}
      maxWidth={520}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
          <Btn variant="gradient" onClick={submit} loading={loading}>Ulash</Btn>
        </>
      }
    >
      {/* Yo'riqnoma */}
      <div style={{
        padding: 12, background: 'var(--bg-3)', borderRadius: 10,
        marginBottom: 14, fontSize: 12, color: 'var(--fg-2)',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📖 Bot token qanday olinadi?</div>
        <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
          <li>Telegram'da{' '}
            <a href="https://t.me/BotFather" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>@BotFather</a>{' '}
            ga o'ting
          </li>
          <li><b>/newbot</b> yuboring</li>
          <li>Bot nomini yozing (masalan: "<i>Omon Travel Bot</i>")</li>
          <li>Bot username'ni yozing (yakuni <b>bot</b> bo'lishi shart, masalan: <code>omon_travel_bot</code>)</li>
          <li>BotFather sizga token beradi — <b>nusxa oling va shu yerga yopishtiring</b></li>
        </ol>
      </div>

      <Label>Bot nomi (CRM ichida)</Label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isPersonal ? "Mening boti" : "Kompaniya boti"}
        style={{ marginBottom: 12 }}
      />

      {isPersonal ? (
        <>
          <Label>Telegram Username *</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username (masalan: @john_doe)"
            style={{ marginBottom: 10 }}
          />
          <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8, fontSize: 11, color: 'var(--fg-2)', marginBottom: 8 }}>
            Username saqlanganda klient kartasida Telegram link ko'rinadi. Inbox orqali yozishish uchun kompaniya botini ulang.
          </div>
        </>
      ) : (
        <>
          <Label>Bot token *</Label>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456789:ABCDEF_ghIJKLmnopQRsTUVwxyz"
            style={{ marginBottom: 8, fontFamily: 'monospace', fontSize: 12 }}
          />
        </>
      )}

      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
        🔒 Token shifrlangan holatda saqlanadi. Hech kim ko'rmaydi.
      </div>

      {isPersonal && (
        <div style={{
          marginTop: 12, padding: 10,
          background: 'var(--bg-3)', borderRadius: 8,
          fontSize: 11, color: 'var(--fg-3)',
        }}>
          💡 <b>Shaxsiy bot:</b> Faqat sizning klientlaringiz bilan ishlatiladi.
          Sizning ismingiz bilan yozishadi. Boshqa agentlar ko'rmaydi.
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9-FINAL: 🔑 API KEYS TAB
// Admin lead qabul qilish uchun API key yaratadi
// Yaratilgan key faqat 1 marta ko'rsatiladi (xavfsizlik)
// ═══════════════════════════════════════════════════════════
function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<any>(null);
  const [guide, setGuide] = useState<any>(null);
  // v9-FINAL: Test modal uchun
  const [testingKey, setTestingKey] = useState<any>(null);

  const load = () => {
    setLoading(true);
    import('@/services/api').then((m: any) => {
      // apiKeysApi mavjud bo'lmasa - to'g'ridan-to'g'ri api ishlatamiz
      const apiClient = (m as any).api || m.default;
      Promise.all([
        apiClient.get('/api-keys'),
        apiClient.get('/api-keys/integration-guide').catch(() => ({ data: null })),
      ])
        .then(([r1, r2]: any[]) => {
          setKeys(r1.data || []);
          setGuide(r2.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  };

  useEffect(() => { load(); }, []);

  async function revokeKey(id: string, name: string) {
    if (!confirm(`"${name}" key bekor qilinsinmi?`)) return;
    try {
      const { api } = await import('@/services/api');
      await api.post(`/api-keys/${id}/revoke`);
      toast.success("Bekor qilindi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function deleteKey(id: string, name: string) {
    if (!confirm(`"${name}" key butunlay o'chirilsinmi?`)) return;
    try {
      const { api } = await import('@/services/api');
      await api.delete(`/api-keys/${id}`);
      toast.success("O'chirildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>🔑 Lead Webhook API Keys</h3>
            <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0' }}>
              Tashqi web sayt yoki bot orqali lead qabul qilish uchun API key yarating
            </p>
          </div>
          <Btn variant="gradient" onClick={() => setShowCreate(true)}>+ Yangi API Key</Btn>
        </div>

        {/* Integratsiya ko'rsatmasi */}
        {guide && (
          <div style={{
            padding: 12, background: 'var(--bg-3)', borderRadius: 10,
            marginBottom: 14, fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Endpoint:</div>
            <code style={{
              display: 'block', padding: 8, background: 'var(--bg-2)',
              borderRadius: 6, fontSize: 11, wordBreak: 'break-all',
            }}>{guide.endpoint}</code>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
              Avtorizatsiya: <code>?key=API_KEY</code> yoki header <code>X-API-Key</code>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>🔑</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>API Key yo'q</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keys.map((k) => (
              <div key={k.id} style={{
                padding: 12, background: 'var(--bg-3)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 22 }}>🔑</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{k.name}</span>
                    {k.isActive ? (
                      <Badge color="var(--success)">● Faol</Badge>
                    ) : (
                      <Badge color="var(--danger)">○ Bekor</Badge>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'monospace' }}>
                    {k.prefix}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 4 }}>
                    {k.lastUsedAt ? `Oxirgi: ${new Date(k.lastUsedAt).toLocaleString('uz-UZ')}` : 'Hech qachon ishlatilmagan'}
                    {k.expiresAt && ` • Muddati: ${new Date(k.expiresAt).toLocaleDateString('uz-UZ')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {/* v9-FINAL: Test tugmasi - real API'ga test lead jo'natadi */}
                  {k.isActive && (
                    <button onClick={() => setTestingKey(k)} title="Test yuborish" style={{
                      background: 'var(--primary-soft, rgba(99,102,241,0.15))',
                      border: '1px solid var(--primary)', borderRadius: 6,
                      padding: '4px 10px', cursor: 'pointer', color: 'var(--primary)',
                      fontSize: 11, fontWeight: 600,
                    }}>🧪 Test</button>
                  )}
                  {k.isActive && (
                    <button onClick={() => revokeKey(k.id, k.name)} title="Bekor qilish" style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 10px', cursor: 'pointer', color: 'var(--warning)', fontSize: 11,
                    }}>Bekor</button>
                  )}
                  <button onClick={() => deleteKey(k.id, k.name)} title="O'chirish" style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 10px', cursor: 'pointer', color: 'var(--danger)', fontSize: 11,
                  }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Yangi key yaratish modal */}
      {showCreate && (
        <CreateApiKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(k) => { setShowCreate(false); setCreatedKey(k); load(); }}
        />
      )}

      {/* Yaratilgan key'ni ko'rsatish (1 marta!) */}
      {createdKey && (
        <Modal open onClose={() => setCreatedKey(null)} title="✅ API Key yaratildi" maxWidth={520} footer={
          <Btn variant="primary" onClick={() => setCreatedKey(null)}>Yopildi</Btn>
        }>
          <div style={{
            padding: 14, background: 'var(--danger-soft, rgba(239,68,68,0.1))',
            borderRadius: 10, marginBottom: 14,
            border: '1px solid var(--danger)',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>
              ⚠ {createdKey.warning || 'Bu key faqat hozir ko\'rsatiladi!'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
              Hozir nusxa oling — keyin ko'rinmaydi.
            </div>
          </div>

          <Label>API Key:</Label>
          <div style={{
            padding: 12, background: 'var(--bg-3)', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all',
            border: '1px dashed var(--primary)',
          }}>
            {createdKey.key}
          </div>
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(createdKey.key);
              toast.success('Nusxa olindi');
            }}
            style={{ marginTop: 8 }}
          >
            📋 Nusxa olish
          </Btn>
        </Modal>
      )}
      {/* v9-FINAL: API Key test modal */}
      {testingKey && (
        <TestApiKeyModal
          apiKey={testingKey}
          guide={guide}
          onClose={() => setTestingKey(null)}
        />
      )}
    </>
  );
}

function CreateApiKeyModal({ onClose, onCreated }: any) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(365);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error("Nom kerak"); return; }
    setLoading(true);
    try {
      const { api } = await import('@/services/api');
      const r: any = await api.post('/api-keys', {
        name: name.trim(),
        expiresInDays: expiresInDays || undefined,
      });
      onCreated(r.data);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="🔑 Yangi API Key" maxWidth={460} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={submit} loading={loading}>Yaratish</Btn>
      </>
    }>
      <Label>Nom *</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website Form, Telegram Bot, ..." style={{ marginBottom: 12 }} />

      <Label>Amal qilish muddati (kun)</Label>
      <Input
        type="number"
        value={expiresInDays}
        onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
        placeholder="365 (1 yil)"
      />
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
        Bo'sh qoldirsangiz — muddatsiz (cheksiz)
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9-FINAL: 📝 SHABLONLAR TAB
// Admin tez-tez ishlatiladigan xabar shablonlarini saqlaydi
// Inbox'da har bir agent ulardan foydalanadi
// ═══════════════════════════════════════════════════════════
const TEMPLATE_CATEGORIES = [
  { value: 'GREETING',    label: '👋 Salomlashish' },
  { value: 'PRICING',     label: '💰 Narxlar' },
  { value: 'CONFIRM',     label: '✅ Tasdiq' },
  { value: 'FOLLOWUP',    label: '🔁 Eslatma' },
  { value: 'INFO',        label: 'ℹ Ma\'lumot' },
  { value: 'FAREWELL',    label: '👋 Xayrlashish' },
  { value: 'OTHER',       label: '📝 Boshqa' },
];

function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ telegramApi }) =>
      telegramApi.templates()
        .then((r: any) => setTemplates(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`"${name}" shablon o'chirilsinmi?`)) return;
    try {
      const { telegramApi } = await import('@/services/api');
      await telegramApi.deleteTemplate(id);
      toast.success("O'chirildi");
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>📝 Xabar shablonlari</h3>
            <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0' }}>
              Tez-tez ishlatiladigan xabarlarni saqlang. Inbox'da bir tugmada yuboriladi.
            </p>
          </div>
          <Btn variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}>+ Yangi shablon</Btn>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>📝</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Shablonlar yo'q</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map((t) => {
              const catLabel = TEMPLATE_CATEGORIES.find((c) => c.value === t.category)?.label || t.category;
              return (
                <div key={t.id} style={{
                  padding: 12, background: 'var(--bg-3)', borderRadius: 10,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                      <Badge color="var(--info)">{catLabel}</Badge>
                      {t.usageCount > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                          {t.usageCount} marta ishlatildi
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--fg-2)', marginTop: 6,
                      padding: 8, background: 'var(--bg-2)', borderRadius: 6,
                      whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden',
                    }}>
                      {t.text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditing(t); setShowForm(true); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--fg-2)', fontSize: 14, padding: 4,
                    }}>✏</button>
                    <button onClick={() => deleteTemplate(t.id, t.name)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--danger)', fontSize: 14, padding: 4,
                    }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showForm && (
        <TemplateFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </>
  );
}

function TemplateFormModal({ editing, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: editing?.name || '',
    category: editing?.category || 'GREETING',
    text: editing?.text || '',
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast.error("Nom kerak"); return; }
    if (!form.text.trim()) { toast.error("Matn kerak"); return; }
    setLoading(true);
    try {
      const { telegramApi } = await import('@/services/api');
      if (editing) {
        await telegramApi.updateTemplate(editing.id, form);
      } else {
        await telegramApi.createTemplate(form);
      }
      toast.success("Saqlandi");
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Shablonni tahrirlash" : "Yangi shablon"} maxWidth={560} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
        <Btn variant="gradient" onClick={save} loading={loading}>Saqlash</Btn>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <Label>Shablon nomi *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Salomlashish" />
        </div>
        <div>
          <Label>Kategoriya</Label>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
      </div>

      <Label>Matn *</Label>
      <Textarea
        value={form.text}
        onChange={(e) => setForm({ ...form, text: e.target.value })}
        rows={6}
        placeholder="Assalomu alaykum! Omon Travel'ga xush kelibsiz. Sizga qanday yordam berishim mumkin?"
      />

      <div style={{
        marginTop: 10, padding: 8, background: 'var(--bg-3)',
        borderRadius: 6, fontSize: 11, color: 'var(--fg-3)',
      }}>
        💡 <b>Maslahatlar:</b><br />
        — <code>{'{{client.fullName}}'}</code> — klient ismini avtomatik qo'shadi<br />
        — <code>{'{{booking.tourName}}'}</code> — tur nomini qo'shadi<br />
        — Inbox'da ushbu shablon bir tugma orqali yuboriladi
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9-FINAL: 🧪 API KEY TEST MODAL
// Admin real test lead jo'natadi va natijani ko'radi
// ═══════════════════════════════════════════════════════════
function TestApiKeyModal({ apiKey, guide, onClose }: any) {
  const [form, setForm] = useState({
    fullName: 'Test Klient',
    phone: '+998901234567',
    email: 'test@example.com',
    source: 'WEB',
    message: 'Bu test lead. Dubay turi haqida bilmoqchiman.',
    tourInterest: 'Dubay 7 kunlik',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showCode, setShowCode] = useState<'curl' | 'js' | 'html' | null>(null);

  // Test key — bu xaqiqiy key emas, lekin admin uchun namuna
  const baseUrl = guide?.endpoint?.replace(`/public/leads/${guide?.endpoint?.split('/').pop()}`, '') 
    || 'http://localhost:3000/api/v1';
  const endpoint = guide?.endpoint || `${baseUrl}/public/leads/TENANT_ID`;

  async function sendTest() {
    setSending(true);
    setResult(null);
    try {
      // guide.endpoint: "POST http://host/api/v1/public/leads/:tenantId"
      // rawUrl — "POST " prefixini olib tashlaymiz
      const rawUrl = (guide?.endpoint || '').replace(/^POST\s+/i, '').trim();
      if (!rawUrl) {
        setResult({ success: false, error: 'Endpoint aniqlanmadi. Integration guide yuklanmagan.' });
        return;
      }
      // API key prefix — apiKey.prefix "lk_xxxx…" ko'rinishida, lekin to'liq key yo'q.
      // Shuning uchun admin uchun JWT bilan /api-keys/:id/test-send ishlatamiz
      const { api } = await import('@/services/api');
      const res: any = await api.post(`/api-keys/${apiKey.id}/test-send`, form);
      setResult({ success: true, data: res.data });
      toast.success('✅ Test lead yaratildi!');
    } catch (e: any) {
      setResult({
        success: false,
        error: e?.response?.data?.message || e.message || 'Xato',
      });
    } finally {
      setSending(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`📋 ${label} nusxa olindi`);
  }

  // Tayyor namuna kodlari
  const curlCmd = `curl -X POST "${endpoint}?key=YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    fullName: form.fullName,
    phone: form.phone,
    email: form.email,
    source: form.source,
    message: form.message,
  }, null, 2).replace(/\n/g, '\n')}'`;

  const jsCode = `// JavaScript / Node.js
fetch("${endpoint}?key=YOUR_API_KEY", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fullName: "${form.fullName}",
    phone: "${form.phone}",
    email: "${form.email}",
    source: "${form.source}",
    message: "${form.message}"
  })
})
.then(r => r.json())
.then(data => console.log(data));`;

  const htmlCode = `<!-- HTML Web Form -->
<form id="leadForm">
  <input name="fullName" placeholder="Ism *" required />
  <input name="phone" placeholder="+998..." required />
  <input name="email" placeholder="Email" />
  <textarea name="message" placeholder="Xabaringiz"></textarea>
  <button type="submit">Yuborish</button>
</form>

<script>
document.getElementById('leadForm').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.source = 'WEB';
  
  const res = await fetch(
    '${endpoint}?key=YOUR_API_KEY',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  );
  const json = await res.json();
  if (json.ok) {
    alert("Rahmat! Tez orada bog'lanamiz.");
    e.target.reset();
  } else {
    alert("Xato: " + json.message);
  }
};
</script>`;

  return (
    <Modal open onClose={onClose} title={`🧪 Test: ${apiKey.name}`} maxWidth={700} footer={
      <Btn variant="secondary" onClick={onClose}>Yopish</Btn>
    }>
      {/* API key info */}
      <div style={{
        padding: 10, background: 'var(--bg-3)', borderRadius: 8,
        marginBottom: 14, fontSize: 11, color: 'var(--fg-3)',
      }}>
        🔑 <b>{apiKey.name}</b> • <code>{apiKey.prefix}</code>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Klient ismi *</Label>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Manba</Label>
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="WEB">🌐 Web sayt</option>
            <option value="TELEGRAM">📨 Telegram</option>
            <option value="INSTAGRAM">📷 Instagram</option>
            <option value="WHATSAPP">💚 WhatsApp</option>
            <option value="FACEBOOK">👤 Facebook</option>
            <option value="GOOGLE_ADS">🔍 Google Ads</option>
            <option value="REFERRAL">🤝 Referral</option>
            <option value="WALKIN">🚶 Walk-in</option>
            <option value="CALL">📞 Qo'ng'iroq</option>
            <option value="OTHER">📋 Boshqa</option>
          </Select>
        </div>
        <div>
          <Label>Tour qiziqishi</Label>
          <Input value={form.tourInterest} onChange={(e) => setForm({ ...form, tourInterest: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Xabar</Label>
          <Textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={2}
          />
        </div>
        {/* UTM tracking */}
        <div>
          <Label style={{ fontSize: 10 }}>UTM Source</Label>
          <Input value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} placeholder="google" />
        </div>
        <div>
          <Label style={{ fontSize: 10 }}>UTM Medium</Label>
          <Input value={form.utmMedium} onChange={(e) => setForm({ ...form, utmMedium: e.target.value })} placeholder="cpc" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label style={{ fontSize: 10 }}>UTM Campaign</Label>
          <Input value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} placeholder="summer2024" />
        </div>
      </div>

      {/* Test yuborish tugmasi */}
      <Btn
        variant="gradient"
        onClick={sendTest}
        loading={sending}
        style={{ width: '100%', marginBottom: 12 }}
      >
        📤 Test lead yuborish
      </Btn>

      {/* Natija */}
      {result && (
        <div style={{
          padding: 12,
          background: result.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.success ? 'var(--success)' : 'var(--danger)'}`,
          borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 700, color: result.success ? 'var(--success)' : 'var(--danger)', marginBottom: 6 }}>
            {result.success ? '✅ Muvaffaqiyatli!' : '❌ Xato'}
          </div>
          {result.success ? (
            <>
              <div style={{ fontSize: 12 }}>
                Klient ID: <code>{result.data?.clientId}</code>
              </div>
              {result.data?.assignedAgentId && (
                <div style={{ fontSize: 12 }}>
                  Tayinlangan agent: <code>{result.data.assignedAgentId}</code>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                {result.data?.message}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12 }}>{result.error}</div>
              {result.info && (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                  ℹ {result.info}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Kod namunalari */}
      <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        Tayyor kod namunalari
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { id: 'curl', label: '🖥 cURL' },
          { id: 'js', label: '📜 JavaScript' },
          { id: 'html', label: '🌐 HTML' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setShowCode(showCode === t.id ? null : (t.id as any))}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              background: showCode === t.id ? 'var(--primary)' : 'var(--bg-3)',
              color: showCode === t.id ? 'white' : 'var(--fg-2)',
              border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
            }}
          >{t.label}</button>
        ))}
      </div>

      {showCode && (
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: 'var(--bg-2)', padding: 12, borderRadius: 8,
            fontSize: 11, lineHeight: 1.5, overflow: 'auto',
            maxHeight: 240, margin: 0,
            fontFamily: 'Monaco, monospace',
          }}>
            <code>{showCode === 'curl' ? curlCmd : showCode === 'js' ? jsCode : htmlCode}</code>
          </pre>
          <button
            onClick={() => copy(showCode === 'curl' ? curlCmd : showCode === 'js' ? jsCode : htmlCode, showCode.toUpperCase())}
            style={{
              position: 'absolute', top: 8, right: 8,
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: 'var(--primary)', color: 'white',
              border: 'none', borderRadius: 5, cursor: 'pointer',
            }}
          >📋 Nusxa</button>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// v9-FINAL: 📜 WEBHOOK LOGS TAB
// Admin har bir public lead so'rovini ko'radi (audit trail)
// Failed lead'larni qayta urinish mumkin
// ═══════════════════════════════════════════════════════════
function WebhookLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ api }) => {
      const params: any = { limit: 100 };
      if (filter === 'success') params.success = 'true';
      if (filter === 'failed') params.success = 'false';
      api.get('/webhook-logs', { params })
        .then((r: any) => {
          setLogs(r.data?.data || []);
          setStats(r.data?.stats || {});
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  };

  useEffect(() => { load(); }, [filter]);

  async function retry(id: string) {
    try {
      const { api } = await import('@/services/api');
      await api.post(`/webhook-logs/${id}/retry`);
      toast.success('✅ Qayta urinish muvaffaqiyatli');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function deleteLog(id: string) {
    if (!confirm('Log o\'chirilsinmi?')) return;
    try {
      const { api } = await import('@/services/api');
      await api.delete(`/webhook-logs/${id}`);
      toast.success('O\'chirildi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>📜 Webhook Audit Log</h3>
            <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0' }}>
              Har bir public API so'rov shu yerda yoziladi
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all', label: 'Hammasi' },
              { id: 'success', label: '✅ Muvaffaq' },
              { id: 'failed', label: '❌ Xato' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600,
                  background: filter === f.id ? 'var(--primary)' : 'var(--bg-3)',
                  color: filter === f.id ? 'white' : 'var(--fg-2)',
                  border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>Muvaffaq</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{stats.successCount || 0}</div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>Xato</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>{stats.failedCount || 0}</div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>Success Rate</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
              {(stats.successRate || 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>📜</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Log yo'q</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((log) => (
              <div key={log.id} style={{
                padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10,
                borderLeft: `3px solid ${log.success ? 'var(--success)' : 'var(--danger)'}`,
                cursor: 'pointer',
              }} onClick={() => setSelectedLog(log)}>
                <div style={{ fontSize: 18 }}>
                  {log.success ? '✅' : '❌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {log.apiKeyName || log.apiKeyPrefix || 'Noma\'lum key'}
                    </span>
                    <Badge color={log.success ? 'var(--success)' : 'var(--danger)'}>
                      {log.statusCode}
                    </Badge>
                    {log.duration && (
                      <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                        {log.duration}ms
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                    {(log.requestBody as any)?.fullName || '—'}
                    {(log.requestBody as any)?.phone && ` • ${(log.requestBody as any).phone}`}
                    {log.errorMessage && (
                      <span style={{ color: 'var(--danger)' }}> • {log.errorMessage.substring(0, 60)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>
                    {new Date(log.createdAt).toLocaleString('uz-UZ')}
                    {log.ip && ` • ${log.ip}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {!log.success && log.apiKeyId && (
                    <button onClick={() => retry(log.id)} style={{
                      background: 'var(--primary-soft, rgba(99,102,241,0.15))',
                      border: '1px solid var(--primary)', borderRadius: 6,
                      padding: '4px 10px', cursor: 'pointer', color: 'var(--primary)',
                      fontSize: 11, fontWeight: 600,
                    }}>🔁 Retry</button>
                  )}
                  <button onClick={() => deleteLog(log.id)} style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 10px', cursor: 'pointer', color: 'var(--danger)', fontSize: 11,
                  }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Log detail modal */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </>
  );
}

function LogDetailModal({ log, onClose }: any) {
  return (
    <Modal open onClose={onClose} title={`📜 Log: ${log.id.substring(0, 12)}...`} maxWidth={680} footer={
      <Btn variant="secondary" onClick={onClose}>Yopish</Btn>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, fontSize: 12 }}>
        <div><b>Status:</b> {log.success ? '✅ Muvaffaq' : '❌ Xato'}</div>
        <div><b>Code:</b> {log.statusCode}</div>
        <div><b>Method:</b> {log.method}</div>
        <div><b>Duration:</b> {log.duration}ms</div>
        <div style={{ gridColumn: '1 / -1' }}><b>Endpoint:</b> <code>{log.endpoint}</code></div>
        <div><b>API Key:</b> {log.apiKeyName || '—'}</div>
        <div><b>IP:</b> {log.ip || '—'}</div>
      </div>

      {log.errorMessage && (
        <div style={{
          padding: 10, background: 'rgba(239,68,68,0.1)',
          border: '1px solid var(--danger)', borderRadius: 6,
          marginBottom: 12, fontSize: 12, color: 'var(--danger)',
        }}>
          ❌ {log.errorMessage}
        </div>
      )}

      <Label>Request Body:</Label>
      <pre style={{
        background: 'var(--bg-3)', padding: 10, borderRadius: 6,
        fontSize: 10, overflow: 'auto', maxHeight: 200,
        fontFamily: 'monospace', margin: '4px 0 10px',
      }}>{JSON.stringify(log.requestBody, null, 2)}</pre>

      <Label>Response Body:</Label>
      <pre style={{
        background: 'var(--bg-3)', padding: 10, borderRadius: 6,
        fontSize: 10, overflow: 'auto', maxHeight: 200,
        fontFamily: 'monospace', margin: '4px 0 0',
      }}>{JSON.stringify(log.responseBody, null, 2)}</pre>
    </Modal>
  );
}


// v9: AUTO-REPLY TAB
function AutoReplyTab() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', source: '', channel: 'TELEGRAM', template: '', delayMs: 0 });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ autoReplyApi }) =>
      autoReplyApi.list()
        .then((r: any) => setRules(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.template.trim()) {
      toast.error('Nom va matn majburiy');
      return;
    }
    setSaving(true);
    try {
      const { autoReplyApi } = await import('@/services/api');
      await autoReplyApi.create({
        name: form.name,
        source: form.source || null,
        channel: form.channel,
        template: form.template,
        delayMs: parseInt(form.delayMs as any) || 0,
      });
      toast.success('Auto-reply qoida qo\'shildi');
      setForm({ name: '', source: '', channel: 'TELEGRAM', template: '', delayMs: 0 });
      setShowForm(false);
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      const { autoReplyApi } = await import('@/services/api');
      await autoReplyApi.toggle(ruleId);
      toast.success('Holat o\'zgartirildi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('O\'chirasizmi?')) return;
    try {
      const { autoReplyApi } = await import('@/services/api');
      await autoReplyApi.delete(ruleId);
      toast.success('Qoida o\'chirildi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🤖 Auto-Reply Qoidalari</h3>
          <Btn onClick={() => setShowForm(!showForm)}>+ Yangi qoida</Btn>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
          Lead kelganda avtomatik javob yuborish (Telegram, Email)
        </p>
      </Card>

      {showForm && (
        <Card style={{ marginBottom: 16, background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input placeholder="Qoida nomi (misol: Xush kelibsiz)" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <Select value={form.source} onChange={(e) => setForm({...form, source: e.target.value})}>
              <option value="">Barchasi uchun</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WEBSITE">Web sayt</option>
              <option value="EMAIL">Email</option>
            </Select>
            <Select value={form.channel} onChange={(e) => setForm({...form, channel: e.target.value})}>
              <option value="TELEGRAM">📨 Telegram</option>
              <option value="EMAIL">📧 Email</option>
            </Select>
            <Textarea placeholder="Matn ({{client.fullName}}, {{client.phone}} ishlatish mumkin)" value={form.template} onChange={(e) => setForm({...form, template: e.target.value})} style={{ minHeight: 80 }} />
            <div>
              <Label>Kechikish (millisekund)</Label>
              <Input type="number" value={form.delayMs} onChange={(e) => setForm({...form, delayMs: Number(e.target.value) || 0})} placeholder="0 = darhol, 3000 = 3 sekund" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={handleSave} loading={saving}>Saqlash</Btn>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Bekor qilish</Btn>
            </div>
          </div>
        </Card>
      )}

      {rules.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🤖</div>
          <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Hali qoida yo'q</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map((rule) => (
            <Card key={rule.id} style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                    {rule.source ? `📍 ${rule.source}` : '🌐 Barchasi'} • {rule.channel === 'TELEGRAM' ? '📨 Telegram' : '📧 Email'}
                    {rule.delayMs > 0 && ` • ${rule.delayMs}ms`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>
                    {rule.template}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Btn size="sm" variant={rule.isActive ? 'primary' : 'secondary'} onClick={() => handleToggle(rule.id)}>
                    {rule.isActive ? '✅' : '⏸'}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(rule.id)}>🗑</Btn>
                </div>
              </div>
              {rule.triggerCount > 0 && (
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 6 }}>
                  ✨ {rule.triggerCount} marta ishladi
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// v9: LEAD FORMS TAB
function FormsTab() {
  const { user } = useAuth();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', fields: [], successMsg: 'Rahmat!' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ leadFormsApi }) =>
      leadFormsApi.list()
        .then((r: any) => setForms(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Nom va slug majburiy');
      return;
    }
    setSaving(true);
    try {
      const { leadFormsApi } = await import('@/services/api');
      await leadFormsApi.create(form);
      toast.success('Forma qo\'shildi');
      setForm({ name: '', slug: '', description: '', fields: [], successMsg: 'Rahmat!' });
      setShowForm(false);
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (formId: string) => {
    if (!confirm('O\'chirasizmi?')) return;
    try {
      const { leadFormsApi } = await import('@/services/api');
      await leadFormsApi.delete(formId);
      toast.success('Forma o\'chirildi');
      load();
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  const getEmbedCode = (slug: string) => {
    const tenantId = user?.tenantId || '';
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/forms/${tenantId}/${slug}`;
    return `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`;
  };

  if (loading) return <Skeleton height={200} />;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>📝 Web Formalar</h3>
          <Btn onClick={() => setShowForm(!showForm)}>+ Yangi forma</Btn>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
          Lead capture formalar — embed kod bilan website'ga qo'ying
        </p>
      </Card>

      {showForm && (
        <Card style={{ marginBottom: 16, background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input placeholder="Forma nomi (Tur buyurtma)" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <Input placeholder="Slug (tour-booking)" value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})} />
            <Textarea placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} style={{ minHeight: 60 }} />
            <Input placeholder="Success xabari" value={form.successMsg} onChange={(e) => setForm({...form, successMsg: e.target.value})} />

            {/* Maydon konstruktori */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Label>Forma maydonlari ({(form.fields as any[]).length})</Label>
                <Btn size="sm" variant="secondary" onClick={() => setForm({
                  ...form,
                  fields: [...(form.fields as any[]), { id: 'f' + Date.now(), name: '', label: '', type: 'text', required: true, placeholder: '' }],
                } as any)}>+ Maydon qo'shish</Btn>
              </div>

              {(form.fields as any[]).length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>
                  Hali maydon yo'q. "Ism", "Telefon" kabi maydonlar qo'shing.
                </p>
              )}

              {(form.fields as any[]).map((field: any, idx: number) => (
                <div key={field.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 6,
                  alignItems: 'center', marginBottom: 8, padding: 8,
                  background: 'var(--bg-3)', borderRadius: 8,
                }}>
                  <input
                    placeholder="Label (Ismingiz)"
                    value={field.label}
                    onChange={(e) => {
                      const fields = [...(form.fields as any[])];
                      fields[idx] = { ...field, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                      setForm({ ...form, fields } as any);
                    }}
                    style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 12 }}
                  />
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const fields = [...(form.fields as any[])];
                      fields[idx] = { ...field, type: e.target.value };
                      setForm({ ...form, fields } as any);
                    }}
                    style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 12 }}
                  >
                    <option value="text">Matn</option>
                    <option value="phone">Telefon</option>
                    <option value="email">Email</option>
                    <option value="textarea">Katta matn</option>
                    <option value="select">Tanlov</option>
                    <option value="date">Sana</option>
                    <option value="number">Raqam</option>
                  </select>
                  <input
                    placeholder="Placeholder"
                    value={field.placeholder}
                    onChange={(e) => {
                      const fields = [...(form.fields as any[])];
                      fields[idx] = { ...field, placeholder: e.target.value };
                      setForm({ ...form, fields } as any);
                    }}
                    style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 12 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={field.required} onChange={(e) => {
                      const fields = [...(form.fields as any[])];
                      fields[idx] = { ...field, required: e.target.checked };
                      setForm({ ...form, fields } as any);
                    }} />
                    Majburiy
                  </label>
                  <button onClick={() => {
                    const fields = (form.fields as any[]).filter((_, i) => i !== idx);
                    setForm({ ...form, fields } as any);
                  }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={handleSave} loading={saving}>Saqlash</Btn>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Bekor</Btn>
            </div>
          </div>
        </Card>
      )}

      {forms.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
          <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Hali forma yo'q</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forms.map((f: any) => (
            <Card key={f.id} style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                    📍 /{f.slug} • {f.submitCount} submit {f.lastSubmitAt && `• ${new Date(f.lastSubmitAt).toLocaleDateString('uz-UZ')}`}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 6 }}>
                      {f.description}
                    </div>
                  )}
                  <div style={{ fontSize: 10, background: 'var(--bg-2)', padding: '6px', borderRadius: 4, fontFamily: 'monospace', overflow: 'auto', maxHeight: 60, marginTop: 6 }}>
                    {getEmbedCode(f.slug)}
                  </div>
                </div>
                <Btn size="sm" variant="danger" onClick={() => handleDelete(f.id)}>🗑</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// v9-FINAL: KPI COMMISSION TIERS TAB
function KPITab() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [newTier, setNewTier] = useState({ minRevenue: 0, maxRevenue: null, commissionPercent: 8 });

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ kpiApi }) =>
      kpiApi.getTiers()
        .then((r: any) => setTiers(Array.isArray(r.data) ? r.data : r))
        .catch(() => toast.error('Tierlari yuklab bo\'lmadi'))
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  const handleAddTier = () => {
    if (newTier.minRevenue < 0 || newTier.commissionPercent < 0 || newTier.commissionPercent > 100) {
      toast.error('Noto\'g\'ri qiymatlar');
      return;
    }
    const updated = [...tiers, newTier];
    setTiers(updated.sort((a: any, b: any) => a.minRevenue - b.minRevenue));
    setNewTier({ minRevenue: 0, maxRevenue: null, commissionPercent: 8 });
  };

  const handleRemoveTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleUpdateTier = (index: number, key: string, value: any) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [key]: value };
    setTiers(updated);
  };

  const handleSave = async () => {
    if (tiers.length === 0) {
      toast.error('Kamita 1 ta tier bo\'lishi kerak');
      return;
    }
    setSaving(true);
    try {
      const { kpiApi } = await import('@/services/api');
      await kpiApi.saveTiers(tiers);
      toast.success('Commission tiers saqlandi');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton height={300} />;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, marginBottom: 12 }}>💰 Commission Tiers</h3>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>
          Agent foizini daromad bo'yicha o'rnating. Misol: 0-2000 = 8%, 2000-4000 = 10%
        </p>
      </Card>

      {/* Existing tiers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {tiers.map((tier: any, i: number) => (
          <Card key={i} style={{ padding: 14, background: 'var(--bg-3)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 4 }}>Daromad:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input 
                    type="number" 
                    value={tier.minRevenue} 
                    onChange={(e) => handleUpdateTier(i, 'minRevenue', parseFloat(e.target.value) || 0)}
                    style={{ width: 100, fontSize: 12 }}
                    placeholder="Min"
                  />
                  <span style={{ padding: '6px 0' }}>—</span>
                  <Input 
                    type="number" 
                    value={tier.maxRevenue || ''} 
                    onChange={(e) => handleUpdateTier(i, 'maxRevenue', e.target.value ? parseFloat(e.target.value) : null)}
                    style={{ width: 100, fontSize: 12 }}
                    placeholder="Max (bo'sh = unlimited)"
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 4 }}>Commission %:</div>
                <Input 
                  type="number" 
                  value={tier.commissionPercent} 
                  onChange={(e) => handleUpdateTier(i, 'commissionPercent', parseFloat(e.target.value) || 0)}
                  min="0" max="100"
                  style={{ fontSize: 12 }}
                />
              </div>
              <Btn size="sm" variant="danger" onClick={() => handleRemoveTier(i)} style={{ alignSelf: 'flex-end' }}>🗑</Btn>
            </div>
          </Card>
        ))}
      </div>

      {/* Add new tier */}
      <Card style={{ padding: 14, background: 'var(--bg-2)', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>➕ Yanyi Tier Qo'shish</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Input 
            type="number" 
            value={newTier.minRevenue} 
            onChange={(e) => setNewTier({ ...newTier, minRevenue: parseFloat(e.target.value) || 0 })}
            placeholder="Min daromad"
            style={{ flex: 1 }}
          />
          <Input 
            type="number" 
            value={newTier.maxRevenue || ''} 
            onChange={(e) => setNewTier({ ...newTier, maxRevenue: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="Max daromad (ixtiyoriy)"
            style={{ flex: 1 }}
          />
          <Input 
            type="number" 
            value={newTier.commissionPercent} 
            onChange={(e) => setNewTier({ ...newTier, commissionPercent: parseFloat(e.target.value) || 0 })}
            min="0" max="100"
            placeholder="Commission %"
            style={{ flex: 1 }}
          />
          <Btn onClick={handleAddTier}>Qo'sh</Btn>
        </div>
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={handleSave} loading={saving}>💾 Saqlash</Btn>
        <Btn variant="secondary" onClick={() => load()}>↺ Bekor</Btn>
      </div>

      {/* Info */}
      <Card style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)' }}>
        <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: '1.6' }}>
          <strong>📌 Qanday ishlaydi:</strong><br/>
          Agent daromadi qancha bo'lsa, shunga mos foiz qo'llaniladi.<br/>
          Misol: Agar daromad 2500 bo'lsa, 2000-4000 tier'ni qo'llaydi (10%)
        </div>
      </Card>
    </>
  );
}

// ─── Personal Telegram Account Modal (MTProto phone auth) ─────────────────────
function PersonalAccountModal({ onClose, onConnected }: any) {
  const [step, setStep] = useState<'phone' | 'code' | '2fa' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showApiFields, setShowApiFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp: any = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 14, boxSizing: 'border-box', marginBottom: 10 };

  async function sendCode() {
    if (!phone.trim()) { setError('Telefon raqami kerak'); return; }
    setLoading(true); setError('');
    try {
      const { userTelegramApi } = await import('@/services/api');
      const res = await userTelegramApi.sendCode(
        phone.trim(),
        apiId ? parseInt(apiId) : undefined,
        apiHash || undefined
      );
      if ((res.data as any).status === 'already_connected') {
        toast.success('Account allaqachon ulangan!');
        onConnected();
        return;
      }
      setStep('code');
    } catch (e: any) {
      setError(errMsg(e));
    } finally { setLoading(false); }
  }

  async function verifyCode() {
    if (!code.trim()) { setError('Kodni kiriting'); return; }
    setLoading(true); setError('');
    try {
      const { userTelegramApi } = await import('@/services/api');
      const res = await userTelegramApi.verifyCode(
        phone.trim(), code.trim(),
        apiId ? parseInt(apiId) : undefined,
        apiHash || undefined
      );
      if ((res.data as any).status === 'need_2fa') {
        setStep('2fa');
      } else {
        setStep('done');
        toast.success('✅ ' + ((res.data as any).message || 'Ulandi!'));
        setTimeout(() => onConnected(), 1500);
      }
    } catch (e: any) {
      setError(errMsg(e));
    } finally { setLoading(false); }
  }

  async function verify2FA() {
    if (!password.trim()) { setError('Parolni kiriting'); return; }
    setLoading(true); setError('');
    try {
      const { userTelegramApi } = await import('@/services/api');
      await userTelegramApi.verify2FA(
        phone.trim(), password.trim(),
        apiId ? parseInt(apiId) : undefined,
        apiHash || undefined
      );
      setStep('done');
      toast.success('✅ Shaxsiy account ulandi!');
      setTimeout(() => onConnected(), 1500);
    } catch (e: any) {
      setError(errMsg(e));
    } finally { setLoading(false); }
  }

  return (
    <Modal open onClose={onClose} title="📱 Shaxsiy Telegram Account ulash" maxWidth={480}>
      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['phone','1. Raqam'],['code','2. Kod'],['2fa','3. Parol (ixtiyoriy)'],['done','✅']].map(([s, label]) => (
          <div key={s} style={{
            flex: 1, padding: '5px 4px', borderRadius: 7, textAlign: 'center',
            fontSize: 11, fontWeight: 600,
            background: step === s ? '#3d7eff' : (
              ['phone','code','2fa','done'].indexOf(s) < ['phone','code','2fa','done'].indexOf(step)
                ? '#10b98130' : 'var(--bg-3)'
            ),
            color: step === s ? 'white' : 'var(--fg-3)',
          }}>{label}</div>
        ))}
      </div>

      {step === 'phone' && (
        <div>
          <div style={{ padding: 12, background: '#3d7eff15', borderRadius: 10, marginBottom: 16, fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.7 }}>
            <b>🚀 Shaxsiy account bilan nima qilish mumkin:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              <li>Klientlarga <b>birinchi bo'lib</b> xabar yuboring</li>
              <li>Klient /start yozmagan bo'lsa ham xabar boring</li>
              <li>Xabarlar sizning ismingiz bilan ketadi</li>
            </ul>
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Telefon raqamingiz *</label>
          <input
            style={inp}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998901234567"
            onKeyDown={e => e.key === 'Enter' && sendCode()}
          />

          <button
            onClick={() => setShowApiFields(!showApiFields)}
            style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 12, marginBottom: 10, textDecoration: 'underline' }}
          >
            {showApiFields ? '▲ API sozlamalarini yashirish' : '▼ API ID/Hash (ixtiyoriy)'}
          </button>

          {showApiFields && (
            <div style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>
                Agar standart sozlamalar ishlamasa, <a href="https://my.telegram.org/apps" target="_blank" style={{ color: '#3d7eff' }}>my.telegram.org/apps</a> dan oling
              </div>
              <input style={{ ...inp, marginBottom: 8 }} value={apiId} onChange={e => setApiId(e.target.value)} placeholder="API ID (raqam)" />
              <input style={inp} value={apiHash} onChange={e => setApiHash(e.target.value)} placeholder="API Hash (matn)" />
            </div>
          )}

          {error && <div style={{ padding: '8px 12px', background: '#ef444415', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer', fontSize: 13 }}>Bekor</button>
            <button onClick={sendCode} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              {loading ? 'Yuklanmoqda...' : '📱 Kod yuborish'}
            </button>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 40 }}>📬</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>Telegram ilovangizni oching</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>
              <b>{phone}</b> raqamiga kod yuborildi.<br />Telegram ilovasidagi xabarga qarang.
            </div>
          </div>
          <input
            style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="· · · · · ·"
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && verifyCode()}
            autoFocus
          />
          {error && <div style={{ padding: '8px 12px', background: '#ef444415', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('phone')} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer', fontSize: 13 }}>← Orqaga</button>
            <button onClick={verifyCode} disabled={loading || code.length < 5} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              {loading ? '...' : '✅ Tasdiqlash'}
            </button>
          </div>
        </div>
      )}

      {step === '2fa' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 40 }}>🔐</div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>Ikki bosqichli autentifikatsiya</div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>Telegram account parolingizni kiriting</div>
          </div>
          <input
            type="password"
            style={inp}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="2FA parol"
            onKeyDown={e => e.key === 'Enter' && verify2FA()}
            autoFocus
          />
          {error && <div style={{ padding: '8px 12px', background: '#ef444415', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button onClick={verify2FA} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {loading ? '...' : '🔓 Kirish'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 60 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>Ulandi!</div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 6 }}>Shaxsiy Telegram accountingiz muvaffaqiyatli ulandi</div>
        </div>
      )}
    </Modal>
  );
}

// ─── Instagram Lead Bot Tab ───────────────────────────────────────────────────
function WhatsAppTab() {
  const [cfg, setCfg] = useState({ instanceId: '', token: '', webhookUrl: '' });
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', message: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      import('@/services/api').then(m => m.whatsappApi.getConfig()),
      import('@/services/api').then(m => m.whatsappApi.getStatus()),
    ]).then(([cfgRes, statusRes]) => {
      const c = cfgRes.data;
      if (c?.connected) setCfg(p => ({ ...p, instanceId: c.instanceId || '', webhookUrl: c.webhookUrl || '' }));
      setStatus(statusRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function saveConfig() {
    if (!cfg.instanceId.trim() || !cfg.token.trim()) { toast.error('Instance ID va Token majburiy'); return; }
    setSaving(true);
    try {
      const { whatsappApi } = await import('@/services/api');
      await whatsappApi.saveConfig(cfg);
      toast.success('✅ WhatsApp sozlandi!');
      const s = await whatsappApi.getStatus();
      setStatus(s.data);
    } catch (e: any) { toast.error(errMsg(e)); } finally { setSaving(false); }
  }

  async function sendMsg() {
    if (!sendForm.to.trim() || !sendForm.message.trim()) { toast.error('Telefon va xabar majburiy'); return; }
    setSending(true);
    try {
      const { whatsappApi } = await import('@/services/api');
      await whatsappApi.send(sendForm);
      toast.success('✅ Xabar yuborildi!');
      setSendForm({ to: '', message: '' });
    } catch (e: any) { toast.error(errMsg(e)); } finally { setSending(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>;

  const isConnected = status?.status === 'authenticated';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 32 }}>📱</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>WhatsApp (UltraMsg)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? 'var(--success)' : '#94a3b8' }} />
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                {isConnected ? `Ulangan${status?.phoneNumber ? ` · ${status.phoneNumber}` : ''}` : 'Ulanmagan'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <Label>Instance ID *</Label>
            <Input value={cfg.instanceId} onChange={e => setCfg({...cfg, instanceId: e.target.value})} placeholder="instance123456" />
          </div>
          <div>
            <Label>Token *</Label>
            <Input type="password" value={cfg.token} onChange={e => setCfg({...cfg, token: e.target.value})} placeholder="••••••••" />
          </div>
        </div>
        <Label>Webhook URL (UltraMsg panelida kiriting)</Label>
        <Input value={cfg.webhookUrl} onChange={e => setCfg({...cfg, webhookUrl: e.target.value})}
          placeholder="https://api.sizning-domen.uz/api/v1/public/whatsapp/webhook/TENANT_ID"
          style={{ marginBottom: 12, fontSize: 11, fontFamily: 'monospace' }} />
        <Btn onClick={saveConfig} loading={saving} variant="gradient">💾 Saqlash</Btn>
      </Card>

      {isConnected && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Test xabar</div>
          <Label>Telefon</Label>
          <Input value={sendForm.to} onChange={e => setSendForm({...sendForm, to: e.target.value})} placeholder="+998901234567" style={{ marginBottom: 10 }} />
          <Label>Xabar</Label>
          <textarea value={sendForm.message} onChange={e => setSendForm({...sendForm, message: e.target.value})}
            placeholder="Xabar..." style={{ width: '100%', minHeight: 72, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' as const, marginBottom: 12 }} />
          <Btn onClick={sendMsg} loading={sending}>📤 Yuborish</Btn>
        </Card>
      )}

      <Card style={{ background: 'var(--bg-3)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 Qo'llanma</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--fg-2)', lineHeight: 2 }}>
          <li><a href="https://ultramsg.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>ultramsg.com</a> — ro'yxatdan o'ting (3 kun bepul)</li>
          <li>Yangi Instance yarating va QR kodni WhatsApp bilan skanlang</li>
          <li>Instance ID va Token ni kiriting → Saqlang</li>
          <li>Webhook URL ni UltraMsg panelida "Webhook URL" ga kiriting</li>
          <li>Tayyor! Xabarlar Inbox ga tushadi</li>
        </ol>
      </Card>
    </div>
  );
}

function InstagramTab() {
  const [cfg, setCfg] = useState<any>({
    accessToken: '', pageId: '', verifyToken: 'omoncrm_verify',
    botName: 'Travel Bot', greetingMessage: '', assignToAgentId: '',
  });
  const [stats, setStats] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  /**
   * TEZKOR ULANISH (v12.9).
   *
   * Instagram Business akkaunt Facebook Page'ga bog'langan bo'ladi va
   * ikkalasi BIR XIL Page Access Token bilan ishlaydi. Shuning uchun
   * Facebook orqali bir marta ulansa, backend Instagram sozlamasini
   * ham avtomatik to'ldiradi (facebook-leads OAuth callback).
   *
   * Ilgari bu yerda faqat qo'lda kiritish maydonlari bor edi va
   * foydalanuvchi tezkor yo'l borligini bilmasdi.
   */
  async function connectWithFacebook() {
    setConnecting(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const res: any = await facebookLeadsApi.getOAuthStartUrl();
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Facebook Login URL olinmadi");
        setConnecting(false);
      }
    } catch (e: any) {
      toast.error(errMsg(e));
      setConnecting(false);
    }
  }

  useEffect(() => {
    Promise.all([
      import('@/services/api').then(m => m.instagramApi.getConfig()),
      import('@/services/api').then(m => m.instagramApi.getStats()),
      import('@/services/api').then(m => m.usersApi.list()),
    ]).then(([cfgR, statsR, usersR]: any) => {
      const d = cfgR.data;
      setCfg({
        accessToken: d.accessToken || '',
        pageId: d.pageId || '',
        verifyToken: d.verifyToken || 'omoncrm_verify',
        botName: d.botName || 'Travel Bot',
        greetingMessage: d.greetingMessage || '',
        farewell: d.farewell || '',
        botSteps: d.botSteps || null,
        assignToAgentId: d.assignToAgentId || '',
      });
      setStats(statsR.data);
      const list = Array.isArray(usersR.data) ? usersR.data : (usersR.data?.data || []);
      setAgents(list.filter((u: any) => u.role === 'AGENT'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { instagramApi } = await import('@/services/api');
      await instagramApi.saveConfig(cfg);
      toast.success('Instagram sozlamalari saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-2)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--fg-2)',
    display: 'block', marginBottom: 5,
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>;

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const webhookUrl = `${API_BASE}/api/v1/instagram/webhook`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Jami Instagram leadlar', value: stats.total ?? 0, color: '#e1306c' },
            { label: 'Bu oy', value: stats.thisMonth ?? 0, color: '#f97316' },
            { label: 'Faol suhbatlar', value: stats.activeSessions ?? 0, color: '#3d7eff' },
          ].map((s, i) => (
            <Card key={i} style={{ textAlign: 'center', padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Setup instructions */}
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>📋 Meta Developer sozlash</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.9, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
          <b>1.</b> <a href="https://developers.facebook.com" target="_blank" style={{ color: '#3d7eff' }}>developers.facebook.com</a> → My Apps → Create App<br />
          <b>2.</b> App → Instagram → Settings → Basic → Access Token oling<br />
          <b>3.</b> App → Webhooks → Instagram → Subscribe → quyidagi URL kiriting:<br />
          <code style={{ display: 'block', background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 6, margin: '6px 0', fontSize: 11, wordBreak: 'break-all' }}>
            {webhookUrl}
          </code>
          <b>4.</b> Verify Token: serverdagi <code>INSTAGRAM_VERIFY_TOKEN</code> env qiymatini kiriting (barcha tenantlar uchun umumiy)<br />
          <b>5.</b> Subscribe: <code>messages</code> va <code>messaging_postbacks</code><br />
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(225,48,108,0.1)', borderRadius: 6, color: '#e1306c' }}>
            ⚠️ Bu webhook manzili <b>bitta Meta App uchun umumiy</b> — barcha tenantlar shu bitta URL orqali ishlaydi.
            Tenant avtomatik ravishda pastda kiritilgan <b>Page ID</b> orqali aniqlanadi, shuning uchun har bir
            tenant o'z Page ID va Access Tokenini to'g'ri kiritishi shart.
          </div>
        </div>
      </Card>


      {/* ── TEZKOR ULANISH (v12.9) ── */}
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>⚡ Tezkor ulanish</h3>

        {cfg.hasAccessToken ? (
          <div style={{
            padding: '12px 14px', background: 'rgba(16,185,129,0.1)',
            border: '1px solid #10b981', borderRadius: 10, fontSize: 13,
            color: 'var(--fg-2)', lineHeight: 1.7,
          }}>
            ✅ <b>Instagram ulangan.</b> Page ID: <code>{cfg.pageId || '—'}</code>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              DM'lar Chat bo'limiga tushadi. Ulanishni yangilash uchun
              quyidagi tugmani qayta bosing.
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 14px', background: 'var(--bg-3)',
            borderRadius: 10, fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.7,
          }}>
            Instagram Business akkauntingiz Facebook Page'ga bog'langan bo'lsa,
            <b> quyidagi bitta tugma</b> bilan ulanadi — token va ID'ni qo'lda
            kiritish shart emas.
          </div>
        )}

        <button
          onClick={connectWithFacebook}
          disabled={connecting}
          style={{
            marginTop: 12, width: '100%', padding: '12px 16px',
            borderRadius: 10, border: 'none',
            background: connecting ? 'var(--bg-4)' : '#1877f2',
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: connecting ? 'default' : 'pointer',
          }}
        >
          {connecting
            ? "Yo'naltirilmoqda..."
            : (cfg.hasAccessToken ? '🔄 Ulanishni yangilash' : '📘 Facebook orqali ulash')}
        </button>

        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 10, lineHeight: 1.7 }}>
          <b>Shartlar:</b> Instagram akkaunt <b>Business</b> yoki <b>Creator</b> turida
          bo'lishi va Facebook Page'ga bog'langan bo'lishi kerak.
          Bitta ulanish Facebook Leads va Instagram DM — ikkalasini ham yoqadi.
        </div>
      </Card>

      {/* Config form */}
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>⚙️ Instagram Bot sozlamalari</h3>
        <div style={{
          fontSize: 12, color: 'var(--fg-3)', marginBottom: 14, lineHeight: 1.7,
        }}>
          Yuqoridagi tezkor ulanishdan foydalansangiz, Access Token va Page ID
          <b> avtomatik to'ldiriladi</b>. Quyidagilar faqat qo'lda sozlash yoki
          bot matnlarini o'zgartirish uchun.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Access Token (Page Token) *</label>
            {/* v13.0: server endi ochiq tokenni QAYTARMAYDI (xavfsizlik).
                Maydon bo'sh turadi; mavjud token maskalangan holda
                pastda ko'rsatiladi. Bo'sh qoldirilsa eski token saqlanadi. */}
            <input
              style={inp}
              value={cfg.accessToken || ''}
              onChange={e => setCfg({ ...cfg, accessToken: e.target.value })}
              placeholder={cfg.maskedAccessToken || 'EAAG...'}
              type="password"
              autoComplete="new-password"
            />
            {cfg.hasAccessToken && !cfg.accessToken && (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                Saqlangan token: <code>{cfg.maskedAccessToken}</code> — o'zgartirmoqchi
                bo'lsangizgina yangisini kiriting.
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>Page ID</label>
            <input style={inp} value={cfg.pageId} onChange={e => setCfg({ ...cfg, pageId: e.target.value })} placeholder="123456789" />
          </div>
          <div>
            <label style={lbl}>Verify Token</label>
            <input style={inp} value={cfg.verifyToken} onChange={e => setCfg({ ...cfg, verifyToken: e.target.value })} placeholder="omoncrm_verify" />
          </div>
          <div>
            <label style={lbl}>Bot nomi</label>
            <input style={inp} value={cfg.botName} onChange={e => setCfg({ ...cfg, botName: e.target.value })} placeholder="Travel Bot" />
          </div>
          <div>
            <label style={lbl}>Leadni kim qabul qilsin</label>
            <select style={inp} value={cfg.assignToAgentId} onChange={e => setCfg({ ...cfg, assignToAgentId: e.target.value })}>
              <option value="">Avtomatik (birinchi agent)</option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Birinchi xabar (greeting)</label>
            <textarea
              style={{ ...inp, minHeight: 80, resize: 'vertical' }}
              value={cfg.greetingMessage}
              onChange={e => setCfg({ ...cfg, greetingMessage: e.target.value })}
              placeholder="Salom! Ismingizni yuboring."
            />
          </div>
        </div>

        {/* Dynamic bot steps editor */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={lbl}>Bot savollari tartibi</label>
            <button onClick={() => {
              const newSteps = [...(cfg.botSteps || []), { id: Date.now().toString(), question: '', field: 'custom_' + Date.now() }];
              setCfg({ ...cfg, botSteps: newSteps });
            }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              + Savol qosh
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(cfg.botSteps || [
              { id: 'name', question: 'Ismingizni yozing', field: 'name' },
              { id: 'destination', question: 'Qayerga bormoqchisiz?', field: 'destination' },
              { id: 'phone', question: 'Telefon raqamingiz?', field: 'phone' },
              { id: 'date', question: 'Qachon ketmoqchisiz?', field: 'date' },
            ]).map((step: any, i: number) => (
              <div key={step.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 100px auto', gap: 6, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <input
                  style={{ ...inp, marginBottom: 0 }}
                  value={step.question}
                  onChange={e => {
                    const steps = [...(cfg.botSteps || [])];
                    steps[i] = { ...steps[i], question: e.target.value };
                    setCfg({ ...cfg, botSteps: steps });
                  }}
                  placeholder="Savol matni..."
                />
                <select style={{ ...inp, marginBottom: 0 }} value={step.field} onChange={e => {
                  const steps = [...(cfg.botSteps || [])];
                  steps[i] = { ...steps[i], field: e.target.value };
                  setCfg({ ...cfg, botSteps: steps });
                }}>
                  <option value="name">Ism</option>
                  <option value="destination">Yonalish</option>
                  <option value="phone">Telefon</option>
                  <option value="date">Sana</option>
                  <option value={'custom_' + i}>Boshqa</option>
                </select>
                <button onClick={() => {
                  const steps = (cfg.botSteps || []).filter((_: any, idx: number) => idx !== i);
                  setCfg({ ...cfg, botSteps: steps });
                }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--danger-soft)', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Yakuniy xabar (farewell)</label>
            <input style={inp} value={cfg.farewell || ''} onChange={e => setCfg({ ...cfg, farewell: e.target.value })} placeholder="Rahmat! Tez orada boglanamiz." />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: '#e1306c', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Saqlanmoqda...' : '💾 Saqlash'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FACEBOOK LEAD ADS TAB
// ═══════════════════════════════════════════════════════════════════
// Backend qaytaradigan errorType'ni foydalanuvchiga tushunarli, harakatga
// undovchi matnga aylantiradi — "Nega ko'rinmayapti?" savoliga javob.
function facebookErrorLabel(errorType: string, message?: string): { title: string; hint: string } {
  switch (errorType) {
    case 'NO_ADMIN_ACCESS':
      return {
        title: '🔒 Sizda bu Page uchun yetarli huquq yo\'q',
        hint: 'Business Manager → Page Settings → Page Roles orqali "Manage Page" yoki "Advertise" vazifasini oling, so\'ng qayta tekshiring.',
      };
    case 'MISSING_PERMISSIONS':
      return {
        title: '⚠️ Facebook ruxsatlari to\'liq berilmagan',
        hint: '"Boshqa Page bilan ulash" tugmasi orqali qaytadan ulaning va Facebook so\'ragan barcha ruxsatlarga rozilik bering.',
      };
    case 'INVALID_TOKEN':
      return {
        title: '⏰ Token muddati tugagan',
        hint: '"Boshqa Page bilan ulash" tugmasini bosib, qaytadan ulaning — yangi token avtomatik olinadi.',
      };
    case 'NO_PAGES':
      return {
        title: '📭 Boshqariladigan Page topilmadi',
        hint: 'Facebook akkauntingizda kamida bitta Page administratori ekaningizga ishonch hosil qiling.',
      };
    default:
      return {
        title: '❓ Noma\'lum xato yuz berdi',
        hint: message || 'Iltimos, "Nega ishlamayapti?" tashxis tugmasidan foydalaning yoki qayta urinib ko\'ring.',
      };
  }
}

function FacebookLeadsTab() {
  const router = useRouter();
  const [cfg, setCfg] = useState<any>({
    accessToken: '', pageId: '', pageName: '',
    verifyToken: 'omoncrm_fb_verify', assignToAgentId: '',
  });
  const [hasToken, setHasToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pendingPages, setPendingPages] = useState<any[]>([]);
  // Lead formalar + webhook obuna holati (ko'rinadigan tasdiq + self-heal)
  const [formsInfo, setFormsInfo] = useState<any>(null);
  const [formsLoading, setFormsLoading] = useState(false);
  // "Nega ishlamayapti?" tashxis
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  // Xato bo'lgan leadlar ro'yxati + qo'lda qayta ishlash
  const [failedEvents, setFailedEvents] = useState<any[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  // Qo'lda backfill (Meta'dan o'tkazib yuborilgan leadlarni tortib olish)
  const [backfilling, setBackfilling] = useState(false);

  async function checkForms() {
    setFormsLoading(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const r: any = await facebookLeadsApi.listForms();
      setFormsInfo(r.data);
      if (r.data?.connected) {
        toast.success(
          r.data.leadgenSubscribed
            ? `✅ Webhook ulangan · ${r.data.forms?.length || 0} ta forma topildi`
            : "⚠️ Formalar topildi, lekin webhook obunasi tasdiqlanmadi",
        );
      } else {
        toast.error("Avval Page'ni ulang");
      }
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setFormsLoading(false); }
  }

  async function runDiagnose() {
    setDiagnosing(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const r: any = await facebookLeadsApi.diagnose();
      setDiagnosis(r.data);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setDiagnosing(false); }
  }

  async function loadFailed() {
    setFailedLoading(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const r: any = await facebookLeadsApi.listFailed();
      setFailedEvents(r.data?.data || []);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setFailedLoading(false); }
  }

  async function retryOneEvent(id: string) {
    setRetryingId(id);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      await facebookLeadsApi.retryOne(id);
      toast.success('Qayta navbatga qo\'yildi');
      await loadFailed();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setRetryingId(null); }
  }

  async function retryAllEvents() {
    setRetryingAll(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const r: any = await facebookLeadsApi.retryAll();
      toast.success(`${r.data?.requeued ?? 0} ta lead qayta navbatga qo'yildi`);
      await loadFailed();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setRetryingAll(false); }
  }

  async function runManualBackfill() {
    setBackfilling(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const r: any = await facebookLeadsApi.runBackfill();
      toast.success(r.data?.message || 'Backfill tugadi');
      await Promise.all([loadAll(), loadFailed()]);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setBackfilling(false); }
  }

  async function loadAll() {
    try {
      const [cfgR, statsR, usersR]: any = await Promise.all([
        import('@/services/api').then(m => m.facebookLeadsApi.getConfig()),
        import('@/services/api').then(m => m.facebookLeadsApi.getStats()),
        import('@/services/api').then(m => m.usersApi.list()),
      ]);
      const d = cfgR.data;
      setCfg({
        accessToken: '', // xavfsizlik: to'liq token hech qachon qaytarilmaydi
        pageId: d.pageId || '',
        pageName: d.pageName || '',
        verifyToken: d.verifyToken || 'omoncrm_fb_verify',
        assignToAgentId: d.assignToAgentId || '',
      });
      setHasToken(!!d.hasAccessToken);
      setMaskedToken(d.maskedAccessToken || '');
      setStats(statsR.data);
      const list = Array.isArray(usersR.data) ? usersR.data : (usersR.data?.data || []);
      setAgents(list.filter((u: any) => u.role === 'AGENT'));
    } catch {
      /* jim */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Page ulangan bo'lsa — formalar va webhook holatini avtomatik bir marta tekshiramiz
  useEffect(() => {
    if (hasToken) {
      checkForms();
      loadFailed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // Facebook Login orqali qaytgandan keyingi natijani ko'rsatish
  // (?tab=facebook&fb=success|choose|denied|nopages|error|...)
  //
  // TUZATILDI: ilgari faqat success/choose/denied/nopages/error holatlari
  // ko'rsatilardi. Backend (`handleOAuthCallback`) esa yana quyidagi
  // kodlarni ham qaytaradi:
  //   no_admin_access, missing_permissions, invalid_token —
  //     ulanish umuman muvaffaqiyatsiz, sabab aniq
  //   connected_no_admin_access, connected_subscribe_failed —
  //     Page SAQLANDI, lekin "leadgen" hodisasiga obuna bo'lmadi
  //     (aynan ruxsat/permissions xatosi) — bu holatda hech qanday
  //     xabar chiqmasdi va admin nima bo'lganini bilmasdi.
  // Bundan tashqari backend yuborgan `fbMsg` (Meta'ning aniq xato matni)
  // umuman o'qilmasdi.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get('fb');
    if (!fb) return;
    const fbMsg = params.get('fbMsg') || '';
    const detail = fbMsg ? ` — ${fbMsg}` : '';

    if (fb === 'success') {
      toast.success('✅ Facebook Page muvaffaqiyatli ulandi!');
      loadAll();
    } else if (fb === 'choose') {
      toast('Bir nechta Page topildi — birini tanlang 👇');
      import('@/services/api').then(m => m.facebookLeadsApi.getPendingPages())
        .then((r: any) => setPendingPages(r.data?.pages || []))
        .catch(() => {});
    } else if (fb === 'denied') {
      toast.error("Facebook ulanishi bekor qilindi");
    } else if (fb === 'nopages') {
      toast.error("Bu Facebook akkauntida siz boshqaradigan Page topilmadi");
    } else if (fb === 'no_admin_access') {
      toast.error(`Page uchun admin huquqi yo'q${detail}. Page egasidan Business Manager orqali "Manage Page" huquqini so'rang.`, { duration: 8000 });
    } else if (fb === 'missing_permissions') {
      toast.error(`Facebook ruxsatlari yetarli emas${detail}. Qaytadan ulanishda barcha so'ralgan ruxsatlarni tasdiqlang.`, { duration: 8000 });
    } else if (fb === 'invalid_token') {
      toast.error(`Facebook token yaroqsiz${detail}. Qaytadan ulaning.`, { duration: 8000 });
    } else if (fb === 'token_exchange_failed') {
      toast.error(`Facebook uzoq muddatli token olishda xatolik${detail}. Bir necha daqiqadan so'ng qaytadan urinib ko'ring, davom etsa administratorga murojaat qiling.`, { duration: 10000 });
    } else if (fb === 'connected_no_admin_access') {
      toast.error(`Page ulandi, lekin leadlar kelmaydi: admin huquqi yetarli emas${detail}. Page egasidan "Manage Page" huquqini so'rang, so'ng "Nega ishlamayapti?" tugmasini bosing.`, { duration: 10000 });
      loadAll();
    } else if (fb === 'connected_subscribe_failed') {
      toast.error(`Page ulandi, lekin "leadgen" hodisasiga obuna bo'lmadi${detail}. "Nega ishlamayapti?" tugmasini bosib sababini ko'ring.`, { duration: 10000 });
      loadAll();
    } else if (fb === 'error') {
      toast.error(`Facebook ulanishida xatolik yuz berdi${detail}`);
    } else {
      // Noma'lum kod kelsa ham jim qolmasin
      toast.error(`Facebook ulanishida kutilmagan holat: ${fb}${detail}`);
    }

    // URL'ni tozalab qo'yamiz — sahifa qayta yuklanganda qayta ishlanmasin
    router.replace('/settings?tab=facebook');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectWithFacebook() {
    setConnecting(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const res: any = await facebookLeadsApi.getOAuthStartUrl();
      if (res.data?.url) {
        window.location.href = res.data.url; // Facebook login oynasiga o'tadi
      } else {
        toast.error("Facebook Login URL olinmadi");
        setConnecting(false);
      }
    } catch (e: any) {
      toast.error(errMsg(e));
      setConnecting(false);
    }
  }

  async function choosePage(pageId: string) {
    setSaving(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const res: any = await facebookLeadsApi.selectPage(pageId);
      setHasToken(!!res.data?.hasAccessToken);
      setMaskedToken(res.data?.maskedAccessToken || '');
      setCfg((c: any) => ({ ...c, pageId: res.data?.pageId || '', pageName: res.data?.pageName || '' }));
      setPendingPages([]);
      toast.success(`✅ "${res.data?.pageName || 'Page'}" ulandi`);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const { facebookLeadsApi } = await import('@/services/api');
      const res: any = await facebookLeadsApi.saveConfig(cfg);
      setHasToken(!!res.data?.hasAccessToken);
      setMaskedToken(res.data?.maskedAccessToken || '');
      setCfg((c: any) => ({ ...c, accessToken: '' }));
      toast.success('Facebook sozlamalari saqlandi');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-2)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--fg-2)',
    display: 'block', marginBottom: 5,
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Yuklanmoqda...</div>;

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const webhookUrl = `${API_BASE}/api/v1/facebook-leads/webhook`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {[
            { label: 'Jami Facebook leadlar', value: stats.total ?? 0, color: '#1877f2' },
            { label: 'Bu oy', value: stats.thisMonth ?? 0, color: '#f97316' },
          ].map((s, i) => (
            <Card key={i} style={{ textAlign: 'center', padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Setup instructions */}
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>📋 Meta Developer sozlash (Lead Ads)</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.9, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
          <b>1.</b> <a href="https://developers.facebook.com" target="_blank" style={{ color: '#3d7eff' }}>developers.facebook.com</a> → My Apps → mavjud App (yoki Instagram uchun yaratgan App'ingiz)<br />
          <b>2.</b> App → Add Product → <b>Webhooks</b><br />
          <b>3.</b> Object turi: <b>Page</b> ni tanlang → Callback URL'ga quyidagini kiriting:<br />
          <code style={{ display: 'block', background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 6, margin: '6px 0', fontSize: 11, wordBreak: 'break-all' }}>
            {webhookUrl}
          </code>
          <b>4.</b> Verify Token: serverdagi <code>FACEBOOK_VERIFY_TOKEN</code> env qiymatini kiriting<br />
          <b>5.</b> Subscribe fields: <code>leadgen</code><br />
          <b>6.</b> Facebook Page'ingizni App'ga ulang (Page Settings → Advanced Messaging yoki App Dashboard → Facebook Login for Business orqali Page Access Token oling)<br />
          <b>7.</b> Ads Manager'da "Leads" maqsadli kampaniya + Instant Form yarating<br />
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(24,119,242,0.1)', borderRadius: 6, color: '#1877f2' }}>
            ⚠️ Bu webhook manzili <b>bitta Meta App uchun umumiy</b> — barcha tenantlar shu bitta URL orqali ishlaydi.
            Tenant avtomatik ravishda pastda kiritilgan <b>Page ID</b> orqali aniqlanadi, shuning uchun har bir
            tenant o'z Page ID va Access Tokenini to'g'ri kiritishi shart.
          </div>
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(34,197,94,0.1)', borderRadius: 6, color: '#16a34a' }}>
            ✅ 6-qadamni qo'lda bajarish shart emas — pastdagi <b>"Facebook orqali ulash"</b> tugmasi orqali
            Page ID va Access Token avtomatik olinadi.
          </div>
        </div>
      </Card>

      {/* Bitta tugma bilan ulash (OAuth) — token/ID qo'lda kiritish shart emas */}
      <Card style={{ border: '1px solid #1877f2', background: 'rgba(24,119,242,0.06)' }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>🚀 Tezkor ulanish (tavsiya etiladi)</h3>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.7, marginTop: 0 }}>
          Tugmani bosing, Facebook'da o'z akkauntingiz bilan kiring va ruxsat bering —
          Page ID va Access Token avtomatik olinadi va saqlanadi. Login/parolingiz
          hech qachon CRM serveriga tushmaydi, buni Facebook'ning o'zi boshqaradi.
        </p>
        <button
          onClick={connectWithFacebook}
          disabled={connecting}
          style={{
            padding: '11px 22px', borderRadius: 9, border: 'none',
            background: '#1877f2', color: 'white', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, display: 'inline-flex',
            alignItems: 'center', gap: 8,
          }}
        >
          {connecting ? 'Yo\'naltirilmoqda...' : <> {hasToken ? '🔄 Boshqa Page bilan ulash' : '📘 Facebook orqali ulash'}</>}
        </button>
      </Card>

      {/* Lead formalar + webhook holati — ko'rinadigan tasdiq va self-heal */}
      {hasToken && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>📋 Lead formalar va webhook</h3>
              <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0', maxWidth: 480, lineHeight: 1.5 }}>
                Reklamadagi <b>har qanday forma</b> shu ulangan Page orqali CRM'ga tushadi —
                formani alohida ulash shart emas. Quyida Page'dagi formalar va webhook holati ko'rinadi.
              </p>
            </div>
            <button onClick={checkForms} disabled={formsLoading} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
              color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: formsLoading ? 0.6 : 1, flexShrink: 0,
            }}>
              {formsLoading ? 'Tekshirilmoqda...' : '🔄 Tekshirish / Yangilash'}
            </button>
          </div>

          {formsInfo && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                background: formsInfo.leadgenSubscribed ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                color: formsInfo.leadgenSubscribed ? '#16a34a' : '#d97706',
              }}>
                {formsInfo.leadgenSubscribed ? '✅ Webhook ulangan (leadgen)' : '⚠️ Webhook obunasi tasdiqlanmadi — "Tekshirish"ni qayta bosing'}
              </div>

              {/* Aniq xato sababi — backend allaqachon errorType qaytaradi,
                  shu yerda foydalanuvchiga tushunarli qilib ko'rsatamiz. */}
              {formsInfo.error && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.25)',
                }}>
                  {(() => {
                    const { title, hint } = facebookErrorLabel(formsInfo.error.errorType, formsInfo.error.message);
                    return (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{title}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {(!formsInfo.forms || formsInfo.forms.length === 0) ? (
                  <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.6 }}>
                    Bu Page'da hali lead forma topilmadi. Facebook Ads Manager'da <b>Instant Form</b> yarating
                    (Ism + Telefon so'rang) — u avtomatik shu yerda ko'rinadi va leadlari CRM'ga tushadi.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {formsInfo.forms.map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'var(--bg-3)', borderRadius: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name || 'Nomsiz forma'}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 1 }}>ID: {f.id}{f.leadsCount != null && ` · ${f.leadsCount} lead`}</div>
                        </div>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: f.status === 'ACTIVE' ? 'rgba(34,197,94,.15)' : 'var(--bg-2)',
                          color: f.status === 'ACTIVE' ? '#16a34a' : 'var(--fg-3)',
                        }}>{f.status || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* "Nega ishlamayapti?" tashxis + qo'lda backfill */}
      {hasToken && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>🔧 Tashxis va tiklash</h3>
              <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0', maxWidth: 480, lineHeight: 1.5 }}>
                Lead kelmayotgan bo'lsa, avval shu tugmani bosing — token, huquqlar va
                navbat holatini bir zumda tekshirib beradi.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={runManualBackfill} disabled={backfilling} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: backfilling ? 0.6 : 1,
              }}>
                {backfilling ? 'Tortilmoqda...' : "📥 O'tkazib yuborilganlarni tortish"}
              </button>
              <button onClick={runDiagnose} disabled={diagnosing} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
                color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: diagnosing ? 0.6 : 1,
              }}>
                {diagnosing ? 'Tekshirilmoqda...' : '🩺 Nega ishlamayapti?'}
              </button>
            </div>
          </div>

          {diagnosis && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10,
              }}>
                {[
                  { label: 'Navbatda', value: diagnosis.queue?.pending ?? 0, color: '#f97316' },
                  { label: 'Xato', value: diagnosis.queue?.failed ?? 0, color: '#ef4444' },
                  { label: 'Tugallangan', value: diagnosis.queue?.done ?? 0, color: '#16a34a' },
                ].map((q, i) => (
                  <div key={i} style={{
                    padding: '6px 12px', borderRadius: 8, background: 'var(--bg-3)', fontSize: 12,
                  }}>
                    <b style={{ color: q.color }}>{q.value}</b>{' '}
                    <span style={{ color: 'var(--fg-3)' }}>{q.label}</span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: diagnosis.recommendation === 'OK' ? 'rgba(34,197,94,.10)' : 'rgba(245,158,11,.10)',
                border: `1px solid ${diagnosis.recommendation === 'OK' ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.25)'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: diagnosis.recommendation === 'OK' ? '#16a34a' : '#d97706' }}>
                  {diagnosis.recommendation === 'OK' ? '✅ Hammasi joyida' : '⚠️ Diqqat talab qilinadi'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4, lineHeight: 1.5 }}>
                  {diagnosis.message}
                </div>
                {!!diagnosis.missingTasks?.length && (
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 6 }}>
                    Yetishmayotgan vazifalar: {diagnosis.missingTasks.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Xato bo'lgan leadlar — qo'lda qayta ishlash */}
      {hasToken && (stats?.queueFailed > 0 || failedEvents.length > 0) && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>❌ Xato bo'lgan leadlar</h3>
              <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0', maxWidth: 480, lineHeight: 1.5 }}>
                Bu leadlar qayta ishlanmagan (masalan, token muddati tugagani uchun). Sababni
                tuzatgach, "Barchasini qayta urinish"ni bosing.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={loadFailed} disabled={failedLoading} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: failedLoading ? 0.6 : 1,
              }}>
                {failedLoading ? 'Yuklanmoqda...' : '🔄 Yangilash'}
              </button>
              {failedEvents.length > 0 && (
                <button onClick={retryAllEvents} disabled={retryingAll} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444',
                  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: retryingAll ? 0.6 : 1,
                }}>
                  {retryingAll ? 'Urinilmoqda...' : "🔁 Barchasini qayta urinish"}
                </button>
              )}
            </div>
          </div>

          {failedEvents.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {failedEvents.map((ev: any) => (
                <div key={ev.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '9px 11px', background: 'var(--bg-3)', borderRadius: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Lead ID: {ev.leadgenId}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 1 }}>
                      {ev.status} · {ev.attempts} urinish{ev.lastError ? ` · ${String(ev.lastError).slice(0, 80)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => retryOneEvent(ev.id)}
                    disabled={retryingId === ev.id}
                    style={{
                      padding: '5px 12px', borderRadius: 999, border: 'none', flexShrink: 0,
                      background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, opacity: retryingId === ev.id ? 0.6 : 1,
                    }}
                  >
                    {retryingId === ev.id ? '...' : '🔁 Qayta urinish'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bir nechta Page topilganda tanlash */}
      {pendingPages.length > 0 && (
        <Card style={{ border: '1px solid #f97316' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>👇 Qaysi Page'ni ulaymiz?</h3>
          <p style={{ fontSize: 12.5, color: 'var(--fg-2)', marginTop: 0 }}>
            Akkauntingizda bir nechta Page topildi. Lead qabul qiladigan Page'ni tanlang.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingPages.map((p: any) => (
              <button
                key={p.id}
                onClick={() => choosePage(p.id)}
                disabled={saving}
                style={{
                  textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-2)',
                  color: 'var(--fg)', cursor: 'pointer', fontSize: 13,
                }}
              >
                <b>{p.name}</b>{' '}
                <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>(ID: {p.id})</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Qo'lda kiritish (ixtiyoriy — masalan boshqa server orqali oldindan olingan token bo'lsa) */}
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>⚙️ Qo'lda ulash (ixtiyoriy)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>
              Page Access Token {hasToken && <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ ulangan ({maskedToken})</span>}
            </label>
            <input
              style={inp}
              value={cfg.accessToken}
              onChange={e => setCfg({ ...cfg, accessToken: e.target.value })}
              placeholder={hasToken ? 'Yangilash uchun yangi token kiriting...' : 'EAAG...'}
              type="password"
            />
          </div>
          <div>
            <label style={lbl}>Page ID</label>
            <input style={inp} value={cfg.pageId} onChange={e => setCfg({ ...cfg, pageId: e.target.value })} placeholder="123456789" />
          </div>
          <div>
            <label style={lbl}>Page nomi (ixtiyoriy)</label>
            <input style={inp} value={cfg.pageName} onChange={e => setCfg({ ...cfg, pageName: e.target.value })} placeholder="Mening Turizm Sahifam" />
          </div>
          <div>
            <label style={lbl}>Verify Token</label>
            <input style={inp} value={cfg.verifyToken} onChange={e => setCfg({ ...cfg, verifyToken: e.target.value })} placeholder="omoncrm_fb_verify" />
          </div>
          <div>
            <label style={lbl}>Leadni kim qabul qilsin</label>
            <select style={inp} value={cfg.assignToAgentId} onChange={e => setCfg({ ...cfg, assignToAgentId: e.target.value })}>
              <option value="">Avtomatik (Round Robin)</option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: '#1877f2', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Saqlanmoqda...' : '💾 Saqlash'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// XAVFSIZLIK TAB — Parol, 2FA, faol sessiyalar, login tarixi
// ═══════════════════════════════════════════════════════════════════
function SecurityTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'TENANT_ADMIN';
  const [tab, setTab] = useState<'password' | '2fa' | 'sessions' | 'history'>('password');

  // v14: "Kirish tarixi" (login history) — faqat admin uchun. Agent uni ko'rmaydi.
  const tabs = ([
    ['password', '🔑 Parol'],
    ['2fa', '📱 2FA'],
    ['sessions', '💻 Sessiyalar'],
    ...(isAdmin ? [['history', '📋 Kirish tarixi']] : []),
  ] as [string, string][]);

  // Agent boshqa yo'l bilan 'history' tab'ida qolib ketmasin
  const activeTab = (!isAdmin && tab === 'history') ? 'password' : tab;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === id ? 'var(--primary-soft)' : 'var(--bg-3)',
              color: activeTab === id ? 'var(--primary)' : 'var(--fg-2)',
              fontSize: 12.5, fontWeight: activeTab === id ? 700 : 500,
            }}>{label}</button>
          ))}
        </div>

        {activeTab === 'password' && <ChangePasswordPanel />}
        {activeTab === '2fa' && <TwoFactorPanel />}
        {activeTab === 'sessions' && <SessionsPanel />}
        {activeTab === 'history' && isAdmin && <LoginHistoryPanel />}
      </Card>
    </div>
  );
}

// ─── Parolni o'zgartirish ──────────────────────────────────────────
function ChangePasswordPanel() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!oldPassword || !newPassword) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Parollar mos kelmadi");
      return;
    }
    setSaving(true);
    try {
      const { authApi } = await import('@/services/api');
      await authApi.changePassword(oldPassword, newPassword);
      toast.success('✅ Parol muvaffaqiyatli o\'zgartirildi');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 9,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
      <div>
        <Label>Joriy parol</Label>
        <input type="password" style={inputStyle} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
      </div>
      <div>
        <Label>Yangi parol</Label>
        <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div>
        <Label>Yangi parolni tasdiqlang</Label>
        <input type="password" style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      <Btn variant="gradient" onClick={submit} disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        {saving ? 'Saqlanmoqda...' : 'Parolni yangilash'}
      </Btn>
    </div>
  );
}

// ─── 2FA (Ikki bosqichli autentifikatsiya) ─────────────────────────
function TwoFactorPanel() {
  const { user } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [disableCred, setDisableCred] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(!!user?.twoFactorEnabled);

  // Store'dagi user.twoFactorEnabled ni yangilaymiz (sahifadan chiqib qaytganda
  // holat to'g'ri ko'rinishi uchun).
  function syncEnabled(val: boolean) {
    setEnabled(val);
    try {
      (useAuth as any).setState((s: any) => ({
        user: s.user ? { ...s.user, twoFactorEnabled: val } : s.user,
      }));
    } catch {}
  }

  async function startSetup() {
    setLoading(true);
    try {
      const { authApi } = await import('@/services/api');
      const r: any = await authApi.setup2FA();
      setQrCode(r.data?.qrCode || '');
      setSecret(r.data?.secret || '');
      setStep('setup');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "2FA sozlanmadi");
    } finally { setLoading(false); }
  }

  async function confirmEnable() {
    if (code.length !== 6) { toast.error("6 xonali kodni kiriting"); return; }
    setLoading(true);
    try {
      const { authApi } = await import('@/services/api');
      await authApi.enable2FA(code);
      toast.success('✅ 2FA yoqildi');
      syncEnabled(true);
      setStep('idle');
      setCode('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Kod noto'g'ri");
    } finally { setLoading(false); }
  }

  async function disable() {
    const cred = disableCred.trim();
    if (!cred) { toast.error('Parol yoki authenticator kodini kiriting'); return; }
    setLoading(true);
    try {
      const { authApi } = await import('@/services/api');
      // Parol yoki kod — bittasi yetarli. Backend ikkalasini ham tekshiradi.
      await authApi.disable2FA(cred);
      toast.success("✅ 2FA o'chirildi");
      syncEnabled(false);
      setDisableCred('');
      setStep('idle');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Parol yoki kod noto'g'ri");
    } finally { setLoading(false); }
  }

  if (enabled) {
    return (
      <div style={{ maxWidth: 400 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 10, marginBottom: 16,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)' }}>2FA yoqilgan</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Akkauntingiz qo'shimcha himoyalangan</div>
          </div>
        </div>
        <Label>2FA ni o'chirish</Label>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '2px 0 8px' }}>
          Tasdiqlash uchun <b>akkaunt parolingizni</b> yoki authenticator ilovasidagi
          <b> 6 xonali kodni</b> (yoki zaxira kodni) kiriting — bittasi yetarli.
        </p>
        <input
          type="text"
          autoComplete="off"
          value={disableCred}
          onChange={(e) => setDisableCred(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') disable(); }}
          placeholder="Parol yoki 6 xonali kod"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <Btn variant="danger" onClick={disable} disabled={loading}>{loading ? '...' : '2FA ni o\'chirish'}</Btn>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div style={{ maxWidth: 400 }}>
        <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
          Google Authenticator yoki shunga o'xshash ilova bilan QR kodni skanerlang:
        </p>
        {qrCode && (
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, display: 'inline-block', marginBottom: 14 }}>
            <img src={qrCode} alt="2FA QR" style={{ width: 180, height: 180 }} />
          </div>
        )}
        {secret && (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
            Qo'lda kiritish kodi: <code style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>{secret}</code>
          </div>
        )}
        <Label>Ilovadagi 6 xonali kodni kiriting</Label>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000" maxLength={6}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 18, letterSpacing: 4, textAlign: 'center', marginBottom: 12, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => setStep('idle')}>Bekor</Btn>
          <Btn variant="gradient" onClick={confirmEnable} disabled={loading}>{loading ? '...' : 'Tasdiqlash va yoqish'}</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400 }}>
      <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
        Ikki bosqichli autentifikatsiya akkauntingizni qo'shimcha himoyalaydi — parol o'g'irlansa ham, kirish uchun telefoningizdagi kod kerak bo'ladi.
      </p>
      <Btn variant="gradient" onClick={startSetup} disabled={loading}>{loading ? 'Yuklanmoqda...' : '2FA ni yoqish'}</Btn>
    </div>
  );
}

// ─── Faol sessiyalar ────────────────────────────────────────────────
function SessionsPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    import('@/services/api').then(({ authApi }) =>
      authApi.sessions()
        .then((r: any) => setSessions(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  async function revoke(id: string) {
    try {
      const { authApi } = await import('@/services/api');
      await authApi.revokeSession(id);
      toast.success("Sessiya o'chirildi");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik');
    }
  }

  if (loading) return <Skeleton height={120} />;
  if (!sessions.length) return <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Faol sessiya topilmadi</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sessions.map((s: any) => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 10,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {s.deviceName || s.userAgent?.slice(0, 40) || 'Noma\'lum qurilma'}
              {s.isCurrent && <Badge color="var(--success)">Joriy</Badge>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
              {s.ip || '—'} {s.city && `• ${s.city}`} {s.country && `, ${s.country}`}
              {' • '}Faol: {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString('uz-UZ') : '—'}
            </div>
          </div>
          {!s.isCurrent && (
            <Btn size="sm" variant="danger" onClick={() => revoke(s.id)}>Tugatish</Btn>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Login tarixi ────────────────────────────────────────────────────
function LoginHistoryPanel() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/services/api').then(({ authApi }) =>
      authApi.loginHistory()
        .then((r: any) => setHistory(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  if (loading) return <Skeleton height={120} />;
  if (!history.length) return <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>Kirish tarixi topilmadi</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Sana</th>
            <th style={{ padding: 8 }}>IP</th>
            <th style={{ padding: 8 }}>Holat</th>
            <th style={{ padding: 8 }}>Sabab</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h: any) => (
            <tr key={h.id} style={{ borderTop: '1px solid var(--border-2)' }}>
              <td style={{ padding: 8 }}>{new Date(h.createdAt).toLocaleString('uz-UZ')}</td>
              <td style={{ padding: 8, fontFamily: 'monospace' }}>{h.ip || '—'}</td>
              <td style={{ padding: 8 }}>
                <Badge color={h.success ? 'var(--success)' : 'var(--danger)'}>
                  {h.success ? 'Muvaffaqiyatli' : 'Muvaffaqiyatsiz'}
                </Badge>
              </td>
              <td style={{ padding: 8, color: 'var(--fg-3)' }}>{h.reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}