'use client';
import { useEffect, useState, useRef } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { useAuth } from '@/lib/store';

// ─── API ────────────────────────────────────────────────────────
const tgApi = {
  status:    ()                     => api.get('/telegram/personal/status'),
  connect:   (d: any)              => api.post('/telegram/personal/connect', d),
  verify:    (d: any)              => api.post('/telegram/personal/verify-code', d),
  disconnect:()                     => api.post('/telegram/personal/disconnect', {}),
  dialogs:   ()                     => api.get('/telegram/personal/dialogs'),
  messages:  (id: string)          => api.get(`/telegram/personal/messages/${id}`),
  send:      (d: any)              => api.post('/telegram/personal/send', d),
  sendTemplate: (d: any)           => api.post('/telegram/personal/send-template', d),
  templates: ()                     => api.get('/telegram/templates'),
  search:    (q: string)           => api.post('/telegram/personal/search', { query: q }),
  startChat: (d: any)              => api.post('/telegram/personal/start-chat', d),
};

// ─── Agentlar uchun rang palitrasi (har bir agent ID'ga barqaror rang) ──
const AGENT_COLORS = [
  'linear-gradient(135deg,#10b981,#059669)', // green
  'linear-gradient(135deg,#f59e0b,#d97706)', // amber
  'linear-gradient(135deg,#ec4899,#db2777)', // pink
  'linear-gradient(135deg,#8b5cf6,#7c3aed)', // violet
  'linear-gradient(135deg,#06b6d4,#0891b2)', // cyan
];
function agentColor(agentId: string) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  return AGENT_COLORS[hash % AGENT_COLORS.length];
}

