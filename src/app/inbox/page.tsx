'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { telegramApi, telegramV6, uploadsApi, bookingsApi, clientsApi, userTelegramApi } from '@/services/api';
import { Card, Btn, Input, Empty, Skeleton, Avatar, Badge, Modal, Label, Select, Textarea } from '@/components/ui';
import { useDialer } from '@/lib/dialer';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { errMsg, fmtMoney } from '@/lib/helpers';
import { useSocket, getSocket } from '@/hooks/useSocket';
import {
  User, Bot, Users2, Wallet, CalendarCheck, PhoneCall,
  ClipboardList, ExternalLink, PanelRightClose, PanelRightOpen,
  GitBranch, Clock, Plane, Search, Plus,
} from 'lucide-react';
import { FaTelegramPlane, FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { Globe as GlobeIc } from 'lucide-react';
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/helpers';
import toast from 'react-hot-toast';

// Real brend iconlar (emoji o'rniga)
/**
 * Instagram 24 soatlik javob oynasi.
 *
 * Meta qoidasi: mijoz oxirgi yozganidan keyin 24 soat ichidagina erkin
 * javob berish mumkin. Oyna yopilsa xabar yuborilmaydi — shuning uchun
 * agentga OLDINDAN ogohlantirish ko'rsatamiz.
 */
function igReplyWindow(channel: string | undefined, messages: any[]) {
  if (channel !== 'INSTAGRAM') return null;
  const lastIn = [...(messages || [])]
    .reverse()
    .find((m) => m.direction === 'INBOUND');
  if (!lastIn) return null;

  const passedMs = Date.now() - new Date(lastIn.createdAt).getTime();
  const leftMs = 24 * 3600 * 1000 - passedMs;
  if (leftMs <= 0) return { expired: true, leftHours: 0, leftMinutes: 0 };

  return {
    expired: false,
    leftHours: Math.floor(leftMs / 3600000),
    leftMinutes: Math.floor((leftMs % 3600000) / 60000),
  };
}

function ChannelIcon({ channel, size = 9 }: { channel?: string; size?: number }) {
  switch (channel) {
    case 'TELEGRAM':  return <FaTelegramPlane size={size} />;
    case 'WHATSAPP':  return <FaWhatsapp size={size} />;
    case 'INSTAGRAM': return <FaInstagram size={size} />;
    default:          return <GlobeIc size={size} />;
  }
}

const CHANNEL_ICONS: Record<string, string> = {
  TELEGRAM: '✈',
  WHATSAPP: '💬',
  INSTAGRAM: '📷',
  WEB: '🌐',
};

const CHANNEL_COLORS: Record<string, string> = {
  TELEGRAM: '#0088cc',
  WHATSAPP: '#25D366',
  INSTAGRAM: '#E1306C',
};

function InboxPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { callClient } = useDialer();

  const [convs, setConvs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [msgRefresh, setMsgRefresh] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNewPersonal, setShowNewPersonal] = useState(false);
  const [hasPersonalAccount, setHasPersonalAccount] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  // v10.2: amoCRM-uslubidagi mijoz kontekst paneli (o'ng tomonda)
  const [showContext, setShowContext] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // v13: ovozli xabar yozish
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  useSocket();

  // convs'ning eng so'nggi holatini socket handler ichida ko'rish uchun
  const convsRef = useRef<any[]>([]);
  useEffect(() => { convsRef.current = convs; }, [convs]);

  // Check if user has personal Telegram account
  useEffect(() => {
    userTelegramApi.getMyAccount()
      .then(r => setHasPersonalAccount(!!r.data))
      .catch(() => {});
  }, []);

  const loadConvs = () => {
    setLoading(true);
    telegramApi.conversations()
      .then((r: any) => {
        // Backend xar xil format qaytarishi mumkin — defensive
        const list = Array.isArray(r.data) ? r.data
          : Array.isArray(r.data?.data) ? r.data.data
          : Array.isArray(r.data?.conversations) ? r.data.conversations
          : [];
        setConvs(list);
      })
      .catch((e) => {
        console.error('Inbox load error:', e);
        setConvs([]);
      })
      .finally(() => setLoading(false));
  };

  const [createClientModal, setCreateClientModal] = useState<any>(null);
  const [clientFormData, setClientFormData] = useState({ phone: '', notes: '' });

  // v9-SECURITY: Telegram suhbatdan klient yaratish (phone optional)
  // Modal orqali agent telefonni kiritishi mumkin
  const openCreateClientModal = (conv: any) => {
    if (!conv) return;
    setCreateClientModal(conv);
    setClientFormData({ phone: '', notes: '' });
  };

  const createClientFromConv = async () => {
    if (!createClientModal) return;
    const conv = createClientModal;
    
    const fullName = [conv.firstName, conv.lastName].filter(Boolean).join(' ')
      || conv.username
      || conv.externalUsername
      || 'Telegram klient';

    // v9-SECURITY: Validate phone format if provided
    let phone = clientFormData.phone.trim();
    if (phone && !phone.match(/^[0-9\+\-\(\) ]{5,20}$/)) {
      toast.error('Telefon raqam noto\'g\'ri formatda (kamita 5 ta raqam)');
      return;
    }

    try {
      const created: any = await clientsApi.create({
        fullName,
        phone: phone || null, // ✅ OPTIONAL: Can be null
        telegramUsername: conv.username || null,
        source: 'TELEGRAM',
        pipelineStage: 'NEW_LEAD',
        notes: clientFormData.notes || null,
        conversationId: conv.id,
      });
      
      const newClient = created.data;
      toast.success("✅ Klient yaratildi: " + newClient.fullName);
      
      // Suhbatga klientni bog'lash
      try {
        await telegramApi.linkClient(conv.id, newClient.id);
      } catch (e) {
        console.error('Link client error:', e);
      }
      
      loadConvs();
      setCreateClientModal(null);
      
      // Yangi klient sahifasiga o'tish
      router.push(`/clients/${newClient.id}`);
    } catch (e: any) {
      toast.error(errMsg(e));
    }
  };

  useEffect(() => {
    loadConvs();
    const convId = params.get('conv');
    if (convId) {
      // ochaman
      setTimeout(() => {
        setActive({ id: convId });
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (!active?.id) return;
    setLoadingMessages(true);
    telegramApi.messages(active.id)
      .then((r: any) => {
        // Defensive: backend response formatga moslashish
        const list = Array.isArray(r.data) ? r.data
          : Array.isArray(r.data?.data) ? r.data.data
          : Array.isArray(r.data?.messages) ? r.data.messages
          : [];
        setMessages(list);
        // Refresh conv from list
        const c = convs.find((c) => c.id === active.id);
        if (c) setActive(c);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch((e) => {
        console.error('Messages load error:', e);
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [active?.id, msgRefresh]);

  // Socket: new message
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (msg: any) => {
      // MUAMMO FIX: agar xabar hali ro'yxatda yo'q (yangi/birinchi marta
      // yozgan) suhbatga tegishli bo'lsa — avval bu holatda hech narsa
      // qilinmasdi, shu sabab yangi suhbat sahifani qo'lda yangilamaguncha
      // ro'yxatda ko'rinmasdi (xuddi "yo'qolganday" tuyulardi).
      const exists = convsRef.current.some((cv: any) => cv.id === msg.conversationId);
      if (!exists) {
        loadConvs();
      } else {
        // Always update conversation list (unread badge)
        setConvs((prev: any[]) => prev.map((cv: any) => {
          if (cv.id === msg.conversationId) {
            const isActive = cv.id === active?.id;
            return {
              ...cv,
              lastMessageText: msg.text || '',
              lastMessageAt: msg.createdAt || new Date().toISOString(),
              unreadCount: isActive ? 0 : (cv.unreadCount || 0) + 1,
            };
          }
          return cv;
        }));
      }
      // If active conversation - append message to chat
      if (msg.conversationId === active?.id) {
        setMessages((m: any[]) => {
          // Don't duplicate if already exists
          if (m.some((x: any) => x.externalMsgId && x.externalMsgId === msg.externalMsgId)) return m;
          return [...m, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    // Also listen for template/invoice sent confirmation
    const onSent = (msg: any) => {
      if (msg.conversationId === active?.id) {
        setMessages((m: any[]) => {
          // Remove tmp if exists, add real
          const filtered = m.filter((x: any) => !x.id?.toString().startsWith('tmp_'));
          return [...filtered, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    socket.on('message:sent', onSent);
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:sent', onSent);
    };
  }, [active?.id]);

  async function sendText() {
    if (!draft.trim() || !active?.id) return;
    setSending(true);
    const text = draft;
    setDraft('');
    // 1. Darhol ko'rsatish (optimistic)
    const tmpMsg = {
      id: 'tmp_' + Date.now(),
      text,
      direction: 'OUTBOUND',
      messageType: 'TEXT',
      createdAt: new Date().toISOString(),
      isDelivered: false,
    };
    setMessages((prev: any[]) => [...prev, tmpMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
    // 2. Mark conv unread = 0
    setConvs((prev: any[]) => prev.map((cv: any) =>
      cv.id === active.id ? { ...cv, unreadCount: 0, lastMessageText: text, lastMessageAt: new Date().toISOString() } : cv
    ));
    try {
      if (active.isPersonal) {
        const r: any = await userTelegramApi.sendMessage({
          conversationId: active.id,
          userId: active.externalChatId,
          text,
          clientId: active.clientId || undefined,
        });
        // Real saqlangan xabar bilan almashtiramiz — shu orqali
        // agentning o'zi yozgan xabari keyinroq "yo'qolib qolish" muammosi tuzaladi
        const real = r.data?.message;
        if (real && typeof real === 'object' && real.id) {
          setMessages((prev: any[]) => prev.map((m: any) => m.id === tmpMsg.id ? real : m));
        } else {
          setMessages((prev: any[]) => prev.map((m: any) =>
            m.id === tmpMsg.id ? { ...m, isDelivered: true } : m
          ));
        }
      } else {
        await telegramApi.sendMessage(active.id, text);
        // 3. Mark delivered
        setMessages((prev: any[]) => prev.map((m: any) =>
          m.id === tmpMsg.id ? { ...m, isDelivered: true } : m
        ));
      }
    } catch (e: any) {
      // 4. Xato - olib tashla, draft'ga qaytarish
      setMessages((prev: any[]) => prev.filter((m: any) => m.id !== tmpMsg.id));
      setDraft(text);
      toast.error(errMsg(e));
    }
    finally { setSending(false); }
  }

  async function uploadAndSend(files: FileList) {
    if (!active?.id) return;
    const file = files[0];
    if (!file) return;
    toast.loading('Yuklanyapti...', { id: 'upload' });
    try {
      const res = await uploadsApi.one(file);
      const { url, mimeType } = res.data;
      const mediaType = mimeType?.startsWith('image/') ? 'photo' : mimeType?.startsWith('video/') ? 'video' : 'document';
      // v14: shaxsiy/kompaniya (MTProto) suhbat — bot endpointi ishlamaydi,
      // MTProto orqali yuboramiz. Aks holda avvalgidek bot orqali.
      if (active.isPersonal) {
        await userTelegramApi.sendMedia({
          conversationId: active.id, fileUrl: url, mediaType, caption: draft || undefined,
        });
      } else {
        await telegramV6.sendMedia(active.id, {
          fileUrl: url, mimeType, mediaType,
          caption: draft || undefined,
        });
      }
      // Show sent media in chat
      setDraft('');
      setMsgRefresh((n: number) => n + 1);
      toast.success('Yuborildi', { id: 'upload' });
    } catch (e: any) { toast.error(errMsg(e), { id: 'upload' }); }
  }

  // v13: ovozli xabar — yozishni boshlash
  async function startRecording() {
    if (!active?.id) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Mikrofonga ruxsat berilmadi");
    }
  }

  // Yozishni bekor qilish (yubormasdan)
  function cancelRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordSeconds(0);
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.ondataavailable = null;
      rec.onstop = () => { rec.stream?.getTracks().forEach((tr) => tr.stop()); };
      rec.stop();
    }
    mediaRecorderRef.current = null;
  }

  // Yozishni to'xtatib, ovozli xabarni yuborish
  async function stopAndSendRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    const mime = rec.mimeType || 'audio/webm';
    await new Promise<void>((resolve) => {
      rec.onstop = () => { rec.stream?.getTracks().forEach((tr) => tr.stop()); resolve(); };
      if (rec.state !== 'inactive') rec.stop(); else resolve();
    });
    mediaRecorderRef.current = null;
    setRecordSeconds(0);

    const blob = new Blob(recordChunksRef.current, { type: mime });
    recordChunksRef.current = [];
    if (!blob.size || !active?.id) return;

    const ext = mime.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mime });

    toast.loading('Yuborilmoqda...', { id: 'voice' });
    try {
      const res = await uploadsApi.one(file);
      const { url, mimeType } = res.data;
      // v14: shaxsiy/kompaniya (MTProto) suhbatda ovozni MTProto orqali yuboramiz
      if (active.isPersonal) {
        await userTelegramApi.sendMedia({
          conversationId: active.id, fileUrl: url, mediaType: 'voice',
        });
      } else {
        await telegramV6.sendMedia(active.id, {
          fileUrl: url, mimeType: mimeType || mime, mediaType: 'voice',
        });
      }
      setMsgRefresh((n: number) => n + 1);
      toast.success('Ovozli xabar yuborildi', { id: 'voice' });
    } catch (e: any) {
      toast.error(errMsg(e), { id: 'voice' });
    }
  }

  return (
    <CrmLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        {/* ═══ LEFT: Conversations list ═══ */}
        <div style={{
          width: 320,
          background: 'var(--bg-2)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fg-3)', pointerEvents: 'none',
                }}
              />
              <Input
                placeholder={t('inbox.searchConv')}
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
            <button
              onClick={() => {
                if (!hasPersonalAccount) {
                  toast.error("Avval Sozlamalar → Telegram bo'limidan shaxsiy accountingizni ulang");
                  return;
                }
                setShowNewPersonal(true);
              }}
              title={t('inbox.firstMsgTitle')}
              style={{
                width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: hasPersonalAccount ? '#3d7eff' : 'var(--bg-3)',
                color: hasPersonalAccount ? 'white' : 'var(--fg-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            ><Plus size={20} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 14 }}><Skeleton height={60} count={5} /></div>}
            {!loading && convs.length === 0 && <Empty title={t('inbox.noConv')} icon="💬" />}
            {(() => {
              const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
              const filtered = !q ? convs : convs.filter((c: any) => {
                const name = (c.client?.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || '').toLowerCase();
                const username = (c.username || c.externalUsername || '').toLowerCase();
                const phone = (c.client?.phone || '').toLowerCase();
                const lastMsg = (c.lastMessageText || '').toLowerCase();
                return name.includes(q) || username.includes(q) || phone.includes(q) || lastMsg.includes(q);
              });
              if (!loading && convs.length > 0 && filtered.length === 0) {
                return <Empty title={t('inbox.nothingFound')} icon="🔍" />;
              }
              return filtered.map((c) => {
              const isActive = active?.id === c.id;
              return (
                <div key={c.id} onClick={() => setActive(c)} style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-2)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  // Kanal rangli chiziq — Telegram ko'k, WhatsApp yashil, Instagram pushti.
                  // Aktiv suhbatda primary rang ustun.
                  borderLeft: `3px solid ${isActive ? 'var(--primary)' : (CHANNEL_COLORS[c.channel] || 'transparent')}`,
                  display: 'flex', gap: 10,
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar src={c.avatarUrl} name={c.client?.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.externalUsername || '?'} size={40} />
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: CHANNEL_COLORS[c.channel] || 'var(--fg-3)',
                      color: 'white', fontSize: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--bg-2)',
                    }}>
                      <ChannelIcon channel={c.channel} size={9} />
                    </div>
                    {c.isPersonal && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        background: '#8b5cf6', color: 'white',
                        fontSize: 7, fontWeight: 800, padding: '1px 3px',
                        borderRadius: 4, border: '1px solid var(--bg-2)',
                        lineHeight: 1.2,
                      }}>P</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: c.unreadCount > 0 ? 800 : 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.unreadCount > 0 ? 'var(--fg)' : undefined }}>
                        {c.client?.fullName
                          || [c.firstName, c.lastName].filter(Boolean).join(' ')
                          || (c.username ? '@' + c.username : null)
                          || c.externalUsername
                          || 'Notanish'}
                      </div>
                      {c.unreadCount > 0 && (
                        <span style={{
                          background: 'var(--primary)', color: 'white',
                          fontSize: 10, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 10,
                          minWidth: 18, textAlign: 'center',
                        }}>{c.unreadCount}</span>
                      )}
                      {/* v13: qo'lda o'qildi/o'qilmadi qilib belgilash */}
                      <button
                        title={c.unreadCount > 0 ? "O'qilgan deb belgilash" : "O'qilmagan deb belgilash"}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextRead = !(c.unreadCount > 0);
                          setConvs((prev: any[]) => prev.map((cv: any) =>
                            cv.id === c.id ? { ...cv, unreadCount: nextRead ? 0 : Math.max(cv.unreadCount, 1) } : cv
                          ));
                          telegramApi.setRead(c.id, nextRead).catch(() => {
                            // Xato bo'lsa — orqaga qaytaramiz
                            setConvs((prev: any[]) => prev.map((cv: any) =>
                              cv.id === c.id ? { ...cv, unreadCount: c.unreadCount } : cv
                            ));
                          });
                        }}
                        style={{
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 12, opacity: 0.55, padding: 2, lineHeight: 1,
                        }}
                      >
                        {c.unreadCount > 0 ? '✉️' : '📩'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* Agar client bog'lanmagan bo'lsa — username ko'rsatamiz */}
                      {!c.client && c.username && (
                        <span style={{ color: 'var(--primary)' }}>@{c.username} • </span>
                      )}
                      <span style={{ fontWeight: c.unreadCount > 0 ? 700 : 400, color: c.unreadCount > 0 ? 'var(--fg-2)' : undefined }}>
                        {c.lastMessageText || "Xabar yo'q"}
                      </span>
                    </div>
                    {/* v10 MUAMMO 3+5: bot/shaxsiy, guruh, va biriktirilmagan belgilari */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {c.isPersonal ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, padding: '1px 6px', borderRadius: 8, background: '#8b5cf620', color: '#8b5cf6', fontWeight: 700 }}>
                          <User size={9} /> Shaxsiy
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--fg-3)', fontWeight: 700 }}>
                          <Bot size={9} /> Bot{c.account?.botUsername ? ` @${c.account.botUsername}` : ''}
                        </span>
                      )}
                      {(c.chatType === 'group' || c.chatType === 'supergroup') && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, padding: '1px 6px', borderRadius: 8, background: '#06b6d420', color: '#06b6d4', fontWeight: 700 }}>
                          <Users2 size={9} /> Guruh
                        </span>
                      )}
                      {!c.assignedAgentId && (
                        <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 8, background: '#f59e0b20', color: '#f59e0b', fontWeight: 700 }}>
                          Umumiy / Biriktirilmagan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
              });
            })()}
          </div>
        </div>

        {/* ═══ RIGHT: Active conversation ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!active ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Empty title={t('inbox.selectConv')} description="Chap tomondan suhbatni tanlang" icon="💬" />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar src={active.avatarUrl} name={active.client?.fullName || [active.firstName, active.lastName].filter(Boolean).join(' ') || active.username || '?'} size={40} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {active.client?.fullName
                        || [active.firstName, active.lastName].filter(Boolean).join(' ')
                        || (active.username ? '@' + active.username : null)
                        || active.externalUsername
                        || 'Notanish'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                      {active.client?.phone
                        || (active.username ? `@${active.username}` : 'Telefon yo\'q')}
                      {active.assignedAgent && ` • ${active.assignedAgent.name}`}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {active.isPersonal ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#8b5cf620', color: '#8b5cf6', fontWeight: 700 }}>
                          <User size={10} /> Shaxsiy
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--fg-3)', fontWeight: 700 }}>
                          <Bot size={10} /> Bot{active.account?.botUsername ? ` @${active.account.botUsername}` : ''}
                        </span>
                      )}
                      {(active.chatType === 'group' || active.chatType === 'supergroup') && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#06b6d420', color: '#06b6d4', fontWeight: 700 }}>
                          <Users2 size={10} /> Guruh
                        </span>
                      )}
                      {!active.assignedAgentId && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#f59e0b20', color: '#f59e0b', fontWeight: 700 }}>
                          Umumiy / Biriktirilmagan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {active.client?.phone && (
                    <Btn size="sm" variant="secondary" icon="📞" onClick={() => callClient(active.clientId, active.client.fullName, active.client.phone)}>
                      Call
                    </Btn>
                  )}
                  {active.clientId ? (
                    <Btn size="sm" variant="secondary" onClick={() => router.push(`/clients/${active.clientId}`)}>
                      👤 Profil
                    </Btn>
                  ) : (
                    // v9-SECURITY: Modal orqali client yaratish
                    <Btn size="sm" variant="gradient" onClick={() => openCreateClientModal(active)}>
                      👤 Yaratish
                    </Btn>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg)' }}>
                {loadingMessages && <Skeleton height={40} count={4} />}
                {!loadingMessages && messages.length === 0 && (
                  <Empty title={t('inbox.noMsgYet')} icon="💬" />
                )}
                {!loadingMessages && messages.map((m) => {
                  const isOut = m.direction === 'OUTBOUND' || m.direction === 'outbound' || m.isOutbound === true;
                  // Kim yozganini aniq ko'rsatamiz: xodim (agent) ismi + qaysi kanaldan
                  // (Bot yoki xodimning shaxsiy Telegram accounti) — bir nechta xodim
                  // shu mijoz bilan turli kanallardan yozishi mumkin, shuning uchun bu
                  // farqni ko'rsatish muhim.
                  const senderLabel = isOut
                    ? (m.agent?.name || 'Bot') + (active?.isPersonal ? ' · shaxsiy Telegram' : ' · Bot')
                    : null;
                  return (
                    <div key={m.id} style={{
                      display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start',
                      marginBottom: 10,
                    }}>
                      {senderLabel && (
                        <div style={{ fontSize: 10, color: 'var(--fg-4)', marginBottom: 2, marginRight: 2 }}>{senderLabel}</div>
                      )}
                      <div style={{
                        maxWidth: '70%',
                        background: isOut ? '#3d7eff' : 'var(--bg-2)',
                        color: isOut ? 'white' : 'var(--fg)',
                        padding: '10px 14px',
                        borderRadius: isOut ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        boxShadow: 'var(--shadow-sm)',
                      }}>
                        {/* v13 FIX: backendda tur nomi "PHOTO" (IMAGE emas) — shu nomuvofiqlik
                            tufayli rasmlar hech qachon <img> sifatida chiqmasdi. */}
                        {(m.messageType === 'PHOTO' || m.messageType === 'IMAGE') && m.fileUrl && (
                          <img src={m.fileUrl} alt="" style={{
                            maxWidth: '100%', borderRadius: 8, marginBottom: m.caption ? 6 : 0,
                          }} />
                        )}
                        {m.messageType === 'VIDEO' && m.fileUrl && (
                          <video src={m.fileUrl} controls style={{
                            maxWidth: '100%', borderRadius: 8, marginBottom: m.caption ? 6 : 0,
                          }} />
                        )}
                        {/* v13: ovozli xabar pleer — ilgari umuman ko'rsatilmasdi */}
                        {m.messageType === 'VOICE' && m.fileUrl && (
                          <audio src={m.fileUrl} controls style={{
                            maxWidth: 220, height: 34, marginBottom: m.caption || m.text ? 6 : 0,
                          }} />
                        )}
                        {m.messageType === 'DOCUMENT' && m.fileUrl && (
                          <a href={m.fileUrl} target="_blank" style={{
                            display: 'flex', gap: 8, padding: 8,
                            background: 'rgba(255,255,255,0.1)', borderRadius: 6,
                            color: 'inherit', marginBottom: m.caption ? 6 : 0,
                          }}>{t('inbox.file')}</a>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
                          {m.text || m.caption}
                        </div>
                        <div style={{
                          fontSize: 9, marginTop: 4,
                          opacity: 0.7, textAlign: 'right',
                        }}>
                          {new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          {isOut && m.isDelivered && ' ✓'}
                          {isOut && m.isRead && '✓'}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick actions toolbar */}
              <div style={{
                padding: '8px 16px',
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--border)',
                display: 'flex', gap: 6, flexWrap: 'wrap',
              }}>
                <Btn size="sm" variant="ghost" icon="📋" onClick={() => setShowTemplates(true)}>
                  Shablon
                </Btn>
                <Btn size="sm" variant="ghost" icon="📷" onClick={() => fileInputRef.current?.click()}>
                  Rasm
                </Btn>
                {/* v13: ovozli xabar yozish/yuborish tugmasi */}
                {!isRecording ? (
                  <Btn size="sm" variant="ghost" icon="🎤" onClick={startRecording}>
                    Ovozli xabar
                  </Btn>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                      ● {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                    </span>
                    <Btn size="sm" variant="secondary" onClick={cancelRecording}>{t('inbox.cancel')}</Btn>
                    <Btn size="sm" variant="primary" icon="✅" onClick={stopAndSendRecording}>Yuborish</Btn>
                  </div>
                )}
                <Btn size="sm" variant="ghost" icon="🧾" onClick={() => setShowInvoice(true)}>
                  Invoice yuborish
                </Btn>
                <input
                  ref={fileInputRef} type="file"
                  accept="image/*,video/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && uploadAndSend(e.target.files)}
                />
              </div>

              {/* Instagram: 24 soatlik javob oynasi */}
              {(() => {
                const w = igReplyWindow(active.channel, messages);
                if (!w) return null;
                if (w.expired) {
                  return (
                    <div style={{
                      padding: '10px 14px', background: '#ef444418',
                      borderTop: '1px solid var(--border)',
                      color: '#ef4444', fontSize: 12, fontWeight: 600,
                    }}>
                      ⛔ Instagram 24 soatlik javob oynasi yopilgan. Mijoz qayta
                      yozmaguncha xabar yuborib bo'lmaydi — telefon orqali bog'laning.
                    </div>
                  );
                }
                const warn = w.leftHours < 3;
                return (
                  <div style={{
                    padding: '8px 14px',
                    background: warn ? '#f59e0b18' : 'var(--bg-3)',
                    borderTop: '1px solid var(--border)',
                    color: warn ? '#f59e0b' : 'var(--fg-3)',
                    fontSize: 11, fontWeight: 600,
                  }}>
                    ⏳ Javob berish oynasi: {w.leftHours} soat {w.leftMinutes} daqiqa qoldi
                  </div>
                );
              })()}

              {/* Input */}
              <div style={{
                padding: 14,
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--border)',
                display: 'flex', gap: 8,
              }}>
                <Textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    igReplyWindow(active.channel, messages)?.expired
                      ? "Instagram oynasi yopilgan — yuborib bo'lmaydi"
                      : t('inbox.placeholder')
                  }
                  style={{ minHeight: 44, maxHeight: 120 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!igReplyWindow(active.channel, messages)?.expired) sendText();
                    }
                  }}
                />
                <Btn
                  variant="gradient"
                  onClick={sendText}
                  loading={sending}
                  disabled={!draft.trim() || !!igReplyWindow(active.channel, messages)?.expired}
                >
                  →
                </Btn>
              </div>
            </>
          )}
        </div>

        {/* ═══ v10.2: MIJOZ KONTEKST PANELI ═══
            Agent chatdan chiqmasdan mijozning bosqichi, daromadi,
            bookinglari va keyingi vazifasini ko'radi. */}
        {active?.clientId && showContext && (
          <ClientContextPanel
            key={active.clientId}
            clientId={active.clientId}
            onOpen={() => router.push(`/clients/${active.clientId}`)}
            onCall={(name: string, phone: string) => callClient(active.clientId, name, phone)}
            onClose={() => setShowContext(false)}
          />
        )}
        {active?.clientId && !showContext && (
          <button onClick={() => setShowContext(true)} title={t('inbox.openClientPanel')} style={{
            width: 34, borderLeft: '1px solid var(--border)', background: 'var(--bg-2)',
            border: 'none', cursor: 'pointer', color: 'var(--fg-3)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16,
          }}>
            <PanelRightOpen size={16} />
          </button>
        )}
      </div>

      {showTemplates && active && (
        <TemplatesPanel
          conversationId={active.id}
          conversation={active}
          onClose={() => setShowTemplates(false)}
          onSent={(msgs: any[]) => {
            setShowTemplates(false);
            // Yuborilgan xabarlarni darhol chatga qo'shamiz — refresh shart emas
            if (msgs?.length) {
              setMessages((prev: any[]) => {
                const existingIds = new Set(prev.map((m: any) => m.id));
                const fresh = msgs.filter((m: any) => !existingIds.has(m.id));
                return [...prev, ...fresh];
              });
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
          }}
        />
      )}

      {/* v9-SECURITY: Create Client Modal */}
      <CreateClientModal
        conv={createClientModal}
        onClose={() => setCreateClientModal(null)}
        onConfirm={createClientFromConv}
        formData={clientFormData}
        setFormData={setClientFormData}
      />

      {showInvoice && active && (
        <SendInvoiceModal
          conversation={active}
          onClose={() => setShowInvoice(false)}
          onSent={() => { setShowInvoice(false); toast.success(t('inbox.invoiceSent')); }}
        />
      )}
      {showNewPersonal && (
        <PersonalMessageModal
          onClose={() => setShowNewPersonal(false)}
          onSent={(convId: string) => {
            setShowNewPersonal(false);
            // Reload and open conversation
            setTimeout(() => {
              loadConvs();
              if (convId) {
                setTimeout(() => {
                  setActive({ id: convId });
                }, 600);
              }
            }, 300);
          }}
        />
      )}
    </CrmLayout>
  );
}

