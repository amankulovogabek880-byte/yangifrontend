'use client';
import { useState } from 'react';
import { callsApi } from '@/services/api';
import { errMsg } from '@/lib/helpers';
import toast from 'react-hot-toast';

/**
 * v24: AI qo'ng'iroq tahlili oynasi — ilgari faqat `/calls` (Sotuvlar >
 * Qo'ng'iroqlar) sahifasida bor edi. Endi mijoz profilidagi (Client 360)
 * "Qo'ng'iroqlar" bo'limida ham xuddi shu oyna ishlatiladi — har bir
 * yozuvda AI tahlil qilish imkoniyati bo'lishi uchun umumiy komponentga
 * chiqarildi (ikki joyda nusxa saqlanmasin).
 */
export const SENTIMENT_EMOJI: Record<string, string> = { positive: '😊', neutral: '😐', negative: '😟' };
export const SENTIMENT_LABEL: Record<string, string> = { positive: 'Ijobiy', neutral: 'Neytral', negative: 'Salbiy' };

// v46: qo'ng'iroq turi — agent haqiqatda gaplashmagan (IVR/avtomatik javob,
// javobsiz) yoki mavzudan tashqari qo'ng'iroqlarni belgilaydi, shunda past
// ball ko'rilganda bu "yomon agent" emas "agent umuman gaplashmagan"
// ekani darhol tushunarli bo'ladi.
export const CALL_TYPE_LABEL: Record<string, string> = {
  ivr_or_voicemail: "🤖 Avtomatik javob (IVR) — agent gaplashmadi",
  no_answer_or_hangup: "📵 Javobsiz / uzilgan qo'ng'iroq",
  short_offtopic: "💬 Mavzudan tashqari qisqa suhbat",
};

