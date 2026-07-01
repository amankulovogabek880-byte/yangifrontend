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
import toast from 'react-hot-toast';

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
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useSocket();

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
      await telegramV6.sendMedia(active.id, {
        fileUrl: url, mimeType, mediaType,
        caption: draft || undefined,
      });
      // Show sent media in chat
      setDraft('');
      setMsgRefresh((n: number) => n + 1);
      toast.success('Yuborildi', { id: 'upload' });
    } catch (e: any) { toast.error(errMsg(e), { id: 'upload' }); }
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
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <Input placeholder="🔍 Suhbat qidirish" value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 14 }}><Skeleton height={60} count={5} /></div>}
            {!loading && convs.length === 0 && <Empty title="Suhbat yo'q" icon="💬" />}
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
                return <Empty title="Hech narsa topilmadi" icon="🔍" />;
              }
              return filtered.map((c) => {
              const isActive = active?.id === c.id;
              return (
                <div key={c.id} onClick={() => setActive(c)} style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-2)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
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
                      {CHANNEL_ICONS[c.channel]}
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
              <Empty title="Suhbat tanlang" description="Chap tomondan suhbatni tanlang" icon="💬" />
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
                  <Empty title="Hozircha xabar yo'q" icon="💬" />
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
                        {m.messageType === 'IMAGE' && m.fileUrl && (
                          <img src={m.fileUrl} alt="" style={{
                            maxWidth: '100%', borderRadius: 8, marginBottom: m.caption ? 6 : 0,
                          }} />
                        )}
                        {m.messageType === 'DOCUMENT' && m.fileUrl && (
                          <a href={m.fileUrl} target="_blank" style={{
                            display: 'flex', gap: 8, padding: 8,
                            background: 'rgba(255,255,255,0.1)', borderRadius: 6,
                            color: 'inherit', marginBottom: m.caption ? 6 : 0,
                          }}>📎 Fayl</a>
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

              {/* Input */}
              <div style={{
                padding: 14,
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--border)',
                display: 'flex', gap: 8,
              }}>
                <Textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('inbox.placeholder')}
                  style={{ minHeight: 44, maxHeight: 120 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                />
                <Btn variant="gradient" onClick={sendText} loading={sending} disabled={!draft.trim()}>
                  →
                </Btn>
              </div>
            </>
          )}
        </div>
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
          onSent={() => { setShowInvoice(false); toast.success('Invoice yuborildi!'); }}
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
      toast.success('Shablon yuborildi');
      // Backend qaytargan real xabarlarni chatga qo'shamiz
      onSent(r.data?.messages || []);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSending(null); }
  }

  const categories = ['hotel', 'greeting', 'booking', 'payment', 'reminder', 'visa', 'feedback'];

  return (
    <Modal open onClose={onClose} title="📋 Shablon tanlang" maxWidth={620}>
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
          {templates.length === 0 && <Empty title="Shablon yo'q" icon="📋" />}
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
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>📎 Rasm bor</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="secondary" onClick={() => {
                    const text = window.prompt('Shablonni tahrirlang:', tpl.text);
                    if (text && text.trim()) {
                      telegramApi.sendMessage(conversationId, text, false)
                        .then(() => { toast.success('Yuborildi'); onSent(); })
                        .catch((e: any) => toast.error('Xato'));
                    }
                  }}>✏️ Tahrir</Btn>
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
function CreateClientModal({ 
  conv, 
  onClose, 
  onConfirm, 
  formData, 
  setFormData 
}: any) {
  const fullName = [conv?.firstName, conv?.lastName].filter(Boolean).join(' ')
    || conv?.username
    || conv?.externalUsername
    || 'Telegram klient';

  if (!conv) return null;

  return (
    <Modal open={!!conv} onClose={onClose} title="👤 Yanyi klient yaratish" maxWidth={500}>
      <div style={{ padding: '0 20px 20px' }}>
        {/* Client name (read-only) */}
        <div style={{ marginBottom: 16 }}>
          <Label>To'liq ismi</Label>
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
          <Label>📱 Telefon raqami <span style={{ color: 'var(--fg-3)' }}>(ixtiyoriy)</span></Label>
          <Input 
            placeholder="Masalan: +998901234567"
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
          <Label>Izohlar</Label>
          <Textarea 
            placeholder="Qandaydir izoh..."
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
          <Btn onClick={onConfirm} style={{ flex: 1 }}>✅ Yaratish</Btn>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Bekor</Btn>
        </div>
      </div>
    </Modal>
  );
}

function SendInvoiceModal({ conversation, onClose, onSent }: any) {
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
    if (!form.bookingId) return toast.error('Booking tanlang');
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
      title="🧾 Invoice yuborish (Telegram orqali)"
      maxWidth={520}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Bekor</Btn>
          <Btn variant="gradient" onClick={submit} loading={sending}>📨 Yuborish</Btn>
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
                <option value="">— Tanlang —</option>
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
                <Label>Provider Cost</Label>
                <Input type="number" value={form.providerCost} onChange={(e) => setForm({ ...form, providerCost: e.target.value })} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Chegirma</Label>
              <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div>
              <Label>To'lov muddati</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          <div style={{
            padding: 14, background: 'var(--bg-3)', borderRadius: 10,
            display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(3, 1fr)' : '1fr',
            gap: 12, marginBottom: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Klient to'laydi</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>${(sale - discount).toFixed(0)}</div>
            </div>
            {isAdmin && (
              <>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Provider</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-2)' }}>${cost.toFixed(0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Sizning foydangiz</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>${profit.toFixed(0)}</div>
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Izoh (mijozga ko'rinadi)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Personal Message Modal (birinchi xabar - MTProto orqali) ────────────────
function PersonalMessageModal({ onClose, onSent }: any) {
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [method, setMethod] = useState<'phone' | 'username'>('phone');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!text.trim()) { toast.error('Xabar matni kerak'); return; }
    if (method === 'phone' && !phone.trim()) { toast.error('Telefon raqami kerak'); return; }
    if (method === 'username' && !username.trim()) { toast.error('Username kerak'); return; }

    setLoading(true);
    try {
      const res = await userTelegramApi.sendMessage({
        phone: method === 'phone' ? phone.trim() : undefined,
        username: method === 'username' ? username.trim() : undefined,
        text: text.trim(),
      });
      const convId = (res.data as any).conversationId;
      toast.success('✅ Xabar yuborildi!');
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>📱 Birinchi xabar yuborish</h2>
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
          <input style={inp} value={username} onChange={e => setUsername(e.target.value)} placeholder="@username yoki username" />
        )}

        <textarea
          style={{ ...inp, minHeight: 100, resize: 'vertical' }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Xabar matni..."
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) send(); }}
        />
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>Ctrl+Enter — yuborish</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer', fontSize: 13 }}>Bekor</button>
          <button onClick={send} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {loading ? 'Yuborilmoqda...' : '📨 Yuborish'}
          </button>
        </div>
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