// ─── AVATAR (telegramdagi asl rasm, bo'lmasa — inisiallar) ─────
function Avatar({ url, name, size = 38, radius = 12 }: { url?: string; name: string; size?: number; radius?: number }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url} alt={name}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, background: '#161b30' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: 'linear-gradient(135deg,#3d7eff,#a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: '#fff',
    }}>
      {(name || '?')[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ─── CONNECT FLOW ───────────────────────────────────────────────
function ConnectFlow({ onConnected }: { onConnected: () => void }) {
  const [step, setStep]       = useState<'phone'|'code'|'2fa'>('phone');
  const [phone, setPhone]     = useState('');
  const [apiId, setApiId]     = useState('');
  const [apiHash, setApiHash] = useState('');
  const [code, setCode]       = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!phone || !apiId || !apiHash) { toast.error('Barcha maydonlarni to\'ldiring'); return; }
    setLoading(true);
    try {
      await tgApi.connect({ phone, apiId: parseInt(apiId), apiHash });
      setStep('code');
      toast.success('Kod yuborildi!');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xato'); }
    finally { setLoading(false); }
  }

  async function verifyCode() {
    setLoading(true);
    try {
      const r: any = await tgApi.verify({ code, password: password || undefined });
      if (r.data?.need2fa) { setStep('2fa'); return; }
      toast.success('Ulandi!');
      onConnected();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Kod noto\'g\'ri'); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2440',
    borderRadius: 11, color: '#e8eaf2', fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
  };
  const btn: React.CSSProperties = {
    width: '100%', padding: 12, borderRadius: 11, border: 'none',
    background: 'linear-gradient(135deg,#3d7eff,#a855f7)', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c16', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#0c0e1a', border: '1px solid #1e2440', borderRadius: 20, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✈️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf2' }}>Telegram ulanish</div>
          <div style={{ fontSize: 12.5, color: '#3d4568', marginTop: 5 }}>Shaxsiy akkauntingizni ulang</div>
        </div>

        {step === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7194', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Telefon raqam</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998901234567" style={inp}
                onFocus={e => { e.target.style.borderColor='#3d7eff'; e.target.style.boxShadow='0 0 0 3px rgba(61,126,255,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='#1e2440'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7194', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>API ID <span style={{ color: '#3d4568', textTransform: 'none' }}>— my.telegram.org dan</span></label>
              <input value={apiId} onChange={e => setApiId(e.target.value)} placeholder="12345678" style={inp}
                onFocus={e => { e.target.style.borderColor='#3d7eff'; e.target.style.boxShadow='0 0 0 3px rgba(61,126,255,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='#1e2440'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7194', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>API Hash</label>
              <input value={apiHash} onChange={e => setApiHash(e.target.value)} placeholder="abc123..." type="password" style={inp}
                onFocus={e => { e.target.style.borderColor='#3d7eff'; e.target.style.boxShadow='0 0 0 3px rgba(61,126,255,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='#1e2440'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <div style={{ background: 'rgba(61,126,255,0.06)', border: '1px solid rgba(61,126,255,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#9aa0c0', lineHeight: 1.6 }}>
              🔑 API ID va Hash olish: <a href="https://my.telegram.org" target="_blank" rel="noreferrer" style={{ color: '#3d7eff' }}>my.telegram.org</a> → App api → Create App
            </div>
            <button onClick={sendCode} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Yuborilmoqda...' : '📱 Kod yuborish'}
            </button>
          </div>
        )}

        {step === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', color: '#9aa0c0', fontSize: 13, marginBottom: 4 }}>
              {phone} ga SMS/Telegram kod yuborildi
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7194', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Tasdiqlash kodi</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="12345" style={{ ...inp, textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: 6 }}
                onFocus={e => { e.target.style.borderColor='#3d7eff'; e.target.style.boxShadow='0 0 0 3px rgba(61,126,255,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='#1e2440'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <button onClick={verifyCode} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Tekshirilmoqda...' : '✅ Tasdiqlash'}
            </button>
            <button onClick={() => setStep('phone')} style={{ ...btn, background: 'rgba(255,255,255,0.05)', border: '1px solid #1e2440', color: '#9aa0c0' }}>
              ← Orqaga
            </button>
          </div>
        )}

        {step === '2fa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', color: '#9aa0c0', fontSize: 13 }}>Ikki faktorli autentifikatsiya</div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7194', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Parol (Cloud Password)</label>
              <input value={password} onChange={e => setPass(e.target.value)} type="password" placeholder="••••••••" style={inp}
                onFocus={e => { e.target.style.borderColor='#3d7eff'; e.target.style.boxShadow='0 0 0 3px rgba(61,126,255,0.12)'; }}
                onBlur={e => { e.target.style.borderColor='#1e2440'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <button onClick={verifyCode} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳...' : '🔓 Kirish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN INBOX ─────────────────────────────────────────────────
export default function TelegramPersonalPage() {
  const { user } = useAuth();
  const [status, setStatus]     = useState<any>(null);
  const [convs, setConvs]       = useState<any[]>([]);
  const [active, setActive]     = useState<any>(null);
  const [msgs, setMsgs]         = useState<any[]>([]);
  const [text, setText]         = useState('');
  const [search, setSearch]     = useState('');
  const [searchRes, setSearchRes] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sendingTpl, setSendingTpl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<any>(null);
  activeRef.current = active;

  useSocket();

  useEffect(() => {
    tgApi.status().then((r: any) => setStatus(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (status?.connected) loadDialogs();
  }, [status?.connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Live yangilanish: refresh qilmasdan yangi xabar/shablon/invoice ko'rinishi ──
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (msg: any) => {
      if (!msg?.conversationId) return;

      setConvs(prev => {
        const exists = prev.some(c => c.id === msg.conversationId);
        if (!exists) { loadDialogs(); return prev; }
        return prev.map(c => c.id === msg.conversationId ? {
          ...c,
          lastMessageText: msg.text || c.lastMessageText,
          lastMessageAt: msg.createdAt || new Date().toISOString(),
          unreadCount: activeRef.current?.id === msg.conversationId
            ? c.unreadCount
            : (msg.direction === 'INBOUND' ? (c.unreadCount || 0) + 1 : c.unreadCount),
        } : c);
      });

      if (msg.conversationId === activeRef.current?.id) {
        setMsgs(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    };

    socket.on('message:new', onNew);
    return () => { socket.off('message:new', onNew); };
  }, []);

  async function loadDialogs() {
    setLoading(true);
    try {
      const r: any = await tgApi.dialogs();
      setConvs(r.data || []);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Dialoglar yuklanmadi'); }
    finally { setLoading(false); }
  }

  async function openConversation(conv: any) {
    setActive(conv);
    setLoadingMsgs(true);
    try {
      const r: any = await tgApi.messages(conv.id);
      setMsgs(r.data || []);
    } catch { setMsgs([]); }
    finally { setLoadingMsgs(false); }
  }

  async function sendMsg() {
    if (!text.trim() || !active) return;
    try {
      const r: any = await tgApi.send({ conversationId: active.id, text });
      setMsgs(p => [...p, r.data]);
      setText('');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Yuborib bo\'lmadi'); }
  }

  async function openTemplates() {
    setShowTemplates(true);
    if (templates.length) return;
    try {
      const r: any = await tgApi.templates();
      setTemplates(r.data || []);
    } catch { toast.error('Shablonlar yuklanmadi'); }
  }

  async function sendTpl(tplId: string) {
    if (!active) return;
    setSendingTpl(true);
    try {
      const r: any = await tgApi.sendTemplate({ conversationId: active.id, templateId: tplId });
      const sentMsgs = r.data?.messages || [];
      setMsgs(p => {
        const existingIds = new Set(p.map((m: any) => m.id));
        const fresh = sentMsgs.filter((m: any) => !existingIds.has(m.id));
        return [...p, ...fresh];
      });
      toast.success('Shablon yuborildi!');
      setShowTemplates(false);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Shablon yuborilmadi'); }
    finally { setSendingTpl(false); }
  }

  async function doSearch() {
    if (!search.trim()) return;
    setSearching(true);
    setSearchRes(null);
    try {
      const r: any = await tgApi.search(search);
      setSearchRes(r.data);
      if (!r.data) toast.error('Foydalanuvchi topilmadi');
    } finally { setSearching(false); }
  }

  async function startChat(firstMsg?: string) {
    if (!searchRes) return;
    try {
      const r: any = await tgApi.startChat({ externalUserId: searchRes.id, firstMessage: firstMsg });
      setConvs(p => [r.data, ...p]);
      openConversation(r.data);
      setShowNewChat(false);
      setSearch(''); setSearchRes(null);
      toast.success('Suhbat boshlandi!');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xato'); }
  }

  if (!status) return (
    <CrmLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span className="spinner spinner-lg"/>
      </div>
    </CrmLayout>
  );

  if (!status.connected) return <ConnectFlow onConnected={() => setStatus({ connected: true })} />;

  const filtered = convs.filter(c =>
    `${c.firstName} ${c.lastName} ${c.username}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CrmLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 62px)', background: '#0a0c16', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #1e2440', display: 'flex', flexDirection: 'column', background: '#0c0e1a' }}>

          {/* Header */}
          <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #1e2440' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8eaf2' }}>✈️ Telegram Inbox</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowNewChat(true)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg,#3d7eff,#a855f7)',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>+ Yangi</button>
                <button onClick={loadDialogs} style={{
                  padding: '6px 10px', borderRadius: 8, border: '1px solid #1e2440',
                  background: 'transparent', color: '#6b7194', fontSize: 13, cursor: 'pointer',
                }} title="Yangilash">↻</button>
              </div>
            </div>

            {/* Search */}
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Qidirish..."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2440',
                borderRadius: 9, color: '#e8eaf2', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            />

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#3d4568' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: status.online ? '#10b981' : '#f59e0b' }}/>
              {status.online ? 'Online' : 'Ulanmoqda...'} · {status.phone}
              <button onClick={async () => { await tgApi.disconnect(); setStatus({ connected: false }); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                Uzish
              </button>
            </div>
          </div>

          {/* Conversations list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <span className="spinner"/>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#3d4568', fontSize: 13 }}>
                Suhbatlar yo'q
              </div>
            )}
            {filtered.map(conv => {
              const name = [conv.firstName, conv.lastName].filter(Boolean).join(' ') || conv.username || 'Noma\'lum';
              const isActive = active?.id === conv.id;
              return (
                <div key={conv.id} onClick={() => openConversation(conv)} style={{
                  padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(30,36,64,0.5)',
                  background: isActive ? 'rgba(61,126,255,0.08)' : 'transparent',
                  transition: 'background 0.12s',
                  borderLeft: isActive ? '2.5px solid #3d7eff' : '2.5px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar url={conv.avatarUrl} name={name} size={38} radius={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e8eaf2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        {conv.unreadCount > 0 && (
                          <div style={{ background: '#3d7eff', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#3d4568', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.lastMessageText || '@' + conv.username}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        {active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* Chat header */}
            <div style={{ padding: '13px 20px', borderBottom: '1px solid #1e2440', display: 'flex', alignItems: 'center', gap: 12, background: '#0c0e1a' }}>
              <Avatar
                url={active.avatarUrl}
                name={[active.firstName, active.lastName].filter(Boolean).join(' ') || active.username || '?'}
                size={38} radius={12}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#e8eaf2' }}>
                  {[active.firstName, active.lastName].filter(Boolean).join(' ') || active.username || 'Noma\'lum'}
                </div>
                {active.username && <div style={{ fontSize: 11.5, color: '#3d4568' }}>@{active.username}</div>}
              </div>
              <button onClick={openTemplates} style={{
                padding: '7px 13px', borderRadius: 9, border: '1px solid #1e2440',
                background: 'rgba(255,255,255,0.04)', color: '#9aa0c0',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}>📋 Shablon</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMsgs && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><span className="spinner"/></div>
              )}
              {!loadingMsgs && msgs.map(m => {
                const out = m.direction === 'OUTBOUND';
                const isMine = out && (!m.agentId || m.agentId === user?.id);
                const isOtherAgent = out && m.agentId && m.agentId !== user?.id;
                const custName = [active.firstName, active.lastName].filter(Boolean).join(' ') || (active.username ? '@' + active.username : 'Mijoz');

                const bubbleBg = isMine
                  ? 'linear-gradient(135deg,#3d7eff,#5a5fde)'   // biz — doim havorang
                  : isOtherAgent
                    ? agentColor(m.agentId)                      // boshqa agent — alohida rang
                    : '#111420';                                 // mijoz — neytral

                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 7 }}>
                    {!out && (
                      <Avatar url={active.avatarUrl} name={custName} size={26} radius={8} />
                    )}
                    <div style={{ maxWidth: '72%' }}>
                      {isOtherAgent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9aa0c0' }}>{m.agent?.name || 'Agent'}</span>
                          <Avatar url={m.agent?.avatarUrl} name={m.agent?.name || '?'} size={16} radius={5} />
                        </div>
                      )}
                      <div style={{
                        padding: '9px 13px', borderRadius: out ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: bubbleBg,
                        border: (!out) ? '1px solid #1e2440' : 'none',
                        color: '#e8eaf2', fontSize: 13.5, lineHeight: 1.5,
                      }}>
                        {!out && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#3d7eff', marginBottom: 3 }}>{custName}</div>
                        )}
                        {m.fileUrl && m.messageType === 'DOCUMENT' && m.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                          <div>
                            <img src={m.fileUrl} alt="Rasm" style={{ maxWidth: 220, maxHeight: 200, borderRadius: 8, display: 'block', marginBottom: m.text ? 6 : 0 }} onError={e => { (e.target as any).style.display='none'; }}/>
                            {m.text && <div>{m.text}</div>}
                          </div>
                        ) : m.fileUrl ? (
                          <div>
                            <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ color: out ? 'rgba(255,255,255,0.85)' : '#3d7eff', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                              📎 {m.fileName || 'Fayl'}
                            </a>
                            {m.text && <div style={{ marginTop: 4 }}>{m.text}</div>}
                          </div>
                        ) : (
                          m.text || ''
                        )}
                        <div style={{ fontSize: 10, color: out ? 'rgba(255,255,255,0.5)' : '#3d4568', marginTop: 4, textAlign: 'right' }}>
                          {new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          {out && <span style={{ marginLeft: 4 }}>{m.isDelivered ? '✓✓' : '✓'}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loadingMsgs && msgs.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d4568', fontSize: 13 }}>
                  Xabarlar yo'q
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Composer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2440', background: '#0c0e1a', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* File preview */}
              {selectedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(61,126,255,0.08)', borderRadius: 8, border: '1px solid rgba(61,126,255,0.2)' }}>
                  <span style={{ fontSize: 16 }}>{selectedFile.type.startsWith('image/') ? '🖼' : '📎'}</span>
                  <span style={{ fontSize: 12, color: '#9aa0c0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>✕</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])}/>
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: 38, height: 38, borderRadius: 9, border: '1px solid #1e2440',
                background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#6b7194',
                fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>📎</button>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Xabar yozing... (Enter — yuborish)"
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2440',
                  color: '#e8eaf2', fontSize: 14, fontFamily: 'inherit', resize: 'none',
                  outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              <button onClick={sendMsg} disabled={!text.trim() && !selectedFile} style={{
                padding: '10px 18px', borderRadius: 12, border: 'none',
                background: (text.trim() || selectedFile) ? 'linear-gradient(135deg,#3d7eff,#a855f7)' : '#161b30',
                color: (text.trim() || selectedFile) ? '#fff' : '#3d4568',
                fontSize: 14, fontWeight: 700, cursor: (text.trim() || selectedFile) ? 'pointer' : 'not-allowed',
                transition: 'all 0.14s', flexShrink: 0,
              }}>
                ➤
              </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#3d4568' }}>
            <div style={{ fontSize: 48 }}>✈️</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Suhbat tanlang</div>
            <div style={{ fontSize: 13 }}>Chap paneldan suhbat tanlang yoki yangi boshlang</div>
          </div>
        )}

        {/* ── NEW CHAT MODAL ── */}
        {showNewChat && (
          <>
            <div onClick={() => { setShowNewChat(false); setSearchRes(null); setSearch(''); }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,9,15,0.75)', backdropFilter: 'blur(8px)' }}/>
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 201, width: '100%', maxWidth: 440,
              background: '#0c0e1a', border: '1px solid #2a3258',
              borderRadius: 20, padding: '28px 28px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf2', marginBottom: 20 }}>➕ Yangi suhbat</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="@username qidirish..."
                  style={{
                    flex: 1, padding: '10px 13px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #1e2440', borderRadius: 10, color: '#e8eaf2',
                    fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  }}
                  autoFocus
                />
                <button onClick={doSearch} disabled={searching} style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: '#3d7eff', color: '#fff', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>
                  {searching ? '⏳' : '🔍'}
                </button>
              </div>

              {searchRes && (
                <div style={{ background: '#111420', border: '1px solid #1e2440', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  {/* User info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#3d7eff,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, color: '#fff', flexShrink: 0 }}>
                      {(searchRes.firstName || searchRes.username || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf2' }}>
                        {[searchRes.firstName, searchRes.lastName].filter(Boolean).join(' ') || searchRes.username}
                      </div>
                      {searchRes.username && <div style={{ fontSize: 12, color: '#3d7eff', marginTop: 2 }}>@{searchRes.username}</div>}
                    </div>
                  </div>
                  {/* First message textarea */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#3d4568', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Birinchi xabar (ixtiyoriy)</div>
                    <textarea
                      id="firstMsgInput"
                      placeholder="Salom! Sizga qanday yordam bera olaman?"
                      rows={2}
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2440',
                        borderRadius: 9, color: '#e8eaf2', fontSize: 13,
                        fontFamily: 'inherit', resize: 'none', outline: 'none',
                      }}
                    />
                  </div>
                  <button onClick={() => {
                    const el = document.getElementById('firstMsgInput') as HTMLTextAreaElement;
                    startChat(el?.value || undefined);
                  }} style={{
                    width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#3d7eff,#a855f7)',
                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                    💬 Suhbat boshlash
                  </button>
                </div>
              )}

              {!searchRes && !searching && (
                <div style={{ textAlign: 'center', color: '#3d4568', fontSize: 12, padding: '8px 0' }}>
                  @username kiriting va qidiring
                </div>
              )}

              <button onClick={() => { setShowNewChat(false); setSearchRes(null); setSearch(''); }} style={{
                width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #1e2440',
                background: 'transparent', color: '#6b7194', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Bekor qilish
              </button>
            </div>
          </>
        )}

        {/* ── TEMPLATES MODAL ── */}
        {showTemplates && (
          <>
            <div onClick={() => setShowTemplates(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,9,15,0.75)', backdropFilter: 'blur(8px)' }}/>
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 201, width: '100%', maxWidth: 440, maxHeight: '78vh', overflowY: 'auto',
              background: '#0c0e1a', border: '1px solid #2a3258',
              borderRadius: 20, padding: '24px 24px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf2', marginBottom: 16 }}>📋 Shablonlar</div>

              {templates.length === 0 && (
                <div style={{ textAlign: 'center', color: '#3d4568', fontSize: 13, padding: '20px 0' }}>
                  Shablon topilmadi
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {templates.map((tpl: any) => (
                  <div key={tpl.id} onClick={() => !sendingTpl && sendTpl(tpl.id)} style={{
                    padding: '12px 14px', borderRadius: 12, border: '1px solid #1e2440',
                    background: '#111420', cursor: sendingTpl ? 'wait' : 'pointer',
                    opacity: sendingTpl ? 0.6 : 1, transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#3d7eff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2440')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#e8eaf2', marginBottom: 4 }}>{tpl.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7194', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {tpl.text}
                    </div>
                    {tpl.mediaUrl && <div style={{ fontSize: 10, color: '#3d7eff', marginTop: 4 }}>📎 Media bor</div>}
                  </div>
                ))}
              </div>

              <button onClick={() => setShowTemplates(false)} style={{
                width: '100%', padding: '9px', marginTop: 16, borderRadius: 10, border: '1px solid #1e2440',
                background: 'transparent', color: '#6b7194', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Yopish
              </button>
            </div>
          </>
        )}
      </div>
    </CrmLayout>
  );
}