function TemplatesPanel({ conversationId, conversation, onClose, onSent }: any) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    telegramApi.templates({ category: category || undefined } as any)
      .then((r) => setTemplates(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  async function send(tplId: string) {
    setSending(tplId);
    try {
      const r: any = await telegramV6.sendTemplate(conversationId, tplId);
      toast.success(t('inbox.templateSent'));
      // Backend qaytargan real xabarlarni chatga qo'shamiz
      onSent(r.data?.messages || []);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSending(null); }
  }

  const categories = ['hotel', 'greeting', 'booking', 'payment', 'reminder', 'visa', 'feedback'];

  return (
    <Modal open onClose={onClose} title={t('inbox.selectTemplate')} maxWidth={620}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn size="sm" variant={!category ? 'primary' : 'secondary'} onClick={() => setCategory('')}>
          Barchasi
        </Btn>
        {categories.map((c) => (
          <Btn key={c} size="sm" variant={category === c ? 'primary' : 'secondary'} onClick={() => setCategory(c)}>
            {c === 'hotel' && '🏨'} {c}
          </Btn>
        ))}
      </div>

      {loading ? <Skeleton height={80} count={3} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.length === 0 && <Empty title={t('inbox.noTemplate')} icon="📋" />}
          {templates.map((tpl) => (
            <div key={tpl.id} style={{
              padding: 14, borderRadius: 10,
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tpl.name}</div>
                  {tpl.category && <Badge color="var(--info)">{tpl.category}</Badge>}
                  <Badge color="var(--fg-3)">{tpl.language}</Badge>
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--fg-2)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 80, overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {tpl.text}
                </div>
                {tpl.mediaUrl && (
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>{t('inbox.hasImage')}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="secondary" onClick={() => {
                    const text = window.prompt('Shablonni tahrirlang:', tpl.text);
                    if (text && text.trim()) {
                      telegramApi.sendMessage(conversationId, text, false)
                        .then((r: any) => {
                          toast.success(t('inbox.sent'));
                          // MUAMMO FIX: avval onSent() argumentsiz chaqirilardi,
                          // shu sabab yuborilgan xabar chatga qo'shilmasdi va
                          // faqat sahifa qayta yuklanganda (restart) ko'rinardi.
                          onSent(r.data ? [r.data] : []);
                        })
                        .catch((e: any) => toast.error(errMsg(e)));
                    }
                  }}>{t('inbox.editShort')}</Btn>
                  <Btn size="sm" variant="gradient" onClick={() => send(tpl.id)} loading={sending === tpl.id} disabled={!!sending}>Yuborish</Btn>
                </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// v9-SECURITY: Create Client from Telegram Modal
function CreateClientModal({   conv, 
  onClose, 
  onConfirm, 
  formData, 
  setFormData 
}: any) {
  const { t } = useI18n();
  const fullName = [conv?.firstName, conv?.lastName].filter(Boolean).join(' ')
    || conv?.username
    || conv?.externalUsername
    || 'Telegram klient';

  if (!conv) return null;

  return (
    <Modal open={!!conv} onClose={onClose} title={t('inbox.newClientTitle')} maxWidth={500}>
      <div style={{ padding: '0 20px 20px' }}>
        {/* Client name (read-only) */}
        <div style={{ marginBottom: 16 }}>
          <Label>{t('inbox.fullName')}</Label>
          <Input 
            value={fullName} 
            disabled 
            style={{ background: 'var(--bg-2)' }}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Telegram dan olingan
          </div>
        </div>

        {/* Phone number (optional) */}
        <div style={{ marginBottom: 16 }}>
          <Label>{t('inbox.phoneLabel')}<span style={{ color: 'var(--fg-3)' }}>{t('inbox.optional')}</span></Label>
          <Input 
            placeholder={t('inbox.phonePh')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{ fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Agar Telegram'dan raqam kelib tushgun: +998, () -  olib tashlang
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <Label>{t('inbox.notes')}</Label>
          <Textarea 
            placeholder={t('inbox.notePh')}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />
        </div>

        {/* Info */}
        <div style={{
          padding: 12,
          background: 'var(--bg-2)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--fg-2)',
          lineHeight: '1.5',
          marginBottom: 16,
        }}>
          <strong>ℹ️ Malumot:</strong><br/>
          Bu Telegram suhbati yanyi klientga bog'lanadi. Telefon raqam qo'shishingiz ixtiyoriy.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onConfirm} style={{ flex: 1 }}>{t('inbox.createBtn')}</Btn>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
        </div>
      </div>
    </Modal>
  );
}

function SendInvoiceModal({ conversation, onClose, onSent }: any) {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [form, setForm] = useState({
    bookingId: '', salePrice: '', providerCost: '', discount: '0',
    notes: '', dueDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!conversation.clientId) {
      setLoading(false);
      return;
    }
    bookingsApi.list({ clientId: conversation.clientId, limit: 50 })
      .then((r) => setBookings(r.data?.data || []))
      .finally(() => setLoading(false));
  }, [conversation.clientId]);

  useEffect(() => {
    if (!form.bookingId) return;
    const b = bookings.find((b) => b.id === form.bookingId);
    if (b) {
      setForm((f) => ({
        ...f,
        salePrice: String(b.totalPrice || ''),
        providerCost: String(b.supplierCost || ''),
      }));
    }
  }, [form.bookingId, bookings]);

  const sale = Number(form.salePrice) || 0;
  const cost = Number(form.providerCost) || 0;
  const discount = Number(form.discount) || 0;
  const profit = Math.max(0, sale - cost - discount);
  const isAdmin = user?.role !== 'AGENT';

  async function submit() {
    if (!form.bookingId) return toast.error(t('inbox.selectBooking'));
    setSending(true);
    try {
      await telegramV6.sendInvoice(conversation.id, {
        bookingId: form.bookingId,
        salePrice: Number(form.salePrice),
        providerCost: Number(form.providerCost) || 0,
        discount: Number(form.discount) || 0,
        notes: form.notes,
        dueDate: form.dueDate || undefined,
      });
      onSent();
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSending(false); }
  }

  return (
    <Modal
      open onClose={onClose}
      title={t('inbox.invoiceTitle')}
      maxWidth={520}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
          <Btn variant="gradient" onClick={submit} loading={sending}>{t('inbox.send2')}</Btn>
        </>
      }
    >
      {!conversation.clientId ? (
        <p style={{ color: 'var(--warning)' }}>⚠ Bu suhbatga klient bog'lanmagan. Avval klient profilini yarating.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Label>Booking *</Label>
            {loading ? <Skeleton height={40} /> : bookings.length === 0 ? (
              <p style={{ color: 'var(--fg-3)', fontSize: 12 }}>Bu klient uchun booking yo'q. Avval booking yarating.</p>
            ) : (
              <Select value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })}>
                <option value="">{t('inbox.selectDash')}</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bookingRef} • {b.tourName} • {b.currency} {b.totalPrice}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Sotuv narxi *</Label>
              <Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
            </div>
            {isAdmin && (
              <div>
                <Label>{t('inbox.providerCost')}</Label>
                <Input type="number" value={form.providerCost} onChange={(e) => setForm({ ...form, providerCost: e.target.value })} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>{t('inbox.discount')}</Label>
              <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div>
              <Label>{t('inbox.dueDate')}</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          <div style={{
            padding: 14, background: 'var(--bg-3)', borderRadius: 10,
            display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : '1fr',
            gap: 12, marginBottom: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('inbox.clientPays')}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>${(sale - discount).toFixed(0)}</div>
            </div>
            {isAdmin && (
              <>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Provider</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-2)' }}>${cost.toFixed(0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('inbox.yourProfit')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>${profit.toFixed(0)}</div>
                </div>
              </>
            )}
          </div>

          <div>
            <Label>{t('inbox.noteVisible')}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Personal Message Modal (birinchi xabar - MTProto orqali) ────────────────
function PersonalMessageModal({ onClose, onSent }: any) {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [method, setMethod] = useState<'phone' | 'username'>('phone');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!text.trim()) { toast.error(t('inbox.msgRequired')); return; }
    if (method === 'phone' && !phone.trim()) { toast.error(t('inbox.phoneRequired')); return; }
    if (method === 'username' && !username.trim()) { toast.error(t('inbox.usernameRequired')); return; }

    setLoading(true);
    try {
      const res = await userTelegramApi.sendMessage({
        phone: method === 'phone' ? phone.trim() : undefined,
        username: method === 'username' ? username.trim() : undefined,
        text: text.trim(),
      });
      const convId = (res.data as any).conversationId;
      toast.success(t('inbox.msgSent'));
      onSent(convId);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  const inp: any = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-2)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', marginBottom: 10,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        {/* v14: yopish tugmasi — yuqori chap burchakda, doim ko'rinadi */}
        <button
          onClick={onClose}
          title={t('common.close')}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 2,
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, paddingLeft: 38 }}>{t('inbox.firstMsg')}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--fg-3)' }}>
          Shaxsiy Telegram accountingiz orqali — klient /start yozmagan bo'lsa ham ishlaydi
        </p>

        {/* Method selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['phone','📞 Telefon raqam'],['username','👤 Username']].map(([m, label]) => (
            <button key={m} onClick={() => setMethod(m as any)} style={{
              flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: method === m ? '#3d7eff' : 'var(--bg-3)',
              color: method === m ? 'white' : 'var(--fg-2)',
              fontSize: 12, fontWeight: 600,
            }}>{label}</button>
          ))}
        </div>

        {method === 'phone' ? (
          <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998901234567" />
        ) : (
          <input style={inp} value={username} onChange={e => setUsername(e.target.value)} placeholder={t('inbox.usernamePh')} />
        )}

        <textarea
          style={{ ...inp, minHeight: 100, resize: 'vertical' }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('inbox.msgPh')}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) send(); }}
        />
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>Ctrl+Enter — yuborish</div>

        <button onClick={send} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          {loading ? 'Yuborilmoqda...' : '📨 Yuborish'}
        </button>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><span className="spinner spinner-lg" /></div>}>
      <InboxPageInner />
    </Suspense>
  );
}

// ═════════════════════════════════════════════════════════════
// v10.2: MIJOZ KONTEKST PANELI — chat yonidagi CRM kartasi
// ═════════════════════════════════════════════════════════════
function ClientContextPanel({ clientId, onOpen, onCall, onClose }: {
  clientId: string;
  onOpen: () => void;
  onCall: (name: string, phone: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [client, setClient] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      clientsApi.one(clientId).catch(() => ({ data: null })),
      bookingsApi.list({ clientId, limit: 3 }).catch(() => ({ data: { data: [] } })),
    ]).then(([c, b]: any[]) => {
      if (!alive) return;
      setClient(c.data);
      setBookings(b.data?.data || b.data || []);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clientId]);

  const stage = client?.pipelineStage;
  const stageColor = (STAGE_COLORS as any)?.[stage] || '#6366f1';
  const paidTotal = bookings.reduce((s, b) => s + Number(b.paidAmount || 0), 0);
  const debtTotal = bookings.reduce((s, b) => s + Math.max(0, Number(b.totalPrice || 0) - Number(b.paidAmount || 0)), 0);

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-2)' };
  const sect: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--border-2)' };

  return (
    <div style={{
      width: 264, flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--bg-2)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      <div style={{ ...sect, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)' }}>{t('inbox.clientCard')}</span>
        <button onClick={onClose} title={t('inbox.closePanel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'inline-flex' }}>
          <PanelRightClose size={15} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 14 }}><Skeleton height={54} count={4} /></div>
      ) : !client ? (
        <div style={{ padding: 20, fontSize: 12, color: 'var(--fg-3)', textAlign: 'center' }}>{t('inbox.clientNotFound')}</div>
      ) : (
        <>
          {/* Kim */}
          <div style={{ ...sect, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar name={client.fullName} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.fullName}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{client.phone}</div>
            </div>
          </div>

          {/* Bosqich */}
          <div style={sect}>
            <div style={{ ...row, marginBottom: 6 }}>
              <GitBranch size={13} style={{ color: 'var(--fg-3)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-3)' }}>{t('inbox.stage')}</span>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 8, background: stageColor + '20', color: stageColor }}>
              {(STAGE_LABELS as any)?.[stage] || stage || '—'}
            </span>
          </div>

          {/* Pul */}
          <div style={{ ...sect, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 3 }}>{t('inbox.paid')}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>${paidTotal.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 3 }}>{t('inbox.debt')}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: debtTotal > 0 ? '#ef4444' : 'var(--fg-3)' }}>${debtTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* Bookinglar */}
          <div style={sect}>
            <div style={{ ...row, marginBottom: 8 }}>
              <Plane size={13} style={{ color: 'var(--fg-3)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-3)' }}>Bookinglar ({bookings.length})</span>
            </div>
            {bookings.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('inbox.noBooking')}</div>
            ) : bookings.map((b: any) => (
              <div key={b.id} style={{ padding: '7px 9px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.tourName || b.destination || b.bookingRef}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>
                  <span>{b.departureDate ? new Date(b.departureDate).toLocaleDateString('uz-UZ') : b.status}</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>${Number(b.totalPrice || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Oxirgi izoh / manba */}
          <div style={sect}>
            <div style={{ ...row, marginBottom: 4 }}>
              <ClipboardList size={13} style={{ color: 'var(--fg-3)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-3)' }}>{t('inbox.infoLabel')}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              Manba: <b>{client.source || '—'}</b><br />
              {client.lastContactAt && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Oxirgi aloqa: {new Date(client.lastContactAt).toLocaleDateString('uz-UZ')}
                </span>
              )}
            </div>
          </div>

          {/* Amallar */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto' }}>
            {client.phone && (
              <Btn size="sm" variant="secondary" icon={<PhoneCall size={13} />} onClick={() => onCall(client.fullName, client.phone)}>
                Qo'ng'iroq qilish
              </Btn>
            )}
            <Btn size="sm" icon={<ExternalLink size={13} />} onClick={onOpen}>
              To'liq profil
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}