export function fmtCallDuration(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AiAnalysisModal({ call, onClose, onUpdated }: { call: any; onClose: () => void; onUpdated: (c: any) => void }) {
  const [transcript, setTranscript] = useState(call.transcript || '');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [current, setCurrent] = useState(call);
  const [retrying, setRetrying] = useState(false);

  async function retryAiPipeline() {
    setRetrying(true);
    try {
      const r = await callsApi.retryAi(current.id);
      setCurrent((prev: any) => ({ ...prev, ...r.data }));
      onUpdated({ ...current, ...r.data });
      if (r.data?.transcript) setTranscript(r.data.transcript);
      if (r.data?.aiAnalyzedAt) toast.success('AI tahlil qildi ✅');
      else if (r.data?.aiError) toast.error(r.data.aiError);
      else toast.success("Qayta urinildi, natija bir necha soniyada ko'rinadi");
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setRetrying(false);
    }
  }

  async function saveTranscript() {
    if (!transcript.trim()) { toast.error("Matn bo'sh bo'lishi mumkin emas"); return; }
    setSavingTranscript(true);
    try {
      const r = await callsApi.setTranscript(current.id, transcript.trim());
      setCurrent((prev: any) => ({ ...prev, ...r.data }));
      onUpdated({ ...current, ...r.data });
      toast.success('Matn saqlandi');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSavingTranscript(false);
    }
  }

  async function runAnalyze() {
    if (!transcript.trim()) { toast.error("Avval qo'ng'iroq matnini kiriting"); return; }
    setAnalyzing(true);
    try {
      // Har doim eng so'nggi matn bilan tahlil qilinsin
      if (transcript.trim() !== (current.transcript || '')) {
        const saved = await callsApi.setTranscript(current.id, transcript.trim());
        setCurrent((prev: any) => ({ ...prev, ...saved.data }));
      }
      const r = await callsApi.analyze(current.id);
      setCurrent((prev: any) => ({ ...prev, ...r.data }));
      onUpdated({ ...current, ...r.data });
      toast.success('AI tahlil tayyor');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const objections: any[] = current.aiObjections || [];
  const nextAction: any = current.aiNextAction;
  const feedback: any = current.aiFeedback;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
        width: '100%', maxWidth: 640, padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🤖 AI qo'ng'iroq tahlili</h2>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              {current.client?.fullName || 'Notanish mijoz'} · {current.agent?.name || '—'} · {fmtCallDuration(current.duration)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg-3)' }}>✕</button>
        </div>

        {current.aiError && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            marginBottom: 16, padding: '10px 12px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
          }}>
            <div style={{ fontSize: 12.5, color: '#ef4444', lineHeight: 1.4 }}>
              ❌ Avtomatik AI jarayoni xato berdi: {current.aiError}
            </div>
            <button onClick={retryAiPipeline} disabled={retrying} style={{
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg-3)', color: 'var(--fg)', cursor: retrying ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>{retrying ? '…' : '🔄 Qayta urinish'}</button>
          </div>
        )}

        {current.recordingUrl && (
          <div style={{ marginBottom: 16 }}>
            <audio controls src={current.recordingUrl} style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', display: 'block', marginBottom: 6 }}>
            Qo'ng'iroq matni (transcript)
          </label>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>
            Avtomatik nutqni-matnga o'girish hozircha ulanmagan — yozuvni tinglab, matnni shu yerga joylang. Tahlil shu matn asosida ishlaydi.
          </div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder={"Agent: Assalomu alaykum...\nMijoz: Va alaykum assalom, men..."}
            rows={7}
            style={{
              width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-3)', color: 'var(--fg)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={saveTranscript} disabled={savingTranscript} style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)',
              color: 'var(--fg)', cursor: savingTranscript ? 'default' : 'pointer', fontSize: 12, fontWeight: 700,
            }}>{savingTranscript ? 'Saqlanmoqda...' : '💾 Matnni saqlash'}</button>
            <button onClick={runAnalyze} disabled={analyzing} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7eff',
              color: 'white', cursor: analyzing ? 'default' : 'pointer', fontSize: 12, fontWeight: 700,
            }}>{analyzing ? 'Tahlil qilinmoqda...' : (current.aiAnalyzedAt ? '🔄 Qayta tahlil qilish' : '✨ AI tahlil qilish')}</button>
          </div>
        </div>

        {current.aiAnalyzedAt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {(feedback?.overallScore != null || feedback?.churnRisk != null || feedback?.saleProbability != null) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {feedback?.overallScore != null && (
                  <div style={{ flex: '1 1 140px', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>🎯 Umumiy ball</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{feedback.overallScore}/100</div>
                  </div>
                )}
                {feedback?.churnRisk != null && (
                  <div style={{ flex: '1 1 140px', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>🔥 Mijozni yo'qotish xavfi</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: feedback.churnRisk >= 60 ? '#ef4444' : feedback.churnRisk >= 30 ? '#f59e0b' : '#10b981' }}>{feedback.churnRisk}%</div>
                  </div>
                )}
                {feedback?.saleProbability != null && (
                  <div style={{ flex: '1 1 140px', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>💰 Taxminiy sotuv ehtimoli</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: feedback.saleProbability >= 60 ? '#10b981' : feedback.saleProbability >= 30 ? '#f59e0b' : '#ef4444' }}>{feedback.saleProbability}%</div>
                  </div>
                )}
              </div>
            )}

            {feedback?.callType && CALL_TYPE_LABEL[feedback.callType] && (
              <div style={{
                fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b',
              }}>
                {CALL_TYPE_LABEL[feedback.callType]}
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 6 }}>
                Xulosa {current.aiSentiment && <span>· {SENTIMENT_EMOJI[current.aiSentiment]} {SENTIMENT_LABEL[current.aiSentiment]}</span>}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{current.aiSummary}</div>
            </div>

            {feedback?.mistakes?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 6 }}>📋 Top xatolar va ideal javoblar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {feedback.mistakes.map((m: any, i: number) => (
                    <div key={i} style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>💡 {m.mistake}</div>
                      {m.idealResponse && (
                        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                          🗣️ Ideal javob: <span style={{ color: 'var(--fg)' }}>"{m.idealResponse}"</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {objections.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 6 }}>E'tirozlar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {objections.map((o: any, i: number) => (
                    <div key={i} style={{ padding: '8px 10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', marginBottom: 2 }}>{o.label}</div>
                      {o.quote && <div style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>"{o.quote}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nextAction && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 6 }}>Keyingi qadam</div>
                <div style={{ padding: '10px 12px', background: 'rgba(61,126,255,0.08)', border: '1px solid rgba(61,126,255,0.25)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{nextAction.title}</div>
                  {nextAction.note && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{nextAction.note}</div>}
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
                    ✅ Eslatmalar bo'limiga {nextAction.daysUntilDue} kundan keyin bajarilishi uchun avtomatik qo'shildi
                  </div>
                </div>
              </div>
            )}

            {feedback && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-3)' }}>
                  Agent uchun feedback · Baho: <span style={{ color: feedback.score >= 7 ? '#10b981' : feedback.score >= 5 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{feedback.score}/10</span>
                </div>
                {feedback.strengths?.length > 0 && (
                  <div style={{ marginTop: 6, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 3 }}>👍 Kuchli tomonlar</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                      {feedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {feedback.improvements?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>💡 Yaxshilash kerak</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                      {feedback.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}