'use client';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Plus, MessageSquare, Wrench, ChevronDown, PencilLine, Mic, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAssistantApi, userTelegramApi } from '@/services/api';
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
  // v41: 2-bosqich — yozuvchi va qo'shimcha o'qish tool'lari
  createTask: 'vazifa yaratildi',
  draftFollowupMessage: 'xabar qoralamasi',
  updatePipelineStage: "pipeline bosqichi o'zgartirildi",
  createOfferDraft: 'taklif qoralamasi',
  createBookingDraft: 'booking qoralamasi',
  createClientLead: 'yangi lead',
  addClientNote: "izoh qo'shildi",
  markTaskDone: 'vazifa yakunlandi',
  rescheduleFollowup: "eslatma ko'chirildi",
  getInvoiceStatus: "to'lov holati",
  getClientTimeline: 'mijoz tarixi',
};

function toolLabel(name: string) {
  return TOOL_LABELS_UZ[name] || name;
}

const DRAFT_START = '[QORALAMA_BOSHI]';
const DRAFT_END = '[QORALAMA_OXIRI]';

/** Assistant javobini oddiy matn va (bo'lsa) [QORALAMA_BOSHI]...[QORALAMA_OXIRI] ichidagi qoralama qismga ajratadi */
function splitDraft(content: string): { before: string; draft: string | null; after: string } {
  const startIdx = content.indexOf(DRAFT_START);
  const endIdx = content.indexOf(DRAFT_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { before: content, draft: null, after: '' };
  }
  const before = content.slice(0, startIdx).trim();
  const draft = content.slice(startIdx + DRAFT_START.length, endIdx).trim();
  const after = content.slice(endIdx + DRAFT_END.length).trim();
  return { before, draft, after };
}

/** draftFollowupMessage chaqirilgan bo'lsa, xabar yuborish uchun kerakli mijoz ID'sini tool_call input'idan topadi */
function findDraftClientId(toolCalls?: { name: string; input: any }[]): string | undefined {
  return toolCalls?.find((t) => t.name === 'draftFollowupMessage')?.input?.clientId;
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
  // v43: MIKROFON — bosib gapirish, Whisper orqali matnga o'girilib,
  // Jarvis'ga xuddi yozma xabar kabi yuboriladi (buyruqlarni ham bajaradi,
  // chunki bir xil tool-use agent orqali o'tadi).
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Komponent yo'q qilinganda mikrofon oqimi ochiq qolib ketmasin
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

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

  /** Mikrofon tugmasi bosilganda — yozishni boshlaydi (brauzerdan ruxsat so'raydi) */
  async function startRecording() {
    if (recording || sending || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size > 800) sendVoice(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.");
    }
  }

  /** Mikrofon tugmasi qayta bosilganda — yozishni to'xtatadi va yuboradi */
  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    try { mediaRecorderRef.current?.stop(); } catch {}
  }

  /** Ovozli xabarni backendga yuboradi — Whisper matnga o'giradi, so'ng Jarvis (tool-use) javob beradi */
  async function sendVoice(blob: Blob) {
    setTranscribing(true);
    const pendingMsg: ChatMessage = { id: `tmp-a-${Date.now()}`, role: 'assistant', content: '', pending: true };
    setMessages((prev) => [...prev, pendingMsg]);
    setSending(true);
    try {
      const res = await aiAssistantApi.voiceChat(blob, conversationId);
      const { conversationId: cid, reply, toolCalls, transcript } = res.data || {};
      setConversationId(cid);
      const userMsg: ChatMessage = { id: `tmp-u-${Date.now()}`, role: 'user', content: transcript ? `🎙 ${transcript}` : '🎙 (ovozli xabar)' };
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== pendingMsg.id);
        return [...withoutPending, userMsg, { ...pendingMsg, content: reply, toolCalls, pending: false }];
      });
      aiAssistantApi.conversations().then((r) => setConversations(r.data || [])).catch(() => {});
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
      const msg = e?.response?.data?.message || "Ovozli xabarni qayta ishlab bo'lmadi.";
      toast.error(msg);
    } finally {
      setSending(false);
      setTranscribing(false);
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
      <style>{`@keyframes jarvis-dot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } } @keyframes jarvis-rec-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }`}</style>
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
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Mic size={11} /> Mikrofon tugmasini bosib gapirsangiz ham bajaraman
                </div>
              </div>
            ) : (
              messages.map((m) => {
                // v41: draftFollowupMessage chaqirilgan bo'lsa, javob matnidan
                // [QORALAMA_BOSHI]...[QORALAMA_OXIRI] ichidagi qismni ajratib,
                // alohida "Qoralama" blokida ko'rsatamiz (yuborish tugmasi bilan)
                const hasDraftTool = m.role === 'assistant' && !m.pending && m.toolCalls?.some((t) => t.name === 'draftFollowupMessage');
                const { before, draft, after } = hasDraftTool ? splitDraft(m.content) : { before: m.content, draft: null, after: '' };
                const draftClientId = hasDraftTool ? findDraftClientId(m.toolCalls) : undefined;

                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                    {(!draft || before) && (
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
                          before || m.content
                        )}
                      </div>
                    )}

                    {draft && (
                      <FollowupDraftBlock draftText={draft} clientId={draftClientId} />
                    )}

                    {draft && after && (
                      <div style={{
                        maxWidth: '85%', padding: '9px 12px', borderRadius: 14, borderBottomLeftRadius: 4,
                        background: 'var(--bg-3)', color: 'var(--fg)',
                        fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {after}
                      </div>
                    )}

                    {!!m.toolCalls?.length && !m.pending && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10.5, color: 'var(--fg-3)', padding: '0 2px',
                      }}>
                        <Wrench size={10} />
                        <span>{m.toolCalls.map((t) => toolLabel(t.name)).join(', ')} asosida</span>
                      </div>
                    )}
                  </div>
                );
              })
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
              onClick={recording ? stopRecording : startRecording}
              disabled={sending || transcribing}
              title={recording ? "To'xtatish va yuborish" : "Ovozli xabar (bosib gapiring)"}
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
                background: recording ? '#ef4444' : 'var(--bg-4)',
                color: recording ? '#fff' : 'var(--fg-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: sending || transcribing ? 'default' : 'pointer',
                animation: recording ? 'jarvis-rec-pulse 1.2s infinite' : undefined,
                opacity: transcribing ? 0.6 : 1,
              }}
            >
              {recording ? <Square size={14} /> : <Mic size={15} />}
            </button>
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

