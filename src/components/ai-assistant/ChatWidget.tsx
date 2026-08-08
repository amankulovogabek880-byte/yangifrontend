'use client';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Plus, MessageSquare, Wrench, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAssistantApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * ═══════════════════════════════════════════════════════════════
 * v40: AI YORDAMCHI ("JARVIS") — suzuvchi chat widget
 * ═══════════════════════════════════════════════════════════════
 * Pastki o'ng burchakda suzuvchi tugma. Bosilganda chat oynasi
 * ochiladi. Har bir javob ostida qaysi tool (CRM ma'lumoti)
 * ishlatilgani kichik izoh sifatida ko'rsatiladi — bu ishonchni
 * oshiradi va "hallucinate" qilmaganini ko'rsatadi.
 *
 * Faqat shu kompaniyada AI yoqilgan bo'lsa ko'rinadi
 * (user.tenantAiEnabled — auth store orqali /auth/me dan keladi).
 */

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; input: any }[];
  pending?: boolean;
};

type ConversationSummary = { id: string; title?: string | null; updatedAt: string };

const TOOL_LABELS_UZ: Record<string, string> = {
  getClientInfo: 'mijoz maʼlumoti',
  listPipelineByStage: 'pipeline roʻyxati',
  getTodayFollowups: 'bugungi eslatmalar',
  getCallAnalysisSummary: "qoʻngʻiroq tahlili",
  getKpiStats: 'statistika',
  getBookingStatus: 'booking holati',
  searchMarketplaceTours: 'tur takliflari',
};

function toolLabel(name: string) {
  return TOOL_LABELS_UZ[name] || name;
}

export default function ChatWidget() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as any)) setConvOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // AI bu kompaniyada yoqilmagan yoki foydalanuvchi hali aniqlanmagan bo'lsa — widget umuman ko'rinmaydi
  if (!user || !(user as any).tenantAiEnabled) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !conversations.length) {
      aiAssistantApi.conversations().then((r) => setConversations(r.data || [])).catch(() => {});
    }
    if (next) setTimeout(() => inputRef.current?.focus(), 150);
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setConvOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function openConversation(id: string) {
    setConvOpen(false);
    setConversationId(id);
    setLoadingHistory(true);
    try {
      const res = await aiAssistantApi.messages(id);
      const rows = res.data?.messages || [];
      setMessages(rows.map((m: any) => ({ id: m.id, role: m.role, content: m.content, toolCalls: m.toolCalls })));
    } catch {
      toast.error("Suhbat tarixini yuklab bo'lmadi");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');

    const userMsg: ChatMessage = { id: `tmp-u-${Date.now()}`, role: 'user', content: text };
    const pendingMsg: ChatMessage = { id: `tmp-a-${Date.now()}`, role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setSending(true);

    try {
      const res = await aiAssistantApi.chat({ conversationId, message: text });
      const { conversationId: cid, reply, toolCalls } = res.data || {};
      setConversationId(cid);
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { ...m, content: reply, toolCalls, pending: false } : m)),
      );
      // Suhbatlar ro'yxatini yangilaymiz (yangi suhbat bo'lsa yuqoriga chiqadi)
      aiAssistantApi.conversations().then((r) => setConversations(r.data || [])).catch(() => {});
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
      const msg = e?.response?.data?.message || "Jarvis hozir javob bera olmadi. Birozdan keyin qayta urinib ko'ring.";
      toast.error(msg);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const panelWidth = isMobile ? 'calc(100vw - 24px)' : 380;
  const panelHeight = isMobile ? 'min(70vh, 560px)' : 520;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        bottom: isMobile ? 76 : 20,
        right: isMobile ? 12 : 20,
        zIndex: 8500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <style>{`@keyframes jarvis-dot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }`}</style>
      {open && (
        <div
          style={{
            width: panelWidth,
            height: panelHeight,
            maxHeight: '80vh',
            background: 'var(--bg-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              background: 'var(--gradient-subtle)', position: 'relative',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 9, background: 'var(--gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--fg)' }}>Jarvis</div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>AI yordamchi</div>
            </div>

            <button
              onClick={() => setConvOpen((v) => !v)}
              title="Suhbatlar"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)',
                display: 'flex', alignItems: 'center', gap: 2, padding: 6, borderRadius: 8,
              }}
            >
              <MessageSquare size={16} />
              <ChevronDown size={12} />
            </button>
            <button
              onClick={startNewChat}
              title="Yangi suhbat"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', padding: 6, borderRadius: 8 }}
            >
              <Plus size={17} />
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Yopish"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', padding: 6, borderRadius: 8 }}
            >
              <X size={17} />
            </button>

            {convOpen && (
              <div style={{
                position: 'absolute', top: 48, right: 10, width: 240,
                background: 'var(--bg-2)', border: '1px solid var(--border-strong)',
                borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 20,
                maxHeight: 260, overflowY: 'auto',
              }}>
                {!conversations.length && (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--fg-2)' }}>Hozircha suhbatlar yo'q</div>
                )}
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', background: c.id === conversationId ? 'var(--bg-hover)' : 'none',
                      border: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, color: 'var(--fg)',
                    }}
                  >
                    {c.title || 'Suhbat'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingHistory ? (
              <div style={{ fontSize: 12.5, color: 'var(--fg-2)', textAlign: 'center', marginTop: 20 }}>Yuklanmoqda...</div>
            ) : !messages.length ? (
              <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--fg-2)' }}>
                <Sparkles size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Salom! Men Jarvisman 👋</div>
                <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Mijoz holati, bugungi eslatmalar, statistika yoki booking haqida so'rang — CRM ma'lumotidan javob beraman.
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '9px 12px', borderRadius: 14,
                    borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                    borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14,
                    background: m.role === 'user' ? 'var(--gradient)' : 'var(--bg-3)',
                    color: m.role === 'user' ? '#fff' : 'var(--fg)',
                    fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.pending ? (
                      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', opacity: 0.7 }}>
                        <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                  {!!m.toolCalls?.length && !m.pending && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4, marginTop: 3,
                      fontSize: 10.5, color: 'var(--fg-3)', padding: '0 2px',
                    }}>
                      <Wrench size={10} />
                      <span>{m.toolCalls.map((t) => toolLabel(t.name)).join(', ')} asosida</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--border)', padding: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Savolingizni yozing..."
              rows={1}
              style={{
                flex: 1, resize: 'none', maxHeight: 90, background: 'var(--bg-input)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px',
                fontSize: 13, color: 'var(--fg)', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
                background: !input.trim() || sending ? 'var(--bg-4)' : 'var(--gradient)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !input.trim() || sending ? 'default' : 'pointer',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Suzuvchi tugma */}
      <button
        onClick={toggle}
        style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--gradient)', color: '#fff', boxShadow: 'var(--shadow-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Jarvis — AI yordamchi"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      style={{
        width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
        display: 'inline-block', animation: `jarvis-dot 1s ${delay}s infinite ease-in-out`,
      }}
    />
  );
}