/**
 * v41: "Qoralama" bloki — Jarvis draftFollowupMessage tool'i orqali tayyorlagan
 * xabar matnini alohida ko'rsatadi va "Telegram orqali yuborish" tugmasi bilan
 * mavjud shaxsiy Telegram yuborish API'siga (userTelegramApi.sendMessage)
 * chaqiruv qiladi — Jarvis o'zi HECH QACHON xabar yubormaydi, buni faqat
 * foydalanuvchi shu tugmani bosib amalga oshiradi.
 */
function FollowupDraftBlock({ draftText, clientId }: { draftText: string; clientId?: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!clientId) {
      toast.error("Mijoz aniqlanmadi — xabarni qo'lda yuboring");
      return;
    }
    setSending(true);
    try {
      await userTelegramApi.sendMessage({ clientId, text: draftText });
      setSent(true);
      toast.success('Xabar Telegram orqali yuborildi');
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Xabarni yuborib bo'lmadi";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{
      maxWidth: '85%', borderRadius: 14, borderBottomLeftRadius: 4,
      border: '1px solid var(--warning-border, #e8c766)',
      background: 'var(--warning-bg, rgba(232, 199, 102, 0.12))',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
        fontSize: 10.5, fontWeight: 700, color: 'var(--fg-2)',
        borderBottom: '1px solid var(--warning-border, rgba(232, 199, 102, 0.35))',
        textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        <PencilLine size={11} />
        Qoralama — hali yuborilmagan
      </div>
      <div style={{ padding: '10px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--fg)' }}>
        {draftText}
      </div>
      <div style={{ padding: '0 10px 10px' }}>
        <button
          onClick={handleSend}
          disabled={sending || sent}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '7px 10px', borderRadius: 9, border: 'none',
            background: sent ? 'var(--bg-4)' : 'var(--gradient)',
            color: sent ? 'var(--fg-2)' : '#fff',
            fontSize: 12.5, fontWeight: 600,
            cursor: sending || sent ? 'default' : 'pointer',
          }}
        >
          <Send size={13} />
          {sent ? 'Yuborildi' : sending ? 'Yuborilmoqda...' : 'Telegram orqali yuborish'}
        </button>
      </div>
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